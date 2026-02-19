// src/services/priceTracker.ts
// Tracks token prices over time, computes 24h/7d changes, detects significant moves
import AsyncStorage from '@react-native-async-storage/async-storage';

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const DEXSCREENER_API = 'https://api.dexscreener.com/tokens/v1/solana';
const JUPITER_API_KEY = process.env.EXPO_PUBLIC_JUPITER_API_KEY || '';
const SNAPSHOT_KEY = 'price_snapshots';
const WATCHLIST_KEY = 'price_watchlist';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceSnapshot {
  mint: string;
  symbol: string;
  price: number;
  timestamp: number; // ms
}

export interface TokenPriceData {
  mint: string;
  symbol: string;
  currentPrice: number;
  price1hAgo: number | null;
  price24hAgo: number | null;
  price7dAgo: number | null;
  allTimeHigh: number | null;
  allTimeHighTimestamp: number | null;
  change1h: number | null;   // percentage
  change24h: number | null;
  change7d: number | null;
  fromATH: number | null;    // percentage below ATH
  lastUpdated: number;
}

export interface WatchlistToken {
  mint: string;
  symbol: string;
  addedAt: number;
  notes?: string;
}

// ─── Fetch Prices from Jupiter ───────────────────────────────────────────────

export async function fetchPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  // Try Jupiter first if API key is available
  if (JUPITER_API_KEY) {
    try {
      const ids = mints.join(',');
      const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`, {
        headers: { 'X-API-Key': JUPITER_API_KEY },
      });
      if (response.ok) {
        const data = await response.json();
        const prices: Record<string, number> = {};
        for (const [mint, info] of Object.entries(data.data || {})) {
          const priceData = info as any;
          if (priceData?.price) prices[mint] = parseFloat(priceData.price);
        }
        if (Object.keys(prices).length > 0) return prices;
      }
    } catch (error) {
      console.warn('Jupiter price fetch failed, falling back to DexScreener');
    }
  }

  // Fallback: DexScreener (free, no API key needed)
  try {
    const ids = mints.join(',');
    const response = await fetch(`${DEXSCREENER_API}/${ids}`);
    if (!response.ok) throw new Error(`DexScreener error: ${response.status}`);

    const data = await response.json();
    const prices: Record<string, number> = {};

    // DexScreener returns array of pairs — pick the highest liquidity pair per token
    for (const pair of (data || [])) {
      const mint = pair.baseToken?.address;
      if (!mint || !mints.includes(mint)) continue;
      const price = parseFloat(pair.priceUsd || '0');
      if (price > 0 && (!prices[mint] || pair.liquidity?.usd > 0)) {
        prices[mint] = price;
      }
    }

    return prices;
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return {};
  }
}

// ─── Snapshot Storage ────────────────────────────────────────────────────────

async function loadSnapshots(): Promise<PriceSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveSnapshots(snapshots: PriceSnapshot[]): Promise<void> {
  // Keep only last 7 days of snapshots (one per hour max = ~168 entries per token)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trimmed = snapshots.filter(s => s.timestamp > cutoff);
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
}

export async function recordPriceSnapshot(
  mints: string[],
  symbolMap: Record<string, string>
): Promise<void> {
  const prices = await fetchPrices(mints);
  const existing = await loadSnapshots();
  const now = Date.now();

  // Only record if at least 30 min since last snapshot for this mint
  const newSnapshots: PriceSnapshot[] = [];
  for (const [mint, price] of Object.entries(prices)) {
    const lastForMint = existing
      .filter(s => s.mint === mint)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!lastForMint || now - lastForMint.timestamp > 30 * 60 * 1000) {
      newSnapshots.push({
        mint,
        symbol: symbolMap[mint] || mint.slice(0, 6),
        price,
        timestamp: now,
      });
    }
  }

  if (newSnapshots.length > 0) {
    console.log(`📊 Recorded ${newSnapshots.length} price snapshots`);
    await saveSnapshots([...existing, ...newSnapshots]);
  }
}

// ─── Compute Price Data ──────────────────────────────────────────────────────

export async function getTokenPriceData(
  mints: string[],
  symbolMap: Record<string, string>
): Promise<Record<string, TokenPriceData>> {
  const currentPrices = await fetchPrices(mints);
  const snapshots = await loadSnapshots();
  const now = Date.now();
  const result: Record<string, TokenPriceData> = {};

  for (const mint of mints) {
    const currentPrice = currentPrices[mint];
    if (!currentPrice) continue;

    const mintSnapshots = snapshots
      .filter(s => s.mint === mint)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Find price at various lookback windows
    const price1hAgo = findClosestPrice(mintSnapshots, now - 1 * 60 * 60 * 1000);
    const price24hAgo = findClosestPrice(mintSnapshots, now - 24 * 60 * 60 * 1000);
    const price7dAgo = findClosestPrice(mintSnapshots, now - 7 * 24 * 60 * 60 * 1000);

    // All-time high from snapshots
    let allTimeHigh: number | null = null;
    let allTimeHighTimestamp: number | null = null;
    for (const snap of mintSnapshots) {
      if (allTimeHigh === null || snap.price > allTimeHigh) {
        allTimeHigh = snap.price;
        allTimeHighTimestamp = snap.timestamp;
      }
    }
    // Check if current price is new ATH
    if (allTimeHigh === null || currentPrice > allTimeHigh) {
      allTimeHigh = currentPrice;
      allTimeHighTimestamp = now;
    }

    result[mint] = {
      mint,
      symbol: symbolMap[mint] || mint.slice(0, 6),
      currentPrice,
      price1hAgo,
      price24hAgo,
      price7dAgo,
      allTimeHigh,
      allTimeHighTimestamp,
      change1h: price1hAgo ? ((currentPrice - price1hAgo) / price1hAgo) * 100 : null,
      change24h: price24hAgo ? ((currentPrice - price24hAgo) / price24hAgo) * 100 : null,
      change7d: price7dAgo ? ((currentPrice - price7dAgo) / price7dAgo) * 100 : null,
      fromATH: allTimeHigh ? ((currentPrice - allTimeHigh) / allTimeHigh) * 100 : null,
      lastUpdated: now,
    };
  }

  return result;
}

function findClosestPrice(snapshots: PriceSnapshot[], targetTime: number): number | null {
  if (snapshots.length === 0) return null;

  // Find snapshot closest to target time (within 2 hour tolerance)
  let closest: PriceSnapshot | null = null;
  let closestDiff = Infinity;

  for (const snap of snapshots) {
    const diff = Math.abs(snap.timestamp - targetTime);
    if (diff < closestDiff && diff < 2 * 60 * 60 * 1000) {
      closest = snap;
      closestDiff = diff;
    }
  }

  return closest?.price ?? null;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export async function getWatchlist(): Promise<WatchlistToken[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToWatchlist(mint: string, symbol: string, notes?: string): Promise<void> {
  const list = await getWatchlist();
  if (list.find(t => t.mint === mint)) return;
  list.push({ mint, symbol, addedAt: Date.now(), notes });
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  console.log(`👁️ Added ${symbol} to watchlist`);
}

export async function removeFromWatchlist(mint: string): Promise<void> {
  const list = await getWatchlist();
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list.filter(t => t.mint !== mint)));
}
