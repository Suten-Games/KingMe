// src/utils/demoPersonas.ts
// Preset financial profiles for demo/sandbox mode

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DemoWatchlistItem {
  mint: string;
  symbol: string;
  addedPrice: number;
  notes: string;
}

export interface DemoPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  profile: any; // Partial UserProfile
  demoWatchlist?: DemoWatchlistItem[];
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'broke_student',
    name: 'Broke College Student',
    emoji: '\u{1F393}',
    description: 'Part-time job, student loans, living paycheck to paycheck',
    color: '#f87171',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'Part-Time Barista', amount: 690, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Student Checking', type: 'checking', currentBalance: 342, institution: 'Chase', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Cash App', type: 'checking', currentBalance: 47, institution: 'Cash App', isPrimaryIncome: false },
      ],
      wallets: ['DemoStudentWa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
      assets: [
        { id: 'a_demo_1', type: 'other', name: 'Beat-up Honda Civic', value: 3500, annualIncome: 0, metadata: {} },
        { id: 'a_demo_2', type: 'crypto', name: 'XRP', value: 180, annualIncome: 0, metadata: { symbol: 'XRP', quantity: 75, exchange: 'Coinbase' } },
        { id: 'a_demo_3', type: 'crypto', name: 'dogwifhat', value: 45, annualIncome: 0, metadata: { symbol: 'WIF', quantity: 85, tokenMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' } },
        { id: 'a_demo_4', type: 'crypto', name: 'Fartcoin', value: 22, annualIncome: 0, metadata: { symbol: 'FARTCOIN', quantity: 30, tokenMint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' } },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Rent (shared)', payee: 'Landlord', amount: 650, category: 'housing', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_2', name: 'Phone Bill', payee: 'T-Mobile', amount: 45, category: 'utilities', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_3', name: 'Car Insurance', payee: 'Geico', amount: 89, category: 'insurance', isRecurring: true, dueDate: 20 },
        { id: 'ob_demo_4', name: 'Spotify', payee: 'Spotify', amount: 11, category: 'other', isRecurring: true, dueDate: 5 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Federal Student Loan', principal: 28000, interestRate: 0.055, monthlyPayment: 0, minimumPayment: 0, dueDate: 0, balance: 28000 },
        { id: 'd_demo_2', name: 'Credit Card', principal: 2100, interestRate: 0.249, monthlyPayment: 65, minimumPayment: 35, dueDate: 22, balance: 2100 },
        { id: 'd_demo_3', name: 'Afterpay', principal: 240, interestRate: 0, monthlyPayment: 60, minimumPayment: 60, dueDate: 10, balance: 240, payee: 'Afterpay' },
      ],
      desires: [],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [],
      taxes: [],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: false, localBackupDone: true },
    },
    demoWatchlist: [
      { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', addedPrice: 0.32, notes: 'Dog meme coin, bought the dip' },
      { mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', symbol: 'FARTCOIN', addedPrice: 0.45, notes: 'Degen play, small bag' },
    ],
  },
  {
    id: 'paycheck_to_paycheck',
    name: 'Paycheck to Paycheck',
    emoji: '\u{1F4B8}',
    description: 'Decent job but expenses eat everything, barely any savings',
    color: '#f97316',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'Warehouse Associate', amount: 1730, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Wells Fargo Checking', type: 'checking', currentBalance: 847, institution: 'Wells Fargo', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Savings', type: 'savings', currentBalance: 1200, institution: 'Wells Fargo', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'other', name: '2019 Toyota Corolla', value: 12000, annualIncome: 0, metadata: {} },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Rent', payee: 'Apartment Complex', amount: 1350, category: 'housing', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_2', name: 'Electric', payee: 'APS', amount: 145, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_3', name: 'Internet', payee: 'Cox', amount: 85, category: 'utilities', isRecurring: true, dueDate: 12 },
        { id: 'ob_demo_4', name: 'Phone', payee: 'AT&T', amount: 95, category: 'utilities', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_5', name: 'Car Insurance', payee: 'Progressive', amount: 165, category: 'insurance', isRecurring: true, dueDate: 3 },
        { id: 'ob_demo_6', name: 'Netflix', payee: 'Netflix', amount: 16, category: 'other', isRecurring: true, dueDate: 8 },
        { id: 'ob_demo_7', name: 'Gym', payee: 'Planet Fitness', amount: 25, category: 'other', isRecurring: true, dueDate: 1 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Auto Loan', principal: 18000, interestRate: 0.069, monthlyPayment: 350, minimumPayment: 350, dueDate: 5, balance: 14200, payee: 'Toyota Financial' },
        { id: 'd_demo_2', name: 'Credit Card', principal: 5800, interestRate: 0.219, monthlyPayment: 150, minimumPayment: 75, dueDate: 20, balance: 5800, payee: 'Capital One' },
        { id: 'd_demo_3', name: 'Student Loan', principal: 22000, interestRate: 0.045, monthlyPayment: 230, minimumPayment: 230, dueDate: 28, balance: 19500 },
      ],
      desires: [],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [],
      taxes: [],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: true, localBackupDone: true },
    },
  },
  {
    id: 'middle_class',
    name: 'Comfortable Middle Class',
    emoji: '\u{1F3E1}',
    description: 'Homeowner, 401k, some savings, manageable debt',
    color: '#eab308',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'Senior Analyst – TechCorp', amount: 3650, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Chase Checking', type: 'checking', currentBalance: 4200, institution: 'Chase', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Ally Savings', type: 'savings', currentBalance: 15000, institution: 'Ally', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'real_estate', name: 'Primary Home', value: 320000, annualIncome: 0, metadata: { address: '123 Main St' } },
        { id: 'a_demo_2', type: 'retirement', name: '401(k)', value: 85000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_3', type: 'other', name: '2022 Honda CR-V', value: 26000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_4', type: 'crypto', name: 'Bitcoin', value: 4500, annualIncome: 0, metadata: { symbol: 'BTC', quantity: 0.045 } },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Electric', payee: 'SRP', amount: 180, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_2', name: 'Water', payee: 'City Water', amount: 65, category: 'utilities', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_3', name: 'Internet', payee: 'Cox', amount: 95, category: 'utilities', isRecurring: true, dueDate: 12 },
        { id: 'ob_demo_4', name: 'Phone (Family)', payee: 'Verizon', amount: 180, category: 'utilities', isRecurring: true, dueDate: 20 },
        { id: 'ob_demo_5', name: 'Home Insurance', payee: 'State Farm', amount: 145, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_6', name: 'Auto Insurance', payee: 'State Farm', amount: 135, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_7', name: 'Life Insurance', payee: 'Northwestern Mutual', amount: 55, category: 'insurance', isRecurring: true, dueDate: 5 },
        { id: 'ob_demo_8', name: 'Netflix', payee: 'Netflix', amount: 16, category: 'other', isRecurring: true, dueDate: 8 },
        { id: 'ob_demo_9', name: 'Gym', payee: 'LA Fitness', amount: 35, category: 'other', isRecurring: true, dueDate: 1 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Mortgage', principal: 280000, interestRate: 0.065, monthlyPayment: 1850, minimumPayment: 1850, dueDate: 1, balance: 252000, payee: 'Chase' },
        { id: 'd_demo_2', name: 'Auto Loan', principal: 30000, interestRate: 0.049, monthlyPayment: 550, minimumPayment: 550, dueDate: 15, balance: 18000, payee: 'Honda Financial' },
        { id: 'd_demo_3', name: 'Student Loan', principal: 35000, interestRate: 0.05, monthlyPayment: 350, minimumPayment: 350, dueDate: 28, balance: 12000 },
      ],
      desires: [
        { id: 'des_demo_1', name: 'Family Vacation', estimatedCost: 5000, priority: 'medium' },
        { id: 'des_demo_2', name: 'New Laptop', estimatedCost: 1500, priority: 'low' },
      ],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [
        { id: 'ptd_1', name: '401(k) Contribution', amount: 365, type: 'retirement' },
        { id: 'ptd_2', name: 'Medical Insurance', amount: 180, type: 'medical' },
        { id: 'ptd_3', name: 'Dental', amount: 25, type: 'dental' },
      ],
      taxes: [
        { id: 'tax_1', name: 'Federal W/H', amount: 580, type: 'federal' },
        { id: 'tax_2', name: 'Social Security', amount: 280, type: 'social_security' },
        { id: 'tax_3', name: 'Medicare', amount: 65, type: 'medicare' },
        { id: 'tax_4', name: 'State W/H', amount: 185, type: 'state' },
      ],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: true, localBackupDone: true },
    },
  },
  {
    id: 'high_earner',
    name: 'High Earner, High Debt',
    emoji: '\u{1F4BC}',
    description: '$200K+ income but lifestyle inflation, big mortgage, car notes',
    color: '#60a5fa',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'Engineering Manager – BigCo', amount: 7100, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
          { id: 'is_demo_2', source: 'other', name: 'Annual Bonus (spread)', amount: 2500, frequency: 'monthly', bankAccountId: 'ba_demo_2' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Chase Checking', type: 'checking', currentBalance: 8500, institution: 'Chase', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Chase Savings', type: 'savings', currentBalance: 25000, institution: 'Chase', isPrimaryIncome: false },
        { id: 'ba_demo_3', name: 'Schwab Brokerage', type: 'investment', currentBalance: 45000, institution: 'Schwab', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'real_estate', name: 'Primary Home', value: 650000, annualIncome: 0, metadata: { address: '456 Luxury Ln' } },
        { id: 'a_demo_2', type: 'retirement', name: '401(k)', value: 280000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_3', type: 'brokerage', name: 'Schwab Portfolio', value: 120000, annualIncome: 3600, metadata: {} },
        { id: 'a_demo_4', type: 'other', name: '2024 BMW X5', value: 58000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_5', type: 'other', name: '2023 Tesla Model 3', value: 32000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_6', type: 'crypto', name: 'Ethereum', value: 15000, annualIncome: 0, metadata: { symbol: 'ETH', quantity: 6.5 } },
        { id: 'a_demo_7', type: 'crypto', name: 'Bitcoin', value: 25000, annualIncome: 0, metadata: { symbol: 'BTC', quantity: 0.25 } },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Electric', payee: 'APS', amount: 280, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_2', name: 'Water/Sewer', payee: 'City', amount: 95, category: 'utilities', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_3', name: 'Internet/Cable', payee: 'Cox', amount: 200, category: 'utilities', isRecurring: true, dueDate: 12 },
        { id: 'ob_demo_4', name: 'Phone (Family)', payee: 'Verizon', amount: 250, category: 'utilities', isRecurring: true, dueDate: 20 },
        { id: 'ob_demo_5', name: 'Home Insurance', payee: 'Allstate', amount: 220, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_6', name: 'Umbrella Policy', payee: 'Allstate', amount: 45, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_7', name: 'Auto Insurance', payee: 'Allstate', amount: 320, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_8', name: 'Lawn Service', payee: 'Green Thumb', amount: 150, category: 'other', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_9', name: 'Cleaning Service', payee: 'Merry Maids', amount: 200, category: 'other', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_10', name: 'Equinox Gym', payee: 'Equinox', amount: 210, category: 'other', isRecurring: true, dueDate: 1 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Mortgage', principal: 520000, interestRate: 0.0625, monthlyPayment: 3200, minimumPayment: 3200, dueDate: 1, balance: 485000, payee: 'Chase' },
        { id: 'd_demo_2', name: 'BMW Loan', principal: 55000, interestRate: 0.049, monthlyPayment: 1050, minimumPayment: 1050, dueDate: 10, balance: 42000, payee: 'BMW Financial' },
        { id: 'd_demo_3', name: 'Tesla Loan', principal: 35000, interestRate: 0.039, monthlyPayment: 650, minimumPayment: 650, dueDate: 15, balance: 24000, payee: 'Tesla' },
        { id: 'd_demo_4', name: 'Amex Platinum', principal: 12000, interestRate: 0.219, monthlyPayment: 500, minimumPayment: 250, dueDate: 25, balance: 12000, payee: 'American Express' },
      ],
      desires: [
        { id: 'des_demo_1', name: 'European Vacation', estimatedCost: 15000, priority: 'medium' },
        { id: 'des_demo_2', name: 'Kitchen Remodel', estimatedCost: 45000, priority: 'low' },
      ],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [
        { id: 'ptd_1', name: '401(k) Max', amount: 900, type: 'retirement' },
        { id: 'ptd_2', name: 'Medical', amount: 250, type: 'medical' },
        { id: 'ptd_3', name: 'Dental/Vision', amount: 45, type: 'dental' },
        { id: 'ptd_4', name: 'HSA', amount: 150, type: 'other' },
      ],
      taxes: [
        { id: 'tax_1', name: 'Federal W/H', amount: 1800, type: 'federal' },
        { id: 'tax_2', name: 'Social Security', amount: 530, type: 'social_security' },
        { id: 'tax_3', name: 'Medicare', amount: 130, type: 'medicare' },
        { id: 'tax_4', name: 'State W/H', amount: 450, type: 'state' },
      ],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: true, localBackupDone: true },
    },
  },
  {
    id: 'millionaire',
    name: 'Millionaire Next Door',
    emoji: '\u{1F4B0}',
    description: 'Paid-off house, maxed retirement, diversified portfolio',
    color: '#4ade80',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'IT Director – School District', amount: 5200, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
          { id: 'is_demo_2', source: 'business', name: 'Rental Income (net)', amount: 2000, frequency: 'monthly', bankAccountId: 'ba_demo_3' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Checking', type: 'checking', currentBalance: 12000, institution: 'Fidelity', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Emergency Fund', type: 'savings', currentBalance: 50000, institution: 'Marcus', isPrimaryIncome: false },
        { id: 'ba_demo_3', name: 'Brokerage Cash', type: 'investment', currentBalance: 35000, institution: 'Fidelity', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'real_estate', name: 'Primary Home (paid off)', value: 450000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_2', type: 'real_estate', name: 'Rental Property', value: 280000, annualIncome: 24000, metadata: {} },
        { id: 'a_demo_3', type: 'retirement', name: '401(k)', value: 620000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_4', type: 'retirement', name: 'Roth IRA', value: 185000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_5', type: 'brokerage', name: 'Index Fund Portfolio', value: 340000, annualIncome: 8500, metadata: {} },
        { id: 'a_demo_6', type: 'crypto', name: 'Bitcoin', value: 45000, annualIncome: 0, metadata: { symbol: 'BTC', quantity: 0.45 } },
        { id: 'a_demo_7', type: 'other', name: '2021 Toyota Tacoma', value: 28000, annualIncome: 0, metadata: {} },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Property Tax', payee: 'County', amount: 450, category: 'housing', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_2', name: 'Home Insurance', payee: 'USAA', amount: 120, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_3', name: 'Rental Insurance', payee: 'USAA', amount: 85, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_4', name: 'Electric', payee: 'Duke Energy', amount: 140, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_5', name: 'Internet', payee: 'Fiber', amount: 70, category: 'utilities', isRecurring: true, dueDate: 12 },
        { id: 'ob_demo_6', name: 'Phone', payee: 'Mint Mobile', amount: 30, category: 'utilities', isRecurring: true, dueDate: 5 },
        { id: 'ob_demo_7', name: 'Auto Insurance', payee: 'USAA', amount: 95, category: 'insurance', isRecurring: true, dueDate: 1 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Rental Mortgage', principal: 200000, interestRate: 0.035, monthlyPayment: 900, minimumPayment: 900, dueDate: 1, balance: 82000, payee: 'Credit Union' },
      ],
      desires: [
        { id: 'des_demo_1', name: 'Sabbatical Travel', estimatedCost: 20000, priority: 'medium' },
      ],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [
        { id: 'ptd_1', name: '401(k) Max', amount: 900, type: 'retirement' },
        { id: 'ptd_2', name: 'Medical', amount: 150, type: 'medical' },
      ],
      taxes: [
        { id: 'tax_1', name: 'Federal W/H', amount: 1200, type: 'federal' },
        { id: 'tax_2', name: 'Social Security', amount: 420, type: 'social_security' },
        { id: 'tax_3', name: 'Medicare', amount: 98, type: 'medicare' },
        { id: 'tax_4', name: 'State W/H', amount: 350, type: 'state' },
      ],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: true, localBackupDone: true },
    },
  },
  {
    id: 'kinged',
    name: 'KINGED',
    emoji: '\u{1F451}',
    description: 'Passive income exceeds all expenses. Financially free.',
    color: '#f4c430',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'salary', name: 'Consulting (part-time)', amount: 4500, frequency: 'biweekly', bankAccountId: 'ba_demo_1' },
          { id: 'is_demo_2', source: 'business', name: 'Rental Duplex (net)', amount: 3500, frequency: 'monthly', bankAccountId: 'ba_demo_2' },
          { id: 'is_demo_3', source: 'business', name: 'Rental Condo (net)', amount: 1800, frequency: 'monthly', bankAccountId: 'ba_demo_2' },
          { id: 'is_demo_4', source: 'business', name: 'SaaS Revenue', amount: 4000, frequency: 'monthly', bankAccountId: 'ba_demo_3' },
          { id: 'is_demo_5', source: 'other', name: 'Dividend Income', amount: 1500, frequency: 'monthly', bankAccountId: 'ba_demo_3' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Operating Account', type: 'checking', currentBalance: 25000, institution: 'Chase', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Cash Reserve', type: 'savings', currentBalance: 100000, institution: 'Marcus', isPrimaryIncome: false },
        { id: 'ba_demo_3', name: 'Brokerage Cash', type: 'investment', currentBalance: 50000, institution: 'Schwab', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'real_estate', name: 'Primary Home', value: 750000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_2', type: 'real_estate', name: 'Rental Duplex', value: 420000, annualIncome: 42000, metadata: {} },
        { id: 'a_demo_3', type: 'real_estate', name: 'Rental Condo', value: 280000, annualIncome: 21600, metadata: {} },
        { id: 'a_demo_4', type: 'retirement', name: '401(k)', value: 950000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_5', type: 'retirement', name: 'Roth IRA', value: 350000, annualIncome: 0, metadata: {} },
        { id: 'a_demo_6', type: 'brokerage', name: 'Dividend Portfolio', value: 600000, annualIncome: 18000, metadata: {} },
        { id: 'a_demo_7', type: 'brokerage', name: 'Growth Portfolio', value: 400000, annualIncome: 4000, metadata: {} },
        { id: 'a_demo_8', type: 'crypto', name: 'Bitcoin', value: 120000, annualIncome: 0, metadata: { symbol: 'BTC', quantity: 1.2 } },
        { id: 'a_demo_9', type: 'crypto', name: 'Ethereum', value: 50000, annualIncome: 0, metadata: { symbol: 'ETH', quantity: 22 } },
        { id: 'a_demo_10', type: 'defi', name: 'USDC Yield Vault', value: 100000, annualIncome: 8000, metadata: {} },
        { id: 'a_demo_11', type: 'business', name: 'SaaS Side Business', value: 200000, annualIncome: 48000, metadata: {} },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Property Tax (Primary)', payee: 'County', amount: 625, category: 'housing', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_2', name: 'Home Insurance', payee: 'Chubb', amount: 180, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_3', name: 'Rental Insurance', payee: 'Chubb', amount: 140, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_4', name: 'Umbrella Policy', payee: 'Chubb', amount: 65, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_5', name: 'Electric', payee: 'Utility Co', amount: 200, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_6', name: 'Internet', payee: 'Fiber', amount: 80, category: 'utilities', isRecurring: true, dueDate: 12 },
        { id: 'ob_demo_7', name: 'Phone', payee: 'Google Fi', amount: 35, category: 'utilities', isRecurring: true, dueDate: 5 },
        { id: 'ob_demo_8', name: 'Property Manager', payee: 'PM Co', amount: 350, category: 'other', isRecurring: true, dueDate: 1 },
      ],
      debts: [],
      desires: [
        { id: 'des_demo_1', name: 'Beach House', estimatedCost: 500000, priority: 'low' },
      ],
      driftTrades: [],
      dailyExpenses: [],
      preTaxDeductions: [],
      taxes: [],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: true, walletDeclined: true, localBackupDone: true },
    },
  },
  {
    id: 'crypto_trader',
    name: 'Crypto Trader',
    emoji: '\u{1F4B9}',
    description: 'Full-time on-chain degen. SOL ecosystem, perps, yield farming.',
    color: '#14f195',
    profile: {
      income: {
        salary: 0, otherIncome: 0, assetIncome: 0,
        sources: [
          { id: 'is_demo_1', source: 'trading', name: 'Drift Perps PnL', amount: 8500, frequency: 'monthly', bankAccountId: 'ba_demo_1' },
          { id: 'is_demo_2', source: 'other', name: 'Yield Farming', amount: 3200, frequency: 'monthly', bankAccountId: 'ba_demo_1' },
        ],
      },
      bankAccounts: [
        { id: 'ba_demo_1', name: 'Checking', type: 'checking', currentBalance: 18000, institution: 'Mercury', isPrimaryIncome: true },
        { id: 'ba_demo_2', name: 'Savings', type: 'savings', currentBalance: 35000, institution: 'Marcus', isPrimaryIncome: false },
      ],
      assets: [
        { id: 'a_demo_1', type: 'crypto', name: 'Solana', value: 185000, annualIncome: 0, metadata: { symbol: 'SOL', quantity: 1250 } },
        { id: 'a_demo_2', type: 'crypto', name: 'Bitcoin', value: 95000, annualIncome: 0, metadata: { symbol: 'BTC', quantity: 0.95 } },
        { id: 'a_demo_3', type: 'crypto', name: 'Ethereum', value: 42000, annualIncome: 0, metadata: { symbol: 'ETH', quantity: 18 } },
        { id: 'a_demo_4', type: 'crypto', name: 'JupSOL', value: 28000, annualIncome: 2100, metadata: { symbol: 'JupSOL', quantity: 190 } },
        { id: 'a_demo_5', type: 'defi', name: 'USD* Yield Vault', value: 75000, annualIncome: 7000, metadata: { symbol: 'USD*' } },
        { id: 'a_demo_6', type: 'defi', name: 'Kamino USDC Supply', value: 40000, annualIncome: 3600, metadata: { symbol: 'USDC' } },
        { id: 'a_demo_7', type: 'crypto', name: 'WHALE', value: 12000, annualIncome: 0, metadata: { symbol: 'WHALE', quantity: 850000 } },
        { id: 'a_demo_8', type: 'crypto', name: 'WIF', value: 8500, annualIncome: 0, metadata: { symbol: 'WIF', quantity: 15000 } },
        { id: 'a_demo_9', type: 'other', name: '2020 Tesla Model 3', value: 18000, annualIncome: 0, metadata: {} },
      ],
      obligations: [
        { id: 'ob_demo_1', name: 'Rent', payee: 'Landlord', amount: 1800, category: 'housing', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_2', name: 'Electric', payee: 'APS', amount: 120, category: 'utilities', isRecurring: true, dueDate: 10 },
        { id: 'ob_demo_3', name: 'Internet', payee: 'Starlink', amount: 120, category: 'utilities', isRecurring: true, dueDate: 15 },
        { id: 'ob_demo_4', name: 'Phone', payee: 'Google Fi', amount: 35, category: 'utilities', isRecurring: true, dueDate: 5 },
        { id: 'ob_demo_5', name: 'Car Insurance', payee: 'Root', amount: 95, category: 'insurance', isRecurring: true, dueDate: 20 },
        { id: 'ob_demo_6', name: 'Health Insurance', payee: 'ACA Marketplace', amount: 450, category: 'insurance', isRecurring: true, dueDate: 1 },
        { id: 'ob_demo_7', name: 'Crypto.com Card', payee: 'Crypto.com', amount: 0, category: 'other', isRecurring: true, dueDate: 1 },
      ],
      debts: [
        { id: 'd_demo_1', name: 'Auto Loan', principal: 20000, interestRate: 0.049, monthlyPayment: 380, minimumPayment: 380, dueDate: 10, balance: 8500, payee: 'Tesla' },
      ],
      desires: [
        { id: 'des_demo_1', name: 'Hardware Wallet Vault Setup', estimatedCost: 500, priority: 'high' },
        { id: 'des_demo_2', name: 'Crypto Tax CPA', estimatedCost: 3000, priority: 'medium' },
      ],
      driftTrades: [
        { id: 'dt_1', symbol: 'SOL-PERP', side: 'long', entryPrice: 120, exitPrice: 148, size: 50, pnlUsdc: 1400, date: new Date(Date.now() - 5 * 86400000).toISOString(), fees: 12 },
        { id: 'dt_2', symbol: 'ETH-PERP', side: 'long', entryPrice: 2200, exitPrice: 2450, size: 5, pnlUsdc: 1250, date: new Date(Date.now() - 12 * 86400000).toISOString(), fees: 8 },
        { id: 'dt_3', symbol: 'BTC-PERP', side: 'short', entryPrice: 98000, exitPrice: 95500, size: 0.5, pnlUsdc: 1250, date: new Date(Date.now() - 18 * 86400000).toISOString(), fees: 15 },
        { id: 'dt_4', symbol: 'SOL-PERP', side: 'long', entryPrice: 135, exitPrice: 128, size: 80, pnlUsdc: -560, date: new Date(Date.now() - 25 * 86400000).toISOString(), fees: 10 },
      ],
      dailyExpenses: [],
      preTaxDeductions: [],
      taxes: [],
      postTaxDeductions: [],
      settings: { debtsConfirmedNone: false, walletDeclined: true, localBackupDone: true },
    },
  },
];

/** Seed AsyncStorage watchlist data for a demo persona */
export async function seedDemoWatchlist(persona: DemoPersona): Promise<void> {
  if (!persona.demoWatchlist || persona.demoWatchlist.length === 0) {
    // Clear watchlist for personas without one
    await AsyncStorage.removeItem('price_watchlist');
    await AsyncStorage.removeItem('watchlist_extended');
    return;
  }

  const watchlist = persona.demoWatchlist.map(item => ({
    mint: item.mint,
    symbol: item.symbol,
    addedAt: Date.now() - 7 * 86400000, // pretend added a week ago
    notes: item.notes,
  }));

  const extData: Record<string, any> = {};
  for (const item of persona.demoWatchlist) {
    extData[item.mint] = {
      mint: item.mint,
      addedPrice: item.addedPrice,
      entryTarget1: item.addedPrice * 0.8,
      entryTarget2: item.addedPrice * 0.6,
      maxAllocationPct: 5,
      takeProfitPct: 100,
      stopLossPct: -25,
      notes: item.notes,
    };
  }

  await AsyncStorage.setItem('price_watchlist', JSON.stringify(watchlist));
  await AsyncStorage.setItem('watchlist_extended', JSON.stringify(extData));
}
