// src/utils/assetTypeHelpers.ts

export function getAssetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    crypto: '₿ Crypto',
    stocks: '📈 Stocks',
    real_estate: '🏠 Real Estate',
    business: '💼 Business',
    retirement: '🏛️ Retirement',
    other: '💰 Other',
  };
  return labels[type] || '💰 Other';
}

export function getRetirementAccountLabel(
  accountType: '401k' | 'roth_401k' | 'ira' | 'roth_ira'
): string {
  const labels = {
    '401k': '401(k)',
    'roth_401k': 'Roth 401(k)',
    'ira': 'IRA',
    'roth_ira': 'Roth IRA',
  };
  return labels[accountType];
}

export function getFrequencyLabel(
  frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'
): string {
  const labels = {
    'weekly': 'Weekly',
    'biweekly': 'Bi-weekly',
    'twice_monthly': '2x/mo',
    'monthly': 'Monthly',
  };
  return labels[frequency];
}
