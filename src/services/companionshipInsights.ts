// src/services/companionshipInsights.ts
// Pure analysis engine for companionship expense tracking.
// No store imports, no side effects.

import type { InsightSeverity } from './tradeInsights';
import { getInsightColor } from './tradeInsights';

// Re-export for convenience
export { getInsightColor };
export type { InsightSeverity };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompanionshipInsight {
  id: string;
  category: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  detail?: string;
  emoji: string;
  stats?: Record<string, string | number>;
}

export interface CompanionshipExpenseInput {
  id: string;
  date: string;       // ISO date
  category: string;
  amount: number;
  description: string;
}

export interface CompanionshipSettingsInput {
  monthlyBudget: number;
  monthlyIncome: number;  // 0 = not set
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, warning: 1, tip: 2, positive: 3,
};

function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(0)}%`;
}

function groupByMonth(expenses: CompanionshipExpenseInput[]): Map<string, CompanionshipExpenseInput[]> {
  const map = new Map<string, CompanionshipExpenseInput[]>();
  for (const e of expenses) {
    const m = monthOf(e.date);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(e);
  }
  return map;
}

function monthTotal(expenses: CompanionshipExpenseInput[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateCompanionshipInsights(
  expenses: CompanionshipExpenseInput[],
  settings: CompanionshipSettingsInput,
  profileStartDate?: string,
): CompanionshipInsight[] {
  if (expenses.length === 0) return [];

  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const insights: CompanionshipInsight[] = [];
  const analyzers = [
    analyzeMonthlyBurnTrend,
    analyzeCategoryConcentration,
    analyzeIncomeExposure,
    analyzeBudgetAdherence,
    analyzeCheaperAlternatives,
    analyzeFinancialExposure,
    analyzeDiscoveryRiskCost,
    analyzeSeasonalPatterns,
  ];

  for (const analyze of analyzers) {
    const result = analyze(sorted, settings, profileStartDate);
    if (result) insights.push(result);
  }

  insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return insights;
}

// ─── Analyzers ───────────────────────────────────────────────────────────────

function analyzeMonthlyBurnTrend(
  expenses: CompanionshipExpenseInput[],
): CompanionshipInsight | null {
  const byMonth = groupByMonth(expenses);
  const months = [...byMonth.keys()].sort();
  if (months.length < 2) return null;

  const prev = monthTotal(byMonth.get(months[months.length - 2])!);
  const curr = monthTotal(byMonth.get(months[months.length - 1])!);
  if (prev === 0) return null;

  const change = ((curr - prev) / prev) * 100;
  const ts = Date.now();

  if (change > 30) {
    return {
      id: `ci-burn_trend-${ts}`,
      category: 'burn_trend',
      severity: 'critical',
      title: `Spending up ${fmtPct(change)} month-over-month`,
      message: `${fmtDollar(prev)} → ${fmtDollar(curr)}. Rapid escalation — check if this is sustainable.`,
      detail: `A 30%+ monthly increase is a red flag. Review what changed and whether you're setting unsustainable expectations.`,
      emoji: '🔥',
      stats: { 'Last Month': fmtDollar(prev), 'This Month': fmtDollar(curr), 'Change': `+${fmtPct(change)}` },
    };
  }

  if (change > 15) {
    return {
      id: `ci-burn_trend-${ts}`,
      category: 'burn_trend',
      severity: 'warning',
      title: `Spending trending up ${fmtPct(change)}`,
      message: `${fmtDollar(prev)} → ${fmtDollar(curr)}. Keep an eye on the trajectory.`,
      emoji: '📈',
      stats: { 'Last Month': fmtDollar(prev), 'This Month': fmtDollar(curr), 'Change': `+${fmtPct(change)}` },
    };
  }

  if (change <= 0) {
    return {
      id: `ci-burn_trend-${ts}`,
      category: 'burn_trend',
      severity: 'positive',
      title: 'Spending stable or declining',
      message: `${fmtDollar(prev)} → ${fmtDollar(curr)}. Good cost control this month.`,
      emoji: '✅',
      stats: { 'Last Month': fmtDollar(prev), 'This Month': fmtDollar(curr), 'Change': `${fmtPct(change)}` },
    };
  }

  return null;
}

function analyzeCategoryConcentration(
  expenses: CompanionshipExpenseInput[],
): CompanionshipInsight | null {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  if (total === 0) return null;

  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);
  }

  for (const [cat, amount] of byCat) {
    const pct = (amount / total) * 100;
    if (pct > 50) {
      return {
        id: `ci-concentration-${Date.now()}`,
        category: 'concentration',
        severity: 'tip',
        title: `${fmtPct(pct)} concentrated in ${cat.replace(/_/g, ' ')}`,
        message: `${fmtDollar(amount)} of ${fmtDollar(total)} total. Consider diversifying how you spend time together.`,
        detail: `Heavy concentration in one category can signal autopilot. Mixing up activities often creates better experiences for less money.`,
        emoji: '🎯',
        stats: { 'Category': cat.replace(/_/g, ' '), 'Amount': fmtDollar(amount), 'Share': fmtPct(pct) },
      };
    }
  }

  return null;
}

