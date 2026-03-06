// KingMe - Type Definitions

import { BankTransaction, BankTransactionCategory, CustomCategoryDef } from "./bankTransactionTypes";

export type AvatarType = 'male-medium' | 'female-medium';

export type FreedomState = 'drowning' | 'struggling' | 'breaking' | 'rising' | 'enthroned';

export type ThesisTimeHorizon = '3mo' | '6mo' | '1yr' | '2yr' | '5yr' | '10yr+';

//export type { BankTransaction, BankTransactionCategory, BankTransactionGroup } from './bankTransactionTypes.ts';
//export { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } './bankTransactionTypes.ts';

export type ThesisInvalidatorType =
  | 'price_drop'      // Stop-loss at X% down
  | 'price_stagnant'  // No movement for X days
  | 'time_based'      // Deadline: "If not at $X by date Y"
  | 'fundamental'     // Team abandons, hack, etc.
  | 'news';           // External event

// Bank Accounts - Core financial tracking
export interface BankAccount {
  id: string;
  name: string; // "Chase Checking", "Ally Savings"
  type: 'checking' | 'savings' | 'investment';
  currentBalance: number;
  institution: string; // "Chase", "Ally", "Fidelity"
  isPrimaryIncome: boolean; // Where paycheck goes
  isLinked?: boolean; // For future Plaid integration
}

// Income sources that deposit into accounts
export interface IncomeSource {
  id: string;
  source: 'salary' | 'freelance' | 'business' | 'trading' | 'other';
  name: string; // "Acme Corp Salary", "Freelance - Client X"
  amount: number; // Per deposit
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly' | 'quarterly';
  bankAccountId: string; // Where it deposits
  nextDepositDate?: string; // ISO date
  dayOfMonth1?: number; // For twice_monthly (e.g., 1)
  dayOfMonth2?: number; // For twice_monthly (e.g., 15)
}

export interface Income {
  salary: number; // annual active income (deprecated - use incomeSources)
  otherIncome: number; // annual (deprecated - use incomeSources)
  assetIncome: number; // auto-calculated from assets
  sources?: IncomeSource[]; // NEW - detailed income tracking
}

export type AssetType = 'crypto' | 'defi' | 'real_estate' | 'stocks' | 'business' | 'brokerage' | 'bank_account' | 'retirement' | 'other';

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  value: number;
  annualIncome: number;
  metadata: CryptoAsset | RealEstateAsset | StockAsset | BusinessAsset | BankAsset | RetirementAsset | OtherAsset;

  // Wallet sync properties
  isAutoSynced?: boolean;      // True if synced from wallet
  lastSynced?: string;          // ISO timestamp of last sync
  isLiquid?: boolean;           // True if can be sold quickly
}

// Crypto-specific (auto-tracked via Solana)
export interface CryptoAsset {
  type: 'crypto';
  tokenMint?: string; // for SPL tokens
  quantity?: number;  // ✅ CHANGE: made optional instead of required
  balance?: number;   // ✅ ADD: token balance (same as quantity, for consistency)
  priceUSD?: number;  // ✅ ADD: price per token in USD
  symbol?: string;    // ✅ ADD: token symbol (SOL, USDC, etc)
  logoURI?: string;   // ✅ ADD: token logo for display
  mint?: string;      // ✅ ADD: token mint address
  protocol?: string; // 'Kamino', 'MarginFi', 'Marinade', etc.
  apy?: number;
  isStaked?: boolean;  // ✅ CHANGE: made optional
  walletAddress?: string; // ✅ CHANGE: made optional - which connected wallet
  description?: string;  // ✅ ADD: for manual entries
  coingeckoId?: string;  // for CoinGecko price lookups (e.g. 'bitcoin-cash')
}

