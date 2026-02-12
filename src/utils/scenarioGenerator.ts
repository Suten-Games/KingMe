// src/utils/scenarioGenerator.ts
import type { Asset, IncomeSource, Obligation, DebtPayment, WhatIfScenario } from '../types';

interface UserProfile {
  assets: Asset[];
  incomeSources: IncomeSource[];
  obligations: Obligation[];
  debts: DebtPayment[];
}

export function generateSmartScenarios(profile: UserProfile): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];

  const { assets, incomeSources, obligations, debts } = profile;

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

  // 2. IDLE CRYPTO → Staking
  const cryptoScenario = generateStakeCryptoScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
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

  // 5. REDUCE EXPENSES
  const expenseScenario = generateReduceExpensesScenario(
    obligations,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (expenseScenario) scenarios.push(expenseScenario);

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

  // Keep $2K emergency, invest 70% of rest
  const emergencyFund = 2000;
  const investable = Math.max(0, totalCash - emergencyFund);
  const investAmount = Math.floor(investable * 0.7);

  if (investAmount < 1000) return null;

  // Assume 3.5% dividend yield (conservative S&P dividend)
  const annualIncome = investAmount * 0.035;
  const monthlyIncome = annualIncome / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncome;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  return {
    id: 'invest_cash',
    type: 'invest_cash',
    title: `Invest $${investAmount.toLocaleString()} in dividend stocks`,
    description: `Move idle cash into S&P 500 dividend ETF (VOO, VYM, or SCHD)`,
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

    reasoning: `You have $${totalCash.toLocaleString()} in cash earning minimal interest. By investing $${investAmount.toLocaleString()} in dividend stocks, you can earn $${monthlyIncome.toFixed(0)}/month in passive income while keeping $${(totalCash - investAmount).toLocaleString()} liquid for emergencies.`,

    risks: [
      'Stock prices fluctuate - value may go down',
      'Dividends can be reduced (rare for established companies)',
      'Takes 3-6 months to build up dividend stream',
    ],

    steps: [
      'Open brokerage account (Fidelity, Schwab, or Vanguard)',
      'Transfer cash from savings',
      'Buy SCHD or VYM (dividend-focused ETFs)',
      'Set dividends to auto-reinvest',
    ],
  };
}

function generateStakeCryptoScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find crypto with low APY
  const cryptoAssets = assets.filter(a =>
    a.type === 'crypto' &&
    (a.metadata as any)?.apy < 3 &&
    a.value > 500
  );

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
    title: `Stake $${stakeAmount.toLocaleString()} crypto for 8% APY`,
    description: `Move idle tokens to yield-generating protocols (Drift, Kamino, Marginfi)`,
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

    reasoning: `You have $${totalIdleCrypto.toLocaleString()} in crypto earning little to no yield. By staking in DeFi protocols, you can earn ${targetAPY}% APY ($${annualIncomeDelta.toFixed(0)}/year) with moderate risk.`,

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
  // Find real estate with no income
  const realEstateAssets = assets.filter(a =>
    a.type === 'real_estate' &&
    a.annualIncome === 0 &&
    a.value > 50000
  );

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
  const brokerageAssets = assets.filter(a =>
    a.type === 'stocks' &&
    a.annualIncome < (a.value * 0.02) && // Less than 2% yield
    a.value > 5000
  );

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
  monthlyNeeds: number
): WhatIfScenario | null {
  // Find discretionary obligations
  const discretionary = obligations.filter(o =>
    o.category !== 'housing' &&
    o.category !== 'utilities' &&
    o.amount > 50
  );

  if (discretionary.length === 0) return null;

  // Assume 20% reduction is achievable
  const totalDiscretionary = discretionary.reduce((sum, o) => sum + o.amount, 0);
  const reduction = totalDiscretionary * 0.2;

  const newMonthlyNeeds = monthlyNeeds - reduction;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'reduce_expenses',
    type: 'reduce_expenses',
    title: `Cut $${reduction.toFixed(0)}/mo in expenses`,
    description: `Reduce discretionary spending by 20%`,
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
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
    },

    reasoning: `By reducing discretionary expenses by 20%, you effectively increase your freedom by needing less income to cover needs. This is equivalent to earning $${reduction.toFixed(0)}/mo more.`,

    risks: [
      'Requires discipline and lifestyle changes',
      'May feel restrictive initially',
      'Easy to backslide without tracking',
    ],

    steps: [
      'Review last 3 months of spending',
      'Cancel unused subscriptions',
      'Negotiate bills (insurance, phone, internet)',
      'Meal prep instead of eating out',
      'Use cash for discretionary spending',
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
  debts: DebtPayment[]
): number {
  const obligationTotal = obligations.reduce((sum, o) => sum + o.amount, 0);
  const debtTotal = debts
    .filter(d => d.isActive)
    .reduce((sum, d) => sum + d.minimumPayment, 0);

  return obligationTotal + debtTotal;
}
