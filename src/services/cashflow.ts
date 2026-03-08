// src/services/cashflow.ts
// Analyzes cash flow per bank account using actual store types

import type { BankAccount, IncomeSource, Obligation, Debt, Asset, PaycheckDeduction, RealEstateAsset } from '../types';
import { obligationMonthlyAmount } from '../types';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup, CustomCategoryDef } from '../types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } from '../types/bankTransactionTypes';

export interface CashFlowAnalysis {
  account: BankAccount;
  monthlyIncome: number;
  monthlyObligations: number;
  monthlyDebtPayments: number;
  monthlyNet: number; // Income - obligations - debts
  currentBalance: number;
  daysOfRunway: number; // How many days current balance covers
  status: 'healthy' | 'tight' | 'deficit';
  warnings: string[];
}

export interface VariableSpendingGroup {
  group: BankTransactionGroup;
  label: string;
  emoji: string;
  color: string;
  monthly: number;            // average monthly spend in this group
  coaching?: string;          // coaching question for reducing this category
}

export interface UncategorizedGroup {
  pattern: string;          // cleaned description used for grouping
  sampleDescription: string; // original description from first occurrence
  count: number;            // how many transactions match
  total: number;            // total amount across all matches
  monthly: number;          // average per month
  transactionIds: string[]; // IDs for batch re-categorization
}

export interface VariableSpendingAnalysis {
  autoEstimate: number;                // auto-calculated monthly variable spending
  monthsAnalyzed: number;              // how many months of data used
  groups: VariableSpendingGroup[];     // per-group breakdown, sorted by spend desc
  effectiveDiscretionary: number;      // what's actually used: user override > auto-estimate
  uncategorized: UncategorizedGroup[]; // "other" transactions grouped by description, sorted by total desc
}

export interface OverallCashFlow {
  totalMonthlyIncome: number;
  totalMonthlyObligations: number;
  totalMonthlyDebtPayments: number;
  totalMonthlyDiscretionary: number;  // effective discretionary (user override or auto-estimate)
  spendingGap: number;                // detected gap from bank transactions (0 if none)
  totalMonthlyOut: number;            // obligations + debts + discretionary (full picture)
  totalMonthlyNet: number;
  variableSpending: VariableSpendingAnalysis; // auto-calculated breakdown from bank transactions
  totalBalance: number; // Bank accounts only (kept for backwards compatibility)
  liquidAssets: number; // Bank accounts + liquid non-retirement assets
  totalDailyLiving: number; // Daily living allowance * 30
  totalPreTaxDeductions: number; // 401k / retirement contributions (never hit a bank account)
  totalEmployerMatch: number;    // employer match dollars per month
  unassignedObligations: Obligation[]; // Obligations not tied to an account
  accounts: CashFlowAnalysis[];
  healthStatus: 'critical' | 'struggling' | 'stable' | 'building' | 'thriving';
  healthMessage: string;
  recommendations: string[];
}

/**
 * Calculate monthly income for a single bank account
 */
export function getMonthlyIncomeForAccount(
  sources: IncomeSource[],
  bankAccountId: string
): number {
  return sources
    .filter(s => s.bankAccountId === bankAccountId)
    .reduce((total, source) => {
      switch (source.frequency) {
        case 'weekly':
          return total + (source.amount * 52) / 12;
        case 'biweekly':
          return total + (source.amount * 26) / 12;
        case 'twice_monthly':
          return total + source.amount * 2;
        case 'monthly':
          return total + source.amount;
        case 'quarterly':
          return total + source.amount / 3;
        default:
          return total;
      }
    }, 0);
}

/**
 * Calculate monthly obligations for a single bank account
 */
export function getMonthlyObligationsForAccount(
  obligations: Obligation[],
  bankAccountId: string
): number {
  return obligations
    .filter(o => o.bankAccountId === bankAccountId)
    .reduce((total, o) => total + obligationMonthlyAmount(o), 0);
}

/**
 * Analyze cash flow for a single bank account
 */
