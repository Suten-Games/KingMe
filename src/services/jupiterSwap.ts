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
import { log, warn, error as logError } from '../utils/logger';

// ── Config ───────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const isWeb = Platform.OS === 'web';

// ── Validate API_BASE at module load ─────────────────────────
function getApiBase(): string {
  if (!API_BASE || API_BASE === 'https://your-app.example.com') {
    logError(
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
  'USD*': 'star9agSpjiFe3M49B3RniVU4CMBBEK3Qnaqn3RGiFM', // Perena USD* yield-bearing stablecoin
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
  autoSlippage?: boolean; // Let Jupiter pick optimal slippage
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
  warn(`[JUPITER] ⚠️ Unknown decimals for mint ${mint.slice(0, 8)}... defaulting to 9. Call fetchMintDecimals() first for accuracy.`);
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

  // Use RPC proxy on web (public RPC 403s from browsers), direct RPC on mobile
  const rpcEndpoint = isWeb ? `${getApiBase()}/api/rpc/send` : RPC_URL;

  try {
    const response = await fetch(rpcEndpoint, {
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
      log(`[JUPITER] Fetched decimals for ${mint.slice(0, 8)}...: ${decimals}`);
      return decimals;
    }
  } catch (err) {
    logError(`[JUPITER] Failed to fetch decimals for ${mint}:`, err);
  }

  // Fallback: default to 9
  warn(`[JUPITER] Could not determine decimals for ${mint.slice(0, 8)}..., defaulting to 9`);
  return 9;
}

/**
 * Convert UI amount (e.g., 1.5 SOL) to smallest units (lamports).
 * Uses string-based arithmetic to avoid floating-point precision issues
 * that cause "not enough tokens" errors when selling MAX.
 */
function toSmallestUnits(amount: number, decimals: number): string {
  // Convert to string to avoid floating-point multiplication errors
  // e.g., 1234567.89 * 1e9 can overshoot in float arithmetic
  const str = amount.toFixed(decimals);
  const [whole, frac = ''] = str.split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  const result = whole + paddedFrac;
  // Strip leading zeros but keep at least "0"
  return result.replace(/^0+/, '') || '0';
}

// ── Live balance check ──────────────────────────────────────
/**
 * Fetch actual on-chain SOL balance and SPL token balance for a wallet.
 * Use before swapping to avoid "not enough tokens" errors from stale data.
 */
export async function fetchLiveBalances(
  walletAddress: string,
  tokenMint?: string,
): Promise<{ solBalance: number; tokenBalance: number | null }> {
  let solBalance = 0;
  let tokenBalance: number | null = null;

  // Use the RPC proxy (Helius key stays server-side) so we don't get rate-limited
  const rpcEndpoint = `${getApiBase()}/api/rpc/send`;

  try {
    // SOL balance
    const solRes = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
    });
    const solData = await solRes.json();
    solBalance = (solData?.result?.value || 0) / 1e9;
    log(`[JUPITER] Live SOL balance: ${solBalance} for ${walletAddress.slice(0, 8)}...`);
  } catch (e) {
    warn('[JUPITER] Failed to fetch SOL balance:', e);
  }

  // Token balance (if mint provided and not SOL itself)
  if (tokenMint && tokenMint !== MINTS.SOL) {
    try {
      const tokenRes = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: tokenMint },
            { encoding: 'jsonParsed' },
          ],
        }),
      });
      const tokenData = await tokenRes.json();
      const accounts = tokenData?.result?.value || [];
      if (accounts.length > 0) {
        const info = accounts[0].account?.data?.parsed?.info;
        tokenBalance = parseFloat(info?.tokenAmount?.uiAmountString || '0');
      } else {
        tokenBalance = 0;
      }
    } catch (e) {
      warn('[JUPITER] Failed to fetch token balance:', e);
    }
  } else if (tokenMint === MINTS.SOL) {
    tokenBalance = solBalance;
  }

  return { solBalance, tokenBalance };
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Get a swap quote without building the transaction.
 * Use this to show the user what they'll get before they confirm.
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, inputDecimals, userPublicKey, slippageBps = 100, autoSlippage = false } = params;

  const apiBase = getApiBase(); // throws if not configured
  const decimals = resolveDecimals(inputMint, inputDecimals);
  const amountSmallest = toSmallestUnits(amount, decimals);
  const url = `${apiBase}/api/swap/quote`;

  log(`[JUPITER] Getting quote: ${amount} ${inputMint} → ${outputMint} (${amountSmallest} smallest units)`);

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
        autoSlippage,
        maxAutoSlippageBps: 1000,
        action: 'quote',
      }),
    });
  } catch (networkError: any) {
    logError(`[JUPITER] Network error fetching ${url}:`, networkError.message);
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
    logError(`[JUPITER] Quote failed: HTTP ${response.status}`, errorDetail);
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
  signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>,
): Promise<SwapResult> {
  const {
    inputMint,
    outputMint,
    amount,
    inputDecimals,
    userPublicKey,
    slippageBps = 100,
    autoSlippage = false,
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

  log(`[JUPITER] Executing swap: ${amount} ${inputMint} → ${outputMint} slippage=${slippageBps}bps auto=${autoSlippage}`);
  log(`[JUPITER] API URL: ${url}, amount: ${amountSmallest} (${decimals} decimals)`);

  // Attempt swap — retry without platform fee on InvalidAccountData
  // (referral token account may not exist for this output token)
  for (const skipFee of [false, true]) {
    if (skipFee) {
      log('[JUPITER] Retrying swap without platform fee...');
    }

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
          autoSlippage,
          maxAutoSlippageBps: 1000,
          action: 'swap',
          skipFee,
        }),
      });
    } catch (networkError: any) {
      logError(`[JUPITER] Network error fetching ${url}:`, networkError.message);
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
      logError(`[JUPITER] Swap API failed: HTTP ${response.status}`, errorDetail);
      throw new Error(errorDetail || `Swap server error (HTTP ${response.status})`);
    }

    const { swapTransaction, quote, lastValidBlockHeight } = await response.json();

    if (!swapTransaction) {
      throw new Error('No swap transaction returned');
    }

    log(`[JUPITER] Quote: ${quote.inAmount} → ${quote.outAmount}`);

    // ── 2. Deserialize the versioned transaction ──────────────
    const transactionBuffer = base64ToUint8Array(swapTransaction);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    // ── 2b. Pre-flight simulation (web only) ─────────────────
    // Simulate before handing to wallet so we can catch InvalidAccountData
    // (missing referral token account) and retry without fee — instead of
    // showing the user a scary "simulation failed" popup in their wallet.
    if (isWeb) {
      try {
        const rpcProxy = `${getApiBase()}/api/rpc/send`;
        const simRes = await fetch(rpcProxy, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'simulateTransaction',
            params: [
              Buffer.from(transaction.serialize()).toString('base64'),
              { encoding: 'base64', commitment: 'confirmed' },
            ],
          }),
        });
        const simData = await simRes.json();
        const simErr = simData?.result?.value?.err;
        if (simErr) {
          const simErrStr = JSON.stringify(simErr);
          log(`[JUPITER] Pre-flight simulation failed: ${simErrStr}`);
          if (simErrStr.includes('InvalidAccountData') && !skipFee) {
            warn('[JUPITER] InvalidAccountData in simulation — retrying without fee...');
            continue; // retry for loop with skipFee=true
          }
          // Slippage exceeded (0x177e = 6014, 0x1788 = 6024)
          if (simErrStr.includes('0x177e') || simErrStr.includes('0x1788')) {
            throw new Error('Slippage exceeded — increase slippage tolerance and try again');
          }
          // Insufficient balance
          if (simErrStr.includes('0x1') || simErrStr.includes('InsufficientFunds')) {
            throw new Error('Insufficient balance for this swap');
          }
          // Generic simulation failure — throw with details so the catch block can format it
          throw new Error(`Transaction simulation failed: ${simErrStr}`);
        } else {
          log('[JUPITER] Pre-flight simulation passed');
        }
      } catch (simNetErr: any) {
        // Re-throw our own errors (slippage, insufficient, etc.)
        if (simNetErr.message && !simNetErr.message.includes('network error')) throw simNetErr;
        warn('[JUPITER] Pre-flight simulation network error (proceeding anyway):', simNetErr.message);
      }
    }

    log('[JUPITER] Transaction deserialized, requesting signature...');

    // ── 3. Sign + submit ─────────────────────────────────────
    let signature: string;

    if (signAndSendTransaction) {
      // Wallet handles RPC submission via signAndSendTransaction
      // Works on both web (Phantom) and mobile (MWA/Seed Vault)
      log('[JUPITER] Using signAndSendTransaction...');
      const result = await signAndSendTransaction(transaction);
      signature = result.signature;
      log(`[JUPITER] Wallet submitted: ${signature}`);

      // Poll for confirmation to catch on-chain errors (slippage, etc.)
      const rpcProxy = `${getApiBase()}/api/rpc/send`;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const statusRes = await fetch(rpcProxy, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method: 'getSignatureStatuses',
              params: [[signature], { searchTransactionHistory: false }],
            }),
          });
          const statusData = await statusRes.json();
          const status = statusData.result?.value?.[0];
          if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
            if (status.err) {
              logError('[JUPITER] Transaction failed on-chain:', status.err);
              throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
            }
            break;
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes('Transaction failed on-chain')) throw pollErr;
          // Network error polling — continue
        }
      }
    } else {
      // Wallet doesn't support signAndSendTransaction — sign locally, then submit
      log('[JUPITER] Using signTransaction + manual submit...');
      const signedTransaction = await signTransaction(transaction);

      const rawTransaction = signedTransaction.serialize
        ? signedTransaction.serialize()
        : signedTransaction;

      if (isWeb) {
        // Web: use RPC proxy (public Solana RPC 403s sendRawTransaction from browsers)
        const rpcProxy = `${getApiBase()}/api/rpc/send`;
        const raw = Buffer.from(rawTransaction).toString('base64');
        const res = await fetch(rpcProxy, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'sendTransaction',
            params: [raw, { encoding: 'base64', skipPreflight: false, maxRetries: 3, preflightCommitment: 'confirmed' }],
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        signature = data.result;
      } else {
        // Mobile: use direct RPC connection
        const connection = new Connection(RPC_URL, 'confirmed');
        signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          maxRetries: 3,
          preflightCommitment: 'confirmed',
        });
      }

      log(`[JUPITER] Submitted: ${signature}`);

      // Confirm transaction (mobile only — Phantom confirms internally on web)
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      const confirmStrategy: TransactionConfirmationStrategy = {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
      };

      const confirmation = await connection.confirmTransaction(confirmStrategy, 'confirmed');
      if (confirmation.value.err) {
        logError('[JUPITER] Transaction failed on-chain:', confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    log(`[JUPITER] ✅ Confirmed: ${signature}`);

    return {
      success: true,
      signature,
      quote,
    };

  } catch (error: any) {
    logError('[JUPITER] Swap error:', error);

    // If InvalidAccountData and we haven't retried without fee yet, retry
    const msg = error.message || '';
    if (!skipFee && msg.includes('InvalidAccountData')) {
      warn('[JUPITER] InvalidAccountData — likely missing referral token account, retrying without fee...');
      continue; // retry the for loop with skipFee=true
    }

    // Friendly error messages
    let message = msg || 'Swap failed';
    if (message.includes('User rejected') || message.includes('cancelled')) {
      message = 'Transaction cancelled by user';
    } else if (message.includes('0x1788') || message.includes('6024') || message.includes('6014') || message.includes('SlippageTolerance') || message.includes('slippage')) {
      message = 'Slippage exceeded — increase slippage tolerance and try again';
    } else if (message.includes('insufficient') || message.includes('not enough')) {
      message = 'Insufficient balance for this swap';
    } else if (message.includes('InvalidAccountData')) {
      message = 'Swap failed — please try again';
    }

    return {
      success: false,
      error: message,
    };
  }
  } // end for skipFee loop

  return { success: false, error: 'Swap failed after retry' };
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
