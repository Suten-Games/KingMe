// api/swap/quote.ts - Jupiter Swap Quote & Transaction Builder
// ==============================================================
// Vercel edge function that proxies Jupiter's Ultra + Swap APIs.
// Keeps referral fee config server-side so it can't be stripped client-side.

export const config = {
  runtime: 'edge',
};

// ── Config ───────────────────────────────────────────────────
const JUPITER_REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT || '';
const PLATFORM_FEE_BPS = parseInt(process.env.JUPITER_FEE_BPS || '50'); // 0.5% default
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';

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
  'USD*': 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6',
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
      amount,
      userPublicKey,
      slippageBps = 100,
      action = 'quote',
    } = body;

    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return jsonResponse({
        error: 'Missing required fields: inputMint, outputMint, amount, userPublicKey',
      }, 400);
    }

    const resolvedInput = KNOWN_MINTS[inputMint.toUpperCase()] || inputMint;
    const resolvedOutput = KNOWN_MINTS[outputMint.toUpperCase()] || outputMint;

    console.log(`[SWAP] ${action}: ${inputMint} → ${outputMint}, amount=${amount}, user=${userPublicKey}`);

    const apiHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (JUPITER_API_KEY) {
      apiHeaders['x-api-key'] = JUPITER_API_KEY;
    }

    // ── Quote only ────────────────────────────────────────────
    if (action === 'quote') {
      const quoteParams = new URLSearchParams({
        inputMint: resolvedInput,
        outputMint: resolvedOutput,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        ...(JUPITER_REFERRAL_ACCOUNT && PLATFORM_FEE_BPS > 0
          ? { platformFeeBps: PLATFORM_FEE_BPS.toString() }
          : {}),
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      let quoteResponse: Response;
      try {
        quoteResponse = await fetch(
          `https://api.jup.ag/swap/v1/quote?${quoteParams.toString()}`,
          { signal: controller.signal, headers: apiHeaders }
        );
        clearTimeout(timeout);
      } catch (err: any) {
        clearTimeout(timeout);
        console.error('[SWAP] Quote timeout:', err.message);
        return jsonResponse({ error: 'Jupiter quote API timeout' }, 504);
      }

      if (!quoteResponse.ok) {
        const errorText = await quoteResponse.text();
        console.error('[SWAP] Quote error:', quoteResponse.status, errorText);
        return jsonResponse({ error: 'Jupiter quote failed', details: errorText }, 502);
      }

      const quoteData = await quoteResponse.json();
      console.log(`[SWAP] Quote: ${quoteData.inAmount} → ${quoteData.outAmount}, impact: ${quoteData.priceImpactPct}%`);

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

    // ── Full swap — quote then build transaction ────────────────
    // Step 1: Get quote
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
    const quoteTimeout = setTimeout(() => quoteController.abort(), 12000);

    let quoteResponse: Response;
    try {
      quoteResponse = await fetch(
        `https://api.jup.ag/swap/v1/quote?${quoteParams.toString()}`,
        { signal: quoteController.signal, headers: apiHeaders }
      );
      clearTimeout(quoteTimeout);
    } catch (err: any) {
      clearTimeout(quoteTimeout);
      console.error('[SWAP] Quote timeout:', err.message);
      return jsonResponse({ error: 'Jupiter quote API timeout' }, 504);
    }

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('[SWAP] Quote error:', quoteResponse.status, errorText);
      return jsonResponse({ error: 'Jupiter quote failed', details: errorText }, 502);
    }

    const quoteData = await quoteResponse.json();
    console.log(`[SWAP] Quote: ${quoteData.inAmount} → ${quoteData.outAmount}`);

    // Step 2: Build swap transaction
    const swapBody: Record<string, any> = {
      quoteResponse: quoteData,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    };

    if (JUPITER_REFERRAL_ACCOUNT) {
      swapBody.feeAccount = JUPITER_REFERRAL_ACCOUNT;
    }

    const swapController = new AbortController();
    const swapTimeout = setTimeout(() => swapController.abort(), 12000);

    let swapResponse: Response;
    try {
      swapResponse = await fetch('https://api.jup.ag/swap/v1/swap', {
        method: 'POST',
        signal: swapController.signal,
        headers: apiHeaders,
        body: JSON.stringify(swapBody),
      });
      clearTimeout(swapTimeout);
    } catch (err: any) {
      clearTimeout(swapTimeout);
      console.error('[SWAP] Swap timeout:', err.message);
      return jsonResponse({ error: 'Jupiter swap API timeout' }, 504);
    }

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error('[SWAP] Swap error:', swapResponse.status, errorText);
      return jsonResponse({ error: 'Jupiter swap failed', details: errorText }, 502);
    }

    const swapData = await swapResponse.json();
    console.log('[SWAP] Transaction built successfully');

    return jsonResponse({
      swapTransaction: swapData.swapTransaction,
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
