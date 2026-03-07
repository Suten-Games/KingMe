// src/services/goals.ts
// ══════════════════════════════════════════════════════════════════
// Unified goal tracker. Each goal has a target and current value,
// automatically pulled from the store or accumulation plans.
// Sorted by "most reachable first" = highest progress %.
// ══════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { obligationMonthlyAmount } from '../types';
// accumulationPlan module removed — token goals now sync directly from store assets

const GOALS_KEY = 'kingme_goals';

// ── Types ────────────────────────────────────────────────────────

export type GoalType =
  | 'accumulate'       // Accumulate X tokens (links to accumulation plan)
  | 'debt_payoff'      // Pay off a debt → target is $0 remaining
  | 'savings_target'   // Get a bank account to $X
  | 'defi_target'      // Get a DeFi position to X tokens or $X value
  | 'custom';          // Any manual goal

export type GoalStrategy = 'accumulate' | 'extract';
// accumulate = I want MORE of this (tokens, savings, etc.)
// extract    = I want LESS of this (debt payoff — extracting yourself from debt)

export interface Goal {
  id: string;
  type: GoalType;
  name: string;             // "1M WHALE", "Pay off Chase CC", "$23K USD* buffer"
  emoji: string;            // User-chosen or auto-assigned
  strategy: GoalStrategy;

  // Target
  targetAmount: number;     // For accumulate: # of tokens or $. For debt: starting balance (we track toward 0)
  targetUnit: string;       // "tokens", "$", "WHALE", "USD*", etc.

  // Current progress (auto-updated or manual)
  currentAmount: number;    // Manually set or auto-pulled
  autoSource?: GoalAutoSource;  // If set, currentAmount is auto-calculated

  // Optional metadata
  mint?: string;            // For crypto goals — links to accumulation plan
  symbol?: string;          // Token symbol
  debtId?: string;          // For debt payoff — links to store debt
  bankAccountId?: string;   // For savings target — links to store bank account
  assetId?: string;         // For DeFi/asset target — links to store asset
  notes?: string;
  color?: string;           // Custom color for the progress bar

  createdAt: string;
  updatedAt: string;
  completedAt?: string;     // Set when goal is hit
}

export interface GoalAutoSource {
  type: 'accumulation_plan' | 'debt_balance' | 'bank_balance' | 'asset_value' | 'asset_tokens';
  sourceId: string;  // mint, debtId, bankAccountId, or assetId
}

export interface GoalWithProgress extends Goal {
  progressPct: number;       // 0-100
  remaining: number;         // How much left
  remainingLabel: string;    // Human-readable
  isComplete: boolean;
}

// ── Progress Calculation ─────────────────────────────────────────

export function calcGoalProgress(goal: Goal): GoalWithProgress {
  let progressPct = 0;
  let remaining = 0;
  let remainingLabel = '';

  if (goal.strategy === 'extract') {
    // Debt payoff: progress = how much you've paid down
    // targetAmount = original balance, currentAmount = remaining balance
    if (goal.targetAmount > 0) {
      const paid = goal.targetAmount - goal.currentAmount;
      progressPct = Math.min(100, Math.max(0, (paid / goal.targetAmount) * 100));
      remaining = Math.max(0, goal.currentAmount);
      remainingLabel = `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} left`;
    }
  } else {
    // Accumulate: progress = currentAmount / targetAmount
    if (goal.targetAmount > 0) {
      progressPct = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100));
      remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
      if (goal.targetUnit === '$') {
        remainingLabel = `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} to go`;
      } else {
        remainingLabel = `${formatNum(remaining)} ${goal.targetUnit} to go`;
      }
    }
  }

  return {
    ...goal,
    progressPct,
    remaining,
    remainingLabel,
    isComplete: progressPct >= 100 || (goal.strategy === 'extract' && goal.currentAmount <= 0),
  };
}

// ── Auto-Update from Store Data ──────────────────────────────────

