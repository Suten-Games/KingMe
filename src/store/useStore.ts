// src/store/useStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserProfile, Asset, Obligation, Desire, Debt, Income, BankAccount, IncomeSource,
  AvatarType, PaycheckDeduction, DriftTrade, DailyExpense,
  PreTaxDeduction, Tax, PostTaxDeduction, UserSettings,
  WhatIfScenario, ThesisAlert, InvestmentThesis
} from '../types';
import { calculateFreedom } from '../utils/calculations';
import { syncDriftIncomeSource, getDefaultDriftIncomeAccount } from '../services/drift-income-sync';
import { exportProfile, importProfile } from '../services/backup';
import { generateSmartScenarios } from '../utils/scenarioGenerator';
import { BankTransaction, CustomCategoryDef } from '@/types/bankTransactionTypes';
import { getISODate, getISOWeek } from '../services/badgeEngine';
import {
  generateWindfallPlan,
  WINDFALL_THRESHOLD,
  type WindfallAlert,
} from '../services/windfallPlanner';
import { EarnedBadge } from '@/types/badges';
import { loadAllPlans, computePlanStats } from '../services/accumulationPlan';
import { loadGoals } from '../services/goals';
import { fetchAllMarketPrices } from '../services/marketPriceService';
import { lookupToken } from '../utils/tokenRegistry';
import type { CryptoAsset, StockAsset } from '../types';

interface AppState extends UserProfile {
  // Internal: tracks whether initial load from storage is complete
  _isLoaded: boolean;

  // Wallet sync state
  isLoadingAssets: boolean;
  lastAssetSync?: string;

