// src/utils/csvBankImport.ts
import { BankTransaction, BankTransactionCategory } from "@/types/bankTransactionTypes";

/**
 * Auto-categorization rules based on transaction description keywords.
 * Matches are case-insensitive. First match wins.
 */
const AUTO_CATEGORY_RULES: Array<{
  keywords: string[];
  category: BankTransactionCategory;
}> = [
    // Income
    { keywords: ['payroll', 'direct dep', 'salary', 'wages', 'employer', 'ach credit'], category: 'income_salary' },
    { keywords: ['venmo', 'zelle', 'cashapp', 'paypal'], category: 'income_transfer_in' },
    { keywords: ['refund', 'return', 'credit adj', 'rebate'], category: 'income_refund' },
    { keywords: ['9dtpayment', 'interest', 'dividend', 'princ'], category: 'income_other' },

    // Housing
    { keywords: ['rent', 'lease', 'landlord', 'property mgmt'], category: 'housing_rent' },
    { keywords: ['mortgage', 'home loan', 'escrow'], category: 'housing_mortgage' },

    // Utilities
    { keywords: ['electric', 'power', 'energy', 'eversource', 'con edison', 'duke energy', 'pge'], category: 'utilities_electric' },
    { keywords: ['water', 'sewer', 'water bill'], category: 'utilities_water' },
    { keywords: ['gas bill', 'natural gas', 'gas co'], category: 'utilities_gas' },
    { keywords: ['comcast', 'xfinity', 'spectrum', 'att internet', 'verizon fios', 'internet', 'wifi', 'broadband'], category: 'utilities_internet' },
    { keywords: ['t-mobile', 'tmobile', 'at&t', 'verizon wireless', 'phone bill', 'sprint', 'mint mobile', 'cricket', 'postpaid'], category: 'utilities_phone' },

    // Food
    { keywords: ['walmart', 'target', 'costco', 'kroger', 'safeway', 'publix', 'whole foods', 'trader joe', 'aldi', 'grocery', 'grocer', 'heb ', 'piggly', 'food city', 'fry\'s food', 'frys food', 'winco'], category: 'food_grocery' },
    { keywords: ['uber eats', 'doordash', 'grubhub', 'instacart', 'postmates', 'delivery'], category: 'food_delivery' },
    { keywords: ['starbucks', 'dunkin', 'coffee', 'peets', 'dutch bros'], category: 'food_coffee' },
    { keywords: ['restaurant', 'dine', 'dining', 'pizza', 'burger', 'taco', 'sushi', 'bar ', 'grill', 'bbq', 'mcdonald', 'wendy', 'chick-fil', 'chipotle', 'panera', 'olive garden', 'applebee', 'ihop', 'waffle'], category: 'food_restaurant' },

    // Transport
    { keywords: ['shell', 'exxon', 'bp ', 'chevron', 'gas station', 'fuel', 'gasoline', 'speedway', 'wawa', 'sunoco'], category: 'transport_fuel' },
    { keywords: ['uber', 'lyft', 'rideshare'], category: 'transport_rideshare' },
    { keywords: ['parking', 'meter', 'garage'], category: 'transport_parking' },
    { keywords: ['mta', 'metro', 'transit', 'bus', 'subway', 'rail'], category: 'transport_public' },
    { keywords: ['autozone', 'jiffy', 'meineke', 'mechanic', 'tire', 'oil change', 'car wash'], category: 'transport_maintenance' },

    // Insurance
    { keywords: ['geico', 'progressive', 'allstate', 'state farm', 'auto insurance', 'car insurance', 'insuran'], category: 'insurance_auto' },
    { keywords: ['health insurance', 'medical insurance', 'anthem', 'blue cross', 'cigna', 'aetna', 'united health', 'kaiser'], category: 'insurance_health' },
    { keywords: ['life insurance', 'term life', 'whole life'], category: 'insurance_life' },
    { keywords: ['home insurance', 'homeowner', 'renter insurance', 'renters ins'], category: 'insurance_home' },

    // Medical
    { keywords: ['cvs', 'walgreens', 'pharmacy', 'pharm', 'rite aid', 'prescription'], category: 'medical_pharmacy' },
    { keywords: ['doctor', 'clinic', 'hospital', 'medical', 'urgent care', 'health center', 'pediatr', 'therap', 'chiropr', 'optom', 'ophthal', 'dermat', 'surgeo', 'surgeon'], category: 'medical_doctor' },
    { keywords: ['dentist', 'dental', 'denti', 'orthodont'], category: 'medical_dental' },

    // Subscriptions
    { keywords: ['netflix', 'hulu', 'disney+', 'hbo', 'paramount', 'peacock', 'apple tv', 'youtube premium', 'spotify', 'apple music', 'amazon prime', 'prime pmts'], category: 'subscription_streaming' },
    { keywords: ['adobe', 'microsoft', 'google storage', 'icloud', 'dropbox', 'github', 'notion', 'slack', 'openai', 'chatgpt', 'apple.com/bill', 'asurion'], category: 'subscription_software' },
    { keywords: ['gym', 'fitness', 'planet fitness', 'la fitness', 'ymca', 'equinox', 'crossfit', 'orange theory'], category: 'subscription_gym' },

    // Personal
    { keywords: ['amazon', 'amzn'], category: 'other' }, // Amazon is ambiguous - user can recategorize
    { keywords: ['clothing', 'apparel', 'shoes', 'nike', 'nike.com', 'adidas', 'gap ', 'old navy', 'h&m', 'zara', 'nordstrom'], category: 'personal_clothing' },
    { keywords: ['haircut', 'salon', 'barber', 'spa', 'nail', 'beauty', 'cosmet'], category: 'personal_grooming' },

    // Entertainment
    { keywords: ['ticketmaster', 'stubhub', 'concert', 'movie', 'amc', 'regal', 'cinema'], category: 'entertainment_events' },
    { keywords: ['steam', 'playstation', 'xbox', 'nintendo', 'gaming'], category: 'entertainment_hobbies' },
    { keywords: ['airline', 'hotel', 'airbnb', 'booking.com', 'expedia', 'travel', 'marriott', 'hilton'], category: 'entertainment_travel' },

    // Financial
    { keywords: ['atm', 'withdrawal', 'cash back'], category: 'other' },
    { keywords: ['investment', 'fidelity', 'schwab', 'vanguard', 'robinhood', 'etrade', 'brokerage', 'morgan stanley', 'purchase of btc', 'purchase of eth', 'purchase of bitcoin', 'sale of', 'purchase of'], category: 'financial_investment' },
    { keywords: ['savings transfer', 'savings internal transfer', 'save', 'to savings'], category: 'financial_savings_transfer' },
    { keywords: ['borrowing in cash app', 'borrow'], category: 'financial_debt_payment' },
    { keywords: ['afterpay'], category: 'financial_debt_payment' },
    { keywords: ['repayment', 'overdraft'], category: 'financial_debt_payment' },
    { keywords: ['loan payment', 'student loan', 'auto loan', 'credit card payment', 'capital one mobile pmt', 'american express', 'amex', 'discover payment', 'chase payment', 'bridgecrest', 'foris dax', 'applecard gsbank', 'apple card'], category: 'financial_debt_payment' },
    { keywords: ['overdraft', 'nsf', 'fee', 'service charge', 'monthly fee', 'maintenance fee'], category: 'financial_fees' },
    { keywords: ['irs', 'tax', 'state tax', 'property tax'], category: 'financial_taxes' },

    // Transfers
    { keywords: ['transfer', 'xfer', 'wire', 'apple cash', 'sent money', 'money transfer', 'apple cash balance'], category: 'transfer_between_accounts' },

    // Habits
    { keywords: ['tobacco', 'cigarette', 'smoke shop', 'vape'], category: 'smoking' },
  ];

