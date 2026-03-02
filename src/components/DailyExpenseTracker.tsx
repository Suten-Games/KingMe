// components/DailyExpenseTracker.tsx
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { DailyExpense, DailyExpenseCategory, BankAccount } from '../types';

// ─── category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<DailyExpenseCategory, { label: string; emoji: string }> = {
  daily_spend:      { label: 'Daily Spend', emoji: '💳' },
  transfer:         { label: 'Transfer', emoji: '↔️' },
  smoking:          { label: 'Smoking', emoji: '🚬' },
  food_grocery:     { label: 'Grocery', emoji: '🛒' },
  food_dad_lunch:   { label: 'Dad Lunch', emoji: '🍔' },
  food_restaurants: { label: 'Restaurants', emoji: '🍽️' },
  medical:          { label: 'Medical', emoji: '🏥' },
  business:         { label: 'Business', emoji: '💼' },
  housing:          { label: 'Housing', emoji: '🏠' },
  utilities:        { label: 'Utilities', emoji: '💡' },
  transport:        { label: 'Transport', emoji: '🚗' },
  entertainment:    { label: 'Entertainment', emoji: '🎬' },
  other:            { label: 'Other', emoji: '📋' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  // Handle both "YYYY-MM-DD" and ISO strings like "2026-02-04T07:00:00.000Z"
  const d = new Date(dateStr + 'T12:00:00'); // Add noon to avoid timezone issues
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatCurrency(amt: number): string {
  return `$${Math.abs(amt).toFixed(2)}`;
}

// Group expenses by date
function groupByDate(expenses: DailyExpense[]): Record<string, DailyExpense[]> {
  const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groups: Record<string, DailyExpense[]> = {};
  sorted.forEach((exp) => {
    const dateKey = exp.date.split('T')[0]; // YYYY-MM-DD
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(exp);
  });
  return groups;
}

// ─── component ────────────────────────────────────────────────────────────────
interface DailyExpenseTrackerProps {
  obligations: any[]; // to calculate daily_living estimate
}

export function DailyExpenseTracker({ obligations }: DailyExpenseTrackerProps) {
  const dailyExpenses         = useStore((s) => s.dailyExpenses || []);
  const expenseTrackingMode   = useStore((s) => s.expenseTrackingMode || 'estimate');
  const cryptoCardBalance     = useStore((s) => s.cryptoCardBalance);
  const bankAccounts          = useStore((s) => s.bankAccounts);
  const settings              = useStore((s) => s.settings);
  const addDailyExpense       = useStore((s) => s.addDailyExpense);
  const removeDailyExpense    = useStore((s) => s.removeDailyExpense);
  const updateDailyExpense    = useStore((s) => s.updateDailyExpense);
  const setExpenseTrackingMode = useStore((s) => s.setExpenseTrackingMode);
  const setCryptoCardBalance  = useStore((s) => s.setCryptoCardBalance);
  const addCardDeposit        = useStore((s) => s.addCardDeposit);
  const updateSettings        = useStore((s) => s.updateSettings);
  const updateBankAccount     = useStore((s) => s.updateBankAccount);

  // Linked account resolution
  const linkedAccount = useMemo(() => {
    if (!settings.dailyExpenseAccountId) return null;
    return bankAccounts.find((a) => a.id === settings.dailyExpenseAccountId) || null;
  }, [settings.dailyExpenseAccountId, bankAccounts]);

  const activeBalance = linkedAccount
    ? linkedAccount.currentBalance
    : cryptoCardBalance.currentBalance;

  const activeAccountName = linkedAccount ? linkedAccount.name : 'Crypto.com Card';

  const [showModal, setShowModal]           = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [category, setCategory]         = useState<DailyExpenseCategory>('daily_spend');
  const [description, setDescription]   = useState('');
  const [amount, setAmount]             = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [balanceInput, setBalanceInput]   = useState('');
  const [notes, setNotes]               = useState('');

  // ── estimate from obligations ──────────────────────────────────────────────
  const dailyLivingMonthly = obligations
    .filter((o) => o.category === 'daily_living')
    .reduce((sum, o) => sum + o.amount, 0);
  const estimatedDailySpend = dailyLivingMonthly / 30;

  // ── manual tracking stats ──────────────────────────────────────────────────
  const { todaySpend, weekSpend, monthSpend } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = dailyExpenses
      .filter((e) => e.date.split('T')[0] === todayStr && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);

    const week = dailyExpenses
      .filter((e) => new Date(e.date) >= weekAgo && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);

    const month = dailyExpenses
      .filter((e) => new Date(e.date) >= monthStart && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);

    return { todaySpend: today, weekSpend: week, monthSpend: month };
  }, [dailyExpenses]);

  const grouped = groupByDate(dailyExpenses);

  // ── handlers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('daily_spend');
    setDescription('');
    setAmount('');
    setNotes('');
    setEditingExpense(null);
    setShowModal(false);
  };

  const handleEditExpense = (expense: DailyExpense) => {
    setEditingExpense(expense);
    setDate(expense.date.split('T')[0]); // Handle both "YYYY-MM-DD" and ISO strings
    setCategory(expense.category);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setNotes(expense.notes || '');
    setShowModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingExpense || !description || !amount) return;

    updateDailyExpense(editingExpense.id, {
      date: date,
      category,
      description,
      amount: parseFloat(amount),
      notes: notes || undefined,
    });
    
    resetForm();
  };

  const handleAddExpense = () => {
    if (!description || !amount) return;

    // Store date as YYYY-MM-DD string directly, no timezone conversion
    const expense: DailyExpense = {
      id: Date.now().toString(),
      date: date, // Keep as YYYY-MM-DD string
      category,
      description,
      amount: parseFloat(amount),
      notes: notes || undefined,
    };

    addDailyExpense(expense);
    resetForm();
  };

  const handleRemove = (expenseId: string) => {
    removeDailyExpense(expenseId);
  };

  return (
    <View style={styles.container}>

      {/* ══════════════════════════════════════════════════════════════════════
          MODE TOGGLE
          ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, expenseTrackingMode === 'estimate' && styles.modeButtonActive]}
          onPress={() => setExpenseTrackingMode('estimate')}
        >
          <Text style={[styles.modeButtonText, expenseTrackingMode === 'estimate' && styles.modeButtonTextActive]}>
            Estimate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, expenseTrackingMode === 'manual' && styles.modeButtonActive]}
          onPress={() => setExpenseTrackingMode('manual')}
        >
          <Text style={[styles.modeButtonText, expenseTrackingMode === 'manual' && styles.modeButtonTextActive]}>
            Track Daily
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          ESTIMATE MODE
          ══════════════════════════════════════════════════════════════════════ */}
      {expenseTrackingMode === 'estimate' && (
        <View style={styles.estimateBox}>
          <Text style={styles.estimateLabel}>Daily Living (from Obligations)</Text>
          <Text style={styles.estimateValue}>{formatCurrency(estimatedDailySpend)}/day</Text>
          <Text style={styles.estimateSubtext}>
            = {formatCurrency(dailyLivingMonthly)}/month ÷ 30 days
          </Text>
          <Text style={styles.estimateNote}>
            💡 Switch to "Track Daily" to log every expense manually like your Google Sheet.
          </Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MANUAL MODE
          ══════════════════════════════════════════════════════════════════════ */}
      {expenseTrackingMode === 'manual' && (
        <>
          {/* Card Balance / Account Picker */}
          {!linkedAccount && !settings.dailyExpenseAccountId ? (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>Link a Bank Account</Text>
              <Text style={[styles.balanceSubtext, { marginTop: 4, marginBottom: 12 }]}>
                Choose which account your daily expenses deduct from
              </Text>
              {bankAccounts.length === 0 ? (
                <Text style={styles.balanceSubtext}>No bank accounts yet. Add one in Settings.</Text>
              ) : (
                bankAccounts.map((acct) => (
                  <TouchableOpacity
                    key={acct.id}
                    style={styles.accountPickerRow}
                    onPress={() => updateSettings({ dailyExpenseAccountId: acct.id })}
                  >
                    <Text style={styles.accountPickerName}>{acct.name}</Text>
                    <Text style={styles.accountPickerBalance}>${acct.currentBalance.toFixed(2)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : (
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceTitle}>{linkedAccount ? '🏦' : '💳'} {activeAccountName}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowAccountPicker(true)}>
                    <Text style={styles.balanceEditBtn}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setBalanceInput(activeBalance.toString()); setShowBalanceModal(true); }}>
                    <Text style={styles.balanceEditBtn}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.balanceAmount}>${activeBalance.toFixed(2)}</Text>
              {!linkedAccount && (
                <Text style={styles.balanceSubtext}>
                  Updated {new Date(cryptoCardBalance.lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              )}
              <TouchableOpacity style={styles.depositButton} onPress={() => setShowDepositModal(true)}>
                <Text style={styles.depositButtonText}>+ Top Up</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Today</Text>
                <Text style={styles.summaryValue}>{formatCurrency(todaySpend)}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>This Week</Text>
                <Text style={styles.summaryValue}>{formatCurrency(weekSpend)}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>This Month</Text>
                <Text style={styles.summaryValue}>{formatCurrency(monthSpend)}</Text>
              </View>
            </View>
            {estimatedDailySpend > 0 && (
              <Text style={styles.summaryVsEstimate}>
                vs {formatCurrency(estimatedDailySpend * 30)}/mo estimate
              </Text>
            )}
          </View>

          {/* Add button */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Expense list grouped by date */}
          <ScrollView style={styles.expenseList} showsVerticalScrollIndicator={false}>
            {Object.keys(grouped).length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No expenses logged yet</Text>
                <Text style={styles.emptySubtext}>Tap "+ Add" to start tracking</Text>
              </View>
            ) : (
              Object.entries(grouped).map(([dateKey, expenses]) => {
                const dayTotal = expenses.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0);
                return (
                  <View key={dateKey} style={styles.dateGroup}>
                    <View style={styles.dateHeader}>
                      <Text style={styles.dateLabel}>{formatDate(dateKey)}</Text>
                      <Text style={styles.dateTotalLabel}>Total: {formatCurrency(dayTotal)}</Text>
                    </View>
                    {expenses.map((exp) => (
                      <TouchableOpacity 
                        key={exp.id} 
                        style={styles.expenseCard}
                        onPress={() => handleEditExpense(exp)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.expenseRow}>
                          <View style={styles.expenseLeft}>
                            <Text style={styles.expenseEmoji}>{CATEGORY_LABELS[exp.category].emoji}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.expenseDesc}>{exp.description}</Text>
                              <Text style={styles.expenseCategory}>{CATEGORY_LABELS[exp.category].label}</Text>
                              {exp.notes && <Text style={styles.expenseNotes}>{exp.notes}</Text>}
                            </View>
                          </View>
                          <View style={styles.expenseRight}>
                            <Text style={[styles.expenseAmount, { color: exp.amount >= 0 ? '#ff6b6b' : '#4ade80' }]}>
                              {exp.amount >= 0 ? '' : '+'}{formatCurrency(exp.amount)}
                            </Text>
                            <TouchableOpacity 
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRemove(exp.id);
                              }}
                              style={styles.deleteButtonContainer}
                            >
                              <Text style={styles.deleteBtn}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* ═══════════════ ADD EXPENSE MODAL ═══════════════ */}
      <Modal visible={showModal} animationType="slide" transparent={true} onRequestClose={resetForm}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</Text>

              {/* Date */}
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666"
                value={date}
                onChangeText={setDate}
              />

              {/* Category */}
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {(Object.keys(CATEGORY_LABELS) as DailyExpenseCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={styles.categoryEmoji}>{CATEGORY_LABELS[cat].emoji}</Text>
                    <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                      {CATEGORY_LABELS[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={styles.label}>Description / Payee</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Circle K, Per Diem, Walmart"
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
              />

              {/* Amount */}
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.helperText}>Enter positive for spent, negative for received/refund</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Notes */}
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Optional notes"
                placeholderTextColor="#666"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={resetForm}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtn, (!description || !amount) && styles.modalBtnDisabled]}
                  onPress={editingExpense ? handleSaveEdit : handleAddExpense}
                  disabled={!description || !amount}
                >
                  <Text style={styles.modalAddText}>{editingExpense ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ DEPOSIT MODAL ═══════════════ */}
      <Modal visible={showDepositModal} animationType="slide" transparent={true} onRequestClose={() => setShowDepositModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Top Up {activeAccountName}</Text>
            <Text style={styles.helperText}>Add funds to {activeAccountName}</Text>

            <Text style={styles.label}>Amount</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={depositAmount}
                onChangeText={setDepositAmount}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowDepositModal(false); setDepositAmount(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAddBtn, !depositAmount && styles.modalBtnDisabled]}
                onPress={() => {
                  if (depositAmount) {
                    addCardDeposit(parseFloat(depositAmount));
                    setDepositAmount('');
                    setShowDepositModal(false);
                  }
                }}
                disabled={!depositAmount}
              >
                <Text style={styles.modalAddText}>Top Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ EDIT BALANCE MODAL ═══════════════ */}
      <Modal visible={showBalanceModal} animationType="slide" transparent={true} onRequestClose={() => setShowBalanceModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Balance</Text>
            <Text style={styles.helperText}>Manually set the balance for {activeAccountName}</Text>

            <Text style={styles.label}>Current Balance</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={balanceInput}
                onChangeText={setBalanceInput}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowBalanceModal(false); setBalanceInput(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAddBtn, !balanceInput && styles.modalBtnDisabled]}
                onPress={() => {
                  if (balanceInput) {
                    if (linkedAccount) {
                      updateBankAccount(linkedAccount.id, { currentBalance: parseFloat(balanceInput) });
                    } else {
                      setCryptoCardBalance(parseFloat(balanceInput));
                    }
                    setBalanceInput('');
                    setShowBalanceModal(false);
                  }
                }}
                disabled={!balanceInput}
              >
                <Text style={styles.modalAddText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ ACCOUNT PICKER MODAL ═══════════════ */}
      <Modal visible={showAccountPicker} animationType="slide" transparent={true} onRequestClose={() => setShowAccountPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link Account</Text>
            <Text style={styles.helperText}>Choose which bank account expenses deduct from</Text>

            <ScrollView style={{ marginTop: 12 }}>
              {bankAccounts.map((acct) => (
                <TouchableOpacity
                  key={acct.id}
                  style={[
                    styles.accountPickerRow,
                    acct.id === settings.dailyExpenseAccountId && styles.accountPickerRowActive,
                  ]}
                  onPress={() => {
                    updateSettings({ dailyExpenseAccountId: acct.id });
                    setShowAccountPicker(false);
                  }}
                >
                  <View>
                    <Text style={styles.accountPickerName}>{acct.name}</Text>
                    <Text style={styles.accountPickerInstitution}>{acct.institution}</Text>
                  </View>
                  <Text style={styles.accountPickerBalance}>${acct.currentBalance.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAccountPicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              {settings.dailyExpenseAccountId && (
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: '#ff6b6b' }]}
                  onPress={() => {
                    updateSettings({ dailyExpenseAccountId: undefined });
                    setShowAccountPicker(false);
                  }}
                >
                  <Text style={[styles.modalCancelText, { color: '#ff6b6b' }]}>Unlink</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginBottom: 20 },

  // ── Mode toggle ───────────────────────────────────────────────────────────
  modeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
    alignItems: 'center',
  },
  modeButtonActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  modeButtonText: { fontSize: 14, color: '#666', fontWeight: '600' },
  modeButtonTextActive: { color: '#4ade80', fontWeight: 'bold' },

  // ── Card Balance ──────────────────────────────────────────────────────────
  balanceCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  balanceTitle: { fontSize: 14, color: '#a0a0a0', fontWeight: '600' },
  balanceEditBtn: { fontSize: 13, color: '#60a5fa', fontWeight: '600' },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#4ade80', marginBottom: 4 },
  balanceSubtext: { fontSize: 11, color: '#666', marginBottom: 12 },
  depositButton: { backgroundColor: '#4ade80', padding: 10, borderRadius: 8, alignItems: 'center' },
  depositButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },

  // ── Estimate mode ─────────────────────────────────────────────────────────
  estimateBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  estimateLabel: { fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  estimateValue: { fontSize: 28, fontWeight: 'bold', color: '#4ade80', marginBottom: 4 },
  estimateSubtext: { fontSize: 13, color: '#a0a0a0', marginBottom: 12 },
  estimateNote: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18, marginTop: 8 },

  // ── Manual mode summary ───────────────────────────────────────────────────
  summaryBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  summaryCol: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  summaryVsEstimate: { fontSize: 12, color: '#a0a0a0', textAlign: 'center', marginTop: 8 },

  // ── Section ───────────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  addButton: { backgroundColor: '#4ade80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 13 },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyCard: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#666', marginBottom: 4 },
  emptySubtext: { fontSize: 12, color: '#444', textAlign: 'center' },

  // ── Expense list ──────────────────────────────────────────────────────────
  expenseList: { maxHeight: 400 },
  dateGroup: { marginBottom: 16 },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f3e',
    marginBottom: 8,
  },
  dateLabel: { fontSize: 14, fontWeight: 'bold', color: '#a0a0a0' },
  dateTotalLabel: { fontSize: 13, color: '#4ade80', fontWeight: '600' },

  expenseCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  expenseEmoji: { fontSize: 20 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  expenseCategory: { fontSize: 11, color: '#666' },
  expenseNotes: { fontSize: 11, color: '#a0a0a0', fontStyle: 'italic', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  deleteBtn: { fontSize: 16, color: '#ff4444', padding: 2 },
  deleteButtonContainer: { padding: 4 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#4ade80', marginBottom: 18 },

  label: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 6, marginTop: 14 },
  helperText: { fontSize: 13, color: '#666', marginBottom: 6 },
  modalInput: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 2, borderColor: '#2a2f3e' },

  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 14, borderWidth: 2, borderColor: '#2a2f3e' },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 6 },
  input: { flex: 1, fontSize: 20, color: '#fff', paddingVertical: 14 },

  // category grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  categoryPillActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  categoryEmoji: { fontSize: 16 },
  categoryText: { fontSize: 12, color: '#666' },
  categoryTextActive: { color: '#4ade80', fontWeight: 'bold' },

  // ── Account picker ──────────────────────────────────────────────────────
  accountPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  accountPickerRowActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  accountPickerName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  accountPickerInstitution: { fontSize: 12, color: '#666', marginTop: 2 },
  accountPickerBalance: { fontSize: 16, fontWeight: 'bold', color: '#4ade80' },

  // buttons
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 16 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { color: '#a0a0a0', fontSize: 16 },
  modalAddBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  modalBtnDisabled: { opacity: 0.4 },
  modalAddText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
});