export function analyzeAccount(
  account: BankAccount,
  sources: IncomeSource[],
  obligations: Obligation[],
  debts: Debt[]
): CashFlowAnalysis {
  // Guard: balance can be null/NaN after a save/load round-trip if bad input slipped through
  const safeBalance = typeof account.currentBalance === 'number' && !isNaN(account.currentBalance)
    ? account.currentBalance
    : 0;

  const monthlyIncome = getMonthlyIncomeForAccount(sources, account.id);
  const monthlyObligations = getMonthlyObligationsForAccount(obligations, account.id);
  const monthlyDebtPayments = 0; // Debts don't have bankAccountId yet
  const monthlyNet = monthlyIncome - monthlyObligations - monthlyDebtPayments;

  const totalMonthlyOut = monthlyObligations + monthlyDebtPayments;
  const dailyBurn = totalMonthlyOut / 30;
  const daysOfRunway = dailyBurn > 0 ? Math.floor(safeBalance / dailyBurn) : Infinity;

  const warnings: string[] = [];
  let status: 'healthy' | 'tight' | 'deficit' = 'healthy';

  if (monthlyIncome > 0 && monthlyIncome < monthlyObligations) {
    warnings.push(`Income ($${monthlyIncome.toFixed(0)}) doesn't cover obligations ($${monthlyObligations.toFixed(0)}). Losing $${(monthlyObligations - monthlyIncome).toFixed(0)}/mo.`);
    status = 'deficit';
  } else if (monthlyIncome > 0 && daysOfRunway < 30) {
    warnings.push(`Only ${daysOfRunway} days of runway. Balance is low.`);
    status = 'tight';
  } else if (monthlyIncome > 0 && daysOfRunway < 90) {
    warnings.push(`${daysOfRunway} days runway. Aim for 90+ days.`);
    status = 'tight';
  }

  if (monthlyNet > 0 && daysOfRunway >= 90) {
    warnings.push(`Saving $${monthlyNet.toFixed(0)}/mo with ${daysOfRunway} days runway.`);
  }

  return {
    account,
    monthlyIncome,
    monthlyObligations,
    monthlyDebtPayments,
    monthlyNet,
    currentBalance: safeBalance,
    daysOfRunway,
    status,
    warnings,
  };
}

/**
 * Sum monthly pre-tax retirement contributions across all retirement assets.
 * These are deducted from the paycheck before it hits any bank account,
 * so they are NOT obligations — they reduce gross income at source.
 */
export function getMonthlyPreTaxDeductions(assets: Asset[]): { contributions: number; employerMatch: number } {
  let contributions = 0;
  let employerMatch = 0;

  assets.forEach((asset) => {
    if (asset.type === 'retirement' && asset.metadata?.type === 'retirement') {
      const meta = asset.metadata;
      const amt = meta.contributionAmount || 0;
      switch (meta.contributionFrequency) {
        case 'weekly': contributions += (amt * 52) / 12; break;
        case 'biweekly': contributions += (amt * 26) / 12; break;
        case 'twice_monthly': contributions += amt * 2; break;
        case 'monthly': contributions += amt; break;
      }
      employerMatch += meta.employerMatchDollars || 0;
    }
  });

  return { contributions, employerMatch };
}

// Groups that represent variable/discretionary spending (not tracked as obligations)
const VARIABLE_GROUPS: Set<BankTransactionGroup> = new Set([
  'food', 'transport', 'medical', 'personal', 'entertainment', 'other',
]);

// Coaching prompts per group — questions to help reduce spending
const GROUP_COACHING: Partial<Record<BankTransactionGroup, string>> = {
  food:          'Could meal prepping or cooking one more night/week help?',
  transport:     'Any carpooling, route optimization, or work-from-home days possible?',
  medical:       'Worth checking if a different pharmacy or plan saves on copays?',
  personal:      'Could a no-buy month or capsule wardrobe approach work?',
  entertainment: 'Any subscriptions or outings you could swap for free alternatives?',
  other:         'Anything here that could be reduced or eliminated?',
};

