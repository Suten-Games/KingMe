// src/services/windfallPlanner.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Detects large bank balance increases and generates a prioritized deployment plan.
// Only plans deployment of TRUE surplus — after reserving committed funds
// (upcoming bills, debt payments, buffer) tied to that specific account.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Asset, Obligation, Debt } from '../types';
import type { Goal } from './goals';
import { AccPlanContext } from './positionAlerts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeploymentCategory =
  | 'reserve'
  | 'emergency_fund'
  | 'high_interest_debt'
  | 'accumulation_target'
  | 'goal'
  | 'yield'
  | 'crypto_allocation'
  | 'debt_payoff'
  | 'savings_target'
  | 'keep_liquid';

export interface DeploymentStep {
  id: string;
  priority: number;
  category: DeploymentCategory;
  emoji: string;
  title: string;
  description: string;
  amount: number;
  requiresExchange: boolean;
  exchangeNote: string | null;
  actionLabel: string;
  actionParams?: any;
}

export interface WindfallAlert {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;               // total windfall detected
  deployable: number;           // after reserving committed funds
  reserved: number;             // kept in account for bills/buffer
  detectedAt: string;
  dismissedAt?: string;
  steps: DeploymentStep[];
  totalAllocated: number;
  unallocated: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const WINDFALL_THRESHOLD = 2000;
const EMERGENCY_FUND_MONTHS = 3;
const HIGH_INTEREST_THRESHOLD = 12;
const GOAL_NEAR_COMPLETION_PCT = 50;
const LOOKAHEAD_DAYS = 30;      // Look ahead 30 days for bills (more conservative than alert's 7)
const ACCOUNT_BUFFER = 1.15;    // Keep 15% buffer above committed bills in account

// ─── Committed Funds Calculator ───────────────────────────────────────────────
// Computes how much must stay in the account to cover upcoming obligations.
// Uses the same logic as generateCashTransferAlerts but with a longer horizon.

interface CommittedFundsResult {
  reserved: number;
  billBreakdown: string[];
}

function computeCommittedFunds(
  accountId: string,
  currentBalance: number,
  obligations: Obligation[],
  debts: Debt[],
): CommittedFundsResult {
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const upcomingBills: Array<{ name: string; amount: number; daysUntil: number }> = [];

  const allBills = [
    ...obligations
      .filter(o => (o as any).bankAccountId === accountId)
      .map(o => ({ name: o.name, amount: o.amount, dueDate: (o as any).dueDate || 1 })),
    ...debts
      .filter(d => (d as any).bankAccountId === accountId)
      .map(d => ({ name: d.name, amount: d.monthlyPayment, dueDate: (d as any).dueDate || 1 })),
  ];

  for (const bill of allBills) {
    let daysUntil = bill.dueDate - currentDay;
    if (daysUntil < 0) daysUntil += daysInMonth;
    if (daysUntil <= LOOKAHEAD_DAYS) {
      upcomingBills.push({ name: bill.name, amount: bill.amount, daysUntil });
    }
  }

  if (upcomingBills.length === 0) {
    return { reserved: 0, billBreakdown: [] };
  }

  const totalUpcoming = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
  const reserved = Math.ceil(totalUpcoming * ACCOUNT_BUFFER);

  const billBreakdown = upcomingBills
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(b => `${b.name} $${b.amount.toFixed(0)} in ${b.daysUntil}d`);

  return { reserved, billBreakdown };
}

// ─── Plan Generator ──────────────────────────────────────────────────────────

interface PlanInput {
  windfallAmount: number;
  newBalance: number;           // the account balance AFTER the windfall
  accountId: string;
  accountName: string;
  assets: Asset[];
  obligations: Obligation[];
  debts: Debt[];
  goals: Goal[];                // loaded from AsyncStorage via loadGoals()
  accPlans: AccPlanContext[];
  monthlyExpenses: number;
  exchangeName?: string;
}

export function generateWindfallPlan(input: PlanInput): WindfallAlert {
  const {
    windfallAmount, newBalance, accountId, accountName,
    assets, obligations, debts, goals, accPlans,
    monthlyExpenses, exchangeName,
  } = input;

  const exchange = exchangeName || 'your exchange (e.g. Crypto.com)';
  const exchangeNote = `Buy on ${exchange} first, then transfer to your wallet. Allow 1–3 days for ACH.`;

  // ── Step 0: compute what must stay in the account ─────────────────────────
  const { reserved, billBreakdown } = computeCommittedFunds(
    accountId, newBalance, obligations, debts
  );

  const deployable = Math.max(0, windfallAmount - reserved);

  // If almost nothing is deployable after reserving, still show the alert
  // so the user understands why — but with no deployment steps.
  const steps: DeploymentStep[] = [];
  let priority = 1;

  // Always show the reserve step so user understands what's locked
  if (reserved > 0) {
    steps.push({
      id: `step-reserve-${Date.now()}`,
      priority: priority++,
      category: 'reserve',
      emoji: '🏦',
      title: `Keep $${reserved.toLocaleString(undefined, { maximumFractionDigits: 0 })} in ${accountName}`,
      description: `Upcoming bills in the next ${LOOKAHEAD_DAYS} days: ${billBreakdown.join(', ')}. Keeping ${((ACCOUNT_BUFFER - 1) * 100).toFixed(0)}% buffer above that.`,
      amount: reserved,
      requiresExchange: false,
      exchangeNote: null,
      actionLabel: 'Keep in account',
    });
  }

  if (deployable < 100) {
    // Nothing meaningful to deploy
    return buildAlert(input, steps, windfallAmount, reserved, deployable);
  }

  let remaining = deployable;

  // ── 1. Emergency fund gap ─────────────────────────────────────────────────
  const liquidAssets = assets.filter(a => a.isLiquid).reduce((sum, a) => sum + a.value, 0);
  const targetEmergencyFund = monthlyExpenses * EMERGENCY_FUND_MONTHS;
  const emergencyGap = Math.max(0, targetEmergencyFund - liquidAssets);

  if (emergencyGap > 500) {
    const allocate = Math.min(remaining, emergencyGap);
    steps.push({
      id: `step-emergency-${Date.now()}`,
      priority: priority++,
      category: 'emergency_fund',
      emoji: '🛡️',
      title: 'Top up emergency fund',
      description: `You have ${(liquidAssets / monthlyExpenses).toFixed(1)} months covered. Target is ${EMERGENCY_FUND_MONTHS} months ($${targetEmergencyFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}). Keep this in savings or a USDC yield account.`,
      amount: allocate,
      requiresExchange: false,
      exchangeNote: null,
      actionLabel: 'Keep in savings',
    });
    remaining -= allocate;
  }

  if (remaining <= 0) return buildAlert(input, steps, windfallAmount, reserved, deployable);

  // ── 2. Debt payoff goals (from goals system) ─────────────────────────────
  // These are explicit goals the user set — CC payoffs, personal loans, etc.
  // Sorted by balance ascending (knock out smallest first — Dave Ramsey snowball)
  // unless one has much higher interest, in which case avalanche wins.
  const debtPayoffGoals = goals
    .filter(g => g.strategy === 'extract' && !g.completedAt && g.currentAmount > 0)
    .sort((a, b) => {
      // Find matching debt to get interest rate
      const debtA = debts.find(d => d.id === a.debtId);
      const debtB = debts.find(d => d.id === b.debtId);
      const rateA = (debtA as any)?.interestRate || 0;
      const rateB = (debtB as any)?.interestRate || 0;
      // High-rate debt (>20%) always goes first — avalanche
      if (rateA > 20 && rateB <= 20) return -1;
      if (rateB > 20 && rateA <= 20) return 1;
      // Otherwise snowball: smallest balance first
      return a.currentAmount - b.currentAmount;
    });

  // Track which debtIds we've already covered via goals
  const coveredDebtIds = new Set<string>();

  for (const goal of debtPayoffGoals) {
    if (remaining <= 0) break;
    const allocate = Math.min(remaining, goal.currentAmount);
    const matchingDebt = debts.find(d => d.id === goal.debtId);
    const rate = (matchingDebt as any)?.interestRate || 0;
    const rateNote = rate > 0 ? ` (${rate.toFixed(0)}% APR)` : '';

    steps.push({
      id: `step-debtgoal-${goal.id}`,
      priority: priority++,
      category: 'debt_payoff',
      emoji: goal.emoji || '💳',
      title: goal.name,
      description: `$${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })} clears this completely${rateNote}. Eliminating debt is a guaranteed return equal to the interest rate.`,
      amount: allocate,
      requiresExchange: false,
      exchangeNote: null,
      actionLabel: allocate >= goal.currentAmount ? 'Pay off completely' : `Pay $${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      actionParams: { type: 'navigate_debt', debtId: goal.debtId },
    });

    if (goal.debtId) coveredDebtIds.add(goal.debtId);
    remaining -= allocate;
  }

  if (remaining <= 0) return buildAlert(input, steps, windfallAmount, reserved, deployable);

  // ── 3. Any remaining high-interest debt not already covered by a goal ────
  const highInterestDebts = debts
    .filter(d => (d as any).interestRate > HIGH_INTEREST_THRESHOLD && !coveredDebtIds.has(d.id))
    .sort((a, b) => ((b as any).interestRate || 0) - ((a as any).interestRate || 0));

  for (const debt of highInterestDebts) {
    if (remaining <= 0) break;
    const balance = (debt as any).balance || (debt as any).currentBalance || 0;
    if (balance <= 0) continue;
    const allocate = Math.min(remaining, balance);
    const rate = (debt as any).interestRate || 0;
    steps.push({
      id: `step-debt-${debt.id}`,
      priority: priority++,
      category: 'high_interest_debt',
      emoji: '💳',
      title: `Pay down ${debt.name}`,
      description: `${rate.toFixed(0)}% APR. Paying $${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })} saves ~$${(allocate * rate / 100).toFixed(0)}/year — guaranteed return.`,
      amount: allocate,
      requiresExchange: false,
      exchangeNote: null,
      actionLabel: `Pay $${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      actionParams: { type: 'navigate_debt', debtId: debt.id },
    });
    remaining -= allocate;
  }