export async function refreshGoalProgress(
  goals: Goal[],
  storeData: {
    debts: Array<{ id: string; balance?: number; principal: number }>;
    bankAccounts: Array<{ id: string; currentBalance: number }>;
    assets: Array<{ id: string; value: number; metadata?: any }>;
  }
): Promise<Goal[]> {
  return goals.map(goal => {
    if (!goal.autoSource) return goal;

    const src = goal.autoSource;
    let newAmount = goal.currentAmount;

    switch (src.type) {
      case 'accumulation_plan':
      case 'asset_tokens': {
        // Match by asset ID first, then fall back to mint matching
        let asset = storeData.assets.find(a => a.id === src.sourceId);
        if (!asset && goal.mint) {
          asset = storeData.assets.find(a => {
            const meta = a.metadata as any;
            return meta?.mint === goal.mint || meta?.tokenMint === goal.mint;
          });
        }
        if (asset?.metadata) {
          newAmount = (asset.metadata as any).balance ?? (asset.metadata as any).quantity ?? 0;
        }
        break;
      }
      case 'debt_balance': {
        const debt = storeData.debts.find(d => d.id === src.sourceId);
        if (debt) {
          newAmount = debt.balance ?? debt.principal;
        }
        break;
      }
      case 'bank_balance': {
        const acct = storeData.bankAccounts.find(a => a.id === src.sourceId);
        if (acct) {
          newAmount = acct.currentBalance;
        }
        break;
      }
      case 'asset_value': {
        const asset = storeData.assets.find(a => a.id === src.sourceId);
        if (asset) {
          newAmount = asset.value;
        }
        break;
      }
    }

    if (newAmount !== goal.currentAmount) {
      return { ...goal, currentAmount: newAmount, updatedAt: new Date().toISOString() };
    }
    return goal;
  });
}

// ── Sort: most reachable first ───────────────────────────────────

export function sortByReachability(goals: GoalWithProgress[]): GoalWithProgress[] {
  return [...goals].sort((a, b) => {
    // Completed goals at the bottom
    if (a.isComplete && !b.isComplete) return 1;
    if (!a.isComplete && b.isComplete) return -1;
    // Among incomplete: highest progress first
    return b.progressPct - a.progressPct;
  });
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function loadGoals(): Promise<Goal[]> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
  const goals = await loadGoals();
  const newGoal: Goal = {
    ...goal,
    id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  goals.push(newGoal);
  await saveGoals(goals);
  return newGoal;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
  const goals = await loadGoals();
  const idx = goals.findIndex(g => g.id === id);
  if (idx >= 0) {
    goals[idx] = { ...goals[idx], ...updates, updatedAt: new Date().toISOString() };
    await saveGoals(goals);
  }
}

export async function removeGoal(id: string): Promise<void> {
  const goals = await loadGoals();
  await saveGoals(goals.filter(g => g.id !== id));
}

// ── Helpers ──────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Quick-create helpers ─────────────────────────────────────────

export function makeDebtGoal(debt: { id: string; name: string; balance?: number; principal: number }): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  const balance = debt.balance ?? debt.principal;
  return {
    type: 'debt_payoff',
    name: `Pay off ${debt.name}`,
    emoji: '💳',
    strategy: 'extract',
    targetAmount: balance,
    targetUnit: '$',
    currentAmount: balance,
    debtId: debt.id,
    autoSource: { type: 'debt_balance', sourceId: debt.id },
  };
}

export function makeSavingsGoal(
  account: { id: string; name: string; currentBalance: number },
  targetBalance: number,
): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'savings_target',
    name: `${account.name} → $${formatNum(targetBalance)}`,
    emoji: '🏦',
    strategy: 'accumulate',
    targetAmount: targetBalance,
    targetUnit: '$',
    currentAmount: account.currentBalance,
    bankAccountId: account.id,
    autoSource: { type: 'bank_balance', sourceId: account.id },
  };
}

export function makeTokenGoal(
  mint: string,
  symbol: string,
  targetTokens: number,
  currentTokens: number,
  strategy: GoalStrategy = 'accumulate',
): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: strategy === 'extract' ? 'defi_target' : 'accumulate',
    name: `${formatNum(targetTokens)} ${symbol}`,
    emoji: strategy === 'extract' ? '💰' : '🎯',
    strategy,
    targetAmount: targetTokens,
    targetUnit: symbol,
    currentAmount: currentTokens,
    mint,
    symbol,
    autoSource: { type: 'asset_tokens', sourceId: mint },
  };
}

