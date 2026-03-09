// api/swap/quote.ts - Jupiter Swap Quote & Transaction Builder
// ==============================================================
// Vercel edge function that proxies Jupiter's Swap APIs.
// Keeps referral fee config server-side so it can't be stripped client-side.
// Uses edge runtime for fast cold starts (~50ms vs ~2s for Node.js).
// PDA derivation uses @noble/curves + @noble/hashes (edge-compatible).

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

export const config = {
  runtime: 'edge',
};

// ── Base58 codec ─────────────────────────────────────────────
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(str: string): Uint8Array {
  let num = BigInt(0);
  for (const char of str) {
    const idx = B58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base58 char: ' + char);
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const char of str) {
    if (char === '1') bytes.unshift(0);
    else break;
  }
  while (bytes.length < 32) bytes.unshift(0);
  return new Uint8Array(bytes);
}

function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) num = num * 256n + BigInt(byte);
  let str = '';
  while (num > 0n) {
    str = B58_ALPHABET[Number(num % 58n)] + str;
    num /= 58n;
  }
  for (const byte of bytes) {
    if (byte === 0) str = '1' + str;
    else break;
  }
  return str;
}

// ── Solana PDA derivation (edge-compatible) ──────────────────
const REFERRAL_PROGRAM_ID = decodeBase58('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

function isOnCurve(point: Uint8Array): boolean {
  try {
    ed25519.ExtendedPoint.fromHex(point);
    return true;
  } catch {
    return false;
  }
}

function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): [Uint8Array, number] {
  const pda = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const parts: Uint8Array[] = [...seeds, new Uint8Array([bump]), programId, pda];
    let totalLen = 0;
    for (const p of parts) totalLen += p.length;
    const buf = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) { buf.set(p, offset); offset += p.length; }
    const hash = sha256(buf);
    if (!isOnCurve(hash)) return [hash, bump];
  }
  throw new Error('Could not find PDA');
}

/** Derive the fee token account (PDA) for a given referral account + output mint */
function deriveFeeAccount(referralAccount: string, outputMint: string): string {
  const seeds = [
    new TextEncoder().encode('referral_ata'),
    decodeBase58(referralAccount),
    decodeBase58(outputMint),
  ];
  const [pda] = findProgramAddress(seeds, REFERRAL_PROGRAM_ID);
  return encodeBase58(pda);
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