// Real estate (manual entry, post-hackathon module)
export interface RealEstateAsset {
  type: 'real_estate';
  address?: string;  // ✅ CHANGE: made optional
  purchasePrice?: number;  // ✅ CHANGE: made optional
  currentValue?: number;  // ✅ CHANGE: made optional
  isPrimaryResidence?: boolean;
  monthlyRentalIncome?: number;
  mortgageBalance?: number;
  propertyTax?: number;
  monthlyExpenses?: number; // mortgage, taxes, insurance, maintenance
  description?: string;  // ✅ ADD: for simple entries
  apy?: number;  // ✅ ADD: for rental yield
}

// Stocks/bonds (manual entry)
export interface StockAsset {
  type: 'stocks';
  ticker?: string;
  shares?: number;  // Total shares (keep for consistency)
  quantity?: number;  // Same as shares (keep for consistency)
  currentPrice?: number;
  priceUSD?: number;  // Same as currentPrice (keep for consistency)
  dividendYield?: number;
  apy?: number;
  description?: string;

  // ✅ NEW: Vesting tracking
  vestedShares?: number;        // How many shares are vested (can sell)
  unvestedShares?: number;      // How many shares are locked
  vestingSchedule?: {
    sharesPerVest: number;      // e.g., 10 shares
    frequency: 'yearly' | 'quarterly' | 'monthly';
    nextVestDate?: string;      // ISO date string
  };
}

// Business interests (manual entry)
export interface BusinessAsset {
  type: 'business';
  equityPercent?: number;  // ✅ CHANGE: made optional
  valuation?: number;  // ✅ CHANGE: made optional
  annualDistributions?: number;  // ✅ CHANGE: made optional
  description?: string;  // ✅ ADD: for simple entries
  apy?: number;  // ✅ ADD: for yield calculations
}

// Other assets
export interface OtherAsset {
  type: 'other';
  description: string;
  apy?: number;  // ✅ ADD: for any yield-bearing "other" assets
  quantity?: number;  // ✅ ADD: for countable items
  balance?: number;   // ✅ ADD: same as quantity
  priceUSD?: number;  // ✅ ADD: unit price
  symbol?: string;    // ✅ ADD: for display
  logoURI?: string;   // ✅ ADD: for display
  mint?: string;      // ✅ ADD: for crypto-like "other" assets
  protocol?: string;  // ✅ ADD: for DeFi "other" assets
}

// Bank accounts as assets (checking/savings with interest)
export interface BankAsset {
  type: 'bank_account';
  accountType: 'checking' | 'savings' | 'investment';
  institution: string;
  apy?: number; // Savings account interest
  isEmergencyFund?: boolean;
  description?: string;  // ✅ ADD: for notes
}

// Retirement accounts (401k, IRA, etc.)
export interface RetirementAsset {
  type: 'retirement';
  accountType?: '401k' | 'roth_401k' | 'ira' | 'roth_ira';  // ✅ CHANGE: made optional
  institution?: string;  // ✅ CHANGE: made optional
  contributionAmount?: number;   // per pay period
  contributionFrequency?: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  employerMatchPercent?: number;
  employerMatchDollars?: number;
  description?: string;  // ✅ ADD: for notes
  apy?: number;  // ✅ ADD: for growth rate
}

export type ObligationCategory = 'housing' | 'utilities' | 'insurance' | 'debt_service' | 'daily_living' | 'retirement' | 'other';

export interface Obligation {
  id: string;
  name: string;
  payee?: string; // Who gets paid
  amount: number; // monthly
  category: ObligationCategory;
  transactionCategory?: BankTransactionCategory; // For bank transaction matching
  isRecurring: boolean;
  bankAccountId?: string; // Which account pays this
  autoPay?: boolean;
  dueDate?: number; // Day of month (1-31)
  isPaidThisMonth?: boolean;
  lastPaidDate?: string;
}

export type ScenarioType =
  | 'invest_cash'
  | 'buy_real_estate'
  | 'start_dividend'
  | 'increase_yield'
  | 'stake_crypto'
  | 'reduce_expenses'
  | 'side_hustle'
  | 'debt_payoff'
  | 'debt_refinance'
  | 'tax_optimization'
  | 'perena_yield'
  | 'hysa_transfer'
  | 'drift_yield'
  | 'goal_upgrade'
  | 'drift_withdraw'
  | 'kamino_lending'
  | 'custom';

