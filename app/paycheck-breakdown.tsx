// app/paycheck-breakdown.tsx - Full page for managing paycheck deductions
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useStore } from '../src/store/useStore';
import type { PreTaxDeduction, PreTaxDeductionType, Tax, TaxType, PostTaxDeduction, PostTaxDeductionType } from '../src/types';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';

// ─── helpers ──────────────────────────────────────────────────────────────────
function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly':        return (amount * 52) / 12;
    case 'biweekly':      return (amount * 26) / 12;
    case 'twice_monthly': return amount * 2;
    case 'monthly':       return amount;
    default:              return amount;
  }
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  twice_monthly: '2x/mo',
  monthly: 'Monthly',
};

const PRETAX_LABELS: Record<PreTaxDeductionType, string> = {
  medical_coverage: '🏥 Medical',
  vision_coverage: '👓 Vision',
  dental_coverage: '🦷 Dental',
  life_insurance: '🛡️ Life Insurance',
  add_insurance: '🚑 AD&D',
  '401k_contribution': '💰 401k Contribution',
  other_pretax: '📋 Other Pre-Tax',
};

const TAX_LABELS: Record<TaxType, string> = {
  federal_withholding: '🇺🇸 Federal W/H',
  social_security: '👴 Social Security',
  medicare: '🏥 Medicare',
  state_withholding: '🏛️ State W/H',
};

const POSTTAX_LABELS: Record<PostTaxDeductionType, string> = {
  '401k_loan': '🏛️ 401k Loan',
  enhanced_ltd: '🛡️ Enhanced LTD',
  other_posttax: '📋 Other Post-Tax',
};

