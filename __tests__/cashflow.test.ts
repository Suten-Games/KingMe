// __tests__/cashflow.test.ts
// Unit tests for cash flow analysis — income calculations, obligation totals, account analysis

import {
  getMonthlyIncomeForAccount,
  getMonthlyObligationsForAccount,
  analyzeAccount,
  analyzeAllAccounts,
} from '../src/services/cashflow';
import { obligationMonthlyAmount } from '../src/types';
import type { BankAccount, IncomeSource, Obligation, Debt } from '../src/types';

// ─── obligationMonthlyAmount ────────────────────────────────────────────────

describe('obligationMonthlyAmount', () => {
  it('returns amount directly for monthly frequency', () => {
    expect(obligationMonthlyAmount({ amount: 100, frequency: 'monthly' })).toBe(100);
  });

  it('defaults to monthly when no frequency specified', () => {
    expect(obligationMonthlyAmount({ amount: 250 })).toBe(250);
  });

  it('converts weekly to monthly (×52/12)', () => {
    const result = obligationMonthlyAmount({ amount: 100, frequency: 'weekly' });
    expect(result).toBeCloseTo(433.33, 1);
  });

  it('converts biweekly to monthly (×26/12)', () => {
    const result = obligationMonthlyAmount({ amount: 100, frequency: 'biweekly' });
    expect(result).toBeCloseTo(216.67, 1);
  });

  it('converts quarterly to monthly (÷3)', () => {
    expect(obligationMonthlyAmount({ amount: 300, frequency: 'quarterly' })).toBe(100);
  });

  it('converts yearly to monthly (÷12)', () => {
    expect(obligationMonthlyAmount({ amount: 1200, frequency: 'yearly' })).toBe(100);
  });
});

// ─── getMonthlyIncomeForAccount ─────────────────────────────────────────────

describe('getMonthlyIncomeForAccount', () => {
  const sources: IncomeSource[] = [
    { id: 's1', source: 'salary', name: 'Job', amount: 3000, frequency: 'biweekly', bankAccountId: 'ba_1' },
    { id: 's2', source: 'other', name: 'Freelance', amount: 500, frequency: 'monthly', bankAccountId: 'ba_1' },
    { id: 's3', source: 'salary', name: 'Other Job', amount: 2000, frequency: 'biweekly', bankAccountId: 'ba_2' },
  ];

  it('sums only income sources for the given account', () => {
    const result = getMonthlyIncomeForAccount(sources, 'ba_1');
    // 3000 * 26/12 + 500 = 6500 + 500 = 7000
    expect(result).toBeCloseTo(7000, 0);
  });

  it('returns 0 for account with no income sources', () => {
    expect(getMonthlyIncomeForAccount(sources, 'ba_99')).toBe(0);
  });

  it('handles weekly frequency', () => {
    const weekly: IncomeSource[] = [
      { id: 's1', source: 'other', name: 'Tips', amount: 200, frequency: 'weekly', bankAccountId: 'ba_1' },
    ];
    expect(getMonthlyIncomeForAccount(weekly, 'ba_1')).toBeCloseTo(866.67, 0);
  });

  it('handles quarterly frequency', () => {
    const quarterly: IncomeSource[] = [
      { id: 's1', source: 'other', name: 'Bonus', amount: 3000, frequency: 'quarterly', bankAccountId: 'ba_1' },
    ];
    expect(getMonthlyIncomeForAccount(quarterly, 'ba_1')).toBe(1000);
  });
});

// ─── getMonthlyObligationsForAccount ────────────────────────────────────────

describe('getMonthlyObligationsForAccount', () => {
  const obligations: Obligation[] = [
    { id: 'o1', name: 'Rent', amount: 1500, category: 'housing', isRecurring: true, dueDate: 1, bankAccountId: 'ba_1' },
    { id: 'o2', name: 'Electric', amount: 150, category: 'utilities', isRecurring: true, dueDate: 10, bankAccountId: 'ba_1' },
    { id: 'o3', name: 'Phone', amount: 50, category: 'utilities', isRecurring: true, dueDate: 15, bankAccountId: 'ba_2' },
    { id: 'o4', name: 'Unassigned', amount: 100, category: 'other', isRecurring: true, dueDate: 1 }, // no bankAccountId
  ];

  it('sums only obligations for the given account', () => {
    expect(getMonthlyObligationsForAccount(obligations, 'ba_1')).toBe(1650);
  });

  it('excludes unassigned obligations', () => {
    expect(getMonthlyObligationsForAccount(obligations, 'ba_1')).toBe(1650); // not 1750
  });

  it('returns 0 for account with no obligations', () => {
    expect(getMonthlyObligationsForAccount(obligations, 'ba_99')).toBe(0);
  });
});

// ─── analyzeAccount ─────────────────────────────────────────────────────────

