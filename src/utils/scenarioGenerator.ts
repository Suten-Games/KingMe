// src/utils/scenarioGenerator.ts
import type { Asset, IncomeSource, Obligation, Debt, RealEstateAsset, WhatIfScenario, InvestmentThesis, DriftTrade } from '../types';
import { obligationMonthlyAmount } from '../types';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup } from '../types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } from '../types/bankTransactionTypes';
import { detectRecurring } from './csvBankImport';
import type { Goal } from '../services/goals';
import { DRIFT_MIN_COLLATERAL_USD } from './constants';

interface UserProfile {
  assets: Asset[];
  incomeSources: IncomeSource[];
  obligations: Obligation[];
  debts: Debt[];
  bankAccounts?: Array<{ id: string; name: string; type: string; currentBalance: number; institution: string }>;
  bankTransactions?: BankTransaction[];
  investmentTheses?: InvestmentThesis[];
  driftTrades?: DriftTrade[];
  goals?: Goal[];
  driftRates?: Record<string, { depositApy: number; borrowApy: number }>;
  kaminoRates?: Record<string, { supplyApr: number; borrowApr: number; tvl: number }>;
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
    debts,
    profile.bankAccounts || []
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

  // 11. GOAL UPGRADE — detect bad accumulation goals
  const goalUpgradeScenarios = generateGoalUpgradeScenarios(
    profile.goals || [],
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    profile.driftRates || {}
  );
  scenarios.push(...goalUpgradeScenarios);

  // 12. DRIFT IDLE USDC → Yield
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

  // 13. DRIFT USDC WITHDRAWAL — excess collateral back to wallet
  const driftWithdrawScenario = generateDriftWithdrawScenario(
    assets,
    obligations,
    debts,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    profile.goals || [],
    profile.settings?.driftMinCollateral
  );
  if (driftWithdrawScenario) scenarios.push(driftWithdrawScenario);

  // 14. KAMINO LENDING — deploy idle tokens for yield
  const kaminoScenario = generateKaminoLendingScenario(
    assets,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds,
    profile.kaminoRates || {}
  );
  if (kaminoScenario) scenarios.push(kaminoScenario);

