// src/types/businessTypes.ts
// Shared types and constants for the Business Dashboard

import type { BankTransaction } from './bankTransactionTypes';

export type EntityType = 'llc' | 's_corp' | 'c_corp' | 'sole_prop' | 'partnership' | 'other';

export const ENTITY_LABELS: Record<EntityType, string> = {
  llc: 'LLC', s_corp: 'S-Corp', c_corp: 'C-Corp',
  sole_prop: 'Sole Proprietorship', partnership: 'Partnership', other: 'Other',
};

export interface BusinessExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual' | 'one-time';
  category: 'hosting' | 'dev_tools' | 'marketing' | 'legal' | 'domain' | 'api' | 'other';
  notes?: string;
}

export interface Distribution {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface BusinessInfo {
  ein: string;
  stateOfFormation: string;
  formationDate: string;
  registeredAgent: string;
  taxStatus: string;
  fiscalYearEnd: string;
  businessAddress: string;
  members: string;
}

export interface PLSnapshot {
  id: string;
  date: string;
  label: string;
  revenue: number;
  bankBalance: number;
  walletBalance: number;
  monthlyExpenses: number;
  annualExpenses: number;
  totalDistributions: number;
  totalContributions: number;
  netPosition: number;
}

export interface BusinessData {
  businessName: string;
  businessDescription: string;
  entityType: EntityType;
  info: BusinessInfo;
  logoUri: string;
  swapReferralsEnabled?: boolean;
  referralWallet: string;
  referralBalance: {
    sol: number;
    usdc: number;
    other: { symbol: string; amount: number; valueUSD: number }[];
    totalUSD: number;
    lastFetched: string;
  } | null;
  bankAccount: {
    name: string;
    institution: string;
    balance: number;
    lastUpdated: string;
  } | null;
  expenses: BusinessExpense[];
  distributions: Distribution[];
  contributions: Distribution[];
  transactions: BankTransaction[];
  plSnapshots: PLSnapshot[];
}

export const EXPENSE_CATEGORIES: Record<string, { emoji: string; label: string }> = {
  hosting: { emoji: '\u2601\uFE0F', label: 'Hosting' },
  dev_tools: { emoji: '\uD83D\uDD27', label: 'Dev Tools' },
  marketing: { emoji: '\uD83D\uDCE2', label: 'Marketing' },
  legal: { emoji: '\u2696\uFE0F', label: 'Legal' },
  domain: { emoji: '\uD83C\uDF10', label: 'Domains' },
  api: { emoji: '\uD83D\uDD0C', label: 'APIs' },
  other: { emoji: '\uD83D\uDCE6', label: 'Other' },
};

export const DEFAULT_INFO: BusinessInfo = {
  ein: '', stateOfFormation: '', formationDate: '', registeredAgent: '',
  taxStatus: '', fiscalYearEnd: '', businessAddress: '', members: '',
};

export const DEFAULT_DATA: BusinessData = {
  businessName: '',
  businessDescription: '',
  entityType: 'llc',
  info: DEFAULT_INFO,
  logoUri: '',
  referralWallet: '',
  referralBalance: null,
  bankAccount: null,
  expenses: [],
  distributions: [],
  contributions: [],
  transactions: [],
  plSnapshots: [],
};
