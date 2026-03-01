// api/wallet/parse-tx.ts
// Parses a Solana transaction signature and extracts swap details.
// Given a target mint (the token being accumulated), returns:
//   - how many tokens were received
//   - USD value of what was spent
//   - what token was spent and how much

export const config = { runtime: 'edge' };

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Well-known stablecoin mints — treat these as USD 1:1
const STABLECOIN_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',  // USD*
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
]);

const SOL_MINT = 'So11111111111111111111111111111111111111112';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let signature: string, targetMint: string;
  try {
    ({ signature, targetMint } = await request.json());
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  if (!signature || !targetMint) {
    return jsonResponse({ error: 'signature and targetMint required' }, 400);
  }

  // Clean up signature — strip any explorer URL prefix if pasted
  const cleanSig = signature.trim().split('/').pop()?.split('?')[0] || signature.trim();

  try {
    // Step 1: Fetch parsed transaction from Helius
    const txResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          cleanSig,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    const txData = await txResponse.json();
    if (txData.error) return jsonResponse({ error: `Transaction fetch failed: ${txData.error.message}` }, 400);
    if (!txData.result) return jsonResponse({ error: 'Transaction not found' }, 404);

    const tx = txData.result;
    const meta = tx.meta;
    if (!meta) return jsonResponse({ error: 'Transaction metadata unavailable' }, 400);

    // Step 2: Parse token balance changes
    // postTokenBalances - preTokenBalances = what changed
    const pre: Record<string, number> = {};
    const post: Record<string, number> = {};

    for (const b of (meta.preTokenBalances || [])) {
      const key = `${b.owner || ''}_${b.mint}`;
      pre[key] = (pre[key] || 0) + (b.uiTokenAmount?.uiAmount || 0);
    }
    for (const b of (meta.postTokenBalances || [])) {
      const key = `${b.owner || ''}_${b.mint}`;
      post[key] = (post[key] || 0) + (b.uiTokenAmount?.uiAmount || 0);
    }

    // Aggregate net changes by mint across all accounts in this tx
    const mintChanges: Record<string, number> = {};

    const allMints = new Set([
      ...Object.keys(pre).map(k => k.split('_').slice(1).join('_')),
      ...Object.keys(post).map(k => k.split('_').slice(1).join('_')),
    ]);

    // Simpler: just look at pre/postTokenBalances directly
    const mintDelta: Record<string, number> = {};
    const mintDecimals: Record<string, number> = {};

    for (const b of (meta.preTokenBalances || [])) {
      mintDelta[b.mint] = (mintDelta[b.mint] || 0) - (b.uiTokenAmount?.uiAmount || 0);
      mintDecimals[b.mint] = b.uiTokenAmount?.decimals || 0;
    }
    for (const b of (meta.postTokenBalances || [])) {
      mintDelta[b.mint] = (mintDelta[b.mint] || 0) + (b.uiTokenAmount?.uiAmount || 0);
      mintDecimals[b.mint] = b.uiTokenAmount?.decimals || 0;
    }

    // Also check SOL change
    const preSol = (meta.preBalances?.[0] || 0) / 1e9;
    const postSol = (meta.postBalances?.[0] || 0) / 1e9;
    const solDelta = postSol - preSol;

    // Find target token received amount
    const targetReceived = mintDelta[targetMint];
    if (!targetReceived || targetReceived <= 0) {
      return jsonResponse({
        error: 'Target token not found in this transaction, or tokens were sent (not received)',
        mintDelta,
        targetMint,
      }, 400);
    }

    // Find what was spent (negative delta, excluding the target)
    const spentMints = Object.entries(mintDelta)
      .filter(([mint, delta]) => mint !== targetMint && delta < 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); // largest spend first

    let spentMint: string | null = null;
    let spentAmount = 0;
    let spentUSD = 0;
    let spentSymbol = 'Unknown';
    let spentPriceUSD = 0;

    if (spentMints.length > 0) {
      [spentMint, ] = spentMints[0];
      spentAmount = Math.abs(spentMints[0][1]);

      // If stablecoin, USD value is 1:1
      if (STABLECOIN_MINTS.has(spentMint)) {
        spentPriceUSD = 1;
        spentUSD = spentAmount;
        spentSymbol = spentMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 'USDT';
      } else {
        // Fetch price from Jupiter at current time
        // Note: Jupiter doesn't support historical prices, so this is approximate
        // but it's better than nothing and close for recent trades
        try {
          const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${spentMint}`);
          const priceData = await priceRes.json();
          spentPriceUSD = parseFloat(priceData.data?.[spentMint]?.price || '0');
          spentSymbol = priceData.data?.[spentMint]?.mintSymbol || spentMint.slice(0, 8);
          spentUSD = spentAmount * spentPriceUSD;
        } catch {
          spentPriceUSD = 0;
          spentUSD = 0;
        }
      }
    } else if (solDelta < 0) {
      // SOL was spent
      spentMint = SOL_MINT;
      spentAmount = Math.abs(solDelta) - (meta.fee || 0) / 1e9; // subtract tx fee
      spentSymbol = 'SOL';
      try {
        const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${SOL_MINT}`);
        const priceData = await priceRes.json();
        spentPriceUSD = parseFloat(priceData.data?.[SOL_MINT]?.price || '0');
        spentUSD = spentAmount * spentPriceUSD;
      } catch {
        spentPriceUSD = 0;
        spentUSD = 0;
      }
    }

    const pricePerTargetToken = spentUSD > 0 ? spentUSD / targetReceived : 0;

    return jsonResponse({
      success: true,
      targetReceived,       // tokens of accumulation target received
      spentMint,            // what was spent
      spentSymbol,          // e.g. "HYPE", "USDC", "SOL"
      spentAmount,          // how much of the spent token
      spentPriceUSD,        // USD price of spent token (current, not historical for non-stables)
      spentUSD,             // total USD value spent
      pricePerTargetToken,  // derived cost basis per target token
      isPriceApproximate: !STABLECOIN_MINTS.has(spentMint || '') && spentMint !== null,
      timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    });

  } catch (error: any) {
    console.error('[PARSE-TX]', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