export interface WhatIfScenario {
  id: string;
  type: ScenarioType;
  title: string;
  description: string;
  emoji: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeframe: string;
  changes: {
    addAssets?: Partial<Asset>[];
    removeAssets?: string[];
    updateAssets?: Array<{ id: string; updates: Partial<Asset> }>;
    addIncomeSources?: Partial<IncomeSource>[];
    reduceObligations?: Array<{ id: string; newAmount: number }>;
  };
  impact: {
    freedomBefore: number;
    freedomAfter: number;
    freedomDelta: number;
    monthlyIncomeBefore: number;
    monthlyIncomeAfter: number;
    monthlyIncomeDelta: number;
    annualIncomeDelta: number;
    investmentRequired: number;
    totalDeposit?: number;
    roi?: number;
  };
  reasoning: string;
  risks: string[];
  steps: string[];
}

export interface ThesisInvalidator {
  id: string;
  type: ThesisInvalidatorType;

  // Price-based triggers
  triggerPrice?: number;      // Absolute price (e.g., $0.0076)
  triggerPercent?: number;    // Percent from entry (e.g., -80)
  stagnantDays?: number;      // Days without 10% move

  // Time-based triggers
  deadline?: string;          // ISO date
  milestonePrice?: number;    // "Must reach $X by deadline"

  // Fundamental triggers
  condition?: string;         // Free text: "Team goes 3mo without updates"

  // Status
  isTriggered: boolean;
  triggeredAt?: string;       // ISO date when triggered

  description: string;        // Human-readable
}

export interface InvestmentThesis {
  id: string;
  assetId: string;            // Which asset this thesis is for

  // The Bull Case
  bullCase: string;           // Why you believe in this
  targetPrice?: number;       // Price target (e.g., $1.00 for WhiteWhale)
  targetDate?: string;        // ISO date - when you expect target
  timeHorizon: ThesisTimeHorizon;

  // Entry tracking
  entryPrice?: number;        // What you paid
  entryDate: string;          // ISO date - when you bought

  // Invalidation triggers
  invalidators: ThesisInvalidator[];

  // Tracking
  lastReviewed?: string;      // ISO date - last time you reviewed
  reviewFrequency: number;    // Days between reviews (30, 60, 90, 180)
  notes?: string;             // Additional notes

  createdAt: string;          // ISO date
  updatedAt: string;          // ISO date
}

export interface ThesisAlert {
  id: string;
  thesisId: string;
  assetId: string;
  assetName: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  type: 'invalidator_triggered' | 'review_due' | 'milestone_reached' | 'target_reached';

  message: string;
  action: 'sell' | 'review' | 'update' | 'celebrate';

  invalidatorId?: string;     // Which trigger caused this

  createdAt: string;
  dismissedAt?: string;
}

export type DesirePriority = 'high' | 'medium' | 'low';

export interface Desire {
  id: string;
  name: string;
  estimatedCost: number;
  priority: DesirePriority;
  category?: ObligationCategory;
  targetDate?: string; // ISO date string
  purchasedAt?: string; // ISO date string - when actually bought
  notes?: string;
  aiResearch?: {
    researchedAt: string;
    recommendation: string;
    alternatives?: Array<{
      name: string;
      price: number;
      reason: string;
    }>;
  };
  researchedProduct?: {
    name: string;
    price: number;
    url?: string;
    description?: string;
  };
  createdAt?: string;
  completedAt?: string;
}

export interface Debt {
  id: string;
  name: string;
  principal: number;
  interestRate: number; // as decimal (0.07 for 7%)
  monthlyPayment: number;
  minimumPayment: number;
  bankAccountId?: string; // Which account the payment comes out of
  transactionCategory?: BankTransactionCategory; // For bank transaction matching
  dueDate: number;
  isPaidThisMonth?: boolean;
  lastPaidDate?: string;
  payee?: string;
  balance?: number;
}