  if (remaining <= 0) return buildAlert(input, steps, windfallAmount, reserved, deployable);

  // ── 4. Active accumulation targets ───────────────────────────────────────
  const activeAccPlans = accPlans
    .filter(p => p.strategy === 'accumulate' && p.progressPct < 100)
    .sort((a, b) => b.progressPct - a.progressPct);

  for (const plan of activeAccPlans) {
    if (remaining <= 0) break;
    const tokensNeeded = plan.targetAmount - plan.currentHolding;
    const costToComplete = tokensNeeded * plan.avgEntry;
    if (costToComplete <= 0) continue;
    const allocate = Math.min(remaining, costToComplete);
    steps.push({
      id: `step-acc-${plan.mint}`,
      priority: priority++,
      category: 'accumulation_target',
      emoji: '🎯',
      title: `Fund ${plan.symbol} accumulation target`,
      description: `${plan.progressPct.toFixed(0)}% to your ${plan.targetAmount.toLocaleString()} ${plan.symbol} target. $${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })} at your avg entry of $${plan.avgEntry.toFixed(6)}.`,
      amount: allocate,
      requiresExchange: true,
      exchangeNote,
      actionLabel: `Buy ${plan.symbol}`,
      actionParams: { type: 'navigate_asset', mint: plan.mint, symbol: plan.symbol },
    });
    remaining -= allocate;
  }

