// app/onboarding/obligations.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Obligation, BankAccount } from '../../src/types';

function AccountPicker({ bankAccounts, value, onChange }: { bankAccounts: BankAccount[]; value: string; onChange: (id: string) => void }) {
  return (
    <>
      <Text style={styles.label}>Which account pays this?</Text>
      {bankAccounts.length === 0 ? (
        <Text style={styles.noAccountsText}>⚠️ No bank accounts added yet</Text>
      ) : (
        <View style={styles.accountsList}>
          <TouchableOpacity
            style={[styles.accountOption, value === '' && styles.accountOptionSelected]}
            onPress={() => onChange('')}
          >
            <Text style={[styles.accountOptionText, value === '' && styles.accountOptionTextSelected]}>
              Not assigned
            </Text>
            {value === '' && <Text style={styles.accountOptionCheck}>✓</Text>}
          </TouchableOpacity>

          {bankAccounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={[styles.accountOption, value === account.id && styles.accountOptionSelected]}
              onPress={() => onChange(account.id)}
            >
              <View>
                <Text style={[styles.accountOptionText, value === account.id && styles.accountOptionTextSelected]}>
                  {account.name}
                </Text>
                <Text style={styles.accountOptionSub}>{account.institution} · ${account.currentBalance.toLocaleString()}</Text>
              </View>
              {value === account.id && <Text style={styles.accountOptionCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

export default function ObligationsScreen() {
  const router = useRouter();
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addObligation = useStore((state) => state.addObligation);
  const removeObligation = useStore((state) => state.removeObligation);
  
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [modalBankAccountId, setModalBankAccountId] = useState('');
  const [dailyAllowance, setDailyAllowance] = useState('');
  const [dailyBankAccountId, setDailyBankAccountId] = useState('');

  const handleAddObligation = () => {
    if (!name || !amount) return;
    
    const newObligation: Obligation = {
      id: Date.now().toString(),
      name,
      payee: payee || 'Various',
      amount: parseFloat(amount),
      category: 'other',
      isRecurring: true,
      ...(modalBankAccountId && { bankAccountId: modalBankAccountId }),
    };
    
    addObligation(newObligation);
    
    // Reset form
    setName('');
    setPayee('');
    setAmount('');
    setFrequency('monthly');
    setModalBankAccountId('');
    setShowAddModal(false);
  };

  const handleDeleteObligation = (id: string) => {
    removeObligation(id);
  };

  const calculateMonthlyTotal = () => {
    let total = 0;
    obligations.forEach(o => {
      if (o.frequency === 'monthly') {
        total += o.amount;
      } else if (o.frequency === 'weekly') {
        total += o.amount * 4.33; // Average weeks per month
      } else if (o.frequency === 'yearly') {
        total += o.amount / 12;
      }
    });
    
    // Add daily allowance
    if (dailyAllowance) {
      total += parseFloat(dailyAllowance) * 30;
    }
    
    return total;
  };

  const handleContinue = () => {
    // Add daily allowance as an obligation
    if (dailyAllowance) {
      const dailyObligation: Obligation = {
        id: 'daily-allowance',
        name: 'Daily Living Allowance',
        payee: 'Various',
        amount: parseFloat(dailyAllowance) * 30, // Convert to monthly
        category: 'daily_living',
        isRecurring: true,
        ...(dailyBankAccountId && { bankAccountId: dailyBankAccountId }),
      };
      // Check if it already exists
      const exists = obligations.find(o => o.id === 'daily-allowance');
      if (!exists) {
        addObligation(dailyObligation);
      }
    }
    
    router.push('/onboarding/cashflow-check');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 3 of 4</Text>
        
        <Text style={styles.title}>Your Obligations</Text>
        <Text style={styles.subtitle}>Track everything you pay for each month</Text>

        {/* Daily Living Allowance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Living Allowance</Text>
          <Text style={styles.helperText}>
            Groceries, gas, restaurants, small purchases
          </Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={dailyAllowance}
              onChangeText={setDailyAllowance}
            />
            <Text style={styles.period}>/day</Text>
          </View>
          {dailyAllowance && (
            <Text style={styles.calculation}>
              = ${(parseFloat(dailyAllowance) * 30).toFixed(0)}/month
            </Text>
          )}
          {dailyAllowance && (
            <AccountPicker bankAccounts={bankAccounts} value={dailyBankAccountId} onChange={setDailyBankAccountId} />
          )}
        </View>

        {/* Obligations List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fixed Obligations</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {obligations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No obligations yet</Text>
              <Text style={styles.emptySubtext}>
                Tap "+ Add" to add rent, utilities, subscriptions, etc.
              </Text>
            </View>
          ) : (
            <>
              {obligations.map((obligation) => (
                <View key={obligation.id} style={styles.obligationCard}>
                  <View style={styles.obligationHeader}>
                    <Text style={styles.obligationName}>{obligation.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteObligation(obligation.id)}
                    >
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.obligationPayee}>Paid to: {obligation.payee}</Text>
                  {obligation.bankAccountId ? (
                    <Text style={styles.obligationAccount}>
                      💳 From {bankAccounts.find(a => a.id === obligation.bankAccountId)?.name || 'Unknown'}
                    </Text>
                  ) : (
                    <Text style={styles.obligationAccountUnset}>No account assigned</Text>
                  )}
                  <Text style={styles.obligationAmount}>
                    ${obligation.amount.toFixed(2)}/{obligation.frequency || 'monthly'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Total Summary */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total Monthly Obligations</Text>
          <Text style={styles.totalAmount}>
            ${calculateMonthlyTotal().toFixed(2)}/month
          </Text>
          <Text style={styles.totalYearly}>
            ${(calculateMonthlyTotal() * 12).toFixed(2)}/year
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Later you can review each obligation and see how removing them would impact your freedom score.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Add Obligation Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Obligation</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Rent, Netflix, Car Payment"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Who are you paying?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., XYZ Financial, Comcast, Landlord"
              placeholderTextColor="#666"
              value={payee}
              onChangeText={setPayee}
            />

            <Text style={styles.label}>Amount</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.frequencyContainer}>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  frequency === 'monthly' && styles.frequencyButtonActive,
                ]}
                onPress={() => setFrequency('monthly')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    frequency === 'monthly' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  frequency === 'weekly' && styles.frequencyButtonActive,
                ]}
                onPress={() => setFrequency('weekly')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    frequency === 'weekly' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Weekly
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  frequency === 'yearly' && styles.frequencyButtonActive,
                ]}
                onPress={() => setFrequency('yearly')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    frequency === 'yearly' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Yearly
                </Text>
              </TouchableOpacity>
            </View>

            <AccountPicker bankAccounts={bankAccounts} value={modalBankAccountId} onChange={setModalBankAccountId} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setName('');
                  setPayee('');
                  setAmount('');
                  setFrequency('monthly');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalAddButton, (!name || !amount) && styles.modalAddButtonDisabled]}
                onPress={handleAddObligation}
                disabled={!name || !amount}
              >
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
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
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
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
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
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
    color: '#f4c430',
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
  calculation: {
    fontSize: 14,
    color: '#f4c430',
    marginTop: 8,
    textAlign: 'right',
  },
  addButton: {
    backgroundColor: '#f4c430',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0a0e1a',
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
  obligationCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  obligationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  obligationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  obligationPayee: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  obligationAmount: {
    fontSize: 16,
    color: '#f4c430',
    fontWeight: 'bold',
  },
  totalBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  totalLabel: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  totalYearly: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#0a0e1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  button: {
    backgroundColor: '#f4c430',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
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
    color: '#f4c430',
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
  frequencyContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  frequencyButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  frequencyButtonActive: {
    borderColor: '#f4c430',
    backgroundColor: '#f4c43020',
  },
  frequencyButtonText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  frequencyButtonTextActive: {
    color: '#f4c430',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
    backgroundColor: '#f4c430',
    alignItems: 'center',
  },
  modalAddButtonDisabled: {
    opacity: 0.5,
  },
  modalAddText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Account picker
  noAccountsText: {
    fontSize: 14,
    color: '#ff6b6b',
    padding: 12,
    backgroundColor: '#2a1a1e',
    borderRadius: 8,
    marginTop: 4,
  },
  accountsList: {
    gap: 8,
    marginTop: 4,
  },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  accountOptionSelected: {
    borderColor: '#f4c430',
    backgroundColor: '#2a2f1e',
  },
  accountOptionText: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 2,
  },
  accountOptionTextSelected: {
    color: '#f4c430',
    fontWeight: 'bold',
  },
  accountOptionSub: {
    fontSize: 12,
    color: '#666',
  },
  accountOptionCheck: {
    fontSize: 18,
    color: '#f4c430',
    fontWeight: 'bold',
  },
  // Obligation account labels
  obligationAccount: {
    fontSize: 13,
    color: '#4ade80',
    marginBottom: 2,
  },
  obligationAccountUnset: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 2,
  },
});
