// src/services/driftSwap.ts
// ==============================================================
// Client-side Drift spot swap service.
// Calls the Vercel API to build an unsigned placeAndTakeSpotOrder
// transaction, then signs via wallet and submits to Solana RPC.
// Uses signAndSendTransaction on web (Phantom requires it).
// ==============================================================

import {
  Connection,
  VersionedTransaction,
  TransactionConfirmationStrategy,
} from '@solana/web3.js';
import { Platform } from 'react-native';
import { decode as atob } from 'base-64';
import { log, warn, error as logError } from '../utils/logger';

// ── Config ───────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme-api.vercel.app';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// ── Types ────────────────────────────────────────────────────
export interface DriftSwapParams {
  wallet: string;
  subAccount?: number;
  fromSymbol: string;
  toSymbol: string;
  /** Amount in token units (e.g., 100 syrupUSDC) */
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
 * Execute a Drift collateral swap.
 *
 * On web: uses signAndSendTransaction (Phantom blocks signTransaction on
 * untrusted domains — signAndSendTransaction shows tx details and is allowed).
 *
 * On mobile: uses signTransaction + manual RPC submit (MWA pattern).
 */
export async function executeDriftSwap(
  params: DriftSwapParams,
  signTransaction: (transaction: any) => Promise<any>,
  signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>,
): Promise<DriftSwapResult> {
  const { wallet, subAccount, fromSymbol, toSymbol, amount } = params;

  if (!API_BASE || API_BASE === 'https://your-app.example.com') {
    return { success: false, error: 'EXPO_PUBLIC_API_URL not configured' };
  }

  const url = `${API_BASE}/api/drift/swap`;
  const isWeb = Platform.OS === 'web';

  log(`[DRIFT-SWAP] Executing: ${amount} ${fromSymbol} → ${toSymbol} (${isWeb ? 'web' : 'mobile'})`);

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
      logError(`[DRIFT-SWAP] Network error:`, networkError.message);
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
      logError(`[DRIFT-SWAP] API error: HTTP ${response.status}`, errorDetail);
      throw new Error(errorDetail || `Drift swap server error (HTTP ${response.status})`);
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    if (!txBase64) {
      throw new Error('No transaction returned from Drift swap API');
    }

    // ── 2. Deserialize the versioned transaction ─────────────
    const transactionBuffer = base64ToUint8Array(txBase64);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    log('[DRIFT-SWAP] Transaction deserialized, requesting signature...');

    // ── 3. Sign + submit ─────────────────────────────────────
    let signature: string;

    if (isWeb && signAndSendTransaction) {
      // Web: Phantom requires signAndSendTransaction (it handles RPC submission)
      log('[DRIFT-SWAP] Using signAndSendTransaction (web/Phantom)...');
      const result = await signAndSendTransaction(transaction);
      signature = result.signature;
      log(`[DRIFT-SWAP] Phantom submitted: ${signature}`);
    } else {
      // Mobile (MWA): sign locally, then submit to RPC ourselves
      log('[DRIFT-SWAP] Using signTransaction + manual submit (mobile)...');
      const signedTransaction = await signTransaction(transaction);

      const connection = new Connection(RPC_URL, 'confirmed');
      const rawTransaction = signedTransaction.serialize
        ? signedTransaction.serialize()
        : signedTransaction;

      signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });
      log(`[DRIFT-SWAP] Submitted: ${signature}`);
    }

    // ── 4. Confirm transaction ───────────────────────────────
    // When Phantom submitted via signAndSendTransaction, it already
    // handled submission — skip client-side confirmation to avoid
    // hitting the rate-limited public RPC.
    if (!(isWeb && signAndSendTransaction)) {
      const connection = new Connection(RPC_URL, 'confirmed');
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');

      const confirmStrategy: TransactionConfirmationStrategy = {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      };

      const confirmation = await connection.confirmTransaction(confirmStrategy, 'confirmed');

      if (confirmation.value.err) {
        logError('[DRIFT-SWAP] Transaction failed on-chain:', confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    log(`[DRIFT-SWAP] Confirmed: ${signature}`);

    return {
      success: true,
      signature,
      fromSymbol,
      toSymbol,
      amount,
    };

  } catch (error: any) {
    logError('[DRIFT-SWAP] Error:', error);

    let message = error.message || 'Drift swap failed';
    if (message.includes('User rejected') || message.includes('user rejected')) {
      message = 'Transaction cancelled by user';
    } else if (message.includes('insufficient')) {
      message = 'Insufficient balance for this swap';
    } else if (message.includes('Blocked')) {
      message = 'Phantom blocked the request. Try clicking "Proceed anyway" in the Phantom popup.';
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
  return !!API_BASE && API_BASE !== 'https://your-app.example.com';
}