/**
 * Auto-categorize a transaction description
 */
export function autoCategorize(description: string): BankTransactionCategory {
  const lower = description.toLowerCase();
  // Strip common bank prefixes (e.g., "WF *", "SQ *", "TST*") for better matching
  const stripped = lower.replace(/^(wf|sq|tst|sp|pp)\s*\*\s*/, '');
  for (const rule of AUTO_CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw) || stripped.includes(kw))) {
      return rule.category;
    }
  }
  return 'other';
}

/**
 * Determine transaction type from amount and description
 * Convention: SoFi/most banks use negative = money out, positive = money in
 */
function determineType(amount: number, description: string): 'income' | 'expense' | 'transfer' {
  const lower = description.toLowerCase();
  if (lower.includes('transfer') || lower.includes('xfer')) return 'transfer';
  // Negative = money going out = expense, Positive = money coming in = income
  return amount < 0 ? 'expense' : 'income';
}

/**
 * Parse a date string from various bank CSV formats
 * Supports: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, MM/DD/YY, M/D/YYYY
 */
function parseDate(dateStr: string): string {
  const cleaned = dateStr.trim().replace(/"/g, '');

  // Try YYYY-MM-DD (with optional time/timezone suffix like "2026-03-02 16:03:13 MST")
  const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // MM/DD/YYYY or M/D/YYYY or MM-DD-YYYY
  const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Fallback: try native Date parsing
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0]; // fallback to today
}

