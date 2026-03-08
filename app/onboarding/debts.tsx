// app/onboarding/debts.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Debt, BankAccount } from '../../src/types';
import { S, T } from '../../src/styles/onboarding';
import KingMeFooter from '../../src/components/KingMeFooter';

function AccountPicker({ bankAccounts, value, onChange }: { bankAccounts: BankAccount[]; value: string; onChange: (id: string) => void }) {
  return (
    <>
      <Text style={S.label}>Which account pays this?</Text>
      {bankAccounts.length === 0 ? (
        <Text style={S.noAccountsText}>No bank accounts added yet</Text>
      ) : (
        <View style={S.accountsList}>
          <TouchableOpacity
            style={[S.accountOption, value === '' && S.accountOptionSelected]}
            onPress={() => onChange('')}
          >
            <Text style={[S.accountOptionText, value === '' && S.accountOptionTextSelected]}>Not assigned</Text>
            {value === '' && <Text style={S.accountOptionCheck}>✓</Text>}
          </TouchableOpacity>
          {bankAccounts.map((account) => (
            <TouchableOpacity key={account.id}
              style={[S.accountOption, value === account.id && S.accountOptionSelected]}
              onPress={() => onChange(account.id)}>
              <View>
                <Text style={[S.accountOptionText, value === account.id && S.accountOptionTextSelected]}>
                  {account.name}
                </Text>
                <Text style={S.accountOptionSub}>{account.institution} · ${account.currentBalance.toLocaleString()}</Text>
              </View>
              {value === account.id && <Text style={S.accountOptionCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

export default function DebtsScreen() {
  const router = useRouter();
  const debts = useStore((state) => state.debts);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addDebt = useStore((state) => state.addDebt);
  const removeDebt = useStore((state) => state.removeDebt);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [balance, setBalance] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  const resetForm = () => {
    setName(''); setPayee(''); setBalance(''); setMonthlyPayment('');
    setMinimumPayment(''); setInterestRate(''); setDueDate(''); setBankAccountId('');
  };

  const handleAddDebt = () => {
    if (!name || !balance || !monthlyPayment) return;
    const bal = parseFloat(balance);
    const monthly = parseFloat(monthlyPayment);
    const minimum = minimumPayment ? parseFloat(minimumPayment) : monthly;
    const rate = interestRate ? parseFloat(interestRate) / 100 : 0; // User enters %, store as decimal
    const newDebt: Debt = {
      id: Date.now().toString(),
      name,
      payee: payee || undefined,
      principal: bal,
      balance: bal,
      interestRate: rate,
      monthlyPayment: monthly,
      minimumPayment: minimum,
      dueDate: dueDate ? parseInt(dueDate) : 1,
      bankAccountId: bankAccountId || undefined,
    };
    addDebt(newDebt);
    resetForm();
    setShowAddModal(false);
  };

  const calculateMonthlyTotal = () => debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const calculateTotalDebt = () => debts.reduce((sum, d) => sum + (d.balance ?? d.principal), 0);

  return (
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 4 of 4</Text>
        <Text style={S.titleRed}>Your Debts</Text>
        <Text style={S.subtitle}>Track debt payments that affect your freedom</Text>

        <View style={S.infoBoxRed}>
          <Text style={S.infoText}>
            Add credit cards, student loans, car loans, mortgages — anything with a balance and payment.
          </Text>
        </View>

        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Debts</Text>
            <TouchableOpacity style={S.addButtonRed} onPress={() => setShowAddModal(true)}>
              <Text style={S.modalAddTextLight}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {debts.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No debts tracked</Text>
              <Text style={S.emptySubtext}>Add credit cards, student loans, car loans, etc.</Text>
            </View>
          ) : (
            debts.map((debt) => (
              <View key={debt.id} style={S.cardRed}>
                <View style={st.debtHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.debtName}>{debt.name}</Text>
                    {debt.payee && <Text style={st.debtLender}>{debt.payee}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeDebt(debt.id)}>
                    <Text style={S.deleteButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={st.debtDetails}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.detailLabel}>Balance</Text>
                    <Text style={st.detailValue}>${(debt.balance ?? debt.principal).toLocaleString()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.detailLabel}>Payment</Text>
                    <Text style={st.debtPayment}>${debt.monthlyPayment.toFixed(0)}/mo</Text>
                  </View>
                  {debt.interestRate > 0 && (
                    <View style={{ flex: 1 }}>
                      <Text style={st.detailLabel}>Rate</Text>
                      <Text style={st.detailValue}>{(debt.interestRate * 100).toFixed(1)}%</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {debts.length > 0 && (
          <View style={S.totalBoxRed}>
            <View style={st.totalRow}>
              <View>
                <Text style={S.totalLabel}>Total Debt</Text>
                <Text style={st.totalDebt}>${calculateTotalDebt().toLocaleString()}</Text>
              </View>
              <View>
                <Text style={S.totalLabel}>Monthly Payments</Text>
                <Text style={S.totalAmountRed}>${calculateMonthlyTotal().toLocaleString()}/mo</Text>
              </View>
            </View>
          </View>
        )}

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            Debt payments are factored into your freedom score. Paying off debts frees up cash flow and accelerates your path to freedom.
          </Text>
        </View>

        <KingMeFooter />
      </ScrollView>

      <View style={S.buttonContainer}>
        <TouchableOpacity style={S.skipButton} onPress={() => router.push('/onboarding/reveal')}>
          <Text style={S.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.button} onPress={() => router.push('/onboarding/reveal')}>
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={S.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={S.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={S.modalTitleRed}>Add Debt</Text>

              <Text style={S.label}>Name</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Credit Card, Student Loan"
                placeholderTextColor={T.textDim} value={name} onChangeText={setName} />

              <Text style={S.label}>Lender (optional)</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Chase, Discover, SoFi"
                placeholderTextColor={T.textDim} value={payee} onChangeText={setPayee} />

              <Text style={S.label}>Current Balance</Text>
              <View style={S.inputContainer}>
                <Text style={[S.currencySymbol, { color: T.red }]}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={balance} onChangeText={setBalance} />
              </View>

              <Text style={S.label}>Monthly Payment</Text>
              <View style={S.inputContainer}>
                <Text style={[S.currencySymbol, { color: T.red }]}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={monthlyPayment} onChangeText={setMonthlyPayment} />
                <Text style={S.period}>/month</Text>
              </View>

              <Text style={S.label}>Minimum Payment (optional)</Text>
              <View style={S.inputContainer}>
                <Text style={[S.currencySymbol, { color: T.red }]}>$</Text>
                <TextInput style={S.input} placeholder={monthlyPayment || '0'} placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={minimumPayment} onChangeText={setMinimumPayment} />
                <Text style={S.period}>/month</Text>
              </View>

              <Text style={S.label}>Interest Rate (optional)</Text>
              <View style={S.inputContainer}>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={interestRate} onChangeText={setInterestRate} />
                <Text style={S.percent}>%</Text>
              </View>

              <Text style={S.label}>Due Date (day of month, optional)</Text>
              <View style={S.inputContainer}>
                <TextInput style={S.input} placeholder="1" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={dueDate} onChangeText={setDueDate} />
              </View>

              <AccountPicker bankAccounts={bankAccounts} value={bankAccountId} onChange={setBankAccountId} />

              <View style={S.modalButtons}>
                <TouchableOpacity style={S.modalCancelButton}
                  onPress={() => { resetForm(); setShowAddModal(false); }}>
                  <Text style={S.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalAddButtonRed, (!name || !balance || !monthlyPayment) && S.modalAddButtonDisabled]}
                  onPress={handleAddDebt} disabled={!name || !balance || !monthlyPayment}>
                  <Text style={S.modalAddTextLight}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  debtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  debtName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary, marginBottom: 4 },
  debtLender: { fontSize: 14, color: T.textSecondary },
  debtDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 14, color: T.textPrimary, fontWeight: '600' },
  debtPayment: { fontSize: 14, color: T.red, fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalDebt: { fontSize: 20, fontWeight: 'bold', color: T.textPrimary },
});
