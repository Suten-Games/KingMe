// src/services/jupiterSwap.ts
// ==============================================================
// Client-side Jupiter swap service.
// Calls the Vercel edge function for quotes/transactions,
// then signs via MWA and submits to Solana RPC.
// ==============================================================

import {
  Connection,
  VersionedTransaction,
  TransactionConfirmationStrategy,
  PublicKey,
} from '@solana/web3.js';
import { Platform } from 'react-native';
import { decode as atob } from 'base-64';

// ── Config ───────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';

// On web, proxy RPC through our API to avoid public RPC rate limits / 403s.
// On native, use the direct RPC (no CORS / rate-limit issues).
const RPC_URL = Platform.OS === 'web'
  ? 'https://kingme.money/api/rpc/send'
  : (process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com');

// ── Validate API_BASE at module load ─────────────────────────
function getApiBase(): string {
  if (!API_BASE || API_BASE === 'https://your-app.example.com') {
    console.error(
      '[JUPITER] ❌ EXPO_PUBLIC_API_URL is not set or is still the placeholder!\n' +
      '  Current value: "' + API_BASE + '"\n' +
      '  Fix: Run `eas env:create --scope project --environment production --name EXPO_PUBLIC_API_URL --value https://kingme.money`\n' +
      '  Then rebuild with `eas build`'
    );
    throw new Error(
      'Swap service not configured. EXPO_PUBLIC_API_URL is missing from this build. ' +
      'Set it in EAS environment variables and rebuild.'
    );
  }
  return API_BASE;
}

// ── Well-known Mints (for convenience in client code) ────────
export const MINTS = {
  SOL:    'So11111111111111111111111111111111111111112',
  USDC:   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT:   'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  PYUSD:  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  'USD*': 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6', // Perena yield-bearing stablecoin
} as const;

// ── Types ────────────────────────────────────────────────────
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;       // In smallest units (lamports, etc.)
  outAmount: string;
  priceImpactPct: string;
  platformFee?: {
    bps: number;
    pct: string;
  } | null;
  routePlan?: Array<{ label: string; inputMint: string; outputMint: string }>;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  quote?: SwapQuote;
}

export interface SwapParams {
  inputMint: string;      // Mint address or symbol shortcut (e.g., 'SOL', 'USDC')
  outputMint: string;
  /** Amount in UI units (e.g., 1.5 SOL, 100 USDC). Will be converted to smallest units. */
  amount: number;
  /** Decimals for the input token. SOL = 9, USDC = 6, etc. */
  inputDecimals: number;
  userPublicKey: string;
  slippageBps?: number;   // Default 100 (1%)
}

// ── Token decimal lookup ─────────────────────────────────────
const TOKEN_DECIMALS: Record<string, number> = {
  [MINTS.SOL]: 9,
  [MINTS.USDC]: 6,
  [MINTS.USDT]: 6,
  [MINTS.PYUSD]: 6,
  [MINTS['USD*']]: 6,
  SOL: 9,
  USDC: 6,
  USDT: 6,
  PYUSD: 6,
  'USD*': 6,
};

// Runtime cache for mint decimals fetched from RPC
const _decimalsCache: Record<string, number> = {};

/**
 * Resolve input decimals — uses explicit param, falls back to lookup, then cache
 */
function resolveDecimals(mint: string, explicit?: number): number {
  if (explicit !== undefined && explicit >= 0) return explicit;
  if (TOKEN_DECIMALS[mint]) return TOKEN_DECIMALS[mint];
  if (TOKEN_DECIMALS[mint.toUpperCase()]) return TOKEN_DECIMALS[mint.toUpperCase()];
  if (_decimalsCache[mint] !== undefined) return _decimalsCache[mint];
  console.warn(`[JUPITER] ⚠️ Unknown decimals for mint ${mint.slice(0, 8)}... defaulting to 9. Call fetchMintDecimals() first for accuracy.`);
  return 9;
}

/**
 * Fetch token decimals from Solana RPC for a given mint address.
 * Caches result for future lookups. Call this BEFORE executing swaps for unknown tokens.
 */
export async function fetchMintDecimals(mint: string): Promise<number> {
  // Check caches first
  if (TOKEN_DECIMALS[mint]) return TOKEN_DECIMALS[mint];
  if (_decimalsCache[mint] !== undefined) return _decimalsCache[mint];

  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed' }],
      }),
    });
    const data = await response.json();
    const parsed = data?.result?.value?.data?.parsed;
    if (parsed?.type === 'mint' && parsed?.info?.decimals !== undefined) {
      const decimals = parsed.info.decimals;
      _decimalsCache[mint] = decimals;
      console.log(`[JUPITER] Fetched decimals for ${mint.slice(0, 8)}...: ${decimals}`);
      return decimals;
    }
  } catch (err) {
    console.error(`[JUPITER] Failed to fetch decimals for ${mint}:`, err);
  }

  // Fallback: default to 9
  console.warn(`[JUPITER] Could not determine decimals for ${mint.slice(0, 8)}..., defaulting to 9`);
  return 9;
}