  // Actions
  setAvatarType: (avatarType: AvatarType) => void;
  setIncome: (income: Partial<Income>) => void;
  addBankAccount: (account: BankAccount) => void;
  removeBankAccount: (accountId: string) => void;
  updateBankAccount: (accountId: string, account: Partial<BankAccount>) => void;
  addIncomeSource: (source: IncomeSource) => void;
  removeIncomeSource: (sourceId: string) => void;
  updateIncomeSource: (sourceId: string, source: Partial<IncomeSource>) => void;
  addAsset: (asset: Asset) => void;
  removeAsset: (assetId: string) => void;
  updateAsset: (assetId: string, asset: Partial<Asset>) => void;
  addObligation: (obligation: Obligation) => void;
  removeObligation: (obligationId: string) => void;
  updateObligation: (obligationId: string, obligation: Partial<Obligation>) => void;
  addDesire: (desire: Desire) => void;
  removeDesire: (desireId: string) => void;
  updateDesire: (desireId: string, desire: Partial<Desire>) => void;
  addDebt: (debt: Debt) => void;
  removeDebt: (debtId: string) => void;
  updateDebt: (debtId: string, debt: Partial<Debt>) => void;
  addPaycheckDeduction: (deduction: PaycheckDeduction) => void;
  removePaycheckDeduction: (deductionId: string) => void;
  updatePaycheckDeduction: (deductionId: string, deduction: Partial<PaycheckDeduction>) => void;
  addPreTaxDeduction: (deduction: PreTaxDeduction) => void;
  removePreTaxDeduction: (id: string) => void;
  updatePreTaxDeduction: (id: string, update: Partial<PreTaxDeduction>) => void;
  addTax: (tax: Tax) => void;
  removeTax: (id: string) => void;
  updateTax: (id: string, update: Partial<Tax>) => void;
  addPostTaxDeduction: (deduction: PostTaxDeduction) => void;
  removePostTaxDeduction: (id: string) => void;
  updatePostTaxDeduction: (id: string, update: Partial<PostTaxDeduction>) => void;
  addDriftTrade: (trade: DriftTrade) => void;
  removeDriftTrade: (tradeId: string) => void;
  updateDriftTrade: (tradeId: string, trade: Partial<DriftTrade>) => void;
  addDailyExpense: (expense: DailyExpense) => void;
  removeDailyExpense: (expenseId: string) => void;
  updateDailyExpense: (expenseId: string, expense: Partial<DailyExpense>) => void;
  setExpenseTrackingMode: (mode: 'estimate' | 'manual') => void;
  addBankTransaction: (transaction: BankTransaction) => void;
  removeBankTransaction: (transactionId: string) => void;
  updateBankTransaction: (transactionId: string, update: Partial<BankTransaction>) => void;
  importBankTransactions: (transactions: BankTransaction[]) => void;
  clearBankTransactions: (bankAccountId: string) => void;
  setCryptoCardBalance: (balance: number) => void;
  addCardDeposit: (amount: number, description?: string) => void;
  completeOnboarding: () => Promise<void>;
  loadProfile: (walletAddress: string) => Promise<void>;
  saveProfile: () => Promise<void>;
  exportBackup: () => string;
  importBackup: (jsonString: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;

  // Payment tracking actions
  toggleObligationPaid: (id: string) => void;
  toggleDebtPaid: (id: string) => void;
  resetMonthlyPayments: () => void;

  // Windfall Alerts
  windfallAlerts: WindfallAlert[];
  checkWindfall: (accountId: string, oldBalance: number, newBalance: number) => void;
  dismissWindfallAlert: (alertId: string) => void;

  // Wallet sync actions
  syncWalletAssets: (walletAddress: string) => Promise<void>;
  syncDriftAssets: (walletAddress: string) => Promise<void>;

  // Market price refresh (stocks via Yahoo, exchange crypto via CoinGecko)
  lastPriceRefresh?: string;
  refreshMarketPrices: () => Promise<void>;

  bankTransactions: BankTransaction[];

  // What-If Scenarios
  whatIfScenarios: WhatIfScenario[];

  // What-If Actions
  generateScenarios: () => void;
  applyScenario: (scenario: WhatIfScenario) => Promise<void>;
  checkThesisAlerts: () => void;
  dismissAlert: (alertId: string) => void;

  // Investment Thesis
  investmentTheses: InvestmentThesis[];
  thesisAlerts: ThesisAlert[];

  // Thesis Actions
  addThesis: (thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateThesis: (thesisId: string, updates: Partial<InvestmentThesis>) => void;
  removeThesis: (thesisId: string) => void;
  markThesisReviewed: (thesisId: string) => void;
  dismissThesisAlert: (alertId: string) => void;

  earnedBadges: EarnedBadge[];
  trimCount: number;
  importWeeks: string[];
  appOpenDays: string[];

  // Badge actions
  awardBadge: (badgeId: string) => void;
  markBadgeSeen: (badgeId: string) => void;
  recordTrim: () => void;
  recordImportWeek: () => void;
  recordAppOpen: () => void;

  setMonthlyDiscretionary: (amount: number) => void;
  addCustomCategory: (key: string, def: CustomCategoryDef) => void;
  removeCustomCategory: (key: string) => void;

  resetStore: () => void;
}

const initialState: UserProfile = {
  wallets: [],
  bankAccounts: [],
  income: {
    salary: 0,
    otherIncome: 0,
    assetIncome: 0,
    sources: [],
  },
  bankTransactions: [],
  assets: [],
  obligations: [],
  desires: [],
  debts: [],
  paycheckDeductions: [],
  driftTrades: [],
  dailyExpenses: [],
  preTaxDeductions: [],
  postTaxDeductions: [],
  taxes: [],
  cryptoCardBalance: { currentBalance: 0, lastUpdated: new Date().toISOString() },
  expenseTrackingMode: 'estimate', // default to estimate mode
  freedomHistory: [],
  settings: {
    avatarType: 'male-medium',
    notificationsEnabled: true,
    syncFrequency: 'hourly',
    darkMode: true,
    defaultExpandAssetSections: false,
  },
  onboardingComplete: false,
  whatIfScenarios: [],
  investmentTheses: [],
  thesisAlerts: [],
  monthlyDiscretionary: 0,
  customCategories: {},
  earnedBadges: [],
  trimCount: 0,
  importWeeks: [],
  appOpenDays: [],
  windfallAlerts: [],
};

// Helper: Map API category to app asset type
function mapCategoryToAssetType(category: string): Asset['type'] {
  switch (category) {
    case 'stocks':
    case 'commodities':
      return 'brokerage';
    case 'real_estate':
      return 'real_estate';
    case 'defi':
    case 'crypto':
    default:
      return 'crypto';
  }
}

export const useStore = create<AppState>((set, get) => ({
  ...initialState,
  _isLoaded: false, // NOT persisted, internal flag only
  isLoadingAssets: false,
  lastAssetSync: undefined,

  checkWindfall: (accountId: string, oldBalance: number, newBalance: number) => {
    const increase = newBalance - oldBalance;
    if (increase < WINDFALL_THRESHOLD) return;

    const state = get();
    const account = state.bankAccounts.find(a => a.id === accountId);
    if (!account) return;

    // Don't re-alert if there's already an active (undismissed) windfall for this account
    const existing = (state as any).windfallAlerts?.find(
      (a: WindfallAlert) => a.accountId === accountId && !a.dismissedAt
    );
    if (existing) return;

    // Calculate monthly expenses from obligations + debts
    const monthlyObligations = state.obligations.reduce((sum, o) => sum + (o.amount || 0), 0);
    const monthlyDebts = state.debts.reduce((sum, d) => sum + (d.monthlyPayment || 0), 0);
    const monthlyExpenses = monthlyObligations + monthlyDebts;

    // Build accumulation plan contexts from loaded plans
    // (accPlans come from AsyncStorage — load them inline)
    Promise.all([loadAllPlans(), loadGoals()]).then(([plans, goals]: [any, any]) => {
      const accPlans = Object.values(plans).map((p: any) => {
        const stats = computePlanStats(p, 0);
        return {
          mint: p.mint,
          symbol: p.symbol,
          targetAmount: p.targetAmount,
          currentHolding: stats.currentHolding,
          avgEntry: stats.costBasis,
          progressPct: stats.progressPct,
          strategy: 'accumulate' as const,
        };
      });

      const alert = generateWindfallPlan({
        windfallAmount: increase,
        newBalance,
        accountId,
        accountName: account.name,
        assets: state.assets,
        obligations: state.obligations,
        debts: state.debts,
        goals,
        accPlans,
        monthlyExpenses,
        exchangeName: (state as any).settings?.exchangeName,
      });

      set((s: any) => ({
        windfallAlerts: [...(s.windfallAlerts || []), alert],
      }));

      get().saveProfile();
      console.log(`[WINDFALL] Detected $${increase.toFixed(0)} increase in ${account.name}`);
    }).catch(console.error);
  },

  dismissWindfallAlert: (alertId: string) => {
    set((s: any) => ({
      windfallAlerts: (s.windfallAlerts || []).map((a: WindfallAlert) =>
        a.id === alertId ? { ...a, dismissedAt: new Date().toISOString() } : a
      ),
    }));
    get().saveProfile();
  },



  // What-If Scenarios
  whatIfScenarios: [],

  // ──────────────────────────────────────────────────────────────
  // INVESTMENT THESIS ACTIONS
  // ───────────────

  investmentTheses: [],
  thesisAlerts: [],

  addThesis: (thesisData) => {
    const thesis: InvestmentThesis = {
      ...thesisData,
      id: `thesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      investmentTheses: [...state.investmentTheses, thesis],
    }));

    console.log('[THESIS] Created:', thesis.bullCase.substring(0, 50) + '...');

    // Auto-save
    get().saveProfile();

    // Check for immediate alerts
    get().checkThesisAlerts();
  },

  updateThesis: (thesisId, updates) => {
    set((state) => ({
      investmentTheses: state.investmentTheses.map((t) =>
        t.id === thesisId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      ),
    }));

    console.log('[THESIS] Updated:', thesisId);

    get().saveProfile();
    get().checkThesisAlerts();
  },

  removeThesis: (thesisId) => {
    set((state) => ({
      investmentTheses: state.investmentTheses.filter((t) => t.id !== thesisId),
      thesisAlerts: state.thesisAlerts.filter((a) => a.thesisId !== thesisId),
    }));

    console.log('[THESIS] Removed:', thesisId);
    get().saveProfile();
  },

  markThesisReviewed: (thesisId) => {
    set((state) => ({
      investmentTheses: state.investmentTheses.map((t) =>
        t.id === thesisId
          ? {
            ...t,
            lastReviewed: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          : t
      ),
    }));

    console.log('[THESIS] Marked reviewed:', thesisId);
    get().saveProfile();
  },

  checkThesisAlerts: () => {
    const state = get();
    const alerts: ThesisAlert[] = [];
    const now = new Date();

    console.log('[THESIS] Checking alerts for', state.investmentTheses.length, 'theses');

    for (const thesis of state.investmentTheses) {
      // Find the asset
      const asset = state.assets.find((a) => a.id === thesis.assetId);
      if (!asset) {
        console.log('[THESIS] Asset not found for thesis:', thesis.id);
        continue;
      }

      const currentPrice = (asset.metadata as any)?.priceUSD || 0;

      // Check each invalidator
      for (const invalidator of thesis.invalidators) {
        if (invalidator.isTriggered) continue; // Already triggered

        // ── PRICE DROP ────────────────────────────────────────
        if (invalidator.type === 'price_drop') {
          if (invalidator.triggerPrice && currentPrice > 0) {
            if (currentPrice <= invalidator.triggerPrice) {
              // CRITICAL: Stop-loss hit
              alerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                thesisId: thesis.id,
                assetId: asset.id,
                assetName: asset.name,
                severity: 'critical',
                type: 'invalidator_triggered',
                message: `${asset.name} hit stop-loss at $${currentPrice.toFixed(4)}. Your trigger: $${invalidator.triggerPrice}`,
                action: 'sell',
                invalidatorId: invalidator.id,
                createdAt: new Date().toISOString(),
              });

              // Mark invalidator as triggered
              get().updateThesis(thesis.id, {
                invalidators: thesis.invalidators.map((inv) =>
                  inv.id === invalidator.id
                    ? { ...inv, isTriggered: true, triggeredAt: new Date().toISOString() }
                    : inv
                ),
              });
            }
            // WARNING: Approaching stop-loss (within 10%)
            else if (currentPrice <= invalidator.triggerPrice * 1.1) {
              alerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                thesisId: thesis.id,
                assetId: asset.id,
                assetName: asset.name,
                severity: 'warning',
                type: 'invalidator_triggered',
                message: `${asset.name} at $${currentPrice.toFixed(4)} is approaching stop-loss at $${invalidator.triggerPrice}`,
                action: 'review',
                invalidatorId: invalidator.id,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }

        // ── TIME-BASED ────────────────────────────────────────
        if (invalidator.type === 'time_based' && invalidator.deadline) {
          const deadline = new Date(invalidator.deadline);
          const daysLeft = Math.floor(
            (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysLeft <= 0) {
            // CRITICAL: Deadline passed
            const targetMet = invalidator.milestonePrice
              ? currentPrice >= invalidator.milestonePrice
              : false;

            alerts.push({
              id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              thesisId: thesis.id,
              assetId: asset.id,
              assetName: asset.name,
              severity: targetMet ? 'success' : 'critical',
              type: targetMet ? 'milestone_reached' : 'invalidator_triggered',
              message: targetMet
                ? `${asset.name} reached $${currentPrice.toFixed(4)} by deadline! 🎉`
                : `${asset.name} deadline passed. At $${currentPrice.toFixed(4)}, target was $${invalidator.milestonePrice}`,
              action: targetMet ? 'celebrate' : 'review',
              invalidatorId: invalidator.id,
              createdAt: new Date().toISOString(),
            });

            get().updateThesis(thesis.id, {
              invalidators: thesis.invalidators.map((inv) =>
                inv.id === invalidator.id
                  ? { ...inv, isTriggered: true, triggeredAt: new Date().toISOString() }
                  : inv
              ),
            });
          }
          // WARNING: Deadline approaching (30 days)
          else if (daysLeft <= 30) {
            alerts.push({
              id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              thesisId: thesis.id,
              assetId: asset.id,
              assetName: asset.name,
              severity: 'warning',
              type: 'review_due',
              message: `${asset.name}: ${daysLeft} days until thesis deadline. Current: $${currentPrice.toFixed(4)}, Target: $${invalidator.milestonePrice || thesis.targetPrice}`,
              action: 'review',
              invalidatorId: invalidator.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // ── CHECK IF REVIEW IS DUE ────────────────────────────
      if (thesis.lastReviewed) {
        const lastReview = new Date(thesis.lastReviewed);
        const daysSinceReview = Math.floor(
          (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceReview >= thesis.reviewFrequency) {
          alerts.push({
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            thesisId: thesis.id,
            assetId: asset.id,
            assetName: asset.name,
            severity: 'info',
            type: 'review_due',
            message: `${asset.name}: ${daysSinceReview} days since last review. Time to check your thesis.`,
            action: 'review',
            createdAt: new Date().toISOString(),
          });
        }
      }

      // ── CHECK IF TARGET PRICE REACHED ─────────────────────
      if (thesis.targetPrice && currentPrice >= thesis.targetPrice) {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          thesisId: thesis.id,
          assetId: asset.id,
          assetName: asset.name,
          severity: 'success',
          type: 'target_reached',
          message: `${asset.name} hit your target of $${thesis.targetPrice}! Current: $${currentPrice.toFixed(4)} 🎉`,
          action: 'celebrate',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Only keep non-dismissed alerts
    const existingAlerts = state.thesisAlerts.filter((a) => !a.dismissedAt);

    // Merge new alerts (avoid duplicates by checking message)
    const newAlerts = alerts.filter(
      (newAlert) =>
        !existingAlerts.some((existing) => existing.message === newAlert.message)
    );

    console.log('[THESIS] Generated', newAlerts.length, 'new alerts');

    set({ thesisAlerts: [...existingAlerts, ...newAlerts] });

    if (newAlerts.length > 0) {
      get().saveProfile();
    }
  },

  dismissThesisAlert: (alertId) => {
    set((state) => ({
      thesisAlerts: state.thesisAlerts.map((a) =>
        a.id === alertId
          ? { ...a, dismissedAt: new Date().toISOString() }
          : a
      ),
    }));

    console.log('[THESIS] Dismissed alert:', alertId);
    get().saveProfile();
  },

  setAvatarType: (avatarType) =>
    set((state) => ({
      settings: { ...state.settings, avatarType },
    })),

  updateSettings: (settings: Partial<UserSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...settings },
    }));
  },

  // Toggle payment status
  toggleObligationPaid: (id: string) => {
    set((state) => ({
      obligations: state.obligations.map(o =>
        o.id === id
          ? { ...o, isPaidThisMonth: !o.isPaidThisMonth, lastPaidDate: new Date().toISOString() }
          : o
      ),
    }));
  },

  toggleDebtPaid: (id: string) => {
    set((state) => ({
      debts: state.debts.map(d => {
        if (d.id !== id) return d;
        const wasPaid = d.isPaidThisMonth;
        const currentBalance = d.balance ?? d.principal;
        // When marking paid: reduce balance by monthly payment
        // When unmarking: restore the payment
        const newBalance = wasPaid
          ? currentBalance + d.monthlyPayment
          : Math.max(0, currentBalance - d.monthlyPayment);
        return {
          ...d,
          isPaidThisMonth: !wasPaid,
          lastPaidDate: new Date().toISOString(),
          balance: newBalance,
        };
      }),
    }));
  },

  // Reset monthly (call on app startup)
  resetMonthlyPayments: () => {
    set((state) => ({
      obligations: state.obligations.map(o => ({ ...o, isPaidThisMonth: false })),
      debts: state.debts.map(d => ({ ...d, isPaidThisMonth: false })),
    }));
  },

  setIncome: (income) =>
    set((state) => ({
      income: { ...state.income, ...income },
    })),

  // Bank Account actions
  addBankAccount: (account) =>
    set((state) => ({
      bankAccounts: [...state.bankAccounts, account],
    })),

  removeBankAccount: (accountId) =>
    set((state) => ({
      bankAccounts: state.bankAccounts.filter((a) => a.id !== accountId),
    })),

  updateBankAccount: (accountId: string, accountUpdate: Partial<any>) => {
    const state = get();
    const existing = state.bankAccounts.find(a => a.id === accountId);
    const oldBalance = existing?.currentBalance ?? 0;
    const newBalance = accountUpdate.currentBalance ?? oldBalance;

    set((s: any) => ({
      bankAccounts: s.bankAccounts.map((a: any) =>
        a.id === accountId ? { ...a, ...accountUpdate } : a
      ),
    }));

    // Check for windfall after update
    if (newBalance > oldBalance) {
      get().checkWindfall(accountId, oldBalance, newBalance);
    }
  },

  // Income Source actions
  addIncomeSource: (source) =>
    set((state) => ({
      income: {
        ...state.income,
        sources: [...(state.income.sources || []), source],
      },
    })),

  removeIncomeSource: (sourceId) =>
    set((state) => ({
      income: {
        ...state.income,
        sources: (state.income.sources || []).filter((s) => s.id !== sourceId),
      },
    })),

  updateIncomeSource: (sourceId, sourceUpdate) =>
    set((state) => ({
      income: {
        ...state.income,
        sources: (state.income.sources || []).map((s) =>
          s.id === sourceId ? { ...s, ...sourceUpdate } : s
        ),
      },
    })),

  addAsset: (asset) =>
    set((state) => {
      const newAssets = [...state.assets, asset];
      return { assets: newAssets };
    }),

  removeAsset: (assetId) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== assetId),
    })),

  updateAsset: (assetId, assetUpdate) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId ? { ...a, ...assetUpdate } : a
      ),
    })),

  addObligation: (obligation) =>
    set((state) => ({
      obligations: [...state.obligations, obligation],
    })),

  removeObligation: (obligationId) =>
    set((state) => ({
      obligations: state.obligations.filter((o) => o.id !== obligationId),
    })),

  updateObligation: (obligationId, obligationUpdate) =>
    set((state) => ({
      obligations: state.obligations.map((o) =>
        o.id === obligationId ? { ...o, ...obligationUpdate } : o
      ),
    })),

  addDesire: (desire) =>
    set((state) => ({
      desires: [...state.desires, desire],
    })),

  removeDesire: (desireId) =>
    set((state) => ({
      desires: state.desires.filter((d) => d.id !== desireId),
    })),

  updateDesire: (desireId, desireUpdate) =>
    set((state) => ({
      desires: state.desires.map((d) =>
        d.id === desireId ? { ...d, ...desireUpdate } : d
      ),
    })),

  addDebt: (debt) =>
    set((state) => ({
      debts: [...state.debts, { ...debt, balance: debt.balance ?? debt.principal }],
    })),

  removeDebt: (debtId) =>
    set((state) => ({
      debts: state.debts.filter((d) => d.id !== debtId),
    })),

  updateDebt: (debtId, debtUpdate) =>
    set((state) => ({
      debts: state.debts.map((d) =>
        d.id === debtId ? { ...d, ...debtUpdate } : d
      ),
    })),

  // PaycheckDeduction actions
  addPaycheckDeduction: (deduction) =>
    set((state) => ({
      paycheckDeductions: [...(state.paycheckDeductions || []), deduction],
    })),

  removePaycheckDeduction: (deductionId) =>
    set((state) => ({
      paycheckDeductions: (state.paycheckDeductions || []).filter((d) => d.id !== deductionId),
    })),

  updatePaycheckDeduction: (deductionId, deductionUpdate) =>
    set((state) => ({
      paycheckDeductions: (state.paycheckDeductions || []).map((d) =>
        d.id === deductionId ? { ...d, ...deductionUpdate } : d
      ),
    })),

  // Pre-Tax Deduction actions
  addPreTaxDeduction: (deduction) =>
    set((state) => ({
      preTaxDeductions: [...(state.preTaxDeductions || []), deduction],
    })),

  removePreTaxDeduction: (id) =>
    set((state) => ({
      preTaxDeductions: (state.preTaxDeductions || []).filter((d) => d.id !== id),
    })),

  updatePreTaxDeduction: (id, update) =>
    set((state) => ({
      preTaxDeductions: (state.preTaxDeductions || []).map((d) =>
        d.id === id ? { ...d, ...update } : d
      ),
    })),

  // Tax actions
  addTax: (tax) =>
    set((state) => ({
      taxes: [...(state.taxes || []), tax],
    })),

  removeTax: (id) =>
    set((state) => ({
      taxes: (state.taxes || []).filter((t) => t.id !== id),
    })),

  updateTax: (id, update) =>
    set((state) => ({
      taxes: (state.taxes || []).map((t) =>
        t.id === id ? { ...t, ...update } : t
      ),
    })),

  // Post-Tax Deduction actions
  addPostTaxDeduction: (deduction) =>
    set((state) => ({
      postTaxDeductions: [...(state.postTaxDeductions || []), deduction],
    })),

  removePostTaxDeduction: (id) =>
    set((state) => ({
      postTaxDeductions: (state.postTaxDeductions || []).filter((d) => d.id !== id),
    })),

  updatePostTaxDeduction: (id, update) =>
    set((state) => ({
      postTaxDeductions: (state.postTaxDeductions || []).map((d) =>
        d.id === id ? { ...d, ...update } : d
      ),
    })),

  // Drift Trade actions
  addDriftTrade: (trade) =>
    set((state) => {
      const newTrades = [...(state.driftTrades || []), trade];
      // Auto-sync: update income sources with this month's PnL
      const defaultAccount = getDefaultDriftIncomeAccount(state.bankAccounts);
      const updatedIncomeSources = syncDriftIncomeSource(newTrades, state.income.sources || [], defaultAccount);

      return {
        driftTrades: newTrades,
        income: { ...state.income, sources: updatedIncomeSources },
      };
    }),

  removeDriftTrade: (tradeId) =>
    set((state) => {
      const newTrades = (state.driftTrades || []).filter((t) => t.id !== tradeId);
      // Auto-sync: recalculate monthly PnL after removal
      const defaultAccount = getDefaultDriftIncomeAccount(state.bankAccounts);
      const updatedIncomeSources = syncDriftIncomeSource(newTrades, state.income.sources || [], defaultAccount);

      return {
        driftTrades: newTrades,
        income: { ...state.income, sources: updatedIncomeSources },
      };
    }),

  updateDriftTrade: (tradeId: string, tradeUpdate: Partial<DriftTrade>) =>
    set((state) => {
      const newTrades = (state.driftTrades || []).map((t) =>
        t.id === tradeId ? { ...t, ...tradeUpdate } : t
      );
      // Auto-sync income sources after update (keeping your existing logic)
      const defaultAccount = getDefaultDriftIncomeAccount(state.bankAccounts);
      const updatedIncomeSources = syncDriftIncomeSource(newTrades, state.income.sources || [], defaultAccount);
      return {
        driftTrades: newTrades,
        income: { ...state.income, sources: updatedIncomeSources },
      };
    }),

  // Daily Expense actions
  addDailyExpense: (expense) =>
    set((state) => {
      const linkedId = state.settings.dailyExpenseAccountId;
      const balanceDelta = expense.amount > 0 ? -expense.amount : Math.abs(expense.amount);

      // If linked to a bank account, adjust that account's balance
      if (linkedId) {
        return {
          dailyExpenses: [...(state.dailyExpenses || []), expense],
          bankAccounts: state.bankAccounts.map((a) =>
            a.id === linkedId
              ? { ...a, currentBalance: a.currentBalance + balanceDelta }
              : a
          ),
        };
      }

      // Fallback: adjust cryptoCardBalance
      return {
        dailyExpenses: [...(state.dailyExpenses || []), expense],
        cryptoCardBalance: {
          currentBalance: state.cryptoCardBalance.currentBalance + balanceDelta,
          lastUpdated: new Date().toISOString(),
        },
      };
    }),

  removeDailyExpense: (expenseId) =>
    set((state) => {
      const expenseToRemove = (state.dailyExpenses || []).find((e) => e.id === expenseId);
      if (!expenseToRemove) return state;

      const linkedId = state.settings.dailyExpenseAccountId;
      // Restore: reverse the original deduction
      const restoreDelta = expenseToRemove.amount > 0
        ? expenseToRemove.amount
        : -Math.abs(expenseToRemove.amount);

      const filtered = (state.dailyExpenses || []).filter((e) => e.id !== expenseId);

      if (linkedId) {
        return {
          dailyExpenses: filtered,
          bankAccounts: state.bankAccounts.map((a) =>
            a.id === linkedId
              ? { ...a, currentBalance: a.currentBalance + restoreDelta }
              : a
          ),
        };
      }

      return {
        dailyExpenses: filtered,
        cryptoCardBalance: {
          currentBalance: state.cryptoCardBalance.currentBalance + restoreDelta,
          lastUpdated: new Date().toISOString(),
        },
      };
    }),

  updateDailyExpense: (expenseId, expenseUpdate) =>
    set((state) => ({
      dailyExpenses: (state.dailyExpenses || []).map((e) =>
        e.id === expenseId ? { ...e, ...expenseUpdate } : e
      ),
    })),

  setExpenseTrackingMode: (mode) =>
    set({ expenseTrackingMode: mode }),

  setMonthlyDiscretionary: (amount) => set({ monthlyDiscretionary: amount }),

  addCustomCategory: (key, def) =>
    set((state) => ({
      customCategories: { ...state.customCategories, [key]: def },
    })),

  removeCustomCategory: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.customCategories;
      return { customCategories: rest };
    }),

  setCryptoCardBalance: (balance) =>
    set({
      cryptoCardBalance: {
        currentBalance: balance,
        lastUpdated: new Date().toISOString(),
      },
    }),

  bankTransactions: [],

  addBankTransaction: (transaction) =>
    set((state) => {
      const newTransactions = [...(state.bankTransactions || []), transaction];

      // Auto-update bank balance: expenses reduce, income increases
      const account = state.bankAccounts.find(a => a.id === transaction.bankAccountId);
      let updatedAccounts = state.bankAccounts;
      if (account) {
        const balanceChange = transaction.type === 'income'
          ? Math.abs(transaction.amount)
          : -Math.abs(transaction.amount);
        updatedAccounts = state.bankAccounts.map(a =>
          a.id === transaction.bankAccountId
            ? { ...a, currentBalance: (a.currentBalance ?? 0) + balanceChange }
            : a
        );
      }

      return {
        bankTransactions: newTransactions,
        bankAccounts: updatedAccounts,
      };
    }),

  awardBadge: (badgeId) =>
    set((state) => {
      // Don't award duplicates
      if ((state.earnedBadges || []).some(b => b.badgeId === badgeId)) return state;
      return {
        earnedBadges: [
          ...(state.earnedBadges || []),
          { badgeId, earnedAt: Date.now(), seen: false },
        ],
      };
    }),

  markBadgeSeen: (badgeId) =>
    set((state) => ({
      earnedBadges: (state.earnedBadges || []).map(b =>
        b.badgeId === badgeId ? { ...b, seen: true } : b
      ),
    })),

  recordTrim: () =>
    set((state) => ({
      trimCount: (state.trimCount || 0) + 1,
    })),

  recordImportWeek: () =>
    set((state) => {
      const week = getISOWeek();
      const existing = state.importWeeks || [];
      if (existing.includes(week)) return state;
      // Keep last 16 weeks
      const updated = [...existing, week].slice(-16);
      return { importWeeks: updated };
    }),

  recordAppOpen: () =>
    set((state) => {
      const today = getISODate();
      const existing = state.appOpenDays || [];
      if (existing.includes(today)) return state;
      // Keep last 30 days
      const updated = [...existing, today].slice(-30);
      return { appOpenDays: updated };
    }),

  removeBankTransaction: (transactionId) =>
    set((state) => {
      const transaction = (state.bankTransactions || []).find(t => t.id === transactionId);
      if (!transaction) return state;

      // Reverse the balance change
      const account = state.bankAccounts.find(a => a.id === transaction.bankAccountId);
      let updatedAccounts = state.bankAccounts;
      if (account) {
        const balanceReverse = transaction.type === 'income'
          ? -Math.abs(transaction.amount)
          : Math.abs(transaction.amount);
        updatedAccounts = state.bankAccounts.map(a =>
          a.id === transaction.bankAccountId
            ? { ...a, currentBalance: (a.currentBalance ?? 0) + balanceReverse }
            : a
        );
      }

      return {
        bankTransactions: (state.bankTransactions || []).filter(t => t.id !== transactionId),
        bankAccounts: updatedAccounts,
      };
    }),

  updateBankTransaction: (transactionId, update) =>
    set((state) => ({
      bankTransactions: (state.bankTransactions || []).map(t =>
        t.id === transactionId ? { ...t, ...update } : t
      ),
    })),

  importBankTransactions: (transactions) =>
    set((state) => {
      // Deduplicate: skip transactions with same date + amount + description
      const existing = state.bankTransactions || [];
      const existingKeys = new Set(
        existing.map(t => `${t.date}|${t.amount}|${t.description}`)
      );

      const newOnly = transactions.filter(
        t => !existingKeys.has(`${t.date}|${t.amount}|${t.description}`)
      );

      console.log(`[IMPORT] ${transactions.length} parsed, ${newOnly.length} new (${transactions.length - newOnly.length} duplicates skipped)`);

      // Record this week for streak tracking
      const week = getISOWeek();
      const existingWeeks = state.importWeeks || [];
      const updatedWeeks = existingWeeks.includes(week)
        ? existingWeeks
        : [...existingWeeks, week].slice(-16);

      return {
        bankTransactions: [...existing, ...newOnly],
        importWeeks: updatedWeeks,
      };
    }),

  clearBankTransactions: (bankAccountId) =>
    set((state) => ({
      bankTransactions: (state.bankTransactions || []).filter(
        t => t.bankAccountId !== bankAccountId
      ),
    })),


  addCardDeposit: (amount, description) =>
    set((state) => {
      const linkedId = state.settings.dailyExpenseAccountId;
      // Create a "transfer" expense entry for the deposit (negative amount = money in)
      const deposit: DailyExpense = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        category: 'transfer',
        description: description || 'Top-up from USDC',
        amount: -amount, // negative = received
      };

      if (linkedId) {
        return {
          dailyExpenses: [...(state.dailyExpenses || []), deposit],
          bankAccounts: state.bankAccounts.map((a) =>
            a.id === linkedId
              ? { ...a, currentBalance: a.currentBalance + amount }
              : a
          ),
        };
      }

      return {
        dailyExpenses: [...(state.dailyExpenses || []), deposit],
        cryptoCardBalance: {
          currentBalance: state.cryptoCardBalance.currentBalance + amount,
          lastUpdated: new Date().toISOString(),
        },
      };
    }),

  completeOnboarding: async () => {
    const state = get();

    // Calculate and save freedom score
    const freedom = calculateFreedom(state);
    const newHistory = [
      ...state.freedomHistory,
      {
        date: new Date().toISOString(),
        days: freedom.days,
        assetIncome: freedom.dailyAssetIncome * 365,
        totalNeeds: freedom.dailyNeeds * 365,
      },
    ];

    set({
      onboardingComplete: true,
      freedomHistory: newHistory,
    });

    // Save to storage
    await get().saveProfile();
    console.log('Onboarding completed and saved');
  },

  loadProfile: async (walletAddress: string) => {
    try {
      const profileJson = await AsyncStorage.getItem('kingme_profile');

      if (profileJson) {
        const saved = JSON.parse(profileJson);
        // Deep-merge: saved data wins, but any keys that exist in initialState
        // but are missing from the old save get their default values.
        // CRITICAL: explicitly handle all array fields to prevent undefined overwrites.
        const merged = {
          ...initialState,
          ...saved,
          income: { ...initialState.income, ...(saved.income || {}) },
          settings: { ...initialState.settings, ...(saved.settings || {}) },
          // Ensure arrays default to [] if missing from save
          bankTransactions: saved.bankTransactions ?? initialState.bankTransactions,
          bankAccounts: saved.bankAccounts ?? initialState.bankAccounts,
          assets: saved.assets ?? initialState.assets,
          obligations: saved.obligations ?? initialState.obligations,
          desires: saved.desires ?? initialState.desires,
          debts: saved.debts ?? initialState.debts,
          paycheckDeductions: saved.paycheckDeductions ?? initialState.paycheckDeductions,
          preTaxDeductions: saved.preTaxDeductions ?? initialState.preTaxDeductions,
          taxes: saved.taxes ?? initialState.taxes,
          postTaxDeductions: saved.postTaxDeductions ?? initialState.postTaxDeductions,
          driftTrades: saved.driftTrades ?? initialState.driftTrades,
          dailyExpenses: saved.dailyExpenses ?? initialState.dailyExpenses,
          cryptoCardBalance: saved.cryptoCardBalance ?? initialState.cryptoCardBalance,
          freedomHistory: saved.freedomHistory ?? initialState.freedomHistory,
          investmentTheses: saved.investmentTheses ?? [],
          thesisAlerts: saved.thesisAlerts ?? [],
          whatIfScenarios: saved.whatIfScenarios ?? [],
          // Ensure expenseTrackingMode defaults if missing
          expenseTrackingMode: saved.expenseTrackingMode ?? initialState.expenseTrackingMode,
          monthlyDiscretionary: saved.monthlyDiscretionary ?? initialState.monthlyDiscretionary,
          customCategories: saved.customCategories ?? initialState.customCategories,
          // Badge system
          earnedBadges: saved.earnedBadges ?? initialState.earnedBadges,
          trimCount: saved.trimCount ?? 0,
          importWeeks: saved.importWeeks ?? [],
          appOpenDays: saved.appOpenDays ?? [],
        };
        // Re-sync Drift trading income for current month.
        // Without this, a stale income source from last month persists
        // until the user adds/removes a trade (the only other sync triggers).
        const driftTrades = merged.driftTrades || [];
        const incomeSources = merged.income?.sources || [];
        const defaultAccount = getDefaultDriftIncomeAccount(merged.bankAccounts || []);
        const syncedSources = syncDriftIncomeSource(driftTrades, incomeSources, defaultAccount);
        merged.income = { ...merged.income, sources: syncedSources };

        // One-time migration: recategorize custom_hoes → personal_companion
        if (merged.bankTransactions?.some((t: any) => t.category === 'custom_hoes')) {
          merged.bankTransactions = merged.bankTransactions.map((t: any) =>
            t.category === 'custom_hoes' ? { ...t, category: 'personal_companion' } : t
          );
          if (merged.customCategories?.['custom_hoes']) {
            const { custom_hoes: _, ...restCats } = merged.customCategories;
            merged.customCategories = restCats;
          }
          console.log('[MIGRATE] Recategorized custom_hoes → personal_companion');
        }

        set(merged);
        console.log('Profile loaded successfully');
      }
      // Mark as loaded so auto-save can now fire
      set({ _isLoaded: true });
    } catch (error) {
      console.error('Failed to load profile:', error);
      set({ _isLoaded: true }); // still mark loaded so saves aren't permanently blocked
    }
  },

  saveProfile: async () => {
    try {
      const state = get();
      const profile: UserProfile = {
        wallets: state.wallets,
        bankAccounts: state.bankAccounts,
        income: state.income,
        assets: state.assets,
        obligations: state.obligations,
        desires: state.desires,
        debts: state.debts,
        paycheckDeductions: state.paycheckDeductions || [],
        bankTransactions: state.bankTransactions || [],
        preTaxDeductions: state.preTaxDeductions || [],
        taxes: state.taxes || [],
        postTaxDeductions: state.postTaxDeductions || [],
        driftTrades: state.driftTrades || [],
        investmentTheses: state.investmentTheses || [],
        thesisAlerts: state.thesisAlerts || [],
        whatIfScenarios: state.whatIfScenarios || [],
        dailyExpenses: state.dailyExpenses || [],
        cryptoCardBalance: state.cryptoCardBalance || { currentBalance: 0, lastUpdated: new Date().toISOString() },
        expenseTrackingMode: state.expenseTrackingMode || 'estimate',
        freedomHistory: state.freedomHistory || [],
        monthlyDiscretionary: state.monthlyDiscretionary || 0,
        customCategories: state.customCategories || {},
        settings: state.settings,
        onboardingComplete: state.onboardingComplete,
        lastSynced: new Date().toISOString(),
        // Badge system
        earnedBadges: state.earnedBadges || [],
        trimCount: state.trimCount || 0,
        importWeeks: state.importWeeks || [],
        appOpenDays: state.appOpenDays || [],
      };

      // For now, save unencrypted until we add wallet
      const profileJson = JSON.stringify(profile);
      await AsyncStorage.setItem('kingme_profile', profileJson);
      console.log('Profile saved successfully', { onboardingComplete: state.onboardingComplete });
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  },

  exportBackup: () => {
    const state = get();
    return exportProfile(state as UserProfile);
  },

  importBackup: (jsonString: string) => {
    try {
      const imported = importProfile(jsonString);
      // Merge with initialState to ensure all fields exist
      const merged = {
        ...initialState,
        ...imported,
        income: { ...initialState.income, ...(imported.income || {}) },
        settings: { ...initialState.settings, ...(imported.settings || {}) },
        bankAccounts: imported.bankAccounts ?? initialState.bankAccounts,
        assets: imported.assets ?? initialState.assets,
        obligations: imported.obligations ?? initialState.obligations,
        desires: imported.desires ?? initialState.desires,
        debts: imported.debts ?? initialState.debts,
        paycheckDeductions: imported.paycheckDeductions ?? initialState.paycheckDeductions,
        preTaxDeductions: imported.preTaxDeductions ?? initialState.preTaxDeductions,
        taxes: imported.taxes ?? initialState.taxes,
        postTaxDeductions: imported.postTaxDeductions ?? initialState.postTaxDeductions,
        driftTrades: imported.driftTrades ?? initialState.driftTrades,
        dailyExpenses: imported.dailyExpenses ?? initialState.dailyExpenses,
        bankTransactions: imported.bankTransactions ?? initialState.bankTransactions,
        cryptoCardBalance: imported.cryptoCardBalance ?? initialState.cryptoCardBalance,
        freedomHistory: imported.freedomHistory ?? initialState.freedomHistory,
        expenseTrackingMode: imported.expenseTrackingMode ?? initialState.expenseTrackingMode,
        investmentTheses: imported.investmentTheses ?? [],
        thesisAlerts: imported.thesisAlerts ?? [],
        whatIfScenarios: imported.whatIfScenarios ?? [],
        customCategories: imported.customCategories ?? initialState.customCategories,
        // Badge system
        earnedBadges: imported.earnedBadges ?? initialState.earnedBadges,
        trimCount: imported.trimCount ?? 0,
        importWeeks: imported.importWeeks ?? [],
        appOpenDays: imported.appOpenDays ?? [],
      };
      set(merged);
      // Save immediately after import
      get().saveProfile();
      console.log('Backup imported successfully');
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw error;
    }
  },

  generateScenarios: async () => {
    const state = get();
    const goals = await loadGoals();
    const profile = {
      assets: state.assets,
      incomeSources: state.income.sources || [],
      obligations: state.obligations,
      debts: state.debts,
      bankTransactions: state.bankTransactions || [],
      investmentTheses: state.investmentTheses || [],
      driftTrades: state.driftTrades || [],
      goals,
    };

    const scenarios = generateSmartScenarios(profile);
    set({ whatIfScenarios: scenarios });

    console.log(`[SCENARIOS] Generated ${scenarios.length} scenarios`);
  },

  applyScenario: async (scenario: WhatIfScenario) => {
    const state = get();
    let newAssets = [...state.assets];
    let newObligations = [...state.obligations];
    let newIncomeSources = [...(state.income.sources || [])];

    // Apply asset additions
    if (scenario.changes.addAssets) {
      scenario.changes.addAssets.forEach(partialAsset => {
        const newAsset: Asset = {
          id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: partialAsset.type || 'other',
          name: partialAsset.name || 'New Asset',
          value: partialAsset.value || 0,
          annualIncome: partialAsset.annualIncome || 0,
          isLiquid: partialAsset.isLiquid ?? true,
          metadata: partialAsset.metadata || { type: 'other', description: '' },
        };
        newAssets.push(newAsset);
        console.log(`[SCENARIO] Added asset: ${newAsset.name}`);
      });
    }

    // Apply asset updates
    if (scenario.changes.updateAssets) {
      scenario.changes.updateAssets.forEach(({ id, updates }) => {
        const index = newAssets.findIndex(a => a.id === id);
        if (index !== -1) {
          newAssets[index] = { ...newAssets[index], ...updates };
          console.log(`[SCENARIO] Updated asset: ${newAssets[index].name}`);
        }
      });
    }

    // Apply asset removals
    if (scenario.changes.removeAssets) {
      const beforeCount = newAssets.length;
      newAssets = newAssets.filter(a =>
        !scenario.changes.removeAssets!.includes(a.id)
      );
      console.log(`[SCENARIO] Removed ${beforeCount - newAssets.length} assets`);
    }

    // Apply obligation reductions
    if (scenario.changes.reduceObligations) {
      scenario.changes.reduceObligations.forEach(({ id, newAmount }) => {
        const index = newObligations.findIndex(o => o.id === id);
        if (index !== -1) {
          const oldAmount = newObligations[index].amount;
          newObligations[index] = {
            ...newObligations[index],
            amount: newAmount
          };
          console.log(`[SCENARIO] Reduced ${newObligations[index].name} from $${oldAmount} to $${newAmount}`);
        }
      });
    }

    // Apply income source additions
    if (scenario.changes.addIncomeSources) {
      scenario.changes.addIncomeSources.forEach(partialSource => {
        const newSource: IncomeSource = {
          id: `scenario_income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: partialSource.source || 'other',
          name: partialSource.name || 'New Income Source',
          amount: partialSource.amount || 0,
          frequency: partialSource.frequency || 'monthly',
          bankAccountId: partialSource.bankAccountId || state.bankAccounts[0]?.id || '',
        };
        newIncomeSources.push(newSource);
        console.log(`[SCENARIO] Added income source: ${newSource.name}`);
      });
    }

    // Update state
    set({
      assets: newAssets,
      obligations: newObligations,
      income: {
        ...state.income,
        sources: newIncomeSources,
      },
    });

    console.log(`[SCENARIO] Applied scenario: ${scenario.title}`);

    // Save immediately
    await get().saveProfile();

    // Regenerate scenarios with new state
    get().generateScenarios();
  },

  dismissAlert: (alertId: string) => {
    set((state) => ({
      thesisAlerts: state.thesisAlerts.filter(a => a.assetName !== alertId),
    }));
  },


  // ═══════════════════════════════════════════════════════════
  // WALLET SYNC
  // ═══════════════════════════════════════════════════════════

  syncWalletAssets: async (walletAddress: string) => {
    set({ isLoadingAssets: true });

    try {
      console.log('[SYNC] Starting wallet sync for', walletAddress);

      // Collect mints from manual assets for price lookup
      const currentAssets = get().assets;
      const manualAssets = currentAssets.filter(a => !a.isAutoSynced);
      const manualMints = manualAssets
        .map(a => (a.metadata as any)?.mint)
        .filter((m: string) => m && m.length > 10);

      if (manualMints.length > 0) {
        console.log(`[SYNC] Requesting prices for ${manualMints.length} manual asset mints`);
      }

      // Call your Vercel API
      const response = await fetch('https://kingme-iota.vercel.app/api/wallet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, manualMints }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const { assets: syncedAssets, totalValue, manualPrices } = await response.json();

      console.log(`[SYNC] Synced ${syncedAssets.length} assets worth $${(totalValue || 0).toFixed(2)}`);
      if (manualPrices && Object.keys(manualPrices).length > 0) {
        console.log(`[SYNC] Got ${Object.keys(manualPrices).length} manual asset prices from Jupiter`);
      }


      // Build lookup of existing auto-synced assets to preserve user-set data
      const existingAutoMap = new Map<string, typeof currentAssets[0]>();
      currentAssets.filter(a => a.isAutoSynced).forEach(a => {
        const meta = a.metadata as any;
        const mint = meta?.mint;
        if (mint) existingAutoMap.set(mint, a);       // index by mint
        existingAutoMap.set(a.id, a);                  // also index by id
      });

      // Commodity token symbols — these should be categorized as commodities, not crypto
      const COMMODITY_SYMBOLS = ['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'OIL', 'COPPER'];

      // Convert API assets to app format, PRESERVING user edits
      const newAutoAssets = syncedAssets.map((sa: any) => {
        // Safe handling of null prices
        const safePrice = sa.priceUSD || 0;
        const safeValue = sa.valueUSD || 0;
        const safeApy = sa.apy || 0;
        const assetId = `auto_${sa.mint}`;

        // Check if this is a commodity token by symbol
        const symbolUpper = (sa.symbol || '').toUpperCase();
        const isCommodity = COMMODITY_SYMBOLS.includes(symbolUpper) ||
          sa.category === 'commodities';
        const effectiveCategory = isCommodity ? 'commodities' : (sa.category || 'crypto');

        // Find existing asset by mint OR id
        const existing = existingAutoMap.get(sa.mint) || existingAutoMap.get(assetId);
        const existingMeta = (existing?.metadata || {}) as any;

        // Preserve user-set fields from existing asset
        const preservedApy = existingMeta.apy > 0 ? existingMeta.apy : (safeApy > 0 ? safeApy : 0);

        // Preserve value if API returns $0 but we had a real value (price feed outage)
        const preservedValue = safeValue > 0 ? safeValue :
          (existing?.value && existing.value > 0 ? existing.value : 0);
        const preservedPrice = safePrice > 0 ? safePrice :
          (existingMeta.priceUSD > 0 ? existingMeta.priceUSD : 0);

        const preservedAnnualIncome = preservedApy > 0
          ? (preservedValue * preservedApy) / 100
          : (existing?.annualIncome || 0);

        if (safeValue === 0 && existing?.value && existing.value > 0) {
          console.log(`[SYNC] ⚠️ ${sa.symbol}: API returned $0 but had $${existing.value.toFixed(2)} — preserving`);
        }

        // USER-PRESERVED FIELDS: type, name, protocol, positionType, leverage, etc.
        // Only use sync values for NEW tokens; preserve user edits on existing ones
        const preservedType = existing
          ? existing.type                                  // keep user's type (e.g. 'defi')
          : mapCategoryToAssetType(effectiveCategory);     // new token: use Helius category
        const preservedSubtype = existing
          ? (existing as any).subtype
          : (effectiveCategory === 'crypto' ? undefined : effectiveCategory);
        const preservedName = existing
          ? existing.name                                  // keep user's rename
          : sa.name;                                       // new token: use Helius name

        console.log(`[SYNC] Asset: ${sa.symbol} | val=$${preservedValue.toFixed(2)} | apy=${preservedApy} | type=${preservedType} | ${existing ? 'EXISTING' : 'NEW'}`);

        return {
          id: existing?.id || assetId,
          type: preservedType,
          subtype: preservedSubtype,
          name: preservedName,
          value: preservedValue,
          annualIncome: preservedAnnualIncome,
          isLiquid: true,
          isAutoSynced: true,
          lastSynced: new Date().toISOString(),
          metadata: {
            // Start with existing metadata to preserve ALL user-set fields
            ...(existing ? existingMeta : {}),
            // Always update from sync: balance, price, logo, symbol, mint
            type: existingMeta.type || ('other' as const),
            description: existingMeta.description || sa.name,
            apy: preservedApy,
            balance: sa.balance || 0,
            quantity: sa.balance || 0,
            priceUSD: preservedPrice,
            mint: sa.mint,
            symbol: sa.symbol,
            decimals: sa.decimals ?? existingMeta.decimals,  // store token decimals for accurate swaps
            logoURI: existingMeta.logoURI || sa.logoURI,
            // These are PRESERVED from existing (spread above handles it,
            // but listed here for clarity of what we protect):
            // protocol, positionType, supplied, borrowed, leverage, healthFactor
          },
        };
      });

      // ── Update manual assets with fresh prices from Jupiter ──
      const syncedByMint = new Map<string, any>();
      const syncedBySymbol = new Map<string, any>();
      for (const sa of syncedAssets) {
        if (sa.mint) syncedByMint.set(sa.mint, sa);
        if (sa.symbol) syncedBySymbol.set(sa.symbol.toUpperCase(), sa);
      }

      const updatedManualAssets = manualAssets.map(asset => {
        const meta = asset.metadata || {} as any;
        const mint = meta.mint;
        const balance = meta.balance || 0;

        // First try: Jupiter price lookup (for staked positions etc.)
        if (mint && manualPrices && manualPrices[mint]) {
          const newPrice = manualPrices[mint].price;
          if (newPrice > 0 && balance > 0) {
            const newValue = balance * newPrice;
            console.log(`[SYNC] 📌 Manual "${asset.name}": ${balance} × $${newPrice.toFixed(6)} = $${newValue.toFixed(2)} (was $${asset.value.toFixed(2)})`);

            // Recalculate annual income if APY is set
            const apy = meta.apy || 0;
            const newAnnualIncome = apy > 0 ? (newValue * apy) / 100 : asset.annualIncome;

            return {
              ...asset,
              value: newValue,
              annualIncome: newAnnualIncome,
              lastSynced: new Date().toISOString(),
              metadata: {
                ...meta,
                priceUSD: newPrice,
              },
            };
          }
        }

        // Second try: match against wallet assets (for tokens held in wallet)
        let matched: any = null;
        if (mint) matched = syncedByMint.get(mint);
        if (!matched && meta.symbol && !meta.protocol) matched = syncedBySymbol.get(meta.symbol.toUpperCase());

        if (matched) {
          const newValue = matched.valueUSD || 0;
          const newPrice = matched.priceUSD || 0;
          if (newValue > 0 || newPrice > 0) {
            console.log(`[SYNC] 📌 Manual "${asset.name}" matched wallet asset: $${asset.value.toFixed(2)} → $${newValue.toFixed(2)}`);
            return {
              ...asset,
              value: newValue > 0 ? newValue : asset.value,
              lastSynced: new Date().toISOString(),
              metadata: {
                ...meta,
                priceUSD: newPrice > 0 ? newPrice : (meta.priceUSD || 0),
                balance: matched.balance || meta.balance || 0,
              },
            };
          }
        }

        return asset;
      });

      // Build set of mints/symbols that matched manual assets (to avoid duplicates)
      const manualMatchedMints = new Set<string>();
      const manualMatchedSymbols = new Set<string>();
      for (const asset of updatedManualAssets) {
        const meta = asset.metadata || {} as any;
        if (meta.mint) {
          const matched = syncedByMint.get(meta.mint);
          if (matched) manualMatchedMints.add(matched.mint);
        }
        if (meta.symbol && !meta.protocol) {
          const matched = syncedBySymbol.get(meta.symbol.toUpperCase());
          if (matched) manualMatchedSymbols.add(matched.symbol?.toUpperCase());
        }
      }

      // Filter out auto-synced assets that duplicate a manual asset
      const dedupedAutoAssets = newAutoAssets.filter((a: any) => {
        const sym = (a.metadata?.symbol || '').toUpperCase();
        const mint = a.metadata?.mint || '';
        if (manualMatchedMints.has(mint) || manualMatchedSymbols.has(sym)) {
          console.log(`[SYNC] Skipping auto "${a.name}" — manual asset exists`);
          return false;
        }
        return true;
      });

      // Merge: updated manual + deduped auto-synced
      const allAssets = [...updatedManualAssets, ...dedupedAutoAssets];

      // Merge: manual + auto
      set({
        assets: allAssets,
        isLoadingAssets: false,
        lastAssetSync: new Date().toISOString(),
      });

      const manualUpdatedCount = updatedManualAssets.filter((a, i) => a !== manualAssets[i]).length;
      const dedupCount = newAutoAssets.length - dedupedAutoAssets.length;
      console.log(`[SYNC] Complete: ${updatedManualAssets.length} manual (${manualUpdatedCount} price-updated) + ${dedupedAutoAssets.length} synced (${dedupCount} deduped)`);

      // Save immediately
      await get().saveProfile();

      // Chain: refresh stock/exchange crypto prices after wallet sync
      get().refreshMarketPrices().catch(console.error);

      // Chain: sync Drift balances after wallet sync
      get().syncDriftAssets(walletAddress).catch(err =>
        console.warn('[DRIFT-SYNC] Drift sync failed (non-blocking):', err.message)
      );

    } catch (error: any) {
      console.error('[SYNC] Error:', error);
      set({ isLoadingAssets: false });
      throw error;
    }
  },

  // ─── Drift Balance Sync ──────────────────────────────────────────────────
  syncDriftAssets: async (walletAddress: string) => {
    const DRIFT_API_BASE = 'https://kingme-api.vercel.app/api/drift';
    // RPC URL: try client env vars, but API has its own fallback via HELIUS_RPC_URL
    const heliusKey = process.env.EXPO_PUBLIC_HELIUS_API_KEY || '';
    const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC
      || (heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}` : '');

    // Mint addresses for Drift spot tokens (for Jupiter price lookup)
    const DRIFT_MINTS: Record<string, string> = {
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      SOL: 'So11111111111111111111111111111111111111112',
      dSOL: 'Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ',
      syrupUSDC: 'AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj',
      DRIFT: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
      mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      wBTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
      wETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      JLP: '27G8MtK7VtTcCLVkG89EjDBCz48UTsRRwA3yMZhJNrE6',
      JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
      HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
      bSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    };

    console.log(`[DRIFT-SYNC] Starting Drift balance sync for ${walletAddress.slice(0, 8)}... rpcUrl=${rpcUrl ? 'SET' : 'MISSING'}`);

    try {
      // 1. Fetch Drift balances and rates in parallel
      const fetchHeaders: Record<string, string> = {};
      if (rpcUrl) fetchHeaders['X-RPC-URL'] = rpcUrl;

      const balancesUrl = `${DRIFT_API_BASE}/balances?wallet=${walletAddress}&subAccount=1`;
      const ratesUrl = `${DRIFT_API_BASE}/rates`;
      console.log(`[DRIFT-SYNC] Fetching balances + rates...`);

      const [response, ratesRes] = await Promise.all([
        fetch(balancesUrl, { headers: fetchHeaders }),
        fetch(ratesUrl, { headers: fetchHeaders }).catch(() => null),
      ]);

      // Parse rates (non-blocking — use empty object if failed)
      let driftRates: Record<string, { depositApy: number }> = {};
      if (ratesRes?.ok) {
        const ratesData = await ratesRes.json();
        driftRates = ratesData.rates || {};
        console.log(`[DRIFT-SYNC] Got rates for ${Object.keys(driftRates).length} markets`);
      } else {
        console.warn('[DRIFT-SYNC] Rates fetch failed, APY will use existing values');
      }

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[DRIFT-SYNC] No Drift account found, skipping');
          return;
        }
        throw new Error(`Drift API error: ${response.status}`);
      }

      const data = await response.json();
      const { spotBalances } = data;

      if (!spotBalances || spotBalances.length === 0) {
        console.log('[DRIFT-SYNC] No spot balances, skipping');
        return;
      }

      console.log(`[DRIFT-SYNC] Got ${spotBalances.length} spot positions`);

      // 2. Build price map from existing assets (wallet sync already fetched prices)
      const currentAssets = get().assets;
      let prices: Record<string, number> = {
        USDC: 1,
        USDT: 1,
        syrupUSDC: 1,
      };
      for (const a of currentAssets) {
        const meta = a.metadata as any;
        if (meta?.symbol && meta?.priceUSD > 0) {
          prices[meta.symbol.toUpperCase()] = meta.priceUSD;
        }
      }
      // dSOL tracks ~1.19x SOL price (staking premium); derive if missing
      if (!prices['DSOL'] && prices['SOL']) {
        prices['DSOL'] = prices['SOL'] * 1.19;
        console.log(`[DRIFT-SYNC] dSOL price derived from SOL: $${prices['DSOL'].toFixed(2)}`);
      }
      console.log(`[DRIFT-SYNC] Prices from store: ${Object.entries(prices).map(([s,p]) => `${s}=$${(p as number).toFixed(2)}`).join(', ')}`);

      // 3. Build/merge assets — currentAssets already fetched above for prices

      // Index existing Drift assets by symbol for merging
      const existingDriftMap = new Map<string, typeof currentAssets[0]>();
      for (const a of currentAssets) {
        const meta = a.metadata as any;
        if (meta?.protocol?.toLowerCase() === 'drift' && meta.symbol) {
          existingDriftMap.set(meta.symbol.toUpperCase(), a);
        }
        // Also match by our stable drift ID
        if (a.id.startsWith('drift_')) {
          const sym = a.id.replace('drift_', '').toUpperCase();
          if (!existingDriftMap.has(sym)) existingDriftMap.set(sym, a);
        }
      }

      const driftAssetIds = new Set<string>();
      const newDriftAssets = spotBalances
        .filter((b: any) => b.balanceType === 'deposit' && b.scaledBalance > 0.001)
        .map((b: any) => {
          const sym = b.symbol;
          const mint = DRIFT_MINTS[sym];
          const price = prices[sym.toUpperCase()] || prices[sym] || 0;
          const balance = b.scaledBalance;
          const value = balance * price;
          const assetId = `drift_${sym}`;
          driftAssetIds.add(assetId);

          // Look up token info for logo
          const tokenInfo = lookupToken(sym);

          // Find existing asset to preserve user-set fields
          const existing = existingDriftMap.get(sym.toUpperCase());
          const existingMeta = (existing?.metadata || {}) as any;

          // APY: prefer live Drift rate, fall back to user-set value
          const liveApy = driftRates[sym]?.depositApy || 0;
          const preservedApy = liveApy > 0 ? liveApy : (existingMeta.apy || 0);
          const preservedName = existing?.name || `${sym} (Drift)`;
          const preservedAnnualIncome = preservedApy > 0
            ? (value * preservedApy) / 100
            : (existing?.annualIncome || 0);

          console.log(`[DRIFT-SYNC] ${sym}: ${balance.toFixed(4)} × $${price.toFixed(4)} = $${value.toFixed(2)} ${existing ? '(UPDATE)' : '(NEW)'}`);

          return {
            id: existing?.id || assetId,
            type: existing?.type || 'defi' as const,
            name: preservedName,
            value,
            annualIncome: preservedAnnualIncome,
            isLiquid: true,
            isAutoSynced: true,
            lastSynced: new Date().toISOString(),
            metadata: {
              // Preserve all user-set fields from existing
              ...(existing ? existingMeta : {}),
              type: existingMeta.type || ('crypto' as const),
              symbol: sym,
              mint: mint || existingMeta.mint,
              balance,
              quantity: balance,
              priceUSD: price,
              protocol: 'Drift',
              apy: preservedApy,
              isStaked: preservedApy > 0,
              logoURI: existingMeta.logoURI || tokenInfo?.logoURI || '',
              description: existingMeta.description || `${sym} on Drift`,
            },
          };
        });

      // 4. Merge: replace matching Drift assets, keep everything else
      const nonDriftAssets = currentAssets.filter(a => {
        // Remove old manual Drift assets that are now auto-synced
        const meta = a.metadata as any;
        const sym = (meta?.symbol || '').toUpperCase();
        if (meta?.protocol?.toLowerCase() === 'drift' && driftAssetIds.has(`drift_${sym}`)) {
          console.log(`[DRIFT-SYNC] Replacing manual "${a.name}" with auto-synced`);
          return false;
        }
        // Remove old auto-synced drift assets (will be replaced)
        if (a.id.startsWith('drift_') && driftAssetIds.has(a.id)) {
          return false;
        }
        return true;
      });

      const mergedAssets = [...nonDriftAssets, ...newDriftAssets];
      set({ assets: mergedAssets });

      console.log(`[DRIFT-SYNC] Complete: ${newDriftAssets.length} Drift positions synced`);

      // Save
      await get().saveProfile();

    } catch (error: any) {
      console.error('[DRIFT-SYNC] Error:', error.message);
    }
  },

  // ─── Market Price Refresh (Stocks + Exchange Crypto) ─────────────────────
  refreshMarketPrices: async () => {
    const { assets } = get();
    const stockTickers: string[] = [];
    const coingeckoMap: Record<string, string[]> = {}; // cgId → [assetId, ...]

    for (const asset of assets) {
      const meta = asset.metadata as any;

      // Stocks / brokerage with a ticker
      if ((asset.type === 'stocks' || asset.type === 'brokerage') && meta?.ticker) {
        stockTickers.push(meta.ticker.toUpperCase());
        continue;
      }

      // Crypto / defi that is NOT auto-synced and has NO Solana mint → use CoinGecko
      const isCryptoLike = asset.type === 'crypto' || asset.type === 'defi';
      if (isCryptoLike && !asset.isAutoSynced && !meta?.mint) {
        let cgId: string | undefined = meta?.coingeckoId;

        // Fallback: resolve via token registry if not saved on the asset
        if (!cgId && meta?.symbol) {
          const token = lookupToken(meta.symbol);
          if (token?.coingeckoId) cgId = token.coingeckoId;
        }

        if (cgId) {
          if (!coingeckoMap[cgId]) coingeckoMap[cgId] = [];
          coingeckoMap[cgId].push(asset.id);
        }
      }
    }

    const coingeckoIds = Object.keys(coingeckoMap);

    if (stockTickers.length === 0 && coingeckoIds.length === 0) {
      console.log('[MARKET] No stock/exchange-crypto assets to refresh');
      return;
    }

    console.log(`[MARKET] Refreshing: ${stockTickers.length} stocks, ${coingeckoIds.length} CoinGecko`);

    const result = await fetchAllMarketPrices({ stockTickers, coingeckoIds });

    const updatedAssets = assets.map((asset) => {
      const meta = asset.metadata as any;

      // ── Stock / Brokerage price update ──
      if ((asset.type === 'stocks' || asset.type === 'brokerage') && meta?.ticker) {
        const newPrice = result.stocks[meta.ticker.toUpperCase()];
        if (newPrice && newPrice > 0) {
          const shares = meta.shares || meta.quantity || 0;
          const newValue = shares * newPrice;
          const apy = meta.apy || meta.dividendYield || 0;
          const newIncome = apy > 0 ? newValue * (apy / 100) : asset.annualIncome;
          return {
            ...asset,
            value: newValue > 0 ? newValue : asset.value,
            annualIncome: newIncome,
            metadata: {
              ...meta,
              currentPrice: newPrice,
              priceUSD: newPrice,
            },
          };
        }
      }

      // ── CoinGecko crypto price update ──
      const isCryptoLike = asset.type === 'crypto' || asset.type === 'defi';
      if (isCryptoLike && !asset.isAutoSynced && !meta?.mint) {
        let cgId: string | undefined = meta?.coingeckoId;
        if (!cgId && meta?.symbol) {
          const token = lookupToken(meta.symbol);
          if (token?.coingeckoId) cgId = token.coingeckoId;
        }
        if (cgId) {
          const newPrice = result.crypto[cgId];
          if (newPrice && newPrice > 0) {
            const qty = meta.quantity || meta.balance || 0;
            const newValue = qty * newPrice;
            const apy = meta.apy || 0;
            const newIncome = apy > 0 ? newValue * (apy / 100) : asset.annualIncome;
            return {
              ...asset,
              value: newValue > 0 ? newValue : asset.value,
              annualIncome: newIncome,
              metadata: {
                ...meta,
                priceUSD: newPrice,
                coingeckoId: cgId, // persist resolved cgId for future refreshes
              },
            };
          }
        }
      }

      return asset;
    });

    set({
      assets: updatedAssets,
      lastPriceRefresh: new Date().toISOString(),
    } as any);

    await get().saveProfile();
    console.log('[MARKET] Price refresh complete');
  },

  resetStore: () => set(initialState),
}));

// Helper hook to get current freedom score
export const useFreedomScore = () => {
  const profile = useStore((state) => ({
    assets: state.assets,
    obligations: state.obligations,
    desires: state.desires,
    debts: state.debts,
    investmentTheses: state.investmentTheses,
  }));

  return calculateFreedom(profile as UserProfile);
};

// Auto-save on any state change (debounced)
// Guard: only save after the initial loadProfile completes (tracked by _isLoaded flag)
// Additional safety: wait 3 seconds after app start before allowing any saves
const APP_START_TIME = Date.now();
const MIN_STARTUP_DELAY = 3000; // 3 seconds

let saveTimeout: NodeJS.Timeout;
useStore.subscribe((state) => {
  if (!state._isLoaded) return; // don't save until first load is done
  if (Date.now() - APP_START_TIME < MIN_STARTUP_DELAY) return; // don't save during startup window

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    state.saveProfile();
  }, 2000); // increased from 1s to 2s
});
