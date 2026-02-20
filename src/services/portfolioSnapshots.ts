// src/services/portfolioSnapshots.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Records daily portfolio value snapshots for trend tracking.
// Stores: total assets, total crypto, total trad, total debts, net worth
// Keeps up to 2 years of daily snapshots (~730 entries)
// ═══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';

const SNAPSHOT_KEY = 'portfolio_snapshots';
const MAX_SNAPSHOTS = 730; // ~2 years of daily

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PortfolioSnapshot {
  date: string;        // YYYY-MM-DD
  timestamp: number;   // ms
  totalAssets: number;
  totalCrypto: number;
  totalTrad: number;   // brokerage + real estate + retirement + commodities
  totalCash: number;   // bank accounts
  totalDebts: number;  // remaining balances
  netWorth: number;    // totalAssets - totalDebts
  passiveIncome: number; // monthly passive at time of snapshot
}

export interface PortfolioTrend {
  current: number;
  change1d: number | null;   // $ change
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  changeYTD: number | null;
  change1y: number | null;
  pct1d: number | null;      // % change
  pct7d: number | null;
  pct30d: number | null;
  pct90d: number | null;
  pctYTD: number | null;
  pct1y: number | null;
  allTimeHigh: number | null;
  allTimeLow: number | null;
  sparkline30d: number[];     // daily values for last 30 days
  snapshotCount: number;
  firstSnapshotDate: string | null;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function loadSnapshots(): Promise<PortfolioSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
  // Trim to max
  const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
}

// ─── Record Snapshot ─────────────────────────────────────────────────────────

interface SnapshotInput {
  assets: Array<{ value: number; type: string; annualIncome: number; metadata?: any }>;
  bankAccounts: Array<{ currentBalance: number }>;
  debts: Array<{ remainingBalance?: number; principal?: number }>;
}

export async function recordPortfolioSnapshot(input: SnapshotInput): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const existing = await loadSnapshots();

  // Only one snapshot per day — replace if already exists
  const withoutToday = existing.filter(s => s.date !== today);

  let totalCrypto = 0;
  let totalTrad = 0;
  let totalPassiveAnnual = 0;

  for (const a of input.assets) {
    const isCrypto = a.type === 'crypto' || a.type === 'defi';
    if (isCrypto) {
      totalCrypto += a.value;
    } else {
      totalTrad += a.value;
    }
    totalPassiveAnnual += a.annualIncome || 0;
  }

  const totalCash = input.bankAccounts.reduce((s, b) => s + (b.currentBalance || 0), 0);
  const totalAssets = totalCrypto + totalTrad + totalCash;
  const totalDebts = input.debts.reduce((s, d) => s + (d.remainingBalance || d.principal || 0), 0);

  const snapshot: PortfolioSnapshot = {
    date: today,
    timestamp: Date.now(),
    totalAssets,
    totalCrypto,
    totalTrad,
    totalCash,
    totalDebts,
    netWorth: totalAssets - totalDebts,
    passiveIncome: totalPassiveAnnual / 12,
  };

  withoutToday.push(snapshot);
  withoutToday.sort((a, b) => a.date.localeCompare(b.date));

  await saveSnapshots(withoutToday);
  console.log(`📸 Portfolio snapshot: $${totalAssets.toLocaleString()} assets, $${(totalAssets - totalDebts).toLocaleString()} net worth`);
}

// ─── Compute Trends ──────────────────────────────────────────────────────────

export async function getPortfolioTrend(
  field: 'totalAssets' | 'netWorth' | 'totalCrypto' | 'totalTrad' | 'totalCash' = 'netWorth'
): Promise<PortfolioTrend> {
  const snapshots = await loadSnapshots();

  if (snapshots.length === 0) {
    return emptyTrend(0);
  }

  const latest = snapshots[snapshots.length - 1];
  const current = latest[field];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Year start for YTD
  const yearStart = `${now.getFullYear()}-01-01`;

  // Find snapshots at various lookback points
  const snap1d = findClosest(snapshots, daysAgo(1), field);
  const snap7d = findClosest(snapshots, daysAgo(7), field);
  const snap30d = findClosest(snapshots, daysAgo(30), field);
  const snap90d = findClosest(snapshots, daysAgo(90), field);
  const snapYTD = findClosest(snapshots, yearStart, field);
  const snap1y = findClosest(snapshots, daysAgo(365), field);

  // All-time high/low
  let ath: number | null = null;
  let atl: number | null = null;
  for (const s of snapshots) {
    const val = s[field];
    if (ath === null || val > ath) ath = val;
    if (atl === null || val < atl) atl = val;
  }

  // Sparkline: last 30 days
  const thirtyDaysAgo = daysAgo(30);
  const sparkline = snapshots
    .filter(s => s.date >= thirtyDaysAgo)
    .map(s => s[field]);

  return {
    current,
    change1d: delta(current, snap1d),
    change7d: delta(current, snap7d),
    change30d: delta(current, snap30d),
    change90d: delta(current, snap90d),
    changeYTD: delta(current, snapYTD),
    change1y: delta(current, snap1y),
    pct1d: pctDelta(current, snap1d),
    pct7d: pctDelta(current, snap7d),
    pct30d: pctDelta(current, snap30d),
    pct90d: pctDelta(current, snap90d),
    pctYTD: pctDelta(current, snapYTD),
    pct1y: pctDelta(current, snap1y),
    allTimeHigh: ath,
    allTimeLow: atl,
    sparkline30d: sparkline,
    snapshotCount: snapshots.length,
    firstSnapshotDate: snapshots[0]?.date || null,
  };
}

/**
 * Get raw snapshots for charting
 */
export async function getSnapshots(): Promise<PortfolioSnapshot[]> {
  return loadSnapshots();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function findClosest(
  snapshots: PortfolioSnapshot[],
  targetDate: string,
  field: keyof PortfolioSnapshot,
): number | null {
  // Find the snapshot closest to targetDate (within 2 day tolerance)
  let best: PortfolioSnapshot | null = null;
  let bestDiff = Infinity;

  for (const s of snapshots) {
    const diff = Math.abs(
      new Date(s.date).getTime() - new Date(targetDate).getTime()
    );
    if (diff < bestDiff && diff < 2 * 24 * 60 * 60 * 1000) {
      best = s;
      bestDiff = diff;
    }
  }

  return best ? (best[field] as number) : null;
}

function delta(current: number, past: number | null): number | null {
  return past !== null ? current - past : null;
}

function pctDelta(current: number, past: number | null): number | null {
  if (past === null || past === 0) return null;
  return ((current - past) / Math.abs(past)) * 100;
}

function emptyTrend(current: number): PortfolioTrend {
  return {
    current,
    change1d: null, change7d: null, change30d: null,
    change90d: null, changeYTD: null, change1y: null,
    pct1d: null, pct7d: null, pct30d: null,
    pct90d: null, pctYTD: null, pct1y: null,
    allTimeHigh: null, allTimeLow: null,
    sparkline30d: [],
    snapshotCount: 0,
    firstSnapshotDate: null,
  };
}
