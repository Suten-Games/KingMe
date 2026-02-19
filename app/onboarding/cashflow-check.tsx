// app/onboarding/cashflow-check.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';

export default function CashFlowCheckScreen() {
  const router = useRouter();
  const bankAccounts = useStore((state) => state.bankAccounts);
  const incomeSources = useStore((state) => state.income.sources || []);
  const obligations = useStore((state) => state.obligations);
  const debts = useStore((state) => state.debts);

  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts);

  const statusColor = {
    critical: '#ff4444',
    struggling: '#ff9f43',
    stable: '#f4c430',
    building: '#4ade80',
    thriving: '#4ade80',
  };

  const statusIcon = {
    critical: '🔴',
    struggling: '🟠',
    stable: '🟡',
    building: '🟢',
    thriving: '🟢',
  };

  const accountStatusColor = {
    deficit: '#ff4444',
    tight: '#ff9f43',
    healthy: '#4ade80',
  };

  const accountStatusLabel = {
    deficit: 'Deficit',
    tight: 'Tight',
    healthy: 'Healthy',
  };

  const handleContinue = () => {
    router.push('/onboarding/assets');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 4 of 7</Text>

        <Text style={styles.title}>Cash Flow Check</Text>
        <Text style={styles.subtitle}>Here's how your money is flowing</Text>

        {/* Overall Health Card */}
        <View style={[styles.healthCard, { borderColor: statusColor[cashFlow.healthStatus] }]}>
          <View style={styles.healthHeader}>
            <Text style={styles.healthIcon}>{statusIcon[cashFlow.healthStatus]}</Text>
            <Text style={[styles.healthLabel, { color: statusColor[cashFlow.healthStatus] }]}>
              {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
            </Text>
          </View>
          <Text style={styles.healthMessage}>{cashFlow.healthMessage}</Text>
        </View>

        {/* Top-Level Numbers */}
        <View style={styles.numbersRow}>
          <View style={styles.numberCard}>
            <Text style={styles.numberLabel}>Monthly In</Text>
            <Text style={[styles.numberValue, { color: '#4ade80' }]}>
              ${cashFlow.totalMonthlyIncome.toLocaleString()}
            </Text>
          </View>
          <View style={styles.numberCard}>
            <Text style={styles.numberLabel}>Monthly Out</Text>
            <Text style={[styles.numberValue, { color: '#ff6b6b' }]}>
              ${(cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments).toLocaleString()}
            </Text>
          </View>
          <View style={styles.numberCard}>
            <Text style={styles.numberLabel}>Net</Text>
            <Text style={[styles.numberValue, { color: cashFlow.totalMonthlyNet >= 0 ? '#4ade80' : '#ff4444' }]}>
              {cashFlow.totalMonthlyNet >= 0 ? '+' : ''}${cashFlow.totalMonthlyNet.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Per-Account Breakdown */}
        <Text style={styles.sectionTitle}>Account Breakdown</Text>

        {cashFlow.accounts.map((analysis) => (
          <View key={analysis.account.id} style={styles.accountCard}>
            <View style={styles.accountCardHeader}>
              <View>
                <Text style={styles.accountName}>{analysis.account.name}</Text>
                <Text style={styles.accountInstitution}>{analysis.account.institution}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: accountStatusColor[analysis.status] + '22', borderColor: accountStatusColor[analysis.status] }]}>
                <Text style={[styles.statusBadgeText, { color: accountStatusColor[analysis.status] }]}>
                  {accountStatusLabel[analysis.status]}
                </Text>
              </View>
            </View>

            <Text style={styles.accountBalance}>${(analysis.currentBalance ?? 0).toLocaleString()}</Text>

            <View style={styles.accountFlow}>
              <View style={styles.flowItem}>
                <Text style={styles.flowLabel}>In</Text>
                <Text style={[styles.flowValue, { color: '#4ade80' }]}>
                  ${analysis.monthlyIncome.toLocaleString()}/mo
                </Text>
              </View>
              <View style={styles.flowItem}>
                <Text style={styles.flowLabel}>Out</Text>
                <Text style={[styles.flowValue, { color: '#ff6b6b' }]}>
                  ${analysis.monthlyObligations.toLocaleString()}/mo
                </Text>
              </View>
              <View style={styles.flowItem}>
                <Text style={styles.flowLabel}>Net</Text>
                <Text style={[styles.flowValue, { color: analysis.monthlyNet >= 0 ? '#4ade80' : '#ff4444' }]}>
                  {analysis.monthlyNet >= 0 ? '+' : ''}${analysis.monthlyNet.toLocaleString()}/mo
                </Text>
              </View>
            </View>

            {/* Runway bar */}
            {analysis.monthlyObligations > 0 && (
              <View style={styles.runwaySection}>
                <View style={styles.runwayLabelRow}>
                  <Text style={styles.runwayLabel}>Runway</Text>
                  <Text style={styles.runwayDays}>
                    {analysis.daysOfRunway === Infinity ? '∞' : analysis.daysOfRunway} days
                  </Text>
                </View>
                <View style={styles.runwayBarBg}>
                  <View style={[
                    styles.runwayBarFill,
                    {
                      width: `${Math.min((analysis.daysOfRunway / 90) * 100, 100)}%`,
                      backgroundColor: analysis.daysOfRunway >= 90 ? '#4ade80' : analysis.daysOfRunway >= 30 ? '#ff9f43' : '#ff4444',
                    }
                  ]} />
                </View>
                <Text style={styles.runwayTarget}>Target: 90 days</Text>
              </View>
            )}

            {/* Warnings */}
            {analysis.warnings.map((warning, i) => (
              <Text key={i} style={[styles.warning, { color: analysis.status === 'healthy' ? '#4ade80' : accountStatusColor[analysis.status] }]}>
                {analysis.status === 'healthy' ? '✓' : '⚠'} {warning}
              </Text>
            ))}
          </View>
        ))}

        {/* Unassigned obligations warning */}
        {cashFlow.unassignedObligations.length > 0 && (
          <View style={styles.unassignedCard}>
            <Text style={styles.unassignedTitle}>⚠️ Unassigned Obligations</Text>
            <Text style={styles.unassignedSubtitle}>
              These bills aren't tied to an account yet. Assign them so we can track your cash flow accurately.
            </Text>
            {cashFlow.unassignedObligations.map((o) => (
              <View key={o.id} style={styles.unassignedItem}>
                <Text style={styles.unassignedName}>{o.name}</Text>
                <Text style={styles.unassignedAmount}>${o.amount.toLocaleString()}/mo</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>💡 Recommendations</Text>
          {cashFlow.recommendations.map((rec, i) => (
            <Text key={i} style={styles.recommendationItem}>{rec}</Text>
          ))}
        </View>
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>
            {cashFlow.healthStatus === 'critical'
              ? 'Continue (I want to track my assets too)'
              : 'Continue to Assets →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scrollView: { flex: 1, padding: 20 },
  progress: {
    fontSize: 14, color: '#666', marginBottom: 20,
    // marginTop: 40
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#f4c430', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#a0a0a0', marginBottom: 20 },

  // Health card
  healthCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
  },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  healthIcon: { fontSize: 24 },
  healthLabel: { fontSize: 20, fontWeight: 'bold' },
  healthMessage: { fontSize: 15, color: '#c0c0c0', lineHeight: 22 },

  // Numbers row
  numbersRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  numberCard: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  numberLabel: { fontSize: 12, color: '#666', marginBottom: 6 },
  numberValue: { fontSize: 18, fontWeight: 'bold' },

  // Section title
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 14 },

  // Account card
  accountCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  accountName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  accountInstitution: { fontSize: 13, color: '#666' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 13, fontWeight: 'bold' },
  accountBalance: { fontSize: 26, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },

  // Flow row
  accountFlow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  flowItem: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  flowLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  flowValue: { fontSize: 15, fontWeight: 'bold' },

  // Runway
  runwaySection: { marginBottom: 12 },
  runwayLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  runwayLabel: { fontSize: 13, color: '#a0a0a0' },
  runwayDays: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  runwayBarBg: { height: 8, backgroundColor: '#0a0e1a', borderRadius: 4, overflow: 'hidden' },
  runwayBarFill: { height: '100%', borderRadius: 4 },
  runwayTarget: { fontSize: 11, color: '#666', marginTop: 4 },

  // Warnings
  warning: { fontSize: 13, marginTop: 4 },

  // Unassigned
  unassignedCard: {
    backgroundColor: '#2a1a1e',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#ff6b6b44',
  },
  unassignedTitle: { fontSize: 16, fontWeight: 'bold', color: '#ff6b6b', marginBottom: 6 },
  unassignedSubtitle: { fontSize: 13, color: '#a0a0a0', marginBottom: 12 },
  unassignedItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#ff6b6b22' },
  unassignedName: { fontSize: 15, color: '#fff' },
  unassignedAmount: { fontSize: 15, color: '#ff6b6b', fontWeight: 'bold' },

  // Recommendations
  recommendationsCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 18,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  recommendationsTitle: { fontSize: 16, fontWeight: 'bold', color: '#f4c430', marginBottom: 12 },
  recommendationItem: { fontSize: 14, color: '#c0c0c0', marginBottom: 8, lineHeight: 20 },

  // Bottom button
  buttonContainer: { padding: 20, backgroundColor: '#0a0e1a', borderTopWidth: 1, borderTopColor: '#1a1f2e' },
  button: { backgroundColor: '#f4c430', padding: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#0a0e1a' },
});
