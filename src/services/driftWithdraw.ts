// src/services/driftWithdraw.ts
// ==============================================================
// Client-side Drift withdrawal service.
// Calls the Vercel API to build an unsigned withdrawal
// transaction, then signs via wallet and submits to Solana RPC.
// Mirrors driftSwap.ts — web uses signAndSendTransaction,
// mobile uses signTransaction + manual RPC submit.
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
export interface DriftWithdrawParams {
  wallet: string;
  subAccount?: number;
  amount: number;    // token units (e.g., 100 = 100 USDC)
  symbol?: string;   // defaults to 'USDC'
}

export interface DriftWithdrawResult {
  success: boolean;
  signature?: string;
  error?: string;
  symbol?: string;
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
 * Execute a Drift withdrawal (token from Drift account → Solana wallet).
 *
 * On web: uses signAndSendTransaction (Phantom requires it).
 * On mobile: uses signTransaction + manual RPC submit (MWA pattern).
 */
export async function executeDriftWithdraw(
  params: DriftWithdrawParams,
  signTransaction: (transaction: any) => Promise<any>,
  signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>,
): Promise<DriftWithdrawResult> {
  const { wallet, subAccount, amount, symbol = 'USDC' } = params;

  if (!API_BASE || API_BASE === 'https://your-app.example.com') {
    return { success: false, error: 'EXPO_PUBLIC_API_URL not configured' };
  }

  const url = `${API_BASE}/api/drift/withdraw`;
  const isWeb = Platform.OS === 'web';

  log(`[DRIFT-WITHDRAW] Executing: ${amount} ${symbol} (${isWeb ? 'web' : 'mobile'})`);

  try {
    // ── 1. Get unsigned transaction from API ─────────────────
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, subAccount, amount, symbol }),
      });
    } catch (networkError: any) {
      logError(`[DRIFT-WITHDRAW] Network error:`, networkError.message);
      throw new Error('Cannot reach withdrawal server. Check your connection.');
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const err = await response.json();
        errorDetail = err.error || err.details || '';
      } catch {
        errorDetail = await response.text().catch(() => '');
      }
      logError(`[DRIFT-WITHDRAW] API error: HTTP ${response.status}`, errorDetail);
      throw new Error(errorDetail || `Drift withdrawal server error (HTTP ${response.status})`);
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    if (!txBase64) {
      throw new Error('No transaction returned from Drift withdrawal API');
    }

    // ── 2. Deserialize the versioned transaction ─────────────
    const transactionBuffer = base64ToUint8Array(txBase64);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    log('[DRIFT-WITHDRAW] Transaction deserialized, requesting signature...');

    // ── 3. Sign + submit ─────────────────────────────────────
    let signature: string;

    if (isWeb && signAndSendTransaction) {
      log('[DRIFT-WITHDRAW] Using signAndSendTransaction (web/Phantom)...');
      const result = await signAndSendTransaction(transaction);
      signature = result.signature;
      log(`[DRIFT-WITHDRAW] Phantom submitted: ${signature}`);
    } else {
      log('[DRIFT-WITHDRAW] Using signTransaction + manual submit (mobile)...');
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
      log(`[DRIFT-WITHDRAW] Submitted: ${signature}`);
    }

    // ── 4. Confirm transaction ───────────────────────────────
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
        logError('[DRIFT-WITHDRAW] Transaction failed on-chain:', confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    log(`[DRIFT-WITHDRAW] Confirmed: ${signature}`);

    return {
      success: true,
      signature,
      symbol,
      amount,
    };

  } catch (error: any) {
    logError('[DRIFT-WITHDRAW] Error:', error);

    let message = error.message || 'Drift withdrawal failed';
    if (message.includes('User rejected') || message.includes('user rejected')) {
      message = 'Transaction cancelled by user';
    } else if (message.includes('insufficient')) {
      message = 'Insufficient balance for this withdrawal';
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
 * Check if Drift withdraw service is configured.
 */
export function isDriftWithdrawConfigured(): boolean {
  return !!API_BASE && API_BASE !== 'https://your-app.example.com';
}
