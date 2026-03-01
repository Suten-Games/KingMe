// src/services/accumulationPlan.ts
// ══════════════════════════════════════════════════════════════════
// Tracks token accumulation targets, cost basis, entry history,
// and generates buy/sell signals based on avg entry price.
// ══════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';

const PLANS_KEY = 'accumulation_plans';

// ── Types ────────────────────────────────────────────────────────

export interface AccEntry {
  id: string;
  date: string;          // ISO string
  action: 'buy' | 'sell';
  tokenAmount: number;   // how many tokens
  pricePerToken: number;  // USD per token at time of trade
  totalUSD: number;       // tokenAmount × pricePerToken
  notes?: string;
}

export interface AccumulationPlan {
  mint: string;
  symbol: string;
  targetAmount: number;        // target # of tokens (e.g. 1,000,000)
  entries: AccEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Computed stats from a plan ───────────────────────────────────

export interface PlanStats {
  totalBought: number;         // total tokens bought across all buys
  totalSold: number;           // total tokens sold across all sells
  currentHolding: number;      // bought - sold (manual tracking)
  progressPct: number;         // currentHolding / targetAmount × 100
  totalInvested: number;       // total $ spent buying
  totalReceived: number;       // total $ received from sells
  netCost: number;             // totalInvested - totalReceived
  avgBuyPrice: number;         // weighted avg buy price
  avgSellPrice: number;        // weighted avg sell price
  costBasis: number;           // netCost / currentHolding (effective avg entry)
  realizedPnL: number;         // profit from sells: totalReceived - (avgBuyPrice × totalSold)
  unrealizedPnL: number;       // (currentPrice - costBasis) × currentHolding
  totalPnL: number;            // realized + unrealized
  entries: AccEntry[];
}

export function computePlanStats(plan: AccumulationPlan, currentPrice: number, walletBalance?: number): PlanStats {
  let totalBought = 0;
  let totalSold = 0;
  let totalInvested = 0;
  let totalReceived = 0;

  for (const e of plan.entries) {
    if (e.action === 'buy') {
      totalBought += e.tokenAmount;
      totalInvested += e.totalUSD;
    } else {
      totalSold += e.tokenAmount;
      totalReceived += e.totalUSD;
    }
  }

  // Use actual wallet balance when available — entries may be incomplete
  const entryDerived = totalBought - totalSold;
  const currentHolding = walletBalance != null && walletBalance > 0 ? walletBalance : Math.max(0, entryDerived);
  const progressPct = plan.targetAmount > 0 ? (currentHolding / plan.targetAmount) * 100 : 0;
  const avgBuyPrice = totalBought > 0 ? totalInvested / totalBought : 0;
  const avgSellPrice = totalSold > 0 ? totalReceived / totalSold : 0;
  const netCost = totalInvested - totalReceived;
  const rawCostBasis = currentHolding > 0 ? netCost / currentHolding : avgBuyPrice;
  // If sells recovered more than cost (netCost negative), costBasis would go negative.
  // Fall back to avgBuyPrice so the display remains meaningful.
  const costBasis = rawCostBasis > 0 ? rawCostBasis : avgBuyPrice;
  const realizedPnL = totalSold > 0 ? totalReceived - (avgBuyPrice * totalSold) : 0;
  const unrealizedPnL = currentHolding > 0 ? (currentPrice - costBasis) * currentHolding : 0;

  return {
    totalBought,
    totalSold,
    currentHolding,
    progressPct: Math.min(progressPct, 100),
    totalInvested,
    totalReceived,
    netCost,
    avgBuyPrice,
    avgSellPrice,
    costBasis,
    realizedPnL,
    unrealizedPnL,
    totalPnL: realizedPnL + unrealizedPnL,
    entries: plan.entries,
  };
}

// ── Signal Generation ────────────────────────────────────────────

export type AccSignalType =
  | 'below_entry_accumulate'   // price < costBasis → buy more
  | 'deep_below_entry'         // price < costBasis by 20%+ → strong buy
  | 'above_entry_trim'         // price > costBasis → consider selling some
  | 'strong_above_entry'       // price > costBasis by 50%+ → take profit
  | 'target_reached'           // holding >= targetAmount
  | 'near_target'              // holding >= 80% of target
  | 'bounce_detected';         // price up 10%+ from recorded low

export interface AccSignal {
  type: AccSignalType;
  title: string;
  message: string;
  emoji: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  color: string;
}

export function generateAccSignals(
  plan: AccumulationPlan,
  stats: PlanStats,
  currentPrice: number,
  allTimeLow?: number | null,
): AccSignal[] {
  const signals: AccSignal[] = [];
  const { costBasis, currentHolding, progressPct } = stats;

  if (costBasis <= 0 || plan.entries.length === 0) return signals;

  const pctFromEntry = ((currentPrice - costBasis) / costBasis) * 100;
  const tokensNeeded = plan.targetAmount - currentHolding;
  const dollarsToTarget = tokensNeeded * currentPrice;

  // ── Target status ──────────────────────────────────────────
  if (currentHolding >= plan.targetAmount) {
    signals.push({
      type: 'target_reached',
      title: `${plan.symbol} target reached!`,
      message: `You hit your ${formatNum(plan.targetAmount)} token goal. Now manage the bag — trim on pumps, hold on dips.`,
      emoji: '🎯',
      priority: 'high',
      color: '#f4c430',
    });
  } else if (progressPct >= 80) {
    signals.push({
      type: 'near_target',
      title: `${plan.symbol} almost there`,
      message: `${progressPct.toFixed(0)}% to target. Need ${formatNum(tokensNeeded)} more ($${dollarsToTarget.toFixed(0)}).`,
      emoji: '🏁',
      priority: 'medium',
      color: '#4ade80',
    });
  }

  // ── Price vs entry ─────────────────────────────────────────
  if (pctFromEntry <= -20) {
    signals.push({
      type: 'deep_below_entry',
      title: `${plan.symbol} ${pctFromEntry.toFixed(0)}% below your entry`,
      message: `Deep discount vs your $${formatPrice(costBasis)} avg. ${tokensNeeded > 0 ? `Still need ${formatNum(tokensNeeded)} tokens.` : 'Target already reached — hold tight.'}`,
      emoji: '🔥',
      priority: 'urgent',
      color: '#f87171',
    });
  } else if (pctFromEntry < -5) {
    signals.push({
      type: 'below_entry_accumulate',
      title: `${plan.symbol} below your entry`,
      message: `${pctFromEntry.toFixed(0)}% below $${formatPrice(costBasis)} avg. Good spot to add if thesis holds.`,
      emoji: '🟢',
      priority: 'medium',
      color: '#4ade80',
    });
  } else if (pctFromEntry >= 50) {
    signals.push({
      type: 'strong_above_entry',
      title: `${plan.symbol} +${pctFromEntry.toFixed(0)}% above entry`,
      message: `Strong profit. Consider trimming some to lock gains and re-accumulate on the pullback.`,
      emoji: '💰',
      priority: 'high',
      color: '#f4c430',
    });
  } else if (pctFromEntry >= 15) {
    signals.push({
      type: 'above_entry_trim',
      title: `${plan.symbol} +${pctFromEntry.toFixed(0)}% above entry`,
      message: `You're green. Trim to lower cost basis? You can buy back cheaper on the next dip.`,
      emoji: '📈',
      priority: 'low',
      color: '#4ade80',
    });
  }

  // ── Bounce from low ────────────────────────────────────────
  if (allTimeLow && allTimeLow > 0 && currentPrice > allTimeLow) {
    const bounceFromLow = ((currentPrice - allTimeLow) / allTimeLow) * 100;
    if (bounceFromLow >= 10 && bounceFromLow <= 30 && pctFromEntry < 0) {
      signals.push({
        type: 'bounce_detected',
        title: `${plan.symbol} bouncing +${bounceFromLow.toFixed(0)}%`,
        message: `Up from the low of $${formatPrice(allTimeLow)}. Still below your entry — could be the bottom.`,
        emoji: '🔄',
        priority: 'medium',
        color: '#60a5fa',
      });
    }
  }

  return signals;
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function loadAllPlans(): Promise<Record<string, AccumulationPlan>> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function savePlan(plan: AccumulationPlan): Promise<void> {
  const all = await loadAllPlans();
  all[plan.mint] = { ...plan, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(all));
}

export async function getPlan(mint: string): Promise<AccumulationPlan | null> {
  const all = await loadAllPlans();
  return all[mint] || null;
}

export async function deletePlan(mint: string): Promise<void> {
  const all = await loadAllPlans();
  delete all[mint];
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(all));
}

export async function addEntry(mint: string, entry: Omit<AccEntry, 'id'>): Promise<AccumulationPlan | null> {
  const plan = await getPlan(mint);
  if (!plan) return null;

  const newEntry: AccEntry = {
    ...entry,
    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  };

  plan.entries.push(newEntry);
  await savePlan(plan);
  return plan;
}

export async function removeEntry(mint: string, entryId: string): Promise<void> {
  const plan = await getPlan(mint);
  if (!plan) return;
  plan.entries = plan.entries.filter(e => e.id !== entryId);
  await savePlan(plan);
}

export async function createPlan(
  mint: string,
  symbol: string,
  targetAmount: number,
  initialEntries?: Omit<AccEntry, 'id'>[],
): Promise<AccumulationPlan> {
  const plan: AccumulationPlan = {
    mint,
    symbol,
    targetAmount,
    entries: (initialEntries || []).map((e, i) => ({
      ...e,
      id: `entry_${Date.now()}_${i}`,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await savePlan(plan);
  return plan;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPrice(p: number): string {
  if (p <= 0) return '0.00';
  if (p < 0.000001) {
    // e.g. 0.00000069 — show enough significant figures
    const sig = p.toPrecision(2);
    // Convert any exponential output to decimal
    return parseFloat(sig).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (p < 0.0001) return p.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 0.01)   return p.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 1)      return p.toFixed(4);
  if (p < 1000)   return p.toFixed(2);
  return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export { formatNum, formatPrice };
