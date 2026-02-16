// src/utils/assetCalculations.ts - All asset calculation logic
import type { Asset, BankAccount } from '../types';

export interface AssetsByCategory {
  brokerage: Asset[];
  cash: Asset[];
  realEstate: Asset[];
  commodities: Asset[];
  crypto: Asset[];
  retirement: Asset[];
}

// Alias for components that import this name
export type CategorizedAssets = AssetsByCategory;

export function categorizeAssets(assets: Asset[], bankAccounts: BankAccount[]): AssetsByCategory {
  // Convert bank accounts to asset objects
  const bankAssets: Asset[] = bankAccounts.map((account) => ({
    id: `bank_${account.id}`,
    type: 'bank_account' as const,
    name: account.name,
    value: typeof account.currentBalance === 'number' ? account.currentBalance : 0,
    annualIncome: 0, // We'll calculate based on APY
    metadata: {
      type: 'bank_account' as const,
      accountType: account.type,
      institution: account.institution,
      apy: account.type === 'savings' ? 4.5 : account.type === 'checking' ? 0.5 : 0,
    },
  }));

  // Commodity symbols for detection
  const COMMODITY_SYMBOLS = ['gold', 'silver', 'platinum', 'palladium', 'oil', 'copper'];

  const isCommodity = (a: Asset): boolean => {
    // Check subtype first (set by wallet sync)
    if ((a as any).subtype === 'commodities') return true;
    // Check symbol in metadata
    const sym = (a.metadata?.symbol || '').toLowerCase();
    if (COMMODITY_SYMBOLS.includes(sym)) return true;
    // Check name as fallback
    const nameLower = a.name.toLowerCase();
    if (COMMODITY_SYMBOLS.some(c => nameLower.includes(c))) return true;
    return false;
  };

  return {
    brokerage: assets.filter(a => (a.type === 'stocks' || a.type === 'brokerage') && !isCommodity(a)),
    cash: bankAssets,
    realEstate: assets.filter(a => a.type === 'real_estate'),
    commodities: assets.filter(a => isCommodity(a)),
    crypto: assets.filter(a => (a.type === 'crypto' || a.type === 'defi') && !isCommodity(a)),
    retirement: assets.filter(a => a.type === 'retirement'),
  };
}

export function calculateCategoryTotal(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.value, 0);
}

export function calculateCategoryIncome(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.annualIncome, 0);
}

export function calculateTotalValue(categorized: AssetsByCategory): number {
  return (
    calculateCategoryTotal(categorized.brokerage) +
    calculateCategoryTotal(categorized.cash) +
    calculateCategoryTotal(categorized.realEstate) +
    calculateCategoryTotal(categorized.commodities) +
    calculateCategoryTotal(categorized.crypto) +
    calculateCategoryTotal(categorized.retirement)
  );
}

export function calculateTotalIncome(categorized: AssetsByCategory): number {
  return (
    calculateCategoryIncome(categorized.brokerage) +
    calculateCategoryIncome(categorized.cash) +
    calculateCategoryIncome(categorized.realEstate) +
    calculateCategoryIncome(categorized.commodities) +
    calculateCategoryIncome(categorized.crypto) +
    calculateCategoryIncome(categorized.retirement)
  );
}

export function getCategoryIcon(category: keyof AssetsByCategory): string {
  const icons = {
    brokerage: '📈',
    cash: '💵',
    realEstate: '🏠',
    commodities: '🥇',
    crypto: '₿',
    retirement: '🏛️',
  };
  return icons[category];
}

export function getCategoryLabel(category: keyof AssetsByCategory): string {
  const labels = {
    brokerage: 'Brokerage',
    cash: 'Cash',
    realEstate: 'Real Estate',
    commodities: 'Commodities',
    crypto: 'Crypto',
    retirement: 'Retirement',
  };
  return labels[category];
}
