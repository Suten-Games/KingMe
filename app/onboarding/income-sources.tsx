// app/onboarding/income-sources.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import type { IncomeSource } from '../../src/types';
import { S, T } from '../../src/styles/onboarding';

export default function IncomeSourcesScreen() {
  const router = useRouter();
  const incomeSources = useStore((state) => state.income.sources || []);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const addIncomeSource = useStore((state) => state.addIncomeSource);
  const removeIncomeSource = useStore((state) => state.removeIncomeSource);

  const [showAddModal, setShowAddModal] = useState(false);
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
      id: Date.now().toString(), source: sourceType, name: sourceName,
      amount: parseFloat(amount), frequency, bankAccountId: selectedAccountId,
      ...(frequency === 'twice_monthly' && { dayOfMonth1: parseInt(dayOfMonth1), dayOfMonth2: parseInt(dayOfMonth2) }),
    };
    addIncomeSource(newSource);
    setSourceName(''); setAmount(''); setSourceType('salary'); setFrequency('monthly');
    setSelectedAccountId(''); setDayOfMonth1('1'); setDayOfMonth2('15'); setShowAddModal(false);
  };

  const handleContinue = () => router.push('/onboarding/obligations');
  const handleSkip = () => router.push('/onboarding/obligations');

  const calculateMonthlyIncome = (source: IncomeSource) => {
    switch (source.frequency) {
      case 'weekly': return (source.amount * 52) / 12;
      case 'biweekly': return (source.amount * 26) / 12;
      case 'twice_monthly': return source.amount * 2;
      case 'monthly': return source.amount;
      case 'quarterly': return source.amount / 3;
      default: return source.amount;
    }
  };

  const getTotalMonthlyIncome = () => incomeSources.reduce((sum, s) => sum + calculateMonthlyIncome(s), 0);
  const getAccountName = (id: string) => bankAccounts.find(a => a.id === id)?.name || 'Unknown Account';

  const resetForm = () => {
    setSourceName(''); setAmount(''); setSourceType('salary'); setFrequency('monthly');
    setSelectedAccountId(''); setDayOfMonth1('1'); setDayOfMonth2('15'); setShowAddModal(false);
  };

  return (
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 2 of 5</Text>
        <Text style={S.titleGreen}>Your Income</Text>
        <Text style={S.subtitle}>How do you get paid?</Text>

        <View style={S.infoBoxGreen}>
          <Text style={S.infoText}>
            💡 Add all income sources: salary, freelance work, side hustles. We'll track which account each payment goes into.
          </Text>
        </View>

        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Income Sources</Text>
            <TouchableOpacity style={S.addButtonGreen} onPress={() => setShowAddModal(true)}>
              <Text style={S.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {incomeSources.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No income sources yet</Text>
              <Text style={S.emptySubtext}>Add your salary or other income</Text>
            </View>
          ) : (
            incomeSources.map((source) => (
              <View key={source.id} style={S.cardGreen}>
                <View style={st.sourceHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.sourceName}>{source.name}</Text>
                    <Text style={st.sourceAccount}>→ {getAccountName(source.bankAccountId)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeIncomeSource(source.id)}>
                    <Text style={S.deleteButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={st.sourceDetails}>
                  <View>
                    <Text style={st.sourceAmount}>${source.amount.toLocaleString()}</Text>
                    <Text style={st.sourceFrequency}>per {source.frequency}</Text>
                  </View>
                  <Text style={st.sourceMonthly}>${calculateMonthlyIncome(source).toFixed(0)}/mo</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {incomeSources.length > 0 && (
          <View style={S.totalBoxGreen}>
            <Text style={S.totalLabel}>Total Monthly Income</Text>
            <Text style={S.totalAmountGreen}>${getTotalMonthlyIncome().toLocaleString()}/month</Text>
            <Text style={S.totalYearly}>${(getTotalMonthlyIncome() * 12).toLocaleString()}/year</Text>
          </View>
        )}
      </ScrollView>

      <View style={S.buttonContainer}>
        {incomeSources.length === 0 && (
          <TouchableOpacity style={S.skipButton} onPress={handleSkip}>
            <Text style={S.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[S.buttonGreen, incomeSources.length === 0 && S.buttonSecondary]}
          onPress={handleContinue} disabled={incomeSources.length === 0}
        >
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={S.modalOverlay}>
          <View style={[S.modalContent, { maxHeight: '90%' }]}>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={S.modalTitleGreen}>Add Income Source</Text>

              <Text style={S.label}>Income Type</Text>
              <View style={S.typeButtons}>
                {([['salary', '💼 Salary'], ['freelance', '💻 Freelance']] as const).map(([k, label]) => (
                  <TouchableOpacity key={k} style={[S.typeButton, sourceType === k && S.typeButtonActiveGreen]}
                    onPress={() => setSourceType(k as any)}>
                    <Text style={[S.typeButtonText, sourceType === k && S.typeButtonTextActiveGreen]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[S.typeButtons, { marginTop: 8 }]}>
                {([['business', '🏢 Business'], ['other', '💰 Other']] as const).map(([k, label]) => (
                  <TouchableOpacity key={k} style={[S.typeButton, sourceType === k && S.typeButtonActiveGreen]}
                    onPress={() => setSourceType(k as any)}>
                    <Text style={[S.typeButtonText, sourceType === k && S.typeButtonTextActiveGreen]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.label}>Name/Description</Text>
              <TextInput style={S.modalInput} placeholder="e.g., Acme Corp Salary, Upwork"
                placeholderTextColor={T.textDim} value={sourceName} onChangeText={setSourceName} />

              <Text style={S.label}>Amount per Payment</Text>
              <Text style={S.helperText}>Enter what actually hits your bank — after taxes, 401k, and other pre-tax deductions.</Text>
              <View style={S.inputContainer}>
                <Text style={S.currencySymbolGreen}>$</Text>
                <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
                  keyboardType="numeric" value={amount} onChangeText={setAmount} />
              </View>

              <Text style={S.label}>How Often?</Text>
              <View style={S.typeButtons}>
                {(['weekly', 'biweekly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[S.typeButton, frequency === f && S.typeButtonActiveGreen]}
                    onPress={() => setFrequency(f)}>
                    <Text style={[S.typeButtonText, frequency === f && S.typeButtonTextActiveGreen]}>
                      {f === 'biweekly' ? 'Bi-weekly' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[S.typeButtons, { marginTop: 8 }]}>
                {(['twice_monthly', 'monthly', 'quarterly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[S.typeButton, frequency === f && S.typeButtonActiveGreen]}
                    onPress={() => setFrequency(f)}>
                    <Text style={[S.typeButtonText, frequency === f && S.typeButtonTextActiveGreen]}>
                      {f === 'twice_monthly' ? '2x/mo' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {frequency === 'twice_monthly' && (
                <View style={st.twiceMonthlyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.label}>1st Pay Day</Text>
                    <View style={S.inputContainer}>
                      <TextInput style={S.input} placeholder="1" placeholderTextColor={T.textDim}
                        keyboardType="numeric" value={dayOfMonth1} onChangeText={setDayOfMonth1} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.label}>2nd Pay Day</Text>
                    <View style={S.inputContainer}>
                      <TextInput style={S.input} placeholder="15" placeholderTextColor={T.textDim}
                        keyboardType="numeric" value={dayOfMonth2} onChangeText={setDayOfMonth2} />
                    </View>
                  </View>
                </View>
              )}

              <Text style={S.label}>Which account does this go into?</Text>
              {bankAccounts.length === 0 ? (
                <Text style={S.noAccountsText}>⚠️ No bank accounts added yet</Text>
              ) : (
                <View style={S.accountsList}>
                  {bankAccounts.map((account) => (
                    <TouchableOpacity key={account.id}
                      style={[S.accountOption, selectedAccountId === account.id && S.accountOptionSelectedGreen]}
                      onPress={() => setSelectedAccountId(account.id)}>
                      <View style={S.accountOptionContent}>
                        <Text style={[S.accountOptionText, selectedAccountId === account.id && S.accountOptionTextSelectedGreen]}>
                          {account.name}
                        </Text>
                        {account.isPrimaryIncome && <Text style={S.accountOptionBadge}>Primary</Text>}
                      </View>
                      {selectedAccountId === account.id && <Text style={[S.accountOptionCheck, { color: T.green }]}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={S.modalButtons}>
                <TouchableOpacity style={S.modalCancelButton} onPress={resetForm}>
                  <Text style={S.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalAddButtonGreen, (!sourceName || !amount || !selectedAccountId) && S.modalAddButtonDisabled]}
                  onPress={handleAddSource} disabled={!sourceName || !amount || !selectedAccountId}>
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
  sourceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sourceName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary, marginBottom: 4 },
  sourceAccount: { fontSize: 14, color: T.green },
  sourceDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sourceAmount: { fontSize: 20, fontWeight: 'bold', color: T.textPrimary },
  sourceFrequency: { fontSize: 12, color: T.textMuted },
  sourceMonthly: { fontSize: 16, color: T.green, fontWeight: '600' },
  twiceMonthlyRow: { flexDirection: 'row', gap: 12 },
});
