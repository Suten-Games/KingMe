// app/(tabs)/debts.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../../src/store/useStore';
import { useRouter } from 'expo-router';
import type { Debt, BankAccount  } from '../../src/types';
import PaymentStatusBanner from '../../src/components/PaymentStatusBanner';
import PaymentCalendar from '../../src/components/PaymentCalendar';
import DayPaymentsList from '../../src/components/DayPaymentsList';
import { getPaymentEventsForMonth, getMonthlyPaymentStatus } from '../../src/utils/paymentCalendar';
import { T } from '../../src/theme';
import EmptyStateCard from '../../src/components/EmptyStateCard';
import { BankTransaction, BankTransactionCategory, TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '@/types/bankTransactionTypes';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[\/\.\,\-\_\+\*\#\@\!\?\'\"\:\;\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str: string): string[] {
  return normalize(str).split(' ').filter(w => w.length >= 3);
}

const GENERIC_TOKENS = new Set(['the', 'and', 'for', 'from', 'with', 'payment', 'pay', 'card', 'bill', 'loan', 'auto', 'online', 'transfer', 'ach', 'debit', 'credit']);
function hasTokenOverlap(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b).filter(t => !GENERIC_TOKENS.has(t));
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some(t => tokensB.includes(t));
}

function formatCurrency(amt: number): string {
  return `$${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Calculate months to payoff accounting for interest */
function monthsToPayoff(principal: number, monthlyPayment: number, annualRate: number): number | null {
  if (monthlyPayment <= 0 || principal <= 0) return null;
  if (annualRate <= 0) return Math.ceil(principal / monthlyPayment);

  const monthlyRate = annualRate / 12;
  const interestOnly = principal * monthlyRate;

  // If payment doesn't cover interest, it's infinite
  if (monthlyPayment <= interestOnly) return null;

  // Standard amortization formula: n = -log(1 - (r*P/M)) / log(1+r)
  const n = -Math.log(1 - (monthlyRate * principal / monthlyPayment)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

// ─── AccountPicker (reuse from original) ───────────────────────────────────────
function AccountPicker({ bankAccounts, value, onChange }: { bankAccounts: BankAccount[]; value: string; onChange: (id: string) => void }) {
  return (
    <>
      <Text style={s.label}>Payment Account</Text>
      {bankAccounts.length === 0 ? (
        <Text style={s.noAccountsText}>⚠️ No bank accounts added yet</Text>
      ) : (
        <View style={s.accountsList}>
          <TouchableOpacity style={[s.accountOption, value === '' && s.accountOptionSelected]} onPress={() => onChange('')}>
            <Text style={[s.accountOptionText, value === '' && s.accountOptionTextSelected]}>Not assigned</Text>
            {value === '' && <Text style={s.accountOptionCheck}>✓</Text>}
          </TouchableOpacity>
          {bankAccounts.map((account) => (
            <TouchableOpacity key={account.id} style={[s.accountOption, value === account.id && s.accountOptionSelected]} onPress={() => onChange(account.id)}>
              <View>
                <Text style={[s.accountOptionText, value === account.id && s.accountOptionTextSelected]}>{account.name}</Text>
                <Text style={s.accountOptionSub}>{account.institution} · ${(account.currentBalance ?? 0).toLocaleString()}</Text>
              </View>
              {value === account.id && <Text style={s.accountOptionCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

// ─── Category Picker (modal-based) ────────────────────────────────────────────
function CategoryPicker({ value, onChange }: { value: BankTransactionCategory | ''; onChange: (cat: BankTransactionCategory | '') => void }) {
  const [open, setOpen] = useState(false);
  const meta = value ? TRANSACTION_CATEGORY_META[value] : null;

  return (
    <>
      <Text style={s.label}>Spending Category</Text>
      <TouchableOpacity style={s.catPickerField} onPress={() => setOpen(true)}>
        <Text style={meta ? s.catPickerValue : s.catPickerPlaceholder}>
          {meta ? `${meta.emoji} ${meta.label}` : 'Tap to select category'}
        </Text>
        <Text style={s.catPickerArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.catModalOverlay}>
          <View style={s.catModalContent}>
            <View style={s.catModalHeader}>
              <Text style={s.catModalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.catModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.catOption, !value && s.catOptionActive]}
                onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={[s.catOptionText, !value && s.catOptionTextActive]}>None</Text>
              </TouchableOpacity>

              {CATEGORY_OPTIONS.map(({ group, categories }) => {
                const gMeta = TRANSACTION_GROUP_META[group];
                return (
                  <View key={group}>
                    <Text style={[s.catGroupHeader, { color: gMeta?.color || T.textMuted }]}>
                      {gMeta?.emoji} {gMeta?.label}
                    </Text>
                    {categories.map(({ value: cat, label }) => {
                      const catMeta = TRANSACTION_CATEGORY_META[cat];
                      const isActive = value === cat;
                      return (
                        <TouchableOpacity key={cat}
                          style={[s.catOption, isActive && { ...s.catOptionActive, borderColor: gMeta?.color || T.gold }]}
                          onPress={() => { onChange(cat); setOpen(false); }}>
                          <Text style={[s.catOptionText, isActive && s.catOptionTextActive]}>
                            {catMeta?.emoji || ''} {label}
                          </Text>
                          {isActive && <Text style={[s.catOptionCheck, { color: gMeta?.color || T.gold }]}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DebtsScreen() {
  const router = useRouter();
  const debts = useStore((state) => state.debts);
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const bankTransactions = useStore((state) => state.bankTransactions || []);
  const addDebt = useStore((state) => state.addDebt);
  const removeDebt = useStore((state) => state.removeDebt);
  const updateDebt = useStore((state) => state.updateDebt);
  const toggleDebtPaid = useStore((state) => state.toggleDebtPaid);
  const toggleObligationPaid = useStore((state) => state.toggleObligationPaid);

  // ── Modal state ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrincipal, setAddPrincipal] = useState('');
  const [addMonthlyPayment, setAddMonthlyPayment] = useState('');
  const [addInterestRate, setAddInterestRate] = useState('');
  const [addBankAccountId, setAddBankAccountId] = useState('');
  const [addDueDate, setAddDueDate] = useState('');
  const [addPayee, setAddPayee] = useState('');
  const [addTransactionCategory, setAddTransactionCategory] = useState<BankTransactionCategory | ''>('');

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editBankAccountId, setEditBankAccountId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPayee, setEditPayee] = useState('');
  const [editTransactionCategory, setEditTransactionCategory] = useState<BankTransactionCategory | ''>('');

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // ── Payment status (reuses obligations system) ──
  const paymentStatus = useMemo(() =>
    getMonthlyPaymentStatus(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );
  const paymentEvents = useMemo(() =>
    getPaymentEventsForMonth(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );

  const handleTogglePaid = (eventId: string) => {
    if (eventId.startsWith('obl_')) toggleObligationPaid(eventId.replace('obl_', ''));
    else if (eventId.startsWith('debt_')) toggleDebtPaid(eventId.replace('debt_', ''));
  };

  // ── Bank transaction cross-reference ──
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const debtTransactionMatches = useMemo(() => {
    const thisMonthTxns = bankTransactions.filter(t =>
      t.date.startsWith(currentMonthStr) && t.type !== 'income'
    );

    const matches: Record<string, BankTransaction[]> = {};

    for (const debt of debts) {
      const debtNameNorm = normalize(debt.name);
      const debtPayeeNorm = normalize((debt as any).payee || '');
      const debtAmount = debt.monthlyPayment || 0;

      const found = thisMonthTxns.filter(t => {
        const descNorm = normalize(t.description);
        const descStripped = descNorm.replace(/\s/g, '');
        const debtNameStripped = debtNameNorm.replace(/\s/g, '');
        const debtPayeeStripped = debtPayeeNorm.replace(/\s/g, '');

        // Strong: full debt name appears in description
        const fullNameMatch =
          (debtNameNorm.length >= 4 && descNorm.includes(debtNameNorm)) ||
          (debtNameStripped.length >= 4 && descStripped.includes(debtNameStripped));
        // Weaker: payee appears in description — needs amount evidence
        const payeeMatch =
          (debtPayeeNorm.length >= 4 && descNorm.includes(debtPayeeNorm)) ||
          (debtPayeeStripped.length >= 4 && descStripped.includes(debtPayeeStripped));
        const tokenMatch =
          hasTokenOverlap(t.description, debt.name) ||
          hasTokenOverlap(t.description, (debt as any).payee || '');

        const amountClose = debtAmount > 0 && Math.abs(t.amount - debtAmount) / debtAmount < 0.15;
        const amountExact = Math.abs(t.amount - debtAmount) < 0.02;

        // Full name match alone is strong enough (credit card payments vary in amount)
        if (fullNameMatch) return true;
        // Payee match or token match requires amount evidence
        if ((payeeMatch || tokenMatch) && (amountClose || amountExact)) return true;

        // Exact amount + debt payment category + same account
        if (amountExact && t.category === 'financial_debt_payment' && debt.bankAccountId === t.bankAccountId) return true;

        return false;
      });

      matches[debt.id] = found;
    }

    return matches;
  }, [debts, bankTransactions, currentMonthStr]);

  // ── Handlers ──
  const handleAddDebt = () => {
    if (!addName || !addPrincipal || !addMonthlyPayment) return;
    addDebt({
      id: Date.now().toString(),
      name: addName,
      principal: parseFloat(addPrincipal),
      monthlyPayment: parseFloat(addMonthlyPayment),
      minimumPayment: parseFloat(addMonthlyPayment),
      interestRate: addInterestRate ? parseFloat(addInterestRate) / 100 : 0,
      dueDate: addDueDate ? parseInt(addDueDate) : 1,
      ...(addBankAccountId && { bankAccountId: addBankAccountId }),
      ...(addPayee && { payee: addPayee }),
      ...(addTransactionCategory && { transactionCategory: addTransactionCategory }),
    });
    resetAddForm();
  };

  const resetAddForm = () => {
    setAddName(''); setAddPrincipal(''); setAddMonthlyPayment('');
    setAddInterestRate(''); setAddBankAccountId(''); setAddDueDate(''); setAddPayee('');
    setAddTransactionCategory('');
    setShowAddModal(false);
  };

  const openEdit = (debt: Debt) => {
    setSelectedDebt(debt);
    setEditName(debt.name);
    setEditPrincipal(debt.principal.toString());
    setEditMonthlyPayment(debt.monthlyPayment.toString());
    setEditInterestRate(debt.interestRate ? (debt.interestRate * 100).toString() : '');
    setEditBankAccountId(debt.bankAccountId || '');
    setEditDueDate(debt.dueDate?.toString() || '');
    setEditPayee((debt as any).payee || '');
    setEditTransactionCategory((debt as any).transactionCategory || '');
  };

  const handleSaveEdit = () => {
    if (!selectedDebt) return;
    updateDebt(selectedDebt.id, {
      name: editName,
      principal: parseFloat(editPrincipal) || selectedDebt.principal,
      monthlyPayment: parseFloat(editMonthlyPayment) || selectedDebt.monthlyPayment,
      minimumPayment: parseFloat(editMonthlyPayment) || selectedDebt.minimumPayment,
      interestRate: editInterestRate ? parseFloat(editInterestRate) / 100 : 0,
      bankAccountId: editBankAccountId || undefined,
      dueDate: editDueDate ? parseInt(editDueDate) : selectedDebt.dueDate ?? 1,
      payee: editPayee || undefined,
      transactionCategory: editTransactionCategory || undefined,
    });
    setSelectedDebt(null);
  };

  const normalizeDebt = (debt: any): Debt => ({
    id: debt.id, name: debt.name,
    principal: debt.principal ?? debt.remainingAmount ?? debt.totalAmount ?? 0,
    monthlyPayment: debt.monthlyPayment ?? 0,
    minimumPayment: debt.minimumPayment ?? debt.monthlyPayment ?? 0,
    interestRate: debt.interestRate != null ? (debt.interestRate > 1 ? debt.interestRate / 100 : debt.interestRate) : 0,
    bankAccountId: debt.bankAccountId,
    isPaidThisMonth: debt.isPaidThisMonth,
    lastPaidDate: debt.lastPaidDate,
    dueDate: debt.dueDate,
    payee: debt.payee,
  });

  const normalizedDebts = debts.map(normalizeDebt);
  const getAccountName = (id?: string) => id ? bankAccounts.find((a) => a.id === id)?.name || null : null;
  const monthlyTotal = normalizedDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalDebt = normalizedDebts.reduce((sum, d) => sum + d.principal, 0);
  const unassignedCount = normalizedDebts.filter((d) => !d.bankAccountId).length;
  const paidCount = normalizedDebts.filter(d => {
    const hasBankMatch = (debtTransactionMatches[d.id] || []).length > 0;
    return d.isPaidThisMonth || hasBankMatch;
  }).length;

  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView}>

        {/* ── Payment Status Banner ─────────────────────────────── */}
        <PaymentStatusBanner
          status={paymentStatus}
          onShowCalendar={() => setShowCalendar(true)}
        />

        {/* ── Summary ───────────────────────────────────────────── */}
        <LinearGradient colors={T.gradients.red} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryBox, { borderColor: T.redBright + '80' }]}>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Total Debt</Text>
              <Text style={s.summaryDebt}>${totalDebt.toLocaleString()}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Monthly Payments</Text>
              <Text style={s.summaryPayment}>${monthlyTotal.toLocaleString()}/mo</Text>
            </View>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Paid This Month</Text>
              <Text style={s.summaryPaidCount}>{paidCount} of {normalizedDebts.length}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Debt-Free ETA</Text>
              <Text style={s.summaryEta}>
                {totalDebt > 0 && monthlyTotal > 0
                  ? `~${Math.ceil(totalDebt / monthlyTotal)} months`
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {unassignedCount > 0 && (
          <View style={s.unassignedBanner}>
            <Text style={s.unassignedBannerText}>
              ⚠️ {unassignedCount} debt{unassignedCount > 1 ? 's' : ''} not assigned to a bank account
            </Text>
          </View>
        )}

        {/* ── Debt List ─────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your Debts</Text>
            <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={s.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {normalizedDebts.length === 0 ? (
            <EmptyStateCard category="debts" onAction={() => setShowAddModal(true)} />
          ) : (
            normalizedDebts.map((debt) => {
              const matchedTxns = debtTransactionMatches[debt.id] || [];
              const isPaid = debt.isPaidThisMonth || matchedTxns.length > 0;
              const months = monthsToPayoff(debt.principal, debt.monthlyPayment, debt.interestRate);
              const totalPaid = debt.monthlyPayment > 0 && debt.principal > 0
                ? Math.max(0, 1 - (debt.principal / (debt.principal + debt.monthlyPayment * 12)))
                : 0;

              return (
                <TouchableOpacity key={debt.id} onPress={() => router.push(`/debt/${debt.id}`)} activeOpacity={0.7}>
                  <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.debtCard, { borderColor: isPaid ? T.green + '60' : T.redBright + '40' }]}>

                    {/* Header row with name + paid toggle */}
                    <View style={s.debtHeader}>
                      <TouchableOpacity
                        style={[s.paidToggle, isPaid && s.paidToggleActive]}
                        onPress={(e) => { e.stopPropagation(); toggleDebtPaid(debt.id); }}
                      >
                        <Text style={s.paidToggleText}>{isPaid ? '✓' : ''}</Text>
                      </TouchableOpacity>

                      <View style={s.debtHeaderLeft}>
                        <Text style={[s.debtName, isPaid && s.debtNamePaid]}>{debt.name}</Text>
                        {(debt as any).payee && (
                          <Text style={s.debtPayee}>Paid to: {(debt as any).payee}</Text>
                        )}
                        {debt.bankAccountId ? (
                          <Text style={s.debtAccount}>💳 {getAccountName(debt.bankAccountId)}</Text>
                        ) : (
                          <Text style={s.debtAccountUnset}>⚠️ No account assigned</Text>
                        )}
                        {debt.dueDate && (
                          <Text style={s.debtDueDate}>
                            📅 Due on the {debt.dueDate}{getDaySuffix(debt.dueDate)} of each month
                          </Text>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEdit(debt); }} style={{ padding: 4 }}>
                          <Text style={s.editButton}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeDebt(debt.id); }} style={{ padding: 4 }}>
                          <Text style={s.deleteButton}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Details row */}
                    <View style={s.debtDetails}>
                      <View style={s.debtDetail}>
                        <Text style={s.debtDetailLabel}>Balance</Text>
                        <Text style={s.debtDetailValue}>${debt.principal.toLocaleString()}</Text>
                      </View>
                      <View style={s.debtDetail}>
                        <Text style={s.debtDetailLabel}>Payment</Text>
                        <Text style={s.debtPayment}>${debt.monthlyPayment.toLocaleString()}/mo</Text>
                      </View>
                      <View style={s.debtDetail}>
                        <Text style={s.debtDetailLabel}>Rate</Text>
                        <Text style={s.debtDetailValue}>{(debt.interestRate * 100).toFixed(1)}%</Text>
                      </View>
                      <View style={s.debtDetail}>
                        <Text style={s.debtDetailLabel}>Payoff</Text>
                        <Text style={s.debtDetailValue}>
                          {months !== null
                            ? months >= 12 ? `${(months / 12).toFixed(1)}y` : `${months}mo`
                            : '∞'}
                        </Text>
                      </View>
                    </View>

                    {/* Bank transaction match indicator */}
                    {matchedTxns.length > 0 && (
                      <View style={s.bankMatchSection}>
                        <View style={s.bankMatchDivider} />
                        <Text style={s.bankMatchTitle}>🏦 Bank Transaction Match</Text>
                        {matchedTxns.map(t => (
                          <View key={t.id} style={s.bankMatchRow}>
                            <Text style={s.bankMatchDesc} numberOfLines={1}>
                              {TRANSACTION_CATEGORY_META[t.category]?.emoji || '💳'} {t.description}
                            </Text>
                            <Text style={s.bankMatchAmount}>
                              {formatCurrency(t.amount)} · {formatDate(t.date)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Paid badge */}
                    {isPaid && (
                      <View style={s.paidBadge}>
                        <Text style={s.paidBadgeText}>✓ Paid This Month</Text>
                      </View>
                    )}

                    {/* Tap hint */}
                    <View style={s.tapHint}>
                      <Text style={s.tapHintText}>
                        💳 {bankTransactions.filter(t => t.bankAccountId === debt.id).length} transactions · Tap to view →
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Calendar Modal ─────────────────────────────────────── */}
        <Modal visible={showCalendar} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <PaymentCalendar
                year={currentYear} month={currentMonth} events={paymentEvents}
                onDayPress={(day) => { setSelectedDay(day); setShowCalendar(false); }}
              />
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Text style={s.closeCalendarText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Day Detail Modal ────────────────────────────────────── */}
        <Modal visible={selectedDay !== null} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            {selectedDay !== null && (
              <DayPaymentsList
                day={selectedDay} month={currentMonth} year={currentYear}
                events={paymentEvents.filter(e => e.dueDate.getDate() === selectedDay)}
                onTogglePaid={handleTogglePaid}
                onClose={() => setSelectedDay(null)}
              />
            )}
          </View>
        </Modal>
      </ScrollView>

      {/* ═══════════════ ADD MODAL ═══════════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Add Debt</Text>

              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Student Loan, Car Payment" placeholderTextColor="#555"
                value={addName} onChangeText={setAddName} />

              <Text style={s.label}>Payee / Merchant (for bank matching)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Bridgecrest, Navient, Chase" placeholderTextColor="#555"
                value={addPayee} onChangeText={setAddPayee} />

              <Text style={s.label}>Total Amount Owed</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={addPrincipal} onChangeText={setAddPrincipal} />
              </View>

              <Text style={s.label}>Monthly Payment</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={addMonthlyPayment} onChangeText={setAddMonthlyPayment} />
                <Text style={s.period}>/mo</Text>
              </View>

              <Text style={s.label}>Interest Rate (optional)</Text>
              <View style={s.inputContainer}>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={addInterestRate} onChangeText={setAddInterestRate} />
                <Text style={s.percent}>%</Text>
              </View>

              <Text style={s.label}>Due Day of Month (optional)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., 1, 15, 28" placeholderTextColor="#555"
                keyboardType="numeric" value={addDueDate} onChangeText={setAddDueDate} />

              <CategoryPicker value={addTransactionCategory} onChange={setAddTransactionCategory} />

              <AccountPicker bankAccounts={bankAccounts} value={addBankAccountId} onChange={setAddBankAccountId} />

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={resetAddForm}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalAddButton, (!addName || !addPrincipal || !addMonthlyPayment) && s.modalAddButtonDisabled]}
                  onPress={handleAddDebt}
                  disabled={!addName || !addPrincipal || !addMonthlyPayment}
                >
                  <Text style={s.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ EDIT MODAL ═══════════════ */}
      <Modal visible={selectedDebt !== null} animationType="slide" transparent onRequestClose={() => setSelectedDebt(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Edit Debt</Text>

              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="Debt name" placeholderTextColor="#555"
                value={editName} onChangeText={setEditName} />

              <Text style={s.label}>Payee / Merchant (for bank matching)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Bridgecrest, Navient, Chase" placeholderTextColor="#555"
                value={editPayee} onChangeText={setEditPayee} />

              <Text style={s.label}>Total Amount Owed</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={editPrincipal} onChangeText={setEditPrincipal} />
              </View>

              <Text style={s.label}>Monthly Payment</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={editMonthlyPayment} onChangeText={setEditMonthlyPayment} />
                <Text style={s.period}>/mo</Text>
              </View>

              <Text style={s.label}>Interest Rate (optional)</Text>
              <View style={s.inputContainer}>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                  value={editInterestRate} onChangeText={setEditInterestRate} />
                <Text style={s.percent}>%</Text>
              </View>

              <Text style={s.label}>Due Day of Month (optional)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., 1, 15, 28" placeholderTextColor="#555"
                keyboardType="numeric" value={editDueDate} onChangeText={setEditDueDate} />

              <CategoryPicker value={editTransactionCategory} onChange={setEditTransactionCategory} />

              <AccountPicker bankAccounts={bankAccounts} value={editBankAccountId} onChange={setEditBankAccountId} />

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={() => setSelectedDebt(null)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSaveButton} onPress={handleSaveEdit}>
                  <Text style={s.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },

  // Summary
  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontFamily: T.fontBold },
  summaryDebt: { fontSize: 26, color: T.textPrimary, fontFamily: T.fontExtraBold },
  summaryPayment: { fontSize: 26, color: T.redBright, fontFamily: T.fontExtraBold },
  summaryDivider: { height: 1, backgroundColor: T.textMuted + '30', marginVertical: 14 },
  summaryPaidCount: { fontSize: 20, color: T.green, fontFamily: T.fontExtraBold },
  summaryEta: { fontSize: 20, color: T.blue, fontFamily: T.fontExtraBold },

  // Unassigned banner
  unassignedBanner: { backgroundColor: '#2a1a1e', borderRadius: T.radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: T.redBright + '44' },
  unassignedBannerText: { fontSize: 14, color: T.orange, textAlign: 'center', fontFamily: T.fontMedium },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: T.redBright, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.textPrimary, fontFamily: T.fontBold, fontSize: 14 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  // Debt cards
  debtCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.redBright },
  debtHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  debtHeaderLeft: { flex: 1 },
  debtName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  debtNamePaid: { color: T.green },
  debtPayee: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium, marginBottom: 2 },
  debtAccount: { fontSize: 13, color: T.green, fontFamily: T.fontMedium },
  debtAccountUnset: { fontSize: 13, color: T.orange, fontStyle: 'italic', fontFamily: T.fontMedium },
  debtDueDate: { fontSize: 12, color: T.blue, marginTop: 4, fontFamily: T.fontMedium },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },
  editButton: { fontSize: 18, color: '#60a5fa', padding: 4 },

  // Paid toggle checkbox
  paidToggle: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 2,
    borderColor: T.border, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  paidToggleActive: { backgroundColor: T.green, borderColor: T.green },
  paidToggleText: { color: T.bg, fontSize: 15, fontFamily: T.fontBold },

  // Debt details
  debtDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  debtDetail: { flex: 1 },
  debtDetailLabel: { fontSize: 11, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: T.fontBold },
  debtDetailValue: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontSemiBold },
  debtPayment: { fontSize: 15, color: T.redBright, fontFamily: T.fontBold },

  // Bank match section
  bankMatchSection: { marginTop: 4 },
  bankMatchDivider: { height: 1, backgroundColor: T.green + '30', marginVertical: 10 },
  bankMatchTitle: { fontSize: 12, color: T.green, marginBottom: 6, fontFamily: T.fontBold },
  bankMatchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  bankMatchDesc: { fontSize: 12, color: T.textSecondary, flex: 1, fontFamily: T.fontRegular },
  bankMatchAmount: { fontSize: 12, color: T.green, fontFamily: T.fontSemiBold, marginLeft: 8 },

  // Paid badge
  paidBadge: { backgroundColor: T.green + '20', borderRadius: T.radius.sm, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 10 },
  paidBadgeText: { fontSize: 12, color: T.green, fontFamily: T.fontBold },
  tapHint: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.border, alignItems: 'center' },
  tapHintText: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },

  // Calendar close
  closeCalendarText: { color: T.gold, fontFamily: T.fontSemiBold, textAlign: 'center', padding: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 24, color: T.redBright, marginBottom: 20, fontFamily: T.fontExtraBold },
  label: { fontSize: 15, color: T.textPrimary, marginBottom: 8, marginTop: 12, fontFamily: T.fontBold },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, fontFamily: T.fontRegular },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, color: T.redBright, marginRight: 8, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16, fontFamily: T.fontSemiBold },
  period: { fontSize: 14, color: T.textMuted, marginLeft: 8, fontFamily: T.fontRegular },
  percent: { fontSize: 16, color: T.textMuted, marginLeft: 8, fontFamily: T.fontRegular },

  noAccountsText: { fontSize: 14, color: T.redBright, padding: 12, backgroundColor: '#2a1a1e', borderRadius: T.radius.sm, fontFamily: T.fontMedium },
  accountsList: { gap: 8, marginTop: 4 },
  accountOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  accountOptionSelected: { borderColor: T.green, backgroundColor: '#1a2f1e' },
  accountOptionText: { fontSize: 15, color: T.textPrimary, marginBottom: 2, fontFamily: T.fontMedium },
  accountOptionTextSelected: { color: T.green, fontFamily: T.fontBold },
  accountOptionSub: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },
  accountOptionCheck: { fontSize: 18, color: T.green, fontFamily: T.fontBold },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalAddButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.redBright, alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: T.textPrimary, fontSize: 16, fontFamily: T.fontBold },
  modalSaveButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.green, alignItems: 'center' },
  modalSaveText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },

  // Category picker
  catPickerField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, borderWidth: 1.5, borderColor: T.border },
  catPickerValue: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontMedium },
  catPickerPlaceholder: { fontSize: 16, color: '#555', fontFamily: T.fontRegular },
  catPickerArrow: { fontSize: 12, color: T.textMuted },
  catModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  catModalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '70%' },
  catModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catModalTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  catModalClose: { fontSize: 22, color: T.textMuted, padding: 4 },
  catGroupHeader: { fontSize: 13, fontFamily: T.fontBold, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  catOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 4 },
  catOptionActive: { borderColor: T.redBright, backgroundColor: T.redBright + '15' },
  catOptionText: { fontSize: 15, color: T.textSecondary, fontFamily: T.fontMedium },
  catOptionTextActive: { color: T.textPrimary, fontFamily: T.fontBold },
  catOptionCheck: { fontSize: 16, fontFamily: T.fontBold },
});
