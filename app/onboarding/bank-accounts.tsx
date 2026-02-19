// app/onboarding/bank-accounts.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { BankAccount } from '../../src/types';

export default function BankAccountsScreen() {
  const router = useRouter();
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addBankAccount = useStore((state) => state.addBankAccount);
  const removeBankAccount = useStore((state) => state.removeBankAccount);
  const updateBankAccount = useStore((state) => state.updateBankAccount);
  
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [accountName, setAccountName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'investment'>('checking');
  const [currentBalance, setCurrentBalance] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const handleAddAccount = () => {
    if (!accountName || !currentBalance) return;
    
    // If this is marked as primary, unmark others
    if (isPrimary) {
      bankAccounts.forEach(account => {
        if (account.isPrimaryIncome) {
          updateBankAccount(account.id, { isPrimaryIncome: false });
        }
      });
    }
    
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      name: accountName,
      institution: institution || 'Unknown',
      type: accountType,
      currentBalance: parseFloat(currentBalance),
      isPrimaryIncome: isPrimary || bankAccounts.length === 0, // First account is primary by default
    };
    
    addBankAccount(newAccount);
    
    // Reset form
    setAccountName('');
    setInstitution('');
    setAccountType('checking');
    setCurrentBalance('');
    setIsPrimary(false);
    setShowAddModal(false);
  };

  const handleContinue = () => {
    router.push('/onboarding/income-sources');
  };

  const handleSkip = () => {
    router.push('/onboarding/income-sources');
  };

  const getTotalBalance = () => {
    return bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 1 of 5</Text>
        
        <Text style={styles.title}>Your Bank Accounts</Text>
        <Text style={styles.subtitle}>Let's start by adding where your money lives</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Add your checking and savings accounts. We'll use this to track cash flow and make sure you can cover your bills.
          </Text>
        </View>

        {/* Accounts List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accounts</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No accounts yet</Text>
              <Text style={styles.emptySubtext}>
                Add your checking account to get started
              </Text>
            </View>
          ) : (
            <>
              {bankAccounts.map((account) => (
                <View key={account.id} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <View>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountInstitution}>{account.institution}</Text>
                      {account.isPrimaryIncome && (
                        <Text style={styles.primaryLabel}>💰 Primary (Paycheck)</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => removeBankAccount(account.id)}
                    >
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.accountBalance}>
                    ${(account.currentBalance ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.accountType}>
                    {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Total */}
        {bankAccounts.length > 0 && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Balance</Text>
            <Text style={styles.totalAmount}>${getTotalBalance().toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        {bankAccounts.length === 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.button, bankAccounts.length === 0 && styles.buttonSecondary]} 
          onPress={handleContinue}
          disabled={bankAccounts.length === 0}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Add Account Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add Bank Account</Text>

              <Text style={styles.label}>Account Nickname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Chase Checking, Ally Savings"
                placeholderTextColor="#666"
                value={accountName}
                onChangeText={setAccountName}
              />

              <Text style={styles.label}>Bank/Institution</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Chase, Bank of America"
                placeholderTextColor="#666"
                value={institution}
                onChangeText={setInstitution}
              />

              <Text style={styles.label}>Account Type</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, accountType === 'checking' && styles.typeButtonActive]}
                  onPress={() => setAccountType('checking')}
                >
                  <Text style={[styles.typeButtonText, accountType === 'checking' && styles.typeButtonTextActive]}>
                    Checking
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, accountType === 'savings' && styles.typeButtonActive]}
                  onPress={() => setAccountType('savings')}
                >
                  <Text style={[styles.typeButtonText, accountType === 'savings' && styles.typeButtonTextActive]}>
                    Savings
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, accountType === 'investment' && styles.typeButtonActive]}
                  onPress={() => setAccountType('investment')}
                >
                  <Text style={[styles.typeButtonText, accountType === 'investment' && styles.typeButtonTextActive]}>
                    Investment
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Current Balance</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={currentBalance}
                  onChangeText={setCurrentBalance}
                />
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsPrimary(!isPrimary)}
              >
                <View style={[styles.checkbox, isPrimary && styles.checkboxChecked]}>
                  {isPrimary && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>This is where I get my paycheck</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setAccountName('');
                    setInstitution('');
                    setCurrentBalance('');
                    setIsPrimary(false);
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalAddButton, (!accountName || !currentBalance) && styles.modalAddButtonDisabled]}
                  onPress={handleAddAccount}
                  disabled={!accountName || !currentBalance}
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
  accountCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  accountInstitution: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  primaryLabel: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  accountBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 4,
  },
  accountType: {
    fontSize: 14,
    color: '#666',
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
    maxHeight: '85%',
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
    fontSize: 14,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  checkmark: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#a0a0a0',
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
