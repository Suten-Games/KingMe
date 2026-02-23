// app/onboarding/obligations.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Obligation, BankAccount } from '../../src/types';
import { S, T } from '../../src/styles/onboarding';

function AccountPicker({ bankAccounts, value, onChange }: { bankAccounts: BankAccount[]; value: string; onChange: (id: string) => void }) {
  return (
    <>
      <Text style={S.label}>Which account pays this?</Text>
      {bankAccounts.length === 0 ? (
        <Text style={S.noAccountsText}>⚠️ No bank accounts added yet</Text>
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

export default function ObligationsScreen() {
  const router = useRouter();
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addObligation = useStore((state) => state.addObligation);
  const removeObligation = useStore((state) => state.removeObligation);

  const [showAddModal, setShowAddModal] = useState(false);
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
      id: Date.now().toString(), name, payee: payee || 'Various',
      amount: parseFloat(amount), category: 'other', isRecurring: true,
      ...(modalBankAccountId && { bankAccountId: modalBankAccountId }),
    };
    addObligation(newObligation);
    setName(''); setPayee(''); setAmount(''); setFrequency('monthly');
    setModalBankAccountId(''); setShowAddModal(false);
  };

  const calculateMonthlyTotal = () => {
    let total = 0;
    obligations.forEach(o => {
      if (o.frequency === 'monthly') total += o.amount;
      else if (o.frequency === 'weekly') total += o.amount * 4.33;
      else if (o.frequency === 'yearly') total += o.amount / 12;
    });
    if (dailyAllowance) total += parseFloat(dailyAllowance) * 30;
    return total;
  };

  const handleContinue = () => {
    if (dailyAllowance) {
      const dailyObligation: Obligation = {
        id: 'daily-allowance', name: 'Daily Living Allowance', payee: 'Various',
        amount: parseFloat(dailyAllowance) * 30, category: 'daily_living', isRecurring: true,
        ...(dailyBankAccountId && { bankAccountId: dailyBankAccountId }),
      };
      if (!obligations.find(o => o.id === 'daily-allowance')) addObligation(dailyObligation);
    }
    router.push('/onboarding/cashflow-check');
  };

  return (
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 3 of 4</Text>
        <Text style={S.title}>Your Obligations</Text>
        <Text style={S.subtitle}>Track everything you pay for each month</Text>

        {/* Daily Living Allowance */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Daily Living Allowance</Text>
          <Text style={S.helperText}>Groceries, gas, restaurants, small purchases</Text>
          <View style={S.inputContainer}>
            <Text style={S.currencySymbol}>$</Text>
            <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
              keyboardType="numeric" value={dailyAllowance} onChangeText={setDailyAllowance} />
            <Text style={S.period}>/day</Text>
          </View>
          {dailyAllowance ? (
            <Text style={st.calculation}>= ${(parseFloat(dailyAllowance) * 30).toFixed(0)}/month</Text>
          ) : null}
          {dailyAllowance ? (
            <AccountPicker bankAccounts={bankAccounts} value={dailyBankAccountId} onChange={setDailyBankAccountId} />
          ) : null}
        </View>

        {/* Obligations List */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Fixed Obligations</Text>
            <TouchableOpacity style={S.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={S.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {obligations.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No obligations yet</Text>
              <Text style={S.emptySubtext}>Tap "+ Add" to add rent, utilities, subscriptions, etc.</Text>
            </View>
          ) : (
            obligations.map((obligation) => (
              <View key={obligation.id} style={S.cardGold}>
                <View style={st.obligationHeader}>
                  <Text style={st.obligationName}>{obligation.name}</Text>
                  <TouchableOpacity onPress={() => removeObligation(obligation.id)}>
                    <Text style={S.deleteButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={st.obligationPayee}>Paid to: {obligation.payee}</Text>
                {obligation.bankAccountId ? (
                  <Text style={st.obligationAccount}>
                    💳 From {bankAccounts.find(a => a.id === obligation.bankAccountId)?.name || 'Unknown'}
                  </Text>
                ) : (
                  <Text style={st.obligationAccountUnset}>No account assigned</Text>
                )}
                <Text style={st.obligationAmount}>${obligation.amount.toFixed(2)}/{obligation.frequency || 'monthly'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={S.totalBox}>
          <Text style={S.totalLabel}>Total Monthly Obligations</Text>
          <Text style={S.totalAmount}>${calculateMonthlyTotal().toFixed(2)}/month</Text>
          <Text style={S.totalYearly}>${(calculateMonthlyTotal() * 12).toFixed(2)}/year</Text>
        </View>

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            💡 Later you can review each obligation and see how removing them would impact your freedom score.
          </Text>
        </View>
      </ScrollView>

      <View style={S.buttonContainerSingle}>
        <TouchableOpacity style={S.button} onPress={handleContinue}>
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>Add Obligation</Text>

            <Text style={S.label}>Name</Text>
            <TextInput style={S.modalInput} placeholder="e.g., Rent, Netflix, Car Payment"
              placeholderTextColor={T.textDim} value={name} onChangeText={setName} />

            <Text style={S.label}>Who are you paying?</Text>
            <TextInput style={S.modalInput} placeholder="e.g., XYZ Financial, Comcast, Landlord"
              placeholderTextColor={T.textDim} value={payee} onChangeText={setPayee} />

            <Text style={S.label}>Amount</Text>
            <View style={S.inputContainer}>
              <Text style={S.currencySymbol}>$</Text>
              <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                keyboardType="numeric" value={amount} onChangeText={setAmount} />
            </View>

            <Text style={S.label}>Frequency</Text>
            <View style={st.frequencyContainer}>
              {(['monthly', 'weekly', 'yearly'] as const).map((f) => (
                <TouchableOpacity key={f}
                  style={[st.frequencyButton, frequency === f && st.frequencyButtonActive]}
                  onPress={() => setFrequency(f)}>
                  <Text style={[st.frequencyButtonText, frequency === f && st.frequencyButtonTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <AccountPicker bankAccounts={bankAccounts} value={modalBankAccountId} onChange={setModalBankAccountId} />

            <View style={S.modalButtons}>
              <TouchableOpacity style={S.modalCancelButton}
                onPress={() => { setShowAddModal(false); setName(''); setPayee(''); setAmount(''); setModalBankAccountId(''); }}>
                <Text style={S.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalAddButton, (!name || !amount) && S.modalAddButtonDisabled]}
                onPress={handleAddObligation} disabled={!name || !amount}>
                <Text style={S.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  calculation: { fontSize: 14, color: T.gold, marginTop: 8, textAlign: 'right' },
  obligationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  obligationName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary },
  obligationPayee: { fontSize: 14, color: T.textSecondary, marginBottom: 4 },
  obligationAccount: { fontSize: 13, color: T.green, marginBottom: 2 },
  obligationAccountUnset: { fontSize: 13, color: T.textMuted, fontStyle: 'italic', marginBottom: 2 },
  obligationAmount: { fontSize: 16, color: T.gold, fontWeight: 'bold' },
  frequencyContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  frequencyButton: {
    flex: 1, padding: 12, borderRadius: T.radius.sm,
    borderWidth: 1.5, borderColor: T.border, alignItems: 'center',
  },
  frequencyButtonActive: { borderColor: T.gold, backgroundColor: `${T.gold}20` },
  frequencyButtonText: { color: T.textSecondary, fontSize: 14 },
  frequencyButtonTextActive: { color: T.gold, fontWeight: 'bold' },
});
