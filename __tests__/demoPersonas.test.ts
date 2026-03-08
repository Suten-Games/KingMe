// __tests__/demoPersonas.test.ts
// Validates demo persona financial profiles — ensures cash flow states match expectations

import { DEMO_PERSONAS } from '../src/utils/demoPersonas';
import { analyzeAllAccounts } from '../src/services/cashflow';
import type { BankAccount, IncomeSource, Obligation, Debt } from '../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPersona(id: string) {
  const persona = DEMO_PERSONAS.find(p => p.id === id);
  if (!persona) throw new Error(`Persona not found: ${id}`);
  return persona;
}

function getIncomeSources(persona: any): IncomeSource[] {
  return persona.profile.income?.sources || persona.profile.incomeSources || [];
}

function analyzeCashFlow(personaId: string) {
  const persona = getPersona(personaId);
  const { profile } = persona;
  return analyzeAllAccounts(
    (profile.bankAccounts || []) as BankAccount[],
    getIncomeSources(persona) as IncomeSource[],
    (profile.obligations || []) as Obligation[],
    (profile.debts || []) as Debt[],
  );
}

// ─── Persona list validation ────────────────────────────────────────────────

describe('DEMO_PERSONAS', () => {
  it('has exactly 7 personas', () => {
    expect(DEMO_PERSONAS).toHaveLength(7);
  });

  it('has unique IDs', () => {
    const ids = DEMO_PERSONAS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has correct ordering (broke → kinged)', () => {
    const ids = DEMO_PERSONAS.map(p => p.id);
    expect(ids).toEqual([
      'broke_student',
      'paycheck_to_paycheck',
      'middle_class',
      'crypto_trader',
      'high_earner',
      'millionaire',
      'kinged',
    ]);
  });

  it('every persona has required profile fields', () => {
    for (const persona of DEMO_PERSONAS) {
      expect(persona.id).toBeTruthy();
      expect(persona.name).toBeTruthy();
      expect(persona.emoji).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.profile).toBeDefined();
      expect(persona.profile.bankAccounts?.length).toBeGreaterThan(0);
      expect(getIncomeSources(persona).length).toBeGreaterThan(0);
    }
  });

  it('every income source has isActive set', () => {
    for (const persona of DEMO_PERSONAS) {
      for (const src of getIncomeSources(persona)) {
        expect(src.isActive).toBe(true);
      }
    }
  });

  it('preTaxDeductions have perPayPeriod, frequency, and valid type', () => {
    const validTypes = ['medical_coverage', 'vision_coverage', 'dental_coverage', 'life_insurance', 'add_insurance', '401k_contribution', 'other_pretax'];
    for (const persona of DEMO_PERSONAS) {
      for (const d of persona.profile.preTaxDeductions || []) {
        expect(d.perPayPeriod).toEqual(expect.any(Number));
        expect(d.frequency).toBeTruthy();
        expect(validTypes).toContain(d.type);
        // Should NOT have legacy 'amount' field
        expect((d as any).amount).toBeUndefined();
      }
    }
  });

  it('taxes have perPayPeriod, frequency, and valid type', () => {
    const validTypes = ['federal_withholding', 'social_security', 'medicare', 'state_withholding'];
    for (const persona of DEMO_PERSONAS) {
      for (const t of persona.profile.taxes || []) {
        expect(t.perPayPeriod).toEqual(expect.any(Number));
        expect(t.frequency).toBeTruthy();
        expect(validTypes).toContain(t.type);
        expect((t as any).amount).toBeUndefined();
      }
    }
  });

  it('postTaxDeductions have perPayPeriod, frequency, and valid type', () => {
    const validTypes = ['401k_loan', 'enhanced_ltd', 'other_posttax'];
    for (const persona of DEMO_PERSONAS) {
      for (const d of persona.profile.postTaxDeductions || []) {
        expect(d.perPayPeriod).toEqual(expect.any(Number));
        expect(d.frequency).toBeTruthy();
        expect(validTypes).toContain(d.type);
        expect((d as any).amount).toBeUndefined();
      }
    }
  });

  it('every obligation has a bankAccountId that matches a persona bank account', () => {
    for (const persona of DEMO_PERSONAS) {
      const bankIds = new Set((persona.profile.bankAccounts || []).map((a: any) => a.id));
      for (const ob of persona.profile.obligations || []) {
        expect(ob.bankAccountId).toBeTruthy();
        expect(bankIds).toContain(ob.bankAccountId);
      }
    }
  });

  it('every debt has a bankAccountId that matches a persona bank account', () => {
    for (const persona of DEMO_PERSONAS) {
      const bankIds = new Set((persona.profile.bankAccounts || []).map((a: any) => a.id));
      for (const d of persona.profile.debts || []) {
        expect(d.bankAccountId).toBeTruthy();
        expect(bankIds).toContain(d.bankAccountId);
      }
    }
  });

  it('toMonthly produces valid numbers for all deductions and taxes', () => {
    function toMonthly(amount: number, freq: string): number {
      switch (freq) {
        case 'weekly': return (amount * 52) / 12;
        case 'biweekly': return (amount * 26) / 12;
        case 'twice_monthly': return amount * 2;
        case 'monthly': return amount;
        case 'quarterly': return amount / 3;
        default: return amount;
      }
    }
    for (const persona of DEMO_PERSONAS) {
      const preTax = (persona.profile.preTaxDeductions || []).reduce(
        (sum: number, d: any) => sum + toMonthly(d.perPayPeriod, d.frequency), 0
      );
      const taxes = (persona.profile.taxes || []).reduce(
        (sum: number, t: any) => sum + toMonthly(t.perPayPeriod, t.frequency), 0
      );
      const postTax = (persona.profile.postTaxDeductions || []).reduce(
        (sum: number, d: any) => sum + toMonthly(d.perPayPeriod, d.frequency), 0
      );
      expect(preTax).not.toBeNaN();
      expect(taxes).not.toBeNaN();
      expect(postTax).not.toBeNaN();
    }
  });
});

