// app/(tabs)/income.tsx - Simplified income sources only
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { getMonthlyPreTaxDeductions } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import PaycheckBreakdownModal from '../paycheck';
import type { IncomeSource } from '../../src/types';
import type { SKRHolding, SKRIncomeSnapshot } from '../../src/services/skr';
import CollapsibleSection from '../../src/components/CollapsibleSection';

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

const SOURCE_LABELS: Record<string, string> = {
  salary:    '💼 Salary',
  freelance: '💻 Freelance',
  business:  '🏢 Business',
  trading:   '📊 Trading',
  other:     '💰 Other',
};

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  twice_monthly: '2x/mo',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export default function IncomeScreen() {
  const router = useRouter();
  
  // ── store ───────────────────────────────────────────────────────────────────
  const incomeSources           = useStore((s) => s.income.sources || []);
  const bankAccounts            = useStore((s) => s.bankAccounts);
  const assets                  = useStore((s) => s.assets);
  const addIncomeSource         = useStore((s) => s.addIncomeSource);
  const removeIncomeSource      = useStore((s) => s.removeIncomeSource);
  const preTaxDeductions        = useStore((s) => s.preTaxDeductions || []);
  const taxes                   = useStore((s) => s.taxes || []);
  const postTaxDeductions       = useStore((s) => s.postTaxDeductions || []);

  // ── Paycheck breakdown modal ────────────────────────────────────────────────
  const [selectedPaycheck, setSelectedPaycheck] = useState<IncomeSource | null>(null);

  // ── SKR staking yield (auto-detected) ─────────────────────────────────────
  const wallets = useStore((s) => s.wallets);
  const [skrIncome, setSKRIncome] = useState<SKRIncomeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let holding: SKRHolding | null = null;
      if (wallets.length > 0) {
        for (const addr of wallets) {
          holding = await fetchSKRHolding(addr);
          if (holding) break;
        }
      }
      if (!cancelled) setSKRIncome(holding ? calcSKRIncome(holding) : null);
    }
    load();
    return () => { cancelled = true; };
  }, [wallets]);

  // ── income source modal state ───────────────────────────────────────────────
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [srcName, setSrcName]                 = useState('');
  const [srcType, setSrcType]                 = useState<IncomeSource['source']>('salary');
  const [srcAmount, setSrcAmount]             = useState('');
  const [srcFreq, setSrcFreq]                 = useState<IncomeSource['frequency']>('biweekly');
  const [srcAccountId, setSrcAccountId]       = useState('');

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleAddIncome = () => {
    if (!srcName || !srcAmount || !srcAccountId) return;
    addIncomeSource({
      id: Date.now().toString(),
      source: srcType,
      name: srcName,
      amount: parseFloat(srcAmount),
      frequency: srcFreq,
      bankAccountId: srcAccountId,
    });
    setSrcName(''); setSrcAmount(''); setSrcType('salary'); setSrcFreq('biweekly'); setSrcAccountId('');
    setShowIncomeModal(false);
  };

  // ── derived numbers ─────────────────────────────────────────────────────────
  const { paycheckSources, otherSources, paycheckMonthly, otherMonthly } = useMemo(() => {
    const paycheck: IncomeSource[] = [];
    const other: IncomeSource[]    = [];
    let paycheckM = 0, otherM = 0;

    incomeSources.forEach((s) => {
      const m = toMonthly(s.amount, s.frequency);
      if (PAYCHECK_SOURCES.has(s.source)) { paycheck.push(s); paycheckM += m; }
      else                                { other.push(s);    otherM   += m; }
    });
    return { paycheckSources: paycheck, otherSources: other, paycheckMonthly: paycheckM, otherMonthly: otherM };
  }, [incomeSources]);

  const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const { contributions: ret401kMonthly, employerMatch: employerMatchMonthly } = useMemo(() => getMonthlyPreTaxDeductions(assets), [assets]);

  const totalNetToBank = paycheckMonthly + otherMonthly;

  const paycheckTotal = paycheckSources.reduce((sum, src) => 
    sum + toMonthly(src.amount, src.frequency), 0
  );

  const assetTotal = (skrIncome?.monthlyYieldUsd || 0) + 
  assets.reduce((sum, a) => sum + (a.annualIncome / 12), 0);

  const tradingTotal = otherSources.reduce((sum, src) => 
    sum + toMonthly(src.amount, src.frequency), 0
  );

  const getAccountName = (id: string) => bankAccounts.find((a) => a.id === id)?.name || 'Unknown';

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ══════════════════════════════════════════════════════════════════════
            SUMMARY HEADER
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total to Bank</Text>
              <Text style={styles.summaryValueGreen}>${totalNetToBank.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={styles.summaryPerMo}>/mo</Text></Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pre-Tax Out</Text>
              <Text style={styles.summaryValuePurple}>${preTaxMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={styles.summaryPerMo}>/mo</Text></Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Employer Match</Text>
              <Text style={[styles.summaryValueGreen, { fontSize: 18 }]}>+${employerMatchMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={styles.summaryPerMo}>/mo</Text></Text>
            </View>
          </View>
        </View>

        {/* Manage Paycheck Breakdown Link */}
        {/* <TouchableOpacity 
          style={styles.manageBreakdownCard}
          onPress={() => router.push('/paycheck-breakdown')}
        >
          <View style={styles.manageBreakdownContent}>
            <View>
              <Text style={styles.manageBreakdownTitle}>⚙️ Manage Paycheck Deductions</Text>
              <Text style={styles.manageBreakdownSub}>Add pre-tax, taxes, and post-tax items</Text>
            </View>
            <Text style={styles.manageBreakdownArrow}>→</Text>
          </View>
        </TouchableOpacity> */}

        {/* ══════════════════════════════════════════════════════════════════════
            PAYCHECK INCOME SOURCES (salary / freelance / business)
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Paycheck Income</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => { setSrcType('salary'); setShowIncomeModal(true); }}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <CollapsibleSection
          title="Paycheck Income"
          total={`$${paycheckTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`}
          totalColor="#4ade80">

        {paycheckSources.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No paycheck income yet</Text>
            <Text style={styles.emptySubtext}>Add your salary, freelance, or business income here. Enter the net amount that lands in your bank.</Text>
          </View>
        ) : (
          paycheckSources.map((src) => (
            <TouchableOpacity 
              key={src.id} 
              style={styles.incomeCard}
              onPress={() => setSelectedPaycheck(src)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{src.name}</Text>
                  <Text style={styles.cardMeta}>
                    {SOURCE_LABELS[src.source] || src.source}  ·  → {getAccountName(src.bankAccountId)}
                  </Text>
                  <Text style={styles.tapHint}>Tap to see breakdown</Text>
                </View>
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    removeIncomeSource(src.id);
                  }}
                >
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardNumbers}>
                <Text style={styles.cardAmount}>${src.amount.toLocaleString()}</Text>
                <Text style={styles.cardFreq}>{FREQ_LABELS[src.frequency]}</Text>
                <Text style={styles.cardMonthly}>${toMonthly(src.amount, src.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              </View>
            </TouchableOpacity>
          ))
          )}

              {/* Manage Paycheck Breakdown Link */}
            <TouchableOpacity 
              style={styles.manageBreakdownCard}
              onPress={() => router.push('/paycheck-breakdown')}
            >
              <View style={styles.manageBreakdownContent}>
                <View>
                  <Text style={styles.manageBreakdownTitle}>⚙️ Manage Paycheck Deductions</Text>
                  <Text style={styles.manageBreakdownSub}>Add pre-tax, taxes, and post-tax items</Text>
                </View>
                <Text style={styles.manageBreakdownArrow}>→</Text>
              </View>
            </TouchableOpacity>
          </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════════════
            TRADING / OTHER INCOME (Drift wins, crypto, etc.)
            ══════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Trading & Other</Text>
          <TouchableOpacity style={styles.addButtonBlue} onPress={() => { setSrcType('trading'); setShowIncomeModal(true); }}>
            <Text style={styles.addButtonBlueText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <CollapsibleSection
          title="Trading & Other"
          total={`$${tradingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`}
          totalColor="#60a5fa"
        >
          {otherSources.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No trading income yet</Text>
              <Text style={styles.emptySubtext}>Log Drift perpetuals wins, crypto income, or any non-paycheck deposits here.</Text>
            </View>
          ) : (
            otherSources.map((src) => (
              <View key={src.id} style={[styles.incomeCard, { borderLeftColor: '#60a5fa' }]}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardName}>{src.name}</Text>
                    <Text style={[styles.cardMeta, { color: '#60a5fa' }]}>
                      {SOURCE_LABELS[src.source] || src.source}  ·  → {getAccountName(src.bankAccountId)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeIncomeSource(src.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.cardNumbers}>
                  <Text style={styles.cardAmount}>${src.amount.toLocaleString()}</Text>
                  <Text style={styles.cardFreq}>{FREQ_LABELS[src.frequency]}</Text>
                  <Text style={[styles.cardMonthly, { color: '#60a5fa' }]}>${toMonthly(src.amount, src.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                </View>
              </View>
            ))
          )}
        </CollapsibleSection>


        {/* ══════════════════════════════════════════════════════════════════════
            SKR STAKING YIELD — auto-detected passive income
            ══════════════════════════════════════════════════════════════════════ */}
        {skrIncome && skrIncome.monthlyYieldUsd > 0 && (
          <View style={styles.skrYieldCard}>
            <View style={styles.skrYieldHeader}>
              <View style={styles.skrYieldTitleRow}>
                <Text style={styles.skrYieldLogo}>◎</Text>
                <View>
                  <Text style={styles.skrYieldTitle}>$SKR Staking Yield</Text>
                  <Text style={styles.skrYieldSub}>Auto-detected · Passive income</Text>
                </View>
              </View>
              <View style={styles.skrYieldApyBadge}>
                <Text style={styles.skrYieldApyText}>{(skrIncome.apyUsed * 100).toFixed(0)}% APY</Text>
              </View>
            </View>

            <View style={styles.skrYieldNumbers}>
              <View style={styles.skrYieldNumCol}>
                <Text style={styles.skrYieldNumLabel}>Monthly Yield</Text>
                <Text style={styles.skrYieldNumValue}>
                  {skrIncome.monthlyYieldSkr.toLocaleString(undefined, { maximumFractionDigits: 1 })} SKR
                </Text>
                <Text style={styles.skrYieldNumSub}>
                  ${skrIncome.monthlyYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                </Text>
              </View>
              <View style={styles.skrYieldDivider} />
              <View style={styles.skrYieldNumCol}>
                <Text style={styles.skrYieldNumLabel}>Annual Yield</Text>
                <Text style={styles.skrYieldNumValue}>
                  ${skrIncome.annualYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.skrYieldNumSub}>compounds automatically</Text>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ASSET-EARNED INCOME (DeFi yields, staking, dividends)
            ══════════════════════════════════════════════════════════════════════ */}
        {assets.filter(a => a.annualIncome > 0).length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Asset-Earned Income</Text>
              <TouchableOpacity 
                style={styles.addButtonGold} 
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Text style={styles.addButtonGoldText}>Manage →</Text>
              </TouchableOpacity>
            </View>
            
            <CollapsibleSection
              title="Asset-Earned Income"
              total={`$${assetTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`}
              totalColor="#f4c430"
            >
                <View style={styles.assetIncomeInfoBox}>
                  <Text style={styles.assetIncomeInfoText}>
                    💰 Your assets are working for you! These generate passive income automatically.
                  </Text>
                </View>

                {assets
                  .filter(a => a.annualIncome > 0)
                  .map((asset) => {
                    const monthlyIncome = asset.annualIncome / 12;
                    const apy = asset.metadata.type === 'crypto' && 'apy' in asset.metadata ? asset.metadata.apy : null;
                    
                    return (
                      <View key={asset.id} style={styles.assetIncomeCard}>
                        <View style={styles.cardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardName}>{asset.name}</Text>
                            <Text style={styles.assetIncomeMeta}>
                              {asset.type === 'crypto' ? '🪙 Crypto' : 
                              asset.type === 'defi' ? '⚡ DeFi' : 
                              asset.type === 'stocks' ? '📈 Stocks' : 
                              asset.type === 'real_estate' ? '🏠 Real Estate' : 
                              asset.type === 'business' ? '🏢 Business' : '💰 Other'}
                              {apy && ` · ${(apy * 100).toFixed(2)}% APY`}
                            </Text>
                            <Text style={styles.assetIncomeBalance}>
                              Balance: ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.cardNumbers}>
                          <View>
                            <Text style={styles.assetIncomeAmountLabel}>Monthly Income</Text>
                            <Text style={styles.assetIncomeAmount}>${monthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.assetIncomeAmountLabel}>Annual Income</Text>
                            <Text style={styles.assetIncomeAnnual}>${asset.annualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </CollapsibleSection>
                {/* Total asset income */}
                <View style={styles.assetIncomeTotalCard}>
                  <Text style={styles.assetIncomeTotalLabel}>Total Asset Income</Text>
                  <Text style={styles.assetIncomeTotalAmount}>
                    ${(assets.filter(a => a.annualIncome > 0).reduce((sum, a) => sum + a.annualIncome, 0) / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                  </Text>
                  <Text style={styles.assetIncomeTotalAnnual}>
                    ${assets.filter(a => a.annualIncome > 0).reduce((sum, a) => sum + a.annualIncome, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                  </Text>
                </View>
              </>
            )}
            

      </ScrollView>

      {/* ═══════════════ PAYCHECK BREAKDOWN MODAL ═══════════════ */}
      {selectedPaycheck && (
        <PaycheckBreakdownModal
          visible={!!selectedPaycheck}
          onClose={() => setSelectedPaycheck(null)}
          paycheckSource={selectedPaycheck}
        />
      )}

      {/* ═══════════════ ADD INCOME SOURCE MODAL ═══════════════ */}
      <Modal visible={showIncomeModal} animationType="slide" transparent={true} onRequestClose={() => setShowIncomeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Income Source</Text>

              {/* Type picker */}
              <Text style={styles.label}>Type</Text>
              <View style={styles.pillRow}>
                {(['salary', 'freelance', 'business', 'trading', 'other'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, srcType === t && styles.pillActive]}
                    onPress={() => setSrcType(t)}
                  >
                    <Text style={[styles.pillText, srcType === t && styles.pillTextActive]}>{SOURCE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Context-sensitive helper per type */}
              {srcType === 'salary' && (
                <Text style={styles.helperText}>Enter the net amount that actually deposits into your bank each pay period — after taxes, 401k, healthcare, and other deductions have been taken out.</Text>
              )}
              {srcType === 'trading' && (
                <Text style={styles.helperText}>Log your Drift perpetuals or other trading P&L. Enter the amount you actually withdrew or deposited into your account.</Text>
              )}
              {srcType === 'freelance' && (
                <Text style={styles.helperText}>Enter what you actually receive per payment after any taxes or fees.</Text>
              )}
              {srcType === 'business' && (
                <Text style={styles.helperText}>Enter the net distribution or payment you receive.</Text>
              )}

              {/* Name */}
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={
                  srcType === 'trading'   ? 'e.g., Drift Perps – Jan wins' :
                  srcType === 'salary'    ? 'e.g., Acme Corp Salary' :
                  srcType === 'freelance' ? 'e.g., Freelance – Client X' :
                  srcType === 'business'  ? 'e.g., LLC Distribution' :
                                            'e.g., Side income'
                }
                placeholderTextColor="#666"
                value={srcName}
                onChangeText={setSrcName}
              />

              {/* Amount */}
              <Text style={styles.label}>Amount per Payment</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor="#666" keyboardType="numeric" value={srcAmount} onChangeText={setSrcAmount} />
              </View>

              {/* Frequency */}
              <Text style={styles.label}>How Often?</Text>
              <View style={styles.pillRow}>
                {(['weekly', 'biweekly', 'twice_monthly', 'monthly', 'quarterly'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.pill, srcFreq === f && styles.pillActive]}
                    onPress={() => setSrcFreq(f)}
                  >
                    <Text style={[styles.pillText, srcFreq === f && styles.pillTextActive]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live monthly preview */}
              {parseFloat(srcAmount) > 0 && (
                <Text style={styles.monthlyPreview}>= ${toMonthly(parseFloat(srcAmount), srcFreq).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              )}

              {/* Destination account */}
              <Text style={styles.label}>Deposits Into</Text>
              {srcType === 'trading' && (
                <Text style={styles.helperText}>Pick where your trading wins land — e.g., Crypto.com Cash.</Text>
              )}
              {bankAccounts.length === 0 ? (
                <Text style={styles.noAccountsWarn}>⚠️ No bank accounts added yet — add one in Profile first.</Text>
              ) : (
                <View style={styles.accountList}>
                  {bankAccounts.map((acct) => (
                    <TouchableOpacity
                      key={acct.id}
                      style={[styles.accountOption, srcAccountId === acct.id && styles.accountOptionActive]}
                      onPress={() => setSrcAccountId(acct.id)}
                    >
                      <View>
                        <Text style={[styles.accountOptionName, srcAccountId === acct.id && styles.accountOptionNameActive]}>{acct.name}</Text>
                        <Text style={styles.accountOptionSub}>{acct.institution}  ·  ${(acct.currentBalance ?? 0).toLocaleString()}</Text>
                      </View>
                      {srcAccountId === acct.id && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowIncomeModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtn, (!srcName || !srcAmount || !srcAccountId) && styles.modalBtnDisabled]}
                  onPress={handleAddIncome}
                  disabled={!srcName || !srcAmount || !srcAccountId}
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

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scroll:    { flex: 1, padding: 20 },

  // ── Summary ───────────────────────────────────────────────────────────────
  summaryBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  summaryTopRow:     { flexDirection: 'row', alignItems: 'center' },
  summaryItem:       { flex: 1, alignItems: 'center' },
  summaryDivider:    { width: 1, height: 44, backgroundColor: '#2a2f3e' },
  summaryLabel:      { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  summaryValueGreen: { fontSize: 20, fontWeight: 'bold', color: '#4ade80' },
  summaryValuePurple:{ fontSize: 20, fontWeight: 'bold', color: '#c084fc' },
  summaryPerMo:      { fontSize: 11, fontWeight: '400', color: '#666' },

  // ── Manage Breakdown Card ────────────────────────────────────────────────
  manageBreakdownCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  manageBreakdownContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manageBreakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4c430',
    marginBottom: 4,
  },
  manageBreakdownSub: {
    fontSize: 13,
    color: '#a0a0a0',
  },
  manageBreakdownArrow: {
    fontSize: 24,
    color: '#f4c430',
  },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },

  addButton:     { backgroundColor: '#4ade80', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },

  addButtonBlue:     { backgroundColor: '#60a5fa', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonBlueText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },

  addButtonGold:     { backgroundColor: '#f4c430', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addButtonGoldText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },

  // ── Asset Income Cards ────────────────────────────────────────────────────
  assetIncomeInfoBox: {
    backgroundColor: '#2a1f1e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f4c43044',
  },
  assetIncomeInfoText: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },

  assetIncomeCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  assetIncomeMeta: { fontSize: 13, color: '#f4c430', marginBottom: 2 },
  assetIncomeBalance: { fontSize: 12, color: '#666', marginTop: 2 },
  assetIncomeAmountLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  assetIncomeAmount: { fontSize: 18, fontWeight: 'bold', color: '#4ade80' },
  assetIncomeAnnual: { fontSize: 14, color: '#888' },

  assetIncomeTotalCard: {
    backgroundColor: '#1e2a1e',
    borderRadius: 12,
    padding: 16,
    marginTop: 6,
    borderWidth: 2,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  assetIncomeTotalLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  assetIncomeTotalAmount: { fontSize: 26, fontWeight: 'bold', color: '#4ade80' },
  assetIncomeTotalAnnual: { fontSize: 14, color: '#888', marginTop: 4 },

  // ── Income cards ──────────────────────────────────────────────────────────
  incomeCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardName:   { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  cardMeta:   { fontSize: 13, color: '#4ade80', marginBottom: 3 },
  tapHint:    { fontSize: 11, color: '#666', fontStyle: 'italic' },
  deleteBtn:  { fontSize: 18, color: '#ff4444', padding: 2 },

  cardNumbers:   { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardAmount:    { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  cardFreq:      { fontSize: 12, color: '#666' },
  cardMonthly:   { fontSize: 15, color: '#4ade80', fontWeight: '600', marginLeft: 'auto' },

  // ── Empty states ──────────────────────────────────────────────────────────
  emptyCard:    { padding: 30, alignItems: 'center' },
  emptyText:    { fontSize: 16, color: '#666', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#444', textAlign: 'center' },

  // ── SKR staking yield card ────────────────────────────────────────────
  skrYieldCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  skrYieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skrYieldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skrYieldLogo: { fontSize: 22, color: '#f4c430' },
  skrYieldTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  skrYieldSub: { fontSize: 12, color: '#666', marginTop: 1 },

  skrYieldApyBadge: {
    backgroundColor: '#f4c43022',
    borderWidth: 1,
    borderColor: '#f4c430',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  skrYieldApyText: { fontSize: 12, fontWeight: 'bold', color: '#f4c430' },

  skrYieldNumbers: { flexDirection: 'row', alignItems: 'center' },
  skrYieldNumCol: { flex: 1, alignItems: 'center' },
  skrYieldNumLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  skrYieldNumValue: { fontSize: 16, fontWeight: 'bold', color: '#4ade80' },
  skrYieldNumSub: { fontSize: 11, color: '#666', marginTop: 2 },
  skrYieldDivider: { width: 1, height: 40, backgroundColor: '#2a2f3e' },

  // ── Modals (shared) ───────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle:   { fontSize: 22, fontWeight: 'bold', color: '#4ade80', marginBottom: 18 },
  label:        { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 6, marginTop: 14 },
  helperText:   { fontSize: 13, color: '#666', marginBottom: 6, lineHeight: 18 },
  modalInput:   { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 2, borderColor: '#2a2f3e' },

  inputRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 14, borderWidth: 2, borderColor: '#2a2f3e' },
  currencySymbol:  { fontSize: 20, color: '#4ade80', marginRight: 6 },
  input:           { flex: 1, fontSize: 20, color: '#fff', paddingVertical: 14 },

  // Pill row
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  pillActive:            { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  pillText:              { fontSize: 13, color: '#666' },
  pillTextActive:        { color: '#4ade80', fontWeight: 'bold' },

  monthlyPreview: { fontSize: 14, color: '#4ade80', marginTop: 8, fontWeight: '600' },

  // Account picker
  noAccountsWarn: { fontSize: 14, color: '#ff6b6b', padding: 12, backgroundColor: '#2a1a1e', borderRadius: 8, marginTop: 4 },
  accountList:    { gap: 8 },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  accountOptionActive:     { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  accountOptionName:       { fontSize: 15, color: '#fff', marginBottom: 2 },
  accountOptionNameActive: { color: '#4ade80', fontWeight: 'bold' },
  accountOptionSub:        { fontSize: 12, color: '#666' },
  checkMark:               { fontSize: 18, color: '#4ade80', fontWeight: 'bold' },

  // Modal buttons
  modalButtons:     { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 16 },
  modalCancelBtn:   { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText:  { color: '#a0a0a0', fontSize: 16 },
  modalAddBtn:      { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  modalBtnDisabled: { opacity: 0.4 },
  modalAddText:     { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
});