/**
 * Convert UI amount (e.g., 1.5 SOL) to smallest units (lamports)
 */
function toSmallestUnits(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Get a swap quote without building the transaction.
 * Use this to show the user what they'll get before they confirm.
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, inputDecimals, userPublicKey, slippageBps = 100 } = params;

  const apiBase = getApiBase(); // throws if not configured
  const decimals = resolveDecimals(inputMint, inputDecimals);
  const amountSmallest = toSmallestUnits(amount, decimals);
  const url = `${apiBase}/api/swap/quote`;

  console.log(`[JUPITER] Getting quote: ${amount} ${inputMint} → ${outputMint} (${amountSmallest} smallest units)`);
  console.log(`[JUPITER] API URL: ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputMint,
        outputMint,
        amount: amountSmallest,
        userPublicKey,
        slippageBps,
        action: 'quote',
      }),
    });
  } catch (networkError: any) {
    console.error(`[JUPITER] Network error fetching ${url}:`, networkError.message);
    throw new Error(
      `Cannot reach swap server (${apiBase}). Check your internet connection or verify EXPO_PUBLIC_API_URL is correct.`
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const err = await response.json();
      errorDetail = err.error || err.details || '';
    } catch {
      errorDetail = await response.text().catch(() => '');
    }
    console.error(`[JUPITER] Quote failed: HTTP ${response.status}`, errorDetail);
    throw new Error(errorDetail || `Quote failed (HTTP ${response.status})`);
  }

  const data = await response.json();

  return {
    inputMint: data.inputMint,
    outputMint: data.outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: data.priceImpactPct,
    routePlan: data.routePlan,
  };
}

/**
 * Execute a full swap: quote → build tx → sign → submit → confirm.
 *
 * @param params - Swap parameters
 * @param signTransaction - From your useWallet() hook
 * @returns SwapResult with signature on success
 */
export async function executeSwap(
  params: SwapParams,
  signTransaction: (transaction: any) => Promise<any>,
): Promise<SwapResult> {
  const {
    inputMint,
    outputMint,
    amount,
    inputDecimals,
    userPublicKey,
    slippageBps = 100,
  } = params;

  let apiBase: string;
  try {
    apiBase = getApiBase(); // throws if not configured
  } catch (configError: any) {
    return { success: false, error: configError.message };
  }

  const decimals = resolveDecimals(inputMint, inputDecimals);
  const amountSmallest = toSmallestUnits(amount, decimals);
  const url = `${apiBase}/api/swap/quote`;

  console.log(`[JUPITER] Executing swap: ${amount} ${inputMint} → ${outputMint}`);
  console.log(`[JUPITER] API URL: ${url}, amount: ${amountSmallest} (${decimals} decimals)`);

  try {
    // ── 1. Get serialized swap transaction from edge function ──
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amountSmallest,
          userPublicKey,
          slippageBps,
          action: 'swap',
        }),
      });
    } catch (networkError: any) {
      console.error(`[JUPITER] Network error fetching ${url}:`, networkError.message);
      throw new Error(
        `Cannot reach swap server. Check your connection or EXPO_PUBLIC_API_URL (${apiBase}).`
      );
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const err = await response.json();
        errorDetail = err.error || err.details || '';
      } catch {
        errorDetail = await response.text().catch(() => '');
      }
      console.error(`[JUPITER] Swap API failed: HTTP ${response.status}`, errorDetail);
      throw new Error(errorDetail || `Swap server error (HTTP ${response.status})`);
    }

    const { swapTransaction, quote, lastValidBlockHeight } = await response.json();

    if (!swapTransaction) {
      throw new Error('No swap transaction returned');
    }

    console.log(`[JUPITER] Quote: ${quote.inAmount} → ${quote.outAmount}`);

    // ── 2. Deserialize the versioned transaction ──────────────
    const transactionBuffer = base64ToUint8Array(swapTransaction);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    console.log('[JUPITER] Transaction deserialized, requesting signature...');

    // ── 3. Sign with wallet (MWA or Phantom) ─────────────────
    const signedTransaction = await signTransaction(transaction);

    console.log('[JUPITER] Transaction signed, submitting...');

    // ── 4. Submit to Solana RPC ──────────────────────────────
    const connection = new Connection(RPC_URL, 'confirmed');

    // Get the raw signed transaction bytes
    const rawTransaction = signedTransaction.serialize
      ? signedTransaction.serialize()
      : signedTransaction;

    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed',
    });

    console.log(`[JUPITER] Submitted: ${signature}`);

    // ── 5. Confirm transaction ───────────────────────────────
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');

    const confirmStrategy: TransactionConfirmationStrategy = {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
    };

    const confirmation = await connection.confirmTransaction(confirmStrategy, 'confirmed');

    if (confirmation.value.err) {
      console.error('[JUPITER] Transaction failed on-chain:', confirmation.value.err);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`[JUPITER] ✅ Confirmed: ${signature}`);

    return {
      success: true,
      signature,
      quote,
    };

  } catch (error: any) {
    console.error('[JUPITER] Swap error:', error);

    // Friendly error messages
    let message = error.message || 'Swap failed';
    if (message.includes('User rejected')) {
      message = 'Transaction cancelled by user';
    } else if (message.includes('insufficient')) {
      message = 'Insufficient balance for this swap';
    } else if (message.includes('slippage')) {
      message = 'Price moved too much — try again with higher slippage';
    }

    return {
      success: false,
      error: message,
    };
  }
}

// ══════════════════════════════════════════════════════════════
// Scenario → Swap Mapping Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Maps a WhatIfScenario to swap parameters, if the scenario
 * involves an on-chain action. Returns null for off-chain scenarios.
 */
export function scenarioToSwapParams(
  scenario: { id: string; type: string; impact?: any; changes?: any },
  userPublicKey: string,
): SwapParams | null {
  switch (scenario.type) {
    // "Invest idle cash" → User likely needs to swap SOL/USDC into target asset
    case 'invest_cash':
      return {
        inputMint: MINTS.USDC,
        outputMint: MINTS.USDC, // Stays USDC — actual investment happens in protocol deposit
        amount: scenario.impact?.investmentRequired || 0,
        inputDecimals: 6,
        userPublicKey,
      };

    // "Stake crypto for yield" → Swap into USDC for stablecoin protocols
    case 'stake_crypto':
      return null; // Staking is a protocol deposit, not a swap

    // "Perena yield" → Swap stablecoins into USD* (Perena's yield-bearing token) via Jupiter
    case 'perena_yield': {
      const depositAmount = scenario.impact?.totalDeposit || scenario.impact?.investmentRequired || 0;
      if (depositAmount <= 0) return null;
      return {
        inputMint: MINTS.USDC,
        outputMint: MINTS['USD*'],
        amount: depositAmount,
        inputDecimals: 6,
        userPublicKey,
      };
    }

    // "Switch to high-dividend stocks" → Off-chain (traditional brokerage)
    case 'increase_yield':
    case 'reduce_expenses':
    case 'debt_payoff':
    case 'debt_refinance':
    case 'tax_optimization':
    case 'hysa_transfer':
      return null; // These are off-chain actions

    default:
      return null;
  }
}

/**
 * Check if a scenario has an executable on-chain action.
 */
export function isOnChainScenario(scenarioType: string): boolean {
  return ['invest_cash', 'perena_yield', 'stake_crypto', 'drift_yield', 'drift_withdraw'].includes(scenarioType);
}

/**
 * Check if a scenario should use Drift's native swap instead of Jupiter.
 */
export function isDriftSwapScenario(scenarioType: string): boolean {
  return ['drift_yield', 'drift_withdraw'].includes(scenarioType);
}

/**
 * Format a swap amount for display.
 * e.g., "1500000000" lamports → "1.5 SOL"
 */
export function formatSwapAmount(
  amountSmallest: string,
  decimals: number,
  symbol: string,
): string {
  const amount = parseInt(amountSmallest) / Math.pow(10, decimals);
  if (amount >= 1000) {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${amount.toFixed(decimals > 6 ? 4 : 2)} ${symbol}`;
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

/**
 * Check if swap service is properly configured.
 * Use this to conditionally show/hide swap buttons.
 */
export function isSwapConfigured(): boolean {
  return !!API_BASE && API_BASE !== 'https://your-app.example.com';
}

/**
 * Get diagnostic info for debugging swap issues.
 */
export function getSwapDiagnostics(): { apiUrl: string; rpcUrl: string; configured: boolean } {
  return {
    apiUrl: API_BASE || '(not set)',
    rpcUrl: RPC_URL,
    configured: isSwapConfigured(),
  };
}