/**
 * Parse a number string, handling various formats
 */
function parseAmount(amountStr: string): number {
  const cleaned = amountStr
    .trim()
    .replace(/"/g, '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '');

  // Handle parentheses for negative (accounting format)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1));
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Smart CSV column detection
 * Tries to find date, description, and amount columns automatically
 * Supports: Chase, BoA, Wells Fargo, Capital One, SoFi, Discover, Ally, and generic CSVs
 */
interface ColumnMap {
  dateCol: number;
  descCol: number;
  amountCol: number;
  debitCol?: number;   // Some banks split debit/credit
  creditCol?: number;
  typeCol?: number;    // SoFi has a "Type" column (P2P, DEBIT_CARD, DEPOSIT)
  statusCol?: number;  // SoFi has "Status" (Posted, Pending)
  senderCol?: number;  // Cash App has "Name of sender/receiver"
  assetTypeCol?: number;   // Cash App: "Asset Type" (BTC)
  assetAmountCol?: number; // Cash App: "Asset Amount" (0.00000482)
  assetPriceCol?: number;  // Cash App: "Asset Price" ($70,606.40)
}

export interface SavingsAccumulation {
  totalDeposits: number;   // total USD moved to savings
  totalWithdrawals: number; // total USD moved from savings
  netBalance: number;      // deposits - withdrawals
  transactionCount: number;
  lastDate: string;
}

export interface DebtAccumulation {
  name: string;            // e.g. "Cash App Borrow", "Afterpay"
  totalBorrowed: number;   // total USD borrowed
  totalRepaid: number;     // total USD repaid
  outstandingBalance: number; // borrowed - repaid
  transactionCount: number;
  lastDate: string;
}

export interface CryptoAccumulation {
  asset: string;       // e.g. "BTC"
  totalBought: number; // total crypto purchased
  totalSold: number;   // total crypto sold
  totalAmount: number; // net position (bought - sold)
  totalSpent: number;  // total USD spent on buys
  totalProceeds: number; // total USD received from sells
  avgPrice: number;    // average purchase price
  purchaseCount: number;
  sellCount: number;
  realizedPnL: number; // proceeds - cost basis of sold units
  lastPurchaseDate: string;
}

function detectColumns(headers: string[]): ColumnMap {
  const lower = headers.map(h => h.toLowerCase().trim().replace(/"/g, ''));

  const dateCol = lower.findIndex(h =>
    h === 'date' || h === 'posted date' || h === 'transaction date' ||
    h === 'posting date' || h === 'trans date' || h === 'post date' ||
    h === 'effective date'
  );

  const descCol = lower.findIndex(h =>
    h === 'description' || h === 'memo' || h === 'payee' || h === 'name' ||
    h === 'transaction' || h === 'details' || h === 'narrative' ||
    h === 'merchant' || h === 'original description' || h === 'notes'
  );

  // Cash App: "Name of sender/receiver" column for combining with Notes
  const senderCol = lower.findIndex(h =>
    h === 'name of sender/receiver' || h === 'sender/receiver' || h === 'sender'
  );

  const amountCol = lower.findIndex(h =>
    h === 'amount' || h === 'transaction amount' || h === 'total' ||
    h.startsWith('amount (') || h === 'amount (usd)'
  );

  const debitCol = lower.findIndex(h =>
    h === 'debit' || h === 'withdrawals' || h === 'debit amount' || h === 'charges'
  );

  const creditCol = lower.findIndex(h =>
    h === 'credit' || h === 'deposits' || h === 'credit amount'
  );

  // SoFi-specific columns
  const typeCol = lower.findIndex(h =>
    h === 'type' || h === 'transaction type' || h === 'trans type'
  );

  const statusCol = lower.findIndex(h =>
    h === 'status' || h === 'transaction status'
  );

  // Cash App crypto columns
  const assetTypeCol = lower.findIndex(h =>
    h === 'asset type' || h === 'asset'
  );
  const assetAmountCol = lower.findIndex(h =>
    h === 'asset amount' || h === 'asset qty' || h === 'asset quantity'
  );
  const assetPriceCol = lower.findIndex(h =>
    h === 'asset price' || h === 'price per coin'
  );

  return {
    dateCol: dateCol >= 0 ? dateCol : 0,
    descCol: descCol >= 0 ? descCol : 1,
    amountCol: amountCol >= 0 ? amountCol : (debitCol >= 0 ? -1 : 2),
    debitCol: debitCol >= 0 ? debitCol : undefined,
    creditCol: creditCol >= 0 ? creditCol : undefined,
    typeCol: typeCol >= 0 ? typeCol : undefined,
    statusCol: statusCol >= 0 ? statusCol : undefined,
    senderCol: senderCol >= 0 ? senderCol : undefined,
    assetTypeCol: assetTypeCol >= 0 ? assetTypeCol : undefined,
    assetAmountCol: assetAmountCol >= 0 ? assetAmountCol : undefined,
    assetPriceCol: assetPriceCol >= 0 ? assetPriceCol : undefined,
  };
}

/**
 * Use the bank "type" column (e.g., SoFi's DEBIT_CARD, P2P, DEPOSIT)
 * to help determine transaction type
 */
function typeFromBankType(bankType: string, amount: number): 'income' | 'expense' | 'transfer' {
  const upper = bankType.toUpperCase().trim();

  // Income types
  if (upper === 'DEPOSIT' || upper === 'DIRECT_DEPOSIT' || upper === 'ACH_CREDIT' ||
    upper === 'INTEREST' || upper === 'REFUND' || upper === 'CREDIT' ||
    upper === 'PAYMENT') {
    return 'income';
  }

  // Transfer types
  if (upper === 'P2P' || upper === 'TRANSFER' || upper === 'WIRE' ||
    upper === 'ACH_TRANSFER' || upper === 'INTERNAL_TRANSFER' ||
    upper === 'SAVINGS INTERNAL TRANSFER') {
    return 'transfer';
  }

  // Expense types
  if (upper === 'DEBIT_CARD' || upper === 'DEBIT' || upper === 'CHECK' ||
    upper === 'ATM' || upper === 'WITHDRAWAL' || upper === 'FEE' ||
    upper === 'ACH_DEBIT' || upper === 'POS' || upper === 'PURCHASE' ||
    upper === 'BORROW' || upper === 'OVERDRAFT') {
    return 'expense';
  }

  // Fall back to amount sign
  return amount < 0 ? 'expense' : 'income';
}

/**
 * Detect delimiter: tab, comma, pipe, or multi-space
 */
function detectDelimiter(firstLine: string): string | 'multispace' {
  // Count occurrences of common delimiters
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const pipes = (firstLine.match(/\|/g) || []).length;

  // SoFi and many banks use tabs when you copy-paste from the web
  if (tabs >= 3 && tabs >= commas) return '\t';
  if (commas >= 3) return ',';
  if (pipes >= 3) return '|';

  // Fallback: some browsers convert tabs to multiple spaces
  // Check if splitting on 2+ spaces gives a reasonable number of fields
  const spaceSplit = firstLine.split(/\s{2,}/);
  if (spaceSplit.length >= 4) return 'multispace';

  return ',';
}

/**
 * Parse CSV/TSV text into an array of raw rows
 * Auto-detects delimiter (comma, tab, pipe, or multi-space)
 * Handles quoted fields with delimiters inside them
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split(/\r?\n/);

  if (lines.length === 0) return rows;

  // Detect delimiter from first non-empty line
  const firstLine = lines.find(l => l.trim().length > 0) || '';
  const delimiter = detectDelimiter(firstLine);

  for (const line of lines) {
    if (!line.trim()) continue;

    // Multi-space splitting (SoFi copy-paste from browser)
    if (delimiter === 'multispace') {
      const fields = line.split(/\s{2,}/).map(f => f.trim().replace(/^"|"$/g, ''));
      rows.push(fields);
      continue;
    }

    // For tab/pipe delimiters, simple split is usually safe
    if (delimiter !== ',') {
      const fields = line.split(delimiter).map(f => f.trim().replace(/^"|"$/g, ''));
      rows.push(fields);
      continue;
    }

    // For comma delimiter, handle quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
}

/**
 * Check if a string looks like a date
 */
function looksLikeDate(str: string): boolean {
  const cleaned = str.trim().replace(/"/g, '');
  // MM/DD/YYYY or M/D/YYYY or MM-DD-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cleaned)) return true;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return true;
  return false;
}

/**
 * Check if a string looks like a number/amount
 */
function looksLikeAmount(str: string): boolean {
  const cleaned = str.trim().replace(/"/g, '').replace(/[\$,]/g, '');
  return /^[\-\+]?\d+\.?\d*$/.test(cleaned) || /^\([\d\.]+\)$/.test(cleaned);
}

/**
 * For headerless data (like Wells Fargo), detect columns by scanning content.
 * Returns column map + whether we detected it as headerless.
 */
function detectHeaderless(rows: string[][]): { isHeaderless: boolean; columns: ColumnMap } | null {
  if (rows.length < 1) return null;

  const firstRow = rows[0];

  // If the first cell looks like a date, this is likely headerless data
  if (!looksLikeDate(firstRow[0] || '')) return null;

  // Headerless! Scan first row to find columns by content type
  let dateCol = -1;
  let amountCol = -1;
  let descCol = -1;

  for (let c = 0; c < firstRow.length; c++) {
    const val = firstRow[c].trim();
    if (dateCol === -1 && looksLikeDate(val)) {
      dateCol = c;
    } else if (amountCol === -1 && looksLikeAmount(val)) {
      amountCol = c;
    } else if (descCol === -1 && val.length > 5 && !looksLikeDate(val) && !looksLikeAmount(val) && val !== '*') {
      descCol = c;
    }
  }

  // If we couldn't find description, pick the longest non-date/amount field
  if (descCol === -1) {
    let maxLen = 0;
    for (let c = 0; c < firstRow.length; c++) {
      const val = firstRow[c].trim();
      if (c !== dateCol && c !== amountCol && val.length > maxLen && val !== '*') {
        maxLen = val.length;
        descCol = c;
      }
    }
  }

  if (dateCol === -1 || amountCol === -1) return null;
  if (descCol === -1) descCol = amountCol + 1 < firstRow.length ? amountCol + 1 : 1;

  return {
    isHeaderless: true,
    columns: {
      dateCol,
      descCol,
      amountCol,
    },
  };
}

/**
 * Main CSV import function
 * Takes raw CSV text and a bankAccountId, returns parsed transactions
 */
export function parseCSVTransactions(
  csvText: string,
  bankAccountId: string,
): { transactions: BankTransaction[]; errors: string[]; summary: string; cryptoAccumulations?: CryptoAccumulation[]; savingsAccumulation?: SavingsAccumulation; debtAccumulations?: DebtAccumulation[] } {
  const errors: string[] = [];
  const transactions: BankTransaction[] = [];
  const batchId = `csv_${Date.now()}`;

  const rows = parseCSVRows(csvText);
  if (rows.length < 1) {
    return { transactions: [], errors: ['CSV file is empty or has no data rows'], summary: 'No data found' };
  }

  // ── Detect headerless vs header format ──
  const headerlessResult = detectHeaderless(rows);
  let columns: ColumnMap;
  let dataStartIndex: number;

  if (headerlessResult) {
    // Headerless (Wells Fargo, some other banks)
    columns = headerlessResult.columns;
    dataStartIndex = 0; // All rows are data
    console.log('[CSV_IMPORT] Headerless format detected (e.g., Wells Fargo)');
  } else {
    // Has headers (SoFi, Chase, etc.)
    columns = detectColumns(rows[0]);
    dataStartIndex = 1; // Skip header row
    console.log('[CSV_IMPORT] Headers detected:', rows[0]);
  }

  console.log('[CSV_IMPORT] Column map:', JSON.stringify(columns));
  console.log('[CSV_IMPORT] Total rows:', rows.length, '| Data starts at row:', dataStartIndex);

  // Track crypto buys & sells (e.g. Cash App BTC round-ups, stock trades)
  const cryptoMap: Record<string, { totalBought: number; totalSold: number; totalSpent: number; totalProceeds: number; buyCount: number; sellCount: number; lastBuyDate: string }> = {};

  // Track savings transfers
  const savings = { deposits: 0, withdrawals: 0, count: 0, lastDate: '' };

  // Track borrows and repayments
  const debtMap: Record<string, { borrowed: number; repaid: number; count: number; lastDate: string }> = {};

  // Parse data rows
  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue; // skip empty-ish rows

    try {
      const dateStr = row[columns.dateCol] || '';
      let description = (row[columns.descCol] || '').replace(/"/g, '').trim();

      // Cash App: combine Notes with sender/receiver name for a better description
      if (columns.senderCol !== undefined) {
        const sender = (row[columns.senderCol] || '').replace(/"/g, '').trim();
        if (sender && description) {
          description = `${description} — ${sender}`;
        } else if (sender && !description) {
          description = sender;
        }
      }

      if (!dateStr || !description) {
        errors.push(`Row ${i + 1}: Missing date or description`);
        continue;
      }

      // Skip pending transactions if status column exists
      if (columns.statusCol !== undefined) {
        const status = (row[columns.statusCol] || '').trim().toLowerCase();
        if (status === 'pending') continue; // only import posted transactions
      }

      // Determine amount
      let rawAmount: number;
      if (columns.amountCol >= 0) {
        // Single amount column
        rawAmount = parseAmount(row[columns.amountCol] || '0');
      } else if (columns.debitCol !== undefined && columns.creditCol !== undefined) {
        // Split debit/credit columns
        const debit = parseAmount(row[columns.debitCol] || '0');
        const credit = parseAmount(row[columns.creditCol] || '0');
        rawAmount = credit > 0 ? credit : -Math.abs(debit); // positive = income, negative = expense
      } else {
        errors.push(`Row ${i + 1}: Cannot determine amount`);
        continue;
      }

      if (rawAmount === 0) continue; // skip zero-amount rows

      // Determine transaction type
      // If the bank provides a type column (e.g., SoFi: P2P, DEBIT_CARD, DEPOSIT), use it
      let type: 'income' | 'expense' | 'transfer';
      if (columns.typeCol !== undefined && row[columns.typeCol]) {
        type = typeFromBankType(row[columns.typeCol], rawAmount);
      } else {
        type = determineType(rawAmount, description);
      }

      // Auto-categorize from description
      let category = autoCategorize(description);

      // If auto-categorize says 'other' but bank type gives us a hint, improve it
      if (category === 'other') {
        if (type === 'income' && rawAmount > 0) category = 'income_other';
        if (columns.typeCol !== undefined) {
          const bankType = (row[columns.typeCol] || '').toUpperCase().trim();
          if (bankType === 'P2P') category = type === 'income' ? 'income_transfer_in' : 'transfer_to_other';
          if (bankType === 'INTEREST') category = 'income_other';
          if (bankType === 'FEE') category = 'financial_fees';
          if (bankType === 'ATM') category = 'other';
          if (bankType === 'PAYMENT') category = 'income_transfer_in';
        }
      }

      // Ensure income categories match income type
      const isIncomeCategory = category.startsWith('income_');
      if (type === 'income' && !isIncomeCategory && category === 'other') {
        category = 'income_other';
      }

      const transaction: BankTransaction = {
        id: `bt_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        bankAccountId,
        date: parseDate(dateStr),
        description,
        amount: Math.abs(rawAmount), // Store as absolute, type indicates direction
        category,
        type,
        importedFrom: 'csv',
        importBatchId: batchId,
      };

      transactions.push(transaction);

      // Track crypto/stock buys & sells (Cash App BTC round-ups, stock trades, etc.)
      if (columns.assetTypeCol !== undefined && columns.assetAmountCol !== undefined) {
        const assetType = (row[columns.assetTypeCol] || '').trim().toUpperCase();
        const assetAmount = parseFloat((row[columns.assetAmountCol] || '0').replace(/[,$]/g, ''));
        if (assetType && assetAmount > 0) {
          if (!cryptoMap[assetType]) {
            cryptoMap[assetType] = { totalBought: 0, totalSold: 0, totalSpent: 0, totalProceeds: 0, buyCount: 0, sellCount: 0, lastBuyDate: '' };
          }
          // Negative rawAmount = money leaving = buy; Positive rawAmount = money coming in = sell
          const isSell = rawAmount > 0 || description.toLowerCase().includes('sale of');
          if (isSell) {
            cryptoMap[assetType].totalSold += assetAmount;
            cryptoMap[assetType].totalProceeds += Math.abs(rawAmount);
            cryptoMap[assetType].sellCount += 1;
          } else {
            cryptoMap[assetType].totalBought += assetAmount;
            cryptoMap[assetType].totalSpent += Math.abs(rawAmount);
            cryptoMap[assetType].buyCount += 1;
            const txDate = parseDate(dateStr);
            if (!cryptoMap[assetType].lastBuyDate || txDate > cryptoMap[assetType].lastBuyDate) {
              cryptoMap[assetType].lastBuyDate = txDate;
            }
          }
        }
      }

      // Track savings transfers
      const descLower = description.toLowerCase();
      if (descLower === 'savings' || descLower.includes('savings internal transfer') || descLower.includes('savings transfer')) {
        const amt = Math.abs(rawAmount);
        // Negative rawAmount = money leaving checking to savings = deposit into savings
        if (rawAmount < 0) {
          savings.deposits += amt;
        } else {
          savings.withdrawals += amt;
        }
        savings.count += 1;
        const txDate = parseDate(dateStr);
        if (!savings.lastDate || txDate > savings.lastDate) savings.lastDate = txDate;
      }

      // Track borrows and repayments
      if (descLower.includes('borrowing in cash app') || descLower.includes('borrow')) {
        const key = 'Cash App Borrow';
        if (!debtMap[key]) debtMap[key] = { borrowed: 0, repaid: 0, count: 0, lastDate: '' };
        debtMap[key].borrowed += Math.abs(rawAmount);
        debtMap[key].count += 1;
        const txDate = parseDate(dateStr);
        if (!debtMap[key].lastDate || txDate > debtMap[key].lastDate) debtMap[key].lastDate = txDate;
      } else if (descLower.includes('repayment') || (descLower.includes('overdraft') && rawAmount < 0)) {
        const key = 'Cash App Borrow';
        if (!debtMap[key]) debtMap[key] = { borrowed: 0, repaid: 0, count: 0, lastDate: '' };
        debtMap[key].repaid += Math.abs(rawAmount);
        debtMap[key].count += 1;
        const txDate = parseDate(dateStr);
        if (!debtMap[key].lastDate || txDate > debtMap[key].lastDate) debtMap[key].lastDate = txDate;
      } else if (descLower.includes('afterpay')) {
        const key = 'Afterpay';
        if (!debtMap[key]) debtMap[key] = { borrowed: 0, repaid: 0, count: 0, lastDate: '' };
        // Afterpay payments are repayments (money going out)
        debtMap[key].repaid += Math.abs(rawAmount);
        debtMap[key].count += 1;
        const txDate = parseDate(dateStr);
        if (!debtMap[key].lastDate || txDate > debtMap[key].lastDate) debtMap[key].lastDate = txDate;
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const incomeCount = transactions.filter(t => t.type === 'income').length;
  const expenseCount = transactions.filter(t => t.type === 'expense').length;
  const totalIn = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Build crypto accumulations
  const cryptoAccumulations: CryptoAccumulation[] = Object.entries(cryptoMap).map(([asset, data]) => {
    const netAmount = data.totalBought - data.totalSold;
    const avgBuyPrice = data.totalBought > 0 ? data.totalSpent / data.totalBought : 0;
    // Realized P&L: proceeds from sells - cost basis of sold units (using avg buy price)
    const costBasisSold = data.totalSold * avgBuyPrice;
    const realizedPnL = data.totalProceeds - costBasisSold;
    return {
      asset,
      totalBought: data.totalBought,
      totalSold: data.totalSold,
      totalAmount: netAmount,
      totalSpent: data.totalSpent,
      totalProceeds: data.totalProceeds,
      avgPrice: avgBuyPrice,
      purchaseCount: data.buyCount,
      sellCount: data.sellCount,
      realizedPnL,
      lastPurchaseDate: data.lastBuyDate,
    };
  });

  if (cryptoAccumulations.length > 0) {
    console.log('[CSV_IMPORT] Assets detected:', cryptoAccumulations.map(c =>
      `${c.asset}: bought ${c.totalBought} ($${c.totalSpent.toFixed(2)}), sold ${c.totalSold} ($${c.totalProceeds.toFixed(2)}), net ${c.totalAmount}`
    ).join(', '));
  }

  // Build savings accumulation
  const savingsAccumulation: SavingsAccumulation | undefined = savings.count > 0 ? {
    totalDeposits: savings.deposits,
    totalWithdrawals: savings.withdrawals,
    netBalance: savings.deposits - savings.withdrawals,
    transactionCount: savings.count,
    lastDate: savings.lastDate,
  } : undefined;

  if (savingsAccumulation) {
    console.log(`[CSV_IMPORT] Savings detected: $${savingsAccumulation.totalDeposits.toFixed(2)} in, $${savingsAccumulation.totalWithdrawals.toFixed(2)} out, net $${savingsAccumulation.netBalance.toFixed(2)}`);
  }

  // Build debt accumulations
  const debtAccumulations: DebtAccumulation[] = Object.entries(debtMap).map(([name, data]) => ({
    name,
    totalBorrowed: data.borrowed,
    totalRepaid: data.repaid,
    outstandingBalance: data.borrowed - data.repaid,
    transactionCount: data.count,
    lastDate: data.lastDate,
  }));

  if (debtAccumulations.length > 0) {
    console.log('[CSV_IMPORT] Debts detected:', debtAccumulations.map(d =>
      `${d.name}: borrowed $${d.totalBorrowed.toFixed(2)}, repaid $${d.totalRepaid.toFixed(2)}, outstanding $${d.outstandingBalance.toFixed(2)}`
    ).join(', '));
  }

  const summary = `${transactions.length} transactions: ${incomeCount} deposits ($${totalIn.toLocaleString()}), ${expenseCount} expenses ($${totalOut.toLocaleString()})`;

  return {
    transactions, errors, summary,
    cryptoAccumulations: cryptoAccumulations.length > 0 ? cryptoAccumulations : undefined,
    savingsAccumulation,
    debtAccumulations: debtAccumulations.length > 0 ? debtAccumulations : undefined,
  };
}

/**
 * Detect recurring transactions from transaction history.
 * Looks for transactions with similar descriptions appearing monthly.
 * Returns candidates that could become Obligations.
 */
export function detectRecurring(transactions: BankTransaction[]): Array<{
  name: string;
  averageAmount: number;
  frequency: number; // times per month
  category: BankTransactionCategory;
  lastDate: string;
  matchingIds: string[];
}> {
  // Group by cleaned description
  const groups: Record<string, BankTransaction[]> = {};

  for (const t of transactions) {
    if (t.type === 'income') continue; // only look at expenses

    // Clean description for grouping
    const cleaned = t.description
      .replace(/\d{2}\/\d{2}/g, '')     // remove dates
      .replace(/#\d+/g, '')              // remove reference numbers
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30)
      .toLowerCase();

    if (!cleaned) continue;
    if (!groups[cleaned]) groups[cleaned] = [];
    groups[cleaned].push(t);
  }

  const results: Array<{
    name: string;
    averageAmount: number;
    frequency: number;
    category: BankTransactionCategory;
    lastDate: string;
    matchingIds: string[];
  }> = [];

  for (const [name, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue; // need at least 2 occurrences

    // Check if they span at least 2 different months
    const months = new Set(txns.map(t => t.date.substring(0, 7)));
    if (months.size < 2) continue;

    // Calculate frequency (transactions per month)
    const dates = txns.map(t => new Date(t.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const monthSpan = (maxDate - minDate) / (30 * 24 * 60 * 60 * 1000);
    const frequency = monthSpan > 0 ? txns.length / monthSpan : 0;

    // Must occur roughly monthly (0.7 - 1.5 times per month)
    if (frequency < 0.7 || frequency > 1.5) continue;

    const avgAmount = txns.reduce((s, t) => s + t.amount, 0) / txns.length;
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    results.push({
      name: txns[0].description.substring(0, 40),
      averageAmount: Math.round(avgAmount * 100) / 100,
      frequency: Math.round(frequency * 10) / 10,
      category: txns[0].category,
      lastDate: sorted[0].date,
      matchingIds: txns.map(t => t.id),
    });
  }

  // Sort by average amount descending
  return results.sort((a, b) => b.averageAmount - a.averageAmount);
}
