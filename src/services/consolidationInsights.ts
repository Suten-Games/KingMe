// src/services/consolidationInsights.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Pure analysis engine — no store imports, no side effects.
// Analyzes bank accounts for consolidation opportunities.
// Reuses InsightSeverity / getInsightColor from tradeInsights.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InsightSeverity } from './tradeInsights';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface ConsolidationInput {
  bankAccounts: {
    id: string;
    name: string;
    type: 'checking' | 'savings' | 'investment';
    currentBalance: number;
    institution: string;
    isPrimaryIncome: boolean;
  }[];
  bankTransactions: {
    id: string;
    bankAccountId: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    type: 'expense' | 'income' | 'transfer';
  }[];
  obligations: {
    id: string;
    name: string;
    amount: number;
    bankAccountId?: string;
    category: string;
  }[];
  debts: {
    id: string;
    name: string;
    monthlyPayment: number;
    bankAccountId?: string;
  }[];
  incomeSources: {
    id: string;
    name: string;
    amount: number;
    bankAccountId: string;
  }[];
}

export interface ComplexityScore {
  score: number;       // 0-100
  grade: string;       // A-F
  color: string;       // hex
  factors: { label: string; value: number; weight: number; weighted: number }[];
}

export interface AccountAnalysis {
  accountId: string;
  name: string;
  institution: string;
  type: 'checking' | 'savings' | 'investment';
  balance: number;
  txnCount: number;
  monthlyAvgTxns: number;
  lastActivity: string | null;
  annualFees: number;
  feeTransactions: number;
  billsAssigned: number;
  incomeSourcesCount: number;
  csvSupport: boolean;
  isDormant: boolean;
}

export interface ConsolidationRecommendation {
  id: string;
  emoji: string;
  action: string;
  reason: string;
  annualSavings: number;
  impact: string;
}

export interface ConsolidationInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  emoji: string;
}

export interface WhatIfReduction {
  currentAccounts: number;
  currentInstitutions: number;
  recommendedAccounts: number;
  recommendedInstitutions: number;
  annualFeeSavings: number;
}

export interface ConsolidationResult {
  complexity: ComplexityScore;
  accounts: AccountAnalysis[];
  recommendations: ConsolidationRecommendation[];
  insights: ConsolidationInsight[];
  whatIf: WhatIfReduction;
  institutions: InstitutionScorecard[];
}

