// __tests__/scenarioGenerator.test.ts
// Unit tests for the What-If scenario generator — triggers, calculations, edge cases

import { generateSmartScenarios } from '../src/utils/scenarioGenerator';
import type { Asset, IncomeSource, Obligation, Debt } from '../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProfile(overrides: {
  assets?: Asset[];
  incomeSources?: IncomeSource[];
  obligations?: Obligation[];
  debts?: Debt[];
  bankAccounts?: Array<{ id: string; name: string; type: string; currentBalance: number; institution: string }>;
}) {
  return {
    assets: overrides.assets || [],
    incomeSources: overrides.incomeSources || [],
    obligations: overrides.obligations || [],
    debts: overrides.debts || [],
    bankAccounts: overrides.bankAccounts || [],
  };
}

function makeSalary(amount: number, frequency: string = 'monthly', bankAccountId: string = 'ba_1'): IncomeSource & { isActive: boolean } {
  return { id: 'is_1', source: 'salary', name: 'Job', amount, frequency: frequency as any, bankAccountId, isActive: true };
}

function makeObligation(name: string, amount: number, bankAccountId?: string): Obligation {
  return { id: `ob_${name}`, name, amount, category: 'other', isRecurring: true, dueDate: 1, bankAccountId };
}

function makeDebt(name: string, balance: number, rate: number, payment: number): Debt {
  return {
    id: `d_${name}`, name, principal: balance, interestRate: rate,
    monthlyPayment: payment, minimumPayment: payment, dueDate: 1, balance,
  };
}

// ─── Basic generation ───────────────────────────────────────────────────────

describe('generateSmartScenarios', () => {
  it('returns an array (even if empty)', () => {
    const result = generateSmartScenarios(makeProfile({}));
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns max 5 scenarios', () => {
    // Rich profile that should trigger many scenarios
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 2000, 'ba_1')],
      debts: [
        makeDebt('CC1', 10000, 0.22, 300),
        makeDebt('CC2', 8000, 0.19, 250),
        makeDebt('Car', 20000, 0.06, 400),
        makeDebt('Student', 30000, 0.05, 350),
      ],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 10000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('sorts scenarios by freedom delta (biggest improvement first)', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(4000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [
        makeDebt('CC', 10000, 0.22, 300),
        makeDebt('Car', 25000, 0.05, 450),
      ],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    if (result.length >= 2) {
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].impact.freedomDelta).toBeGreaterThanOrEqual(result[i].impact.freedomDelta);
      }
    }
  });

  it('every scenario has required fields', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(3000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [makeDebt('CC', 5000, 0.22, 150)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 3000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    for (const s of result) {
      expect(s.id).toBeTruthy();
      expect(s.type).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.impact).toBeDefined();
      expect(typeof s.impact.freedomBefore).toBe('number');
      expect(typeof s.impact.freedomAfter).toBe('number');
      expect(typeof s.impact.freedomDelta).toBe('number');
      // These were causing crashes when missing
      expect(s.reasoning).toBeDefined();
      expect(s.risks).toBeDefined();
      expect(s.steps).toBeDefined();
    }
  });
});

// ─── Debt payoff scenarios ──────────────────────────────────────────────────

describe('debt payoff scenario', () => {
  it('triggers for active debts with interest', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [makeDebt('Credit Card', 12000, 0.219, 500)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const debtScenario = result.find(s => s.type === 'debt_payoff');
    expect(debtScenario).toBeDefined();
  });

  it('works without isActive field (demo debts)', () => {
    const debt: Debt = {
      id: 'd1', name: 'Amex', principal: 12000, interestRate: 0.219,
      monthlyPayment: 500, minimumPayment: 250, dueDate: 25, balance: 12000,
      // Note: no isActive field — this was crashing before the fix
    };
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [debt],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const debtScenario = result.find(s => s.type === 'debt_payoff');
    expect(debtScenario).toBeDefined();
    // Interest rate should display as percentage, not raw decimal
    if (debtScenario) {
      expect(debtScenario.title).toContain('21.9%');
      expect(debtScenario.title).not.toContain('0.219%');
    }
  });

  it('uses balance fallback to principal when balance is undefined', () => {
    const debt: Debt = {
      id: 'd1', name: 'Loan', principal: 10000, interestRate: 0.15,
      monthlyPayment: 300, minimumPayment: 300, dueDate: 1,
      // No balance field
    };
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [debt],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const debtScenario = result.find(s => s.type === 'debt_payoff');
    expect(debtScenario).toBeDefined();
  });

  it('skips debts with isActive: false', () => {
    const debt: Debt = {
      id: 'd1', name: 'Old Loan', principal: 10000, interestRate: 0.15,
      monthlyPayment: 300, minimumPayment: 300, dueDate: 1, balance: 10000,
      isActive: false,
    };
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [debt],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const debtScenario = result.find(s => s.type === 'debt_payoff');
    expect(debtScenario).toBeUndefined();
  });
});

