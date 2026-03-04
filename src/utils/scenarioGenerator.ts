// src/utils/scenarioGenerator.ts
import type { Asset, IncomeSource, Obligation, Debt, RealEstateAsset, WhatIfScenario, InvestmentThesis, DriftTrade } from '../types';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup } from '../types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } from '../types/bankTransactionTypes';
import { detectRecurring } from './csvBankImport';
import type { Goal } from '../services/goals';

interface UserProfile {
  assets: Asset[];
  incomeSources: IncomeSource[];
  obligations: Obligation[];
  debts: Debt[];
  bankTransactions?: BankTransaction[];
  investmentTheses?: InvestmentThesis[];
  driftTrades?: DriftTrade[];
  goals?: Goal[];
  driftRates?: Record<string, { depositApy: number; borrowApy: number }>;
}

export function generateSmartScenarios(profile: UserProfile): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];

  const { assets, incomeSources, obligations, debts, bankTransactions, investmentTheses } = profile;

  // Calculate current state
  const currentMonthlyIncome = calculateMonthlyIncome(assets, incomeSources);
  const currentMonthlyNeeds = calculateMonthlyNeeds(obligations, debts);
  const currentFreedom = currentMonthlyNeeds > 0
    ? (currentMonthlyIncome / currentMonthlyNeeds)
    : 0;

  // 1. IDLE CASH → Dividend Stocks
  const cashScenario = generateInvestCashScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (cashScenario) scenarios.push(cashScenario);

  // 2. IDLE CRYPTO → Staking (only if no thesis set)
  const cryptoScenario = generateStakeCryptoScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    investmentTheses || []
  );
  if (cryptoScenario) scenarios.push(cryptoScenario);

  // 3. REAL ESTATE → Rental Income
  const realEstateScenario = generateRealEstateScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (realEstateScenario) scenarios.push(realEstateScenario);

  // 4. BROKERAGE → Higher Yield
  const brokerageScenario = generateBrokerageYieldScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (brokerageScenario) scenarios.push(brokerageScenario);

  // 5. (Removed — expense cuts aren't actionable from the app.
  //     Spending data is surfaced in bank detail screens instead.)

  // 6. DEBT PAYOFF (Avalanche)
  const debtPayoffScenario = generateDebtPayoffScenario(
    debts,
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (debtPayoffScenario) scenarios.push(debtPayoffScenario);

  // 7. DEBT REFINANCE
  const debtRefiScenario = generateDebtRefinanceScenario(
    debts,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (debtRefiScenario) scenarios.push(debtRefiScenario);

  // 8. TAX OPTIMIZATION (401k / IRA)
  const taxScenario = generateTaxOptimizationScenario(
    incomeSources,
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (taxScenario) scenarios.push(taxScenario);

  // 9. PERENA STABLECOIN YIELD
  const perenaScenario = generatePerenaYieldScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    obligations,
    debts
  );
  if (perenaScenario) scenarios.push(perenaScenario);

  // 10. HIGH-YIELD SAVINGS ACCOUNT
  const hysaScenario = generateHYSAScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (hysaScenario) scenarios.push(hysaScenario);

  // 11. DRIFT IDLE USDC → Yield
  const driftYieldScenario = generateDriftYieldScenario(
    profile.driftTrades || [],
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    profile.goals || [],
    profile.driftRates || {}
  );
  if (driftYieldScenario) scenarios.push(driftYieldScenario);

  // Sort by impact (biggest freedom gain first)
  scenarios.sort((a, b) => b.impact.freedomDelta - a.impact.freedomDelta);

  // Return top 5
  return scenarios.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// Scenario Generators
// ═══════════════════════════════════════════════════════════════

function generateInvestCashScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find cash/savings with low yield
  const cashAssets = assets.filter(a =>
    a.type === 'bank_account' &&
    ((a.metadata as any)?.accountType === 'savings' ||
      (a.metadata as any)?.accountType === 'checking')
  );

  const totalCash = cashAssets.reduce((sum, a) => sum + a.value, 0);

  // Need at least $5K to invest
  if (totalCash < 5000) return null;

  // Keep 3 months of expenses as buffer (or $2K, whichever is higher)
  const emergencyFund = Math.max(2000, monthlyNeeds * 3);
  const investable = Math.max(0, totalCash - emergencyFund);
  const investAmount = Math.floor(investable * 0.7);

  if (investAmount < 1000) return null;

  // Assume 3.5% dividend yield (conservative S&P dividend)
  const annualIncome = investAmount * 0.035;
  const monthlyIncome = annualIncome / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncome;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  const accountNames = cashAssets.map(a => `${a.name} ($${Math.round(a.value).toLocaleString()})`).join(', ');

  return {
    id: 'invest_cash',
    type: 'invest_cash',
    title: `Invest $${investAmount.toLocaleString()} from bank into dividend stocks`,
    description: `Transfer from ${accountNames} into S&P 500 dividend ETF (SCHD or VYM)`,
    emoji: '📈',
    difficulty: 'easy',
    timeframe: 'This week',

    changes: {
      addAssets: [{
        name: 'Dividend Stock ETF',
        type: 'stocks',
        value: investAmount,
        annualIncome: annualIncome,
        isLiquid: true,
        metadata: {
          type: 'stocks',
          ticker: 'SCHD',
          shares: Math.floor(investAmount / 30), // Approx $30/share
          currentPrice: 30,
          dividendYield: 3.5,
          apy: 3.5,
          description: 'Schwab US Dividend Equity ETF',
        }
      }],
      updateAssets: cashAssets.map(a => ({
        id: a.id,
        updates: {
          value: a.value - (investAmount * (a.value / totalCash))
        }
      }))
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncome,
      annualIncomeDelta: annualIncome,
      investmentRequired: investAmount,
      roi: 3.5,
    },

    reasoning: `You have $${totalCash.toLocaleString()} across ${cashAssets.length} bank account${cashAssets.length > 1 ? 's' : ''} (${accountNames}). After keeping $${emergencyFund.toLocaleString()} as a 3-month expense buffer, investing $${investAmount.toLocaleString()} in dividend stocks earns $${monthlyIncome.toFixed(0)}/month in passive income.`,

    risks: [
      'Stock prices fluctuate - value may go down',
      'Dividends can be reduced (rare for established companies)',
      'Takes 3-6 months to build up dividend stream',
    ],

    steps: [
      'Open brokerage account (Fidelity, Schwab, or Vanguard)',
      `Transfer $${investAmount.toLocaleString()} from ${cashAssets[0]?.name || 'bank'}`,
      'Buy SCHD or VYM (dividend-focused ETFs)',
      'Set dividends to auto-reinvest',
    ],
  };
}

// Tokens with known staking/yield options on Solana
const STAKEABLE_SYMBOLS = new Set([
  'SOL', 'MSOL', 'JITOSOL', 'BSOL', 'JSOL',  // SOL liquid staking
  'USDC', 'USDT', 'DAI', 'PYUSD',              // Stablecoin lending
  'JUP', 'RAY', 'ORCA', 'MNDE', 'HNT',         // Protocol staking
  'ETH', 'WETH', 'STETH',                        // ETH staking
]);

function generateStakeCryptoScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  investmentTheses: InvestmentThesis[]
): WhatIfScenario | null {
  // Build set of asset IDs that have an investment thesis
  const assetsWithThesis = new Set(investmentTheses.map(t => t.assetId));

  // Only suggest staking for tokens that actually have known yield options
  // Exclude Drift collateral — handled by the Drift yield scenario
  const cryptoAssets = assets.filter(a => {
    if (a.type !== 'crypto') return false;
    if ((a.metadata as any)?.apy >= 3) return false; // Already earning yield
    if ((a.metadata as any)?.protocol?.toLowerCase() === 'drift') return false;
    if (a.value < 500) return false;
    if (assetsWithThesis.has(a.id)) return false; // Has thesis
    const symbol = ((a.metadata as any)?.symbol || '').toUpperCase();
    return STAKEABLE_SYMBOLS.has(symbol);
  });

  if (cryptoAssets.length === 0) return null;

  const totalIdleCrypto = cryptoAssets.reduce((sum, a) => sum + a.value, 0);

  // Assume we can stake 80% (keep 20% liquid)
  const stakeAmount = totalIdleCrypto * 0.8;

  // Assume 8% APY for stablecoins (Drift, Kamino, etc.)
  const targetAPY = 8;
  const currentAPY = cryptoAssets.reduce((sum, a) =>
    sum + (a.annualIncome || 0), 0
  );

  const newAnnualIncome = stakeAmount * (targetAPY / 100);
  const annualIncomeDelta = newAnnualIncome - currentAPY;
  const monthlyIncomeDelta = annualIncomeDelta / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  return {
    id: 'stake_crypto',
    type: 'stake_crypto',
    title: `Stake $${Math.round(stakeAmount).toLocaleString()} in ${cryptoAssets.map(a => (a.metadata as any)?.symbol || a.name).join(', ')} for ${targetAPY}% APY`,
    description: `Move idle ${cryptoAssets.map(a => `${(a.metadata as any)?.symbol || a.name} ($${Math.round(a.value).toLocaleString()})`).join(', ')} to yield protocols`,
    emoji: '⛓️',
    difficulty: 'medium',
    timeframe: 'This week',

    changes: {
      updateAssets: cryptoAssets.map(a => ({
        id: a.id,
        updates: {
          annualIncome: (a.value * 0.8 * targetAPY) / 100,
          metadata: {
            ...(a.metadata as any),
            apy: targetAPY,
            protocol: 'Drift',
          }
        }
      }))
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncomeDelta,
      annualIncomeDelta: annualIncomeDelta,
      investmentRequired: 0,
      roi: targetAPY,
    },

    reasoning: `You have ${cryptoAssets.map(a => `$${Math.round(a.value).toLocaleString()} in ${(a.metadata as any)?.symbol || a.name}`).join(', ')} sitting in your wallet earning no yield. Staking these at ${targetAPY}% APY adds $${monthlyIncomeDelta.toFixed(0)}/mo in passive income.`,

    risks: [
      'Smart contract risk (protocol hacks)',
      'Impermanent loss if using liquidity pools',
      'APY can fluctuate with market conditions',
    ],

    steps: [
      'Connect wallet to Drift.trade or Kamino Finance',
      'Deposit stablecoins (USDC preferred)',
      'Enable lending/staking',
      'Monitor positions weekly',
    ],
  };
}

function generateRealEstateScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {


  const realEstateAssets = assets.filter((a) => {
    if (a.type !== 'real_estate') return false;
    if (a.annualIncome > 0) return false; // Already generating income

    // Skip primary residence
    const metadata = a.metadata as RealEstateAsset;
    if (metadata?.isPrimaryResidence) return false;

    return true;
  });

  if (realEstateAssets.length === 0) return null;

  const property = realEstateAssets[0];

  // Assume 5% net rental yield (conservative)
  const netYield = 0.05;
  const annualIncome = property.value * netYield;
  const monthlyIncome = annualIncome / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncome;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  return {
    id: 'rent_real_estate',
    type: 'buy_real_estate',
    title: `Rent out ${property.name}`,
    description: `Generate 5% net rental income from existing property`,
    emoji: '🏠',
    difficulty: 'medium',
    timeframe: 'This month',

    changes: {
      updateAssets: [{
        id: property.id,
        updates: {
          annualIncome: annualIncome,
          metadata: {
            ...(property.metadata as any),
            monthlyRentalIncome: monthlyIncome,
            monthlyExpenses: monthlyIncome * 0.3, // 30% for expenses
          }
        }
      }]
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncome,
      annualIncomeDelta: annualIncome,
      investmentRequired: 0,
      roi: netYield * 100,
    },

    reasoning: `Your $${property.value.toLocaleString()} property is currently generating $0 income. By renting it out at market rates (typically 5-8% gross yield), you could earn $${monthlyIncome.toFixed(0)}/month after expenses.`,

    risks: [
      'Tenant issues (damage, non-payment)',
      'Vacancy periods between tenants',
      'Maintenance and repair costs',
      'Property management fees (if using)',
    ],

    steps: [
      'Get property market analysis from local realtor',
      'Make any needed repairs/improvements',
      'List on Zillow, Apartments.com, or use property manager',
      'Screen tenants carefully',
      'Set up lease and collect first/last/deposit',
    ],
  };
}

function generateBrokerageYieldScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find brokerage assets with low yield
  const brokerageAssets = assets.filter(a => {
    if (a.type !== 'stocks') return false;
    if (a.value <= 5000) return false;
    if (a.annualIncome >= (a.value * 0.02)) return false; // Already 2%+ yield

    // Exclude stocks with all shares unvested
    const stockMeta = a.metadata as any;
    if (stockMeta?.unvestedShares) {
      // If has unvested shares, must have at least some vested shares
      if (!stockMeta?.vestedShares || stockMeta.vestedShares === 0) {
        return false; // All shares are locked
      }
    }

    return true;
  });

  if (brokerageAssets.length === 0) return null;

  const totalBrokerage = brokerageAssets.reduce((sum, a) => sum + a.value, 0);
  const currentIncome = brokerageAssets.reduce((sum, a) => sum + a.annualIncome, 0);

  // Target 4% dividend yield
  const targetYield = 0.04;
  const newAnnualIncome = totalBrokerage * targetYield;
  const annualIncomeDelta = newAnnualIncome - currentIncome;
  const monthlyIncomeDelta = annualIncomeDelta / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  return {
    id: 'increase_dividend_yield',
    type: 'increase_yield',
    title: `Switch to high-dividend stocks`,
    description: `Reposition $${totalBrokerage.toLocaleString()} into dividend aristocrats`,
    emoji: '💰',
    difficulty: 'easy',
    timeframe: 'This week',

    changes: {
      updateAssets: brokerageAssets.map(a => ({
        id: a.id,
        updates: {
          annualIncome: a.value * targetYield,
          metadata: {
            ...(a.metadata as any),
            dividendYield: targetYield * 100,
          }
        }
      }))
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncomeDelta,
      annualIncomeDelta: annualIncomeDelta,
      investmentRequired: 0,
      roi: targetYield * 100,
    },

    reasoning: `Your brokerage account of $${totalBrokerage.toLocaleString()} is earning only ${((currentIncome / totalBrokerage) * 100).toFixed(1)}% yield. By switching to dividend-focused investments, you can earn 4%+ ($${annualIncomeDelta.toFixed(0)}/year more) without reducing growth potential.`,

    risks: [
      'May sacrifice some growth for income',
      'Dividends are taxable',
      'Need to sell current positions (may trigger capital gains)',
    ],

    steps: [
      'Review current holdings for tax implications',
      'Sell low-yield/no-dividend stocks',
      'Buy dividend aristocrats (JNJ, KO, PG, etc.)',
      'Or use dividend ETFs (SCHD, VYM, DVY)',
    ],
  };
}