  if (remaining <= 0) return buildAlert(input, steps, windfallAmount, reserved, deployable);

  // ── 5. Other goals nearing completion (savings targets, custom) ──────────
  const actionableGoals = goals.filter(g => {
    // Skip debt payoffs (handled above) and completed goals
    if (g.strategy === 'extract') return false;
    if (g.completedAt) return false;
    if (g.targetAmount <= 0) return false;
    const pct = (g.currentAmount / g.targetAmount) * 100;
    return pct >= GOAL_NEAR_COMPLETION_PCT && pct < 100;
  }).sort((a, b) => {
    const pctA = a.currentAmount / (a.targetAmount || 1);
    const pctB = b.currentAmount / (b.targetAmount || 1);
    return pctB - pctA;
  });

  for (const goal of actionableGoals) {
    if (remaining <= 0) break;
    const gap = goal.targetAmount - goal.currentAmount;
    if (gap <= 0) continue;
    const allocate = Math.min(remaining, gap);
    const pct = ((goal.currentAmount / goal.targetAmount) * 100).toFixed(0);
    const needsCrypto = goal.type === 'accumulate' || goal.type === 'defi_target';
    const category = goal.type === 'savings_target' ? 'savings_target' as const : 'goal' as const;
    steps.push({
      id: `step-goal-${goal.id}`,
      priority: priority++,
      category,
      emoji: goal.emoji || '🏆',
      title: goal.name,
      description: `${pct}% funded — $${allocate.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${allocate >= gap ? 'completes this goal' : 'gets you closer'}.`,
      amount: allocate,
      requiresExchange: needsCrypto,
      exchangeNote: needsCrypto ? exchangeNote : null,
      actionLabel: allocate >= gap ? 'Complete goal' : 'Fund goal',
      actionParams: { type: 'navigate_goal', goalId: goal.id },
    });
    remaining -= allocate;
  }

  if (remaining <= 0) return buildAlert(input, steps, windfallAmount, reserved, deployable);

  // ── 6. Yield on remainder ─────────────────────────────────────────────────
  if (remaining >= 500) {
    steps.push({
      id: `step-yield-${Date.now()}`,
      priority: priority++,
      category: 'yield',
      emoji: '📈',
      title: 'Put remainder to work',
      description: `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} sitting in checking earns nothing. USD* or USDC on Perena (~9% APY) is stable, liquid, and earns while you decide next steps.`,
      amount: remaining,
      requiresExchange: true,
      exchangeNote,
      actionLabel: 'Deploy to yield',
      actionParams: { type: 'swap_to_stable' },
    });
    remaining = 0;
  }

  return buildAlert(input, steps, windfallAmount, reserved, deployable);
}

function buildAlert(
  input: PlanInput,
  steps: DeploymentStep[],
  windfallAmount: number,
  reserved: number,
  deployable: number,
): WindfallAlert {
  const totalAllocated = steps.reduce((sum, s) => sum + s.amount, 0);
  return {
    id: `windfall-${input.accountId}-${Date.now()}`,
    accountId: input.accountId,
    accountName: input.accountName,
    amount: windfallAmount,
    deployable,
    reserved,
    detectedAt: new Date().toISOString(),
    steps,
    totalAllocated,
    unallocated: Math.max(0, deployable - steps.filter(s => s.category !== 'reserve').reduce((sum, s) => sum + s.amount, 0)),
  };
}
