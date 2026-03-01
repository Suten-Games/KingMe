// src/services/cashflow.ts
// Analyzes cash flow per bank account using actual store types

import type { BankAccount, IncomeSource, Obligation, Debt, Asset, PaycheckDeduction, RealEstateAsset } from '../types';

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

export interface OverallCashFlow {
  totalMonthlyIncome: number;
  totalMonthlyObligations: number;
  totalMonthlyDebtPayments: number;
  totalMonthlyNet: number;
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
    .reduce((total, o) => total + o.amount, 0);
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

/**
 * Full cash flow analysis across ALL accounts
 */
export function analyzeAllAccounts(
  bankAccounts: BankAccount[],
  incomeSources: IncomeSource[],
  obligations: Obligation[],
  debts: Debt[],
  assets: Asset[] = [],
  paycheckDeductions: PaycheckDeduction[] = []
): OverallCashFlow {
  const accounts = bankAccounts.map(account =>
    analyzeAccount(account, incomeSources, obligations, debts)
  );

  const totalMonthlyIncome = accounts.reduce((sum, a) => sum + a.monthlyIncome, 0);
  const totalMonthlyObligations = accounts.reduce((sum, a) => sum + a.monthlyObligations, 0);
  const totalMonthlyDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalMonthlyNet = totalMonthlyIncome - totalMonthlyObligations - totalMonthlyDebtPayments;
  const totalBalance = bankAccounts.reduce((sum, a) => sum + (typeof a.currentBalance === 'number' && !isNaN(a.currentBalance) ? a.currentBalance : 0), 0);

  // Calculate liquid assets: bank balances + non-retirement liquid assets
  // For real estate, use equity (value minus mortgage) instead of gross value
  const liquidNonRetirementAssets = assets
    .filter(a => {
      // Exclude retirement accounts (401k, IRA, etc.)
      if (a.metadata?.type === 'retirement') return false;
      return true;
    })
    .reduce((sum, a) => {
      const val = a.value || 0;
      if (a.type === 'real_estate') {
        const m = a.metadata as RealEstateAsset;
        return sum + Math.max(0, val - (m?.mortgageBalance || 0));
      }
      return sum + val;
    }, 0);

  const liquidAssets = totalBalance + liquidNonRetirementAssets;

  // Daily living = sum of all obligations categorized as daily_living
  const totalDailyLiving = obligations
    .filter(o => o.category === 'daily_living')
    .reduce((sum, o) => sum + o.amount, 0);

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
    const totalMonthlyOutflow = totalMonthlyObligations + totalMonthlyDebtPayments;
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

  if (unassignedObligations.length > 0) {
    recommendations.unshift(`⚠️ ${unassignedObligations.length} obligation(s) not assigned to an account`);
  }

  return {
    totalMonthlyIncome,
    totalMonthlyObligations,
    totalMonthlyNet,
    totalMonthlyDebtPayments,
    totalBalance,
    liquidAssets,
    totalDailyLiving,
    totalPreTaxDeductions,
    totalEmployerMatch,
    unassignedObligations,
    accounts,
    healthStatus,
    healthMessage,
    recommendations,
  };
}