function generateReduceExpensesScenario(
  obligations: Obligation[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  bankTransactions: BankTransaction[]
): WhatIfScenario | null {

  // ── Analyze real spending data if available ──
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 7);
  const recentTransactions = bankTransactions.filter(
    t => t.type === 'expense' && t.date >= threeMonthsAgo
  );

  // If we have transaction data, generate specific actionable cuts
  if (recentTransactions.length >= 10) {
    return generateDataDrivenExpenseScenario(
      obligations, recentTransactions, currentMonthlyIncome, currentFreedom, monthlyNeeds
    );
  }

  // ── Fallback: obligation-based (less specific) ──
  const discretionary = obligations.filter(o =>
    o.category !== 'housing' &&
    o.category !== 'utilities' &&
    o.amount > 50
  );
  if (discretionary.length === 0) return null;

  const totalDiscretionary = discretionary.reduce((sum, o) => sum + o.amount, 0);
  const reduction = totalDiscretionary * 0.2;
  const newMonthlyNeeds = monthlyNeeds - reduction;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;
  // If savings deployed to USD*
  const savedToYield = (reduction * 12 * 9.34 / 100) / 12;
  const effectiveIncome = currentMonthlyIncome + savedToYield;
  const effectiveFreedom = newMonthlyNeeds > 0 ? (effectiveIncome / newMonthlyNeeds) : 0;

  return {
    id: 'reduce_expenses',
    type: 'reduce_expenses',
    title: `Cut $${reduction.toFixed(0)}/mo in expenses`,
    description: `Import bank/credit card transactions for specific recommendations`,
    emoji: '✂️',
    difficulty: 'medium',
    timeframe: 'This month',
    changes: {
      reduceObligations: discretionary.map(o => ({
        id: o.id,
        newAmount: o.amount * 0.8,
      }))
    },
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: effectiveFreedom,
      freedomDelta: effectiveFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: effectiveIncome,
      monthlyIncomeDelta: savedToYield,
      annualIncomeDelta: savedToYield * 12,
      investmentRequired: 0,
    },
    reasoning: `You have $${totalDiscretionary.toFixed(0)}/mo in discretionary obligations. Import your bank and credit card statements for specific, data-driven cut recommendations.`,
    risks: [
      'Requires discipline and lifestyle changes',
      'May feel restrictive initially',
      'Import transactions for more specific advice',
    ],
    steps: [
      'Go to your bank/credit card detail screen',
      'Import CSV statements for the last 3 months',
      'Come back here for personalized cut recommendations',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Data-Driven Expense Analysis
// ═══════════════════════════════════════════════════════════════

interface SpendingInsight {
  category: string;
  emoji: string;
  label: string;
  monthlyAvg: number;
  suggestedCut: number;
  cutPercentage: number;
  topMerchants: Array<{ name: string; total: number; count: number }>;
  actionItem: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

function generateDataDrivenExpenseScenario(
  obligations: Obligation[],
  recentTransactions: BankTransaction[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {

  // ── Calculate months spanned ──
  const dates = recentTransactions.map(t => t.date).sort();
  const earliest = new Date(dates[0] + 'T12:00:00');
  const latest = new Date(dates[dates.length - 1] + 'T12:00:00');
  const monthsSpanned = Math.max(1,
    (latest.getFullYear() - earliest.getFullYear()) * 12 + (latest.getMonth() - earliest.getMonth()) + 1
  );

  // ── Group by spending group ──
  // Exclude non-discretionary groups: financial (CC payments), transfers, income
  const EXCLUDED_GROUPS = new Set(['financial', 'income', 'housing']);
  const groupSpending: Record<string, { total: number; txns: BankTransaction[] }> = {};
  for (const t of recentTransactions) {
    const meta = TRANSACTION_CATEGORY_META[t.category];
    const group = meta?.group || 'other';
    if (EXCLUDED_GROUPS.has(group)) continue; // Skip non-discretionary
    if (!groupSpending[group]) groupSpending[group] = { total: 0, txns: [] };
    groupSpending[group].total += t.amount;
    groupSpending[group].txns.push(t);
  }

  // ── Build merchant spending map per group ──
  function topMerchants(txns: BankTransaction[], limit = 5): Array<{ name: string; total: number; count: number }> {
    const merchants: Record<string, { total: number; count: number }> = {};
    for (const t of txns) {
      const key = cleanMerchantName(t.description);
      if (!merchants[key]) merchants[key] = { total: 0, count: 0 };
      merchants[key].total += t.amount;
      merchants[key].count++;
    }
    return Object.entries(merchants)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  // ── Analyze each group for cut potential ──
  const insights: SpendingInsight[] = [];
  // Only count discretionary spending (excludes financial, housing, income, transfers)
  const totalMonthlySpending = Object.values(groupSpending).reduce((s, g) => s + g.total, 0) / monthsSpanned;

  // CUT RULES per category group
  // NOTE: financial, housing, income, transfer are excluded — not discretionary
  const cutRules: Record<string, { percentage: number; difficulty: 'easy' | 'medium' | 'hard'; action: string }> = {
    food: { percentage: 30, difficulty: 'medium', action: 'Meal prep, reduce delivery orders, cook at home more' },
    subscription: { percentage: 50, difficulty: 'easy', action: 'Audit and cancel unused subscriptions' },
    entertainment: { percentage: 40, difficulty: 'easy', action: 'Reduce discretionary entertainment spending' },
    shopping: { percentage: 35, difficulty: 'medium', action: 'Implement 48-hour rule before purchases' },
    personal: { percentage: 25, difficulty: 'medium', action: 'Find cheaper alternatives for personal care' },
    transport: { percentage: 20, difficulty: 'medium', action: 'Carpool, reduce rideshare usage, optimize fuel' },
    medical: { percentage: 10, difficulty: 'hard', action: 'Shop around for prescriptions, use generic brands' },
    utilities: { percentage: 10, difficulty: 'hard', action: 'Reduce usage, switch to cheaper plans' },
    // Excluded: financial (CC payments, fees), housing (rent/mortgage), income, transfer
  };

  for (const [group, data] of Object.entries(groupSpending)) {
    const rule = cutRules[group];
    if (!rule) continue; // Skip housing, other

    const monthlyAvg = data.total / monthsSpanned;
    if (monthlyAvg < 20) continue; // Too small to matter

    const suggestedCut = monthlyAvg * (rule.percentage / 100);
    const merchants = topMerchants(data.txns);
    const gm = TRANSACTION_GROUP_META[group as BankTransactionGroup];

    // Build specific action item from top merchants
    let action = rule.action;
    if (merchants.length > 0) {
      const topNames = merchants.slice(0, 3).map(m => m.name);
      const topTotal = merchants.slice(0, 3).reduce((s, m) => s + m.total, 0) / monthsSpanned;
      action = `Top merchants: ${topNames.join(', ')} (${formatCurrencyShort(topTotal)}/mo). ${rule.action}`;
    }

    insights.push({
      category: group,
      emoji: gm?.emoji || '💸',
      label: gm?.label || group,
      monthlyAvg,
      suggestedCut,
      cutPercentage: rule.percentage,
      topMerchants: merchants,
      actionItem: action,
      difficulty: rule.difficulty,
    });
  }

  // Sort by largest potential savings
  insights.sort((a, b) => b.suggestedCut - a.suggestedCut);

  if (insights.length === 0) return null;

  // ── Detect subscriptions specifically ──
  const recurring = detectRecurring(recentTransactions);
  const subscriptionRecurring = recurring.filter(r => {
    const cat = TRANSACTION_CATEGORY_META[r.category]?.group;
    return cat === 'subscription' || cat === 'entertainment';
  });

  // ── Calculate total savings ──
  const totalSuggestedCut = insights.reduce((s, i) => s + i.suggestedCut, 0);
  const topInsights = insights.slice(0, 5); // Top 5 categories
  const easyCuts = insights.filter(i => i.difficulty === 'easy');
  const easyTotal = easyCuts.reduce((s, i) => s + i.suggestedCut, 0);

  const newMonthlyNeeds = monthlyNeeds - totalSuggestedCut;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  // Show impact as days when delta is < 1 month, and include deployed savings income
  const freedomDelta = newFreedom - currentFreedom;
  const USD_STAR_APY = 9.34;
  // If savings deployed to USD* → how much new monthly income
  const deployedIncomeMonthly = (totalSuggestedCut * 12 * USD_STAR_APY / 100) / 12;
  // Total effective impact: income increase if savings are deployed
  const effectiveNewIncome = currentMonthlyIncome + deployedIncomeMonthly;
  const effectiveFreedom = newMonthlyNeeds > 0 ? (effectiveNewIncome / newMonthlyNeeds) : 0;
  const effectiveDelta = effectiveFreedom - currentFreedom;

  // ── Build specific steps ──
  const steps: string[] = [];
  for (const insight of topInsights) {
    const topM = insight.topMerchants[0];
    if (topM) {
      steps.push(`${insight.emoji} ${insight.label}: Cut ${formatCurrencyShort(insight.suggestedCut)}/mo — ${topM.name} is ${formatCurrencyShort(topM.total / monthsSpanned)}/mo alone`);
    } else {
      steps.push(`${insight.emoji} ${insight.label}: Cut ${formatCurrencyShort(insight.suggestedCut)}/mo (${insight.cutPercentage}% reduction)`);
    }
  }
  if (subscriptionRecurring.length > 0) {
    const subTotal = subscriptionRecurring.reduce((s, r) => s + r.averageAmount, 0);
    steps.push(`🔁 ${subscriptionRecurring.length} recurring subscriptions totaling ${formatCurrencyShort(subTotal)}/mo — audit each one`);
  }

  // ── Build detailed description ──
  const descParts: string[] = [];
  for (const insight of topInsights.slice(0, 3)) {
    descParts.push(`${insight.emoji} ${insight.label}: ${formatCurrencyShort(insight.monthlyAvg)}/mo → cut ${formatCurrencyShort(insight.suggestedCut)}`);
  }

  // ── Build reasoning with real numbers ──
  const reasoningParts: string[] = [
    `Based on ${recentTransactions.length} transactions over ${monthsSpanned} month${monthsSpanned > 1 ? 's' : ''},`,
    `you're spending ${formatCurrencyShort(totalMonthlySpending)}/mo on discretionary categories.`,
  ];

  if (easyCuts.length > 0) {
    reasoningParts.push(`Easy wins alone (${easyCuts.map(c => c.label.toLowerCase()).join(', ')}) could save ${formatCurrencyShort(easyTotal)}/mo.`);
  }

  const biggestCategory = topInsights[0];
  if (biggestCategory) {
    const topM = biggestCategory.topMerchants[0];
    reasoningParts.push(
      `Your biggest cut opportunity is ${biggestCategory.label.toLowerCase()} at ${formatCurrencyShort(biggestCategory.monthlyAvg)}/mo` +
      (topM ? ` — ${topM.name} alone is ${formatCurrencyShort(topM.total / monthsSpanned)}/mo (${topM.count} charges).` : '.')
    );
  }

  // Show the real value: obligations reduction + deployed savings
  reasoningParts.push(
    `Cutting ${formatCurrencyShort(totalSuggestedCut)}/mo drops your obligations from ${formatCurrencyShort(monthlyNeeds)} → ${formatCurrencyShort(newMonthlyNeeds)}/mo.`
  );
  if (deployedIncomeMonthly >= 1) {
    reasoningParts.push(
      `If you deploy the ${formatCurrencyShort(totalSuggestedCut)}/mo savings into USD* at 9.34% APY, that's +${formatCurrencyShort(deployedIncomeMonthly)}/mo in passive income.`
    );
  }

  // ── Build obligation changes ──
  // Match insights back to obligations where possible
  const obligationChanges: Array<{ id: string; newAmount: number }> = [];
  for (const ob of obligations) {
    if (ob.category === 'housing') continue;
    // Crude mapping: if obligation name matches any top merchant
    const obLower = ob.name.toLowerCase();
    for (const insight of insights) {
      const matchedMerchant = insight.topMerchants.find(m =>
        m.name.toLowerCase().includes(obLower) || obLower.includes(m.name.toLowerCase().substring(0, 10))
      );
      if (matchedMerchant) {
        obligationChanges.push({ id: ob.id, newAmount: ob.amount * (1 - insight.cutPercentage / 100) });
        break;
      }
    }
  }

  return {
    id: 'reduce_expenses',
    type: 'reduce_expenses',
    title: `Cut ${formatCurrencyShort(totalSuggestedCut)}/mo in discretionary spending`,
    description: descParts.join('\n'),
    emoji: '✂️',
    difficulty: easyTotal > totalSuggestedCut * 0.4 ? 'easy' : 'medium',
    timeframe: 'This month',

    changes: {
      ...(obligationChanges.length > 0 ? { reduceObligations: obligationChanges } : {}),
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: effectiveFreedom,
      freedomDelta: effectiveDelta,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome + deployedIncomeMonthly,
      monthlyIncomeDelta: deployedIncomeMonthly,
      annualIncomeDelta: deployedIncomeMonthly * 12,
      investmentRequired: 0,
    },

    reasoning: reasoningParts.join(' '),

    risks: [
      `Based on ${recentTransactions.length} real transactions — accuracy depends on import completeness`,
      'Some "cuts" may be one-time purchases that won\'t recur',
      'Easy to backslide without continued tracking',
    ],

    steps,

    // Attach insights for UI to render if desired
    ...(topInsights.length > 0 ? {
      metadata: {
        insights: topInsights,
        totalMonthlySpending,
        monthsAnalyzed: monthsSpanned,
        transactionCount: recentTransactions.length,
        subscriptionCount: subscriptionRecurring.length,
      }
    } : {}),
  } as WhatIfScenario;
}

// ═══════════════════════════════════════════════════════════════
// NEW Scenario Generators
// ═══════════════════════════════════════════════════════════════

function generateDebtPayoffScenario(
  debts: Debt[],
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find active debts sorted by interest rate (avalanche method)
  const activeDebts = debts
    .filter(d => d.isActive && d.interestRate > 0 && d.balance > 0)
    .sort((a, b) => b.interestRate - a.interestRate);

  if (activeDebts.length === 0) return null;

  const highestRateDebt = activeDebts[0];
  const totalDebtPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

  // Find available cash to throw at debt
  const cashAssets = assets.filter(a =>
    a.type === 'bank_account' &&
    ((a.metadata as any)?.accountType === 'savings' ||
      (a.metadata as any)?.accountType === 'checking')
  );
  const totalCash = cashAssets.reduce((sum, a) => sum + a.value, 0);

  // Keep $2K emergency fund, use up to 50% of the rest for debt payoff
  const emergencyFund = 2000;
  const availableForDebt = Math.max(0, (totalCash - emergencyFund) * 0.5);

  // Extra monthly payment: either $500 or 15% of income, whichever is less
  const extraMonthly = Math.min(500, currentMonthlyIncome * 0.15);
  if (extraMonthly < 50) return null;

  // Calculate interest saved by paying off highest-rate debt faster
  const monthsToPayOff = highestRateDebt.balance / (highestRateDebt.minimumPayment + extraMonthly);
  const monthsOriginal = highestRateDebt.balance / highestRateDebt.minimumPayment;
  const monthsSaved = Math.floor(monthsOriginal - monthsToPayOff);

  const monthlyInterestSaved = (highestRateDebt.balance * (highestRateDebt.interestRate / 100)) / 12;
  const annualInterestSaved = monthlyInterestSaved * 12;

  // Once debt is paid off, the minimum payment becomes "freed up" income
  const freedUpPayment = highestRateDebt.minimumPayment;
  const newMonthlyNeeds = monthlyNeeds - freedUpPayment;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'debt_payoff_avalanche',
    type: 'debt_payoff',
    title: `Crush ${highestRateDebt.name} (${highestRateDebt.interestRate}% APR)`,
    description: `Avalanche method: add $${extraMonthly.toFixed(0)}/mo to highest-interest debt`,
    emoji: '🔥',
    difficulty: 'medium',
    timeframe: `${Math.ceil(monthsToPayOff)} months`,

    changes: {
      updateDebts: [{
        id: highestRateDebt.id,
        updates: {
          minimumPayment: highestRateDebt.minimumPayment + extraMonthly,
        }
      }]
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
      monthlySavings: freedUpPayment,
      interestSaved: annualInterestSaved,
    },

    reasoning: `Your ${highestRateDebt.name} at ${highestRateDebt.interestRate}% APR is costing you $${monthlyInterestSaved.toFixed(0)}/mo in interest alone. By adding $${extraMonthly.toFixed(0)}/mo extra, you pay it off ${monthsSaved} months sooner and free up $${freedUpPayment.toFixed(0)}/mo in cash flow.`,

    risks: [
      'Requires consistent extra payments each month',
      'Less cash available for other investments during payoff',
      'Opportunity cost if investment returns exceed debt rate',
    ],

    steps: [
      `Set up auto-pay of $${(highestRateDebt.minimumPayment + extraMonthly).toFixed(0)}/mo on ${highestRateDebt.name}`,
      'Once paid off, roll that payment into the next highest-rate debt',
      'Avoid taking on new debt during payoff period',
      'Consider balance transfer to 0% APR card if available',
    ],
  };
}

function generateDebtRefinanceScenario(
  debts: Debt[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find debts with high interest rates that could be refinanced
  const refinanceable = debts.filter(d =>
    d.isActive &&
    d.balance > 2000 &&
    d.interestRate > 10 // Only suggest refi for 10%+ rates
  );

  if (refinanceable.length === 0) return null;

  const totalBalance = refinanceable.reduce((sum, d) => sum + d.balance, 0);
  const totalCurrentPayments = refinanceable.reduce((sum, d) => sum + d.minimumPayment, 0);
  const weightedRate = refinanceable.reduce((sum, d) =>
    sum + (d.interestRate * (d.balance / totalBalance)), 0
  );

  // Target: consolidate at 7% (personal loan / balance transfer rate)
  const targetRate = 7;
  if (weightedRate <= targetRate + 2) return null; // Not worth it if rate is close

  // Calculate new monthly payment (same term, lower rate)
  const avgRemainingMonths = 36; // Assume 3-year consolidation loan
  const monthlyRate = targetRate / 100 / 12;
  const newMonthlyPayment = totalBalance *
    (monthlyRate * Math.pow(1 + monthlyRate, avgRemainingMonths)) /
    (Math.pow(1 + monthlyRate, avgRemainingMonths) - 1);

  const monthlySavings = totalCurrentPayments - newMonthlyPayment;
  if (monthlySavings < 25) return null;

  const annualSavings = monthlySavings * 12;
  const newMonthlyNeeds = monthlyNeeds - monthlySavings;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'debt_refinance',
    type: 'debt_refinance',
    title: `Refinance $${totalBalance.toLocaleString()} debt from ${weightedRate.toFixed(1)}% → ${targetRate}%`,
    description: `Consolidate high-interest debt into a lower-rate personal loan`,
    emoji: '🔄',
    difficulty: 'medium',
    timeframe: '2-4 weeks',

    changes: {
      removeDebts: refinanceable.map(d => d.id),
      addDebts: [{
        name: 'Consolidated Personal Loan',
        balance: totalBalance,
        interestRate: targetRate,
        minimumPayment: newMonthlyPayment,
        isActive: true,
      }]
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
      monthlySavings: monthlySavings,
    },

    reasoning: `You're paying ${weightedRate.toFixed(1)}% across $${totalBalance.toLocaleString()} in debt. Consolidating at ${targetRate}% saves $${monthlySavings.toFixed(0)}/mo ($${annualSavings.toFixed(0)}/year) and simplifies payments into one bill.`,

    risks: [
      'Requires good credit score (680+) for best rates',
      'Origination fees may apply (1-6% of loan amount)',
      'Longer term means more total interest if not paid early',
      'Temptation to rack up new debt on freed-up credit',
    ],

    steps: [
      'Check credit score (Credit Karma, Experian)',
      'Compare personal loan rates (SoFi, LightStream, Marcus)',
      'Apply for consolidation loan',
      'Use proceeds to pay off high-interest debts',
      'Set up autopay on new loan for rate discount',
    ],
  };
}

function generateTaxOptimizationScenario(
  incomeSources: IncomeSource[],
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Estimate annual salary from income sources
  const salarySource = incomeSources.find(s =>
    s.isActive && (s.type === 'salary' || s.type === 'w2' || s.frequency === 'biweekly')
  );

  if (!salarySource) return null;

  let annualSalary = 0;
  if (salarySource.frequency === 'monthly') annualSalary = salarySource.amount * 12;
  else if (salarySource.frequency === 'biweekly') annualSalary = salarySource.amount * 26;
  else if (salarySource.frequency === 'weekly') annualSalary = salarySource.amount * 52;
  else annualSalary = salarySource.amount;

  if (annualSalary < 40000) return null; // Too low to benefit meaningfully

  // Check if they already have retirement accounts
  const retirementAssets = assets.filter(a =>
    a.name?.toLowerCase().includes('401k') ||
    a.name?.toLowerCase().includes('ira') ||
    a.name?.toLowerCase().includes('roth') ||
    a.name?.toLowerCase().includes('retirement') ||
    (a.metadata as any)?.accountType === 'retirement'
  );

  const currentContributions = retirementAssets.reduce((sum, a) =>
    sum + ((a.metadata as any)?.annualContribution || 0), 0
  );

  // 2025 limits: 401k = $23,500, IRA = $7,000
  const max401k = 23500;
  const maxIRA = 7000;
  const maxTotal = max401k + maxIRA;

  const additionalContribution = Math.min(
    maxTotal - currentContributions,
    annualSalary * 0.15 // Cap at 15% of salary as reasonable
  );

  if (additionalContribution < 1000) return null;

  // Estimate tax bracket (simplified)
  let marginalRate = 0.22; // Default to 22% bracket
  if (annualSalary > 191950) marginalRate = 0.32;
  else if (annualSalary > 100525) marginalRate = 0.24;
  else if (annualSalary > 47150) marginalRate = 0.22;
  else marginalRate = 0.12;

  const annualTaxSavings = additionalContribution * marginalRate;
  const monthlyTaxSavings = annualTaxSavings / 12;
  const monthlyContribution = additionalContribution / 12;

  // Net cost after tax savings
  const netMonthlyCost = monthlyContribution - monthlyTaxSavings;

  // Freedom impact: monthly needs increase by net cost (deferred, not spent)
  const newMonthlyNeeds = monthlyNeeds + netMonthlyCost;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'tax_optimization',
    type: 'tax_optimization',
    title: `Max retirement contributions → save $${annualTaxSavings.toLocaleString()}/yr in taxes`,
    description: `Increase 401(k)/IRA contributions by $${additionalContribution.toLocaleString()}/yr`,
    emoji: '🏦',
    difficulty: 'easy',
    timeframe: 'This pay period',

    changes: {
      addAssets: [{
        name: 'Additional Retirement Contribution',
        type: 'stocks',
        value: 0, // Builds over time
        annualIncome: 0,
        isLiquid: false,
        metadata: {
          type: 'retirement',
          accountType: 'retirement',
          annualContribution: additionalContribution,
          taxBenefit: annualTaxSavings,
          description: '401(k) / Traditional IRA',
        }
      }]
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: additionalContribution,
      annualTaxSavings: annualTaxSavings,
      roi: (annualTaxSavings / additionalContribution) * 100,
    },

    reasoning: `At the ${(marginalRate * 100).toFixed(0)}% tax bracket, every dollar into your 401(k) saves $${marginalRate.toFixed(2)} in taxes immediately. Contributing $${additionalContribution.toLocaleString()}/yr puts $${annualTaxSavings.toLocaleString()} back in your pocket and builds long-term wealth. Your money also grows tax-deferred.`,

    risks: [
      'Funds locked until age 59½ (10% early withdrawal penalty)',
      'Reduces take-home pay in the short term',
      'Traditional contributions taxed on withdrawal in retirement',
      'Contribution limits change annually',
    ],

    steps: [
      'Log into employer benefits portal',
      `Increase 401(k) contribution to ${Math.min(((currentContributions + additionalContribution) / annualSalary) * 100, 15).toFixed(0)}% of salary`,
      'Open Traditional or Roth IRA if needed (Fidelity, Vanguard, Schwab)',
      'Set up automatic monthly IRA contribution',
      'Choose target-date fund or low-cost index fund (e.g., VTI)',
    ],
  };
}

function generatePerenaYieldScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  obligations: Obligation[],
  debts: Debt[]
): WhatIfScenario | null {
  // 1. Idle stablecoins already in wallet (exclude Drift collateral — handled separately)
  const stablecoinAssets = assets.filter(a =>
    a.type === 'crypto' && (
      (a.metadata as any)?.symbol?.toUpperCase() === 'USDC' ||
      (a.metadata as any)?.symbol?.toUpperCase() === 'USDT' ||
      (a.metadata as any)?.symbol?.toUpperCase() === 'DAI' ||
      (a.metadata as any)?.symbol?.toUpperCase() === 'PYUSD'
    ) &&
    ((a.metadata as any)?.apy || 0) < 8 &&
    ((a.metadata as any)?.protocol?.toLowerCase() !== 'drift') &&
    a.value > 100
  );
  const totalStablecoins = stablecoinAssets.reduce((sum, a) => sum + a.value, 0);

  // 2. Calculate monthly burn from obligations + debt payments
  const monthlyObligations = obligations.reduce((sum, o) => {
    if (o.frequency === 'monthly') return sum + o.amount;
    if (o.frequency === 'annual') return sum + o.amount / 12;
    if (o.frequency === 'weekly') return sum + o.amount * 4.33;
    return sum + o.amount;
  }, 0);
  const monthlyDebtPayments = debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const monthlyBurn = monthlyObligations + monthlyDebtPayments;

  // 3. Calculate safe excess cash (keep 3 months of burn as buffer)
  const cashAccounts = assets.filter(a =>
    a.type === 'bank_account' &&
    ((a.metadata as any)?.accountType === 'savings' ||
      (a.metadata as any)?.accountType === 'checking')
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.value, 0);
  const safetyBuffer = Math.max(2000, monthlyBurn * 3); // 3 months of bills or $2k, whichever is higher
  const excessCash = Math.max(0, totalCash - safetyBuffer);

  // Only suggest converting cash if there's meaningful excess after bills are covered
  const cashToConvert = excessCash >= 500 ? Math.floor(excessCash * 0.5) : 0;

  const totalToDeposit = totalStablecoins + cashToConvert;
  if (totalToDeposit < 100) return null;

  const perenaAPY = 9.34;
  const currentStablecoinIncome = stablecoinAssets.reduce((sum, a) => sum + (a.annualIncome || 0), 0);

  const newAnnualIncome = totalToDeposit * (perenaAPY / 100);
  const annualIncomeDelta = newAnnualIncome - currentStablecoinIncome;
  const monthlyIncomeDelta = annualIncomeDelta / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  const parts: string[] = [];
  if (totalStablecoins > 0) {
    const stableNames = stablecoinAssets.map(a => `${(a.metadata as any)?.symbol || 'USDC'} ($${Math.round(a.value).toLocaleString()})`).join(', ');
    parts.push(`${stableNames} from wallet`);
  }
  if (cashToConvert > 0) {
    const bankNames = cashAccounts.map(a => a.name).join(', ');
    parts.push(`$${cashToConvert.toLocaleString()} from ${bankNames} → buy USDC`);
  }
  const description = `Deposit ${parts.join(' + ')} into Perena yield vault`;

  const bufferNote = cashToConvert > 0
    ? ` After keeping $${safetyBuffer.toLocaleString()} as a 3-month bill buffer ($${Math.round(monthlyBurn).toLocaleString()}/mo), you have $${excessCash.toLocaleString()} in excess cash in ${cashAccounts.map(a => a.name).join(', ')}.`
    : '';

  return {
    id: 'perena_yield',
    type: 'perena_yield',
    title: `Earn ${perenaAPY}% on $${Math.round(totalToDeposit).toLocaleString()} via Perena`,
    description,
    emoji: '🌊',
    difficulty: cashToConvert > 0 ? 'medium' : 'easy',
    timeframe: 'This week',

    changes: {
      updateAssets: stablecoinAssets.map(a => ({
        id: a.id,
        updates: {
          annualIncome: a.value * (perenaAPY / 100),
          metadata: {
            ...(a.metadata as any),
            apy: perenaAPY,
            protocol: 'Perena',
            description: 'Perena Stablecoin Yield',
          }
        }
      })),
      ...(cashToConvert > 0 ? {
        addAssets: [{
          name: 'Perena USDC Deposit',
          type: 'crypto' as const,
          value: cashToConvert,
          annualIncome: cashToConvert * (perenaAPY / 100),
          isLiquid: true,
          metadata: {
            type: 'other' as const,
            symbol: 'USDC',
            apy: perenaAPY,
            protocol: 'Perena',
            description: 'USDC deposited in Perena',
          }
        }]
      } : {})
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncomeDelta,
      annualIncomeDelta: annualIncomeDelta,
      investmentRequired: cashToConvert,
      totalDeposit: totalToDeposit,
      roi: perenaAPY,
    },

    reasoning: `${totalStablecoins > 0 ? `You have ${stablecoinAssets.map(a => `$${Math.round(a.value).toLocaleString()} ${(a.metadata as any)?.symbol || 'USDC'}`).join(' + ')} in your wallet earning below-market yield.` : ''}${bufferNote} Deploying $${Math.round(totalToDeposit).toLocaleString()} into Perena at ${perenaAPY}% APY adds $${monthlyIncomeDelta.toFixed(0)}/mo in passive income with stablecoin-level risk.`,

    risks: [
      'Smart contract risk (Perena protocol)',
      'Stablecoin depeg risk (unlikely for USDC but non-zero)',
      'APY may fluctuate based on protocol utilization',
      'DeFi protocols are not FDIC insured',
      ...(cashToConvert > 0 ? ['Requires off-ramping cash to USDC (Coinbase, on-ramp)'] : []),
    ],

    steps: [
      ...(cashToConvert > 0 ? [
        `Buy $${cashToConvert.toLocaleString()} USDC on Coinbase or through an on-ramp`,
        'Transfer USDC to your Solana wallet',
      ] : []),
      'Go to Perena (perena.org)',
      'Connect your wallet',
      'Deposit stablecoins into yield vault',
      'Monitor yield and rebalance periodically',
    ],
  };
}

function generateHYSAScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find checking accounts with significant balances
  const checkingAssets = assets.filter(a =>
    a.type === 'bank_account' &&
    (a.metadata as any)?.accountType === 'checking' &&
    a.value > 3000
  );

  if (checkingAssets.length === 0) return null;

  const totalChecking = checkingAssets.reduce((sum, a) => sum + a.value, 0);

  // Keep 1 month of expenses in checking, move rest to HYSA
  const keepInChecking = monthlyNeeds > 0 ? monthlyNeeds * 1.5 : 2000;
  const moveToHYSA = Math.max(0, totalChecking - keepInChecking);

  if (moveToHYSA < 1000) return null;

  // HYSA rate ~4.5% APY (current competitive rate)
  const hysaAPY = 4.5;
  const annualIncome = moveToHYSA * (hysaAPY / 100);
  const monthlyIncome = annualIncome / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncome;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  return {
    id: 'hysa_transfer',
    type: 'hysa_transfer',
    title: `Move $${moveToHYSA.toLocaleString()} to a high-yield savings account`,
    description: `Earn ${hysaAPY}% APY on idle cash instead of ~0.01% in checking`,
    emoji: '💵',
    difficulty: 'easy',
    timeframe: 'This week',

    changes: {
      addAssets: [{
        name: 'High-Yield Savings Account',
        type: 'bank_account' as const,
        value: moveToHYSA,
        annualIncome: annualIncome,
        isLiquid: true,
        metadata: {
          type: 'other' as const,
          accountType: 'savings',
          apy: hysaAPY,
          description: 'High-Yield Savings (FDIC Insured)',
        }
      }],
      updateAssets: checkingAssets.map(a => ({
        id: a.id,
        updates: {
          value: a.value - (moveToHYSA * (a.value / totalChecking))
        }
      }))
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncome,
      annualIncomeDelta: annualIncome,
      investmentRequired: 0,
      roi: hysaAPY,
    },

    reasoning: `You have $${totalChecking.toLocaleString()} sitting in checking earning essentially nothing. Moving $${moveToHYSA.toLocaleString()} to a HYSA earns $${monthlyIncome.toFixed(0)}/mo risk-free while staying fully liquid and FDIC insured.`,

    risks: [
      'HYSA rates fluctuate with the Fed funds rate',
      'Takes 1-2 business days to transfer back if needed',
      'Some HYSAs have withdrawal limits (6/month)',
    ],

    steps: [
      'Open HYSA (Marcus, Ally, Wealthfront, SoFi)',
      'Link your checking account',
      `Transfer $${moveToHYSA.toLocaleString()} to HYSA`,
      'Set up automatic monthly sweep from checking',
    ],
  };
}

// ── Drift yield options with current APYs ──
interface DriftYieldOption {
  symbol: string;
  name: string;
  apy: number;
  type: 'staking' | 'lending';
  description: string;
  action: string; // What to do with USDC to get this
}

// Token descriptions for scenario display
const DRIFT_TOKEN_INFO: Record<string, { name: string; type: 'staking' | 'lending'; description: string; action: string }> = {
  USDC: { name: 'Drift USDC Lending', type: 'lending', description: 'Lend USDC on Drift', action: 'Drift → Earn → Lend USDC' },
  SOL: { name: 'SOL on Drift', type: 'staking', description: 'SOL deposit on Drift', action: 'Hold SOL on Drift (earns deposit rate)' },
  dSOL: { name: 'Drift Staked SOL', type: 'staking', description: 'Liquid staking via Drift', action: 'Swap → dSOL on Drift' },
  syrupUSDC: { name: 'Syrup USDC', type: 'lending', description: 'Maple Finance institutional lending', action: 'Deposit USDC into Maple syrupUSDC vault on Drift' },
  jitoSOL: { name: 'Jito Staked SOL', type: 'staking', description: 'Jito MEV-boosted staking', action: 'Swap → jitoSOL on Drift' },
  mSOL: { name: 'Marinade SOL', type: 'staking', description: 'Marinade liquid staking', action: 'Swap → mSOL on Drift' },
  bSOL: { name: 'BlazeStake SOL', type: 'staking', description: 'BlazeStake liquid staking', action: 'Swap → bSOL on Drift' },
  INF: { name: 'Infinity (Sanctum)', type: 'staking', description: 'Sanctum unified LST', action: 'Swap → INF on Drift' },
  JLP: { name: 'Jupiter LP', type: 'lending', description: 'Jupiter perpetuals liquidity', action: 'Swap → JLP on Drift' },
  USDT: { name: 'USDT Lending', type: 'lending', description: 'Lend USDT on Drift', action: 'Drift → Earn → Lend USDT' },
};

/**
 * Build yield options dynamically from live Drift rates.
 * Falls back to hardcoded values if no rates available.
 */
function buildDriftYieldOptions(
  driftRates: Record<string, { depositApy: number; borrowApy: number }>
): DriftYieldOption[] {
  if (Object.keys(driftRates).length === 0) {
    // Fallback: hardcoded defaults
    return [
      { symbol: 'jitoSOL', name: 'Jito Staked SOL', apy: 7.5, type: 'staking', description: 'Jito MEV-boosted staking', action: 'Swap → jitoSOL on Drift' },
      { symbol: 'USDC', name: 'Drift USDC Lending', apy: 1.5, type: 'lending', description: 'Lend USDC on Drift', action: 'Drift → Earn → Lend USDC' },
    ];
  }

  // Build options from live rates — only include tokens with > 0.1% APY
  return Object.entries(driftRates)
    .filter(([_, rate]) => rate.depositApy > 0.1)
    .map(([symbol, rate]) => {
      const info = DRIFT_TOKEN_INFO[symbol] || {
        name: `${symbol} on Drift`,
        type: 'lending' as const,
        description: `${symbol} deposit on Drift`,
        action: `Deposit ${symbol} on Drift`,
      };
      return {
        symbol,
        name: info.name,
        apy: rate.depositApy,
        type: info.type,
        description: `${info.description} (${rate.depositApy}% APY live)`,
        action: info.action,
      };
    })
    .sort((a, b) => b.apy - a.apy);
}

// Tokens staked for governance/fee reduction — not tradeable collateral
const DRIFT_NON_COLLATERAL_SYMBOLS = new Set(['DRIFT']);

function generateDriftYieldScenario(
  driftTrades: DriftTrade[],
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  goals: Goal[],
  driftRates: Record<string, { depositApy: number; borrowApy: number }>
): WhatIfScenario | null {
  // Find all Drift-protocol assets
  const allDriftAssets = assets.filter(a =>
    (a.type === 'crypto' || a.type === 'defi') &&
    ((a.metadata as any)?.protocol?.toLowerCase() === 'drift')
  );

  if (allDriftAssets.length === 0) {
    // Fallback: if no Drift assets logged, use trade allocation totals
    const totalLeftInDrift = driftTrades.reduce(
      (sum, t) => sum + (t.allocation?.leftInDrift || 0), 0
    );
    if (totalLeftInDrift < 200) return null;
    allDriftAssets.push({
      id: '_drift_virtual',
      type: 'crypto',
      name: 'Drift USDC',
      value: totalLeftInDrift,
      annualIncome: 0,
      metadata: { type: 'crypto', symbol: 'USDC', protocol: 'Drift', apy: 0 } as any,
    } as any);
  }

  // ── Find active goals that match yield options ──
  const activeGoals = goals.filter(g => !g.completedAt && g.strategy === 'accumulate');
  const goalSymbols = new Set(activeGoals.map(g => (g.symbol || '').toUpperCase()));

  // ── Build yield options from live rates, rank by goal-alignment then APY ──
  const yieldOptions = buildDriftYieldOptions(driftRates);
  const ranked = [...yieldOptions]
    .map(opt => ({
      ...opt,
      matchesGoal: goalSymbols.has(opt.symbol.toUpperCase()),
      matchingGoal: activeGoals.find(g => (g.symbol || '').toUpperCase() === opt.symbol.toUpperCase()),
    }))
    .sort((a, b) => {
      if (a.matchesGoal && !b.matchesGoal) return -1;
      if (!a.matchesGoal && b.matchesGoal) return 1;
      return b.apy - a.apy;
    });

  if (ranked.length === 0) return null;
  const topPick = ranked[0];
  const alternatives = ranked.slice(1, 3);

  // ── Separate swappable collateral from non-collateral (staked DRIFT, etc.) ──
  // Also exclude assets already in the target token (don't suggest dSOL → dSOL)
  const topSymbol = topPick.symbol.toUpperCase();
  const swappableAssets = allDriftAssets.filter(a => {
    const sym = ((a.metadata as any)?.symbol || '').toUpperCase();
    if (DRIFT_NON_COLLATERAL_SYMBOLS.has(sym)) return false; // Staked for fees, not moveable
    if (sym === topSymbol || sym === 'D' + topSymbol) return false; // Already the target
    return true;
  });

  const swappableValue = swappableAssets.reduce((sum, a) => sum + a.value, 0);
  if (swappableValue < 200) return null;

  // Calculate current weighted APY across swappable assets only
  const currentAnnualIncome = swappableAssets.reduce((sum, a) => sum + (a.annualIncome || 0), 0);
  const currentAPY = swappableValue > 0 ? (currentAnnualIncome / swappableValue) * 100 : 0;

  if (topPick.apy <= currentAPY) return null; // Already at best yield

  // Calculate income DELTA
  const newAnnualIncome = swappableValue * (topPick.apy / 100);
  const annualIncomeDelta = newAnnualIncome - currentAnnualIncome;
  const monthlyIncomeDelta = annualIncomeDelta / 12;

  if (monthlyIncomeDelta < 1) return null;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  const goalNote = topPick.matchingGoal
    ? ` (aligns with your "${topPick.matchingGoal.name}" goal)`
    : '';

  const altLines = alternatives.map(a => {
    const goalTag = a.matchesGoal ? ' ⭐ goal' : '';
    return `${a.symbol} (${a.apy}% APY${goalTag}) — ${a.description}`;
  });

  const swappableNames = swappableAssets
    .filter(a => a.id !== '_drift_virtual')
    .map(a => `${(a.metadata as any)?.symbol || a.name} ($${Math.round(a.value).toLocaleString()})`)
    .join(', ');

  return {
    id: 'drift_yield',
    type: 'drift_yield',
    title: `Increase Drift yield: ${currentAPY.toFixed(1)}% → ${topPick.apy}% via ${topPick.symbol}`,
    description: `Swap ${swappableNames || 'Drift assets'} → ${topPick.symbol}${goalNote} — still usable as collateral`,
    emoji: '⚡',
    difficulty: 'easy',
    timeframe: 'This week',

    changes: {},

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyIncomeDelta,
      annualIncomeDelta: annualIncomeDelta,
      investmentRequired: 0,
      roi: topPick.apy,
    },

    reasoning: `You have $${Math.round(swappableValue).toLocaleString()} in swappable Drift collateral (${swappableNames}) currently earning ${currentAPY.toFixed(2)}% APY. Swapping to ${topPick.symbol} at ${topPick.apy}% increases yield by ${(topPick.apy - currentAPY).toFixed(2)}% (+$${monthlyIncomeDelta.toFixed(0)}/mo). Drift multi-collateral means your trading power stays the same.${topPick.matchingGoal ? ` This also builds toward your "${topPick.matchingGoal.name}" goal.` : ''}`,

    risks: [
      'Smart contract risk on yield protocol',
      'APY fluctuates with market conditions',
      ...(topPick.type === 'staking' ? ['SOL price exposure if swapping from USDC'] : []),
    ],

    steps: [
      topPick.action,
      'Your new position still counts as Drift collateral — no impact on trading',
      ...altLines.map(l => `Alternative: ${l}`),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function calculateMonthlyIncome(
  assets: Asset[],
  incomeSources: IncomeSource[]
): number {
  const assetIncome = assets.reduce((sum, a) => sum + (a.annualIncome || 0), 0) / 12;
  const activeIncome = incomeSources
    .filter(s => s.isActive)
    .reduce((sum, s) => {
      if (s.frequency === 'monthly') return sum + s.amount;
      if (s.frequency === 'biweekly') return sum + (s.amount * 26 / 12);
      if (s.frequency === 'weekly') return sum + (s.amount * 52 / 12);
      return sum + s.amount / 12;
    }, 0);

  return assetIncome + activeIncome;
}

function calculateMonthlyNeeds(
  obligations: Obligation[],
  debts: Debt[]
): number {
  const obligationTotal = obligations.reduce((sum, o) => sum + o.amount, 0);
  const debtTotal = debts
    .filter(d => d.isActive)
    .reduce((sum, d) => sum + d.minimumPayment, 0);

  return obligationTotal + debtTotal;
}

function formatCurrencyShort(amt: number): string {
  if (amt >= 1000) return `$${(amt / 1000).toFixed(1)}k`;
  return `$${Math.round(amt)}`;
}

function cleanMerchantName(description: string): string {
  // Remove common suffixes, reference numbers, dates, and normalize
  return description
    .replace(/\b\d{4,}\b/g, '')           // Remove long numbers (ref IDs, dates)
    .replace(/\b(debit|credit|purchase|pos|web|online|mobile|pmnt?|pmt|ach|autopay)\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, '') // Remove dates like 02/13
    .replace(/[*#]+/g, '')                 // Remove asterisks and hashes
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30)                      // Cap length
    .trim() || description.substring(0, 30);
}
