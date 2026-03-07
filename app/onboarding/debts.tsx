// app/onboarding/debts.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Debt } from '../../src/types';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { S, T } from '../../src/styles/onboarding';
import KingMeFooter from '../../src/components/KingMeFooter';

export default function DebtsScreen() {
  const router = useRouter();
  const debts = useStore((state) => state.debts);
  const addDebt = useStore((state) => state.addDebt);
  const removeDebt = useStore((state) => state.removeDebt);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');

  const handleAddDebt = () => {
    if (!name || !totalAmount || !monthlyPayment) return;
    const newDebt: Debt = {
      id: Date.now().toString(), name, lender: lender || 'Various',
      totalAmount: parseFloat(totalAmount), remainingAmount: parseFloat(totalAmount),
      monthlyPayment: parseFloat(monthlyPayment),
      interestRate: interestRate ? parseFloat(interestRate) : undefined,
      startDate: new Date().toISOString(),
    };
    addDebt(newDebt);
    setName(''); setLender(''); setTotalAmount(''); setMonthlyPayment('');
    setInterestRate(''); setShowAddModal(false);
  };

  const calculateMonthlyTotal = () => debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const calculateTotalDebt = () => debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const handleContinue = () => router.push('/onboarding/reveal');
  const handleSkip = () => router.push('/onboarding/reveal');

  return (
    <View style={S.container}>
      <ResponsiveContainer>
        <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          <Text style={S.progress}>Step 4 of 4</Text>
          <Text style={S.titleRed}>Your Debts</Text>
          <Text style={S.subtitle}>Track debt payments that affect your freedom</Text>

          <View style={S.infoBoxRed}>
            <Text style={S.infoText}>
              💡 Only add debts with monthly payments (credit cards, loans, mortgages). The monthly payment goes into your obligations calculation.
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
                    <View>
                      <Text style={st.debtName}>{debt.name}</Text>
                      <Text style={st.debtLender}>{debt.lender}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeDebt(debt.id)}>
                      <Text style={S.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={st.debtDetails}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.detailLabel}>Remaining</Text>
                      <Text style={st.detailValue}>${debt.remainingAmount.toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.detailLabel}>Monthly Payment</Text>
                      <Text style={st.debtPayment}>${debt.monthlyPayment.toFixed(0)}/mo</Text>
                    </View>
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

          <KingMeFooter />
        </ScrollView>
      </ResponsiveContainer>

      <View style={S.buttonContainer}>
        <TouchableOpacity style={S.skipButton} onPress={handleSkip}>
          <Text style={S.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.button} onPress={handleContinue}>
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalContent}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={S.modalTitleRed}>Add Debt</Text>

              <Text style={S.label}>Name</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Credit Card, Student Loan"
                placeholderTextColor={T.textDim} value={name} onChangeText={setName} />

              <Text style={S.label}>Lender</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Chase, Discover"
                placeholderTextColor={T.textDim} value={lender} onChangeText={setLender} />

              <Text style={S.label}>Total Amount Owed</Text>
              <View style={S.inputContainer}>
                <Text style={[S.currencySymbol, { color: T.red }]}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={totalAmount} onChangeText={setTotalAmount} />
              </View>

              <Text style={S.label}>Monthly Payment</Text>
              <View style={S.inputContainer}>
                <Text style={[S.currencySymbol, { color: T.red }]}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={monthlyPayment} onChangeText={setMonthlyPayment} />
                <Text style={S.period}>/month</Text>
              </View>

              <Text style={S.label}>Interest Rate (optional)</Text>
              <View style={S.inputContainer}>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={interestRate} onChangeText={setInterestRate} />
                <Text style={S.percent}>%</Text>
              </View>

              <View style={S.modalButtons}>
                <TouchableOpacity style={S.modalCancelButton}
                  onPress={() => { setShowAddModal(false); setName(''); setLender(''); setTotalAmount(''); setMonthlyPayment(''); setInterestRate(''); }}>
                  <Text style={S.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalAddButtonRed, (!name || !totalAmount || !monthlyPayment) && S.modalAddButtonDisabled]}
                  onPress={handleAddDebt} disabled={!name || !totalAmount || !monthlyPayment}>
                  <Text style={S.modalAddTextLight}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
