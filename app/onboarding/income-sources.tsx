// app/onboarding/income-sources.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { IncomeSource } from '../../src/types';

export default function IncomeSourcesScreen() {
  const router = useRouter();
  const incomeSources = useStore((state) => state.income.sources || []);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addIncomeSource = useStore((state) => state.addIncomeSource);
  const removeIncomeSource = useStore((state) => state.removeIncomeSource);
  
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<'salary' | 'freelance' | 'business' | 'other'>('salary');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly' | 'quarterly'>('monthly');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dayOfMonth1, setDayOfMonth1] = useState('1');
  const [dayOfMonth2, setDayOfMonth2] = useState('15');

  const handleAddSource = () => {
    if (!sourceName || !amount || !selectedAccountId) return;
    
    const newSource: IncomeSource = {
      id: Date.now().toString(),
      source: sourceType,
      name: sourceName,
      amount: parseFloat(amount),
      frequency,
      bankAccountId: selectedAccountId,
      ...(frequency === 'twice_monthly' && {
        dayOfMonth1: parseInt(dayOfMonth1),
        dayOfMonth2: parseInt(dayOfMonth2),
      }),
    };
    
    addIncomeSource(newSource);
    
    // Reset form
    setSourceName('');
    setAmount('');
    setSourceType('salary');
    setFrequency('monthly');
    setSelectedAccountId('');
    setDayOfMonth1('1');
    setDayOfMonth2('15');
    setShowAddModal(false);
  };

  const handleContinue = () => {
    router.push('/onboarding/obligations');
  };

  const handleSkip = () => {
    router.push('/onboarding/obligations');
  };

  const calculateMonthlyIncome = (source: IncomeSource) => {
    switch (source.frequency) {
      case 'weekly':
        return (source.amount * 52) / 12;
      case 'biweekly':
        return (source.amount * 26) / 12;
      case 'twice_monthly':
        return source.amount * 2; // Twice per month
      case 'monthly':
        return source.amount;
      case 'quarterly':
        return source.amount / 3;
      default:
        return source.amount;
    }
  };

  const getTotalMonthlyIncome = () => {
    return incomeSources.reduce((sum, source) => sum + calculateMonthlyIncome(source), 0);
  };

  const getAccountName = (accountId: string) => {
    const account = bankAccounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 2 of 5</Text>
        
        <Text style={styles.title}>Your Income</Text>
        <Text style={styles.subtitle}>How do you get paid?</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Add all income sources: salary, freelance work, side hustles. We'll track which account each payment goes into.
          </Text>
        </View>

        {/* Income Sources List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income Sources</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {incomeSources.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No income sources yet</Text>
              <Text style={styles.emptySubtext}>
                Add your salary or other income
              </Text>
            </View>
          ) : (
            <>
              {incomeSources.map((source) => (
                <View key={source.id} style={styles.sourceCard}>
                  <View style={styles.sourceHeader}>
                    <View style={styles.sourceHeaderLeft}>
                      <Text style={styles.sourceName}>{source.name}</Text>
                      <Text style={styles.sourceAccount}>
                        → {getAccountName(source.bankAccountId)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeIncomeSource(source.id)}
                    >
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sourceDetails}>
                    <View>
                      <Text style={styles.sourceAmount}>
                        ${source.amount.toLocaleString()}
                      </Text>
                      <Text style={styles.sourceFrequency}>
                        per {source.frequency}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.sourceMonthly}>
                        ${calculateMonthlyIncome(source).toFixed(0)}/mo
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Total */}
        {incomeSources.length > 0 && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Monthly Income</Text>
            <Text style={styles.totalAmount}>
              ${getTotalMonthlyIncome().toLocaleString()}/month
            </Text>
            <Text style={styles.totalYearly}>
              ${(getTotalMonthlyIncome() * 12).toLocaleString()}/year
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        {incomeSources.length === 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.button, incomeSources.length === 0 && styles.buttonSecondary]} 
          onPress={handleContinue}
          disabled={incomeSources.length === 0}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Add Income Source Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add Income Source</Text>

              <Text style={styles.label}>Income Type</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, sourceType === 'salary' && styles.typeButtonActive]}
                  onPress={() => setSourceType('salary')}
                >
                  <Text style={[styles.typeButtonText, sourceType === 'salary' && styles.typeButtonTextActive]}>
                    💼 Salary
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, sourceType === 'freelance' && styles.typeButtonActive]}
                  onPress={() => setSourceType('freelance')}
                >
                  <Text style={[styles.typeButtonText, sourceType === 'freelance' && styles.typeButtonTextActive]}>
                    💻 Freelance
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.typeButtons, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.typeButton, sourceType === 'business' && styles.typeButtonActive]}
                  onPress={() => setSourceType('business')}
                >
                  <Text style={[styles.typeButtonText, sourceType === 'business' && styles.typeButtonTextActive]}>
                    🏢 Business
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, sourceType === 'other' && styles.typeButtonActive]}
                  onPress={() => setSourceType('other')}
                >
                  <Text style={[styles.typeButtonText, sourceType === 'other' && styles.typeButtonTextActive]}>
                    💰 Other
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Name/Description</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Acme Corp Salary, Upwork"
                placeholderTextColor="#666"
                value={sourceName}
                onChangeText={setSourceName}
              />

              <Text style={styles.label}>Amount per Payment</Text>
              <Text style={styles.helperText}>Enter what actually hits your bank — after taxes, 401k, and other pre-tax deductions.</Text>
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

              <Text style={styles.label}>How Often?</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, frequency === 'weekly' && styles.typeButtonActive]}
                  onPress={() => setFrequency('weekly')}
                >
                  <Text style={[styles.typeButtonText, frequency === 'weekly' && styles.typeButtonTextActive]}>
                    Weekly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, frequency === 'biweekly' && styles.typeButtonActive]}
                  onPress={() => setFrequency('biweekly')}
                >
                  <Text style={[styles.typeButtonText, frequency === 'biweekly' && styles.typeButtonTextActive]}>
                    Biweekly
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.typeButtons, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.typeButton, frequency === 'twice_monthly' && styles.typeButtonActive]}
                  onPress={() => setFrequency('twice_monthly')}
                >
                  <Text style={[styles.typeButtonText, frequency === 'twice_monthly' && styles.typeButtonTextActive]}>
                    2x/Month
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, frequency === 'monthly' && styles.typeButtonActive]}
                  onPress={() => setFrequency('monthly')}
                >
                  <Text style={[styles.typeButtonText, frequency === 'monthly' && styles.typeButtonTextActive]}>
                    Monthly
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.typeButtons, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.typeButton, frequency === 'quarterly' && styles.typeButtonActive]}
                  onPress={() => setFrequency('quarterly')}
                >
                  <Text style={[styles.typeButtonText, frequency === 'quarterly' && styles.typeButtonTextActive]}>
                    Quarterly
                  </Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
              </View>

              {frequency === 'twice_monthly' && (
                <>
                  <Text style={styles.label}>Payment Days (1-31)</Text>
                  <View style={styles.daysRow}>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                      <TextInput
                        style={styles.input}
                        placeholder="1"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={dayOfMonth1}
                        onChangeText={setDayOfMonth1}
                      />
                    </View>
                    <Text style={styles.andText}>and</Text>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                      <TextInput
                        style={styles.input}
                        placeholder="15"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={dayOfMonth2}
                        onChangeText={setDayOfMonth2}
                      />
                    </View>
                  </View>
                  <Text style={styles.helperText}>e.g., 1st and 15th of each month</Text>
                </>
              )}

              <Text style={styles.label}>Which Account Gets Paid?</Text>
              {bankAccounts.length === 0 ? (
                <Text style={styles.noAccountsText}>
                  ⚠️ No bank accounts added yet. Go back and add one.
                </Text>
              ) : (
                <View style={styles.accountsList}>
                  {bankAccounts.map((account) => (
                    <TouchableOpacity
                      key={account.id}
                      style={[
                        styles.accountOption,
                        selectedAccountId === account.id && styles.accountOptionSelected
                      ]}
                      onPress={() => setSelectedAccountId(account.id)}
                    >
                      <View style={styles.accountOptionContent}>
                        <Text style={[
                          styles.accountOptionText,
                          selectedAccountId === account.id && styles.accountOptionTextSelected
                        ]}>
                          {account.name}
                        </Text>
                        {account.isPrimaryIncome && (
                          <Text style={styles.accountOptionBadge}>💰 Primary</Text>
                        )}
                      </View>
                      {selectedAccountId === account.id && (
                        <Text style={styles.accountOptionCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setSourceName('');
                    setAmount('');
                    setSelectedAccountId('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalAddButton,
                    (!sourceName || !amount || !selectedAccountId) && styles.modalAddButtonDisabled
                  ]}
                  onPress={handleAddSource}
                  disabled={!sourceName || !amount || !selectedAccountId}
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
    color: '#4ade80',
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
    borderLeftColor: '#4ade80',
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
    backgroundColor: '#4ade80',
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
  sourceCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sourceHeaderLeft: {
    flex: 1,
  },
  sourceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  sourceAccount: {
    fontSize: 14,
    color: '#4ade80',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  sourceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sourceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sourceFrequency: {
    fontSize: 12,
    color: '#666',
  },
  sourceMonthly: {
    fontSize: 16,
    color: '#4ade80',
    fontWeight: '600',
  },
  totalBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  totalLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  totalYearly: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
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
    backgroundColor: '#4ade80',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    flex: 2,
    opacity: 0.5,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
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
    color: '#4ade80',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#ffffff',
    paddingVertical: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2f1e',
  },
  typeButtonText: {
    fontSize: 13,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  noAccountsText: {
    fontSize: 14,
    color: '#ff6b6b',
    padding: 16,
    backgroundColor: '#2a1a1e',
    borderRadius: 8,
  },
  accountsList: {
    gap: 8,
  },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  accountOptionSelected: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2f1e',
  },
  accountOptionContent: {
    flex: 1,
  },
  accountOptionText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
  },
  accountOptionTextSelected: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  accountOptionBadge: {
    fontSize: 12,
    color: '#4ade80',
  },
  accountOptionCheck: {
    fontSize: 20,
    color: '#4ade80',
    fontWeight: 'bold',
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
    backgroundColor: '#4ade80',
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
});