function analyzeIncomeExposure(
  expenses: CompanionshipExpenseInput[],
  settings: CompanionshipSettingsInput,
): CompanionshipInsight | null {
  if (!settings.monthlyIncome || settings.monthlyIncome <= 0) return null;

  const byMonth = groupByMonth(expenses);
  const cm = currentMonth();
  const thisMonth = byMonth.get(cm);
  if (!thisMonth) return null;

  const spent = monthTotal(thisMonth);
  const pct = (spent / settings.monthlyIncome) * 100;
  const ts = Date.now();

  if (pct > 25) {
    return {
      id: `ci-income_exposure-${ts}`,
      category: 'income_exposure',
      severity: 'critical',
      title: `${fmtPct(pct)} of take-home this month`,
      message: `${fmtDollar(spent)} of ${fmtDollar(settings.monthlyIncome)} income. This is financially dangerous territory.`,
      detail: `Spending more than 25% of take-home on a companion is unsustainable. Most financial advisors would flag this immediately.`,
      emoji: '🚨',
      stats: { 'Spent': fmtDollar(spent), 'Income': fmtDollar(settings.monthlyIncome), 'Exposure': fmtPct(pct) },
    };
  }

  if (pct > 15) {
    return {
      id: `ci-income_exposure-${ts}`,
      category: 'income_exposure',
      severity: 'warning',
      title: `${fmtPct(pct)} of income going to companion`,
      message: `${fmtDollar(spent)} this month. Getting close to uncomfortable levels.`,
      emoji: '⚠️',
      stats: { 'Spent': fmtDollar(spent), 'Income': fmtDollar(settings.monthlyIncome), 'Exposure': fmtPct(pct) },
    };
  }

  if (pct > 10) {
    return {
      id: `ci-income_exposure-${ts}`,
      category: 'income_exposure',
      severity: 'tip',
      title: `${fmtPct(pct)} income allocation`,
      message: `${fmtDollar(spent)} this month — noticeable but manageable. Monitor the trend.`,
      emoji: '💡',
      stats: { 'Spent': fmtDollar(spent), 'Income': fmtDollar(settings.monthlyIncome), 'Exposure': fmtPct(pct) },
    };
  }

  return null;
}

function analyzeBudgetAdherence(
  expenses: CompanionshipExpenseInput[],
  settings: CompanionshipSettingsInput,
): CompanionshipInsight | null {
  if (!settings.monthlyBudget || settings.monthlyBudget <= 0) return null;

  const byMonth = groupByMonth(expenses);
  const cm = currentMonth();
  const thisMonth = byMonth.get(cm);
  if (!thisMonth) return null;

  const spent = monthTotal(thisMonth);
  const pct = (spent / settings.monthlyBudget) * 100;
  const ts = Date.now();

  if (pct > 120) {
    return {
      id: `ci-budget-${ts}`,
      category: 'budget',
      severity: 'critical',
      title: `${fmtPct(pct - 100)} over budget`,
      message: `${fmtDollar(spent)} spent vs ${fmtDollar(settings.monthlyBudget)} budget. You've blown past your limit.`,
      detail: `Being 20%+ over budget means your budget isn't working. Either increase it to be realistic or enforce discipline.`,
      emoji: '💸',
      stats: { 'Spent': fmtDollar(spent), 'Budget': fmtDollar(settings.monthlyBudget), 'Usage': fmtPct(pct) },
    };
  }

  if (pct > 100) {
    return {
      id: `ci-budget-${ts}`,
      category: 'budget',
      severity: 'warning',
      title: 'Over budget this month',
      message: `${fmtDollar(spent)} of ${fmtDollar(settings.monthlyBudget)} (${fmtPct(pct)}). Slow down on spending.`,
      emoji: '🟡',
      stats: { 'Spent': fmtDollar(spent), 'Budget': fmtDollar(settings.monthlyBudget), 'Over By': fmtDollar(spent - settings.monthlyBudget) },
    };
  }

  if (pct > 80) {
    return {
      id: `ci-budget-${ts}`,
      category: 'budget',
      severity: 'tip',
      title: `${fmtPct(pct)} of budget used`,
      message: `${fmtDollar(settings.monthlyBudget - spent)} remaining this month. Plan carefully.`,
      emoji: '📊',
      stats: { 'Spent': fmtDollar(spent), 'Budget': fmtDollar(settings.monthlyBudget), 'Remaining': fmtDollar(settings.monthlyBudget - spent) },
    };
  }

  return null;
}

