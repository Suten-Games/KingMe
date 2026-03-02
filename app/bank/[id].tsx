// app/bank/[id].tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Bank Account Detail — Transaction ledger with CSV import & budget breakdown
// ═══════════════════════════════════════════════════════════════════════════════
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../../src/store/useStore';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup } from '@/types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } from '@/types/bankTransactionTypes';
import { parseCSVTransactions, detectRecurring, autoCategorize } from '../../src/utils/csvBankImport';

// If you have a theme file:
// import { T } from '../../src/theme';

// ─── View modes ────────────────────────────────────────────────────────────────
type ViewMode = 'transactions' | 'budget' | 'recurring';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatCurrency(amt: number): string {
  return `$${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Normalize: strip punctuation/special chars, collapse spaces, lowercase
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[\/\.\,\-\_\+\*\#\@\!\?\'\"\:\;\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract word tokens (3+ chars) for overlap matching
function tokenize(str: string): string[] {
  return normalize(str).split(' ').filter(w => w.length >= 3);
}

// Check if two strings share significant word tokens
function hasTokenOverlap(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const overlap = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)));
  return overlap.length > 0;
}

function groupByDate(transactions: BankTransaction[]): Record<string, BankTransaction[]> {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groups: Record<string, BankTransaction[]> = {};
  sorted.forEach(t => {
    const key = t.date.split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

// ─── Quick category picker (most common ones) ────────────────────────────────
const QUICK_CATEGORIES: BankTransactionCategory[] = [
  'food_grocery', 'food_restaurant', 'food_delivery', 'food_coffee',
  'transport_fuel', 'transport_rideshare',
  'housing_rent', 'utilities_electric', 'utilities_internet', 'utilities_phone',
  'subscription_streaming', 'subscription_software', 'subscription_gym',
  'medical_pharmacy', 'medical_doctor',
  'personal_clothing', 'personal_grooming',
  'entertainment_events', 'entertainment_hobbies',
  'financial_investment', 'financial_debt_payment',
  'income_salary', 'income_freelance', 'income_transfer_in', 'income_refund',
  'transfer_between_accounts',
  'business_expense', 'smoking', 'other',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BankAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ── Store ──
  const bankAccounts = useStore(s => s.bankAccounts);
  const bankTransactions = useStore(s => s.bankTransactions || []);
  const addBankTransaction = useStore(s => s.addBankTransaction);
  const removeBankTransaction = useStore(s => s.removeBankTransaction);
  const updateBankTransaction = useStore(s => s.updateBankTransaction);
  const importBankTransactions = useStore(s => s.importBankTransactions);
  const addObligation = useStore(s => s.addObligation);
  const obligations = useStore(s => s.obligations);
  const debts = useStore(s => s.debts);
  const addDebt = useStore(s => s.addDebt);
  const updateBankAccount = useStore(s => s.updateBankAccount);

  const account = bankAccounts.find(a => a.id === id);
  const accountTransactions = useMemo(
    () => bankTransactions.filter(t => t.bankAccountId === id),
    [bankTransactions, id]
  );

  // ── State ──
  const [viewMode, setViewMode] = useState<ViewMode>('transactions');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Add form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<BankTransactionCategory>('other');
  const [formType, setFormType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [formNotes, setFormNotes] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);

  // Import state
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<{ transactions: BankTransaction[]; summary: string; errors: string[] } | null>(null);

  // Balance edit state
  const [showBalanceEdit, setShowBalanceEdit] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  // ── Upcoming bills for this account ──
  const upcomingBills = useMemo(() => {
    if (!account) return [];
    const accountObligations = obligations.filter(
      o => o.bankAccountId === id
    );
    const accountDebts = debts.filter(
      d => d.bankAccountId === id
    );

    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const bills: Array<{ name: string; amount: number; dueDay: number; daysUntil: number; isPast: boolean }> = [];

    for (const ob of accountObligations) {
      const dueDay = ob.dueDate || 1;
      let daysUntil = dueDay - currentDay;
      if (daysUntil < 0) daysUntil += daysInMonth; // next month
      bills.push({
        name: ob.name,
        amount: ob.amount,
        dueDay,
        daysUntil,
        isPast: dueDay < currentDay,
      });
    }

    for (const d of accountDebts) {
      const dueDay = d.dueDate || 1;
      let daysUntil = dueDay - currentDay;
      if (daysUntil < 0) daysUntil += daysInMonth;
      bills.push({
        name: d.name,
        amount: d.monthlyPayment,
        dueDay,
        daysUntil,
        isPast: dueDay < currentDay,
      });
    }

    return bills.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [obligations, debts, id, account]);

  // ── Low balance warning ──
  const balanceWarning = useMemo(() => {
    if (!account) return null;
    const balance = account.currentBalance ?? 0;
    const upcomingTotal = upcomingBills
      .filter(b => !b.isPast && b.daysUntil <= 14)
      .reduce((sum, b) => sum + b.amount, 0);

    if (upcomingTotal > 0 && balance < upcomingTotal) {
      const shortfall = upcomingTotal - balance;
      return {
        type: 'danger' as const,
        message: `⚠️ $${shortfall.toFixed(0)} short for upcoming bills in the next 14 days`,
        upcomingTotal,
        shortfall,
      };
    }
    if (upcomingTotal > 0 && balance < upcomingTotal * 1.2) {
      return {
        type: 'warning' as const,
        message: `💡 Balance is tight — $${upcomingTotal.toFixed(0)} in bills coming within 14 days`,
        upcomingTotal,
        shortfall: 0,
      };
    }
    return null;
  }, [account, upcomingBills]);

  // ── Filtered transactions ──
  const filteredTransactions = useMemo(() => {
    return accountTransactions.filter(t => t.date.startsWith(filterMonth));
  }, [accountTransactions, filterMonth]);

  // ── Monthly stats ──
  const monthlyStats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const transfers = filteredTransactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, transfers, net: income - expenses };
  }, [filteredTransactions]);

  // ── Budget breakdown ──
  const budgetBreakdown = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const groups: Record<BankTransactionGroup, { total: number; count: number; transactions: BankTransaction[] }> = {} as any;

    for (const t of expenses) {
      const meta = TRANSACTION_CATEGORY_META[t.category];
      const group = meta?.group || 'other';
      if (!groups[group]) groups[group] = { total: 0, count: 0, transactions: [] };
      groups[group].total += t.amount;
      groups[group].count += 1;
      groups[group].transactions.push(t);
    }

    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

    return Object.entries(groups)
      .map(([key, data]) => ({
        group: key as BankTransactionGroup,
        ...data,
        percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // ── Recurring detection ──
  const recurringCandidates = useMemo(() => detectRecurring(accountTransactions), [accountTransactions]);

  // ── Obligations cross-reference ──
  // Match transactions to existing obligations using fuzzy name/amount matching
  const obligationsAnalysis = useMemo(() => {
    const accountObligations = obligations.filter(
      o => o.bankAccountId === id || !o.bankAccountId // include unassigned too
    );

    // For each obligation, find matching transactions this month
    const tracked: Array<{
      obligation: typeof accountObligations[0];
      matchingTransactions: BankTransaction[];
      isPaidThisMonth: boolean;
    }> = [];

    const matchedTransactionIds = new Set<string>();

    for (const ob of accountObligations) {
      const obNameNorm = normalize(ob.name);
      const obPayeeNorm = normalize(ob.payee || '');
      const obAmount = ob.amount;

      const matches = filteredTransactions.filter(t => {
        if (t.type === 'income') return false;
        const descNorm = normalize(t.description);

        // ── Match strategies (any one is sufficient) ──

        // 1. Direct normalized substring match (name or payee in description)
        const directNameMatch =
          descNorm.includes(obNameNorm) ||
          obNameNorm.includes(descNorm.substring(0, 15)) ||
          (obPayeeNorm && descNorm.includes(obPayeeNorm)) ||
          (obPayeeNorm && obPayeeNorm.includes(descNorm.substring(0, 15)));

        // 2. Token overlap match (handles "apple.com bill" vs "APPLE.COM/BILL")
        const tokenMatch =
          hasTokenOverlap(t.description, ob.name) ||
          hasTokenOverlap(t.description, ob.payee || '');

        // 3. Amount matches (within 10% or exact cents)
        const amountClose = obAmount > 0 && Math.abs(t.amount - obAmount) / obAmount < 0.1;
        const amountExact = Math.abs(t.amount - obAmount) < 0.02; // within 2 cents

        // ── Matching rules ──
        // Strong: any name/payee signal + close amount
        if ((directNameMatch || tokenMatch) && (amountClose || amountExact)) return true;
        // Exact amount + at least token overlap on payee
        if (amountExact && tokenMatch) return true;
        // Direct name match with exact amount (no tolerance needed)
        if (directNameMatch && t.amount === obAmount) return true;

        return false;
      });

      matches.forEach(m => matchedTransactionIds.add(m.id));

      tracked.push({
        obligation: ob,
        matchingTransactions: matches,
        isPaidThisMonth: matches.length > 0,
      });
    }

    // Find expense transactions NOT matched to any obligation
    const unmatchedExpenses = filteredTransactions.filter(
      t => t.type === 'expense' && !matchedTransactionIds.has(t.id)
    );

    // Group unmatched by category for easier review
    const unmatchedByCategory: Record<string, { transactions: BankTransaction[]; total: number }> = {};
    for (const t of unmatchedExpenses) {
      const meta = TRANSACTION_CATEGORY_META[t.category];
      const groupKey = meta?.group || 'other';
      if (!unmatchedByCategory[groupKey]) unmatchedByCategory[groupKey] = { transactions: [], total: 0 };
      unmatchedByCategory[groupKey].transactions.push(t);
      unmatchedByCategory[groupKey].total += t.amount;
    }

    const totalTracked = tracked.reduce((s, t) =>
      s + (t.matchingTransactions.length > 0
        ? t.matchingTransactions.reduce((ss, m) => ss + m.amount, 0)
        : 0
      ), 0);
    const totalUnmatched = unmatchedExpenses.reduce((s, t) => s + t.amount, 0);
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    return {
      tracked,
      unmatchedExpenses,
      unmatchedByCategory,
      matchedTransactionIds,
      totalTracked,
      totalUnmatched,
      totalExpenses,
      paidCount: tracked.filter(t => t.isPaidThisMonth).length,
      totalObligations: tracked.length,
    };
  }, [obligations, filteredTransactions, id]);

  // ── Debts cross-reference ──
  const debtsAnalysis = useMemo(() => {
    const accountDebts = debts.filter(
      d => d.bankAccountId === id || !d.bankAccountId
    );

    const tracked: Array<{
      debt: typeof accountDebts[0];
      matchingTransactions: BankTransaction[];
      isPaidThisMonth: boolean;
    }> = [];

    const matchedTransactionIds = new Set<string>();

    for (const debt of accountDebts) {
      const debtNameNorm = normalize(debt.name);
      const debtPayeeNorm = normalize((debt as any).payee || '');
      const debtAmount = debt.monthlyPayment || 0;

      const matches = filteredTransactions.filter(t => {
        if (t.type === 'income') return false;
        const descNorm = normalize(t.description);

        // Name match (debt name or payee)
        const directNameMatch =
          descNorm.includes(debtNameNorm) ||
          debtNameNorm.includes(descNorm.substring(0, 15)) ||
          (debtPayeeNorm && descNorm.includes(debtPayeeNorm)) ||
          (debtPayeeNorm && debtPayeeNorm.includes(descNorm.substring(0, 15)));

        const tokenMatch =
          hasTokenOverlap(t.description, debt.name) ||
          hasTokenOverlap(t.description, (debt as any).payee || '');

        const amountClose = debtAmount > 0 && Math.abs(t.amount - debtAmount) / debtAmount < 0.15;
        const amountExact = Math.abs(t.amount - debtAmount) < 0.02;

        // Standard: name/payee signal + amount match
        if ((directNameMatch || tokenMatch) && (amountClose || amountExact)) return true;
        if (amountExact && tokenMatch) return true;
        if (directNameMatch && t.amount === debtAmount) return true;

        // Debt-specific: exact amount + same bank account + categorized as debt payment
        // (handles "Truck Loan" debt vs "Bridgecrest" transaction)
        if (amountExact && t.category === 'financial_debt_payment' && debt.bankAccountId === t.bankAccountId) return true;

        return false;
      });

      matches.forEach(m => matchedTransactionIds.add(m.id));

      tracked.push({
        debt,
        matchingTransactions: matches,
        isPaidThisMonth: debt.isPaidThisMonth || matches.length > 0,
      });
    }

    const totalTracked = tracked.reduce((s, t) =>
      s + (t.matchingTransactions.length > 0
        ? t.matchingTransactions.reduce((ss, m) => ss + m.amount, 0)
        : 0
      ), 0);

    return {
      tracked,
      matchedTransactionIds,
      totalTracked,
      paidCount: tracked.filter(t => t.isPaidThisMonth).length,
      totalDebts: tracked.length,
    };
  }, [debts, filteredTransactions, id]);

  // ── Combined matched IDs (obligations + debts) for untracked calculation ──
  const allMatchedIds = useMemo(() => {
    const combined = new Set(obligationsAnalysis.matchedTransactionIds);
    debtsAnalysis.matchedTransactionIds.forEach(id => combined.add(id));
    return combined;
  }, [obligationsAnalysis.matchedTransactionIds, debtsAnalysis.matchedTransactionIds]);

  // Override unmatched to exclude debt-matched transactions too
  const combinedUnmatchedExpenses = useMemo(() => {
    return filteredTransactions.filter(
      t => t.type === 'expense' && !allMatchedIds.has(t.id)
    );
  }, [filteredTransactions, allMatchedIds]);

  const combinedUnmatchedByCategory = useMemo(() => {
    const groups: Record<string, { transactions: BankTransaction[]; total: number }> = {};
    for (const t of combinedUnmatchedExpenses) {
      const meta = TRANSACTION_CATEGORY_META[t.category];
      const groupKey = meta?.group || 'other';
      if (!groups[groupKey]) groups[groupKey] = { transactions: [], total: 0 };
      groups[groupKey].transactions.push(t);
      groups[groupKey].total += t.amount;
    }
    return groups;
  }, [combinedUnmatchedExpenses]);

  // ── Month navigation ──
  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = filterMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = useMemo(() => {
    const [year, month] = filterMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [filterMonth]);

  // ── Form handlers ──
  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormAmount('');
    setFormCategory('other');
    setFormType('expense');
    setFormNotes('');
    setFormIsRecurring(false);
    setEditingTransaction(null);
    setShowAddModal(false);
  };

  const handleDescriptionChange = (text: string) => {
    setFormDescription(text);
    // Auto-categorize as user types
    if (text.length > 3) {
      const suggested = autoCategorize(text);
      if (suggested !== 'other') setFormCategory(suggested);
    }
  };

  const handleSaveTransaction = () => {
    if (!formDescription || !formAmount || !id) return;

    const amount = parseFloat(formAmount.replace(/,/g, '')) || 0;
    if (amount === 0) return;

    if (editingTransaction) {
      updateBankTransaction(editingTransaction.id, {
        date: formDate,
        description: formDescription,
        amount,
        category: formCategory,
        type: formType,
        notes: formNotes || undefined,
        isRecurring: formIsRecurring,
      });
    } else {
      const transaction: BankTransaction = {
        id: `bt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        bankAccountId: id,
        date: formDate,
        description: formDescription,
        amount,
        category: formCategory,
        type: formType,
        notes: formNotes || undefined,
        isRecurring: formIsRecurring,
        importedFrom: 'manual',
      };
      addBankTransaction(transaction);
    }

    resetForm();
  };

  const handleEditTransaction = (t: BankTransaction) => {
    setEditingTransaction(t);
    setFormDate(t.date.split('T')[0]);
    setFormDescription(t.description);
    setFormAmount(t.amount.toString());
    setFormCategory(t.category);
    setFormType(t.type);
    setFormNotes(t.notes || '');
    setFormIsRecurring(t.isRecurring || false);
    setShowAddModal(true);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    Alert.alert('Delete Transaction', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeBankTransaction(transactionId) },
    ]);
  };

  // ── CSV Import ──
  const handleParseCSV = () => {
    if (!csvText.trim() || !id) return;
    const result = parseCSVTransactions(csvText, id);
    setImportPreview(result);
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    importBankTransactions(importPreview.transactions);
    setCsvText('');
    setImportPreview(null);
    setShowImportModal(false);

    // Prompt to update balance after import
    if (Platform.OS === 'web') {
      const newBal = window.prompt(
        `Import complete! ${importPreview.summary}\n\nWhat's the current balance for this account? (Leave blank to skip)`,
        (account?.currentBalance ?? 0).toFixed(2)
      );
      if (newBal && !isNaN(parseFloat(newBal))) {
        updateBankAccount(id!, { currentBalance: parseFloat(newBal) });
      }
    } else {
      Alert.alert(
        'Import Complete',
        `${importPreview.summary}\n\nUpdate current balance?`,
        [
          { text: 'Skip', style: 'cancel' },
          {
            text: 'Update Balance',
            onPress: () => {
              setBalanceInput((account?.currentBalance ?? 0).toFixed(2));
              setShowBalanceEdit(true);
            },
          },
        ]
      );
    }
  };

  // ── Add as Obligation ──
  const handleAddAsObligation = (name: string, amount: number) => {
    addObligation({
      id: `obl_${Date.now()}`,
      name,
      payee: name,
      amount,
      category: 'other',
      isRecurring: true,
      bankAccountId: id,
    });
    Alert.alert('Added!', `"${name}" added to your Obligations at ${formatCurrency(amount)}/month`, [{ text: 'OK' }]);
  };

  const handleAddAsDebt = (name: string, amount: number) => {
    addDebt({
      id: `debt_${Date.now()}`,
      name,
      principal: 0, // User can update later
      monthlyPayment: amount,
      minimumPayment: amount,
      interestRate: 0,
      dueDate: 1,
      bankAccountId: id,
    });
    Alert.alert('Added!', `"${name}" added to your Debts at ${formatCurrency(amount)}/month`, [{ text: 'OK' }]);
  };

  // ── Guard ──
  if (!account) {
    return (
      <View style={s.container}>
        <View style={s.errorBox}>
          <Text style={s.errorText}>Account not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const grouped = groupByDate(filteredTransactions);

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>

        {/* ── Back + Account Header ──────────────────────────────── */}
        <TouchableOpacity onPress={() => router.back()} style={s.backNav}>
          <Text style={s.backNavText}>← Back</Text>
        </TouchableOpacity>

        <LinearGradient
          colors={['#1a2a50', '#121830', '#0c1020']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.accountHeader}
        >
          <View style={s.accountHeaderTop}>
            <View>
              <Text style={s.accountName}>{account.name}</Text>
              <Text style={s.accountInstitution}>{account.institution} · {account.type}</Text>
            </View>
            <TouchableOpacity style={s.balanceBox} onPress={() => {
              setBalanceInput((account.currentBalance ?? 0).toFixed(2));
              setShowBalanceEdit(true);
            }}>
              <Text style={s.balanceLabel}>Balance ✏️</Text>
              <Text style={s.balanceValue}>${(account.currentBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.transactionCount}>
            {accountTransactions.length} total transactions · {filteredTransactions.length} this month
          </Text>
        </LinearGradient>

        {/* ── Balance Warning ────────────────────────────────────── */}
        {balanceWarning && (
          <View style={[s.warningCard, balanceWarning.type === 'danger' ? s.warningDanger : s.warningCaution]}>
            <Text style={s.warningText}>{balanceWarning.message}</Text>
            {balanceWarning.shortfall > 0 && (
              <Text style={s.warningDetail}>
                Transfer ${balanceWarning.shortfall.toFixed(0)}+ to avoid overdraft
              </Text>
            )}
            {upcomingBills.filter(b => !b.isPast && b.daysUntil <= 14).length > 0 && (
              <View style={s.warningBills}>
                {upcomingBills.filter(b => !b.isPast && b.daysUntil <= 14).map((bill, i) => (
                  <Text key={i} style={s.warningBillItem}>
                    • {bill.name}: ${bill.amount.toFixed(0)} — {bill.daysUntil === 0 ? 'today' : `in ${bill.daysUntil}d`}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Monthly Stats ──────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Income</Text>
            <Text style={[s.statValue, { color: '#4ade80' }]}>+{formatCurrency(monthlyStats.income)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Expenses</Text>
            <Text style={[s.statValue, { color: '#f87171' }]}>-{formatCurrency(monthlyStats.expenses)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Net</Text>
            <Text style={[s.statValue, { color: monthlyStats.net >= 0 ? '#4ade80' : '#f87171' }]}>
              {monthlyStats.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(monthlyStats.net))}
            </Text>
          </View>
        </View>

        {/* ── Month Navigator ────────────────────────────────────── */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={s.monthArrow}>
            <Text style={s.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={s.monthArrow}>
            <Text style={s.monthArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── View Mode Tabs ─────────────────────────────────────── */}
        <View style={s.viewTabs}>
          {(['transactions', 'budget', 'recurring'] as ViewMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[s.viewTab, viewMode === mode && s.viewTabActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[s.viewTabText, viewMode === mode && s.viewTabTextActive]}>
                {mode === 'transactions' ? '📋 Ledger' : mode === 'budget' ? '📊 Budget' : '🔁 Tracking'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Action Buttons ─────────────────────────────────────── */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={s.addBtnText}>+ Add Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.importBtn} onPress={() => setShowImportModal(true)}>
            <Text style={s.importBtnText}>📄 Import CSV</Text>
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════════════════════════════════
            TRANSACTIONS VIEW
            ════════════════════════════════════════════════════════════ */}
        {viewMode === 'transactions' && (
          <View style={s.section}>
            {Object.keys(grouped).length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>📭</Text>
                <Text style={s.emptyText}>No transactions for {monthLabel}</Text>
                <Text style={s.emptySubtext}>Add manually or import a CSV statement</Text>
              </View>
            ) : (
              Object.entries(grouped).map(([dateKey, txns]) => {
                const dayTotal = txns.reduce((s, t) =>
                  s + (t.type === 'income' ? t.amount : -t.amount), 0
                );
                return (
                  <View key={dateKey} style={s.dateGroup}>
                    <View style={s.dateHeader}>
                      <Text style={s.dateLabel}>{formatDate(dateKey)}</Text>
                      <Text style={[s.dateTotalLabel, { color: dayTotal >= 0 ? '#4ade80' : '#f87171' }]}>
                        {dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}
                      </Text>
                    </View>
                    {txns.map(t => {
                      const catMeta = TRANSACTION_CATEGORY_META[t.category] || { emoji: '📋', label: 'Other' };
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={s.transactionCard}
                          onPress={() => handleEditTransaction(t)}
                          onLongPress={() => handleDeleteTransaction(t.id)}
                        >
                          <View style={s.transactionRow}>
                            <View style={s.transactionLeft}>
                              <Text style={s.transactionEmoji}>{catMeta.emoji}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={s.transactionDesc} numberOfLines={1}>{t.description}</Text>
                                <Text style={s.transactionCategory}>{catMeta.label}</Text>
                                {t.isRecurring && <Text style={s.recurringBadge}>🔁 Recurring</Text>}
                                {t.notes && <Text style={s.transactionNotes}>{t.notes}</Text>}
                              </View>
                            </View>
                            <View style={s.transactionRight}>
                              <Text style={[
                                s.transactionAmount,
                                { color: t.type === 'income' ? '#4ade80' : t.type === 'transfer' ? '#fbbf24' : '#f87171' }
                              ]}>
                                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                              </Text>
                              <Text style={s.transactionSource}>
                                {t.importedFrom === 'csv' ? '📄' : '✏️'}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════
            BUDGET BREAKDOWN VIEW
            ════════════════════════════════════════════════════════════ */}
        {viewMode === 'budget' && (
          <View style={s.section}>
            {budgetBreakdown.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>📊</Text>
                <Text style={s.emptyText}>No expenses to break down</Text>
                <Text style={s.emptySubtext}>Add transactions to see your budget categories</Text>
              </View>
            ) : (
              budgetBreakdown.map(item => {
                const groupMeta = TRANSACTION_GROUP_META[item.group];
                return (
                  <View key={item.group} style={s.budgetCard}>
                    <View style={s.budgetHeader}>
                      <View style={s.budgetHeaderLeft}>
                        <Text style={s.budgetEmoji}>{groupMeta.emoji}</Text>
                        <View>
                          <Text style={s.budgetGroupName}>{groupMeta.label}</Text>
                          <Text style={s.budgetCount}>{item.count} transactions</Text>
                        </View>
                      </View>
                      <View style={s.budgetHeaderRight}>
                        <Text style={[s.budgetTotal, { color: groupMeta.color }]}>
                          {formatCurrency(item.total)}
                        </Text>
                        <Text style={s.budgetPercentage}>{item.percentage.toFixed(1)}%</Text>
                      </View>
                    </View>
                    {/* Bar */}
                    <View style={s.budgetBarBg}>
                      <View style={[s.budgetBarFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: groupMeta.color }]} />
                    </View>
                    {/* Top items in category */}
                    {item.transactions.slice(0, 3).map(t => (
                      <View key={t.id} style={s.budgetItem}>
                        <Text style={s.budgetItemDesc} numberOfLines={1}>{t.description}</Text>
                        <Text style={s.budgetItemAmount}>{formatCurrency(t.amount)}</Text>
                      </View>
                    ))}
                    {item.transactions.length > 3 && (
                      <Text style={s.budgetMoreText}>+{item.transactions.length - 3} more</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════
            OBLIGATIONS CROSS-REFERENCE VIEW
            ════════════════════════════════════════════════════════════ */}
        {viewMode === 'recurring' && (
          <View style={s.section}>

            {/* ── Summary banner ── */}
            <View style={s.obligationSummaryBanner}>
              <View style={s.obligationSummaryRow}>
                <View style={s.obligationSummaryStat}>
                  <Text style={s.obligationSummaryValue}>{formatCurrency(obligationsAnalysis.totalTracked + debtsAnalysis.totalTracked)}</Text>
                  <Text style={[s.obligationSummaryLabel, { color: '#4ade80' }]}>Tracked</Text>
                </View>
                <View style={s.obligationSummaryStat}>
                  <Text style={[s.obligationSummaryValue, { color: '#fbbf24' }]}>{formatCurrency(combinedUnmatchedExpenses.reduce((s, t) => s + t.amount, 0))}</Text>
                  <Text style={[s.obligationSummaryLabel, { color: '#fbbf24' }]}>Untracked</Text>
                </View>
                <View style={s.obligationSummaryStat}>
                  <Text style={s.obligationSummaryValue}>{formatCurrency(obligationsAnalysis.totalExpenses)}</Text>
                  <Text style={s.obligationSummaryLabel}>Total Out</Text>
                </View>
              </View>
              <View style={s.obligationProgressBarBg}>
                <View style={[s.obligationProgressBarFill, {
                  width: obligationsAnalysis.totalExpenses > 0
                    ? `${((obligationsAnalysis.totalTracked + debtsAnalysis.totalTracked) / obligationsAnalysis.totalExpenses) * 100}%`
                    : '0%'
                }]} />
              </View>
              <Text style={s.obligationProgressLabel}>
                {obligationsAnalysis.paidCount + debtsAnalysis.paidCount} of {obligationsAnalysis.totalObligations + debtsAnalysis.totalDebts} obligations & debts matched
              </Text>
            </View>

            {/* ── ✅ TRACKED — Obligations with matching transactions ── */}
            <Text style={s.subsectionTitle}>✅ Tracked Obligations</Text>
            <Text style={s.subsectionInfo}>
              These match your existing obligations list.
            </Text>
            {obligationsAnalysis.tracked.length === 0 ? (
              <Text style={s.noDataText}>No obligations assigned to this account</Text>
            ) : (
              obligationsAnalysis.tracked.map((item) => (
                <View
                  key={item.obligation.id}
                  style={[s.obligationMatchCard, item.isPaidThisMonth ? s.obligationMatchCardPaid : s.obligationMatchCardUnpaid]}
                >
                  <View style={s.obligationMatchHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.obligationMatchName}>{item.obligation.name}</Text>
                      <Text style={s.obligationMatchPayee}>
                        Paid to: {item.obligation.payee} · {formatCurrency(item.obligation.amount)}/mo
                      </Text>
                    </View>
                    <View style={[s.statusBadge, item.isPaidThisMonth ? s.statusBadgePaid : s.statusBadgeUnpaid]}>
                      <Text style={[s.statusBadgeText, item.isPaidThisMonth ? s.statusBadgeTextPaid : s.statusBadgeTextUnpaid]}>
                        {item.isPaidThisMonth ? '✓ Paid' : 'Not Found'}
                      </Text>
                    </View>
                  </View>
                  {item.matchingTransactions.length > 0 && (
                    <View style={s.obligationMatchDetails}>
                      {item.matchingTransactions.map(t => (
                        <View key={t.id} style={s.obligationMatchTransaction}>
                          <Text style={s.obligationMatchTxDesc} numberOfLines={1}>
                            {TRANSACTION_CATEGORY_META[t.category]?.emoji} {t.description}
                          </Text>
                          <Text style={s.obligationMatchTxAmount}>{formatCurrency(t.amount)} on {formatDate(t.date)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}

            {/* ── ⚠️ UNTRACKED — Expenses NOT in obligations ── */}
            <Text style={[s.subsectionTitle, { marginTop: 24 }]}>💳 Tracked Debt Payments</Text>
            <Text style={s.subsectionInfo}>
              These match your debts list.
            </Text>
            {debtsAnalysis.tracked.length === 0 ? (
              <Text style={s.noDataText}>No debts assigned to this account</Text>
            ) : (
              debtsAnalysis.tracked.map((item) => (
                <View
                  key={item.debt.id}
                  style={[s.obligationMatchCard, item.isPaidThisMonth ? s.obligationMatchCardPaid : s.obligationMatchCardUnpaid,
                    { borderLeftColor: item.isPaidThisMonth ? '#4ade80' : '#f87171' }
                  ]}
                >
                  <View style={s.obligationMatchHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.obligationMatchName}>{item.debt.name}</Text>
                      <Text style={s.obligationMatchPayee}>
                        Balance: {formatCurrency(item.debt.principal)} · {formatCurrency(item.debt.monthlyPayment)}/mo
                        {item.debt.interestRate > 0 ? ` · ${(item.debt.interestRate * 100).toFixed(1)}%` : ''}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, item.isPaidThisMonth ? s.statusBadgePaid : s.statusBadgeUnpaid]}>
                      <Text style={[s.statusBadgeText, item.isPaidThisMonth ? s.statusBadgeTextPaid : s.statusBadgeTextUnpaid]}>
                        {item.isPaidThisMonth ? '✓ Paid' : 'Not Found'}
                      </Text>
                    </View>
                  </View>
                  {item.matchingTransactions.length > 0 && (
                    <View style={s.obligationMatchDetails}>
                      {item.matchingTransactions.map(t => (
                        <View key={t.id} style={s.obligationMatchTransaction}>
                          <Text style={s.obligationMatchTxDesc} numberOfLines={1}>
                            {TRANSACTION_CATEGORY_META[t.category]?.emoji} {t.description}
                          </Text>
                          <Text style={s.obligationMatchTxAmount}>{formatCurrency(t.amount)} on {formatDate(t.date)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}

            {/* ── ⚠️ UNTRACKED — Expenses NOT in obligations or debts ── */}
            <Text style={[s.subsectionTitle, { marginTop: 24 }]}>⚠️ Untracked Expenses</Text>
            <Text style={s.subsectionInfo}>
              These expenses don't match any obligation or debt payment.
            </Text>
            {combinedUnmatchedExpenses.length === 0 ? (
              <View style={s.allTrackedBanner}>
                <Text style={s.allTrackedEmoji}>🎉</Text>
                <Text style={s.allTrackedText}>All expenses are tracked! Nice work.</Text>
              </View>
            ) : (
              <>
                {Object.entries(combinedUnmatchedByCategory)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([groupKey, data]) => {
                    const groupMeta = TRANSACTION_GROUP_META[groupKey as BankTransactionGroup];
                    return (
                      <View key={groupKey} style={s.untrackedGroup}>
                        <View style={s.untrackedGroupHeader}>
                          <Text style={s.untrackedGroupTitle}>
                            {groupMeta?.emoji} {groupMeta?.label || groupKey}
                          </Text>
                          <Text style={[s.untrackedGroupTotal, { color: groupMeta?.color || '#fbbf24' }]}>
                            {formatCurrency(data.total)}
                          </Text>
                        </View>
                        {data.transactions
                          .sort((a, b) => b.amount - a.amount)
                          .map(t => {
                            const catMeta = TRANSACTION_CATEGORY_META[t.category];
                            return (
                              <View key={t.id} style={s.untrackedItem}>
                                <View style={s.untrackedItemLeft}>
                                  <Text style={s.untrackedItemEmoji}>{catMeta?.emoji || '📋'}</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.untrackedItemDesc} numberOfLines={1}>{t.description}</Text>
                                    <Text style={s.untrackedItemDate}>{formatDate(t.date)} · {catMeta?.label}</Text>
                                  </View>
                                </View>
                                <View style={s.untrackedItemRight}>
                                  <Text style={s.untrackedItemAmount}>{formatCurrency(t.amount)}</Text>
                                  <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <TouchableOpacity
                                      style={s.addObligationBtnSmall}
                                      onPress={() => handleAddAsObligation(t.description, t.amount)}
                                    >
                                      <Text style={s.addObligationBtnSmallText}>+ Bill</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[s.addObligationBtnSmall, { backgroundColor: '#f87171' }]}
                                      onPress={() => handleAddAsDebt(t.description, t.amount)}
                                    >
                                      <Text style={s.addObligationBtnSmallText}>+ Debt</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                      </View>
                    );
                  })}
              </>
            )}

            {/* ── 🔁 RECURRING PATTERNS — Auto-detected ── */}
            {recurringCandidates.length > 0 && (
              <>
                <Text style={[s.subsectionTitle, { marginTop: 24 }]}>🔁 Detected Recurring Patterns</Text>
                <Text style={s.subsectionInfo}>
                  These appear monthly across all your transaction history.
                </Text>
                {recurringCandidates.map((rc, idx) => {
                  // Check if already in obligations or debts
                  const inObligations = obligations.some(o => {
                    const nameMatch = hasTokenOverlap(o.name, rc.name) ||
                                      hasTokenOverlap(o.payee || '', rc.name);
                    const amountMatch = Math.abs(o.amount - rc.averageAmount) < 1;
                    const normNameMatch =
                      normalize(o.name).includes(normalize(rc.name).substring(0, 12)) ||
                      normalize(rc.name).includes(normalize(o.name).substring(0, 12)) ||
                      normalize(o.payee || '').includes(normalize(rc.name).substring(0, 12));
                    return (nameMatch && amountMatch) || (normNameMatch && amountMatch) || (nameMatch);
                  });

                  const inDebts = debts.some(d => {
                    const nameMatch = hasTokenOverlap(d.name, rc.name);
                    const amountMatch = Math.abs(d.monthlyPayment - rc.averageAmount) < 1;
                    const normNameMatch =
                      normalize(d.name).includes(normalize(rc.name).substring(0, 12)) ||
                      normalize(rc.name).includes(normalize(d.name).substring(0, 12));
                    return (nameMatch && amountMatch) || (normNameMatch && amountMatch) || (nameMatch);
                  });

                  const alreadyTracked = inObligations || inDebts;

                  return (
                    <View key={idx} style={[s.recurringCard, alreadyTracked && s.recurringCardTracked]}>
                      <View style={s.recurringInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={s.recurringName} numberOfLines={1}>{rc.name}</Text>
                          {inObligations && (
                            <View style={s.trackedPill}>
                              <Text style={s.trackedPillText}>✓ Obligation</Text>
                            </View>
                          )}
                          {inDebts && (
                            <View style={[s.trackedPill, { backgroundColor: '#f8717120', borderColor: '#f8717140' }]}>
                              <Text style={[s.trackedPillText, { color: '#f87171' }]}>✓ Debt</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.recurringDetail}>
                          ~{formatCurrency(rc.averageAmount)}/month · {rc.matchingIds.length} occurrences
                        </Text>
                        <Text style={s.recurringLastDate}>Last: {formatDate(rc.lastDate)}</Text>
                      </View>
                      {!alreadyTracked && (
                        <View style={{ gap: 6 }}>
                          <TouchableOpacity
                            style={s.addObligationBtn}
                            onPress={() => handleAddAsObligation(rc.name, rc.averageAmount)}
                          >
                            <Text style={s.addObligationBtnText}>+ Bill</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.addObligationBtn, { backgroundColor: '#f87171' }]}
                            onPress={() => handleAddAsDebt(rc.name, rc.averageAmount)}
                          >
                            <Text style={s.addObligationBtnText}>+ Debt</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
          ADD / EDIT TRANSACTION MODAL
          ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={resetForm}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </Text>

              {/* Type selector */}
              <Text style={s.label}>Type</Text>
              <View style={s.typeRow}>
                {(['expense', 'income', 'transfer'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typePill, formType === t && s.typePillActive,
                      formType === t && {
                        borderColor: t === 'income' ? '#4ade80' : t === 'transfer' ? '#fbbf24' : '#f87171',
                        backgroundColor: t === 'income' ? '#1a2f1e' : t === 'transfer' ? '#2f2a1a' : '#2f1a1a',
                      }
                    ]}
                    onPress={() => setFormType(t)}
                  >
                    <Text style={[s.typePillText, formType === t && {
                      color: t === 'income' ? '#4ade80' : t === 'transfer' ? '#fbbf24' : '#f87171',
                    }]}>
                      {t === 'income' ? '💰 Income' : t === 'transfer' ? '↔️ Transfer' : '💸 Expense'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={s.label}>Date</Text>
              <TextInput
                style={s.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#555"
                value={formDate}
                onChangeText={setFormDate}
              />

              {/* Description */}
              <Text style={s.label}>Description</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g., Walmart, Netflix, Payroll"
                placeholderTextColor="#555"
                value={formDescription}
                onChangeText={handleDescriptionChange}
              />

              {/* Amount */}
              <Text style={s.label}>Amount</Text>
              <View style={s.amountRow}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput
                  style={s.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  value={formAmount}
                  onChangeText={setFormAmount}
                />
              </View>

              {/* Category */}
              <Text style={s.label}>Category</Text>
              <TouchableOpacity
                style={s.categorySelector}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={s.categorySelectorText}>
                  {TRANSACTION_CATEGORY_META[formCategory]?.emoji} {TRANSACTION_CATEGORY_META[formCategory]?.label || 'Other'}
                </Text>
                <Text style={s.categorySelectorArrow}>{showCategoryPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showCategoryPicker && (
                <View style={s.categoryGrid}>
                  {QUICK_CATEGORIES.map(cat => {
                    const meta = TRANSACTION_CATEGORY_META[cat];
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[s.categoryPill, formCategory === cat && s.categoryPillActive]}
                        onPress={() => { setFormCategory(cat); setShowCategoryPicker(false); }}
                      >
                        <Text style={s.categoryPillEmoji}>{meta?.emoji}</Text>
                        <Text style={[s.categoryPillText, formCategory === cat && s.categoryPillTextActive]}>
                          {meta?.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Recurring toggle */}
              <TouchableOpacity
                style={[s.recurringToggle, formIsRecurring && s.recurringToggleActive]}
                onPress={() => setFormIsRecurring(!formIsRecurring)}
              >
                <Text style={[s.recurringToggleText, formIsRecurring && s.recurringToggleTextActive]}>
                  🔁 This is a recurring expense
                </Text>
              </TouchableOpacity>

              {/* Notes */}
              <Text style={s.label}>Notes (optional)</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Optional notes..."
                placeholderTextColor="#555"
                value={formNotes}
                onChangeText={setFormNotes}
              />

              {/* Buttons */}
              <View style={s.modalButtons}>
                <TouchableOpacity style={s.cancelBtn} onPress={resetForm}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, (!formDescription || !formAmount) && s.saveBtnDisabled]}
                  onPress={handleSaveTransaction}
                  disabled={!formDescription || !formAmount}
                >
                  <Text style={s.saveBtnText}>
                    {editingTransaction ? 'Save' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          CSV IMPORT MODAL
          ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showImportModal} animationType="slide" transparent onRequestClose={() => { setShowImportModal(false); setImportPreview(null); setCsvText(''); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>📄 Import CSV</Text>
              <Text style={s.importHelp}>
                Paste your bank statement CSV below. Most banks let you export transactions as CSV from their website.
              </Text>
              <Text style={s.importHelp}>
                Supported formats: Chase, BoA, Wells Fargo, Capital One, and most standard CSVs with Date, Description, and Amount columns.
              </Text>

              <TextInput
                style={s.csvInput}
                placeholder={`Date,Description,Amount\n01/15/2026,Walmart,-45.67\n01/15/2026,Payroll Deposit,3500.00`}
                placeholderTextColor="#444"
                value={csvText}
                onChangeText={setCsvText}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />

              {!importPreview ? (
                <View style={s.modalButtons}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowImportModal(false); setCsvText(''); }}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.saveBtn, !csvText.trim() && s.saveBtnDisabled]}
                    onPress={handleParseCSV}
                    disabled={!csvText.trim()}
                  >
                    <Text style={s.saveBtnText}>Parse CSV</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={s.importPreviewBox}>
                    <Text style={s.importPreviewTitle}>Preview</Text>
                    <Text style={s.importPreviewSummary}>{importPreview.summary}</Text>
                    {importPreview.errors.length > 0 && (
                      <Text style={s.importPreviewErrors}>
                        ⚠️ {importPreview.errors.length} warnings: {importPreview.errors[0]}
                      </Text>
                    )}
                    {/* Show first 5 transactions */}
                    {importPreview.transactions.slice(0, 5).map((t, i) => (
                      <View key={i} style={s.previewRow}>
                        <Text style={s.previewDate}>{t.date}</Text>
                        <Text style={s.previewDesc} numberOfLines={1}>{t.description}</Text>
                        <Text style={[s.previewAmount, { color: t.type === 'income' ? '#4ade80' : '#f87171' }]}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </Text>
                      </View>
                    ))}
                    {importPreview.transactions.length > 5 && (
                      <Text style={s.importPreviewMore}>
                        ...and {importPreview.transactions.length - 5} more
                      </Text>
                    )}
                  </View>

                  <View style={s.modalButtons}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setImportPreview(null)}>
                      <Text style={s.cancelBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.saveBtn} onPress={handleConfirmImport}>
                      <Text style={s.saveBtnText}>Import {importPreview.transactions.length} Transactions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Balance Edit Modal ────────────────────────────────── */}
      <Modal visible={showBalanceEdit} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Update Balance</Text>
            <Text style={s.modalSubtitle}>Enter the current balance for {account?.name}</Text>
            <TextInput
              style={s.modalInput}
              value={balanceInput}
              onChangeText={setBalanceInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#555"
              autoFocus
              selectTextOnFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowBalanceEdit(false)}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={() => {
                  const val = parseFloat(balanceInput);
                  if (!isNaN(val)) {
                    updateBankAccount(id!, { currentBalance: val });
                    setShowBalanceEdit(false);
                  }
                }}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18' },
  scrollView: { flex: 1, padding: 20 },

  // Back nav
  backNav: { marginBottom: 12 },
  backNavText: { color: '#60a5fa', fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  // Account header
  accountHeader: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: '#60a5fa40' },
  accountHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  accountName: { fontSize: 22, color: '#fff', fontFamily: 'Inter_800ExtraBold', marginBottom: 4 },
  accountInstitution: { fontSize: 14, color: '#888', fontFamily: 'Inter_400Regular' },
  balanceBox: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  balanceValue: { fontSize: 24, color: '#4ade80', fontFamily: 'Inter_800ExtraBold' },
  transactionCount: { fontSize: 12, color: '#666', fontFamily: 'Inter_400Regular' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#0c1020', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1a2040' },
  statLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Month nav
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 16 },
  monthArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0c1020', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a2040' },
  monthArrowText: { color: '#60a5fa', fontSize: 22, fontFamily: 'Inter_700Bold' },
  monthLabel: { fontSize: 18, color: '#fff', fontFamily: 'Inter_700Bold' },

  // View tabs
  viewTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  viewTab: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#1a2040', backgroundColor: '#0c1020', alignItems: 'center' },
  viewTabActive: { borderColor: '#f4c430', backgroundColor: '#2a2610' },
  viewTabText: { fontSize: 12, color: '#666', fontFamily: 'Inter_600SemiBold' },
  viewTabTextActive: { color: '#f4c430' },

  // Action row
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  addBtn: { flex: 1, backgroundColor: '#4ade80', padding: 14, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#080c18', fontSize: 15, fontFamily: 'Inter_700Bold' },
  importBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#60a5fa50', alignItems: 'center', backgroundColor: '#0c1020' },
  importBtnText: { color: '#60a5fa', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  // Section
  section: { marginBottom: 20 },
  sectionInfo: { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 20, fontFamily: 'Inter_400Regular' },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#888', marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  emptySubtext: { fontSize: 13, color: '#555', textAlign: 'center', fontFamily: 'Inter_400Regular' },

  // Error
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#f87171', fontSize: 18, marginBottom: 16, fontFamily: 'Inter_600SemiBold' },
  backButton: { padding: 12, borderRadius: 8, backgroundColor: '#1a2040' },
  backButtonText: { color: '#60a5fa', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  // Date groups
  dateGroup: { marginBottom: 20 },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a2040', marginBottom: 8 },
  dateLabel: { fontSize: 14, color: '#a0a0a0', fontFamily: 'Inter_700Bold' },
  dateTotalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Transaction card
  transactionCard: { backgroundColor: '#0c1020', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1a2040' },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transactionLeft: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' },
  transactionEmoji: { fontSize: 22 },
  transactionDesc: { fontSize: 14, color: '#fff', fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  transactionCategory: { fontSize: 11, color: '#666', fontFamily: 'Inter_400Regular' },
  transactionNotes: { fontSize: 11, color: '#a0a0a0', fontStyle: 'italic', marginTop: 2, fontFamily: 'Inter_400Regular' },
  transactionRight: { alignItems: 'flex-end', marginLeft: 8 },
  transactionAmount: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  transactionSource: { fontSize: 12 },
  recurringBadge: { fontSize: 10, color: '#fbbf24', marginTop: 2, fontFamily: 'Inter_600SemiBold' },

  // Budget breakdown
  budgetCard: { backgroundColor: '#0c1020', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1a2040' },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  budgetHeaderLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  budgetHeaderRight: { alignItems: 'flex-end' },
  budgetEmoji: { fontSize: 24 },
  budgetGroupName: { fontSize: 16, color: '#fff', fontFamily: 'Inter_700Bold', marginBottom: 2 },
  budgetCount: { fontSize: 12, color: '#666', fontFamily: 'Inter_400Regular' },
  budgetTotal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  budgetPercentage: { fontSize: 12, color: '#888', fontFamily: 'Inter_600SemiBold' },
  budgetBarBg: { height: 6, backgroundColor: '#1a2040', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  budgetBarFill: { height: 6, borderRadius: 3 },
  budgetItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  budgetItemDesc: { fontSize: 13, color: '#a0a0a0', flex: 1, fontFamily: 'Inter_400Regular' },
  budgetItemAmount: { fontSize: 13, color: '#888', fontFamily: 'Inter_600SemiBold' },
  budgetMoreText: { fontSize: 12, color: '#555', marginTop: 4, fontFamily: 'Inter_400Regular' },

  // Recurring detection
  recurringCard: { flexDirection: 'row', backgroundColor: '#0c1020', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a2040', alignItems: 'center', justifyContent: 'space-between' },
  recurringCardTracked: { borderColor: '#4ade8030', backgroundColor: '#0c1020' },
  recurringInfo: { flex: 1, marginRight: 10 },
  recurringName: { fontSize: 15, color: '#fff', fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  recurringDetail: { fontSize: 13, color: '#888', fontFamily: 'Inter_400Regular', marginBottom: 2 },
  recurringLastDate: { fontSize: 11, color: '#555', fontFamily: 'Inter_400Regular' },
  addObligationBtn: { backgroundColor: '#f4c430', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addObligationBtnText: { color: '#080c18', fontSize: 13, fontFamily: 'Inter_700Bold' },
  trackedPill: { backgroundColor: '#4ade8020', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#4ade8040' },
  trackedPillText: { fontSize: 10, color: '#4ade80', fontFamily: 'Inter_600SemiBold' },

  // Obligation summary banner
  obligationSummaryBanner: { backgroundColor: '#0c1020', borderRadius: 14, padding: 18, marginBottom: 20, borderWidth: 1.5, borderColor: '#1a2040' },
  obligationSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  obligationSummaryStat: { alignItems: 'center', flex: 1 },
  obligationSummaryValue: { fontSize: 18, color: '#4ade80', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  obligationSummaryLabel: { fontSize: 11, color: '#888', fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  obligationProgressBarBg: { height: 8, backgroundColor: '#fbbf2430', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  obligationProgressBarFill: { height: 8, backgroundColor: '#4ade80', borderRadius: 4 },
  obligationProgressLabel: { fontSize: 12, color: '#888', fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Subsection headers
  subsectionTitle: { fontSize: 18, color: '#fff', fontFamily: 'Inter_700Bold', marginBottom: 6, marginTop: 4 },
  subsectionInfo: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  noDataText: { fontSize: 14, color: '#555', padding: 16, fontFamily: 'Inter_400Regular' },

  // Tracked obligation cards
  obligationMatchCard: { backgroundColor: '#0c1020', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5 },
  obligationMatchCardPaid: { borderColor: '#4ade8040', borderLeftWidth: 4, borderLeftColor: '#4ade80' },
  obligationMatchCardUnpaid: { borderColor: '#f8717140', borderLeftWidth: 4, borderLeftColor: '#f87171' },
  obligationMatchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  obligationMatchName: { fontSize: 16, color: '#fff', fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  obligationMatchPayee: { fontSize: 13, color: '#888', fontFamily: 'Inter_400Regular' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusBadgePaid: { backgroundColor: '#4ade8020' },
  statusBadgeUnpaid: { backgroundColor: '#f8717120' },
  statusBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusBadgeTextPaid: { color: '#4ade80' },
  statusBadgeTextUnpaid: { color: '#f87171' },
  obligationMatchDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a2040' },
  obligationMatchTransaction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  obligationMatchTxDesc: { fontSize: 13, color: '#a0a0a0', flex: 1, fontFamily: 'Inter_400Regular' },
  obligationMatchTxAmount: { fontSize: 13, color: '#4ade80', fontFamily: 'Inter_600SemiBold' },

  // All tracked banner
  allTrackedBanner: { backgroundColor: '#0c1020', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#4ade8030' },
  allTrackedEmoji: { fontSize: 32, marginBottom: 8 },
  allTrackedText: { fontSize: 15, color: '#4ade80', fontFamily: 'Inter_600SemiBold' },

  // Untracked expenses
  untrackedGroup: { marginBottom: 16 },
  untrackedGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a2040', marginBottom: 8 },
  untrackedGroupTitle: { fontSize: 15, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  untrackedGroupTotal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  untrackedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0c1020', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fbbf2420' },
  untrackedItemLeft: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' },
  untrackedItemEmoji: { fontSize: 18 },
  untrackedItemDesc: { fontSize: 14, color: '#fff', fontFamily: 'Inter_500Medium', marginBottom: 2 },
  untrackedItemDate: { fontSize: 11, color: '#666', fontFamily: 'Inter_400Regular' },
  untrackedItemRight: { alignItems: 'flex-end', marginLeft: 8 },
  untrackedItemAmount: { fontSize: 15, color: '#fbbf24', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  addObligationBtnSmall: { backgroundColor: '#f4c430', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addObligationBtnSmallText: { color: '#080c18', fontSize: 11, fontFamily: 'Inter_700Bold' },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#080c18', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' },
  modalTitle: { fontSize: 24, color: '#f4c430', marginBottom: 16, fontFamily: 'Inter_800ExtraBold' },
  label: { fontSize: 15, color: '#fff', marginBottom: 6, marginTop: 14, fontFamily: 'Inter_700Bold' },
  modalInput: { backgroundColor: '#0c1020', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1.5, borderColor: '#1a2040', fontFamily: 'Inter_400Regular' },

  // Type pills
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#1a2040', backgroundColor: '#0c1020', alignItems: 'center' },
  typePillActive: {},
  typePillText: { fontSize: 13, color: '#666', fontFamily: 'Inter_600SemiBold' },

  // Amount row
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c1020', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#1a2040' },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 8, fontFamily: 'Inter_700Bold' },
  amountInput: { flex: 1, fontSize: 22, color: '#fff', paddingVertical: 14, fontFamily: 'Inter_600SemiBold' },

  // Category selector
  categorySelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0c1020', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#1a2040' },
  categorySelectorText: { fontSize: 15, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  categorySelectorArrow: { fontSize: 14, color: '#666' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, maxHeight: 200 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#1a2040', backgroundColor: '#0c1020' },
  categoryPillActive: { borderColor: '#f4c430', backgroundColor: '#2a2610' },
  categoryPillEmoji: { fontSize: 14 },
  categoryPillText: { fontSize: 11, color: '#666', fontFamily: 'Inter_500Medium' },
  categoryPillTextActive: { color: '#f4c430', fontFamily: 'Inter_700Bold' },

  // Recurring toggle
  recurringToggle: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#1a2040', backgroundColor: '#0c1020', marginTop: 14 },
  recurringToggleActive: { borderColor: '#fbbf24', backgroundColor: '#2f2a1a' },
  recurringToggleText: { fontSize: 14, color: '#666', fontFamily: 'Inter_600SemiBold' },
  recurringToggleTextActive: { color: '#fbbf24' },

  // Buttons
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#1a2040', alignItems: 'center' },
  cancelBtnText: { color: '#a0a0a0', fontSize: 16, fontFamily: 'Inter_500Medium' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#080c18', fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Import
  importHelp: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 10, fontFamily: 'Inter_400Regular' },
  csvInput: { backgroundColor: '#0c1020', borderRadius: 12, padding: 14, fontSize: 13, color: '#fff', borderWidth: 1.5, borderColor: '#1a2040', minHeight: 160, fontFamily: 'Inter_400Regular' },
  importPreviewBox: { backgroundColor: '#0c1020', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1.5, borderColor: '#4ade8040' },
  importPreviewTitle: { fontSize: 16, color: '#4ade80', marginBottom: 8, fontFamily: 'Inter_700Bold' },
  importPreviewSummary: { fontSize: 14, color: '#a0a0a0', marginBottom: 10, fontFamily: 'Inter_400Regular' },
  importPreviewErrors: { fontSize: 12, color: '#fbbf24', marginBottom: 10, fontFamily: 'Inter_400Regular' },
  importPreviewMore: { fontSize: 12, color: '#666', marginTop: 6, fontFamily: 'Inter_400Regular' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  previewDate: { fontSize: 12, color: '#666', width: 80, fontFamily: 'Inter_400Regular' },
  previewDesc: { fontSize: 13, color: '#fff', flex: 1, fontFamily: 'Inter_400Regular' },
  previewAmount: { fontSize: 13, fontFamily: 'Inter_600SemiBold', minWidth: 70, textAlign: 'right' },

  // Balance warning
  warningCard: { borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5 },
  warningDanger: { backgroundColor: '#3a0e0e', borderColor: '#ff6b6b60' },
  warningCaution: { backgroundColor: '#3a2a0e', borderColor: '#ffa04060' },
  warningText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#ffb060', marginBottom: 6 },
  warningDetail: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#ff8a8a', marginBottom: 8 },
  warningBills: { marginTop: 4 },
  warningBillItem: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#c0a080', lineHeight: 20 },

  // Balance edit modal
  modalSubtitle: { fontSize: 14, color: '#888', fontFamily: 'Inter_400Regular', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
