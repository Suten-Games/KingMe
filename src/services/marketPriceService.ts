// src/services/marketPriceService.ts
// Fetches live prices for stocks (Yahoo Finance) and exchange-based crypto (CoinGecko).
// Solana tokens with a mint address are priced via Jupiter/DexScreener during wallet sync — not here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CACHE_KEY = 'market_price_cache';
const STALE_MS = 5 * 60 * 1000; // 5 minutes
const isWeb = Platform.OS === 'web';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketPriceCache {
  stocks: Record<string, number>;   // ticker → price
  crypto: Record<string, number>;   // coingeckoId → price
  fetchedAt: string;                 // ISO timestamp
}

// ─── Yahoo Finance (Stocks / ETFs) ──────────────────────────────────────────

export async function fetchStockPrices(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};

  const prices: Record<string, number> = {};

  try {
    const symbols = tickers.join(',');

    if (isWeb) {
      // On web, proxy through our own API to avoid CORS
      const url = `https://kingme.money/api/market/stocks?symbols=${encodeURIComponent(symbols)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Stock proxy ${res.status}`);
      const data = await res.json();
      Object.assign(prices, data.prices || {});
    } else {
      // Native — call Yahoo directly (no CORS restriction)
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KingMe/1.0)' },
      });
      if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
      const data = await res.json();
      const results = data?.quoteResponse?.result || [];
      for (const quote of results) {
        const price = quote.regularMarketPrice;
        if (quote.symbol && typeof price === 'number' && price > 0) {
          prices[quote.symbol.toUpperCase()] = price;
        }
      }
    }

    console.log(`[MARKET] Yahoo Finance: ${Object.keys(prices).length}/${tickers.length}`);
  } catch (err) {
    console.warn('[MARKET] Yahoo Finance failed:', err);
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