describe('analyzeAccount', () => {
  const account: BankAccount = {
    id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase', isPrimaryIncome: true,
  };
  const sources: IncomeSource[] = [
    { id: 's1', source: 'salary', name: 'Job', amount: 2000, frequency: 'biweekly', bankAccountId: 'ba_1' },
  ];
  const obligations: Obligation[] = [
    { id: 'o1', name: 'Rent', amount: 1500, category: 'housing', isRecurring: true, dueDate: 1, bankAccountId: 'ba_1' },
    { id: 'o2', name: 'Electric', amount: 200, category: 'utilities', isRecurring: true, dueDate: 10, bankAccountId: 'ba_1' },
  ];
  const debts: Debt[] = [];

  it('calculates monthly net correctly', () => {
    const result = analyzeAccount(account, sources, obligations, debts);
    // Income: 2000 * 26/12 = 4333.33, Obligations: 1700
    expect(result.monthlyIncome).toBeCloseTo(4333.33, 0);
    expect(result.monthlyObligations).toBe(1700);
    expect(result.monthlyNet).toBeCloseTo(2633.33, 0);
  });

  it('marks account as tight when runway < 90 days', () => {
    const result = analyzeAccount(account, sources, obligations, debts);
    expect(result.status).toBe('tight');
  });

  it('marks account as deficit when obligations > income', () => {
    const bigObligations: Obligation[] = [
      { id: 'o1', name: 'Rent', amount: 5000, category: 'housing', isRecurring: true, dueDate: 1, bankAccountId: 'ba_1' },
    ];
    const result = analyzeAccount(account, sources, bigObligations, debts);
    expect(result.status).toBe('deficit');
  });

  it('handles NaN balance gracefully', () => {
    const badAccount = { ...account, currentBalance: NaN };
    const result = analyzeAccount(badAccount, sources, obligations, debts);
    expect(result.currentBalance).toBe(0);
  });

  it('calculates days of runway from balance', () => {
    const result = analyzeAccount(account, sources, obligations, debts);
    // Daily burn = 1700/30 ≈ 56.67, Runway = 5000/56.67 ≈ 88
    expect(result.daysOfRunway).toBeGreaterThan(80);
    expect(result.daysOfRunway).toBeLessThan(100);
  });
});

// ─── analyzeAllAccounts ─────────────────────────────────────────────────────

describe('analyzeAllAccounts', () => {
  it('includes unassigned obligations in totalMonthlyObligations', () => {
    const accounts: BankAccount[] = [
      { id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase', isPrimaryIncome: true },
    ];
    const sources: IncomeSource[] = [
      { id: 's1', source: 'salary', name: 'Job', amount: 4000, frequency: 'monthly', bankAccountId: 'ba_1' },
    ];
    const assigned: Obligation[] = [
      { id: 'o1', name: 'Rent', amount: 1500, category: 'housing', isRecurring: true, dueDate: 1, bankAccountId: 'ba_1' },
    ];
    const unassigned: Obligation[] = [
      { id: 'o2', name: 'Phone', amount: 100, category: 'utilities', isRecurring: true, dueDate: 15 },
    ];

    const result = analyzeAllAccounts(accounts, sources, [...assigned, ...unassigned], []);
    expect(result.totalMonthlyObligations).toBe(1600); // 1500 + 100
    expect(result.unassignedObligations).toHaveLength(1);
  });

  it('sums debt payments into total outflow', () => {
    const accounts: BankAccount[] = [
      { id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase', isPrimaryIncome: true },
    ];
    const sources: IncomeSource[] = [
      { id: 's1', source: 'salary', name: 'Job', amount: 5000, frequency: 'monthly', bankAccountId: 'ba_1' },
    ];
    const debts: Debt[] = [
      { id: 'd1', name: 'Car Loan', principal: 20000, interestRate: 0.05, monthlyPayment: 400, minimumPayment: 400, dueDate: 5 },
      { id: 'd2', name: 'Credit Card', principal: 5000, interestRate: 0.20, monthlyPayment: 150, minimumPayment: 75, dueDate: 20 },
    ];

    const result = analyzeAllAccounts(accounts, sources, [], debts);
    expect(result.totalMonthlyDebtPayments).toBe(550);
  });

  it('reports critical status when spending exceeds income', () => {
    const accounts: BankAccount[] = [
      { id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 500, institution: 'Chase', isPrimaryIncome: true },
    ];
    const sources: IncomeSource[] = [
      { id: 's1', source: 'salary', name: 'Job', amount: 2000, frequency: 'monthly', bankAccountId: 'ba_1' },
    ];
    const obligations: Obligation[] = [
      { id: 'o1', name: 'Rent', amount: 2500, category: 'housing', isRecurring: true, dueDate: 1, bankAccountId: 'ba_1' },
    ];

    const result = analyzeAllAccounts(accounts, sources, obligations, []);
    expect(result.healthStatus).toBe('critical');
    expect(result.totalMonthlyNet).toBeLessThan(0);
  });

  it('reports critical status when no income exists', () => {
    const accounts: BankAccount[] = [
      { id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 1000, institution: 'Chase', isPrimaryIncome: true },
    ];
    const result = analyzeAllAccounts(accounts, [], [], []);
    expect(result.healthStatus).toBe('critical');
  });
});
