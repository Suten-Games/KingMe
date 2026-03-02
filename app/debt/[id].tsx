// app/debt/[id].tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Debt / Credit Card Detail — Transaction ledger with CSV import & obligation tracking
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
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '@/types/bankTransactionTypes';
import { parseCSVTransactions, detectRecurring, autoCategorize } from '../../src/utils/csvBankImport';
import { T } from '../../src/theme';

// ─── View modes ────────────────────────────────────────────────────────────────
type ViewMode = 'transactions' | 'budget' | 'tracking';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatCurrency(amt: number): string {
  return `$${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function normalize(str: string): string {
  return str.toLowerCase().replace(/[\/\.\,\-\_\+\*\#\@\!\?\'\"\:\;\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokenize(str: string): string[] {
  return normalize(str).split(' ').filter(w => w.length >= 3);
}
function hasTokenOverlap(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)));
}
function groupByDate(transactions: BankTransaction[]): Record<string, BankTransaction[]> {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groups: Record<string, BankTransaction[]> = {};
  sorted.forEach(t => { const key = t.date.split('T')[0]; if (!groups[key]) groups[key] = []; groups[key].push(t); });
  return groups;
}
function monthsToPayoff(principal: number, payment: number, rate: number): string {
  if (payment <= 0 || principal <= 0) return '∞';
  if (rate <= 0) { const m = Math.ceil(principal / payment); return m >= 12 ? `${(m / 12).toFixed(1)}y` : `${m}mo`; }
  const mr = rate / 12;
  if (payment <= principal * mr) return '∞';
  const m = Math.ceil(-Math.log(1 - (mr * principal / payment)) / Math.log(1 + mr));
  return m >= 12 ? `${(m / 12).toFixed(1)}y` : `${m}mo`;
}

const ALL_CATEGORIES: BankTransactionCategory[] = CATEGORY_OPTIONS.flatMap(g => g.categories.map(c => c.value));

// ═══════════════════════════════════════════════════════════════════════════════
export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ── Store ──
  const debts = useStore(s => s.debts);
  const obligations = useStore(s => s.obligations);
  const bankTransactions = useStore(s => s.bankTransactions || []);
  const addBankTransaction = useStore(s => s.addBankTransaction);
  const removeBankTransaction = useStore(s => s.removeBankTransaction);
  const updateBankTransaction = useStore(s => s.updateBankTransaction);
  const importBankTransactions = useStore(s => s.importBankTransactions);
  const addObligation = useStore(s => s.addObligation);

  const debt = debts.find(d => d.id === id);

  // Transactions linked to this debt (using bankAccountId field)
  const debtTransactions = useMemo(
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

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<BankTransactionCategory>('other');
  const [formType, setFormType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [formNotes, setFormNotes] = useState('');

  // Import state
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<{ transactions: BankTransaction[]; summary: string; errors: string[] } | null>(null);

  // ── Filtered transactions ──
  const filteredTransactions = useMemo(
    () => debtTransactions.filter(t => t.date.startsWith(filterMonth)),
    [debtTransactions, filterMonth]
  );

  // ── Monthly stats ──
  const monthlyStats = useMemo(() => {
    const charges = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const payments = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const credits = filteredTransactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
    return { charges, payments, credits, net: charges - payments };
  }, [filteredTransactions]);

  // ── Budget breakdown ──
  const budgetBreakdown = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const groups: Record<BankTransactionGroup, { total: number; count: number; transactions: BankTransaction[] }> = {} as any;
    for (const t of expenses) {
      const meta = TRANSACTION_CATEGORY_META[t.category];
      const group = meta?.group || 'other';
      if (!groups[group]) groups[group] = { total: 0, count: 0, transactions: [] };
      groups[group].total += t.amount; groups[group].count++; groups[group].transactions.push(t);
    }
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    return Object.entries(groups)
      .map(([key, data]) => ({ group: key as BankTransactionGroup, ...data, percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // ── Recurring detection ──
  const recurringCandidates = useMemo(() => detectRecurring(debtTransactions), [debtTransactions]);

  // ── Obligations cross-reference ──
  const obligationsAnalysis = useMemo(() => {
    const tracked: Array<{ obligation: typeof obligations[0]; matchingTransactions: BankTransaction[]; isPaidThisMonth: boolean }> = [];
    const matchedIds = new Set<string>();

    for (const ob of obligations) {
      const obNameNorm = normalize(ob.name);
      const obPayeeNorm = normalize(ob.payee || '');
      const obAmount = ob.amount;
      const matches = filteredTransactions.filter(t => {
        if (t.type === 'income') return false;
        const descNorm = normalize(t.description);
        const directMatch = descNorm.includes(obNameNorm) || obNameNorm.includes(descNorm.substring(0, 15)) ||
          (obPayeeNorm && descNorm.includes(obPayeeNorm)) || (obPayeeNorm && obPayeeNorm.includes(descNorm.substring(0, 15)));
        const tokenMatch = hasTokenOverlap(t.description, ob.name) || hasTokenOverlap(t.description, ob.payee || '');
        const amountClose = obAmount > 0 && Math.abs(t.amount - obAmount) / obAmount < 0.1;
        const amountExact = Math.abs(t.amount - obAmount) < 0.02;
        if ((directMatch || tokenMatch) && (amountClose || amountExact)) return true;
        if (amountExact && tokenMatch) return true;
        return false;
      });
      matches.forEach(m => matchedIds.add(m.id));
      tracked.push({ obligation: ob, matchingTransactions: matches, isPaidThisMonth: matches.length > 0 });
    }

    const unmatchedExpenses = filteredTransactions.filter(t => t.type === 'expense' && !matchedIds.has(t.id));
    const unmatchedByCategory: Record<string, { transactions: BankTransaction[]; total: number }> = {};
    for (const t of unmatchedExpenses) {
      const groupKey = TRANSACTION_CATEGORY_META[t.category]?.group || 'other';
      if (!unmatchedByCategory[groupKey]) unmatchedByCategory[groupKey] = { transactions: [], total: 0 };
      unmatchedByCategory[groupKey].transactions.push(t); unmatchedByCategory[groupKey].total += t.amount;
    }

    const totalTracked = tracked.reduce((s, t) => s + (t.matchingTransactions.length > 0 ? t.matchingTransactions.reduce((ss, m) => ss + m.amount, 0) : 0), 0);
    const totalUnmatched = unmatchedExpenses.reduce((s, t) => s + t.amount, 0);
    const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return { tracked, unmatchedExpenses, unmatchedByCategory, matchedIds, totalTracked, totalUnmatched, totalExpenses,
      paidCount: tracked.filter(t => t.isPaidThisMonth).length, totalObligations: tracked.length };
  }, [obligations, filteredTransactions]);

  // ── Month navigation ──
  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const monthLabel = useMemo(() => {
    const [y, m] = filterMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [filterMonth]);

  // ── Form handlers ──
  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0]); setFormDescription(''); setFormAmount('');
    setFormCategory('other'); setFormType('expense'); setFormNotes('');
    setEditingTransaction(null); setShowAddModal(false);
  };
  const handleDescriptionChange = (text: string) => {
    setFormDescription(text);
    if (text.length > 3) { const s = autoCategorize(text); if (s !== 'other') setFormCategory(s); }
  };
  const handleSaveTransaction = () => {
    if (!formDescription || !formAmount || !id) return;
    const amount = parseFloat(formAmount.replace(/,/g, '')) || 0;
    if (amount === 0) return;
    if (editingTransaction) {
      updateBankTransaction(editingTransaction.id, { date: formDate, description: formDescription, amount, category: formCategory, type: formType, notes: formNotes || undefined });
    } else {
      addBankTransaction({ id: `cc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, bankAccountId: id, date: formDate,
        description: formDescription, amount, category: formCategory, type: formType, isRecurring: false, importedFrom: 'manual' });
    }
    resetForm();
  };
  const handleDeleteTransaction = (txId: string) => {
    Alert.alert('Delete Transaction', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeBankTransaction(txId) },
    ]);
  };
  const handleParseCSV = () => {
    if (!csvText.trim() || !id) return;
    const result = parseCSVTransactions(csvText, id);
    setImportPreview(result);
  };
  const handleImport = () => {
    if (!importPreview) return;
    importBankTransactions(importPreview.transactions);
    Alert.alert('Imported!', `${importPreview.transactions.length} transactions imported.`);
    setCsvText(''); setImportPreview(null); setShowImportModal(false);
  };
  const handleAddAsObligation = (name: string, amount: number) => {
    addObligation({ id: `obl_${Date.now()}`, name, payee: name, amount, category: 'other', isRecurring: true });
    Alert.alert('Added!', `"${name}" added to Obligations at ${formatCurrency(amount)}/month`);
  };

  // ── Guard ──
  if (!debt) {
    return (
      <View style={s.container}><View style={s.centered}>
        <Text style={s.errorText}>Debt not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backLink}>← Back</Text></TouchableOpacity>
      </View></View>
    );
  }

  const dateGroups = groupByDate(filteredTransactions);

  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>

        {/* ── Back button ── */}
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Text style={s.backLink}>← Back</Text>
        </TouchableOpacity>

        {/* ── Debt Header ── */}
        <LinearGradient colors={T.gradients.red} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.debtHeader, { borderColor: T.redBright + '60' }]}>
          <Text style={s.debtName}>{debt.name}</Text>
          {(debt as any).payee && <Text style={s.debtPayee}>Paid to: {(debt as any).payee}</Text>}
          <View style={s.debtStatsRow}>
            <View style={s.debtStat}>
              <Text style={s.debtStatLabel}>Balance</Text>
              <Text style={s.debtStatValue}>{formatCurrency(debt.principal)}</Text>
            </View>
            <View style={s.debtStat}>
              <Text style={s.debtStatLabel}>Payment</Text>
              <Text style={[s.debtStatValue, { color: T.redBright }]}>{formatCurrency(debt.monthlyPayment)}/mo</Text>
            </View>
            <View style={s.debtStat}>
              <Text style={s.debtStatLabel}>Rate</Text>
              <Text style={s.debtStatValue}>{(debt.interestRate * 100).toFixed(1)}%</Text>
            </View>
            <View style={s.debtStat}>
              <Text style={s.debtStatLabel}>Payoff</Text>
              <Text style={s.debtStatValue}>{monthsToPayoff(debt.principal, debt.monthlyPayment, debt.interestRate)}</Text>
            </View>
          </View>
          <Text style={s.txCount}>
            {debtTransactions.length} total transactions · {filteredTransactions.length} this month
          </Text>
        </LinearGradient>

        {/* ── Monthly Stats ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>CHARGES</Text>
            <Text style={[s.statValue, { color: T.redBright }]}>-{formatCurrency(monthlyStats.charges)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>PAYMENTS</Text>
            <Text style={[s.statValue, { color: T.green }]}>+{formatCurrency(monthlyStats.payments)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>NET</Text>
            <Text style={[s.statValue, { color: monthlyStats.net > 0 ? T.redBright : T.green }]}>
              {monthlyStats.net > 0 ? '-' : '+'}{formatCurrency(monthlyStats.net)}
            </Text>
          </View>
        </View>

        {/* ── Month navigation ── */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)}><Text style={s.monthArrow}>‹</Text></TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)}><Text style={s.monthArrow}>›</Text></TouchableOpacity>
        </View>

        {/* ── View mode tabs ── */}
        <View style={s.viewTabs}>
          {(['transactions', 'budget', 'tracking'] as ViewMode[]).map(mode => (
            <TouchableOpacity key={mode} style={[s.viewTab, viewMode === mode && s.viewTabActive]} onPress={() => setViewMode(mode)}>
              <Text style={[s.viewTabText, viewMode === mode && s.viewTabTextActive]}>
                {mode === 'transactions' ? '📋 Charges' : mode === 'budget' ? '📊 Breakdown' : '🔁 Tracking'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowAddModal(true)}>
            <Text style={s.actionBtnText}>+ Add Charge</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnImport]} onPress={() => setShowImportModal(true)}>
            <Text style={s.actionBtnText}>📄 Import CSV</Text>
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════════════════════════════════
            TRANSACTIONS VIEW
            ════════════════════════════════════════════════════════════ */}
        {viewMode === 'transactions' && (
          <View style={s.section}>
            {Object.keys(dateGroups).length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>💳</Text>
                <Text style={s.emptyText}>No transactions for {monthLabel}</Text>
                <Text style={s.emptySubtext}>Import your credit card statement CSV</Text>
              </View>
            ) : (
              Object.entries(dateGroups).map(([date, txns]) => {
                const dayTotal = txns.reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0);
                return (
                  <View key={date} style={s.dateGroup}>
                    <View style={s.dateHeader}>
                      <Text style={s.dateLabel}>{formatDate(date)}</Text>
                      <Text style={[s.dateTotal, { color: dayTotal > 0 ? T.redBright : T.green }]}>
                        {dayTotal > 0 ? '-' : '+'}{formatCurrency(dayTotal)}
                      </Text>
                    </View>
                    {txns.map(t => {
                      const catMeta = TRANSACTION_CATEGORY_META[t.category];
                      return (
                        <TouchableOpacity key={t.id} style={s.txRow}
                          onPress={() => { setEditingTransaction(t); setFormDate(t.date); setFormDescription(t.description);
                            setFormAmount(t.amount.toString()); setFormCategory(t.category); setFormType(t.type);
                            setFormNotes(t.notes || ''); setShowAddModal(true); }}
                          onLongPress={() => handleDeleteTransaction(t.id)}>
                          <Text style={s.txEmoji}>{catMeta?.emoji || '💳'}</Text>
                          <View style={s.txInfo}>
                            <Text style={s.txDesc} numberOfLines={1}>{t.description}</Text>
                            <Text style={s.txCategory}>{catMeta?.label || t.category}</Text>
                          </View>
                          <Text style={[s.txAmount, { color: t.type === 'income' ? T.green : T.redBright }]}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </Text>
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
                <Text style={s.emptyText}>No charges to break down</Text>
              </View>
            ) : (
              budgetBreakdown.map(({ group, total, count, transactions, percentage }) => {
                const groupMeta = TRANSACTION_GROUP_META[group];
                return (
                  <View key={group} style={s.budgetGroup}>
                    <View style={s.budgetGroupHeader}>
                      <Text style={s.budgetGroupTitle}>{groupMeta?.emoji} {groupMeta?.label || group}</Text>
                      <Text style={[s.budgetGroupTotal, { color: groupMeta?.color || T.redBright }]}>{formatCurrency(total)}</Text>
                    </View>
                    <View style={s.budgetBarBg}>
                      <View style={[s.budgetBarFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: groupMeta?.color || T.redBright }]} />
                    </View>
                    <Text style={s.budgetGroupPct}>{percentage.toFixed(1)}% · {count} charges</Text>
                    {transactions.slice(0, 3).map(t => (
                      <View key={t.id} style={s.budgetTx}>
                        <Text style={s.budgetTxDesc} numberOfLines={1}>{TRANSACTION_CATEGORY_META[t.category]?.emoji} {t.description}</Text>
                        <Text style={s.budgetTxAmt}>{formatCurrency(t.amount)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════
            TRACKING VIEW — Obligations cross-reference
            ════════════════════════════════════════════════════════════ */}
        {viewMode === 'tracking' && (
          <View style={s.section}>
            {/* Summary banner */}
            <View style={s.trackBanner}>
              <View style={s.trackRow}>
                <View style={s.trackStat}>
                  <Text style={[s.trackValue, { color: T.green }]}>{formatCurrency(obligationsAnalysis.totalTracked)}</Text>
                  <Text style={[s.trackLabel, { color: T.green }]}>Tracked</Text>
                </View>
                <View style={s.trackStat}>
                  <Text style={[s.trackValue, { color: '#fbbf24' }]}>{formatCurrency(obligationsAnalysis.totalUnmatched)}</Text>
                  <Text style={[s.trackLabel, { color: '#fbbf24' }]}>Untracked</Text>
                </View>
                <View style={s.trackStat}>
                  <Text style={s.trackValue}>{formatCurrency(obligationsAnalysis.totalExpenses)}</Text>
                  <Text style={s.trackLabel}>Total Charged</Text>
                </View>
              </View>
              <View style={s.trackBarBg}>
                <View style={[s.trackBarFill, {
                  width: obligationsAnalysis.totalExpenses > 0 ? `${(obligationsAnalysis.totalTracked / obligationsAnalysis.totalExpenses) * 100}%` : '0%'
                }]} />
              </View>
            </View>

            {/* Matched obligations */}
            <Text style={s.subTitle}>✅ Matched to Obligations</Text>
            {obligationsAnalysis.tracked.filter(t => t.isPaidThisMonth).length === 0 ? (
              <Text style={s.noDataText}>No obligation matches found this month</Text>
            ) : (
              obligationsAnalysis.tracked.filter(t => t.isPaidThisMonth).map(item => (
                <View key={item.obligation.id} style={[s.matchCard, s.matchCardPaid]}>
                  <View style={s.matchHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matchName}>{item.obligation.name}</Text>
                      <Text style={s.matchPayee}>{item.obligation.payee} · {formatCurrency(item.obligation.amount)}/mo</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: T.green + '20' }]}>
                      <Text style={[s.statusBadgeText, { color: T.green }]}>✓ Found</Text>
                    </View>
                  </View>
                  {item.matchingTransactions.map(t => (
                    <View key={t.id} style={s.matchTx}>
                      <Text style={s.matchTxDesc} numberOfLines={1}>{TRANSACTION_CATEGORY_META[t.category]?.emoji} {t.description}</Text>
                      <Text style={s.matchTxAmt}>{formatCurrency(t.amount)} · {formatDate(t.date)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}

            {/* Untracked charges */}
            <Text style={[s.subTitle, { marginTop: 24 }]}>⚠️ Untracked Charges</Text>
            <Text style={s.subInfo}>Charges not matching any obligation. Add recurring ones to track them.</Text>
            {obligationsAnalysis.unmatchedExpenses.length === 0 ? (
              <View style={s.allTrackedBanner}>
                <Text style={s.allTrackedText}>🎉 All charges are tracked!</Text>
              </View>
            ) : (
              Object.entries(obligationsAnalysis.unmatchedByCategory)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([groupKey, data]) => {
                  const gm = TRANSACTION_GROUP_META[groupKey as BankTransactionGroup];
                  return (
                    <View key={groupKey} style={s.untrackedGroup}>
                      <View style={s.untrackedGroupHeader}>
                        <Text style={s.untrackedGroupTitle}>{gm?.emoji} {gm?.label || groupKey}</Text>
                        <Text style={[s.untrackedGroupTotal, { color: gm?.color || '#fbbf24' }]}>{formatCurrency(data.total)}</Text>
                      </View>
                      {data.transactions.sort((a, b) => b.amount - a.amount).map(t => (
                        <View key={t.id} style={s.untrackedItem}>
                          <View style={s.untrackedLeft}>
                            <Text style={s.untrackedEmoji}>{TRANSACTION_CATEGORY_META[t.category]?.emoji || '💳'}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={s.untrackedDesc} numberOfLines={1}>{t.description}</Text>
                              <Text style={s.untrackedDate}>{formatDate(t.date)} · {TRANSACTION_CATEGORY_META[t.category]?.label}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.untrackedAmt}>{formatCurrency(t.amount)}</Text>
                            <TouchableOpacity style={s.trackBtn} onPress={() => handleAddAsObligation(t.description, t.amount)}>
                              <Text style={s.trackBtnText}>+ Track</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })
            )}

            {/* Recurring patterns */}
            {recurringCandidates.length > 0 && (
              <>
                <Text style={[s.subTitle, { marginTop: 24 }]}>🔁 Detected Recurring</Text>
                {recurringCandidates.map((rc, idx) => {
                  const alreadyTracked = obligations.some(o =>
                    hasTokenOverlap(o.name, rc.name) || hasTokenOverlap(o.payee || '', rc.name) || Math.abs(o.amount - rc.averageAmount) < 1
                  );
                  return (
                    <View key={idx} style={[s.recurringCard, alreadyTracked && { borderColor: T.green + '40' }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={s.recurringName} numberOfLines={1}>{rc.name}</Text>
                          {alreadyTracked && <View style={s.trackedPill}><Text style={s.trackedPillText}>✓ Tracked</Text></View>}
                        </View>
                        <Text style={s.recurringDetail}>~{formatCurrency(rc.averageAmount)}/mo · {rc.matchingIds.length} charges</Text>
                      </View>
                      {!alreadyTracked && (
                        <TouchableOpacity style={s.trackBtn} onPress={() => handleAddAsObligation(rc.name, rc.averageAmount)}>
                          <Text style={s.trackBtnText}>+ Track</Text>
                        </TouchableOpacity>
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
              <Text style={s.modalTitle}>{editingTransaction ? 'Edit Charge' : 'Add Charge'}</Text>

              {/* Type */}
              <Text style={s.modalLabel}>Type</Text>
              <View style={s.typeRow}>
                {(['expense', 'income', 'transfer'] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.typePill, formType === t && (t === 'expense' ? s.typePillExpense : t === 'income' ? s.typePillIncome : s.typePillTransfer)]}
                    onPress={() => setFormType(t)}>
                    <Text style={[s.typePillText, formType === t && s.typePillTextActive]}>
                      {t === 'expense' ? '💸 Charge' : t === 'income' ? '💰 Payment' : '↔️ Credit'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={s.modalLabel}>Date</Text>
              <TextInput style={s.modalInput} placeholder="YYYY-MM-DD" placeholderTextColor="#555"
                value={formDate} onChangeText={setFormDate} />

              {/* Description */}
              <Text style={s.modalLabel}>Description</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Amazon, Netflix, Uber" placeholderTextColor="#555"
                value={formDescription} onChangeText={handleDescriptionChange} />

              {/* Amount */}
              <Text style={s.modalLabel}>Amount</Text>
              <View style={s.amountRow}>
                <Text style={s.dollarSign}>$</Text>
                <TextInput style={s.amountInput} placeholder="0.00" placeholderTextColor="#555"
                  keyboardType="numeric" value={formAmount} onChangeText={setFormAmount} />
              </View>

              {/* Category */}
              <Text style={s.modalLabel}>Category</Text>
              <View style={s.categoryGrid}>
                {ALL_CATEGORIES.map(cat => {
                  const cm = TRANSACTION_CATEGORY_META[cat];
                  return (
                    <TouchableOpacity key={cat} style={[s.categoryPill, formCategory === cat && s.categoryPillActive]}
                      onPress={() => setFormCategory(cat)}>
                      <Text style={s.categoryPillText}>{cm?.emoji} {cm?.label || cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes */}
              <Text style={s.modalLabel}>Notes (optional)</Text>
              <TextInput style={s.modalInput} placeholder="Optional notes" placeholderTextColor="#555"
                value={formNotes} onChangeText={setFormNotes} />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancel} onPress={resetForm}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.modalSave} onPress={handleSaveTransaction}><Text style={s.modalSaveText}>Save</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          CSV IMPORT MODAL
          ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showImportModal} animationType="slide" transparent onRequestClose={() => { setCsvText(''); setImportPreview(null); setShowImportModal(false); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>📄 Import Credit Card CSV</Text>
              <Text style={s.modalHelper}>
                Paste your credit card statement CSV below. Supports Capital One, Chase, Discover, Amex, and most standard formats.
              </Text>
              <TextInput style={[s.modalInput, { height: 200, textAlignVertical: 'top' }]} multiline
                placeholder="Paste CSV data here..." placeholderTextColor="#555"
                value={csvText} onChangeText={(t) => { setCsvText(t); setImportPreview(null); }} />

              {!importPreview ? (
                <TouchableOpacity style={[s.modalSave, { marginTop: 16 }]} onPress={handleParseCSV}>
                  <Text style={s.modalSaveText}>Parse CSV</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.previewBox}>
                  <Text style={s.previewTitle}>Preview</Text>
                  <Text style={s.previewSummary}>{importPreview.summary}</Text>
                  {importPreview.errors.length > 0 && (
                    <Text style={s.previewWarning}>⚠️ {importPreview.errors.length} warnings</Text>
                  )}
                  {importPreview.transactions.slice(0, 5).map((t, i) => (
                    <View key={i} style={s.previewRow}>
                      <Text style={s.previewDate}>{t.date}</Text>
                      <Text style={s.previewDesc} numberOfLines={1}>{t.description}</Text>
                      <Text style={[s.previewAmt, { color: t.type === 'income' ? T.green : T.redBright }]}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </Text>
                    </View>
                  ))}
                  {importPreview.transactions.length > 5 && (
                    <Text style={s.previewMore}>...and {importPreview.transactions.length - 5} more</Text>
                  )}
                  <View style={s.modalActions}>
                    <TouchableOpacity style={s.modalCancel} onPress={() => setImportPreview(null)}>
                      <Text style={s.modalCancelText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.modalSave} onPress={handleImport}>
                      <Text style={s.modalSaveText}>Import {importPreview.transactions.length} Charges</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!importPreview && (
                <TouchableOpacity style={[s.modalCancel, { marginTop: 12 }]}
                  onPress={() => { setCsvText(''); setImportPreview(null); setShowImportModal(false); }}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 18, color: T.textMuted, marginBottom: 16, fontFamily: T.fontMedium },
  backButton: { marginBottom: 12 },
  backLink: { fontSize: 16, color: T.redBright, fontFamily: T.fontSemiBold },

  // Debt header
  debtHeader: { ...T.cardBase, borderWidth: 1.5, padding: 20, marginBottom: 16 },
  debtName: { fontSize: 24, color: T.textPrimary, fontFamily: T.fontExtraBold, marginBottom: 4 },
  debtPayee: { fontSize: 14, color: T.textMuted, fontFamily: T.fontMedium, marginBottom: 12 },
  debtStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  debtStat: { flex: 1 },
  debtStatLabel: { fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontFamily: T.fontBold },
  debtStatValue: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontExtraBold },
  txCount: { fontSize: 12, color: T.textMuted, marginTop: 12, fontFamily: T.fontRegular },

  // Monthly stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 12, borderWidth: 1, borderColor: T.border },
  statLabel: { fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: T.fontBold },
  statValue: { fontSize: 16, fontFamily: T.fontExtraBold },

  // Month nav
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 16 },
  monthArrow: { fontSize: 28, color: T.redBright, fontFamily: T.fontBold, paddingHorizontal: 12 },
  monthLabel: { fontSize: 17, color: T.textPrimary, fontFamily: T.fontSemiBold },

  // View tabs
  viewTabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  viewTab: { flex: 1, paddingVertical: 10, borderRadius: T.radius.md, backgroundColor: T.bgCard, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  viewTabActive: { backgroundColor: T.redBright + '20', borderColor: T.redBright },
  viewTabText: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium },
  viewTabTextActive: { color: T.redBright, fontFamily: T.fontBold },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, backgroundColor: T.redBright, paddingVertical: 12, borderRadius: T.radius.md, alignItems: 'center' },
  actionBtnImport: { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border },
  actionBtnText: { fontSize: 14, color: T.textPrimary, fontFamily: T.fontBold },

  // Section
  section: { marginBottom: 20 },

  // Transactions
  dateGroup: { marginBottom: 16 },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 6 },
  dateLabel: { fontSize: 14, color: T.textMuted, fontFamily: T.fontSemiBold },
  dateTotal: { fontSize: 14, fontFamily: T.fontBold },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: T.border },
  txEmoji: { fontSize: 20, marginRight: 10 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, color: T.textPrimary, fontFamily: T.fontMedium },
  txCategory: { fontSize: 11, color: T.textMuted, marginTop: 2, fontFamily: T.fontRegular },
  txAmount: { fontSize: 15, fontFamily: T.fontBold, marginLeft: 8 },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 6, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 13, color: T.textDim, fontFamily: T.fontRegular },

  // Budget
  budgetGroup: { marginBottom: 16 },
  budgetGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetGroupTitle: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontSemiBold },
  budgetGroupTotal: { fontSize: 15, fontFamily: T.fontBold },
  budgetBarBg: { height: 6, backgroundColor: T.border, borderRadius: 3, marginBottom: 6 },
  budgetBarFill: { height: 6, borderRadius: 3 },
  budgetGroupPct: { fontSize: 11, color: T.textMuted, marginBottom: 6, fontFamily: T.fontRegular },
  budgetTx: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  budgetTxDesc: { fontSize: 12, color: T.textSecondary, flex: 1, fontFamily: T.fontRegular },
  budgetTxAmt: { fontSize: 12, color: T.textPrimary, fontFamily: T.fontSemiBold, marginLeft: 8 },

  // Tracking banner
  trackBanner: { backgroundColor: T.bgCard, borderRadius: T.radius.lg, padding: 18, marginBottom: 20, borderWidth: 1.5, borderColor: T.border },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  trackStat: { alignItems: 'center', flex: 1 },
  trackValue: { fontSize: 18, color: T.textPrimary, fontFamily: T.fontExtraBold, marginBottom: 4 },
  trackLabel: { fontSize: 11, color: T.textMuted, fontFamily: T.fontBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  trackBarBg: { height: 8, backgroundColor: '#fbbf2430', borderRadius: 4 },
  trackBarFill: { height: 8, backgroundColor: T.green, borderRadius: 4 },

  // Subsection
  subTitle: { fontSize: 18, color: T.textPrimary, fontFamily: T.fontExtraBold, marginBottom: 6 },
  subInfo: { fontSize: 13, color: T.textMuted, marginBottom: 14, fontFamily: T.fontRegular },
  noDataText: { fontSize: 14, color: T.textDim, padding: 16, fontFamily: T.fontRegular },

  // Match cards
  matchCard: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, marginBottom: 10, borderWidth: 1.5 },
  matchCardPaid: { borderColor: T.green + '40', borderLeftWidth: 4, borderLeftColor: T.green },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchName: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontSemiBold, marginBottom: 2 },
  matchPayee: { fontSize: 13, color: T.textMuted, fontFamily: T.fontRegular },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontFamily: T.fontBold },
  matchTx: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: T.border },
  matchTxDesc: { fontSize: 13, color: T.textSecondary, flex: 1, fontFamily: T.fontRegular },
  matchTxAmt: { fontSize: 13, color: T.green, fontFamily: T.fontSemiBold },

  // All tracked
  allTrackedBanner: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: T.green + '30' },
  allTrackedText: { fontSize: 15, color: T.green, fontFamily: T.fontSemiBold },

  // Untracked
  untrackedGroup: { marginBottom: 16 },
  untrackedGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 8 },
  untrackedGroupTitle: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontSemiBold },
  untrackedGroupTotal: { fontSize: 15, fontFamily: T.fontBold },
  untrackedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.sm, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fbbf2420' },
  untrackedLeft: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' },
  untrackedEmoji: { fontSize: 18 },
  untrackedDesc: { fontSize: 14, color: T.textPrimary, fontFamily: T.fontMedium, marginBottom: 2 },
  untrackedDate: { fontSize: 11, color: T.textMuted, fontFamily: T.fontRegular },
  untrackedAmt: { fontSize: 15, color: '#fbbf24', fontFamily: T.fontBold, marginBottom: 4 },
  trackBtn: { backgroundColor: T.gold, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  trackBtnText: { color: T.bg, fontSize: 11, fontFamily: T.fontBold },

  // Recurring
  recurringCard: { flexDirection: 'row', backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  recurringName: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontSemiBold, marginBottom: 4 },
  recurringDetail: { fontSize: 13, color: T.textMuted, fontFamily: T.fontRegular },
  trackedPill: { backgroundColor: T.green + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: T.green + '40' },
  trackedPillText: { fontSize: 10, color: T.green, fontFamily: T.fontSemiBold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 22, color: T.redBright, marginBottom: 16, fontFamily: T.fontExtraBold },
  modalHelper: { fontSize: 13, color: T.textMuted, marginBottom: 12, lineHeight: 18, fontFamily: T.fontRegular },
  modalLabel: { fontSize: 15, color: T.textPrimary, marginBottom: 6, marginTop: 12, fontFamily: T.fontBold },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, fontSize: 15, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, fontFamily: T.fontRegular },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: { flex: 1, padding: 10, borderRadius: T.radius.sm, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', backgroundColor: T.bgCard },
  typePillExpense: { borderColor: T.redBright, backgroundColor: T.redBright + '15' },
  typePillIncome: { borderColor: T.green, backgroundColor: T.green + '15' },
  typePillTransfer: { borderColor: T.blue, backgroundColor: T.blue + '15' },
  typePillText: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium },
  typePillTextActive: { fontFamily: T.fontBold },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: T.border },
  dollarSign: { fontSize: 20, color: T.redBright, marginRight: 8, fontFamily: T.fontBold },
  amountInput: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 14, fontFamily: T.fontSemiBold },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.bgCard },
  categoryPillActive: { borderColor: T.redBright, backgroundColor: T.redBright + '15' },
  categoryPillText: { fontSize: 11, color: T.textSecondary, fontFamily: T.fontMedium },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancel: { flex: 1, padding: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalSave: { flex: 1, padding: 14, borderRadius: T.radius.md, backgroundColor: T.redBright, alignItems: 'center' },
  modalSaveText: { color: T.textPrimary, fontSize: 16, fontFamily: T.fontBold },

  // Preview
  previewBox: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, marginTop: 16, borderWidth: 1, borderColor: T.redBright + '40' },
  previewTitle: { fontSize: 16, color: T.redBright, fontFamily: T.fontBold, marginBottom: 8 },
  previewSummary: { fontSize: 13, color: T.textSecondary, marginBottom: 8, fontFamily: T.fontRegular },
  previewWarning: { fontSize: 12, color: T.orange, marginBottom: 8, fontFamily: T.fontMedium },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  previewDate: { fontSize: 11, color: T.textMuted, width: 80, fontFamily: T.fontRegular },
  previewDesc: { flex: 1, fontSize: 12, color: T.textPrimary, fontFamily: T.fontRegular },
  previewAmt: { fontSize: 12, fontFamily: T.fontSemiBold },
  previewMore: { fontSize: 12, color: T.textMuted, textAlign: 'center', marginTop: 8, fontFamily: T.fontRegular },
});
