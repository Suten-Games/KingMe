// app/onboarding/cashflow-check.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { S, T } from '../../src/styles/onboarding';
import KingMeFooter from '../../src/components/KingMeFooter';

export default function CashFlowCheckScreen() {
  const router = useRouter();
  const bankAccounts = useStore((state) => state.bankAccounts);
  const incomeSources = useStore((state) => state.income.sources || []);
  const obligations = useStore((state) => state.obligations);
  const debts = useStore((state) => state.debts);
  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts);

  const statusColor: Record<string, string> = {
    critical: T.red, struggling: T.orange, stable: T.gold, building: T.green, thriving: T.green,
  };
  const statusIcon: Record<string, string> = {
    critical: '🔴', struggling: '🟠', stable: '🟡', building: '🟢', thriving: '🟢',
  };
  const accountStatusColor: Record<string, string> = { deficit: T.red, tight: T.orange, healthy: T.green };
  const accountStatusLabel: Record<string, string> = { deficit: 'Deficit', tight: 'Tight', healthy: 'Healthy' };

  const handleContinue = () => router.push('/onboarding/assets');

  return (
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 4 of 7</Text>
        <Text style={S.title}>Cash Flow Check</Text>
        <Text style={S.subtitle}>Here's how your money is flowing</Text>

        {/* Overall Health Card */}
        <View style={[st.healthCard, { borderColor: statusColor[cashFlow.healthStatus] }]}>
          <View style={st.healthHeader}>
            <Text style={st.healthIcon}>{statusIcon[cashFlow.healthStatus]}</Text>
            <Text style={[st.healthLabel, { color: statusColor[cashFlow.healthStatus] }]}>
              {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
            </Text>
          </View>
          <Text style={st.healthMessage}>{cashFlow.healthMessage}</Text>
        </View>

        {/* Top-Level Numbers */}
        <View style={st.numbersRow}>
          <View style={st.numberCard}>
            <Text style={st.numberLabel}>Monthly In</Text>
            <Text style={[st.numberValue, { color: T.green }]}>
              ${cashFlow.totalMonthlyIncome.toLocaleString()}
            </Text>
          </View>
          <View style={st.numberCard}>
            <Text style={st.numberLabel}>Monthly Out</Text>
            <Text style={[st.numberValue, { color: T.red }]}>
              ${(cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments).toLocaleString()}
            </Text>
          </View>
          <View style={st.numberCard}>
            <Text style={st.numberLabel}>Net</Text>
            <Text style={[st.numberValue, { color: cashFlow.totalMonthlyNet >= 0 ? T.green : T.red }]}>
              {cashFlow.totalMonthlyNet >= 0 ? '+' : ''}${cashFlow.totalMonthlyNet.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Per-Account Breakdown */}
        <Text style={[S.sectionTitle, { marginBottom: 14 }]}>Account Breakdown</Text>

        {cashFlow.accounts.map((analysis) => (
          <View key={analysis.account.id} style={st.accountCard}>
            <View style={st.accountCardHeader}>
              <View>
                <Text style={st.accountName}>{analysis.account.name}</Text>
                <Text style={st.accountInstitution}>{analysis.account.institution}</Text>
              </View>
              <View style={[st.statusBadge, {
                backgroundColor: accountStatusColor[analysis.status] + '22',
                borderColor: accountStatusColor[analysis.status],
              }]}>
                <Text style={[st.statusBadgeText, { color: accountStatusColor[analysis.status] }]}>
                  {accountStatusLabel[analysis.status]}
                </Text>
              </View>
            </View>

            <Text style={st.accountBalance}>${(analysis.currentBalance ?? 0).toLocaleString()}</Text>

            <View style={st.accountFlow}>
              <View style={st.flowItem}>
                <Text style={st.flowLabel}>In</Text>
                <Text style={[st.flowValue, { color: T.green }]}>${analysis.monthlyIncome.toLocaleString()}/mo</Text>
              </View>
              <View style={st.flowItem}>
                <Text style={st.flowLabel}>Out</Text>
                <Text style={[st.flowValue, { color: T.red }]}>${analysis.monthlyObligations.toLocaleString()}/mo</Text>
              </View>
              <View style={st.flowItem}>
                <Text style={st.flowLabel}>Net</Text>
                <Text style={[st.flowValue, { color: analysis.monthlyNet >= 0 ? T.green : T.red }]}>
                  {analysis.monthlyNet >= 0 ? '+' : ''}${analysis.monthlyNet.toLocaleString()}/mo
                </Text>
              </View>
            </View>

            {analysis.monthlyObligations > 0 && (
              <View style={st.runwaySection}>
                <View style={st.runwayLabelRow}>
                  <Text style={st.runwayLabel}>Runway</Text>
                  <Text style={st.runwayDays}>
                    {analysis.daysOfRunway === Infinity ? '∞' : analysis.daysOfRunway} days
                  </Text>
                </View>
                <View style={st.runwayBarBg}>
                  <View style={[st.runwayBarFill, {
                    width: `${Math.min((analysis.daysOfRunway / 90) * 100, 100)}%`,
                    backgroundColor: analysis.daysOfRunway >= 90 ? T.green : analysis.daysOfRunway >= 30 ? T.orange : T.red,
                  }]} />
                </View>
                <Text style={st.runwayTarget}>Target: 90 days</Text>
              </View>
            )}

            {analysis.warnings.map((warning, i) => (
              <Text key={i} style={[st.warning, { color: analysis.status === 'healthy' ? T.green : accountStatusColor[analysis.status] }]}>
                {analysis.status === 'healthy' ? '✓' : '⚠'} {warning}
              </Text>
            ))}
          </View>
        ))}

        {cashFlow.unassignedObligations.length > 0 && (
          <View style={st.unassignedCard}>
            <Text style={st.unassignedTitle}>⚠️ Unassigned Obligations</Text>
            <Text style={st.unassignedSubtitle}>
              These bills aren't tied to an account yet. Assign them so we can track your cash flow accurately.
            </Text>
            {cashFlow.unassignedObligations.map((o) => (
              <View key={o.id} style={st.unassignedItem}>
                <Text style={st.unassignedName}>{o.name}</Text>
                <Text style={st.unassignedAmount}>${o.amount.toLocaleString()}/mo</Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.recommendationsCard}>
          <Text style={st.recommendationsTitle}>💡 Recommendations</Text>
          {cashFlow.recommendations.map((rec, i) => (
            <Text key={i} style={st.recommendationItem}>{rec}</Text>
          ))}
        </View>

        <KingMeFooter />
      </ScrollView>

      <View style={S.buttonContainer}>
        <TouchableOpacity style={S.skipButton} onPress={() => router.push('/onboarding/assets')}>
          <Text style={S.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.button} onPress={handleContinue}>
          <Text style={S.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  healthCard: { backgroundColor: T.bgCard, borderRadius: T.radius.lg, padding: 20, marginBottom: 20, borderWidth: 2 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  healthIcon: { fontSize: 24 },
  healthLabel: { fontSize: 20, fontWeight: 'bold' },
  healthMessage: { fontSize: 15, color: T.textSecondary, lineHeight: 22 },

  numbersRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  numberCard: { flex: 1, backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, alignItems: 'center' },
  numberLabel: { fontSize: 12, color: T.textMuted, marginBottom: 6 },
  numberValue: { fontSize: 18, fontWeight: 'bold' },

  accountCard: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 18, marginBottom: 14 },
  accountCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  accountName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary, marginBottom: 2 },
  accountInstitution: { fontSize: 13, color: T.textMuted },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 13, fontWeight: 'bold' },
  accountBalance: { fontSize: 26, fontWeight: 'bold', color: T.textPrimary, marginBottom: 12 },

  accountFlow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  flowItem: { flex: 1, backgroundColor: T.bg, borderRadius: T.radius.sm, padding: 10, alignItems: 'center' },
  flowLabel: { fontSize: 11, color: T.textMuted, marginBottom: 4 },
  flowValue: { fontSize: 15, fontWeight: 'bold' },

  runwaySection: { marginBottom: 12 },
  runwayLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  runwayLabel: { fontSize: 13, color: T.textSecondary },
  runwayDays: { fontSize: 13, fontWeight: 'bold', color: T.textPrimary },
  runwayBarBg: { height: 8, backgroundColor: T.bg, borderRadius: 4, overflow: 'hidden' },
  runwayBarFill: { height: '100%', borderRadius: 4 },
  runwayTarget: { fontSize: 11, color: T.textMuted, marginTop: 4 },

  warning: { fontSize: 13, marginTop: 4 },

  unassignedCard: {
    backgroundColor: T.bgCardAlt, borderRadius: T.radius.md, padding: 18, marginBottom: 18,
    borderWidth: 1, borderColor: `${T.red}44`,
  },
  unassignedTitle: { fontSize: 16, fontWeight: 'bold', color: T.red, marginBottom: 6 },
  unassignedSubtitle: { fontSize: 13, color: T.textSecondary, marginBottom: 12 },
  unassignedItem: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: `${T.red}22`,
  },
  unassignedName: { fontSize: 15, color: T.textPrimary },
  unassignedAmount: { fontSize: 15, color: T.red, fontWeight: 'bold' },

  recommendationsCard: {
    backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 18, marginBottom: 30,
    borderLeftWidth: 4, borderLeftColor: T.gold,
  },
  recommendationsTitle: { fontSize: 16, fontWeight: 'bold', color: T.gold, marginBottom: 12 },
  recommendationItem: { fontSize: 14, color: T.textSecondary, marginBottom: 8, lineHeight: 20 },
});