// ─── Paycheck Breakdown ──────────────────────────────────────────────────────
// Complete paycheck waterfall: Gross → Pre-tax → Taxes → Post-tax → Net

export type PreTaxDeductionType =
  | 'medical_coverage'
  | 'vision_coverage'
  | 'dental_coverage'
  | 'life_insurance'
  | 'add_insurance'  // AD&D
  | '401k_contribution'  // This goes here now, NOT in post-tax
  | 'other_pretax';

export type TaxType =
  | 'federal_withholding'
  | 'social_security'
  | 'medicare'
  | 'state_withholding';  // AZ W/H, etc.

export type PostTaxDeductionType =
  | '401k_loan'  // Loan repayment is POST-tax
  | 'enhanced_ltd'
  | 'other_posttax';

export interface PreTaxDeduction {
  id: string;
  name: string;
  type: PreTaxDeductionType;
  perPayPeriod: number;
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  notes?: string;
}

export interface Tax {
  id: string;
  name: string;  // "Federal W/H", "Social Security", "Medicare", "AZ W/H"
  type: TaxType;
  perPayPeriod: number;
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  notes?: string;
}

export interface PostTaxDeduction {
  id: string;
  name: string;
  type: PostTaxDeductionType;
  perPayPeriod: number;
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  notes?: string;
}

// DEPRECATED: keeping for backwards compatibility during migration
// Pre-tax paycheck deductions: things taken out before net pay hits any account.
// 401k contributions already live on RetirementAsset metadata.
// This covers: 401k loan repayments, healthcare premiums, and anything else pre-tax.
export type PaycheckDeductionType = 'retirement_loan' | 'healthcare' | 'other_pretax';

export interface PaycheckDeduction {
  id: string;
  name: string;                  // "401k Loan Repayment", "Blue Cross Health Plan"
  type: PaycheckDeductionType;
  perPayPeriod: number;          // the actual amount taken each paycheck
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  notes?: string;                // e.g. "5-year repayment term"
}

export interface FreedomScoreHistory {
  date: string; // ISO date string
  days: number;
  assetIncome: number;
  totalNeeds: number;
}

// ─── Drift Trading Tracker ───────────────────────────────────────────────────
export type DriftTradeDirection = 'long' | 'short';
export type DriftTradeAsset = 'ETH' | 'SOL' | 'BTC' | 'other';

export interface DriftTrade {
  id: string;
  date: string;                     // ISO date string — when the trade closed
  asset: DriftTradeAsset;
  direction: DriftTradeDirection;
  size: number;                     // position size in USD
  entryPrice: number;               // $ per token
  exitPrice: number;                // $ per token
  pnlUsdc: number;                  // realized profit/loss in USDC (can be negative) — ACTUAL from Drift
  fees?: number;                    // trading fees (theoretical PnL - actual PnL)
  notes?: string;                   // optional — e.g. "caught the breakout", "stopped out"
  platform?: string;                // 'drift', 'robinhood', 'binance', etc. Defaults to 'drift'
  allocation?: DriftProfitAllocation; // where the profit went (only relevant if pnlUsdc > 0)
}

// When you close a profitable trade, you allocate the USDC profit somewhere.
// Tracks the waterfall: USDC profit → crypto.com card, bank, crypto buys, or stays in Drift.
export interface DriftProfitAllocation {
  toCryptoComCard: number;          // usually $175/day
  toBankAccounts: number;           // USDC → bank transfer (legacy — use goalAllocations)
  toCryptoBuys: number;             // bought other tokens (legacy — use goalAllocations)
  leftInDrift: number;              // stayed as collateral, grows the account
  goalAllocations?: GoalAllocation[];  // goal-based profit routing
}

export interface GoalAllocation {
  goalId: string;
  goalName: string;
  emoji: string;
  amount: number;
  mint?: string;                    // if crypto goal, the token mint for swapping
  symbol?: string;                  // e.g. 'WHALE', 'dSOL'
  type: 'crypto' | 'bank' | 'other';
}