export function makeCustomGoal(
  name: string,
  emoji: string,
  target: number,
  current: number,
  unit: string,
): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'custom',
    name,
    emoji,
    strategy: 'accumulate',
    targetAmount: target,
    targetUnit: unit,
    currentAmount: current,
  };
}

export function makeTradingBufferGoal(
  bufferNeeded: number,
  currentUsdStar: number,
): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'defi_target',
    name: `$${formatNum(bufferNeeded)} USD* Trading Buffer`,
    emoji: '🛡️',
    strategy: 'accumulate',
    targetAmount: bufferNeeded,
    targetUnit: '$',
    currentAmount: currentUsdStar,
    symbol: 'USD*',
    notes: '3 months of obligations in Perena USD* (9.34% APY)',
  };
}

// ── Auto-populate: scan store data and create default goals ──────

const AUTO_POPULATED_KEY = 'kingme_goals_auto_populated';

export async function autoPopulateGoals(storeData: {
  debts: Array<{ id: string; name: string; balance?: number; principal: number; interestRate?: number }>;
  obligations: Array<{ amount: number; frequency?: string }>;
  assets: Array<{ id: string; name: string; value: number; metadata?: any }>;
}): Promise<{ created: number; goalNames: string[] }> {
  // Check if we already ran auto-populate
  const alreadyRan = await AsyncStorage.getItem(AUTO_POPULATED_KEY);
  if (alreadyRan === 'true') return { created: 0, goalNames: [] };

  const existing = await loadGoals();
  const existingDebtIds = new Set(existing.filter(g => g.debtId).map(g => g.debtId));
  const existingNames = new Set(existing.map(g => g.name.toLowerCase()));

  const newGoals: Array<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>> = [];
  const goalNames: string[] = [];

  // ── 1. Credit card debts → payoff goals ────────────────────
  const ccPatterns = /credit.?card|visa|mastercard|amex|discover|chase.*card|citi.*card|capital.?one|barclays/i;
  for (const debt of storeData.debts) {
    if (existingDebtIds.has(debt.id)) continue;
    const balance = debt.balance ?? debt.principal;
    if (balance <= 0) continue;

    // Auto-detect credit cards by name or high interest rate
    const isCC = ccPatterns.test(debt.name) || (debt.interestRate && debt.interestRate > 0.15);
    if (isCC) {
      const goal = makeDebtGoal(debt);
      newGoals.push(goal);
      goalNames.push(goal.name);
    }
  }

  // ── 2. Trading buffer (USD* / Perena) ──────────────────────
  const BUFFER_MONTHS = 3;
  // Obligations are always monthly amounts
  const monthlyObs = storeData.obligations.reduce((sum, o) => sum + obligationMonthlyAmount(o), 0);

  if (monthlyObs > 0) {
    const bufferNeeded = monthlyObs * BUFFER_MONTHS;
    const bufferName = `$${formatNum(bufferNeeded)} USD* Trading Buffer`.toLowerCase();
    if (!existingNames.has(bufferName)) {
      // Find current USD* holdings
      const currentUsdStar = storeData.assets
        .filter(a => {
          const meta = a.metadata as any;
          return (
            meta?.symbol === 'USD*' ||
            meta?.mint === 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6' ||
            a.name?.toLowerCase().includes('usd*') ||
            a.name?.toLowerCase().includes('perena')
          );
        })
        .reduce((sum, a) => sum + a.value, 0);

      const goal = makeTradingBufferGoal(bufferNeeded, currentUsdStar);
      newGoals.push(goal);
      goalNames.push(goal.name);
    }
  }

  // Save all new goals
  if (newGoals.length > 0) {
    for (const goalData of newGoals) {
      await addGoal(goalData);
    }
  }

  // Mark as ran (only mark if we actually checked — even if 0 created)
  await AsyncStorage.setItem(AUTO_POPULATED_KEY, 'true');

  return { created: newGoals.length, goalNames };
}

// Reset auto-populate flag (for testing or after reset)
export async function resetAutoPopulate(): Promise<void> {
  await AsyncStorage.removeItem(AUTO_POPULATED_KEY);
}

export { formatNum };
