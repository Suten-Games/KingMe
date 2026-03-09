// api/swap/quote.ts - Jupiter Swap Quote & Transaction Builder
// ==============================================================
// Vercel edge function that proxies Jupiter's Ultra + Swap APIs.
// Keeps referral fee config server-side so it can't be stripped client-side.

import { PublicKey } from '@solana/web3.js';

export const config = {
  runtime: 'edge',
};

const JUPITER_REFERRAL_PROGRAM = new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

/** Derive the fee token account (PDA) for a given referral account + output mint */
function deriveFeeAccount(referralAccount: string, outputMint: string): string {
  const [feeAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('referral_ata'),
      new PublicKey(referralAccount).toBuffer(),
      new PublicKey(outputMint).toBuffer(),
    ],
    JUPITER_REFERRAL_PROGRAM,
  );
  return feeAccount.toBase58();
}

// ── Config ───────────────────────────────────────────────────
const JUPITER_REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT || '';
const PLATFORM_FEE_BPS = parseInt(process.env.JUPITER_FEE_BPS || '50'); // 0.5% default
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || '';
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
  SKR:  'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
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
      autoSlippage = false,
      maxAutoSlippageBps = 1000,
      action = 'quote',
      skipFee = false,
    } = body;

    const applyFee = !skipFee && !!JUPITER_REFERRAL_ACCOUNT && PLATFORM_FEE_BPS > 0;

    // If client retried with skipFee, a referral token account is missing — alert
    if (skipFee && action === 'swap' && RESEND_API_KEY && ALERT_EMAIL) {
      const tokenName = Object.entries(KNOWN_MINTS).find(([, v]) => v === outputMint)?.[0] || outputMint;
      sendFeeAlert(tokenName, outputMint).catch(err =>
        console.error('[SWAP] Alert email failed:', err.message)
      );
    }

    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return jsonResponse({
        error: 'Missing required fields: inputMint, outputMint, amount, userPublicKey',
      }, 400);
    }

    const resolvedInput = KNOWN_MINTS[inputMint.toUpperCase()] || inputMint;
    const resolvedOutput = KNOWN_MINTS[outputMint.toUpperCase()] || outputMint;

    console.log(`[SWAP] ${action}: ${inputMint} → ${outputMint}, amount=${amount}, fee=${applyFee}`);

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
        ...(autoSlippage ? { autoSlippage: 'true', maxAutoSlippageBps: maxAutoSlippageBps.toString() } : {}),
        ...(applyFee ? { platformFeeBps: PLATFORM_FEE_BPS.toString() } : {}),
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
    // Helper to attempt quote + swap build with or without fee
    async function buildSwap(withFee: boolean) {
      const quoteParams = new URLSearchParams({
        inputMint: resolvedInput,
        outputMint: resolvedOutput,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        ...(autoSlippage ? { autoSlippage: 'true', maxAutoSlippageBps: maxAutoSlippageBps.toString() } : {}),
        ...(withFee ? { platformFeeBps: PLATFORM_FEE_BPS.toString() } : {}),
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
        throw new Error('Jupiter quote API timeout');
      }

      if (!quoteResponse.ok) {
        const errorText = await quoteResponse.text();
        throw new Error(`Jupiter quote failed: ${errorText}`);
      }

      const quoteData = await quoteResponse.json();
      console.log(`[SWAP] Quote (fee=${withFee}): ${quoteData.inAmount} → ${quoteData.outAmount}`);

      // Build swap transaction
      const swapBody: Record<string, any> = {
        quoteResponse: quoteData,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      };

      if (withFee && JUPITER_REFERRAL_ACCOUNT) {
        // feeAccount must be the derived token account (PDA), not the referral account itself
        const outputMintResolved = quoteData.outputMint || resolvedOutput;
        swapBody.feeAccount = deriveFeeAccount(JUPITER_REFERRAL_ACCOUNT, outputMintResolved);
        console.log(`[SWAP] Fee account derived for mint ${outputMintResolved}: ${swapBody.feeAccount}`);
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
        throw new Error('Jupiter swap API timeout');
      }

      if (!swapResponse.ok) {
        const errorText = await swapResponse.text();
        throw new Error(`Jupiter swap build failed: ${errorText}`);
      }

      const swapData = await swapResponse.json();
      return { quoteData, swapData, feeApplied: withFee };
    }

    // Try with fee first, fallback to no fee if Jupiter rejects it
    let result;
    if (applyFee) {
      try {
        result = await buildSwap(true);
        console.log('[SWAP] Transaction built with fee');
      } catch (feeErr: any) {
        console.warn(`[SWAP] Fee swap failed (${feeErr.message}), retrying without fee...`);
        result = await buildSwap(false);
        console.log('[SWAP] Transaction built without fee (fallback)');
      }
    } else {
      result = await buildSwap(false);
      console.log('[SWAP] Transaction built (no fee)');
    }

    return jsonResponse({
      swapTransaction: result.swapData.swapTransaction,
      quote: {
        inputMint: resolvedInput,
        outputMint: resolvedOutput,
        inAmount: result.quoteData.inAmount,
        outAmount: result.quoteData.outAmount,
        priceImpactPct: result.quoteData.priceImpactPct,
        platformFee: result.feeApplied ? {
          bps: PLATFORM_FEE_BPS,
          pct: (PLATFORM_FEE_BPS / 100).toFixed(2),
        } : null,
      },
      lastValidBlockHeight: result.swapData.lastValidBlockHeight,
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

async function sendFeeAlert(tokenName: string, mint: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'KingMe Alerts <alerts@sutengames.com>',
      to: ALERT_EMAIL,
      subject: `Missing referral token account: ${tokenName}`,
      text: [
        `A swap just fell back to no-fee because the Jupiter referral token account is missing for:`,
        ``,
        `Token: ${tokenName}`,
        `Mint: ${mint}`,
        `Referral: ${JUPITER_REFERRAL_ACCOUNT}`,
        ``,
        `Add this token account in the Jupiter Referral dashboard so you collect fees on ${tokenName} swaps.`,
        `https://referral.jup.ag/dashboard`,
      ].join('\n'),
    }),
  });
}
