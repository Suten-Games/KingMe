// __tests__/setupChecklist.test.ts
// Validates SetupChecklist structure — ensures bank account comes before income,
// correct priorities, and routes point to valid tabs.

// We can't render the React component in node, but we can validate
// the checklist definition by reading the source and checking constraints.

import * as fs from 'fs';
import * as path from 'path';

const CHECKLIST_PATH = path.resolve(__dirname, '../src/components/SetupChecklist.tsx');
const source = fs.readFileSync(CHECKLIST_PATH, 'utf-8');

// ── Parse checklist items from source ──────────────────────────
// Extract the items array definition from the source code
function parseChecklistItems(): Array<{ key: string; label: string; route: string; priority: string }> {
  const itemsMatch = source.match(/const items: CheckItem\[\] = \[([\s\S]*?)\];/);
  if (!itemsMatch) throw new Error('Could not find checklist items array in source');

  const itemsBlock = itemsMatch[1];
  const items: Array<{ key: string; label: string; route: string; priority: string }> = [];

  // Match each object literal in the array
  const itemRegex = /\{\s*key:\s*'(\w+)',\s*label:\s*'([^']+)',.*?route:\s*'([^']+)',.*?priority:\s*'(\w+)'/g;
  let match;
  while ((match = itemRegex.exec(itemsBlock)) !== null) {
    items.push({
      key: match[1],
      label: match[2],
      route: match[3],
      priority: match[4],
    });
  }

  return items;
}

const items = parseChecklistItems();

// ── Tests ──────────────────────────────────────────────────────

describe('SetupChecklist item ordering', () => {
  it('parses at least 5 checklist items from source', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('bank account comes BEFORE income (prerequisite)', () => {
    const bankIdx = items.findIndex(i => i.key === 'bank');
    const incomeIdx = items.findIndex(i => i.key === 'income');
    expect(bankIdx).toBeGreaterThanOrEqual(0);
    expect(incomeIdx).toBeGreaterThanOrEqual(0);
    expect(bankIdx).toBeLessThan(incomeIdx);
  });

  it('income comes before obligations', () => {
    const incomeIdx = items.findIndex(i => i.key === 'income');
    const obligationsIdx = items.findIndex(i => i.key === 'obligations');
    expect(incomeIdx).toBeLessThan(obligationsIdx);
  });
});

describe('SetupChecklist priorities', () => {
  it('bank account is critical (required for income)', () => {
    const bank = items.find(i => i.key === 'bank');
    expect(bank?.priority).toBe('critical');
  });

  it('income is critical', () => {
    const income = items.find(i => i.key === 'income');
    expect(income?.priority).toBe('critical');
  });

  it('obligations is critical', () => {
    const obligations = items.find(i => i.key === 'obligations');
    expect(obligations?.priority).toBe('critical');
  });

  it('wallet is optional (not required for core functionality)', () => {
    const wallet = items.find(i => i.key === 'wallet');
    expect(wallet?.priority).toBe('optional');
  });
});

describe('SetupChecklist routes', () => {
  it('bank account routes to assets tab', () => {
    const bank = items.find(i => i.key === 'bank');
    expect(bank?.route).toBe('/(tabs)/assets');
  });

  it('income routes to income tab', () => {
    const income = items.find(i => i.key === 'income');
    expect(income?.route).toBe('/(tabs)/income');
  });

  it('bank account route does NOT go to Profile (moved to Assets)', () => {
    const bank = items.find(i => i.key === 'bank');
    expect(bank?.route.toLowerCase()).not.toContain('profile');
  });
});

describe('income.tsx bank account message', () => {
  const incomePath = path.resolve(__dirname, '../app/(tabs)/income.tsx');
  const incomeSource = fs.readFileSync(incomePath, 'utf-8');

  it('does NOT reference "Profile" for adding bank accounts', () => {
    // The old message said "add one in Profile first" — should now say Assets
    const hasProfileRef = /add one in Profile/i.test(incomeSource);
    expect(hasProfileRef).toBe(false);
  });

  it('references "Assets" for adding bank accounts', () => {
    const hasAssetsRef = /add one in Assets/i.test(incomeSource);
    expect(hasAssetsRef).toBe(true);
  });
});