// ─── Debt waterfall scenario ────────────────────────────────────────────────

describe('debt waterfall scenario', () => {
  it('triggers for users with 3+ debts', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(8000)],
      obligations: [makeObligation('Rent', 2000, 'ba_1')],
      debts: [
        makeDebt('Mortgage', 485000, 0.0625, 3200),
        makeDebt('BMW', 42000, 0.049, 1050),
        makeDebt('Amex', 12000, 0.219, 500),
      ],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 8000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const waterfall = result.find(s => s.type === 'debt_waterfall');
    expect(waterfall).toBeDefined();
  });

  it('does not trigger for fewer than 3 debts', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [
        makeDebt('CC', 5000, 0.22, 150),
        makeDebt('Car', 15000, 0.05, 300),
      ],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const waterfall = result.find(s => s.type === 'debt_waterfall');
    expect(waterfall).toBeUndefined();
  });
});

// ─── Side hustle / business exclusion for high earners ──────────────────────

describe('income-boosting scenarios', () => {
  it('suggests side hustle for low-income, tight cash flow users', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(1500, 'biweekly')], // ~$3250/mo
      obligations: [
        makeObligation('Rent', 1500, 'ba_1'),
        makeObligation('Bills', 600, 'ba_1'),
        makeObligation('Food', 400, 'ba_1'),
      ],
      debts: [makeDebt('CC', 3000, 0.22, 150)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 500, institution: 'Chase' }],
    }); // needs = $2650, freedom = 3250/2650 = 1.23 < 1.5
    const result = generateSmartScenarios(profile);
    const sideHustle = result.find(s => s.type === 'side_hustle');
    expect(sideHustle).toBeDefined();
  });

  it('does NOT suggest side hustle for high earners (>$8K/mo)', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(7100, 'biweekly')], // ~$15,383/mo
      obligations: [
        makeObligation('Mortgage', 3200, 'ba_1'),
        makeObligation('Bills', 2000, 'ba_1'),
      ],
      debts: [
        makeDebt('BMW', 42000, 0.049, 1050),
        makeDebt('Amex', 12000, 0.219, 500),
      ],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 8000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const sideHustle = result.find(s => s.type === 'side_hustle');
    const business = result.find(s => s.type === 'start_business');
    expect(sideHustle).toBeUndefined();
    expect(business).toBeUndefined();
  });
});

// ─── Obligations audit scenario ─────────────────────────────────────────────

describe('obligations audit scenario', () => {
  it('triggers when burn rate is >60% of income', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [
        makeObligation('Rent', 1500, 'ba_1'),
        makeObligation('Bills', 800, 'ba_1'),
        makeObligation('Insurance', 400, 'ba_1'),
        makeObligation('Subs', 200, 'ba_1'),
        makeObligation('Food', 500, 'ba_1'),
      ],
      debts: [makeDebt('CC', 5000, 0.22, 200)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 3000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const audit = result.find(s => s.type === 'obligations_audit');
    expect(audit).toBeDefined();
  });
});

// ─── Debt refinance ─────────────────────────────────────────────────────────

describe('debt refinance scenario', () => {
  it('triggers for high-interest debt (>10%) with balance >$2K', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(10000)], // High income so few other scenarios trigger
      obligations: [],
      debts: [makeDebt('Credit Card', 8000, 0.249, 400)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 20000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const refi = result.find(s => s.type === 'debt_refinance');
    expect(refi).toBeDefined();
    if (refi) {
      // Should display rate as percentage
      expect(refi.title).toMatch(/\d+\.\d+%/);
      expect(refi.title).not.toContain('0.249');
    }
  });

  it('does not trigger for low-interest debt', () => {
    const profile = makeProfile({
      incomeSources: [makeSalary(5000)],
      obligations: [makeObligation('Rent', 1500, 'ba_1')],
      debts: [makeDebt('Mortgage', 300000, 0.035, 1500)],
      bankAccounts: [{ id: 'ba_1', name: 'Checking', type: 'checking', currentBalance: 5000, institution: 'Chase' }],
    });
    const result = generateSmartScenarios(profile);
    const refi = result.find(s => s.type === 'debt_refinance');
    expect(refi).toBeUndefined();
  });
});