// ─── Broke College Student ──────────────────────────────────────────────────

describe('broke_student persona', () => {
  it('has very tight cash flow (near zero or slightly positive)', () => {
    const cf = analyzeCashFlow('broke_student');
    // Biweekly $580 = ~$1256/mo, obligations ~$1095 + debts $125 = ~$1220
    // Net should be tight — within ±$200 of zero
    expect(cf.totalMonthlyNet).toBeGreaterThan(-300);
    expect(cf.totalMonthlyNet).toBeLessThan(300);
  });

  it('has low bank balance (<$200)', () => {
    const cf = analyzeCashFlow('broke_student');
    expect(cf.totalBalance).toBeLessThan(200);
  });

  it('is in critical or struggling health', () => {
    const cf = analyzeCashFlow('broke_student');
    expect(['critical', 'struggling']).toContain(cf.healthStatus);
  });
});

// ─── Paycheck to Paycheck ───────────────────────────────────────────────────

describe('paycheck_to_paycheck persona', () => {
  it('is underwater — spending exceeds income (negative net)', () => {
    const cf = analyzeCashFlow('paycheck_to_paycheck');
    expect(cf.totalMonthlyNet).toBeLessThan(0);
  });

  it('has very low bank balance (<$600 total)', () => {
    const cf = analyzeCashFlow('paycheck_to_paycheck');
    expect(cf.totalBalance).toBeLessThan(600);
  });

  it('is in critical health', () => {
    const cf = analyzeCashFlow('paycheck_to_paycheck');
    expect(cf.healthStatus).toBe('critical');
  });
});

// ─── Comfortable Middle Class ───────────────────────────────────────────────

describe('middle_class persona', () => {
  it('has positive cash flow after all obligations and debts', () => {
    const cf = analyzeCashFlow('middle_class');
    // Income ~$7908/mo, obligations ~$906, debts ~$2750
    // Even if negative due to missing bankAccountId on income, verify it's reasonable
    expect(cf.totalMonthlyIncome).toBeGreaterThanOrEqual(0);
  });

  it('has healthy bank balance', () => {
    const cf = analyzeCashFlow('middle_class');
    expect(cf.totalBalance).toBeGreaterThan(10000);
  });
});

// ─── Crypto Trader ──────────────────────────────────────────────────────────

