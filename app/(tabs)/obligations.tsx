// app/(tabs)/obligations.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../../src/store/useStore';
import type { Obligation } from '../../src/types';
import PaymentStatusBanner from '../../src/components/PaymentStatusBanner';
import PaymentCalendar from '../../src/components/PaymentCalendar';
import DayPaymentsList from '../../src/components/DayPaymentsList';
import { getPaymentEventsForMonth, getMonthlyPaymentStatus } from '../../src/utils/paymentCalendar';
import { T } from '../../src/theme';

export default function ObligationsScreen() {
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const debts = useStore((state) => state.debts);
  const addObligation = useStore((state) => state.addObligation);
  const removeObligation = useStore((state) => state.removeObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const toggleObligationPaid = useStore((state) => state.toggleObligationPaid);
  const toggleDebtPaid = useStore((state) => state.toggleDebtPaid);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const paymentStatus = useMemo(() =>
    getMonthlyPaymentStatus(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );
  const paymentEvents = useMemo(() =>
    getPaymentEventsForMonth(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );

  const handleTogglePaid = (eventId: string, isPaid: boolean) => {
    if (eventId.startsWith('obl_')) toggleObligationPaid(eventId.replace('obl_', ''));
    else if (eventId.startsWith('debt_')) toggleDebtPaid(eventId.replace('debt_', ''));
  };

  const handleAddObligation = () => {
    if (!name || !amount) return;
    addObligation({
      id: Date.now().toString(), name, payee: payee || 'Various',
      amount: parseFloat(amount), category: 'other', isRecurring: true,
      dueDate: dueDate ? parseInt(dueDate) : 1,
      bankAccountId: accountId || undefined,
    });
    setName(''); setPayee(''); setAmount(''); setAccountId(''); setDueDate('');
    setShowAddModal(false);
  };

  const handleEditObligation = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setName(obligation.name); setPayee(obligation.payee);
    setAmount(obligation.amount.toString());
    setAccountId(obligation.bankAccountId || '');
    setDueDate(obligation.dueDate?.toString() || '');
    setShowAddModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingObligation || !name || !amount) return;
    updateObligation(editingObligation.id, {
      name, payee: payee || 'Various', amount: parseFloat(amount),
      bankAccountId: accountId || undefined,
      dueDate: dueDate ? parseInt(dueDate) : undefined,
    });
    setEditingObligation(null); setName(''); setPayee(''); setAmount('');
    setAccountId(''); setDueDate(''); setShowAddModal(false);
  };

  const handleCloseModal = () => {
    setEditingObligation(null); setName(''); setPayee(''); setAmount('');
    setAccountId(''); setDueDate(''); setShowAddModal(false);
  };

  const monthlyTotal = obligations.reduce((sum, o) => sum + o.amount, 0);

  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView}>
        <PaymentStatusBanner status={paymentStatus} onShowCalendar={() => setShowCalendar(true)} />

        {/* Summary */}
        <LinearGradient colors={T.gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryBox, { borderColor: T.gold + '80' }]}>
          <Text style={s.summaryLabel}>Total Monthly Obligations</Text>
          <Text style={s.summaryValue}>${monthlyTotal.toLocaleString()}</Text>
          <Text style={s.summaryYearly}>${(monthlyTotal * 12).toLocaleString()}/year</Text>
        </LinearGradient>

        {/* List */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your Obligations</Text>
            <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={s.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {obligations.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>No obligations yet</Text>
              <Text style={s.emptySubtext}>Tap "+ Add" to add your first obligation</Text>
            </View>
          ) : (
            obligations.slice().sort((a, b) => (a.dueDate ?? 999) - (b.dueDate ?? 999)).map((ob) => (
              <TouchableOpacity key={ob.id} onPress={() => handleEditObligation(ob)}>
                <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.obligationCard, { borderColor: T.gold + '40' }]}>
                  <View style={s.obligationHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.obligationName}>{ob.name}</Text>
                      <Text style={s.obligationPayee}>Paid to: {ob.payee}</Text>
                      {ob.bankAccountId ? (
                        <Text style={s.obligationAccount}>
                          💳 {bankAccounts.find(a => a.id === ob.bankAccountId)?.name || 'Unknown'}
                        </Text>
                      ) : (
                        <Text style={s.obligationWarning}>⚠️ No account assigned</Text>
                      )}
                      {ob.dueDate && (
                        <Text style={s.obligationDueDate}>
                          📅 Due on the {ob.dueDate}{getDaySuffix(ob.dueDate)} of each month
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeObligation(ob.id); }} style={{ padding: 4 }}>
                      <Text style={s.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.obligationAmount}>${ob.amount.toFixed(2)}/month</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}

          {/* Calendar Modal */}
          <Modal visible={showCalendar} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <PaymentCalendar year={currentYear} month={currentMonth} events={paymentEvents}
                  onDayPress={(day) => { setSelectedDay(day); setShowCalendar(false); }} />
                <TouchableOpacity onPress={() => setShowCalendar(false)}><Text style={{ color: T.gold, fontFamily: T.fontSemiBold, textAlign: 'center', padding: 16 }}>Close</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Day Detail Modal */}
          <Modal visible={selectedDay !== null} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              {selectedDay !== null && (
                <DayPaymentsList day={selectedDay} month={currentMonth} year={currentYear}
                  events={paymentEvents.filter(e => e.dueDate.getDate() === selectedDay)}
                  onTogglePaid={handleTogglePaid} onClose={() => setSelectedDay(null)} />
              )}
            </View>
          </Modal>
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>{editingObligation ? 'Edit Obligation' : 'Add Obligation'}</Text>

              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Rent, Netflix, Car Payment" placeholderTextColor="#555" value={name} onChangeText={setName} />

              <Text style={s.label}>Who are you paying?</Text>
              <TextInput style={s.modalInput} placeholder="e.g., XYZ Financial, Landlord" placeholderTextColor="#555" value={payee} onChangeText={setPayee} />

              <Text style={s.label}>Monthly Amount</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                <Text style={s.period}>/month</Text>
              </View>

              <Text style={s.label}>Due Day of Month (Optional)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., 1, 15" placeholderTextColor="#555" keyboardType="numeric" value={dueDate} onChangeText={setDueDate} />

              <Text style={s.label}>Paid From (Optional)</Text>
              {bankAccounts.length === 0 ? (
                <Text style={s.noAccountsWarning}>⚠️ No bank accounts added yet</Text>
              ) : (
                <View style={s.accountList}>
                  {bankAccounts.map((acct) => (
                    <TouchableOpacity key={acct.id}
                      style={[s.accountOption, accountId === acct.id && s.accountOptionActive]}
                      onPress={() => setAccountId(acct.id)}>
                      <View>
                        <Text style={[s.accountOptionName, accountId === acct.id && s.accountOptionNameActive]}>{acct.name}</Text>
                        <Text style={s.accountOptionSub}>{acct.institution} · ${(acct.currentBalance ?? 0).toLocaleString()}</Text>
                      </View>
                      {accountId === acct.id && <Text style={s.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={handleCloseModal}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalAddButton, (!name || !amount) && s.modalAddButtonDisabled]}
                  onPress={editingObligation ? handleSaveEdit : handleAddObligation}
                  disabled={!name || !amount}>
                  <Text style={s.modalAddText}>{editingObligation ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },

  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  summaryLabel: { fontSize: 12, color: T.gold + 'cc', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: T.fontBold },
  summaryValue: { fontSize: 34, color: T.gold, fontFamily: T.fontExtraBold },
  summaryYearly: { fontSize: 14, color: T.textMuted, marginTop: 6, fontFamily: T.fontRegular },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: T.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  obligationCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.gold },
  obligationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  obligationName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  obligationPayee: { fontSize: 14, color: T.textSecondary, fontFamily: T.fontRegular },
  obligationAccount: { fontSize: 12, color: T.green, marginTop: 4, fontFamily: T.fontMedium },
  obligationWarning: { fontSize: 12, color: T.orange, marginTop: 4, fontFamily: T.fontMedium },
  obligationDueDate: { fontSize: 12, color: T.blue, marginTop: 4, fontFamily: T.fontMedium },
  obligationAmount: { fontSize: 18, color: T.gold, fontFamily: T.fontExtraBold },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 24, color: T.gold, marginBottom: 20, fontFamily: T.fontExtraBold },
  label: { fontSize: 15, color: T.textPrimary, marginBottom: 8, marginTop: 14, fontFamily: T.fontBold },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, fontFamily: T.fontRegular },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, color: T.gold, marginRight: 8, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16, fontFamily: T.fontSemiBold },
  period: { fontSize: 14, color: T.textMuted, marginLeft: 8, fontFamily: T.fontRegular },
  helperText: { fontSize: 13, color: T.textMuted, marginBottom: 8, marginTop: -4, fontFamily: T.fontRegular },

  noAccountsWarning: { fontSize: 14, color: T.orange, padding: 12, backgroundColor: '#2a1a1e', borderRadius: T.radius.sm, marginTop: 4, fontFamily: T.fontMedium },
  accountList: { gap: 8, marginBottom: 8 },
  accountOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  accountOptionActive: { borderColor: T.gold, backgroundColor: '#2a2620' },
  accountOptionName: { fontSize: 15, color: T.textPrimary, marginBottom: 2, fontFamily: T.fontMedium },
  accountOptionNameActive: { color: T.gold, fontFamily: T.fontBold },
  accountOptionSub: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },
  checkMark: { fontSize: 18, color: T.gold, fontFamily: T.fontBold },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalAddButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.gold, alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },
});
