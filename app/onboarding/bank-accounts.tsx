// app/onboarding/bank-accounts.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { BankAccount } from '../../src/types';
import { parseNumber } from '../../src/utils/parseNumber';
import { S, T } from '../../src/styles/onboarding';
import KingMeFooter from '../../src/components/KingMeFooter';

export default function BankAccountsScreen() {
  const router = useRouter();
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addBankAccount = useStore((state) => state.addBankAccount);
  const removeBankAccount = useStore((state) => state.removeBankAccount);
  const updateBankAccount = useStore((state) => state.updateBankAccount);

  const [showAddModal, setShowAddModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'investment'>('checking');
  const [currentBalance, setCurrentBalance] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const handleAddAccount = () => {
    if (!accountName || !currentBalance) return;
    if (isPrimary) {
      bankAccounts.forEach(account => {
        if (account.isPrimaryIncome) updateBankAccount(account.id, { isPrimaryIncome: false });
      });
    }
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      name: accountName,
      institution: institution || 'Unknown',
      type: accountType,
      currentBalance: parseNumber(currentBalance),
      isPrimaryIncome: isPrimary || bankAccounts.length === 0,
    };
    addBankAccount(newAccount);
    setAccountName(''); setInstitution(''); setAccountType('checking');
    setCurrentBalance(''); setIsPrimary(false); setShowAddModal(false);
  };

  const handleContinue = () => router.push('/onboarding/income-sources');
  const handleSkip = () => router.push('/onboarding/income-sources');
  const getTotalBalance = () => bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 1 of 5</Text>
        <Text style={S.titleGreen}>Your Bank Accounts</Text>
        <Text style={S.subtitle}>Let's start by adding where your money lives</Text>

        <View style={S.infoBoxGreen}>
          <Text style={S.infoText}>
            💡 Add your checking and savings accounts. We'll use this to track cash flow and make sure you can cover your bills.
          </Text>
        </View>

        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Accounts</Text>
            <TouchableOpacity style={S.addButtonGreen} onPress={() => setShowAddModal(true)}>
              <Text style={S.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No accounts yet</Text>
              <Text style={S.emptySubtext}>Add your checking account to get started</Text>
            </View>
          ) : (
            bankAccounts.map((account) => (
              <View key={account.id} style={S.cardGreen}>
                <View style={st.accountHeader}>
                  <View>
                    <Text style={st.accountName}>{account.name}</Text>
                    <Text style={st.accountInstitution}>{account.institution}</Text>
                    {account.isPrimaryIncome && (
                      <Text style={st.primaryLabel}>💰 Primary (Paycheck)</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeBankAccount(account.id)}>
                    <Text style={S.deleteButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={st.accountBalance}>${(account.currentBalance ?? 0).toLocaleString()}</Text>
                <Text style={st.accountType}>{account.type.charAt(0).toUpperCase() + account.type.slice(1)}</Text>
              </View>
            ))
          )}
        </View>

        {bankAccounts.length > 0 && (
          <View style={S.totalBoxGreen}>
            <Text style={S.totalLabel}>Total Balance</Text>
            <Text style={S.totalAmountGreen}>${getTotalBalance().toLocaleString()}</Text>
          </View>
        )}

        <KingMeFooter />
      </ScrollView>

      <View style={S.buttonContainer}>
        <TouchableOpacity style={S.skipButton} onPress={handleSkip}>
          <Text style={S.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={S.buttonGreen}
          onPress={handleContinue}
        >
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalContent}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={S.modalTitleGreen}>Add Bank Account</Text>

              <Text style={S.label}>Account Nickname</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Chase Checking, Ally Savings"
                placeholderTextColor={T.textDim} value={accountName} onChangeText={setAccountName} />

              <Text style={S.label}>Bank/Institution</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Chase, Bank of America"
                placeholderTextColor={T.textDim} value={institution} onChangeText={setInstitution} />

              <Text style={S.label}>Account Type</Text>
              <View style={S.typeButtons}>
                {(['checking', 'savings', 'investment'] as const).map((t) => (
                  <TouchableOpacity key={t}
                    style={[S.typeButton, accountType === t && S.typeButtonActiveGreen]}
                    onPress={() => setAccountType(t)}
                  >
                    <Text style={[S.typeButtonText, accountType === t && S.typeButtonTextActiveGreen]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.label}>Current Balance</Text>
              <View style={S.inputContainer}>
                <Text style={S.currencySymbolGreen}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={currentBalance} onChangeText={setCurrentBalance} />
              </View>

              <TouchableOpacity style={S.checkboxRow} onPress={() => setIsPrimary(!isPrimary)}>
                <View style={[S.checkbox, isPrimary && S.checkboxChecked]}>
                  {isPrimary && <Text style={S.checkmark}>✓</Text>}
                </View>
                <Text style={S.checkboxLabel}>This is where I get my paycheck</Text>
              </TouchableOpacity>

              <View style={S.modalButtons}>
                <TouchableOpacity style={S.modalCancelButton}
                  onPress={() => { setShowAddModal(false); setAccountName(''); setInstitution(''); setCurrentBalance(''); setIsPrimary(false); }}>
                  <Text style={S.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalAddButtonGreen, (!accountName || !currentBalance) && S.modalAddButtonDisabled]}
                  onPress={handleAddAccount} disabled={!accountName || !currentBalance}>
                  <Text style={S.modalAddText}>Add</Text>
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
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  accountName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary, marginBottom: 4 },
  accountInstitution: { fontSize: 14, color: T.textSecondary, marginBottom: 4 },
  primaryLabel: { fontSize: 12, color: T.green, fontWeight: '600' },
  accountBalance: { fontSize: 24, fontWeight: 'bold', color: T.green, marginBottom: 4 },
  accountType: { fontSize: 14, color: T.textMuted },
});