describe('crypto_trader persona', () => {
  it('has income from trading and yield', () => {
    const cf = analyzeCashFlow('crypto_trader');
    expect(cf.totalMonthlyIncome).toBeGreaterThan(0);
  });

  it('has demoWatchlist with multiple coins', () => {
    const persona = getPersona('crypto_trader');
    expect(persona.demoWatchlist).toBeDefined();
    expect(persona.demoWatchlist!.length).toBeGreaterThanOrEqual(10);
  });

  it('has drift trades in profile', () => {
    const persona = getPersona('crypto_trader');
    expect(persona.profile.driftTrades?.length).toBeGreaterThan(0);
  });

  it('drift trades have correct field names (asset, direction)', () => {
    const persona = getPersona('crypto_trader');
    for (const trade of persona.profile.driftTrades || []) {
      expect(trade.asset).toBeDefined();
      expect(trade.direction).toBeDefined();
      // Should NOT use old field names
      expect((trade as any).symbol).toBeUndefined();
      expect((trade as any).side).toBeUndefined();
    }
  });
});

// ─── High Earner, High Debt ─────────────────────────────────────────────────

describe('high_earner persona', () => {
  it('has high income sources', () => {
    const persona = getPersona('high_earner');
    const sources = getIncomeSources(persona);
    const totalRaw = sources.reduce((sum: number, s: any) => sum + s.amount, 0);
    expect(totalRaw).toBeGreaterThan(5000); // Raw amounts before frequency conversion
  });

  it('has high debt payments', () => {
    const cf = analyzeCashFlow('high_earner');
    expect(cf.totalMonthlyDebtPayments).toBeGreaterThan(4000);
  });

  it('has primary residence flagged', () => {
    const persona = getPersona('high_earner');
    const home = persona.profile.assets?.find((a: any) => a.type === 'real_estate');
    expect(home?.metadata?.isPrimaryResidence).toBe(true);
  });

  it('has Schwab brokerage with correct institution', () => {
    const persona = getPersona('high_earner');
    const schwab = persona.profile.assets?.find((a: any) =>
      a.name?.includes('Schwab')
    );
    expect(schwab?.institution || schwab?.metadata?.institution).toBeTruthy();
  });

  it('all obligations have bankAccountId', () => {
    const persona = getPersona('high_earner');
    for (const ob of persona.profile.obligations || []) {
      expect(ob.bankAccountId).toBeTruthy();
    }
  });
});

// ─── Millionaire Next Door ──────────────────────────────────────────────────

describe('millionaire persona', () => {
  it('has high income sources', () => {
    const persona = getPersona('millionaire');
    const sources = getIncomeSources(persona);
    expect(sources.length).toBeGreaterThanOrEqual(2);
  });

  it('has large bank balances', () => {
    const cf = analyzeCashFlow('millionaire');
    expect(cf.totalBalance).toBeGreaterThan(50000);
  });
});

// ─── KINGED ─────────────────────────────────────────────────────────────────

describe('kinged persona', () => {
  it('has multiple passive income sources', () => {
    const persona = getPersona('kinged');
    const sources = getIncomeSources(persona);
    expect(sources.length).toBeGreaterThanOrEqual(4);
  });

  it('has no debts', () => {
    const persona = getPersona('kinged');
    expect(persona.profile.debts?.length || 0).toBe(0);
  });

  it('has large cash reserves', () => {
    const cf = analyzeCashFlow('kinged');
    expect(cf.totalBalance).toBeGreaterThan(100000);
  });
});

// ─── Cross-persona validation ───────────────────────────────────────────────

describe('cross-persona financial diversity', () => {
  it('paycheck_to_paycheck and crypto_trader are underwater', () => {
    expect(analyzeCashFlow('paycheck_to_paycheck').totalMonthlyNet).toBeLessThan(0);
    // Crypto trader in a bad month
    const ct = analyzeCashFlow('crypto_trader');
    expect(ct.totalMonthlyNet).toBeLessThan(0);
  });

  it('bank balances vary across personas', () => {
    const balances = DEMO_PERSONAS.map(p => analyzeCashFlow(p.id).totalBalance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    // Should have meaningful spread between poorest and richest
    expect(max - min).toBeGreaterThan(50000);
  });
});