export interface InstitutionScorecard {
  name: string;
  accountCount: number;
  totalBalance: number;
  csvSupport: boolean;
  totalAnnualFees: number;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function analyzeConsolidation(input: ConsolidationInput): ConsolidationResult {
  const { bankAccounts, bankTransactions, obligations, debts, incomeSources } = input;

  const accounts = bankAccounts.map(a =>
    analyzeAccountActivity(a, bankTransactions, obligations, debts, incomeSources),
  );

  const complexity = computeComplexityScore(accounts, bankAccounts, obligations, debts, incomeSources);
  const recommendations = generateRecommendations(accounts, bankAccounts, obligations, incomeSources);
  const insights = generateInsights(accounts, bankAccounts, bankTransactions, obligations, incomeSources);
  const institutions = buildInstitutionScorecards(accounts);
  const whatIf = computeWhatIf(accounts, institutions, recommendations);

  return { complexity, accounts, recommendations, insights, whatIf, institutions };
}

// ─── Analyzers ───────────────────────────────────────────────────────────────

function analyzeAccountActivity(
  account: ConsolidationInput['bankAccounts'][0],
  transactions: ConsolidationInput['bankTransactions'],
  obligations: ConsolidationInput['obligations'],
  debts: ConsolidationInput['debts'],
  incomeSources: ConsolidationInput['incomeSources'],
): AccountAnalysis {
  const txns = transactions.filter(t => t.bankAccountId === account.id);
  const lastTxn = txns.length > 0
    ? txns.reduce((latest, t) => t.date > latest ? t.date : latest, txns[0].date)
    : null;

  // Monthly average: span of months with at least 1 txn
  const months = new Set(txns.map(t => t.date.slice(0, 7)));
  const monthCount = Math.max(months.size, 1);
  const monthlyAvg = txns.length / monthCount;

  // Detect fees
  const { annualFees, feeCount } = detectFees(txns);

  // Bills/debts assigned to this account
  const billsAssigned =
    obligations.filter(o => o.bankAccountId === account.id).length +
    debts.filter(d => d.bankAccountId === account.id).length;

  // Income sources depositing here
  const incomeSourcesCount = incomeSources.filter(s => s.bankAccountId === account.id).length;

  // Dormant: < 3 txns/mo average
  const isDormant = monthlyAvg < 3 && txns.length > 0;

  return {
    accountId: account.id,
    name: account.name,
    institution: account.institution,
    type: account.type,
    balance: account.currentBalance,
    txnCount: txns.length,
    monthlyAvgTxns: Math.round(monthlyAvg * 10) / 10,
    lastActivity: lastTxn,
    annualFees,
    feeTransactions: feeCount,
    billsAssigned,
    incomeSourcesCount,
    csvSupport: institutionHasCsvSupport(account.institution),
    isDormant,
  };
}

function detectFees(transactions: ConsolidationInput['bankTransactions']): {
  annualFees: number;
  feeCount: number;
} {
  const FEE_KEYWORDS = ['fee', 'charge', 'maintenance', 'overdraft', 'atm', 'service charge', 'monthly fee'];
  const feeTxns = transactions.filter(t => {
    if (t.category === 'financial_fees') return true;
    const desc = t.description.toLowerCase();
    return FEE_KEYWORDS.some(kw => desc.includes(kw));
  });

  const totalFees = feeTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Project annual: figure out how many months the data spans
  const months = new Set(transactions.map(t => t.date.slice(0, 7)));
  const monthSpan = Math.max(months.size, 1);
  const annualFees = (totalFees / monthSpan) * 12;

  return { annualFees: Math.round(annualFees * 100) / 100, feeCount: feeTxns.length };
}

function institutionHasCsvSupport(institution: string): boolean {
  const KNOWN_CSV_BANKS = [
    'chase', 'bank of america', 'boa', 'wells fargo', 'capital one',
    'sofi', 'discover', 'ally', 'citi', 'citibank', 'usaa',
    'fidelity', 'schwab', 'charles schwab', 'mercury', 'american express',
    'amex', 'td bank', 'pnc', 'us bank',
  ];
  const lower = institution.toLowerCase().trim();
  return KNOWN_CSV_BANKS.some(b => lower.includes(b));
}

function computeComplexityScore(
  accounts: AccountAnalysis[],
  bankAccounts: ConsolidationInput['bankAccounts'],
  obligations: ConsolidationInput['obligations'],
  debts: ConsolidationInput['debts'],
  incomeSources: ConsolidationInput['incomeSources'],
): ComplexityScore {
  const institutions = new Set(bankAccounts.map(a => a.institution.toLowerCase().trim()));

  // Bill spread: how many different accounts have bills assigned
  const billAccounts = new Set([
    ...obligations.filter(o => o.bankAccountId).map(o => o.bankAccountId),
    ...debts.filter(d => d.bankAccountId).map(d => d.bankAccountId),
  ]);

  // Income split: how many accounts receive income
  const incomeAccounts = new Set(incomeSources.map(s => s.bankAccountId));

  const dormantCount = accounts.filter(a => a.isDormant).length;
  const totalAnnualFees = accounts.reduce((s, a) => s + a.annualFees, 0);

  // Normalize each factor to 0-10 scale
  const accountFactor = Math.min(bankAccounts.length / 8, 1) * 10;         // 8+ accounts = max
  const institutionFactor = Math.min(institutions.size / 5, 1) * 10;       // 5+ institutions = max
  const billSpreadFactor = Math.min(billAccounts.size / 4, 1) * 10;        // 4+ accounts = max
  const incomeSplitFactor = Math.min(incomeAccounts.size / 3, 1) * 10;     // 3+ accounts = max
  const dormantFactor = Math.min(dormantCount / 3, 1) * 10;               // 3+ dormant = max
  const feeFactor = Math.min(totalAnnualFees / 200, 1) * 10;              // $200+/yr = max

  const factors = [
    { label: 'Accounts', value: bankAccounts.length, weight: 25, weighted: accountFactor * 2.5 },
    { label: 'Institutions', value: institutions.size, weight: 20, weighted: institutionFactor * 2.0 },
    { label: 'Bill Spread', value: billAccounts.size, weight: 20, weighted: billSpreadFactor * 2.0 },
    { label: 'Income Split', value: incomeAccounts.size, weight: 15, weighted: incomeSplitFactor * 1.5 },
    { label: 'Dormant Accts', value: dormantCount, weight: 10, weighted: dormantFactor * 1.0 },
    { label: 'Annual Fees', value: Math.round(totalAnnualFees), weight: 10, weighted: feeFactor * 1.0 },
  ];

  const score = Math.round(factors.reduce((s, f) => s + f.weighted, 0));
  const clamped = Math.min(Math.max(score, 0), 100);

  let grade: string;
  let color: string;
  if (clamped <= 20) { grade = 'A'; color = '#4ade80'; }
  else if (clamped <= 40) { grade = 'B'; color = '#86efac'; }
  else if (clamped <= 55) { grade = 'C'; color = '#fbbf24'; }
  else if (clamped <= 70) { grade = 'D'; color = '#fb923c'; }
  else { grade = 'F'; color = '#f87171'; }

  return { score: clamped, grade, color, factors };
}

function generateRecommendations(
  accounts: AccountAnalysis[],
  bankAccounts: ConsolidationInput['bankAccounts'],
  obligations: ConsolidationInput['obligations'],
  incomeSources: ConsolidationInput['incomeSources'],
): ConsolidationRecommendation[] {
  const recs: ConsolidationRecommendation[] = [];
  let recId = 0;

  // 1. Close dormant accounts with no bills/income
  for (const a of accounts) {
    if (a.isDormant && a.billsAssigned === 0 && a.incomeSourcesCount === 0 && a.balance < 100) {
      recs.push({
        id: `rec-${recId++}`,
        emoji: '🗑️',
        action: `Close ${a.name}`,
        reason: `Dormant (${a.monthlyAvgTxns} txns/mo avg), no bills or income assigned, $${a.balance.toFixed(0)} balance.`,
        annualSavings: a.annualFees,
        impact: a.annualFees > 0
          ? `Save $${a.annualFees.toFixed(0)}/yr in fees`
          : 'Reduce complexity',
      });
    }
  }

  // 2. Merge same-institution accounts (checking+checking at same bank)
  const byInstitution = new Map<string, AccountAnalysis[]>();
  for (const a of accounts) {
    const key = a.institution.toLowerCase().trim();
    if (!byInstitution.has(key)) byInstitution.set(key, []);
    byInstitution.get(key)!.push(a);
  }

  for (const [inst, instAccounts] of byInstitution) {
    const checkings = instAccounts.filter(a => a.type === 'checking');
    if (checkings.length >= 2) {
      const primary = checkings.reduce((a, b) => a.txnCount > b.txnCount ? a : b);
      for (const acct of checkings) {
        if (acct.accountId === primary.accountId) continue;
        recs.push({
          id: `rec-${recId++}`,
          emoji: '🔀',
          action: `Merge ${acct.name} → ${primary.name}`,
          reason: `Both checking accounts at ${acct.institution}. ${acct.name} has less activity.`,
          annualSavings: acct.annualFees,
          impact: 'Simplify accounts at same institution',
        });
      }
    }
  }

  // 3. Consolidate bills to primary account
  const billAccounts = new Set([
    ...obligations.filter(o => o.bankAccountId).map(o => o.bankAccountId!),
  ]);
  if (billAccounts.size >= 3) {
    const primaryAccount = bankAccounts.find(a => a.isPrimaryIncome)
      || bankAccounts.reduce((a, b) => {
        const aTxns = accounts.find(x => x.accountId === a.id)?.txnCount || 0;
        const bTxns = accounts.find(x => x.accountId === b.id)?.txnCount || 0;
        return aTxns > bTxns ? a : b;
      });
    if (primaryAccount) {
      recs.push({
        id: `rec-${recId++}`,
        emoji: '📋',
        action: `Move bills to ${primaryAccount.name}`,
        reason: `Bills are spread across ${billAccounts.size} accounts. Consolidating simplifies tracking.`,
        annualSavings: 0,
        impact: `Reduce bill-pay from ${billAccounts.size} accounts to 1`,
      });
    }
  }

  // 4. Rebalance checking → savings at same institution
  for (const [inst, instAccounts] of byInstitution) {
    const checking = instAccounts.find(a => a.type === 'checking');
    const savings = instAccounts.find(a => a.type === 'savings');
    if (checking && savings && checking.balance > 5000) {
      const excess = checking.balance - 2000; // keep $2K buffer
      if (excess > 1000) {
        recs.push({
          id: `rec-${recId++}`,
          emoji: '💰',
          action: `Move $${excess.toFixed(0)} from ${checking.name} to ${savings.name}`,
          reason: `$${checking.balance.toFixed(0)} sitting in checking at ${checking.institution}. Savings earns interest.`,
          annualSavings: 0,
          impact: `Earn interest on $${excess.toFixed(0)}`,
        });
      }
    }
  }

  // 5. Income consolidation
  const incomeAccounts = new Set(incomeSources.map(s => s.bankAccountId));
  if (incomeAccounts.size >= 3) {
    recs.push({
      id: `rec-${recId++}`,
      emoji: '🎯',
      action: 'Consolidate income to 1 account',
      reason: `Income is split across ${incomeAccounts.size} accounts, making cash flow tracking harder.`,
      annualSavings: 0,
      impact: `Simplify income tracking from ${incomeAccounts.size} to 1-2 accounts`,
    });
  }

  return recs.slice(0, 5); // Top 5
}

function generateInsights(
  accounts: AccountAnalysis[],
  bankAccounts: ConsolidationInput['bankAccounts'],
  transactions: ConsolidationInput['bankTransactions'],
  obligations: ConsolidationInput['obligations'],
  incomeSources: ConsolidationInput['incomeSources'],
): ConsolidationInsight[] {
  const insights: ConsolidationInsight[] = [];
  let insId = 0;

  const institutions = new Set(bankAccounts.map(a => a.institution.toLowerCase().trim()));
  const totalFees = accounts.reduce((s, a) => s + a.annualFees, 0);
  const dormantCount = accounts.filter(a => a.isDormant).length;
  const noCSV = accounts.filter(a => !a.csvSupport);

  // High fees
  if (totalFees > 100) {
    insights.push({
      id: `ci-${insId++}`,
      severity: totalFees > 300 ? 'critical' : 'warning',
      title: `$${totalFees.toFixed(0)}/yr in bank fees`,
      message: `You're paying ~$${(totalFees / 12).toFixed(0)}/mo in fees across ${accounts.filter(a => a.annualFees > 0).length} account(s). Consider switching to fee-free options.`,
      emoji: '💸',
    });
  }

  // Many institutions
  if (institutions.size >= 4) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'warning',
      title: `${institutions.size} different institutions`,
      message: `Managing accounts across ${institutions.size} banks means ${institutions.size} logins, ${institutions.size} apps, and fragmented visibility.`,
      emoji: '🏦',
    });
  }

  // Dormant accounts
  if (dormantCount >= 2) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'tip',
      title: `${dormantCount} dormant accounts`,
      message: `${dormantCount} account(s) have fewer than 3 transactions/month. Dormant accounts still carry risk and complexity.`,
      emoji: '😴',
    });
  } else if (dormantCount === 1) {
    const dormant = accounts.find(a => a.isDormant)!;
    insights.push({
      id: `ci-${insId++}`,
      severity: 'tip',
      title: `${dormant.name} is dormant`,
      message: `Only ${dormant.monthlyAvgTxns} txns/month. Consider closing or consolidating.`,
      emoji: '😴',
    });
  }

  // No CSV support
  if (noCSV.length > 0 && noCSV.length < accounts.length) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'tip',
      title: `${noCSV.length} account(s) without CSV support`,
      message: `${noCSV.map(a => a.name).join(', ')} — no recognized CSV export. Consider banks with easy CSV/OFX export for better tracking.`,
      emoji: '📄',
    });
  }

  // Good news: low complexity
  if (bankAccounts.length <= 3 && institutions.size <= 2 && totalFees < 50) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'positive',
      title: 'Accounts are well-organized',
      message: `${bankAccounts.length} account(s) across ${institutions.size} institution(s) with minimal fees. Your setup is efficient.`,
      emoji: '✅',
    });
  }

  // Income routing insight
  const incomeAccounts = new Set(incomeSources.map(s => s.bankAccountId));
  if (incomeAccounts.size >= 2) {
    insights.push({
      id: `ci-${insId++}`,
      severity: incomeAccounts.size >= 3 ? 'warning' : 'tip',
      title: `Income across ${incomeAccounts.size} accounts`,
      message: `Deposits land in ${incomeAccounts.size} different accounts. Routing to 1-2 accounts simplifies cash flow.`,
      emoji: '💵',
    });
  }

  // Bill spread
  const billAccounts = new Set(obligations.filter(o => o.bankAccountId).map(o => o.bankAccountId!));
  if (billAccounts.size >= 3) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'warning',
      title: `Bills paid from ${billAccounts.size} accounts`,
      message: `Obligations are spread across ${billAccounts.size} accounts. Consolidating bill-pay reduces missed payment risk.`,
      emoji: '📬',
    });
  }

  // Transactions but no CSV
  if (transactions.length === 0 && bankAccounts.length > 0) {
    insights.push({
      id: `ci-${insId++}`,
      severity: 'tip',
      title: 'No transaction data yet',
      message: 'Import CSV statements to get activity analysis, fee detection, and better recommendations.',
      emoji: '📥',
    });
  }

  return insights;
}

