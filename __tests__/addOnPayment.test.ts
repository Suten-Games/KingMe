// __tests__/addOnPayment.test.ts
// Tests for add-on payment utilities, unlock management, and Pro bundle flow

// ── Mock AsyncStorage ──────────────────────────────────────────
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
  __esModule: true,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('../src/services/walletStorage', () => ({
  getAuthParams: jest.fn(),
}));

jest.mock('../src/services/apiBase', () => ({
  getApiBase: jest.fn(() => 'https://kingme.money'),
}));

jest.mock('../src/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import {
  parsePriceToUsdc,
  usdToSkr,
  unlockAddOn,
  isAddOnUnlocked,
  getUnlockedAddOns,
  getReceipts,
  SKR_PRICE_USD,
} from '../src/services/addOnPayment';

// ── Reset storage between tests ────────────────────────────────
beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

// ── Price parsing ──────────────────────────────────────────────

describe('parsePriceToUsdc', () => {
  it('parses dollar string "$4.99" → 4.99', () => {
    expect(parsePriceToUsdc('$4.99')).toBe(4.99);
  });

  it('parses plain number string "24.99" → 24.99', () => {
    expect(parsePriceToUsdc('24.99')).toBe(24.99);
  });

  it('handles zero "$0.00" → 0', () => {
    expect(parsePriceToUsdc('$0.00')).toBe(0);
  });

  it('strips non-numeric chars "$1,299.99 USD" → 1299.99', () => {
    expect(parsePriceToUsdc('$1,299.99 USD')).toBeCloseTo(1299.99, 2);
  });
});

// ── USD to SKR conversion ──────────────────────────────────────

describe('usdToSkr', () => {
  it('converts $24.99 to correct SKR amount', () => {
    const skr = usdToSkr(24.99);
    const expected = Math.ceil(24.99 / SKR_PRICE_USD);
    expect(skr).toBe(expected);
  });

  it('always rounds up (ceil)', () => {
    // Any fractional SKR should round up
    const skr = usdToSkr(0.01);
    expect(skr).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(skr)).toBe(true);
  });

  it('converts $0 to 0', () => {
    expect(usdToSkr(0)).toBe(0);
  });

  it('produces integer results', () => {
    for (const price of [1.99, 4.99, 9.99, 24.99, 49.99]) {
      expect(Number.isInteger(usdToSkr(price))).toBe(true);
    }
  });

  it('SKR_PRICE_USD is a positive number', () => {
    expect(SKR_PRICE_USD).toBeGreaterThan(0);
    expect(SKR_PRICE_USD).toBeLessThan(1); // Should be a fraction of a dollar
  });
});

// ── Unlock management ──────────────────────────────────────────

describe('unlockAddOn', () => {
  it('unlocks an add-on and persists it', async () => {
    await unlockAddOn('test_addon');
    const unlocked = await getUnlockedAddOns();
    expect(unlocked.has('test_addon')).toBe(true);
  });

  it('is idempotent — unlocking twice does not duplicate', async () => {
    await unlockAddOn('test_addon');
    await unlockAddOn('test_addon');
    const raw = JSON.parse(mockStorage['paid_addons_unlocked']);
    const count = raw.filter((id: string) => id === 'test_addon').length;
    expect(count).toBe(1);
  });

  it('can unlock multiple different add-ons', async () => {
    await unlockAddOn('addon_a');
    await unlockAddOn('addon_b');
    await unlockAddOn('addon_c');
    const unlocked = await getUnlockedAddOns();
    expect(unlocked.size).toBe(3);
    expect(unlocked.has('addon_a')).toBe(true);
    expect(unlocked.has('addon_b')).toBe(true);
    expect(unlocked.has('addon_c')).toBe(true);
  });
});

describe('isAddOnUnlocked', () => {
  it('returns false for an add-on that was never unlocked', async () => {
    expect(await isAddOnUnlocked('nonexistent')).toBe(false);
  });

  it('returns true for an unlocked add-on', async () => {
    await unlockAddOn('test_addon');
    expect(await isAddOnUnlocked('test_addon')).toBe(true);
  });
});

describe('getUnlockedAddOns', () => {
  it('returns empty set when nothing is unlocked', async () => {
    const unlocked = await getUnlockedAddOns();
    expect(unlocked.size).toBe(0);
  });

  it('returns a Set (not an array)', async () => {
    const unlocked = await getUnlockedAddOns();
    expect(unlocked).toBeInstanceOf(Set);
  });
});

// ── Pro bundle ─────────────────────────────────────────────────

describe('pro_bundle unlock flow', () => {
  it('pro_bundle can be unlocked like any other add-on', async () => {
    await unlockAddOn('pro_bundle');
    expect(await isAddOnUnlocked('pro_bundle')).toBe(true);
  });

  it('pro_bundle coexists with other unlocked add-ons', async () => {
    await unlockAddOn('business_dashboard');
    await unlockAddOn('pro_bundle');
    await unlockAddOn('divorce_sim');
    const unlocked = await getUnlockedAddOns();
    expect(unlocked.has('pro_bundle')).toBe(true);
    expect(unlocked.has('business_dashboard')).toBe(true);
    expect(unlocked.has('divorce_sim')).toBe(true);
  });

  it('checking pro status when not unlocked returns false', async () => {
    expect(await isAddOnUnlocked('pro_bundle')).toBe(false);
  });
});

// ── Receipts ───────────────────────────────────────────────────

describe('getReceipts', () => {
  it('returns empty array when no receipts stored', async () => {
    const receipts = await getReceipts();
    expect(receipts).toEqual([]);
  });
});
