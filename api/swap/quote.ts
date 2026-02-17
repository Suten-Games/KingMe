// api/swap/quote.ts - Jupiter Swap Quote & Transaction Builder
// ==============================================================
// Vercel edge function that proxies Jupiter's Quote + Swap APIs.
// Keeps referral fee config server-side so it can't be stripped client-side.

export const config = {
  runtime: 'edge',
};

// ── Your Jupiter Referral Account ────────────────────────────
// Sign up at https://referral.jup.ag/ to get your fee account.
// You earn a % of each swap routed through your app.
// Set this in Vercel env vars once you have it.
const JUPITER_REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT || '';
const PLATFORM_FEE_BPS = parseInt(process.env.JUPITER_FEE_BPS || '50'); // 0.5% default

// ── Well-known Solana token mints ────────────────────────────
const KNOWN_MINTS: Record<string, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  PYUSD: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  DAI:  'EjmyN6qEC1Tf1JxiG1ae7YzjSHT4A7rXvib3NDgo4D8a',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JTO:  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  DRIFT: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
  SKR:  'SKRy4ABKZ3dFJEmb47aNqWoMnajpVnFozTPCiZD3eHv',
  'USD*': 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6', // Perena yield-bearing stablecoin
};

export default async function handler(request: Request) {
  // ── CORS ────────────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const {
      inputMint,
      outputMint,
      amount,           // In lamports / smallest unit
      userPublicKey,
      slippageBps = 100, // 1% default
      action = 'quote',  // 'quote' | 'swap'
    } = body;

    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return jsonResponse({
        error: 'Missing required fields: inputMint, outputMint, amount, userPublicKey',
      }, 400);
    }

    // Resolve symbol shortcuts (e.g., "SOL" → full mint address)
    const resolvedInput = KNOWN_MINTS[inputMint.toUpperCase()] || inputMint;
    const resolvedOutput = KNOWN_MINTS[outputMint.toUpperCase()] || outputMint;

    console.log(`[SWAP] ${action}: ${inputMint} → ${outputMint}, amount=${amount}, user=${userPublicKey}`);

    // ── Step 1: Get Quote ──────────────────────────────────────
    const quoteParams = new URLSearchParams({
      inputMint: resolvedInput,
      outputMint: resolvedOutput,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      ...(JUPITER_REFERRAL_ACCOUNT && PLATFORM_FEE_BPS > 0
        ? { platformFeeBps: PLATFORM_FEE_BPS.toString() }
        : {}),
    });

    const quoteController = new AbortController();
    const quoteTimeout = setTimeout(() => quoteController.abort(), 8000);

    let quoteResponse: Response;
    try {
      quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?${quoteParams.toString()}`,
        {
          signal: quoteController.signal,
          headers: { 'Accept': 'application/json' },
        }
      );
      clearTimeout(quoteTimeout);
    } catch (err: any) {
      clearTimeout(quoteTimeout);
      console.error('[SWAP] Quote timeout/error:', err.message);
      return jsonResponse({ error: 'Jupiter quote API timeout' }, 504);
    }

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('[SWAP] Quote error:', errorText);
      return jsonResponse({ error: 'Jupiter quote failed', details: errorText }, 502);
    }

    const quoteData = await quoteResponse.json();

    console.log(`[SWAP] Quote: ${quoteData.inAmount} → ${quoteData.outAmount}, price impact: ${quoteData.priceImpactPct}%`);

    // If only quote requested, return it
    if (action === 'quote') {
      return jsonResponse({
        quote: quoteData,
        inputMint: resolvedInput,
        outputMint: resolvedOutput,
        inAmount: quoteData.inAmount,
        outAmount: quoteData.outAmount,
        priceImpactPct: quoteData.priceImpactPct,
        routePlan: quoteData.routePlan?.map((r: any) => ({
          label: r.swapInfo?.label,
          inputMint: r.swapInfo?.inputMint,
          outputMint: r.swapInfo?.outputMint,
        })),
      });
    }

    // ── Step 2: Get Serialized Swap Transaction ─────────────────
    const swapBody: Record<string, any> = {
      quoteResponse: quoteData,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    };

    // Add referral fee account if configured
    if (JUPITER_REFERRAL_ACCOUNT) {
      swapBody.feeAccount = JUPITER_REFERRAL_ACCOUNT;
    }

    const swapController = new AbortController();
    const swapTimeout = setTimeout(() => swapController.abort(), 10000);

    let swapResponse: Response;
    try {
      swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        signal: swapController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(swapBody),
      });
      clearTimeout(swapTimeout);
    } catch (err: any) {
      clearTimeout(swapTimeout);
      console.error('[SWAP] Swap API timeout/error:', err.message);
      return jsonResponse({ error: 'Jupiter swap API timeout' }, 504);
    }

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error('[SWAP] Swap error:', errorText);
      return jsonResponse({ error: 'Jupiter swap failed', details: errorText }, 502);
    }

    const swapData = await swapResponse.json();

    console.log('[SWAP] Transaction built successfully');

    return jsonResponse({
      // The serialized transaction (base64 encoded VersionedTransaction)
      swapTransaction: swapData.swapTransaction,
      // Quote details for UI display
      quote: {
        inputMint: resolvedInput,
        outputMint: resolvedOutput,
        inAmount: quoteData.inAmount,
        outAmount: quoteData.outAmount,
        priceImpactPct: quoteData.priceImpactPct,
        platformFee: PLATFORM_FEE_BPS > 0 ? {
          bps: PLATFORM_FEE_BPS,
          pct: (PLATFORM_FEE_BPS / 100).toFixed(2),
        } : null,
      },
      // Last valid block height for transaction expiry
      lastValidBlockHeight: swapData.lastValidBlockHeight,
    });

  } catch (error: any) {
    console.error('[SWAP] Fatal error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
