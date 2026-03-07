// src/services/addOnPayment.ts
// ═══════════════════════════════════════════════════════════════════════════════
// USDC payment service for premium add-ons.
// Builds an SPL token transfer to the KingMe treasury, signs via wallet,
// confirms on-chain, then stores unlock state locally.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Config ───────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

const TREASURY_WALLET = new PublicKey('AY9orTn5i8jbHU4RyC1k4MhzXchJaMpmQahpMrLfQCXi');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const UNLOCKED_KEY = 'paid_addons_unlocked';
const RECEIPTS_KEY = 'paid_addons_receipts';

// ── Types ────────────────────────────────────────────────────
export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface PaymentReceipt {
  addonId: string;
  signature: string;
  walletAddress: string;
  amount: number;
  timestamp: string;
}

// ── ATA derivation ───────────────────────────────────────────
function getAssociatedTokenAddress(wallet: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

// ── Create ATA instruction (idempotent) ──────────────────────
function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([1]), // 1 = CreateIdempotent
  });
}

// ── SPL Transfer instruction ─────────────────────────────────
function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction index
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

// ── Parse price string to USDC amount ────────────────────────
export function parsePriceToUsdc(priceStr: string): number {
  // "$4.99" → 4.99
  return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
}

// ── Execute USDC payment ─────────────────────────────────────
export async function payForAddOn(
  addonId: string,
  priceUsd: number,
  userPublicKey: string,
  signTransaction: (transaction: any) => Promise<any>,
  signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>,
): Promise<PaymentResult> {
  const isWeb = Platform.OS === 'web';

  try {
    const payer = new PublicKey(userPublicKey);
    const payerAta = getAssociatedTokenAddress(payer, USDC_MINT);
    const treasuryAta = getAssociatedTokenAddress(TREASURY_WALLET, USDC_MINT);
    const amountSmallest = BigInt(Math.round(priceUsd * 10 ** USDC_DECIMALS));

    console.log(`[PAYMENT] ${addonId}: ${priceUsd} USDC from ${userPublicKey.slice(0, 8)}...`);
    console.log(`[PAYMENT] Payer ATA: ${payerAta.toBase58()}`);
    console.log(`[PAYMENT] Treasury ATA: ${treasuryAta.toBase58()}`);

    // Use RPC proxy to avoid rate limits
    const rpcEndpoint = `${API_BASE}/api/rpc/send`;
    const connection = new Connection(RPC_URL, 'confirmed');

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Build transaction
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Ensure treasury ATA exists (idempotent — no-op if already created)
    tx.add(createAssociatedTokenAccountIdempotentInstruction(
      payer, treasuryAta, TREASURY_WALLET, USDC_MINT,
    ));

    // Transfer USDC
    tx.add(createTransferInstruction(payerAta, treasuryAta, payer, amountSmallest));

    // Sign and send
    let signature: string;

    if (isWeb && signAndSendTransaction) {
      console.log('[PAYMENT] Using signAndSendTransaction (web)...');
      const result = await signAndSendTransaction(tx);
      signature = result.signature;
    } else {
      console.log('[PAYMENT] Using signTransaction + manual submit...');
      const signed = await signTransaction(tx);
      const raw = signed.serialize ? signed.serialize() : signed;
      signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      // Confirm
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    console.log(`[PAYMENT] Confirmed: ${signature}`);

    // Verify on-chain via API
    try {
      const verifyRes = await fetch(`${API_BASE}/api/addons/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          addonId,
          walletAddress: userPublicKey,
          expectedAmount: priceUsd,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        console.warn('[PAYMENT] API verification failed, but tx confirmed on-chain. Unlocking anyway.');
      }
    } catch (verifyErr) {
      console.warn('[PAYMENT] Could not reach verify API, unlocking based on on-chain confirmation:', verifyErr);
    }

    // Store unlock locally
    await unlockAddOn(addonId);

    // Store receipt
    const receipt: PaymentReceipt = {
      addonId,
      signature,
      walletAddress: userPublicKey,
      amount: priceUsd,
      timestamp: new Date().toISOString(),
    };
    await storeReceipt(receipt);

    return { success: true, signature };

  } catch (error: any) {
    console.error('[PAYMENT] Error:', error);

    let message = error.message || 'Payment failed';
    if (message.includes('User rejected') || message.includes('cancelled')) {
      message = 'Payment cancelled';
    } else if (message.includes('insufficient') || message.includes('0x1')) {
      message = 'Insufficient USDC balance';
    }

    return { success: false, error: message };
  }
}

// ── Local unlock management ──────────────────────────────────
export async function unlockAddOn(addonId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
  const unlocked: string[] = raw ? JSON.parse(raw) : [];
  if (!unlocked.includes(addonId)) {
    unlocked.push(addonId);
    await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
  }
}

export async function getUnlockedAddOns(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
  return new Set(raw ? JSON.parse(raw) : []);
}

export async function isAddOnUnlocked(addonId: string): Promise<boolean> {
  const unlocked = await getUnlockedAddOns();
  return unlocked.has(addonId);
}

// ── Receipt storage ──────────────────────────────────────────
async function storeReceipt(receipt: PaymentReceipt): Promise<void> {
  const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
  const receipts: PaymentReceipt[] = raw ? JSON.parse(raw) : [];
  receipts.push(receipt);
  await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
}

export async function getReceipts(): Promise<PaymentReceipt[]> {
  const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
  return raw ? JSON.parse(raw) : [];
}