function buildInstitutionScorecards(accounts: AccountAnalysis[]): InstitutionScorecard[] {
  const map = new Map<string, InstitutionScorecard>();

  for (const a of accounts) {
    const key = a.institution.toLowerCase().trim();
    const existing = map.get(key);
    if (existing) {
      existing.accountCount++;
      existing.totalBalance += a.balance;
      existing.totalAnnualFees += a.annualFees;
      if (!existing.csvSupport && a.csvSupport) existing.csvSupport = true;
    } else {
      map.set(key, {
        name: a.institution,
        accountCount: 1,
        totalBalance: a.balance,
        csvSupport: a.csvSupport,
        totalAnnualFees: a.annualFees,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.totalBalance - a.totalBalance);
}

function computeWhatIf(
  accounts: AccountAnalysis[],
  institutions: InstitutionScorecard[],
  recommendations: ConsolidationRecommendation[],
): WhatIfReduction {
  const closeable = recommendations.filter(r => r.action.startsWith('Close ')).length;
  const mergeable = recommendations.filter(r => r.action.startsWith('Merge ')).length;
  const feeSavings = recommendations.reduce((s, r) => s + r.annualSavings, 0);

  const recommendedAccounts = Math.max(accounts.length - closeable - mergeable, 1);

  // Estimate institution reduction
  const instRemovable = institutions.filter(i =>
    i.accountCount === 1 &&
    accounts.some(a =>
      a.institution.toLowerCase().trim() === i.name.toLowerCase().trim() &&
      a.isDormant && a.billsAssigned === 0 && a.incomeSourcesCount === 0,
    ),
  ).length;

  return {
    currentAccounts: accounts.length,
    currentInstitutions: institutions.length,
    recommendedAccounts,
    recommendedInstitutions: Math.max(institutions.length - instRemovable, 1),
    annualFeeSavings: Math.round(feeSavings * 100) / 100,
  };
}
