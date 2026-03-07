// api/wallet/sync.ts - WITH DRIFT REST API
// ==============================================================

export const config = {
  runtime: 'edge',
};

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;

interface WalletAsset {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  category: 'crypto' | 'stocks' | 'commodities' | 'real_estate' | 'defi';
  logoURI?: string;
  apy?: number;
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

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { walletAddress, manualMints } = await request.json();

    if (!walletAddress) {
      return jsonResponse({ error: 'walletAddress required' }, 400);
    }

    console.log(`[SYNC] Starting for ${walletAddress}`);
    if (manualMints?.length) {
      console.log(`[SYNC] Also pricing ${manualMints.length} manual mints`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://api.helius.xyz/v1/wallet/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`,
        {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[HELIUS] Error:', errorText);
        throw new Error(`Helius error: ${response.status}`);
      }

      const data = await response.json();

      console.log(`[HELIUS] Got ${data.balances?.length || 0} tokens, total: $${data.totalUsdValue?.toFixed(2) || 0}`);

      const assets: WalletAsset[] = [];

      const balances = data.balances || [];

      for (const token of balances) {
        const balance = token.balance || 0;
        const price = token.pricePerToken || 0;
        const value = token.usdValue || (balance * price);

        if (balance === 0 || balance < 0.000001) continue;

        if (price > 0 && value < 0.01) {
          console.log(`[SKIP-DUST] ${token.symbol}: $${value.toFixed(4)}`);
          continue;
        }

        const symbol = token.symbol || token.mint.slice(0, 6);
        const name = token.name || `Unknown Token`;

        // SOL logo fix
        let logoURI = token.logoUri;
        if (token.mint === 'So11111111111111111111111111111111111111112' || symbol === 'SOL') {
          logoURI = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
        }

        const category = categorizeToken(token.mint, symbol, name);

        console.log(`[TOKEN] ${symbol}: ${category} ${balance.toFixed(4)} @ $${price.toFixed(4)} = $${value.toFixed(2)}`);

        assets.push({
          mint: token.mint,
          symbol,
          name,
          balance,
          priceUSD: price,
          valueUSD: value,
          category,
          logoURI,
        });
      }

      // Add Drift positions using REST API
      try {
        const driftPositions = await fetchDriftPositions(walletAddress);

        if (driftPositions.length > 0) {
          console.log(`[DRIFT] Found ${driftPositions.length} positions`);
          assets.push(...driftPositions);
        }
      } catch (error: any) {
        console.error('[DRIFT] Failed:', error.message);
        // Don't fail the whole sync if Drift fails
      }

      assets.sort((a, b) => b.valueUSD - a.valueUSD);

      const totalValue = assets.reduce((sum, a) => sum + a.valueUSD, 0);
      const knownTokens = assets.filter(a => a.priceUSD > 0).length;

      // ── Price lookup for manual assets ──
      let manualPrices: Record<string, { price: number; symbol?: string }> = {};
      if (manualMints && manualMints.length > 0) {
        try {
          manualPrices = await fetchManualMintPrices(manualMints);
          console.log(`[PRICES] Got prices for ${Object.keys(manualPrices).length}/${manualMints.length} manual mints`);
        } catch (error: any) {
          console.error('[PRICES] Manual mint pricing failed:', error.message);
        }
      }

      console.log(`[SYNC] Complete: ${assets.length} assets, ${knownTokens} priced, $${totalValue.toFixed(2)}`);

      return jsonResponse({
        assets,
        totalValue,
        manualPrices,
        syncedAt: new Date().toISOString(),
        debug: {
          assetsReturned: assets.length,
          pricedTokens: knownTokens,
          unpricedTokens: assets.length - knownTokens,
          manualMintsRequested: manualMints?.length || 0,
          manualMintsPriced: Object.keys(manualPrices).length,
        }
      });

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error: any) {
    console.error('[ERROR]', error);
    return jsonResponse({
      error: 'Internal server error',
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// Drift Positions (REST API)
// ═══════════════════════════════════════════════════════════════

async function fetchDriftPositions(walletAddress: string): Promise<WalletAsset[]> {
  const positions: WalletAsset[] = [];

  try {
    // Try subaccounts 0-2
    for (let subaccountId = 0; subaccountId < 3; subaccountId++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(
            `https://mainnet-beta.api.drift.trade/users?authority=${walletAddress}&subAccountId=${subaccountId}`,
            {
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) continue;

          const data = await response.json();

          if (!data || data.length === 0) continue;

          const userAccount = data[0];

          console.log(`[DRIFT] Sub ${subaccountId} data:`, JSON.stringify(userAccount).slice(0, 200));

          // Get total collateral value (in USDC, 6 decimals)
          const totalCollateral = userAccount.totalCollateral
            ? parseFloat(userAccount.totalCollateral) / 1e6
            : 0;

          const netUsdValue = userAccount.netUsdValue
            ? parseFloat(userAccount.netUsdValue) / 1e6
            : totalCollateral;

          console.log(`[DRIFT] Sub ${subaccountId}: collateral=${totalCollateral}, netValue=${netUsdValue}`);

          if (netUsdValue > 1) {
            positions.push({
              mint: `drift-sub${subaccountId}`,
              symbol: 'DRIFT',
              name: subaccountId === 0 ? 'Drift Protocol' : `Drift Account ${subaccountId}`,
              balance: netUsdValue,
              priceUSD: 1,
              valueUSD: netUsdValue,
              category: 'defi',
              logoURI: 'https://app.drift.trade/icons/logo.svg',
              apy: 1.35, // User can edit this
            });

            console.log(`[DRIFT] Added position: $${netUsdValue.toFixed(2)}`);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err: any) {
        console.log(`[DRIFT] Sub ${subaccountId} error:`, err.message);
      }
    }
  } catch (error: any) {
    console.error('[DRIFT] Error:', error.message);
  }

  return positions;
}

// ═══════════════════════════════════════════════════════════════
// Manual Mint Price Lookup (Jupiter Price API - free, no key)
// ═══════════════════════════════════════════════════════════════

async function fetchManualMintPrices(
  mints: string[]
): Promise<Record<string, { price: number; symbol?: string }>> {
  const prices: Record<string, { price: number; symbol?: string }> = {};

  if (!mints || mints.length === 0) return prices;

  // Deduplicate and filter empty strings
  const uniqueMints = [...new Set(mints.filter(m => m && m.length > 10))];
  if (uniqueMints.length === 0) return prices;

  try {
    // Jupiter Price API v2 — supports up to 100 mints per call
    const batchSize = 100;
    for (let i = 0; i < uniqueMints.length; i += batchSize) {
      const batch = uniqueMints.slice(i, i + batchSize);
      const ids = batch.join(',');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `https://api.jup.ag/price/v2?ids=${ids}`,
          {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`[PRICES] Jupiter API error: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.data) {
          for (const [mint, info] of Object.entries(data.data) as any) {
            const price = parseFloat(info.price);
            if (price > 0) {
              prices[mint] = {
                price,
                symbol: info.mintSymbol || undefined,
              };
              console.log(`[PRICES] ${info.mintSymbol || mint.slice(0, 8)}: $${price.toFixed(6)}`);
            }
          }
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`[PRICES] Batch ${i} error:`, err.message);
      }
    }
  } catch (error: any) {
    console.error('[PRICES] Fatal error:', error.message);
  }

  return prices;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function categorizeToken(mint: string, symbol: string, name: string): WalletAsset['category'] {
  const nameLower = name.toLowerCase();
  const symbolUpper = symbol.toUpperCase();

  // Stocks (tokenized equities)
  if (/^[bm][A-Z]{2,5}$/i.test(symbol)) return 'stocks';
  if (nameLower.includes('stock') || nameLower.includes('equity')) return 'stocks';

  // Commodities
  if (['PAXG', 'PAXS', 'XAUT'].includes(symbolUpper)) return 'commodities';
  if (nameLower.includes('gold') || nameLower.includes('silver')) return 'commodities';

  // Real estate
  if (nameLower.includes('real estate') || nameLower.includes('property')) return 'real_estate';

  // DeFi (LSTs, stablecoins, LP tokens)
  if (symbolUpper.includes('SOL') && symbol !== 'SOL') return 'defi';
  if (symbol.includes('-') || symbol.includes('_')) return 'defi';
  const defiTokens = ['SKR', 'mSOL', 'jitoSOL', 'bSOL', 'stSOL', 'INF', 'ethSOL'];
  if (defiTokens.some(t => symbolUpper.includes(t.toUpperCase()))) return 'defi';

  return 'crypto';
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
