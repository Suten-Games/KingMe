// src/services/kaminoLend.ts
// Kamino lending deposit/withdraw — calls the KingMe API to build
// unsigned transactions, then signs via wallet provider.

import { VersionedTransaction, Connection } from '@solana/web3.js';
import { Platform } from 'react-native';
import { decode as atob } from 'base-64';

const API_BASE = 'https://kingme-api.vercel.app/api/kamino';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const isWeb = Platform.OS === 'web';

export interface KaminoRate {
  symbol: string;
  mint: string;
  supplyApr: number;
  borrowApr: number;
  tvl: number;
}

export interface KaminoBalance {
  symbol: string;
  mint: string;
  amount: number;
  valueUsd: number;
  price: number;
}

export interface KaminoPositions {
  deposits: KaminoBalance[];
  borrows: KaminoBalance[];
  totalSupplied: number;
  totalBorrowed: number;
  ltv: number;
  healthFactor: number;
}

export interface KaminoTxResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// ── Fetch rates for all reserves ────────────────────────────────
export async function fetchKaminoRates(): Promise<KaminoRate[]> {
  const res = await fetch(`${API_BASE}/rates`);
  if (!res.ok) throw new Error(`Kamino rates failed: ${res.status}`);
  const data = await res.json();
  // Normalize — API may return { reserves: [...] } or direct array
  return data.reserves || data.rates || data || [];
}

// ── Fetch user positions ────────────────────────────────────────
export async function fetchKaminoBalances(wallet: string): Promise<KaminoPositions> {
  const res = await fetch(`${API_BASE}/balances?wallet=${wallet}`);
  if (!res.ok) {
    if (res.status === 404) return { deposits: [], borrows: [], totalSupplied: 0, totalBorrowed: 0, ltv: 0, healthFactor: 0 };
    throw new Error(`Kamino balances failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    deposits: data.deposits || data.positions || [],
    borrows: data.borrows || [],
    totalSupplied: data.totalSupplied || data.totalDeposited || 0,
    totalBorrowed: data.totalBorrowed || 0,
    ltv: data.ltv || 0,
    healthFactor: data.healthFactor || 0,
  };
}

// ── Execute deposit ─────────────────────────────────────────────
export async function executeKaminoDeposit(
  wallet: string,
  mint: string,
  amount: number,
  signTransaction: (tx: any) => Promise<any>,
  signAndSendTransaction?: (tx: any) => Promise<{ signature: string }>,
): Promise<KaminoTxResult> {
  try {
    // 1. Build unsigned tx from API
    const res = await fetch(`${API_BASE}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, mint, amount }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Deposit failed: ${res.status}`);
    }

    const { transaction, lastValidBlockHeight } = await res.json();
    if (!transaction) throw new Error('No transaction returned from API');

    // 2. Deserialize
    const txBuffer = base64ToUint8Array(transaction);
    const tx = VersionedTransaction.deserialize(txBuffer);

    // 3. Sign + submit
    let signature: string;
    if (isWeb && signAndSendTransaction) {
      const result = await signAndSendTransaction(tx);
      signature = result.signature;
    } else {
      const signed = await signTransaction(tx);
      const connection = new Connection(RPC_URL, 'confirmed');
      const raw = signed.serialize ? signed.serialize() : signed;
      signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');
    }

    console.log(`[KAMINO] Deposit confirmed: ${signature}`);
    return { success: true, signature };

  } catch (error: any) {
    let message = error.message || 'Deposit failed';
    if (message.includes('User rejected')) message = 'Transaction cancelled by user';
    return { success: false, error: message };
  }
}

// ── Execute withdraw ────────────────────────────────────────────
export async function executeKaminoWithdraw(
  wallet: string,
  mint: string,
  amount: number,
  signTransaction: (tx: any) => Promise<any>,
  signAndSendTransaction?: (tx: any) => Promise<{ signature: string }>,
): Promise<KaminoTxResult> {
  try {
    const res = await fetch(`${API_BASE}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, mint, amount }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Withdraw failed: ${res.status}`);
    }

    const { transaction, lastValidBlockHeight } = await res.json();
    if (!transaction) throw new Error('No transaction returned from API');

    const txBuffer = base64ToUint8Array(transaction);
    const tx = VersionedTransaction.deserialize(txBuffer);

    let signature: string;
    if (isWeb && signAndSendTransaction) {
      const result = await signAndSendTransaction(tx);
      signature = result.signature;
    } else {
      const signed = await signTransaction(tx);
      const connection = new Connection(RPC_URL, 'confirmed');
      const raw = signed.serialize ? signed.serialize() : signed;
      signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');
    }

    console.log(`[KAMINO] Withdraw confirmed: ${signature}`);
    return { success: true, signature };

  } catch (error: any) {
    let message = error.message || 'Withdraw failed';
    if (message.includes('User rejected')) message = 'Transaction cancelled by user';
    return { success: false, error: message };
  }
}

// ── Find tokens that could earn more on Kamino ──────────────────
export interface KaminoOpportunity {
  assetId: string;
  symbol: string;
  mint: string;
  currentValue: number;
  currentApy: number;
  kaminoApy: number;
  apyGain: number;
  additionalAnnualIncome: number;
  additionalMonthlyIncome: number;
}

export function findKaminoOpportunities(
  assets: any[],
  kaminoRates: KaminoRate[],
): KaminoOpportunity[] {
  const ratesBySymbol = new Map<string, KaminoRate>();
  const ratesByMint = new Map<string, KaminoRate>();
  for (const r of kaminoRates) {
    if (r.symbol) ratesBySymbol.set(r.symbol.toUpperCase(), r);
    if (r.mint) ratesByMint.set(r.mint, r);
  }

  const opportunities: KaminoOpportunity[] = [];

  for (const asset of assets) {
    const meta = asset.metadata as any;
    const mint = meta?.tokenMint || meta?.mint || '';
    const symbol = (meta?.symbol || asset.name || '').toUpperCase();
    if (!mint || asset.value < 10) continue;

    // Skip if already on Kamino
    if (meta?.protocol?.toLowerCase() === 'kamino') continue;

    const rate = ratesBySymbol.get(symbol) || ratesByMint.get(mint);
    if (!rate || rate.supplyApr <= 0) continue;

    const currentApy = meta?.apy || 0;
    const apyGain = rate.supplyApr - currentApy;

    // Only suggest if Kamino offers meaningful improvement (>1% better or currently 0)
    if (apyGain < 1 && currentApy > 0) continue;

    const additionalAnnual = asset.value * (apyGain / 100);
    opportunities.push({
      assetId: asset.id,
      symbol,
      mint,
      currentValue: asset.value,
      currentApy,
      kaminoApy: rate.supplyApr,
      apyGain,
      additionalAnnualIncome: additionalAnnual,
      additionalMonthlyIncome: additionalAnnual / 12,
    });
  }

  // Sort by additional income descending
  opportunities.sort((a, b) => b.additionalAnnualIncome - a.additionalAnnualIncome);
  return opportunities;
}

// ── Helpers ─────────────────────────────────────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
