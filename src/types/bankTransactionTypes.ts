// src/types/bankTransaction.ts
// ─── Add these types to your existing src/types/index.ts ───────────────────

/**
 * Transaction categories — designed for budget breakdown
 * These map to common bank statement categories so CSV import can auto-categorize
 */
export type BankTransactionCategory =
  // Income
  | 'income_salary'
  | 'income_freelance'
  | 'income_transfer_in'
  | 'income_refund'
  | 'income_other'
  // Housing
  | 'housing_rent'
  | 'housing_mortgage'
  | 'housing_maintenance'
  // Utilities
  | 'utilities_electric'
  | 'utilities_water'
  | 'utilities_gas'
  | 'utilities_internet'
  | 'utilities_phone'
  | 'utilities_other'
  // Food
  | 'food_grocery'
  | 'food_restaurant'
  | 'food_delivery'
  | 'food_coffee'
  // Transport
  | 'transport_fuel'
  | 'transport_parking'
  | 'transport_rideshare'
  | 'transport_public'
  | 'transport_maintenance'
  // Insurance
  | 'insurance_health'
  | 'insurance_auto'
  | 'insurance_home'
  | 'insurance_life'
  | 'insurance_other'
  // Medical
  | 'medical_doctor'
  | 'medical_pharmacy'
  | 'medical_dental'
  | 'medical_other'
  // Subscriptions
  | 'subscription_streaming'
  | 'subscription_software'
  | 'subscription_gym'
  | 'subscription_other'
  // Personal
  | 'personal_clothing'
  | 'personal_grooming'
  | 'personal_education'
  | 'personal_gifts'
  | 'personal_companion'
  | 'personal_spouse'
  | 'personal_kids'
  // Entertainment
  | 'entertainment_events'
  | 'entertainment_hobbies'
  | 'entertainment_travel'
  // Financial
  | 'financial_investment'
  | 'financial_savings_transfer'
  | 'financial_debt_payment'
  | 'financial_fees'
  | 'financial_taxes'
  // Transfers
  | 'transfer_between_accounts'
  | 'transfer_to_other'
  // Other
  | 'business_expense'
  | 'smoking'
  | 'other'
  | `custom_${string}`;

/**
 * Category groupings for the budget breakdown view
 */
export type BankTransactionGroup =
  | 'income'
  | 'housing'
  | 'utilities'
  | 'food'
  | 'transport'
  | 'insurance'
  | 'medical'
  | 'subscriptions'
  | 'personal'
  | 'entertainment'
  | 'financial'
  | 'transfers'
  | 'other';

/**
 * A single bank account transaction
 */
export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;                      // YYYY-MM-DD
  description: string;               // What you see on the statement
  amount: number;                    // Positive = money OUT (expense), Negative = money IN (deposit)
  category: BankTransactionCategory;
  type: 'expense' | 'income' | 'transfer';
  isRecurring?: boolean;             // Flagged as a recurring obligation
  recurringName?: string;            // Cleaned name for obligation matching (e.g., "Netflix")
  notes?: string;
  importedFrom?: 'csv' | 'manual';  // How it was entered
  importBatchId?: string;            // Groups CSV imports together
}

/**
 * User-defined custom category definition
 */
export interface CustomCategoryDef {
  label: string;
  emoji: string;
  group: BankTransactionGroup;
}

/**
 * Category metadata for display
 */
/** Built-in categories (excludes user-created custom_* keys) */
export type BuiltInBankTransactionCategory = Exclude<BankTransactionCategory, `custom_${string}`>;

/** Category metadata lookup type — returns undefined for custom_* keys */
type CategoryMetaMap = Record<BuiltInBankTransactionCategory, { label: string; emoji: string; group: BankTransactionGroup }>;

