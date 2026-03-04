// src/services/driftSwap.ts
// ==============================================================
// Client-side Drift spot swap service.
// Calls the Vercel API to build an unsigned placeAndTakeSpotOrder
// transaction, then signs via MWA and submits to Solana RPC.
// Same pattern as jupiterSwap.ts.
// ==============================================================

import {
  Connection,
  VersionedTransaction,
  TransactionConfirmationStrategy,
} from '@solana/web3.js';
import { decode as atob } from 'base-64';

// ── Config ───────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// ── Types ────────────────────────────────────────────────────
export interface DriftSwapParams {
  wallet: string;
  subAccount?: number;
  fromSymbol: string;
  toSymbol: string;
  /** Amount in token units (e.g., 1.5 SOL) */
  amount: number;
}

export interface DriftSwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  fromSymbol?: string;
  toSymbol?: string;
  amount?: number;
}

// ── Internal helpers ─────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Execute a Drift spot swap: build tx via API → sign via MWA → submit to RPC.
 */
export async function executeDriftSwap(
  params: DriftSwapParams,
  signTransaction: (transaction: any) => Promise<any>,
): Promise<DriftSwapResult> {
  const { wallet, subAccount, fromSymbol, toSymbol, amount } = params;

  if (!API_BASE || API_BASE === 'https://your-app.vercel.app') {
    return { success: false, error: 'EXPO_PUBLIC_API_URL not configured' };
  }

  const url = `${API_BASE}/api/drift/swap`;

  console.log(`[DRIFT-SWAP] Executing: ${amount} ${fromSymbol} → ${toSymbol}`);

  try {
    // ── 1. Get unsigned transaction from API ─────────────────
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, subAccount, fromSymbol, toSymbol, amount }),
      });
    } catch (networkError: any) {
      console.error(`[DRIFT-SWAP] Network error:`, networkError.message);
      throw new Error('Cannot reach swap server. Check your connection.');
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const err = await response.json();
        errorDetail = err.error || err.details || '';
      } catch {
        errorDetail = await response.text().catch(() => '');
      }
      console.error(`[DRIFT-SWAP] API error: HTTP ${response.status}`, errorDetail);
      throw new Error(errorDetail || `Drift swap server error (HTTP ${response.status})`);
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    if (!txBase64) {
      throw new Error('No transaction returned from Drift swap API');
    }

    // ── 2. Deserialize the versioned transaction ─────────────
    const transactionBuffer = base64ToUint8Array(txBase64);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    console.log('[DRIFT-SWAP] Transaction deserialized, requesting signature...');

    // ── 3. Sign with wallet (MWA) ────────────────────────────
    const signedTransaction = await signTransaction(transaction);

    console.log('[DRIFT-SWAP] Transaction signed, submitting...');

    // ── 4. Submit to Solana RPC ──────────────────────────────
    const connection = new Connection(RPC_URL, 'confirmed');

    const rawTransaction = signedTransaction.serialize
      ? signedTransaction.serialize()
      : signedTransaction;

    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed',
    });

    console.log(`[DRIFT-SWAP] Submitted: ${signature}`);

    // ── 5. Confirm transaction ───────────────────────────────
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');

    const confirmStrategy: TransactionConfirmationStrategy = {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
    };

    const confirmation = await connection.confirmTransaction(confirmStrategy, 'confirmed');

    if (confirmation.value.err) {
      console.error('[DRIFT-SWAP] Transaction failed on-chain:', confirmation.value.err);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`[DRIFT-SWAP] Confirmed: ${signature}`);

    return {
      success: true,
      signature,
      fromSymbol,
      toSymbol,
      amount,
    };

  } catch (error: any) {
    console.error('[DRIFT-SWAP] Error:', error);

    let message = error.message || 'Drift swap failed';
    if (message.includes('User rejected')) {
      message = 'Transaction cancelled by user';
    } else if (message.includes('insufficient')) {
      message = 'Insufficient balance for this swap';
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Check if Drift swap service is configured.
 */
export function isDriftSwapConfigured(): boolean {
  return !!API_BASE && API_BASE !== 'https://your-app.vercel.app';
}