export default function PaycheckBreakdownScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  const preTaxDeductions = useStore((s) => s.preTaxDeductions || []);
  const taxes = useStore((s) => s.taxes || []);
  const postTaxDeductions = useStore((s) => s.postTaxDeductions || []);
  const addPreTaxDeduction = useStore((s) => s.addPreTaxDeduction);
  const removePreTaxDeduction = useStore((s) => s.removePreTaxDeduction);
  const addTax = useStore((s) => s.addTax);
  const removeTax = useStore((s) => s.removeTax);
  const addPostTaxDeduction = useStore((s) => s.addPostTaxDeduction);
  const removePostTaxDeduction = useStore((s) => s.removePostTaxDeduction);

  // ── pre-tax modal ─────────────────────────────────────────────
  const [showPreTaxModal, setShowPreTaxModal] = useState(false);
  const [preTaxName, setPreTaxName] = useState('');
  const [preTaxType, setPreTaxType] = useState<PreTaxDeductionType>('medical_coverage');
  const [preTaxAmount, setPreTaxAmount] = useState('');
  const [preTaxFreq, setPreTaxFreq] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');

  // ── tax modal ───────────────────────────────────────────────────────────
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxName, setTaxName] = useState('');
  const [taxType, setTaxType] = useState<TaxType>('federal_withholding');
  const [taxAmount, setTaxAmount] = useState('');
  const [taxFreq, setTaxFreq] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');

  // ── post-tax modal ────────────────────────────────────────────
  const [showPostTaxModal, setShowPostTaxModal] = useState(false);
  const [postTaxName, setPostTaxName] = useState('');
  const [postTaxType, setPostTaxType] = useState<PostTaxDeductionType>('401k_loan');
  const [postTaxAmount, setPostTaxAmount] = useState('');
  const [postTaxFreq, setPostTaxFreq] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleAddPreTax = () => {
    if (!preTaxName || !preTaxAmount) return;
    addPreTaxDeduction({
      id: Date.now().toString(),
      name: preTaxName,
      type: preTaxType,
      perPayPeriod: parseFloat(preTaxAmount),
      frequency: preTaxFreq,
    });
    setPreTaxName(''); setPreTaxAmount(''); setPreTaxType('medical_coverage'); setPreTaxFreq('biweekly');
    setShowPreTaxModal(false);
  };

  const handleAddTax = () => {
    if (!taxName || !taxAmount) return;
    addTax({
      id: Date.now().toString(),
      name: taxName,
      type: taxType,
      perPayPeriod: parseFloat(taxAmount),
      frequency: taxFreq,
    });
    setTaxName(''); setTaxAmount(''); setTaxType('federal_withholding'); setTaxFreq('biweekly');
    setShowTaxModal(false);
  };

  const handleAddPostTax = () => {
    if (!postTaxName || !postTaxAmount) return;
    addPostTaxDeduction({
      id: Date.now().toString(),
      name: postTaxName,
      type: postTaxType,
      perPayPeriod: parseFloat(postTaxAmount),
      frequency: postTaxFreq,
    });
    setPostTaxName(''); setPostTaxAmount(''); setPostTaxType('401k_loan'); setPostTaxFreq('biweekly');
    setShowPostTaxModal(false);
  };

  // Calculate totals
  const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const taxesMonthly = taxes.reduce((sum, t) => sum + toMonthly(t.perPayPeriod, t.frequency), 0);
  const postTaxMonthly = postTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);

  return (
    <View style={styles.container}>
      {/* KingMe Header */}
      <LinearGradient
        colors={['#10162a', '#0c1020', '#080c18']}
        style={{ paddingTop: Math.max(insets.top, 14) }}
      >
        <View style={styles.kmHeaderRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={styles.kmBackButton}
          >
            <Text style={styles.kmBackText}>{'\u2190'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.kmBrand} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Image
              source={require('../src/assets/images/kingmelogo.jpg')}
              style={styles.kmLogo}
              resizeMode="cover"
            />
            <MaskedView
              maskElement={
                <Text style={[styles.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>
                  KingMe
                </Text>
              }
            >
              <LinearGradient
                colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text
                  style={[styles.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}
                >
                  KingMe
                </Text>
              </LinearGradient>
            </MaskedView>
          </TouchableOpacity>
          <View style={{ marginLeft: 'auto' }}>
            <WalletHeaderButton />
          </View>
        </View>
        <LinearGradient
          colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.kmAccent}
        />
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Total Monthly Deductions</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pre-Tax</Text>
              <Text style={styles.summaryValuePurple}>${preTaxMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Taxes</Text>
              <Text style={styles.summaryValueRed}>${taxesMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Post-Tax</Text>
              <Text style={styles.summaryValueOrange}>${postTaxMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════════════════
            PRE-TAX DEDUCTIONS
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pre-Tax Deductions</Text>
          <TouchableOpacity style={styles.addButtonPurple} onPress={() => setShowPreTaxModal(true)}>
            <Text style={styles.addButtonPurpleText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            These come OUT of your gross pay BEFORE taxes: Medical, Dental, Vision, Life Insurance, AD&D, 401k contributions.
          </Text>
        </View>

        {preTaxDeductions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pre-tax deductions</Text>
            <Text style={styles.emptySubtext}>Add Medical, Dental, Vision, Life, AD&D, 401k contributions</Text>
          </View>
        ) : (
          preTaxDeductions.map((ded) => (
            <View key={ded.id} style={styles.deductionCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardName}>{ded.name}</Text>
                  <Text style={styles.cardMetaPurple}>
                    {PRETAX_LABELS[ded.type]}  ·  {FREQ_LABELS[ded.frequency]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removePreTaxDeduction(ded.id)}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardNumbers}>
                <Text style={styles.cardAmountPurple}>${ded.perPayPeriod.toLocaleString()}</Text>
                <Text style={styles.cardFreq}>per pay</Text>
                <Text style={styles.cardMonthlyPurple}>${toMonthly(ded.perPayPeriod, ded.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
            </View>
          ))
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAXES
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Taxes</Text>
          <TouchableOpacity style={styles.addButtonRed} onPress={() => setShowTaxModal(true)}>
            <Text style={styles.addButtonRedText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Taxes taken from your taxable income: Federal W/H, Social Security, Medicare, State W/H.
          </Text>
        </View>

        {taxes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No taxes tracked</Text>
            <Text style={styles.emptySubtext}>Add Federal W/H, Social Security, Medicare, State W/H</Text>
          </View>
        ) : (
          taxes.map((tax) => (
            <View key={tax.id} style={[styles.deductionCard, { borderLeftColor: '#f87171' }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardName}>{tax.name}</Text>
                  <Text style={[styles.cardMetaPurple, { color: '#f87171' }]}>
                    {TAX_LABELS[tax.type]}  ·  {FREQ_LABELS[tax.frequency]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeTax(tax.id)}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardNumbers}>
                <Text style={[styles.cardAmountPurple, { color: '#f87171' }]}>${tax.perPayPeriod.toLocaleString()}</Text>
                <Text style={styles.cardFreq}>per pay</Text>
                <Text style={[styles.cardMonthlyPurple, { color: '#f87171' }]}>${toMonthly(tax.perPayPeriod, tax.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
            </View>
          ))
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            POST-TAX DEDUCTIONS
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Post-Tax Deductions</Text>
          <TouchableOpacity style={styles.addButtonOrange} onPress={() => setShowPostTaxModal(true)}>
            <Text style={styles.addButtonOrangeText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            These come OUT after taxes: 401k loan repayments, Enhanced LTD, and other post-tax deductions.
          </Text>
        </View>

        {postTaxDeductions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No post-tax deductions</Text>
            <Text style={styles.emptySubtext}>Add 401k loan, Enhanced LTD, etc.</Text>
          </View>
        ) : (
          postTaxDeductions.map((ded) => (
            <View key={ded.id} style={[styles.deductionCard, { borderLeftColor: '#fb923c' }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardName}>{ded.name}</Text>
                  <Text style={[styles.cardMetaPurple, { color: '#fb923c' }]}>
                    {POSTTAX_LABELS[ded.type]}  ·  {FREQ_LABELS[ded.frequency]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removePostTaxDeduction(ded.id)}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardNumbers}>
                <Text style={[styles.cardAmountPurple, { color: '#fb923c' }]}>${ded.perPayPeriod.toLocaleString()}</Text>
                <Text style={styles.cardFreq}>per pay</Text>
                <Text style={[styles.cardMonthlyPurple, { color: '#fb923c' }]}>${toMonthly(ded.perPayPeriod, ded.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
            </View>
          ))
        )}

        <KingMeFooter />
      </ScrollView>

      {/* ═══════════════ ADD PRE-TAX DEDUCTION MODAL ═══════════════ */}
      <Modal visible={showPreTaxModal} animationType="slide" transparent={true} onRequestClose={() => setShowPreTaxModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: '#c084fc' }]}>Add Pre-Tax Deduction</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.pillRow}>
                {(['medical_coverage', 'vision_coverage', 'dental_coverage', 'life_insurance', 'add_insurance', '401k_contribution', 'other_pretax'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, preTaxType === t && styles.pillActivePurple]}
                    onPress={() => setPreTaxType(t)}
                  >
                    <Text style={[styles.pillText, preTaxType === t && styles.pillTextActivePurple]}>{PRETAX_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Medical Coverage, Vision Plan"
                placeholderTextColor="#666"
                value={preTaxName}
                onChangeText={setPreTaxName}
              />

              <Text style={styles.label}>Amount Per Paycheck</Text>
              <View style={styles.inputRow}>
                <Text style={[styles.currencySymbol, { color: '#c084fc' }]}>$</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor="#666" keyboardType="numeric" value={preTaxAmount} onChangeText={setPreTaxAmount} />
              </View>

              <Text style={styles.label}>Pay Frequency</Text>
              <View style={styles.pillRow}>
                {(['weekly', 'biweekly', 'twice_monthly', 'monthly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[styles.pill, preTaxFreq === f && styles.pillActivePurple]} onPress={() => setPreTaxFreq(f)}>
                    <Text style={[styles.pillText, preTaxFreq === f && styles.pillTextActivePurple]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {parseFloat(preTaxAmount) > 0 && (
                <Text style={[styles.monthlyPreview, { color: '#c084fc' }]}>= ${toMonthly(parseFloat(preTaxAmount), preTaxFreq).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo pre-tax</Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPreTaxModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtnPurple, (!preTaxName || !preTaxAmount) && styles.modalBtnDisabled]}
                  onPress={handleAddPreTax}
                  disabled={!preTaxName || !preTaxAmount}
                >
                  <Text style={styles.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ ADD TAX MODAL ═══════════════ */}
      <Modal visible={showTaxModal} animationType="slide" transparent={true} onRequestClose={() => setShowTaxModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: '#f87171' }]}>Add Tax</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.pillRow}>
                {(['federal_withholding', 'social_security', 'medicare', 'state_withholding'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, taxType === t && styles.pillActiveRed]}
                    onPress={() => setTaxType(t)}
                  >
                    <Text style={[styles.pillText, taxType === t && styles.pillTextActiveRed]}>{TAX_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Federal W/H, Social Security"
                placeholderTextColor="#666"
                value={taxName}
                onChangeText={setTaxName}
              />

              <Text style={styles.label}>Amount Per Paycheck</Text>
              <View style={styles.inputRow}>
                <Text style={[styles.currencySymbol, { color: '#f87171' }]}>$</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor="#666" keyboardType="numeric" value={taxAmount} onChangeText={setTaxAmount} />
              </View>

              <Text style={styles.label}>Pay Frequency</Text>
              <View style={styles.pillRow}>
                {(['weekly', 'biweekly', 'twice_monthly', 'monthly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[styles.pill, taxFreq === f && styles.pillActiveRed]} onPress={() => setTaxFreq(f)}>
                    <Text style={[styles.pillText, taxFreq === f && styles.pillTextActiveRed]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {parseFloat(taxAmount) > 0 && (
                <Text style={[styles.monthlyPreview, { color: '#f87171' }]}>= ${toMonthly(parseFloat(taxAmount), taxFreq).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo tax</Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowTaxModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtnRed, (!taxName || !taxAmount) && styles.modalBtnDisabled]}
                  onPress={handleAddTax}
                  disabled={!taxName || !taxAmount}
                >
                  <Text style={styles.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ ADD POST-TAX DEDUCTION MODAL ═══════════════ */}
      <Modal visible={showPostTaxModal} animationType="slide" transparent={true} onRequestClose={() => setShowPostTaxModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: '#fb923c' }]}>Add Post-Tax Deduction</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.pillRow}>
                {(['401k_loan', 'enhanced_ltd', 'other_posttax'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, postTaxType === t && styles.pillActiveOrange]}
                    onPress={() => setPostTaxType(t)}
                  >
                    <Text style={[styles.pillText, postTaxType === t && styles.pillTextActiveOrange]}>{POSTTAX_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., 401k Loan, Enhanced LTD"
                placeholderTextColor="#666"
                value={postTaxName}
                onChangeText={setPostTaxName}
              />

              <Text style={styles.label}>Amount Per Paycheck</Text>
              <View style={styles.inputRow}>
                <Text style={[styles.currencySymbol, { color: '#fb923c' }]}>$</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor="#666" keyboardType="numeric" value={postTaxAmount} onChangeText={setPostTaxAmount} />
              </View>

              <Text style={styles.label}>Pay Frequency</Text>
              <View style={styles.pillRow}>
                {(['weekly', 'biweekly', 'twice_monthly', 'monthly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[styles.pill, postTaxFreq === f && styles.pillActiveOrange]} onPress={() => setPostTaxFreq(f)}>
                    <Text style={[styles.pillText, postTaxFreq === f && styles.pillTextActiveOrange]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {parseFloat(postTaxAmount) > 0 && (
                <Text style={[styles.monthlyPreview, { color: '#fb923c' }]}>= ${toMonthly(parseFloat(postTaxAmount), postTaxFreq).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo post-tax</Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPostTaxModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtnOrange, (!postTaxName || !postTaxAmount) && styles.modalBtnDisabled]}
                  onPress={handleAddPostTax}
                  disabled={!postTaxName || !postTaxAmount}
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
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  kmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  kmBackButton: { paddingRight: 4, paddingVertical: 4 },
  kmBackText: { color: '#f4c430', fontSize: 22, fontWeight: '600' },
  kmBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kmLogo: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#f4c43040' },
  kmTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1 },
  kmAccent: { height: 1.5, borderRadius: 1 },
  scroll: { flex: 1, padding: 20 },

  // Summary
  summaryBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  summaryTitle: { fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 44, backgroundColor: '#2a2f3e' },
  summaryLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  summaryValuePurple: { fontSize: 20, fontWeight: 'bold', color: '#c084fc' },
  summaryValueRed: { fontSize: 20, fontWeight: 'bold', color: '#f87171' },
  summaryValueOrange: { fontSize: 20, fontWeight: 'bold', color: '#fb923c' },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },

  addButtonPurple: { backgroundColor: '#c084fc', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonPurpleText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },
  addButtonRed: { backgroundColor: '#f87171', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonRedText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },
  addButtonOrange: { backgroundColor: '#fb923c', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonOrangeText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },

  // Info box
  infoBox: {
    backgroundColor: '#1e1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#c084fc44',
  },
  infoText: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },

  // Empty states
  emptyCard: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#444', textAlign: 'center' },

  // Deduction cards
  deductionCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#c084fc',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  cardMetaPurple: { fontSize: 13, color: '#c084fc' },
  deleteBtn: { fontSize: 18, color: '#ff4444', padding: 2 },
  cardNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardAmountPurple: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardFreq: { fontSize: 12, color: '#666' },
  cardMonthlyPurple: { fontSize: 15, color: '#c084fc', fontWeight: '600', marginLeft: 'auto' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#4ade80', marginBottom: 18 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 6, marginTop: 14 },
  modalInput: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 2, borderColor: '#2a2f3e' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 14, borderWidth: 2, borderColor: '#2a2f3e' },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 6 },
  input: { flex: 1, fontSize: 20, color: '#fff', paddingVertical: 14 },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: '#2a2f3e', backgroundColor: '#1a1f2e' },
  pillActivePurple: { borderColor: '#c084fc', backgroundColor: '#2a1e3e' },
  pillActiveRed: { borderColor: '#f87171', backgroundColor: '#3a1a1e' },
  pillActiveOrange: { borderColor: '#fb923c', backgroundColor: '#3a2a1e' },
  pillText: { fontSize: 13, color: '#666' },
  pillTextActivePurple: { color: '#c084fc', fontWeight: 'bold' },
  pillTextActiveRed: { color: '#f87171', fontWeight: 'bold' },
  pillTextActiveOrange: { color: '#fb923c', fontWeight: 'bold' },

  monthlyPreview: { fontSize: 14, color: '#4ade80', marginTop: 8, fontWeight: '600' },

  // Modal buttons
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 16 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { color: '#a0a0a0', fontSize: 16 },
  modalAddBtnPurple: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#c084fc', alignItems: 'center' },
  modalAddBtnRed: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f87171', alignItems: 'center' },
  modalAddBtnOrange: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#fb923c', alignItems: 'center' },
  modalBtnDisabled: { opacity: 0.4 },
  modalAddText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
});
