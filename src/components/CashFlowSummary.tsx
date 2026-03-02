// app/components/CashFlowSummary.tsx - Cash flow analysis component
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect, type ReactNode } from 'react';
import { useStore } from '../../src/store/useStore';
import type { OverallCashFlow } from '../../src/services/cashflow';

interface CashFlowSummaryProps {
  cashFlow: OverallCashFlow;
  children?: ReactNode;
}

export default function CashFlowSummary({ cashFlow, children }: CashFlowSummaryProps) {
  const defaultExpanded = useStore((s) => s.settings?.defaultExpandAssetSections ?? false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const healthColor = {
    critical: '#ff4444',
    struggling: '#ff9f43',
    stable: '#f4c430',
    building: '#4ade80',
    thriving: '#4ade80',
  };

  const healthIcon = {
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

  return (
    <>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.toggleLeft}>
          <Text style={styles.toggleIcon}>{healthIcon[cashFlow.healthStatus]}</Text>
          <Text style={[styles.toggleLabel, { color: healthColor[cashFlow.healthStatus] }]}>
            Cash Flow: {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
          </Text>
        </View>
        <Text style={styles.toggleChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.message}>{cashFlow.healthMessage}</Text>

          {/* In / Bills & Debt / Variable / Net row */}
          <View style={styles.numbersRow}>
            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Monthly In</Text>
              <Text style={[styles.numberValue, { color: '#4ade80' }]}>
                ${cashFlow.totalMonthlyIncome.toLocaleString()}
              </Text>
            </View>
            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Bills & Debt</Text>
              <Text style={[styles.numberValue, { color: '#ff6b6b' }]}>
                -${(cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.numberCard, cashFlow.totalMonthlyDiscretionary === 0 && styles.numberCardDashed]}>
              <Text style={styles.numberLabel}>
                {cashFlow.variableSpending.autoEstimate > 0 ? 'Variable' : 'Variable'}
              </Text>
              {cashFlow.totalMonthlyDiscretionary > 0 ? (
                <Text style={[styles.numberValue, { color: '#ff9f43' }]}>
                  -${cashFlow.totalMonthlyDiscretionary.toLocaleString()}
                </Text>
              ) : (
                <Text style={[styles.numberValue, { color: '#666' }]}>--</Text>
              )}
            </View>
            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Net</Text>
              <Text style={[styles.numberValue, { color: cashFlow.totalMonthlyNet >= 0 ? '#4ade80' : '#ff4444' }]}>
                {cashFlow.totalMonthlyNet >= 0 ? '+' : ''}${cashFlow.totalMonthlyNet.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Pre-tax retirement row */}
          {cashFlow.totalPreTaxDeductions > 0 && (
            <View style={styles.pretaxRow}>
              <View style={styles.pretaxItem}>
                <Text style={styles.pretaxLabel}>401k / IRA</Text>
                <Text style={styles.pretaxValue}>-${cashFlow.totalPreTaxDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
              <Text style={styles.pretaxSep}>·</Text>
              <View style={styles.pretaxItem}>
                <Text style={styles.pretaxLabel}>Employer Match</Text>
                <Text style={[styles.pretaxValue, { color: '#4ade80' }]}>+${cashFlow.totalEmployerMatch.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
              <Text style={styles.pretaxSep}>·</Text>
              <View style={styles.pretaxItem}>
                <Text style={styles.pretaxLabel}>Net to 401k</Text>
                <Text style={[styles.pretaxValue, { color: '#c084fc' }]}>
                  ${(cashFlow.totalPreTaxDeductions + cashFlow.totalEmployerMatch).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                </Text>
              </View>
            </View>
          )}

          {/* Per-account mini cards */}
          {cashFlow.accounts.map((analysis) => (
            <View key={analysis.account.id} style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <Text style={styles.accountName}>{analysis.account.name}</Text>
                <View style={[styles.statusPill, { borderColor: accountStatusColor[analysis.status], backgroundColor: accountStatusColor[analysis.status] + '22' }]}>
                  <Text style={[styles.statusPillText, { color: accountStatusColor[analysis.status] }]}>
                    {accountStatusLabel[analysis.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.accountRow}>
                <Text style={styles.accountBalance}>${(analysis.currentBalance ?? 0).toLocaleString()}</Text>
                <Text style={[styles.accountNet, { color: (analysis.monthlyNet ?? 0) >= 0 ? '#4ade80' : '#ff4444' }]}>
                  {(analysis.monthlyNet ?? 0) >= 0 ? '+' : ''}${(analysis.monthlyNet ?? 0).toLocaleString()}/mo
                </Text>
              </View>

              {/* Runway bar */}
              {analysis.monthlyObligations > 0 && (
                <View style={styles.runwayRow}>
                  <View style={styles.runwayBarBg}>
                    <View style={[
                      styles.runwayBarFill,
                      {
                        width: `${Math.min(Math.max((analysis.daysOfRunway / 90) * 100, 0), 100)}%`,
                        backgroundColor: analysis.daysOfRunway >= 90 ? '#4ade80' : analysis.daysOfRunway >= 30 ? '#ff9f43' : '#ff4444',
                      }
                    ]} />
                  </View>
                  <Text style={styles.runwayText}>
                    {analysis.daysOfRunway === Infinity ? '∞' : Math.max(analysis.daysOfRunway, 0)}d runway
                  </Text>
                </View>
              )}
            </View>
          ))}

          {/* Recommendations */}
          {cashFlow.recommendations.length > 0 && (
            <View style={styles.recommendationsBox}>
              {cashFlow.recommendations.map((rec, i) => (
                <Text key={i} style={styles.recommendationText}>💡 {rec}</Text>
              ))}
            </View>
          )}

          {/* Nested children (e.g. SpendingGapAlert) */}
          {children}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 2,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleIcon: { fontSize: 18 },
  toggleLabel: { fontSize: 16, fontWeight: 'bold' },
  toggleChevron: { fontSize: 12, color: '#666' },

  panel: {
    backgroundColor: '#141825',
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  message: { fontSize: 14, color: '#c0c0c0', marginBottom: 14, lineHeight: 20 },

  numbersRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  numberCard: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, alignItems: 'center' } as any,
  numberCardDashed: { borderWidth: 1, borderColor: '#ff9f4350', borderStyle: 'dashed' as const, backgroundColor: '#1a1f2e80' },
  numberLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  numberValue: { fontSize: 16, fontWeight: 'bold' },

  pretaxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#c084fc',
  },
  pretaxItem: { flex: 1, alignItems: 'center' },
  pretaxLabel: { fontSize: 10, color: '#666', marginBottom: 2 },
  pretaxValue: { fontSize: 13, fontWeight: 'bold', color: '#c084fc' },
  pretaxSep: { fontSize: 14, color: '#333', marginHorizontal: 4 },

  accountCard: { backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 8 },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  accountName: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  statusPill: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 11, fontWeight: 'bold' },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between' },
  accountBalance: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  accountNet: { fontSize: 14, fontWeight: '600' },

  runwayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  runwayBarBg: { flex: 1, height: 6, backgroundColor: '#0a0e1a', borderRadius: 3, overflow: 'hidden' },
  runwayBarFill: { height: '100%', borderRadius: 3 },
  runwayText: { fontSize: 11, color: '#666', minWidth: 60 },

  recommendationsBox: { marginTop: 12, gap: 6 },
  recommendationText: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },
});
