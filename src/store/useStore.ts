// src/store/useStore.ts
import { create } from 'zustand';
import type { UserProfile, Asset, Obligation, Desire, Debt, Income, BankAccount, IncomeSource, AvatarType, PaycheckDeduction, DriftTrade, DailyExpense, CryptoCardBalance, PreTaxDeduction, Tax, PostTaxDeduction, UserSettings } from '../types';
import { saveUserProfile, loadUserProfile } from '../services/storage';
import { calculateFreedom } from '../utils/calculations';
import { syncDriftIncomeSource, getDefaultDriftIncomeAccount } from '../services/drift-income-sync';
import { exportProfile, importProfile } from '../services/backup';

interface AppState extends UserProfile {
  // Internal: tracks whether initial load from storage is complete
  _isLoaded: boolean;
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
  setCryptoCardBalance: (balance: number) => void;
  addCardDeposit: (amount: number, description?: string) => void;
  completeOnboarding: () => Promise<void>;
  loadProfile: (walletAddress: string) => Promise<void>;
  saveProfile: () => Promise<void>;
  exportBackup: () => string;
  importBackup: (jsonString: string) => void;
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
  assets: [],
  obligations: [],
  desires: [],
  debts: [],
  paycheckDeductions: [],
  driftTrades: [],
  dailyExpenses: [],
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
};

export const useStore = create<AppState>((set, get) => ({
  ...initialState,
  _isLoaded: false, // NOT persisted, internal flag only

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
      debts: state.debts.map(d =>
        d.id === id
          ? { ...d, isPaidThisMonth: !d.isPaidThisMonth, lastPaidDate: new Date().toISOString() }
          : d
      ),
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

  updateBankAccount: (accountId, accountUpdate) =>
    set((state) => ({
      bankAccounts: state.bankAccounts.map((a) =>
        a.id === accountId ? { ...a, ...accountUpdate } : a
      ),
    })),

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
      debts: [...state.debts, debt],
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

  updateDriftTrade: (tradeId, tradeUpdate) =>
    set((state) => {
      const newTrades = (state.driftTrades || []).map((t) =>
        t.id === tradeId ? { ...t, ...tradeUpdate } : t
      );
      // Auto-sync: recalculate monthly PnL after update
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
      // Auto-deduct from crypto.com card balance when expense is positive (spent)
      const newBalance = expense.amount > 0
        ? state.cryptoCardBalance.currentBalance - expense.amount
        : state.cryptoCardBalance.currentBalance + Math.abs(expense.amount); // refunds add back

      return {
        dailyExpenses: [...(state.dailyExpenses || []), expense],
        cryptoCardBalance: {
          currentBalance: newBalance,
          lastUpdated: new Date().toISOString(),
        },
      };
    }),

  removeDailyExpense: (expenseId) =>
    set((state) => {
      const expenseToRemove = (state.dailyExpenses || []).find((e) => e.id === expenseId);
      if (!expenseToRemove) return state;

      // Restore the amount back to the card balance
      const restoredBalance = expenseToRemove.amount > 0
        ? state.cryptoCardBalance.currentBalance + expenseToRemove.amount
        : state.cryptoCardBalance.currentBalance - Math.abs(expenseToRemove.amount);

      return {
        dailyExpenses: (state.dailyExpenses || []).filter((e) => e.id !== expenseId),
        cryptoCardBalance: {
          currentBalance: restoredBalance,
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

  setCryptoCardBalance: (balance) =>
    set({
      cryptoCardBalance: {
        currentBalance: balance,
        lastUpdated: new Date().toISOString(),
      },
    }),

  addCardDeposit: (amount, description) =>
    set((state) => {
      // Create a "transfer" expense entry for the deposit (negative amount = money in)
      const deposit: DailyExpense = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        category: 'transfer',
        description: description || 'Card top-up from USDC',
        amount: -amount, // negative = received
      };

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
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const profileJson = await AsyncStorage.default.getItem('kingme_profile');

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
          // Ensure expenseTrackingMode defaults if missing
          expenseTrackingMode: saved.expenseTrackingMode ?? initialState.expenseTrackingMode,
        };
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
        preTaxDeductions: state.preTaxDeductions || [],
        taxes: state.taxes || [],
        postTaxDeductions: state.postTaxDeductions || [],
        driftTrades: state.driftTrades || [],
        dailyExpenses: state.dailyExpenses || [],
        cryptoCardBalance: state.cryptoCardBalance || { currentBalance: 0, lastUpdated: new Date().toISOString() },
        expenseTrackingMode: state.expenseTrackingMode || 'estimate',
        freedomHistory: state.freedomHistory || [],
        settings: state.settings,
        onboardingComplete: state.onboardingComplete,
        lastSynced: new Date().toISOString(),
      };

      // For now, save unencrypted until we add wallet
      const profileJson = JSON.stringify(profile);
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.default.setItem('kingme_profile', profileJson);
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
        cryptoCardBalance: imported.cryptoCardBalance ?? initialState.cryptoCardBalance,
        freedomHistory: imported.freedomHistory ?? initialState.freedomHistory,
        expenseTrackingMode: imported.expenseTrackingMode ?? initialState.expenseTrackingMode,
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

  resetStore: () => set(initialState),
}));

// Helper hook to get current freedom score
export const useFreedomScore = () => {
  const profile = useStore((state) => ({
    assets: state.assets,
    obligations: state.obligations,
    desires: state.desires,
    debts: state.debts,
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