  // 15. FRACTIONAL DIVIDEND STOCKS — for users with bank accounts but no stocks
  const fractionalScenario = generateFractionalStockScenario(
    assets,
    profile.bankAccounts || [],
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (fractionalScenario) scenarios.push(fractionalScenario);

  // 16. SIDE HUSTLE — for low-income or paycheck-to-paycheck users
  const sideHustleScenario = generateSideHustleScenario(
    incomeSources,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (sideHustleScenario) scenarios.push(sideHustleScenario);

  // 17. START A BUSINESS — or check on existing business
  const businessScenario = generateStartBusinessScenario(
    assets,
    incomeSources,
    profile.bankAccounts || [],
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (businessScenario) scenarios.push(businessScenario);

  // 18. DEBT WATERFALL — structured payoff for users with many debts
  const waterfallScenario = generateDebtWaterfallScenario(
    debts,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (waterfallScenario) scenarios.push(waterfallScenario);

  // 19. OBLIGATIONS AUDIT — prompt review when burn rate is high
  const auditScenario = generateObligationsAuditScenario(
    obligations,
    debts,
    currentMonthlyIncome,
    currentFreedom,
    currentMonthlyNeeds
  );
  if (auditScenario) scenarios.push(auditScenario);

  // Sort by impact (biggest freedom gain first)
  scenarios.sort((a, b) => b.impact.freedomDelta - a.impact.freedomDelta);

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
    .filter(d => (d.isActive !== false) && d.interestRate > 0 && (d.balance ?? d.principal) > 0)
    .sort((a, b) => b.interestRate - a.interestRate);

  if (activeDebts.length === 0) return null;

  const highestRateDebt = activeDebts[0];
  const hrdBalance = highestRateDebt.balance ?? highestRateDebt.principal;
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
  const monthsToPayOff = hrdBalance / (highestRateDebt.minimumPayment + extraMonthly);
  const monthsOriginal = hrdBalance / highestRateDebt.minimumPayment;
  const monthsSaved = Math.floor(monthsOriginal - monthsToPayOff);

  const rateDisplay = (highestRateDebt.interestRate * 100).toFixed(1);
  const monthlyInterestSaved = (hrdBalance * highestRateDebt.interestRate) / 12;
  const annualInterestSaved = monthlyInterestSaved * 12;

  // Once debt is paid off, the minimum payment becomes "freed up" income
  const freedUpPayment = highestRateDebt.minimumPayment;
  const newMonthlyNeeds = monthlyNeeds - freedUpPayment;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'debt_payoff_avalanche',
    type: 'debt_payoff',
    title: `Crush ${highestRateDebt.name} (${rateDisplay}% APR)`,
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

    reasoning: `Your ${highestRateDebt.name} at ${rateDisplay}% APR is costing you $${monthlyInterestSaved.toFixed(0)}/mo in interest alone. By adding $${extraMonthly.toFixed(0)}/mo extra, you pay it off ${monthsSaved} months sooner and free up $${freedUpPayment.toFixed(0)}/mo in cash flow.`,

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
  // interestRate is stored as decimal (0.10 = 10%)
  const refinanceable = debts.filter(d =>
    (d.isActive !== false) &&
    (d.balance ?? d.principal) > 2000 &&
    d.interestRate > 0.10 // Only suggest refi for 10%+ rates
  );

  if (refinanceable.length === 0) return null;

  const totalBalance = refinanceable.reduce((sum, d) => sum + (d.balance ?? d.principal), 0);
  const totalCurrentPayments = refinanceable.reduce((sum, d) => sum + d.minimumPayment, 0);
  const weightedRate = refinanceable.reduce((sum, d) =>
    sum + (d.interestRate * ((d.balance ?? d.principal) / totalBalance)), 0
  );

  // Target: consolidate at 7% (0.07 decimal)
  const targetRate = 0.07;
  if (weightedRate <= targetRate + 0.02) return null; // Not worth it if rate is close

  // Calculate new monthly payment (same term, lower rate)
  const avgRemainingMonths = 36; // Assume 3-year consolidation loan
  const monthlyRate = targetRate / 12;
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
    title: `Refinance $${totalBalance.toLocaleString()} debt from ${(weightedRate * 100).toFixed(1)}% → ${(targetRate * 100).toFixed(0)}%`,
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

    reasoning: `You're paying ${(weightedRate * 100).toFixed(1)}% across $${totalBalance.toLocaleString()} in debt. Consolidating at ${(targetRate * 100).toFixed(0)}% saves $${monthlySavings.toFixed(0)}/mo ($${annualSavings.toFixed(0)}/year) and simplifies payments into one bill.`,

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
  debts: Debt[],
  bankAccounts: Array<{ id: string; name: string; type: string; currentBalance: number; institution: string }> = []
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
  // Check both asset-type bank accounts AND the bankAccounts array
  const cashAssetAccounts = assets.filter(a =>
    a.type === 'bank_account' &&
    ((a.metadata as any)?.accountType === 'savings' ||
      (a.metadata as any)?.accountType === 'checking')
  );
  const cashFromAssets = cashAssetAccounts.reduce((sum, a) => sum + a.value, 0);
  const cashFromBankAccounts = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  // Use whichever source has data (avoid double counting)
  const totalCash = cashFromAssets > 0 ? cashFromAssets : cashFromBankAccounts;
  const cashAccountNames = cashFromAssets > 0
    ? cashAssetAccounts.map(a => a.name)
    : bankAccounts.map(a => a.name);
  const savingsBalance = cashFromAssets > 0
    ? cashAssetAccounts.filter(a => (a.metadata as any)?.accountType === 'savings').reduce((sum, a) => sum + a.value, 0)
    : bankAccounts.filter(a => a.type === 'savings').reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const safetyBuffer = Math.max(2000, monthlyBurn * 3); // 3 months of bills or $2k, whichever is higher
  const excessCash = Math.max(0, totalCash - safetyBuffer);

  // For users with excess cash, suggest converting a portion
  let cashToConvert = excessCash >= 500 ? Math.floor(excessCash * 0.5) : 0;

  // For users with savings but not enough excess: suggest a smaller starter amount
  // This catches paycheck-to-paycheck users who have savings earning 0%
  const isStarterPath = cashToConvert === 0 && totalStablecoins === 0 && savingsBalance >= 200;
  if (isStarterPath) {
    // Suggest moving 25-50% of savings (capped at $500) as a starter deposit
    cashToConvert = Math.min(Math.floor(savingsBalance * 0.4), 500);
  }

  const totalToDeposit = totalStablecoins + cashToConvert;
  if (totalToDeposit < 100) return null;

  const perenaAPY = 9.34;
  const currentStablecoinIncome = stablecoinAssets.reduce((sum, a) => sum + (a.annualIncome || 0), 0);

  const newAnnualIncome = totalToDeposit * (perenaAPY / 100);
  const annualIncomeDelta = newAnnualIncome - currentStablecoinIncome;
  const monthlyIncomeDelta = annualIncomeDelta / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? (newMonthlyIncome / monthlyNeeds) : 0;

  // Check existing USD* balance
  const existingUsdStar = assets.find(a =>
    a.type === 'crypto' && (a.metadata as any)?.symbol?.toUpperCase() === 'USD*'
  );
  const existingUsdStarValue = existingUsdStar?.value || 0;
  const newUsdStarValue = existingUsdStarValue + totalToDeposit;

  const bankNames = cashAccountNames.join(', ');
  const parts: string[] = [];
  if (totalStablecoins > 0) {
    const stableNames = stablecoinAssets.map(a => `${(a.metadata as any)?.symbol || 'USDC'} ($${Math.round(a.value).toLocaleString()})`).join(', ');
    parts.push(stableNames);
  }
  if (cashToConvert > 0) {
    parts.push(`$${cashToConvert.toLocaleString()} from ${bankNames} → buy USDC`);
  }
  const description = isStarterPath
    ? `Set up a Solana wallet and move $${cashToConvert.toLocaleString()} from ${bankNames} into USD* — earning ${perenaAPY}% instead of 0% in your savings`
    : `Swap ${parts.join(' + ')} to USD* via Jupiter${existingUsdStarValue > 0 ? ` (USD* balance: $${Math.round(existingUsdStarValue).toLocaleString()} → $${Math.round(newUsdStarValue).toLocaleString()})` : ''}`;

  const bufferNote = cashToConvert > 0 && !isStarterPath
    ? ` After keeping $${safetyBuffer.toLocaleString()} as a 3-month bill buffer ($${Math.round(monthlyBurn).toLocaleString()}/mo), you have $${excessCash.toLocaleString()} in excess cash in ${bankNames}.`
    : '';

  const starterReasoning = isStarterPath
    ? `You have $${savingsBalance.toLocaleString()} in savings earning basically nothing. Moving $${cashToConvert.toLocaleString()} into USD* on Solana earns ${perenaAPY}% APY — that's $${monthlyIncomeDelta.toFixed(0)}/mo in passive income. It's still your money and you can convert back anytime. A Solana wallet takes 2 minutes to set up and opens the door to higher yields than any bank can offer.`
    : '';

  return {
    id: 'perena_yield',
    type: 'perena_yield',
    title: isStarterPath
      ? `Your savings can earn ${perenaAPY}% — move $${cashToConvert.toLocaleString()} to USD*`
      : `Earn ${perenaAPY}% — Swap $${Math.round(totalToDeposit).toLocaleString()} USDC → USD*`,
    description,
    emoji: '🌊',
    difficulty: isStarterPath ? 'medium' : (cashToConvert > 0 ? 'medium' : 'easy'),
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

    reasoning: isStarterPath
      ? starterReasoning
      : `${totalStablecoins > 0 ? `You have ${stablecoinAssets.map(a => `$${Math.round(a.value).toLocaleString()} ${(a.metadata as any)?.symbol || 'USDC'}`).join(' + ')} in your wallet earning below-market yield.` : ''}${bufferNote}${existingUsdStarValue > 0 ? ` You already hold $${Math.round(existingUsdStarValue).toLocaleString()} in USD*.` : ''} Swapping $${Math.round(totalToDeposit).toLocaleString()} to USD* at ${perenaAPY}% APY adds $${monthlyIncomeDelta.toFixed(0)}/mo in passive income with stablecoin-level risk.`,

    risks: [
      'Smart contract risk (Perena protocol)',
      'Stablecoin depeg risk (unlikely for USDC but non-zero)',
      'APY may fluctuate based on protocol utilization',
      'DeFi protocols are not FDIC insured',
      ...(isStarterPath ? [
        'You\'ll need to learn basic crypto wallet usage (takes ~10 minutes)',
        'Start small — you can always add more later once you\'re comfortable',
      ] : cashToConvert > 0 ? ['Requires off-ramping cash to USDC (Coinbase, on-ramp)'] : []),
    ],

    steps: isStarterPath ? [
      'Set up a Solana wallet — tap the wallet icon in KingMe or download Phantom',
      `Transfer $${cashToConvert.toLocaleString()} from ${bankNames} to Coinbase (or use MoonPay/Stripe on-ramp)`,
      'Buy USDC with your deposit',
      'Send USDC to your Solana wallet address',
      `Swap USDC → USD* in KingMe (Jupiter handles the swap, earns ${perenaAPY}% automatically)`,
    ] : [
      ...(cashToConvert > 0 ? [
        `Buy $${cashToConvert.toLocaleString()} USDC on Coinbase or through an on-ramp`,
        'Transfer USDC to your Solana wallet',
      ] : []),
      `Swap $${Math.round(totalToDeposit).toLocaleString()} USDC → USD* via Jupiter`,
      ...(existingUsdStarValue > 0 ? [`New USD* balance: $${Math.round(newUsdStarValue).toLocaleString()} (currently $${Math.round(existingUsdStarValue).toLocaleString()})`] : []),
      'USD* earns yield automatically — no staking or deposits needed',
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

// ═══════════════════════════════════════════════════════════════
// Goal Upgrade Scenarios
// ═══════════════════════════════════════════════════════════════

// Categories of interchangeable tokens on Drift
const STAKING_TOKENS = new Set(['SOL', 'DSOL', 'JITOSOL', 'MSOL', 'BSOL', 'INF']);
const STABLECOIN_TOKENS = new Set(['USDC', 'USDT', 'SYRUPUSDC']);

function getTokenCategory(symbol: string): 'staking' | 'stablecoin' | null {
  const upper = symbol.toUpperCase();
  if (STAKING_TOKENS.has(upper)) return 'staking';
  if (STABLECOIN_TOKENS.has(upper)) return 'stablecoin';
  return null;
}

function generateGoalUpgradeScenarios(
  goals: Goal[],
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  driftRates: Record<string, { depositApy: number; borrowApy: number }>
): WhatIfScenario[] {
  if (Object.keys(driftRates).length === 0) return [];

  const activeGoals = goals.filter(g =>
    !g.completedAt && g.type === 'accumulate' && g.symbol
  );
  if (activeGoals.length === 0) return [];

  const scenarios: WhatIfScenario[] = [];

  for (const goal of activeGoals) {
    const sym = (goal.symbol || '').toUpperCase();
    const category = getTokenCategory(sym);
    if (!category) continue;

    const goalRate = driftRates[goal.symbol || '']?.depositApy || 0;

    // Find best alternative using the same yield options as drift_yield
    // This ensures both scenarios recommend the same token (e.g., jitoSOL)
    const yieldOptions = buildDriftYieldOptions(driftRates);
    const categoryOptions = yieldOptions.filter(opt => {
      const optCategory = getTokenCategory(opt.symbol.toUpperCase());
      return optCategory === category;
    });

    const best = categoryOptions
      .filter(opt => opt.symbol.toUpperCase() !== sym)
      .sort((a, b) => b.apy - a.apy)[0];

    if (!best) continue;
    const bestSymbol = best.symbol;
    const bestApy = best.apy;

    // Only trigger if best alternative is >2x the goal's APY (or goal is 0% and best > 1%)
    const significantlyBetter = goalRate > 0
      ? bestApy > goalRate * 2
      : bestApy > 1;
    if (!significantlyBetter) continue;

    // Find the Drift asset matching this goal to calculate income delta
    const goalAsset = assets.find(a => {
      const meta = a.metadata as any;
      return (
        (meta?.symbol || '').toUpperCase() === sym &&
        (meta?.protocol || '').toLowerCase() === 'drift'
      );
    });

    const currentValue = goalAsset?.value || 0;
    const currentAnnualIncome = currentValue * (goalRate / 100);
    const newAnnualIncome = currentValue * (bestApy / 100);
    const annualIncomeDelta = newAnnualIncome - currentAnnualIncome;
    const monthlyIncomeDelta = annualIncomeDelta / 12;

    const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
    const newFreedom = monthlyNeeds > 0 ? newMonthlyIncome / monthlyNeeds : 0;

    const goalApyStr = goalRate > 0 ? `${goalRate}%` : '0%';

    scenarios.push({
      id: `goal_upgrade_${goal.id}`,
      type: 'goal_upgrade',
      title: `Switch goal from ${goal.symbol} (${goalApyStr} APY) → ${bestSymbol} (${bestApy}% APY)`,
      description: `Your "${goal.name}" goal targets ${goal.symbol} which earns ${goalApyStr} on Drift. ${bestSymbol} earns ${bestApy}% APY — switch to grow faster.`,
      emoji: '🔄',
      difficulty: 'easy',
      timeframe: 'Today',

      changes: {},

      impact: {
        freedomBefore: currentFreedom,
        freedomAfter: newFreedom,
        freedomDelta: newFreedom - currentFreedom,
        monthlyIncomeBefore: currentMonthlyIncome,
        monthlyIncomeAfter: newMonthlyIncome,
        monthlyIncomeDelta,
        annualIncomeDelta,
        investmentRequired: 0,
        roi: bestApy,
      },

      reasoning: `Your accumulation goal "${goal.name}" targets ${goal.symbol} at ${goalApyStr} APY. ${bestSymbol} earns ${bestApy}% — that's ${goalRate > 0 ? `${(bestApy / goalRate).toFixed(1)}x` : 'significantly'} more yield. Switching means your Drift collateral grows faster while still counting toward trading margin.`,

      risks: [
        'APY fluctuates with market conditions',
        `${bestSymbol} has different price exposure than ${goal.symbol}`,
        'Smart contract risk on the yield protocol',
      ],

      steps: [
        `Swap ${goal.symbol} → ${bestSymbol} on Drift`,
        `Goal automatically updated to ${bestSymbol}`,
        'Position still counts as Drift collateral',
      ],

      // Stash goal metadata for the apply handler
      _goalUpgrade: {
        goalId: goal.id,
        fromSymbol: goal.symbol || '',
        toSymbol: bestSymbol,
        toApy: bestApy,
        toAssetId: `drift_${bestSymbol}`,
      },
    } as WhatIfScenario & { _goalUpgrade: any });
  }

  return scenarios;
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

  // LST base staking yields (not captured in Drift deposit rates)
  const LST_STAKING_APY: Record<string, number> = {
    jitoSOL: 7.5,
    mSOL: 6.8,
    bSOL: 6.5,
    dSOL: 6.0,
    INF: 7.0,
  };

  // Build options from live rates — blend staking yield + Drift deposit rate
  return Object.entries(driftRates)
    .map(([symbol, rate]) => {
      const info = DRIFT_TOKEN_INFO[symbol] || {
        name: `${symbol} on Drift`,
        type: 'lending' as const,
        description: `${symbol} deposit on Drift`,
        action: `Deposit ${symbol} on Drift`,
      };
      const stakingApy = LST_STAKING_APY[symbol] || 0;
      const totalApy = Math.round((stakingApy + rate.depositApy) * 100) / 100;
      if (totalApy <= 0.1) return null;
      return {
        symbol,
        name: info.name,
        apy: totalApy,
        type: info.type,
        description: stakingApy > 0
          ? `${info.description} (${stakingApy}% staking + ${rate.depositApy}% Drift)`
          : `${info.description} (${rate.depositApy}% APY live)`,
        action: info.action,
      };
    })
    .filter((opt): opt is DriftYieldOption => opt !== null)
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

  // Attach swap metadata — use the largest swappable asset as the primary swap
  const sortedByValue = [...swappableAssets].sort((a, b) => b.value - a.value);
  const primaryAsset = sortedByValue[0];
  const primarySymbol = (primaryAsset?.metadata as any)?.symbol || 'USDC';

  return {
    id: 'drift_yield',
    type: 'drift_yield',
    title: `Increase Drift yield: ${currentAPY.toFixed(1)}% → ${topPick.apy}% via ${topPick.symbol}`,
    description: `Swap ${swappableNames || 'Drift assets'} → ${topPick.symbol}${goalNote} — still usable as collateral`,
    emoji: '⚡',
    difficulty: 'easy',
    timeframe: 'This week',

    _driftSwap: {
      fromSymbol: primarySymbol,
      toSymbol: topPick.symbol,
      amount: (primaryAsset?.metadata as any)?.balance || (primaryAsset?.metadata as any)?.quantity || 0,
      totalValue: swappableValue,
      swaps: sortedByValue.map(a => ({
        fromSymbol: (a.metadata as any)?.symbol || 'USDC',
        amount: (a.metadata as any)?.balance || (a.metadata as any)?.quantity || 0,
      })),
    },

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
// 13. DRIFT USDC WITHDRAWAL
// ═══════════════════════════════════════════════════════════════

function generateDriftWithdrawScenario(
  assets: Asset[],
  obligations: Obligation[],
  debts: Debt[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  goals: Goal[],
  userMinCollateral?: number
): WhatIfScenario | null {
  // Use user's configured minimum, fall back to constant default
  const minCollateral = userMinCollateral ?? DRIFT_MIN_COLLATERAL_USD;

  // Find Drift USDC balance — this is the actual withdrawable token
  const driftUsdc = assets.find(a =>
    (a.type === 'crypto' || a.type === 'defi') &&
    ((a.metadata as any)?.protocol?.toLowerCase() === 'drift') &&
    ((a.metadata as any)?.symbol?.toUpperCase() === 'USDC')
  );

  // No USDC in Drift or too little to bother
  if (!driftUsdc || driftUsdc.value < 50) return null;

  // Calculate total Drift collateral value (all Drift assets)
  const allDriftAssets = assets.filter(a =>
    (a.type === 'crypto' || a.type === 'defi') &&
    ((a.metadata as any)?.protocol?.toLowerCase() === 'drift')
  );
  const totalDriftCollateral = allDriftAssets.reduce((sum, a) => sum + a.value, 0);

  // Only suggest withdrawal if total collateral exceeds the user's minimum
  if (totalDriftCollateral <= minCollateral) return null;

  // Withdrawable = excess above minimum, capped at actual USDC balance
  // (can't withdraw jitoSOL/other tokens as USDC)
  const excessCollateral = totalDriftCollateral - minCollateral;
  const withdrawUsd = Math.min(excessCollateral, driftUsdc.value);

  if (withdrawUsd < 50) return null; // not worth suggesting

  // Convert USD to USDC tokens (1:1 for USDC)
  const withdrawTokens = Math.floor(withdrawUsd);

  // Determine best use case
  let useCase: string;
  let description: string;
  let emoji = '💸';

  // Check if Perena buffer is underfunded
  const perenaGoal = goals.find(g =>
    !g.completedAt &&
    g.strategy === 'accumulate' &&
    (g.symbol || '').toUpperCase() === 'USD*'
  );
  const perenaBalance = assets.find(a =>
    (a.metadata as any)?.symbol?.toUpperCase() === 'USD*'
  );

  // Check bank balance relative to monthly expenses
  const bankAssets = assets.filter(a => a.type === 'bank_account');
  const totalBankBalance = bankAssets.reduce((sum, a) => sum + a.value, 0);

  if (perenaGoal && perenaBalance && perenaGoal.targetAmount && perenaBalance.value < perenaGoal.targetAmount) {
    useCase = 'Fund Perena buffer';
    description = `Withdraw $${withdrawTokens.toLocaleString()} USDC from Drift to fund your Perena USD* position. Your trading buffer goal needs more capital.`;
    emoji = '🛡️';
  } else if (monthlyNeeds > 0 && totalBankBalance < monthlyNeeds) {
    useCase = 'Top up bank account';
    description = `Withdraw $${withdrawTokens.toLocaleString()} USDC from Drift to your wallet — your bank balance is below 1 month of expenses. Convert to fiat via on-ramp.`;
    emoji = '🏦';
  } else {
    useCase = 'Withdraw excess USDC';
    description = `You have $${Math.round(totalDriftCollateral).toLocaleString()} in Drift collateral. Withdraw $${withdrawTokens.toLocaleString()} USDC to your wallet while keeping $${minCollateral.toLocaleString()} minimum for trading.`;
    emoji = '💸';
  }

  return {
    id: 'drift_withdraw',
    type: 'drift_withdraw',
    title: `Withdraw $${withdrawTokens.toLocaleString()} USDC from Drift — ${useCase}`,
    description,
    emoji,
    difficulty: 'easy',
    timeframe: 'Today',

    _driftWithdraw: {
      symbol: 'USDC',
      amount: withdrawTokens,
    },

    changes: {},

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: currentFreedom, // withdrawal doesn't change freedom directly
      freedomDelta: 0,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
    },

    reasoning: `Your Drift account has $${Math.round(totalDriftCollateral).toLocaleString()} in collateral. You've set $${minCollateral.toLocaleString()} as your minimum trading collateral. The excess $${withdrawTokens.toLocaleString()} USDC can be put to better use — ${useCase.toLowerCase()}.`,

    risks: [
      `Reduces Drift trading collateral (maintains $${minCollateral.toLocaleString()} minimum)`,
      'Withdrawal requires on-chain transaction + gas fees',
    ],

    steps: [
      `Withdraw ${withdrawTokens} USDC from Drift to your Solana wallet`,
      `$${minCollateral.toLocaleString()} minimum collateral preserved for trading`,
      useCase,
    ],
  } as any;
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
    .filter(s => s.isActive !== false)
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
  const obligationTotal = obligations.reduce((sum, o) => sum + obligationMonthlyAmount(o), 0);
  const debtTotal = debts
    .filter(d => d.isActive !== false)
    .reduce((sum, d) => sum + (d.minimumPayment || 0), 0);

  return obligationTotal + debtTotal;
}

function formatCurrencyShort(amt: number): string {
  if (amt >= 1000) return `$${(amt / 1000).toFixed(1)}k`;
  return `$${Math.round(amt)}`;
}

// ═══════════════════════════════════════════════════════════════
// 14. KAMINO LENDING — Scan tokens for yield opportunities
// ═══════════════════════════════════════════════════════════════

function generateKaminoLendingScenario(
  assets: Asset[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number,
  kaminoRates: Record<string, { supplyApr: number; borrowApr: number; tvl: number }>
): WhatIfScenario | null {
  if (Object.keys(kaminoRates).length === 0) return null;

  // Find tokens that could earn more yield on Kamino
  const opportunities: Array<{
    asset: Asset;
    symbol: string;
    mint: string;
    currentApy: number;
    kaminoApy: number;
    gain: number;
    additionalAnnual: number;
  }> = [];

  // Stablecoins handled by Perena scenario (higher yield) — exclude from Kamino
  const STABLECOINS = new Set(['USDC', 'USDT', 'DAI', 'PYUSD', 'USD*', 'USDSTAR']);

  for (const asset of assets) {
    const meta = asset.metadata as any;
    const mint = meta?.tokenMint || meta?.mint || '';
    const symbol = (meta?.symbol || asset.name || '').toUpperCase();
    if (!mint || asset.value < 50) continue;

    // Skip stablecoins — Perena scenario handles these at better rates
    if (STABLECOINS.has(symbol)) continue;

    // Skip SOL if balance is low — need for transaction fees
    if (symbol === 'SOL' && asset.value < 500) continue;

    // Skip if already on Kamino
    if (meta?.protocol?.toLowerCase() === 'kamino') continue;
    // Skip Drift positions (they have their own yield)
    if (meta?.protocol?.toLowerCase() === 'drift') continue;

    // Look up Kamino rate by symbol
    const rate = kaminoRates[symbol] || kaminoRates[symbol.toLowerCase()];
    if (!rate || rate.supplyApr <= 0) continue;

    const currentApy = meta?.apy || 0;
    const gain = rate.supplyApr - currentApy;

    // Only suggest if meaningful improvement (>0.5% better or currently 0)
    if (gain < 0.5 && currentApy > 0) continue;

    opportunities.push({
      asset,
      symbol,
      mint,
      currentApy,
      kaminoApy: rate.supplyApr,
      gain,
      additionalAnnual: asset.value * (gain / 100),
    });
  }

  if (opportunities.length === 0) return null;

  // Sort by additional income
  opportunities.sort((a, b) => b.additionalAnnual - a.additionalAnnual);

  const totalValue = opportunities.reduce((s, o) => s + o.asset.value, 0);
  const totalAdditionalAnnual = opportunities.reduce((s, o) => s + o.additionalAnnual, 0);

  // Don't show scenario if income impact rounds to $0/mo
  if (totalAdditionalAnnual < 1) return null;
  const monthlyIncomeDelta = totalAdditionalAnnual / 12;
  const newMonthlyIncome = currentMonthlyIncome + monthlyIncomeDelta;
  const newFreedom = monthlyNeeds > 0 ? newMonthlyIncome / monthlyNeeds : 0;
  const bestApy = Math.max(...opportunities.map(o => o.kaminoApy));

  const tokenList = opportunities.slice(0, 4).map(o =>
    `${o.symbol} ($${Math.round(o.asset.value).toLocaleString()}) → ${o.kaminoApy.toFixed(1)}%`
  ).join(', ');

  const description = opportunities.length === 1
    ? `Deposit ${opportunities[0].symbol} ($${Math.round(opportunities[0].asset.value).toLocaleString()}) to Kamino for ${opportunities[0].kaminoApy.toFixed(1)}% APY`
    : `Deposit ${opportunities.length} tokens worth $${Math.round(totalValue).toLocaleString()} into Kamino lending`;

  return {
    id: 'kamino_lending',
    type: 'kamino_lending',
    title: `Earn up to ${bestApy.toFixed(1)}% — Lend $${Math.round(totalValue).toLocaleString()} on Kamino`,
    description,
    emoji: '🏦',
    difficulty: 'easy',
    timeframe: 'Today',

    changes: {
      updateAssets: opportunities.map(o => ({
        id: o.asset.id,
        updates: {
          annualIncome: o.asset.value * (o.kaminoApy / 100),
          metadata: {
            ...(o.asset.metadata as any),
            apy: o.kaminoApy,
            protocol: 'Kamino',
            positionType: 'deposit',
            description: `${o.symbol} supplied on Kamino Lend`,
          },
        },
      })),
    },

    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta,
      annualIncomeDelta: totalAdditionalAnnual,
      investmentRequired: 0,
      totalDeposit: totalValue,
      roi: bestApy,
    },

    reasoning: `You have ${opportunities.length} token${opportunities.length > 1 ? 's' : ''} that could earn yield on Kamino Lending: ${tokenList}. ${opportunities.some(o => o.currentApy === 0) ? 'Some are currently earning nothing.' : `Current average APY is ${(opportunities.reduce((s, o) => s + o.currentApy, 0) / opportunities.length).toFixed(1)}%.`} Depositing to Kamino adds $${monthlyIncomeDelta.toFixed(0)}/mo in passive income.`,

    risks: [
      'Smart contract risk (Kamino protocol)',
      'APY fluctuates with lending demand',
      'Potential liquidation if borrowing against deposits',
      'DeFi protocols are not FDIC insured',
    ],

    steps: opportunities.slice(0, 5).map(o =>
      `Deposit ${o.symbol} ($${Math.round(o.asset.value).toLocaleString()}) → ${o.kaminoApy.toFixed(1)}% APY on Kamino`
    ),
  };
}

// ═══════════════════════════════════════════════════════════════
// 15. FRACTIONAL DIVIDEND STOCKS — for users with bank accounts but no stocks
// ═══════════════════════════════════════════════════════════════

function generateFractionalStockScenario(
  assets: Asset[],
  bankAccounts: Array<{ id: string; name: string; type: string; currentBalance: number; institution: string }>,
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Only show if user has NO stock/brokerage assets
  const hasStocks = assets.some(a => a.type === 'stocks' || a.type === 'brokerage');
  if (hasStocks) return null;

  // Need at least one bank account with some balance
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  if (totalBankBalance < 25) return null;

  // Find the best bank account to invest from (Cash App, Robinhood, etc. support fractional)
  const fractionalApps = ['cash app', 'robinhood', 'webull', 'sofi', 'public'];
  const fractionalAccount = bankAccounts.find(a =>
    fractionalApps.some(app => a.institution.toLowerCase().includes(app) || a.name.toLowerCase().includes(app))
  );

  // Suggest investing a small amount — even $5-25/week adds up
  const weeklyAmount = totalBankBalance >= 200 ? 10 : 5;
  const monthlyAmount = weeklyAmount * 4;
  const annualInvestment = monthlyAmount * 12;

  // Popular dividend stocks for beginners
  const picks = [
    { symbol: 'SCHD', name: 'Schwab Dividend ETF', yield: 3.5 },
    { symbol: 'KO', name: 'Coca-Cola', yield: 3.1 },
    { symbol: 'AAPL', name: 'Apple', yield: 0.5 },
  ];
  const primaryPick = picks[0];

  // After 1 year of investing
  const yearOneValue = annualInvestment;
  const yearOneDividends = yearOneValue * (primaryPick.yield / 100);
  const monthlyDividends = yearOneDividends / 12;

  const newMonthlyIncome = currentMonthlyIncome + monthlyDividends;
  const newFreedom = monthlyNeeds > 0 ? newMonthlyIncome / monthlyNeeds : 0;

  const appName = fractionalAccount?.institution || fractionalAccount?.name || 'Cash App';
  const hasApp = !!fractionalAccount;

  return {
    id: 'start_fractional',
    type: 'start_fractional',
    title: `Start buying $${weeklyAmount}/week in dividend stocks`,
    description: hasApp
      ? `${appName} supports fractional shares — buy ${primaryPick.symbol} (${primaryPick.name}) for ${primaryPick.yield}% dividends`
      : `Open Cash App Investing and buy fractional shares of ${primaryPick.symbol} for ${primaryPick.yield}% dividends`,
    emoji: '📊',
    difficulty: 'easy',
    timeframe: 'This week',
    changes: {
      addAssets: [{
        type: 'stocks',
        name: primaryPick.name,
        value: yearOneValue,
        annualIncome: yearOneDividends,
        metadata: { symbol: primaryPick.symbol, dividendYield: primaryPick.yield },
      }],
    },
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyDividends,
      annualIncomeDelta: yearOneDividends,
      investmentRequired: annualInvestment,
    },
    reasoning: `Even $${weeklyAmount}/week adds up. After a year you'd have ~$${annualInvestment} invested, earning ~$${yearOneDividends.toFixed(0)}/year in dividends. Fractional shares let you buy big-name stocks with small amounts — no need to save up for a full share.`,
    risks: [
      'Stock prices fluctuate — your balance will go up and down',
      'Dividends are not guaranteed and can be cut',
      `$${weeklyAmount}/week is small but consistency matters more than amount`,
    ],
    steps: [
      hasApp ? `Open ${appName} and go to Investing` : 'Download Cash App or Robinhood (both support fractional shares)',
      `Search for ${primaryPick.symbol} (${primaryPick.name})`,
      `Set up a recurring buy of $${weeklyAmount}/week`,
      'Turn on dividend reinvestment (DRIP) so dividends buy more shares automatically',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// 16. SIDE HUSTLE — suggest income-boosting gigs for low earners
// ═══════════════════════════════════════════════════════════════

function generateSideHustleScenario(
  incomeSources: IncomeSource[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Only suggest for users with tight cash flow (freedom < 1.5x needs)
  if (monthlyNeeds === 0) return null;
  if (currentFreedom > 1.5) return null;
  // Don't suggest gig work to high earners — they need debt strategy, not side hustles
  if (currentMonthlyIncome > 8000) return null;
  // Don't suggest if they already have multiple income sources
  if (incomeSources.length >= 3) return null;

  // Estimate side hustle income: $500-1500/mo depending on current income
  const hustleIncome = currentMonthlyIncome < 2000 ? 500 : currentMonthlyIncome < 4000 ? 800 : 1200;
  const newMonthlyIncome = currentMonthlyIncome + hustleIncome;
  const newFreedom = monthlyNeeds > 0 ? newMonthlyIncome / monthlyNeeds : 0;

  // Suggest relevant hustles based on income level
  const isLowIncome = currentMonthlyIncome < 2500;
  const hustleIdeas = isLowIncome
    ? 'freelance gigs (Fiverr, Upwork), food delivery (DoorDash), or reselling (eBay, Poshmark)'
    : 'freelance consulting, tutoring, content creation, or weekend gig work';

  return {
    id: 'side_hustle',
    type: 'side_hustle',
    title: `Add $${hustleIncome}/mo with a side hustle`,
    description: `Even ${isLowIncome ? '10-15' : '5-10'} hours/week of ${isLowIncome ? 'gig work' : 'freelancing'} can dramatically change your cash flow`,
    emoji: '💪',
    difficulty: 'medium',
    timeframe: 'This month',
    changes: {
      addIncomeSources: [{
        source: 'other' as any,
        name: 'Side Hustle Income',
        amount: hustleIncome,
        frequency: 'monthly' as any,
      }],
    },
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: hustleIncome,
      annualIncomeDelta: hustleIncome * 12,
      investmentRequired: 0,
    },
    reasoning: `Your monthly burn is $${Math.round(monthlyNeeds)} but you're only bringing in $${Math.round(currentMonthlyIncome)}. Adding $${hustleIncome}/mo from ${hustleIdeas} would give you breathing room and money to start investing. The fastest path to freedom is increasing income, not just cutting costs.`,
    risks: [
      'Side hustles take time to ramp up — first month may be slow',
      'Trading time for money isn\'t passive, but it bootstraps your investment capital',
      'Tax implications — set aside ~25% of gig income for taxes',
    ],
    steps: [
      isLowIncome
        ? 'Sign up for 2-3 gig platforms: DoorDash, Instacart, TaskRabbit, or Fiverr'
        : 'List your skills on Upwork or Fiverr, or start freelance consulting',
      `Block out ${isLowIncome ? '10-15' : '5-10'} hours/week specifically for side hustle work`,
      `Target $${hustleIncome}/month — that's $${Math.round(hustleIncome / 4)}/week`,
      'Funnel 100% of side hustle income into investing or debt payoff',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// 17. START A BUSINESS — suggest launching a small venture
// ═══════════════════════════════════════════════════════════════

function generateStartBusinessScenario(
  assets: Asset[],
  incomeSources: IncomeSource[],
  bankAccounts: Array<{ id: string; name: string; type: string; currentBalance: number; institution: string }>,
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // If user already has a business asset, show a contextual check-in reminder
  const businessAsset = assets.find(a => a.type === 'business');
  if (businessAsset) {
    const bizName = businessAsset.name || 'your business';
    const meta = (businessAsset.metadata || {}) as any;
    const bankBal = meta.bankBalance || 0;
    const walletBal = meta.walletBalance || 0;

    // Check how stale the data is
    const lastSynced = meta.lastSynced ? new Date(meta.lastSynced) : null;
    const daysSinceSync = lastSynced
      ? Math.floor((Date.now() - lastSynced.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const isStale = daysSinceSync >= 7;

    // Compute monthly P&L from income sources tagged as business
    const bizIncome = incomeSources
      .filter(s => s.source === 'business' || (s.name || '').toLowerCase().includes('business'))
      .reduce((sum, s) => sum + (s.frequency === 'monthly' ? s.amount : s.frequency === 'annual' ? s.amount / 12 : s.amount), 0);

    // Pick contextual title and description
    let title: string;
    let description: string;

    if (isStale) {
      title = `Update your ${bizName} numbers`;
      description = `It's been ${daysSinceSync} days since your last update. Keep your bank balance and expenses current so your freedom score stays accurate.`;
    } else if (bizIncome > 0) {
      const monthlyNet = bizIncome;
      const sign = monthlyNet >= 0 ? '+' : '';
      title = `${bizName} P&L: ${sign}$${Math.abs(monthlyNet).toLocaleString()}/mo`;
      description = `Bank: $${bankBal.toLocaleString()} · Wallet: $${walletBal.toLocaleString()}. Review expenses and distributions on the Business Dashboard.`;
    } else {
      title = `How's ${bizName} doing?`;
      description = `Worth $${businessAsset.value.toLocaleString()}. Review your P&L, track expenses, and keep your business financials up to date.`;
    }

    return {
      id: 'check_business',
      type: 'start_business',
      title,
      description,
      emoji: '💼',
      difficulty: 'easy',
      timeframe: isStale ? 'Overdue' : 'Now',
      changes: {},
      impact: {
        freedomBefore: currentFreedom,
        freedomAfter: currentFreedom,
        freedomDelta: 0,
        monthlyIncomeBefore: currentMonthlyIncome,
        monthlyIncomeAfter: currentMonthlyIncome,
        monthlyIncomeDelta: 0,
        annualIncomeDelta: 0,
        investmentRequired: 0,
      },
      reasoning: `Successful businesses need regular attention. Check your expenses, update your bank balance, review distributions, and make sure your P&L is accurate.`,
      risks: [],
      steps: ['Open Business Dashboard', 'Update bank balance', 'Review expenses', 'Check P&L'],
      link: '/business',
    };
  }

  // Suggest for users who are employed but could scale income
  if (monthlyNeeds === 0) return null;
  if (currentFreedom > 2.0) return null;
  // Don't suggest starting a business to high earners
  if (currentMonthlyIncome > 8000) return null;
  // Need at least one income source (they have a job to sustain them)
  if (incomeSources.length === 0) return null;
  // Don't suggest if they already have business income
  const hasBusinessIncome = incomeSources.some(s =>
    s.source === 'business' || (s.name || '').toLowerCase().includes('business')
  );
  if (hasBusinessIncome) return null;

  const totalSavings = bankAccounts
    .filter(a => a.type === 'savings' || a.type === 'investment')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  // Low-cost business ideas based on financial situation
  const isBootstrap = totalSavings < 1000;
  const startupCost = isBootstrap ? 0 : 500;
  const monthlyBusinessIncome = isBootstrap ? 1000 : 2000;

  const newMonthlyIncome = currentMonthlyIncome + monthlyBusinessIncome;
  const newFreedom = monthlyNeeds > 0 ? newMonthlyIncome / monthlyNeeds : 0;

  const businessIdea = isBootstrap
    ? 'a service-based business (cleaning, tutoring, social media management, or personal training)'
    : 'an online business (dropshipping, digital products, content creation, or a niche service)';

  return {
    id: 'start_business',
    type: 'start_business',
    title: `Start a small business → $${monthlyBusinessIncome}/mo`,
    description: `Launch ${businessIdea} to build a second income stream that can scale beyond trading time for money`,
    emoji: '🚀',
    difficulty: 'hard',
    timeframe: '1-3 months',
    changes: {
      addIncomeSources: [{
        source: 'business' as any,
        name: 'Small Business',
        amount: monthlyBusinessIncome,
        frequency: 'monthly' as any,
      }],
    },
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: newMonthlyIncome,
      monthlyIncomeDelta: monthlyBusinessIncome,
      annualIncomeDelta: monthlyBusinessIncome * 12,
      investmentRequired: startupCost,
    },
    reasoning: `A job pays bills but a business builds wealth. Even a small side business doing $${monthlyBusinessIncome}/month changes your trajectory — that's $${(monthlyBusinessIncome * 12).toLocaleString()}/year in extra income you can invest. Unlike a side hustle, a business can eventually run without you. KingMe's Business Dashboard can help you track revenue, expenses, and profit as you grow.`,
    risks: [
      'Businesses take time to become profitable — expect 1-3 months before consistent income',
      `${isBootstrap ? 'Zero upfront cost but requires time investment' : `Small upfront investment (~$${startupCost}) for tools and setup`}`,
      'Not all businesses work — be ready to pivot if your first idea doesn\'t gain traction',
      'Keep your day job until the business consistently covers at least half your expenses',
    ],
    steps: [
      'Pick one business idea that matches your skills and available time',
      isBootstrap
        ? 'Start with zero capital — offer services on social media or to your network first'
        : 'Set aside $500 for basic setup (domain, tools, initial inventory)',
      'Get your first paying customer within 2 weeks — speed beats perfection',
      'Use KingMe\'s Business Dashboard to track income, expenses, and profit margins',
      'Reinvest early profits to grow — pay yourself once revenue is consistent',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// 18. DEBT WATERFALL — structured payoff plan for high-debt users
// ═══════════════════════════════════════════════════════════════

function generateDebtWaterfallScenario(
  debts: Debt[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  const activeDebts = debts
    .filter(d => (d.isActive !== false) && (d.balance ?? d.principal) > 0)
    .sort((a, b) => b.interestRate - a.interestRate);

  // Need at least 3 debts to justify a waterfall strategy
  if (activeDebts.length < 3) return null;

  const totalDebt = activeDebts.reduce((sum, d) => sum + (d.balance ?? d.principal), 0);
  const totalMinPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

  // Weighted average interest rate
  const weightedRate = activeDebts.reduce(
    (sum, d) => sum + ((d.balance ?? d.principal) * d.interestRate), 0
  ) / totalDebt;

  // Calculate how much interest the waterfall saves vs minimum payments
  // By rolling each paid-off debt's payment into the next, you accelerate payoff
  const rollupSavings = activeDebts.reduce((sum, d) => {
    const bal = d.balance ?? d.principal;
    return sum + (bal * d.interestRate) / 12;
  }, 0);

  // Once all debts are paid, all minimum payments become freed income
  const newMonthlyNeeds = monthlyNeeds - totalMinPayments;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  const debtList = activeDebts
    .map(d => `${d.name} ($${Math.round(d.balance ?? d.principal).toLocaleString()} @ ${(d.interestRate * 100).toFixed(1)}%)`)
    .join(', ');

  return {
    id: 'debt_waterfall',
    type: 'debt_waterfall',
    title: `Debt waterfall: crush $${Math.round(totalDebt / 1000)}K across ${activeDebts.length} debts`,
    description: `Avalanche method: attack highest-rate debt first, roll payments into the next one`,
    emoji: '🌊',
    difficulty: 'medium',
    timeframe: '12-36 months',
    changes: {},
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
      monthlySavings: totalMinPayments,
      interestSaved: rollupSavings * 12,
    },
    reasoning: `You have ${activeDebts.length} debts totaling $${Math.round(totalDebt).toLocaleString()} with a weighted average rate of ${(weightedRate * 100).toFixed(1)}%. The waterfall method attacks the highest-rate debt first. Once it's paid off, you roll that full payment into the next debt — creating a snowball effect. This frees up $${Math.round(totalMinPayments).toLocaleString()}/mo in cash flow once complete. Your debts in order: ${debtList}.`,
    risks: [
      'Requires discipline — you must redirect freed payments, not spend them',
      'Takes 1-3 years depending on extra payments',
      'Emergency expenses can disrupt the plan',
    ],
    steps: [
      `Focus all extra money on ${activeDebts[0].name} (${(activeDebts[0].interestRate * 100).toFixed(1)}% — highest rate)`,
      `Once ${activeDebts[0].name} is paid off, roll $${activeDebts[0].minimumPayment}/mo into ${activeDebts[1]?.name || 'next debt'}`,
      'Continue cascading payments down the list until all debts are cleared',
      'Review your obligations tab to see all monthly commitments — look for subscriptions to cut',
      'Never take on new debt during the waterfall process',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// 19. OBLIGATIONS AUDIT — prompt users to review their obligations tab
// ═══════════════════════════════════════════════════════════════

function generateObligationsAuditScenario(
  obligations: Obligation[],
  debts: Debt[],
  currentMonthlyIncome: number,
  currentFreedom: number,
  monthlyNeeds: number
): WhatIfScenario | null {
  // Need at least 5 obligations + debts to make an audit worthwhile
  const totalItems = obligations.length + debts.length;
  if (totalItems < 5) return null;

  // Only suggest when obligations are eating a big chunk of income (>60%)
  if (monthlyNeeds <= 0 || currentMonthlyIncome <= 0) return null;
  const burnRatio = monthlyNeeds / currentMonthlyIncome;
  if (burnRatio < 0.6) return null;

  // Estimate 10% savings from audit (cancel unused subscriptions, negotiate bills)
  const obligationTotal = obligations.reduce((sum, o) => sum + obligationMonthlyAmount(o), 0);
  const estimatedSavings = Math.round(obligationTotal * 0.10);
  if (estimatedSavings < 20) return null;

  const newMonthlyNeeds = monthlyNeeds - estimatedSavings;
  const newFreedom = newMonthlyNeeds > 0 ? (currentMonthlyIncome / newMonthlyNeeds) : 0;

  return {
    id: 'obligations_audit',
    type: 'obligations_audit',
    title: `Audit your ${totalItems} obligations — save ~$${estimatedSavings}/mo`,
    description: `Your monthly burn is ${Math.round(burnRatio * 100)}% of income. A quick audit can uncover hidden savings.`,
    emoji: '🔍',
    difficulty: 'easy',
    timeframe: 'This weekend',
    changes: {},
    impact: {
      freedomBefore: currentFreedom,
      freedomAfter: newFreedom,
      freedomDelta: newFreedom - currentFreedom,
      monthlyIncomeBefore: currentMonthlyIncome,
      monthlyIncomeAfter: currentMonthlyIncome,
      monthlyIncomeDelta: 0,
      annualIncomeDelta: 0,
      investmentRequired: 0,
      monthlySavings: estimatedSavings,
    },
    reasoning: `You're spending $${Math.round(monthlyNeeds).toLocaleString()}/mo on ${totalItems} obligations and debts — that's ${Math.round(burnRatio * 100)}% of your income. Most people find 5-15% savings by auditing: canceling forgotten subscriptions, negotiating bills, or switching providers. Even $${estimatedSavings}/mo freed up is $${estimatedSavings * 12}/year you could invest.`,
    risks: [
      'Some obligations are non-negotiable (mortgage, insurance)',
      'Cutting too aggressively can backfire — focus on waste, not essentials',
    ],
    steps: [
      'Go to the Obligations tab to see every recurring payment in one place',
      'Flag anything you don\'t use or could live without',
      'Call providers to negotiate — internet, insurance, and phone bills are often negotiable',
      'Cancel or downgrade at least 2-3 items this week',
      'Redirect saved money to your highest-interest debt or investments',
    ],
  };
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