// Internal const satisfies all built-in keys; cast to allow indexing with any BankTransactionCategory
export const TRANSACTION_CATEGORY_META: CategoryMetaMap & Partial<Record<`custom_${string}`, { label: string; emoji: string; group: BankTransactionGroup }>> = {
  // Income
  income_salary:           { label: 'Salary',           emoji: '💰', group: 'income' },
  income_freelance:        { label: 'Freelance',        emoji: '💻', group: 'income' },
  income_transfer_in:      { label: 'Transfer In',      emoji: '📥', group: 'income' },
  income_refund:           { label: 'Refund',           emoji: '↩️', group: 'income' },
  income_other:            { label: 'Other Income',     emoji: '💵', group: 'income' },
  // Housing
  housing_rent:            { label: 'Rent',             emoji: '🏠', group: 'housing' },
  housing_mortgage:        { label: 'Mortgage',         emoji: '🏡', group: 'housing' },
  housing_maintenance:     { label: 'Home Maintenance', emoji: '🔧', group: 'housing' },
  // Utilities
  utilities_electric:      { label: 'Electric',         emoji: '⚡', group: 'utilities' },
  utilities_water:         { label: 'Water',            emoji: '💧', group: 'utilities' },
  utilities_gas:           { label: 'Gas',              emoji: '🔥', group: 'utilities' },
  utilities_internet:      { label: 'Internet',         emoji: '🌐', group: 'utilities' },
  utilities_phone:         { label: 'Phone',            emoji: '📱', group: 'utilities' },
  utilities_other:         { label: 'Other Utility',    emoji: '💡', group: 'utilities' },
  // Food
  food_grocery:            { label: 'Grocery',          emoji: '🛒', group: 'food' },
  food_restaurant:         { label: 'Restaurant',       emoji: '🍽️', group: 'food' },
  food_delivery:           { label: 'Food Delivery',    emoji: '🛵', group: 'food' },
  food_coffee:             { label: 'Coffee',           emoji: '☕', group: 'food' },
  // Transport
  transport_fuel:          { label: 'Fuel',             emoji: '⛽', group: 'transport' },
  transport_parking:       { label: 'Parking',          emoji: '🅿️', group: 'transport' },
  transport_rideshare:     { label: 'Rideshare',        emoji: '🚕', group: 'transport' },
  transport_public:        { label: 'Public Transit',   emoji: '🚇', group: 'transport' },
  transport_maintenance:   { label: 'Auto Maintenance', emoji: '🔩', group: 'transport' },
  // Insurance
  insurance_health:        { label: 'Health Insurance', emoji: '🏥', group: 'insurance' },
  insurance_auto:          { label: 'Auto Insurance',   emoji: '🚗', group: 'insurance' },
  insurance_home:          { label: 'Home Insurance',   emoji: '🏠', group: 'insurance' },
  insurance_life:          { label: 'Life Insurance',   emoji: '🛡️', group: 'insurance' },
  insurance_other:         { label: 'Other Insurance',  emoji: '📋', group: 'insurance' },
  // Medical
  medical_doctor:          { label: 'Doctor',           emoji: '👨‍⚕️', group: 'medical' },
  medical_pharmacy:        { label: 'Pharmacy',         emoji: '💊', group: 'medical' },
  medical_dental:          { label: 'Dental',           emoji: '🦷', group: 'medical' },
  medical_other:           { label: 'Other Medical',    emoji: '🏥', group: 'medical' },
  // Subscriptions
  subscription_streaming:  { label: 'Streaming',        emoji: '📺', group: 'subscriptions' },
  subscription_software:   { label: 'Software',         emoji: '💿', group: 'subscriptions' },
  subscription_gym:        { label: 'Gym',              emoji: '💪', group: 'subscriptions' },
  subscription_other:      { label: 'Other Sub',        emoji: '🔁', group: 'subscriptions' },
  // Personal
  personal_clothing:       { label: 'Clothing',         emoji: '👕', group: 'personal' },
  personal_grooming:       { label: 'Grooming',         emoji: '💈', group: 'personal' },
  personal_education:      { label: 'Education',        emoji: '📚', group: 'personal' },
  personal_gifts:          { label: 'Gifts',            emoji: '🎁', group: 'personal' },
  personal_companion:      { label: 'Companion',         emoji: '💜', group: 'personal' },
  personal_spouse:         { label: 'Spouse',            emoji: '💍', group: 'personal' },
  personal_kids:           { label: 'Kids',              emoji: '👧', group: 'personal' },
  // Entertainment
  entertainment_events:    { label: 'Events',           emoji: '🎟️', group: 'entertainment' },
  entertainment_hobbies:   { label: 'Hobbies',          emoji: '🎮', group: 'entertainment' },
  entertainment_travel:    { label: 'Travel',           emoji: '✈️', group: 'entertainment' },
  // Financial
  financial_investment:    { label: 'Investment',       emoji: '📈', group: 'financial' },
  financial_savings_transfer: { label: 'Savings',       emoji: '🏦', group: 'financial' },
  financial_debt_payment:  { label: 'Debt Payment',     emoji: '💳', group: 'financial' },
  financial_fees:          { label: 'Bank Fees',        emoji: '🏦', group: 'financial' },
  financial_taxes:         { label: 'Taxes',            emoji: '🏛️', group: 'financial' },
  // Transfers
  transfer_between_accounts: { label: 'Account Transfer', emoji: '↔️', group: 'transfers' },
  transfer_to_other:       { label: 'Transfer Out',     emoji: '📤', group: 'transfers' },
  // Other
  business_expense:        { label: 'Business',         emoji: '💼', group: 'other' },
  smoking:                 { label: 'Smoking',          emoji: '🚬', group: 'other' },
  other:                   { label: 'Other',            emoji: '📋', group: 'other' },
};