/**
 * Analyze bank transactions to compute average monthly variable spending by category.
 * Only counts non-recurring expenses in discretionary groups.
 */
export function computeVariableSpending(
  bankTransactions: BankTransaction[],
  monthlyDiscretionary: number,
  customCategories: Record<string, CustomCategoryDef> = {},
): VariableSpendingAnalysis {
  const empty: VariableSpendingAnalysis = {
    autoEstimate: 0,
    monthsAnalyzed: 0,
    groups: [],
    effectiveDiscretionary: monthlyDiscretionary,
    uncategorized: [],
  };

  if (bankTransactions.length === 0) return empty;

  // Filter to expense transactions in variable groups.
  // Include ALL expenses in variable groups — even if flagged isRecurring,
  // because groceries/gas/dining recur but are still variable spending.
  // The isRecurring flag is for obligation-matching (rent, subscriptions),
  // which fall in non-variable groups and are already excluded.
  // Resolve category → group, checking built-in meta first, then custom categories
  const resolveGroup = (cat: BankTransactionCategory): BankTransactionGroup | null => {
    const builtIn = TRANSACTION_CATEGORY_META[cat as keyof typeof TRANSACTION_CATEGORY_META];
    if (builtIn) return builtIn.group;
    const custom = customCategories[cat];
    if (custom) return custom.group;
    return null;
  };

  const variableTxns = bankTransactions.filter(t => {
    if (t.type !== 'expense') return false;
    const grp = resolveGroup(t.category);
    if (!grp) return false;
    return VARIABLE_GROUPS.has(grp);
  });

  if (variableTxns.length === 0) return empty;

  // Group by month and by category group
  const monthTotals: Record<string, number> = {};
  const groupTotals: Record<BankTransactionGroup, number> = {} as any;

  for (const t of variableTxns) {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    const amt = Math.abs(t.amount);
    monthTotals[monthKey] = (monthTotals[monthKey] || 0) + amt;

    const grp = resolveGroup(t.category)!;
    groupTotals[grp] = (groupTotals[grp] || 0) + amt;
  }

  const monthsAnalyzed = Object.keys(monthTotals).length;
  const totalSpending = Object.values(monthTotals).reduce((s, v) => s + v, 0);
  const autoEstimate = Math.round(totalSpending / monthsAnalyzed);

  // Build per-group breakdown
  const groups: VariableSpendingGroup[] = Object.entries(groupTotals)
    .map(([grp, total]) => {
      const meta = TRANSACTION_GROUP_META[grp as BankTransactionGroup];
      return {
        group: grp as BankTransactionGroup,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        monthly: Math.round(total / monthsAnalyzed),
        coaching: GROUP_COACHING[grp as BankTransactionGroup],
      };
    })
    .filter(g => g.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  // Build uncategorized groups — "other" category transactions grouped by description
  const otherTxns = variableTxns.filter(t => t.category === 'other');
  const descGroups: Record<string, { txns: BankTransaction[]; sample: string }> = {};
  for (const t of otherTxns) {
    // Clean description for grouping: strip numbers, dates, references
    const pattern = t.description
      .replace(/\d{2}\/\d{2}/g, '')
      .replace(/#\d+/g, '')
      .replace(/\d{4,}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 35)
      .toLowerCase();
    if (!pattern) continue;
    if (!descGroups[pattern]) descGroups[pattern] = { txns: [], sample: t.description };
    descGroups[pattern].txns.push(t);
  }

  const uncategorized: UncategorizedGroup[] = Object.entries(descGroups)
    .map(([pattern, { txns, sample }]) => ({
      pattern,
      sampleDescription: sample.substring(0, 50),
      count: txns.length,
      total: txns.reduce((s, t) => s + Math.abs(t.amount), 0),
      monthly: Math.round(txns.reduce((s, t) => s + Math.abs(t.amount), 0) / monthsAnalyzed),
      transactionIds: txns.map(t => t.id),
    }))
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total);

  // Effective = user override if set, otherwise auto-estimate
  const effectiveDiscretionary = monthlyDiscretionary > 0 ? monthlyDiscretionary : autoEstimate;

  return { autoEstimate, monthsAnalyzed, groups, effectiveDiscretionary, uncategorized };
}

/**
 * Full cash flow analysis across ALL accounts
 */
export function analyzeAllAccounts(
  bankAccounts: BankAccount[],
  incomeSources: IncomeSource[],
  obligations: Obligation[],
  debts: Debt[],
  assets: Asset[] = [],
  paycheckDeductions: PaycheckDeduction[] = [],
  monthlyDiscretionary: number = 0,
  bankTransactions: BankTransaction[] = [],
  customCategories: Record<string, CustomCategoryDef> = {},
): OverallCashFlow {
  const accounts = bankAccounts.map(account =>
    analyzeAccount(account, incomeSources, obligations, debts)
  );

  const totalMonthlyIncome = accounts.reduce((sum, a) => sum + a.monthlyIncome, 0);
  const assignedObligations = accounts.reduce((sum, a) => sum + a.monthlyObligations, 0);
  const unassignedObligationTotal = obligations
    .filter(o => !o.bankAccountId)
    .reduce((sum, o) => sum + obligationMonthlyAmount(o), 0);
  const totalMonthlyObligations = assignedObligations + unassignedObligationTotal;
  const totalMonthlyDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);

  // Compute variable spending from bank transaction history
  const variableSpending = computeVariableSpending(bankTransactions, monthlyDiscretionary, customCategories);
  const effectiveDiscretionary = variableSpending.effectiveDiscretionary;

  const totalMonthlyOut = totalMonthlyObligations + totalMonthlyDebtPayments + effectiveDiscretionary;
  const totalMonthlyNet = totalMonthlyIncome - totalMonthlyOut;

  // Spending gap: auto-estimate vs what user has set (0 means not set)
  const spendingGap = variableSpending.autoEstimate;
  const totalBalance = bankAccounts.reduce((sum, a) => sum + (typeof a.currentBalance === 'number' && !isNaN(a.currentBalance) ? a.currentBalance : 0), 0);

  // Calculate liquid assets: bank balances + non-retirement liquid assets
  // For real estate, use equity (value minus mortgage) instead of gross value
  const totalMortgageBalance = debts
    .filter(d => d.name.toLowerCase().includes('mortgage'))
    .reduce((sum, d) => sum + (d.balance ?? d.principal ?? 0), 0);

  const liquidNonRetirementAssets = assets
    .filter(a => {
      // Exclude retirement accounts (401k, IRA, etc.)
      if (a.metadata?.type === 'retirement' || a.type === 'retirement') return false;
      // Exclude illiquid "other" assets (cars, collectibles, etc.)
      if (a.type === 'other') return false;
      // Exclude real estate from liquid count (handled separately)
      if (a.type === 'real_estate') return false;
      return true;
    })
    .reduce((sum, a) => {
      const val = a.value || 0;
      return sum + val;
    }, 0);

  const liquidAssets = totalBalance + liquidNonRetirementAssets;

  // Daily living = sum of all obligations categorized as daily_living
  const totalDailyLiving = obligations
    .filter(o => o.category === 'daily_living')
    .reduce((sum, o) => sum + obligationMonthlyAmount(o), 0);

  // Pre-tax retirement contributions (deducted from paycheck, never touch a bank account)
  const { contributions: totalPreTaxDeductions401k, employerMatch: totalEmployerMatch } = getMonthlyPreTaxDeductions(assets);

  // Pre-tax paycheck deductions (401k loan repayment, healthcare, etc.)
  const paycheckDeductionMonthly = paycheckDeductions.reduce((sum, d) => {
    const amt = d.perPayPeriod || 0;
    switch (d.frequency) {
      case 'weekly': return sum + (amt * 52) / 12;
      case 'biweekly': return sum + (amt * 26) / 12;
      case 'twice_monthly': return sum + amt * 2;
      case 'monthly': return sum + amt;
      default: return sum;
    }
  }, 0);

  const totalPreTaxDeductions = totalPreTaxDeductions401k + paycheckDeductionMonthly;

  // Find obligations not assigned to any account
  const unassignedObligations = obligations.filter(o => !o.bankAccountId);

  // Determine health status
  let healthStatus: OverallCashFlow['healthStatus'];
  let healthMessage: string;
  let recommendations: string[] = [];

  if (totalMonthlyIncome === 0) {
    healthStatus = 'critical';
    if (incomeSources.length === 0) {
      healthMessage = 'No income tracked yet. Go to the Income tab to add your salary or trading wins.';
      recommendations = ['Add salary or trading income in the Income tab'];
    } else {
      healthMessage = 'Income sources exist but aren\'t linked to any account. Check the Income tab.';
      recommendations = ['Open Income tab → verify each source has a destination account'];
    }
  } else if (totalMonthlyNet < 0) {
    healthStatus = 'critical';
    healthMessage = `You're spending $${Math.abs(totalMonthlyNet).toFixed(0)}/month more than you earn. This needs fixing first.`;
    recommendations = [
      'Increase income or cut obligations',
      'Review recurring expenses for cuts',
      'Focus on cash flow before investing',
    ];
  } else if (totalMonthlyNet < 500) {
    healthStatus = 'struggling';
    healthMessage = `You're covering bills but only saving $${totalMonthlyNet.toFixed(0)}/month. Tight but survivable.`;
    recommendations = [
      'Build an emergency fund (target: 3 months)',
      'Look for ways to increase income',
      'Hold off on new asset purchases for now',
    ];
  } else {
    const totalMonthlyOutflow = totalMonthlyOut;
    const monthsOfRunway = totalMonthlyOutflow > 0 ? liquidAssets / totalMonthlyOutflow : Infinity;

    if (monthsOfRunway < 3) {
      healthStatus = 'stable';
      healthMessage = `Saving $${totalMonthlyNet.toFixed(0)}/month. Build your emergency fund to 3 months first.`;
      recommendations = [
        `Need $${(totalMonthlyOutflow * 3 - liquidAssets).toFixed(0)} more for 3-month runway`,
        'Keep emergency fund in high-yield savings',
        'After runway is solid, start investing surplus',
      ];
    } else if (monthsOfRunway < 6) {
      healthStatus = 'building';
      healthMessage = `${monthsOfRunway.toFixed(1)} months runway, saving $${totalMonthlyNet.toFixed(0)}/month. Ready to start investing.`;
      recommendations = [
        'Start putting surplus into income-generating assets',
        'Consider stablecoin lending or SOL staking',
        'Keep growing your emergency fund toward 6 months',
      ];
    } else {
      healthStatus = 'thriving';
      healthMessage = `${monthsOfRunway.toFixed(1)} months runway, saving $${totalMonthlyNet.toFixed(0)}/month. Invest aggressively.`;
      recommendations = [
        'Maximize investment in income-generating assets',
        'Diversify across crypto, stocks, real estate',
        `Goal: get passive income to $${(totalMonthlyOutflow).toFixed(0)}/month`,
      ];
    }
  }

  if (monthlyDiscretionary === 0 && variableSpending.autoEstimate === 0 && totalMonthlyObligations > 0) {
    recommendations.unshift('⚠️ Tap the orange spending card below to set a variable spending estimate, or go to a bank account to import a CSV statement');
  }

  if (unassignedObligations.length > 0) {
    recommendations.unshift(`⚠️ ${unassignedObligations.length} obligation(s) not assigned to a bank account — tap to fix`);
  }

  return {
    totalMonthlyIncome,
    totalMonthlyObligations,
    totalMonthlyDebtPayments,
    totalMonthlyDiscretionary: effectiveDiscretionary,
    spendingGap,
    totalMonthlyOut,
    totalMonthlyNet,
    totalBalance,
    liquidAssets,
    totalDailyLiving,
    totalPreTaxDeductions,
    totalEmployerMatch,
    unassignedObligations,
    accounts,
    variableSpending,
    healthStatus,
    healthMessage,
    recommendations,
  };
}
