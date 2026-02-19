// app/onboarding/debts.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Debt } from '../../src/types';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function DebtsScreen() {
  const router = useRouter();
  const debts = useStore((state) => state.debts);
  const addDebt = useStore((state) => state.addDebt);
  const removeDebt = useStore((state) => state.removeDebt);
  
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');

  const handleAddDebt = () => {
    if (!name || !totalAmount || !monthlyPayment) return;
    
    const newDebt: Debt = {
      id: Date.now().toString(),
      name,
      lender: lender || 'Various',
      totalAmount: parseFloat(totalAmount),
      remainingAmount: parseFloat(totalAmount),
      monthlyPayment: parseFloat(monthlyPayment),
      interestRate: interestRate ? parseFloat(interestRate) : undefined,
      startDate: new Date().toISOString(),
    };
    
    addDebt(newDebt);
    
    // Reset form
    setName('');
    setLender('');
    setTotalAmount('');
    setMonthlyPayment('');
    setInterestRate('');
    setShowAddModal(false);
  };

  const handleDeleteDebt = (id: string) => {
    removeDebt(id);
  };

  const calculateMonthlyTotal = () => {
    return debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
  };

  const calculateTotalDebt = () => {
    return debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  };

  const handleContinue = () => {
    router.push('/onboarding/reveal');
  };

  const handleSkip = () => {
    router.push('/onboarding/reveal');
  };

  return (
    <View style={styles.container}>
      <ResponsiveContainer>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 4 of 4</Text>
        
        <Text style={styles.title}>Your Debts</Text>
        <Text style={styles.subtitle}>Track debt payments that affect your freedom</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Only add debts with monthly payments (credit cards, loans, mortgages). The monthly payment goes into your obligations calculation.
          </Text>
        </View>

        {/* Debts List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Debts</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {debts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No debts tracked</Text>
              <Text style={styles.emptySubtext}>
                Add credit cards, student loans, car loans, etc.
              </Text>
            </View>
          ) : (
            <>
              {debts.map((debt) => (
                <View key={debt.id} style={styles.debtCard}>
                  <View style={styles.debtHeader}>
                    <View>
                      <Text style={styles.debtName}>{debt.name}</Text>
                      <Text style={styles.debtLender}>{debt.lender}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteDebt(debt.id)}
                    >
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.debtDetails}>
                    <View style={styles.debtDetail}>
                      <Text style={styles.debtDetailLabel}>Remaining</Text>
                      <Text style={styles.debtDetailValue}>${debt.remainingAmount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.debtDetail}>
                      <Text style={styles.debtDetailLabel}>Monthly Payment</Text>
                      <Text style={styles.debtPayment}>${debt.monthlyPayment.toFixed(0)}/mo</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Total Summary */}
        {debts.length > 0 && (
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total Debt</Text>
                <Text style={styles.totalDebt}>${calculateTotalDebt().toLocaleString()}</Text>
              </View>
              <View>
                <Text style={styles.totalLabel}>Monthly Payments</Text>
                <Text style={styles.totalPayment}>${calculateMonthlyTotal().toLocaleString()}/mo</Text>
              </View>
            </View>
          </View>
        )}
        </ScrollView>
        </ResponsiveContainer>

      <View style={styles.buttonContainer}>
        {debts.length === 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.button, debts.length === 0 && styles.buttonSecondary]} 
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Add Debt Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add Debt</Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Credit Card, Student Loan"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Lender</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Chase, Discover"
                placeholderTextColor="#666"
                value={lender}
                onChangeText={setLender}
              />

              <Text style={styles.label}>Total Amount Owed</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                />
              </View>

              <Text style={styles.label}>Monthly Payment</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={monthlyPayment}
                  onChangeText={setMonthlyPayment}
                />
                <Text style={styles.period}>/month</Text>
              </View>

              <Text style={styles.label}>Interest Rate (optional)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={interestRate}
                  onChangeText={setInterestRate}
                />
                <Text style={styles.percent}>%</Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setName('');
                    setLender('');
                    setTotalAmount('');
                    setMonthlyPayment('');
                    setInterestRate('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalAddButton, (!name || !totalAmount || !monthlyPayment) && styles.modalAddButtonDisabled]}
                  onPress={handleAddDebt}
                  disabled={!name || !totalAmount || !monthlyPayment}
                >
                  <Text style={styles.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  progress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    // marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4c430',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  debtCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  debtName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  debtLender: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  debtDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debtDetail: {
    flex: 1,
  },
  debtDetailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  debtDetailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  debtPayment: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  totalBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ff6b6b',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  totalDebt: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalPayment: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b6b',
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#0a0e1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#a0a0a0',
  },
  button: {
    flex: 1,
    backgroundColor: '#f4c430',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    flex: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0e1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  currencySymbol: {
    fontSize: 20,
    color: '#ff6b6b',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#ffffff',
    paddingVertical: 16,
  },
  period: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  percent: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  modalAddButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
  },
  modalAddButtonDisabled: {
    opacity: 0.5,
  },
  modalAddText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
