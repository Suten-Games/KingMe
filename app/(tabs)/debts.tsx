// app/(tabs)/debts.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../../src/store/useStore';
import type { Debt, BankAccount } from '../../src/types';
import { T } from '../../src/theme';

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

export default function DebtsScreen() {
  const debts = useStore((state) => state.debts);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addDebt = useStore((state) => state.addDebt);
  const removeDebt = useStore((state) => state.removeDebt);
  const updateDebt = useStore((state) => state.updateDebt);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrincipal, setAddPrincipal] = useState('');
  const [addMonthlyPayment, setAddMonthlyPayment] = useState('');
  const [addInterestRate, setAddInterestRate] = useState('');
  const [addBankAccountId, setAddBankAccountId] = useState('');

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editBankAccountId, setEditBankAccountId] = useState('');

  const handleAddDebt = () => {
    if (!addName || !addPrincipal || !addMonthlyPayment) return;
    addDebt({
      id: Date.now().toString(), name: addName,
      principal: parseFloat(addPrincipal), monthlyPayment: parseFloat(addMonthlyPayment),
      minimumPayment: parseFloat(addMonthlyPayment),
      interestRate: addInterestRate ? parseFloat(addInterestRate) / 100 : 0,
      ...(addBankAccountId && { bankAccountId: addBankAccountId }),
    });
    setAddName(''); setAddPrincipal(''); setAddMonthlyPayment(''); setAddInterestRate(''); setAddBankAccountId('');
    setShowAddModal(false);
  };

  const openEdit = (debt: Debt) => {
    setSelectedDebt(debt); setEditName(debt.name);
    setEditPrincipal(debt.principal.toString()); setEditMonthlyPayment(debt.monthlyPayment.toString());
    setEditInterestRate(debt.interestRate ? (debt.interestRate * 100).toString() : '');
    setEditBankAccountId(debt.bankAccountId || '');
  };

  const handleSaveEdit = () => {
    if (!selectedDebt) return;
    updateDebt(selectedDebt.id, {
      name: editName, principal: parseFloat(editPrincipal) || selectedDebt.principal,
      monthlyPayment: parseFloat(editMonthlyPayment) || selectedDebt.monthlyPayment,
      minimumPayment: parseFloat(editMonthlyPayment) || selectedDebt.minimumPayment,
      interestRate: editInterestRate ? parseFloat(editInterestRate) / 100 : 0,
      bankAccountId: editBankAccountId || undefined,
    });
    setSelectedDebt(null);
  };

  const normalize = (debt: any): Debt => ({
    id: debt.id, name: debt.name,
    principal: debt.principal ?? debt.remainingAmount ?? debt.totalAmount ?? 0,
    monthlyPayment: debt.monthlyPayment ?? 0,
    minimumPayment: debt.minimumPayment ?? debt.monthlyPayment ?? 0,
    interestRate: debt.interestRate != null ? (debt.interestRate > 1 ? debt.interestRate / 100 : debt.interestRate) : 0,
    bankAccountId: debt.bankAccountId,
  });

  const normalizedDebts = debts.map(normalize);
  const getAccountName = (id?: string) => id ? bankAccounts.find((a) => a.id === id)?.name || null : null;
  const monthlyTotal = normalizedDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalDebt = normalizedDebts.reduce((sum, d) => sum + d.principal, 0);
  const unassignedCount = normalizedDebts.filter((d) => !d.bankAccountId).length;

  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView}>
        {/* Summary */}
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
        </LinearGradient>

        {unassignedCount > 0 && (
          <View style={s.unassignedBanner}>
            <Text style={s.unassignedBannerText}>⚠️ {unassignedCount} debt{unassignedCount > 1 ? 's' : ''} not assigned to a bank account</Text>
          </View>
        )}

        {/* List */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your Debts</Text>
            <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={s.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {normalizedDebts.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>No debts — nice!</Text>
              <Text style={s.emptySubtext}>Add debts to track payoff and see freedom impact</Text>
            </View>
          ) : (
            normalizedDebts.map((debt) => (
              <TouchableOpacity key={debt.id} onPress={() => openEdit(debt)}>
                <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.debtCard, { borderColor: T.redBright + '40' }]}>
                  <View style={s.debtHeader}>
                    <View style={s.debtHeaderLeft}>
                      <Text style={s.debtName}>{debt.name}</Text>
                      {debt.bankAccountId ? (
                        <Text style={s.debtAccount}>💳 {getAccountName(debt.bankAccountId)}</Text>
                      ) : (
                        <Text style={s.debtAccountUnset}>⚠️ No account assigned</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeDebt(debt.id); }}>
                      <Text style={s.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
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
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView>
              <Text style={s.modalTitle}>Add Debt</Text>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Student Loan, Car Payment" placeholderTextColor="#555" value={addName} onChangeText={setAddName} />
              <Text style={s.label}>Total Amount Owed</Text>
              <View style={s.inputContainer}><Text style={s.currencySymbol}>$</Text><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={addPrincipal} onChangeText={setAddPrincipal} /></View>
              <Text style={s.label}>Monthly Payment</Text>
              <View style={s.inputContainer}><Text style={s.currencySymbol}>$</Text><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={addMonthlyPayment} onChangeText={setAddMonthlyPayment} /><Text style={s.period}>/mo</Text></View>
              <Text style={s.label}>Interest Rate (optional)</Text>
              <View style={s.inputContainer}><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={addInterestRate} onChangeText={setAddInterestRate} /><Text style={s.percent}>%</Text></View>
              <AccountPicker bankAccounts={bankAccounts} value={addBankAccountId} onChange={setAddBankAccountId} />
              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={() => setShowAddModal(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[s.modalAddButton, (!addName || !addPrincipal || !addMonthlyPayment) && s.modalAddButtonDisabled]} onPress={handleAddDebt} disabled={!addName || !addPrincipal || !addMonthlyPayment}><Text style={s.modalAddText}>Add</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={selectedDebt !== null} animationType="slide" transparent onRequestClose={() => setSelectedDebt(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView>
              <Text style={s.modalTitle}>Edit Debt</Text>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="Debt name" placeholderTextColor="#555" value={editName} onChangeText={setEditName} />
              <Text style={s.label}>Total Amount Owed</Text>
              <View style={s.inputContainer}><Text style={s.currencySymbol}>$</Text><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={editPrincipal} onChangeText={setEditPrincipal} /></View>
              <Text style={s.label}>Monthly Payment</Text>
              <View style={s.inputContainer}><Text style={s.currencySymbol}>$</Text><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={editMonthlyPayment} onChangeText={setEditMonthlyPayment} /><Text style={s.period}>/mo</Text></View>
              <Text style={s.label}>Interest Rate (optional)</Text>
              <View style={s.inputContainer}><TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={editInterestRate} onChangeText={setEditInterestRate} /><Text style={s.percent}>%</Text></View>
              <AccountPicker bankAccounts={bankAccounts} value={editBankAccountId} onChange={setEditBankAccountId} />
              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={() => setSelectedDebt(null)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.modalSaveButton} onPress={handleSaveEdit}><Text style={s.modalSaveText}>Save</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },

  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontFamily: T.fontBold },
  summaryDebt: { fontSize: 26, color: T.textPrimary, fontFamily: T.fontExtraBold },
  summaryPayment: { fontSize: 26, color: T.redBright, fontFamily: T.fontExtraBold },

  unassignedBanner: { backgroundColor: '#2a1a1e', borderRadius: T.radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: T.redBright + '44' },
  unassignedBannerText: { fontSize: 14, color: T.orange, textAlign: 'center', fontFamily: T.fontMedium },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: T.redBright, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.textPrimary, fontFamily: T.fontBold, fontSize: 14 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  debtCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.redBright },
  debtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  debtHeaderLeft: { flex: 1, marginRight: 12 },
  debtName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  debtAccount: { fontSize: 13, color: T.green, fontFamily: T.fontMedium },
  debtAccountUnset: { fontSize: 13, color: T.orange, fontStyle: 'italic', fontFamily: T.fontMedium },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },
  debtDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  debtDetail: { flex: 1 },
  debtDetailLabel: { fontSize: 11, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: T.fontBold },
  debtDetailValue: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontSemiBold },
  debtPayment: { fontSize: 15, color: T.redBright, fontFamily: T.fontBold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '85%' },
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
});