/**
 * Canonical category options for all pickers — auto-generated from TRANSACTION_CATEGORY_META
 * Import this instead of duplicating category lists across pages.
 */
export type CategoryOptionGroup = {
  group: BankTransactionGroup;
  categories: { value: BankTransactionCategory; label: string }[];
};

const GROUP_ORDER: BankTransactionGroup[] = [
  'housing', 'food', 'transport', 'utilities', 'insurance', 'subscriptions',
  'medical', 'personal', 'entertainment', 'financial', 'income', 'transfers', 'other',
];

export const CATEGORY_OPTIONS: CategoryOptionGroup[] = (() => {
  const grouped: Record<string, { value: BankTransactionCategory; label: string }[]> = {};
  for (const [key, meta] of Object.entries(TRANSACTION_CATEGORY_META)) {
    if (!grouped[meta.group]) grouped[meta.group] = [];
    grouped[meta.group].push({ value: key as BankTransactionCategory, label: meta.label });
  }
  return GROUP_ORDER.filter(g => grouped[g]).map(g => ({ group: g, categories: grouped[g] }));
})();

/**
 * Group metadata for budget breakdown headers
 */
export const TRANSACTION_GROUP_META: Record<BankTransactionGroup, {
  label: string;
  emoji: string;
  color: string;
}> = {
  income:        { label: 'Income',         emoji: '💰', color: '#4ade80' },
  housing:       { label: 'Housing',        emoji: '🏠', color: '#60a5fa' },
  utilities:     { label: 'Utilities',      emoji: '💡', color: '#fbbf24' },
  food:          { label: 'Food & Dining',  emoji: '🍽️', color: '#fb923c' },
  transport:     { label: 'Transportation', emoji: '🚗', color: '#a78bfa' },
  insurance:     { label: 'Insurance',      emoji: '🛡️', color: '#38bdf8' },
  medical:       { label: 'Medical',        emoji: '🏥', color: '#f87171' },
  subscriptions: { label: 'Subscriptions',  emoji: '🔁', color: '#e879f9' },
  personal:      { label: 'Personal',       emoji: '👤', color: '#34d399' },
  entertainment: { label: 'Entertainment',  emoji: '🎬', color: '#fbbf24' },
  financial:     { label: 'Financial',      emoji: '📈', color: '#818cf8' },
  transfers:     { label: 'Transfers',      emoji: '↔️', color: '#94a3b8' },
  other:         { label: 'Other',          emoji: '📋', color: '#9ca3af' },
};