function analyzeCheaperAlternatives(
  expenses: CompanionshipExpenseInput[],
): CompanionshipInsight | null {
  const byMonth = groupByMonth(expenses);
  const cm = currentMonth();
  const thisMonth = byMonth.get(cm);
  if (!thisMonth) return null;

  const byCat = new Map<string, number[]>();
  for (const e of thisMonth) {
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category)!.push(e.amount);
  }

  const thresholds: Record<string, { limit: number; label: string }> = {
    dining: { limit: 150, label: 'dining' },
    travel_hotels: { limit: 300, label: 'travel' },
    gifts: { limit: 200, label: 'gifts' },
    cash_allowances: { limit: 500, label: 'cash' },
  };

  for (const [cat, amounts] of byCat) {
    const threshold = thresholds[cat];
    if (!threshold) continue;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (avg > threshold.limit) {
      return {
        id: `ci-alternatives-${Date.now()}`,
        category: 'alternatives',
        severity: 'tip',
        title: `High avg ${threshold.label}: ${fmtDollar(avg)}/expense`,
        message: `Average ${threshold.label} expense is ${fmtDollar(avg)} (threshold: ${fmtDollar(threshold.limit)}). Look for more cost-effective options.`,
        detail: `This doesn't mean cut quality — it means be strategic. Happy hours vs dinner, Airbnb vs hotels, thoughtful gifts vs expensive ones.`,
        emoji: '💡',
        stats: { 'Avg Expense': fmtDollar(avg), 'Threshold': fmtDollar(threshold.limit), 'Count': amounts.length },
      };
    }
  }

  return null;
}

function analyzeFinancialExposure(
  expenses: CompanionshipExpenseInput[],
  _settings: CompanionshipSettingsInput,
  profileStartDate?: string,
): CompanionshipInsight | null {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  if (total <= 0) return null;

  const ts = Date.now();
  const duration = profileStartDate
    ? Math.max(1, Math.ceil((Date.now() - new Date(profileStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : null;

  if (total > 25000) {
    return {
      id: `ci-total_exposure-${ts}`,
      category: 'total_exposure',
      severity: 'critical',
      title: `${fmtDollar(total)} total investment`,
      message: `Cumulative spending has crossed $25K.${duration ? ` That's ${fmtDollar(total / duration)}/month over ${duration} months.` : ''}`,
      detail: `At this level, you're making a significant financial commitment. Ensure this aligns with your overall financial plan.`,
      emoji: '🔴',
      stats: { 'Total': fmtDollar(total), ...(duration ? { 'Months': duration, 'Avg/Mo': fmtDollar(total / duration) } : {}) },
    };
  }

  if (total > 10000) {
    return {
      id: `ci-total_exposure-${ts}`,
      category: 'total_exposure',
      severity: 'warning',
      title: `${fmtDollar(total)} cumulative spend`,
      message: `You've crossed $10K total.${duration ? ` Averaging ${fmtDollar(total / duration)}/month.` : ''} Worth a reality check.`,
      emoji: '🟠',
      stats: { 'Total': fmtDollar(total), ...(duration ? { 'Months': duration, 'Avg/Mo': fmtDollar(total / duration) } : {}) },
    };
  }

  return null;
}

function analyzeDiscoveryRiskCost(
  expenses: CompanionshipExpenseInput[],
): CompanionshipInsight | null {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  if (total < 1000) return null; // Not enough data to be meaningful

  // Rough divorce cost estimate (median US)
  const estimatedDivorceCost = 15000;
  const combinedRisk = total + estimatedDivorceCost;

  return {
    id: `ci-discovery_risk-${Date.now()}`,
    category: 'discovery_risk',
    severity: 'warning',
    title: 'Discovery risk assessment',
    message: `${fmtDollar(total)} spent + est. ${fmtDollar(estimatedDivorceCost)} divorce cost = ${fmtDollar(combinedRisk)} total financial exposure.`,
    detail: `This is informational. The median US divorce costs $15K in legal fees alone, not counting asset division. Factor this into your risk calculus.`,
    emoji: '⚖️',
    stats: { 'Spent': fmtDollar(total), 'Est. Divorce': fmtDollar(estimatedDivorceCost), 'Total Risk': fmtDollar(combinedRisk) },
  };
}

function analyzeSeasonalPatterns(
  expenses: CompanionshipExpenseInput[],
): CompanionshipInsight | null {
  const byMonth = groupByMonth(expenses);
  const months = [...byMonth.keys()].sort();
  if (months.length < 3) return null;

  const totals = months.map(m => monthTotal(byMonth.get(m)!));
  const avg = totals.reduce((s, t) => s + t, 0) / totals.length;
  if (avg === 0) return null;

  // Check the most recent month
  const latestTotal = totals[totals.length - 1];
  const ratio = latestTotal / avg;

  if (ratio > 1.5) {
    const latestMonth = months[months.length - 1];
    return {
      id: `ci-seasonal-${Date.now()}`,
      category: 'seasonal',
      severity: 'tip',
      title: `${latestMonth} spending is ${ratio.toFixed(1)}x your average`,
      message: `${fmtDollar(latestTotal)} vs ${fmtDollar(avg)} average. Check if this is a seasonal spike (birthday, holiday) or a new baseline.`,
      detail: `Seasonal spikes are normal (Valentine's, birthdays, holidays). But if it's not seasonal, your baseline may be creeping up.`,
      emoji: '📅',
      stats: { 'This Month': fmtDollar(latestTotal), 'Average': fmtDollar(avg), 'Ratio': `${ratio.toFixed(1)}x` },
    };
  }

  return null;
}
