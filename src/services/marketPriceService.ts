// src/services/marketPriceService.ts
// Fetches live prices for stocks (KingMe API) and exchange-based crypto (CoinGecko).
// Solana tokens with a mint address are priced via Jupiter/DexScreener during wallet sync — not here.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'market_price_cache';
const STALE_MS = 5 * 60 * 1000; // 5 minutes

const API_BASE = 'https://kingme-api.vercel.app/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketPriceCache {
  stocks: Record<string, number>;   // ticker → price
  crypto: Record<string, number>;   // coingeckoId → price
  fetchedAt: string;                 // ISO timestamp
}

// ─── Stock Quotes (KingMe API) ──────────────────────────────────────────────

async function fetchSingleStockQuote(ticker: string): Promise<{ symbol: string; price: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/stocks/quote?symbol=${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.symbol && typeof data.price === 'number' && data.price > 0) {
      return { symbol: data.symbol, price: data.price };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchStockPrices(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};

  const prices: Record<string, number> = {};

  try {
    // Fetch all tickers in parallel via KingMe API
    const results = await Promise.allSettled(
      tickers.map(t => fetchSingleStockQuote(t))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices[result.value.symbol.toUpperCase()] = result.value.price;
      }
    }

    console.log(`[MARKET] Stock quotes: ${Object.keys(prices).length}/${tickers.length}`);
  } catch (err) {
    console.warn('[MARKET] Stock quotes failed:', err);
  }

  return prices;
}

// ─── CoinGecko (Exchange-based Crypto) ──────────────────────────────────────

export async function fetchCoinGeckoPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};

  const prices: Record<string, number> = {};

  try {
    const idList = ids.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idList)}&vs_currencies=usd`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

    const data = await res.json();

    for (const id of ids) {
      const price = data[id]?.usd;
      if (typeof price === 'number' && price > 0) {
        prices[id] = price;
      }
    }

    console.log(`[MARKET] CoinGecko: ${Object.keys(prices).length}/${ids.length}`);
  } catch (err) {
    console.warn('[MARKET] CoinGecko failed:', err);
  }

  return prices;
}

// ─── Combined Fetch ─────────────────────────────────────────────────────────

export async function fetchAllMarketPrices({
  stockTickers,
  coingeckoIds,
}: {
  stockTickers: string[];
  coingeckoIds: string[];
}): Promise<MarketPriceCache> {
  const [stocks, crypto] = await Promise.all([
    fetchStockPrices(stockTickers),
    fetchCoinGeckoPrices(coingeckoIds),
  ]);

  const cache: MarketPriceCache = {
    stocks,
    crypto,
    fetchedAt: new Date().toISOString(),
  };

  // Persist cache
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[MARKET] Failed to cache prices:', err);
  }

  return cache;
}

// ─── Staleness Check ────────────────────────────────────────────────────────

export async function isMarketPriceStale(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const cache: MarketPriceCache = JSON.parse(raw);
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    return age > STALE_MS;
  } catch {
    return true;
  }
}
