// app/paycheck.tsx - Detailed paycheck breakdown modal
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { getMonthlyPreTaxDeductions } from '../src/services/cashflow';
import type { IncomeSource, PreTaxDeduction, Tax, PostTaxDeduction } from '../src/types';

// ─── helpers ──────────────────────────────────────────────────────────────────
function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly':        return (amount * 52) / 12;
    case 'biweekly':      return (amount * 26) / 12;
    case 'twice_monthly': return amount * 2;
    case 'monthly':       return amount;
    case 'quarterly':     return amount / 3;
    default:              return amount;
  }
}

const PAYCHECK_SOURCES = new Set<string>(['salary', 'freelance', 'business']);

interface PaycheckBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  paycheckSource: IncomeSource;
}

export default function PaycheckBreakdownModal({ visible, onClose, paycheckSource }: PaycheckBreakdownModalProps) {
  const router = useRouter();
  const preTaxDeductions = useStore((s) => s.preTaxDeductions || []);
  const taxes = useStore((s) => s.taxes || []);
  const postTaxDeductions = useStore((s) => s.postTaxDeductions || []);
  const assets = useStore((s) => s.assets);
  const paycheckDeductions = useStore((s) => s.paycheckDeductions || []);

  // Calculate totals
  const paycheckMonthly = toMonthly(paycheckSource.amount, paycheckSource.frequency);
  const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod || 0, d.frequency || 'monthly'), 0);
  const taxesMonthly = taxes.reduce((sum, t) => sum + toMonthly(t.perPayPeriod || 0, t.frequency || 'monthly'), 0);
  const postTaxMonthly = postTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod || 0, d.frequency || 'monthly'), 0);

  // OLD pre-tax (deprecated paycheckDeductions + 401k from assets)
  const paycheckDeductionMonthly = paycheckDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const { contributions: ret401kMonthly, employerMatch: employerMatchMonthly } = useMemo(() => getMonthlyPreTaxDeductions(assets), [assets]);
  const oldPreTaxTotal = ret401kMonthly + paycheckDeductionMonthly;

  // NEW waterfall calculation
  const grossPay = paycheckMonthly + preTaxMonthly + taxesMonthly + postTaxMonthly;
  const taxableIncome = grossPay - preTaxMonthly;
  const afterTaxIncome = taxableIncome - taxesMonthly;
  const netPay = afterTaxIncome - postTaxMonthly;

  // Fallback to OLD waterfall if no new deductions entered yet
  const useNewWaterfall = preTaxDeductions.length > 0 || taxes.length > 0 || postTaxDeductions.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Paycheck Breakdown</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.paycheckName}>{paycheckSource.name}</Text>
            
            {useNewWaterfall ? (
              <>
                {/* NEW WATERFALL */}
                <View style={styles.waterfallBox}>
                  <Text style={styles.waterfallTitle}>Complete Breakdown</Text>

                  {/* Gross Pay */}
                  <View style={styles.waterfallRow}>
                    <Text style={styles.waterfallLabel}>Gross Pay</Text>
                    <Text style={styles.waterfallAmount}>${grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {/* Pre-tax deductions */}
                  {preTaxDeductions.map((d) => (
                    <View key={d.id} style={styles.waterfallRow}>
                      <Text style={styles.waterfallDeductLabel}>  − {d.name}</Text>
                      <Text style={styles.waterfallDeductAmount}>−${toMonthly(d.perPayPeriod, d.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  ))}

                  {/* Taxable Income */}
                  <View style={[styles.waterfallRow, { marginTop: 6 }]}>
                    <Text style={[styles.waterfallLabel, { color: '#4ade80' }]}>= Taxable Income</Text>
                    <Text style={[styles.waterfallAmount, { color: '#4ade80' }]}>${taxableIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {/* Taxes */}
                  {taxes.map((t) => (
                    <View key={t.id} style={styles.waterfallRow}>
                      <Text style={[styles.waterfallDeductLabel, { color: '#f87171' }]}>  − {t.name}</Text>
                      <Text style={[styles.waterfallDeductAmount, { color: '#f87171' }]}>−${toMonthly(t.perPayPeriod, t.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  ))}

                  {/* After-Tax Income */}
                  <View style={[styles.waterfallRow, { marginTop: 6 }]}>
                    <Text style={[styles.waterfallLabel, { color: '#4ade80' }]}>= After-Tax Income</Text>
                    <Text style={[styles.waterfallAmount, { color: '#4ade80' }]}>${afterTaxIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {/* Post-tax deductions */}
                  {postTaxDeductions.map((d) => (
                    <View key={d.id} style={styles.waterfallRow}>
                      <Text style={[styles.waterfallDeductLabel, { color: '#fb923c' }]}>  − {d.name}</Text>
                      <Text style={[styles.waterfallDeductAmount, { color: '#fb923c' }]}>−${toMonthly(d.perPayPeriod, d.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  ))}

                  {/* Divider */}
                  <View style={styles.waterfallDivider} />

                  {/* Net Pay */}
                  <View style={styles.waterfallRow}>
                    <Text style={styles.waterfallNetLabel}>= Net Pay to Bank</Text>
                    <Text style={styles.waterfallNetAmount}>${netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {/* Employer match (if any) */}
                  {employerMatchMonthly > 0 && (
                    <View style={[styles.waterfallRow, { marginTop: 8 }]}>
                      <Text style={[styles.waterfallOtherLabel, { color: '#4ade80' }]}>  + Employer 401k Match</Text>
                      <Text style={[styles.waterfallOtherAmount, { color: '#4ade80' }]}>+${employerMatchMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <>
                {/* OLD WATERFALL - fallback */}
                <View style={styles.waterfallBox}>
                  <Text style={styles.waterfallTitle}>Basic Breakdown (Legacy)</Text>
                  <Text style={styles.helperText}>⚠️ Add deductions in the new sections to see complete breakdown</Text>

                  <View style={styles.waterfallRow}>
                    <Text style={styles.waterfallLabel}>Gross Pay (estimated)</Text>
                    <Text style={styles.waterfallAmount}>${(paycheckMonthly + oldPreTaxTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {oldPreTaxTotal > 0 && (
                    <View style={styles.waterfallRow}>
                      <Text style={styles.waterfallDeductLabel}>  − Pre-tax deductions</Text>
                      <Text style={styles.waterfallDeductAmount}>−${oldPreTaxTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  )}

                  <View style={styles.waterfallDivider} />

                  <View style={styles.waterfallRow}>
                    <Text style={styles.waterfallNetLabel}>= Net Pay to Bank</Text>
                    <Text style={styles.waterfallNetAmount}>${paycheckMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>

                  {employerMatchMonthly > 0 && (
                    <View style={[styles.waterfallRow, { marginTop: 8 }]}>
                      <Text style={[styles.waterfallOtherLabel, { color: '#4ade80' }]}>  + Employer 401k Match</Text>
                      <Text style={[styles.waterfallOtherAmount, { color: '#4ade80' }]}>+${employerMatchMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Add your pre-tax deductions, taxes, and post-tax deductions to see the complete paycheck waterfall.
              </Text>
              <TouchableOpacity 
                style={styles.manageButton}
                onPress={() => {
                  onClose();
                  router.push('/paycheck-breakdown');
                }}
              >
                <Text style={styles.manageButtonText}>Manage Deductions →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0a0e1a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  closeButton: {
    fontSize: 28,
    color: '#666',
    padding: 4,
  },
  paycheckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 16,
  },
  waterfallBox: {
    backgroundColor: '#141825',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  waterfallTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  waterfallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  waterfallLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  waterfallAmount: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  waterfallDeductLabel: {
    fontSize: 14,
    color: '#c084fc',
    paddingLeft: 12,
  },
  waterfallDeductAmount: {
    fontSize: 14,
    color: '#c084fc',
  },
  waterfallDivider: {
    height: 1,
    backgroundColor: '#2a2f3e',
    marginVertical: 8,
  },
  waterfallNetLabel: {
    fontSize: 15,
    color: '#4ade80',
    fontWeight: 'bold',
  },
  waterfallNetAmount: {
    fontSize: 15,
    color: '#4ade80',
    fontWeight: 'bold',
  },
  waterfallOtherLabel: {
    fontSize: 14,
    color: '#60a5fa',
    paddingLeft: 0,
  },
  waterfallOtherAmount: {
    fontSize: 14,
    color: '#60a5fa',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#1a2a1e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4ade8044',
  },
  infoText: {
    fontSize: 13,
    color: '#a0a0a0',
    lineHeight: 18,
    marginBottom: 12,
  },
  manageButton: {
    backgroundColor: '#f4c430',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
});
