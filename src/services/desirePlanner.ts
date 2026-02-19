// src/services/desirePlanner.ts
// Gathers the user's full financial picture and sends it to the agentic planner

import { analyzeAllAccounts } from './cashflow';
import { useStore } from '../store/useStore';

// ─── Types (mirrored from api/desires/plan.ts) ───────────────────────────────

export interface ActionStep {
  id: string;
  order: number;
  type: 'swap' | 'dca' | 'deposit' | 'reduce_expense' | 'set_stoploss' | 'adjust_401k' | 'info';
  title: string;
  description: string;
  urgency: 'now' | 'this_week' | 'this_month' | 'ongoing';
  executable: boolean;
  execution?: {
    action: 'jupiter_swap' | 'perena_deposit' | 'dca_setup' | 'navigate' | 'none';
    params?: {
      fromToken?: string;
      toToken?: string;
      amount?: number;
      frequency?: string;
      targetScreen?: string;
    };
  };
  impact?: string;
}

export interface ActionPlan {
  desire: string;
  estimatedCost: number;
  productRecommendation: string;
  summary: string;
  currentFreedomDays: number;
  freedomAfterPurchase: number;
  canAffordNow: boolean;
  timelineMonths: number;
  riskWarnings: string[];
  steps: ActionStep[];
  alternativePlan?: string;
}

export interface FinancialSnapshot {
  freedomDays: number;
  freedomState: string;
  totalMonthlyIncome: number;
  tradingMonthly: number;
  tradingPercent: number;
  paycheckMonthly: number;
  assetIncomeMonthly: number;
  totalMonthlyObligations: number;
  totalMonthlyDebtPayments: number;
  monthlySurplus: number;
  totalLiquidAssets: number;
  totalBankBalance: number;
  usdStarBalance: number;
  cryptoHoldings: Array<{ symbol: string; value: number }>;
  has401k: boolean;
  monthly401k: number;
  percent401k: number;
  grossPay: number;
  tradingRiskActive: boolean;
  shortfallWithoutTrading: number;
  existingDesires: Array<{ name: string; cost: number }>;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly': return (amount * 52) / 12;
    case 'biweekly': return (amount * 26) / 12;
    case 'twice_monthly': return amount * 2;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    default: return amount;
  }
}

/**
 * Build a complete financial snapshot from the store for Claude
 */
export function buildFinancialSnapshot(): FinancialSnapshot {
  const state = useStore.getState();
  const {
    bankAccounts, income, obligations, debts, assets,
    preTaxDeductions = [], taxes = [], postTaxDeductions = [],
    desires = [],
  } = state;

  const incomeSources = income.sources || [];
  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets);

  // Income breakdown
  const tradingMonthly = incomeSources
    .filter(s => s.source === 'trading')
    .reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0);

  const paycheckMonthly = incomeSources
    .filter(s => s.source === 'salary' || s.source === 'freelance' || s.source === 'business')
    .reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0);

  const assetIncomeMonthly = assets.reduce((sum, a) => sum + (a.annualIncome / 12), 0);

  const totalMonthlyIncome = cashFlow.totalMonthlyIncome;
  const totalMonthlyObligations = cashFlow.totalMonthlyObligations;
  const totalMonthlyDebtPayments = cashFlow.totalMonthlyDebtPayments;
  const monthlySurplus = totalMonthlyIncome - totalMonthlyObligations - totalMonthlyDebtPayments;

  const tradingPercent = totalMonthlyIncome > 0 ? (tradingMonthly / totalMonthlyIncome) * 100 : 0;

  // 401k
  const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const taxesMonthly = taxes.reduce((sum, t) => sum + toMonthly(t.perPayPeriod, t.frequency), 0);
  const postTaxMonthly = postTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const grossPay = paycheckMonthly + preTaxMonthly + taxesMonthly + postTaxMonthly;

  const monthly401k = preTaxDeductions
    .filter(d => d.type === '401k_contribution')
    .reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);

  // Also check legacy retirement assets
  const legacy401k = assets
    .filter(a => a.type === 'retirement' && a.metadata?.type === 'retirement')
    .reduce((sum, a) => {
      const meta = a.metadata as any;
      return sum + toMonthly(meta?.contributionAmount || 0, meta?.contributionFrequency || 'monthly');
    }, 0);

  const total401k = monthly401k + legacy401k;
  const percent401k = grossPay > 0 ? (total401k / grossPay) * 100 : 0;

  // USD* balance
  const usdStarBalance = assets
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

  // Crypto holdings
  const cryptoHoldings = assets
    .filter(a => a.type === 'crypto' && a.value > 1)
    .map(a => ({
      symbol: (a.metadata as any)?.symbol || a.name,
      value: a.value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // top 10

  // Trading risk
  const incomeWithoutTrading = totalMonthlyIncome - tradingMonthly;
  const totalOut = totalMonthlyObligations + totalMonthlyDebtPayments;
  const tradingRiskActive = tradingPercent > 20 && incomeWithoutTrading < totalOut;
  const shortfallWithoutTrading = Math.max(0, totalOut - incomeWithoutTrading);

  // Bank balance
  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + (typeof a.currentBalance === 'number' && !isNaN(a.currentBalance) ? a.currentBalance : 0),
    0
  );

  // Freedom score
  const dailyNeeds = totalOut / 30;
  const dailyAssetIncome = assetIncomeMonthly / 30;
  const dailyBurn = dailyNeeds - dailyAssetIncome;
  const freedomDays = dailyBurn > 0 ? Math.floor(cashFlow.liquidAssets / dailyBurn) : Infinity;

  return {
    freedomDays: freedomDays === Infinity ? 9999 : freedomDays,
    freedomState: freedomDays >= 365 * 25 ? 'enthroned'
      : freedomDays >= 365 ? 'rising'
      : freedomDays >= 180 ? 'breaking'
      : freedomDays >= 90 ? 'struggling'
      : 'drowning',

    totalMonthlyIncome,
    tradingMonthly,
    tradingPercent,
    paycheckMonthly,
    assetIncomeMonthly,

    totalMonthlyObligations,
    totalMonthlyDebtPayments,
    monthlySurplus,

    totalLiquidAssets: cashFlow.liquidAssets,
    totalBankBalance,
    usdStarBalance,
    cryptoHoldings,

    has401k: total401k > 0,
    monthly401k: total401k,
    percent401k,
    grossPay,

    tradingRiskActive,
    shortfallWithoutTrading,

    existingDesires: desires.map(d => ({ name: d.name, cost: d.estimatedCost })),
  };
}

/**
 * Generate an agentic action plan for a desire
 */
export async function generateActionPlan(desire: string): Promise<ActionPlan> {
  const snapshot = buildFinancialSnapshot();

  const response = await fetch(`${API_BASE}/api/desires/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desire, snapshot }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate plan');
  }

  return response.json();
}

// Types are exported from their definitions above