// ─── Daily Expense Tracker ───────────────────────────────────────────────────
// Optional: track every expense manually (alternative to using daily_living estimate)
export type DailyExpenseCategory =
  | 'daily_spend'      // crypto.com card daily budget
  | 'transfer'         // Xfer - moving money between accounts
  | 'smoking'
  | 'food_grocery'
  | 'food_dad_lunch'   // separate from general dining out
  | 'food_restaurants'
  | 'medical'
  | 'business'
  | 'housing'
  | 'utilities'
  | 'transport'
  | 'entertainment'
  | 'other';

export interface DailyExpense {
  id: string;
  date: string;                     // ISO date string
  category: DailyExpenseCategory;
  description: string;              // payee or note (e.g. "Circle K", "Per Diem")
  amount: number;                   // positive = spent, negative = received/refund
  notes?: string;
}

// Tracks the crypto.com card balance (topped up from USDC)
export interface CryptoCardBalance {
  currentBalance: number;           // current balance on the card
  lastUpdated: string;              // ISO timestamp of last manual sync
}

export interface UserSettings {
  avatarType: AvatarType;
  animatedAvatar?: boolean;
  notificationsEnabled: boolean;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  darkMode: boolean;
  defaultExpandAssetSections: boolean;
  dailyExpenseAccountId?: string;
  tradingPlatform?: 'drift' | 'manual';  // which trading platform the user uses
  driftMinCollateral?: number;  // minimum USDC to keep in Drift for trading (default 5000)
}

export interface UserProfile {
  wallets: string[]; // Solana pubkeys
  bankAccounts: BankAccount[]; // NEW - core financial tracking
  income: Income;
  assets: Asset[]; // both auto-tracked and manual
  obligations: Obligation[];
  desires: Desire[];
  debts: Debt[];
  bankTransactions?: BankTransaction[];
  paycheckDeductions: PaycheckDeduction[]; // DEPRECATED - use preTaxDeductions, taxes, postTaxDeductions instead
  preTaxDeductions: PreTaxDeduction[];  // Medical, dental, 401k contributions, etc.
  taxes: Tax[];  // Federal W/H, Social Security, Medicare, State W/H
  postTaxDeductions: PostTaxDeduction[];  // 401k loan, Enhanced LTD, etc.
  driftTrades: DriftTrade[];   // trading journal for Drift perpetuals
  dailyExpenses: DailyExpense[]; // optional manual expense tracking
  cryptoCardBalance: CryptoCardBalance; // crypto.com card balance tracker
  expenseTrackingMode: 'estimate' | 'manual'; // estimate uses daily_living obligation, manual logs every expense
  freedomHistory: FreedomScoreHistory[];
  investmentTheses: InvestmentThesis[];
  whatIfScenarios: WhatIfScenario[],
  thesisAlerts: ThesisAlert[];
  monthlyDiscretionary: number; // estimated monthly variable spending (groceries, gas, dining, etc.)
  customCategories: Record<string, CustomCategoryDef>; // user-created categories keyed by custom_* slug
  settings: UserSettings;
  lastSynced?: string; // ISO timestamp
  onboardingComplete: boolean;
}

// Helius ORB API response types (simplified)
export interface HeliusToken {
  mint: string;
  symbol: string;
  balance: number;
  price: number;
  decimals: number;
}

export interface HeliusDeFiPosition {
  protocol: string;
  type: 'staked' | 'lending' | 'liquidity';
  positionId: string;
  value: number;
  amount: number;
  underlyingToken: string;
  apy: number;
}

export interface HeliusWalletData {
  address: string;
  tokens: HeliusToken[];
  defiPositions?: HeliusDeFiPosition[];
  nativeBalance: number; // SOL balance
}

// Freedom calculation result
export interface FreedomResult {
  days: number; // days of freedom
  formatted: string; // "32 days", "2 years", "Forever"
  state: FreedomState; // which avatar state to show
  dailyAssetIncome: number;
  dailyNeeds: number;
  isKinged: boolean; // true if infinite freedom
}
