// src/services/badgeEngine.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Badge Engine — Evaluates app state and returns newly earned badges
// ═══════════════════════════════════════════════════════════════════════════════

import type { EarnedBadge } from '../types/badges';
import type { Asset, Obligation, Debt, Income, BankAccount } from '../types';
import { obligationMonthlyAmount } from '../types';
import type { BankTransaction } from '../types/bankTransactionTypes';

interface BadgeCheckState {
  wallets: string[];
  bankAccounts: BankAccount[];
  income: Income;
  assets: Asset[];
  obligations: Obligation[];
  debts: Debt[];
  bankTransactions: BankTransaction[];
  earnedBadges: EarnedBadge[];
  freedomDays: number;
  isKinged: boolean;
  // Tracked counters (persisted in store)
  trimCount: number;
  importWeeks: string[];  // ISO week strings of imports, e.g. ["2026-W07", "2026-W08"]
  appOpenDays: string[];  // ISO date strings, e.g. ["2026-02-19", "2026-02-20"]
}

interface BadgeCheckResult {
  newBadges: string[]; // badge IDs that were just earned
}

// ─── Week string helper ──────────────────────────────────────────────────────
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// Count consecutive weeks going backwards from current week
function countConsecutiveWeeks(weeks: string[]): number {
  if (weeks.length === 0) return 0;
  const sorted = [...new Set(weeks)].sort().reverse();
  const current = getISOWeek();

  let count = 0;
  // Parse week string to get week number for comparison
  for (let i = 0; i < sorted.length; i++) {
    // Expected week going backwards: current, current-1, current-2, ...
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - (i * 7));
    const expected = getISOWeek(expectedDate);

    if (sorted[i] === expected) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// Count consecutive days going backwards from today
function countConsecutiveDays(days: string[]): number {
  if (days.length === 0) return 0;
  const sorted = [...new Set(days)].sort().reverse();
  const today = getISODate();

  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = getISODate(expectedDate);

    if (sorted[i] === expected) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── Main badge evaluation ───────────────────────────────────────────────────
export function evaluateBadges(state: BadgeCheckState): BadgeCheckResult {
  const earned = new Set(state.earnedBadges.map(b => b.badgeId));
  const newBadges: string[] = [];

  function award(id: string) {
    if (!earned.has(id)) {
      newBadges.push(id);
    }
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (state.wallets.length > 0) {
    award('first_move');
  }

  if (state.bankTransactions.length > 0) {
    award('chart_the_waters');
  }

  const hasSources = (state.income.sources?.length ?? 0) > 0;
  if (hasSources) {
    award('income_tide');
  }

  if (state.obligations.length > 0 || state.debts.length > 0) {
    award('know_thy_enemy');
  }

  if (state.wallets.length > 0 && state.bankAccounts.length > 0 && hasSources && (state.obligations.length > 0 || state.debts.length > 0)) {
    award('full_board');
  }

  // ── TRADING ────────────────────────────────────────────────────────────
  if (state.trimCount >= 1) {
    award('smart_trim');
  }

  if (state.trimCount >= 5) {
    award('five_trims');
  }

  // Check for balanced portfolio (no single position >25%)
  const cryptoAssets = state.assets.filter(a => a.type === 'crypto' || a.type === 'defi');
  const totalCrypto = cryptoAssets.reduce((sum, a) => sum + a.value, 0);
  if (totalCrypto > 100) { // meaningful portfolio
    const maxConcentration = Math.max(...cryptoAssets.map(a => a.value / totalCrypto), 0);
    if (maxConcentration <= 0.25) {
      award('balanced_board');
    }
  }

  // catch_of_the_day and cut_bait are awarded externally when swaps complete
  // (the component that executes the swap calls awardBadge directly)

  // ── SAFETY ─────────────────────────────────────────────────────────────
  const usdStarBalance = state.assets
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

  const monthlyObligations = state.obligations.reduce((sum, o) => sum + obligationMonthlyAmount(o), 0)
    + state.debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const bufferTarget = monthlyObligations * 3;

  if (usdStarBalance >= 1000) {
    award('treading_water');
  }
  if (bufferTarget > 0 && usdStarBalance >= bufferTarget * 0.25) {
    award('life_vest');
  }
  if (bufferTarget > 0 && usdStarBalance >= bufferTarget * 0.50) {
    award('strong_swimmer');
  }
  if (bufferTarget > 0 && usdStarBalance >= bufferTarget) {
    award('safe_harbor');
  }

  // debt_slayer and lighter_load are awarded externally when user removes debt/obligation

  // ── STREAKS ────────────────────────────────────────────────────────────
  const consecutiveWeeks = countConsecutiveWeeks(state.importWeeks);

  if (consecutiveWeeks >= 2) award('captains_log');
  if (consecutiveWeeks >= 4) award('weekly_watch');
  if (consecutiveWeeks >= 8) award('steady_current');
  if (consecutiveWeeks >= 12) award('crowned');

  const consecutiveDays = countConsecutiveDays(state.appOpenDays);
  if (consecutiveDays >= 7) award('daily_tide');

  // ── MILESTONES ─────────────────────────────────────────────────────────
  if (state.freedomDays >= 30) award('head_above_water');
  if (state.freedomDays >= 90) award('learning_to_swim');
  if (state.freedomDays >= 180) award('smooth_sailing');
  if (state.freedomDays >= 365) award('island_time');
  if (state.isKinged) award('king_of_the_sea');

  return { newBadges };
}
