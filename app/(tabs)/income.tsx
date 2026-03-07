// app/(tabs)/income.tsx - Upgraded styling
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../../src/store/useStore';
import { getMonthlyPreTaxDeductions } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import PaycheckBreakdownModal from '../paycheck';
import type { IncomeSource } from '../../src/types';
import type { SKRHolding, SKRIncomeSnapshot } from '../../src/services/skr';
import CollapsibleSection from '../../src/components/CollapsibleSection';
import { T } from '../../src/theme';
import EmptyStateCard from '../../src/components/EmptyStateCard';

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly': return (amount * 52) / 12;
    case 'biweekly': return (amount * 26) / 12;
    case 'twice_monthly': return amount * 2;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    default: return amount;
  }
}

const PAYCHECK_SOURCES = new Set<string>(['salary', 'freelance', 'business']);
const SOURCE_LABELS: Record<string, string> = { salary: '💼 Salary', freelance: '💻 Freelance', business: '🏢 Business', trading: '📊 Trading', other: '💰 Other' };
const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', biweekly: 'Bi-weekly', twice_monthly: '2x/mo', monthly: 'Monthly', quarterly: 'Quarterly' };

export default function IncomeScreen() {
  const router = useRouter();
  const incomeSources = useStore((s) => s.income.sources || []);
  const bankAccounts = useStore((s) => s.bankAccounts);
  const assets = useStore((s) => s.assets);
  const addIncomeSource = useStore((s) => s.addIncomeSource);
  const removeIncomeSource = useStore((s) => s.removeIncomeSource);
  const preTaxDeductions = useStore((s) => s.preTaxDeductions || []);

  const [selectedPaycheck, setSelectedPaycheck] = useState<IncomeSource | null>(null);
  const driftTrades = useStore((s) => s.driftTrades || []);
  const wallets = useStore((s) => s.wallets);
  const [skrIncome, setSKRIncome] = useState<SKRIncomeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let holding: SKRHolding | null = null;
      if (wallets.length > 0) {
        for (const addr of wallets) {
          holding = await fetchSKRHolding(addr);
          if (holding) {
            // Get price from store assets
            const skrAsset = assets.find(a => (a.metadata as any)?.symbol === 'SKR');
            if (skrAsset) {
              holding.priceUsd = (skrAsset.metadata as any)?.priceUSD || 0;
            }
            break;
          }
        }
      }
      if (!cancelled) setSKRIncome(holding ? calcSKRIncome(holding) : null);
    }
    load();
    return () => { cancelled = true; };
  }, [wallets, assets]);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState<IncomeSource['source']>('salary');
  const [srcAmount, setSrcAmount] = useState('');
  const [srcFreq, setSrcFreq] = useState<IncomeSource['frequency']>('biweekly');
  const [srcAccountId, setSrcAccountId] = useState('');
  const [srcIsLoss, setSrcIsLoss] = useState(false); // For trading: toggle between gain/loss

  const handleAddIncome = () => {
    if (!srcName || !srcAmount || !srcAccountId) return;
    const amt = parseFloat(srcAmount);
    const finalAmount = srcIsLoss ? -Math.abs(amt) : Math.abs(amt);
    addIncomeSource({ id: Date.now().toString(), source: srcType, name: srcName, amount: finalAmount, frequency: srcFreq, bankAccountId: srcAccountId });
    setSrcName(''); setSrcAmount(''); setSrcType('salary'); setSrcFreq('biweekly'); setSrcAccountId(''); setSrcIsLoss(false);
    setShowIncomeModal(false);
  };

  const { paycheckSources, otherSources, paycheckMonthly, otherMonthly } = useMemo(() => {
    const paycheck: IncomeSource[] = []; const other: IncomeSource[] = [];
    let paycheckM = 0, otherM = 0;
    incomeSources.forEach((s) => {
      const m = toMonthly(s.amount, s.frequency);
      if (PAYCHECK_SOURCES.has(s.source)) { paycheck.push(s); paycheckM += m; }
      else { other.push(s); otherM += m; }
    });
    return { paycheckSources: paycheck, otherSources: other, paycheckMonthly: paycheckM, otherMonthly: otherM };
  }, [incomeSources]);

  const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
  const { contributions: ret401kMonthly, employerMatch: employerMatchMonthly } = useMemo(() => getMonthlyPreTaxDeductions(assets), [assets]);
  const totalNetToBank = paycheckMonthly + otherMonthly;
  const paycheckTotal = paycheckSources.reduce((sum, src) => sum + toMonthly(src.amount, src.frequency), 0);
  const assetTotal = (skrIncome?.monthlyYieldUsd || 0) + assets.reduce((sum, a) => sum + (a.annualIncome / 12), 0);
  const tradingTotal = otherSources.reduce((sum, src) => sum + toMonthly(src.amount, src.frequency), 0);
  const getAccountName = (id: string) => bankAccounts.find((a) => a.id === id)?.name || 'Unknown';

  const driftMonthPnl = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return driftTrades
      .filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; })
      .reduce((sum, t) => sum + t.pnlUsdc, 0);
  }, [driftTrades]);

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Top-level empty state when no income at all */}
        {incomeSources.length === 0 && assetTotal <= 0 && (
          <EmptyStateCard category="income" onAction={() => { setSrcType('salary'); setShowIncomeModal(true); }} />
        )}

        {/* Summary */}
        <LinearGradient colors={T.gradients.green} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryBox, { borderColor: T.green + '60' }]}>
          <View style={s.summaryTopRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Total to Bank</Text>
              <Text style={s.summaryValueGreen}>${totalNetToBank.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={s.summaryPerMo}>/mo</Text></Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Pre-Tax Out</Text>
              <Text style={s.summaryValuePurple}>${preTaxMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={s.summaryPerMo}>/mo</Text></Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Employer Match</Text>
              <Text style={[s.summaryValueGreen, { fontSize: 18 }]}>+${employerMatchMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}<Text style={s.summaryPerMo}>/mo</Text></Text>
            </View>
          </View>
        </LinearGradient>

        {/* Paycheck Income */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Paycheck Income</Text>
          <TouchableOpacity style={s.addButton} onPress={() => { setSrcType('salary'); setShowIncomeModal(true); }}>
            <Text style={s.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <CollapsibleSection title="Paycheck Income" total={`$${paycheckTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`} totalColor={T.green}>
          {paycheckSources.length === 0 ? (
            <View style={s.emptyCard}><Text style={s.emptyText}>No paycheck income yet</Text><Text style={s.emptySubtext}>Add your salary, freelance, or business income here. Enter the net amount that lands in your bank.</Text></View>
          ) : (
            paycheckSources.map((src) => (
              <TouchableOpacity key={src.id} onPress={() => setSelectedPaycheck(src)}>
                <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.incomeCard, { borderColor: T.green + '40' }]}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName}>{src.name}</Text>
                      <Text style={s.cardMeta}>{SOURCE_LABELS[src.source] || src.source}  ·  → {getAccountName(src.bankAccountId)}</Text>
                      <Text style={s.tapHint}>Tap to see breakdown</Text>
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeIncomeSource(src.id); }}><Text style={s.deleteBtn}>✕</Text></TouchableOpacity>
                  </View>
                  <View style={s.cardNumbers}>
                    <Text style={s.cardAmount}>${src.amount.toLocaleString()}</Text>
                    <Text style={s.cardFreq}>{FREQ_LABELS[src.frequency]}</Text>
                    <Text style={s.cardMonthly}>${toMonthly(src.amount, src.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={s.manageBreakdownCard} onPress={() => router.push('/paycheck-breakdown')}>
            <View style={s.manageBreakdownContent}>
              <View><Text style={s.manageBreakdownTitle}>⚙️ Manage Paycheck Deductions</Text><Text style={s.manageBreakdownSub}>Add pre-tax, taxes, and post-tax items</Text></View>
              <Text style={s.manageBreakdownArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </CollapsibleSection>

        {/* Trading & Other */}
        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Trading & Other</Text>
          <TouchableOpacity style={s.addButtonBlue} onPress={() => { setSrcType('trading'); setShowIncomeModal(true); }}>
            <Text style={s.addButtonBlueText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <CollapsibleSection title="Trading & Other" total={`$${tradingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`} totalColor={T.blue}>
          {/* Drift Trading CTA */}
          {driftTrades.length > 0 ? (
            <TouchableOpacity onPress={() => router.push('/trading')} activeOpacity={0.7}>
              <LinearGradient colors={['#0c1a2e', '#0a1220', '#080c18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.driftCtaCard}>
                <View style={s.driftCtaHeader}>
                  <Text style={s.driftCtaTitle}>📊 Drift Trading Journal</Text>
                  <View style={s.driftCtaBadge}><Text style={s.driftCtaBadgeText}>{driftTrades.length} trades</Text></View>
                </View>
                <Text style={s.driftCtaSub}>
                  This month: <Text style={{ color: driftMonthPnl >= 0 ? T.green : T.redBright, fontFamily: T.fontExtraBold }}>
                    {driftMonthPnl >= 0 ? '+' : '-'}${Math.abs(driftMonthPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </Text>
                <View style={s.driftCtaBtn}><Text style={s.driftCtaBtnText}>View Trading Journal →</Text></View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/trading')} activeOpacity={0.7}>
              <LinearGradient colors={['#0c1a2e', '#0a1220', '#080c18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.driftCtaCard}>
                <Text style={s.driftCtaTitle}>📈 Trade Perpetuals on Drift</Text>
                <Text style={s.driftCtaDesc}>Track your Drift perps P&L automatically with our Solana integration. Log wins, losses, and see how trading fits into your income.</Text>
                <View style={s.driftCtaBtn}><Text style={s.driftCtaBtnText}>Start Trading Tracker →</Text></View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {otherSources.length === 0 ? (
            <View style={s.emptyCard}><Text style={s.emptyText}>No trading income yet</Text><Text style={s.emptySubtext}>Log Drift perpetuals wins, crypto income, or any non-paycheck deposits here.</Text></View>
          ) : (
            otherSources.map((src) => (
              <LinearGradient key={src.id} colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.incomeCard, { borderLeftColor: T.blue, borderColor: T.blue + '40' }]}>
                <View style={s.cardHeader}>
                  <View><Text style={s.cardName}>{src.name}</Text><Text style={[s.cardMeta, { color: T.blue }]}>{SOURCE_LABELS[src.source] || src.source}  ·  → {getAccountName(src.bankAccountId)}</Text></View>
                  <TouchableOpacity onPress={() => removeIncomeSource(src.id)}><Text style={s.deleteBtn}>✕</Text></TouchableOpacity>
                </View>
                <View style={s.cardNumbers}>
                  <Text style={s.cardAmount}>${src.amount.toLocaleString()}</Text>
                  <Text style={s.cardFreq}>{FREQ_LABELS[src.frequency]}</Text>
                  <Text style={[s.cardMonthly, { color: T.blue }]}>${toMonthly(src.amount, src.frequency).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
                </View>
              </LinearGradient>
            ))
          )}
        </CollapsibleSection>

        {/* SKR Staking Yield */}
        {skrIncome && skrIncome.monthlyYieldUsd > 0 && (
          <LinearGradient colors={['#302818', '#1a1608', '#100c04']} style={s.skrYieldCard}>
            <View style={s.skrYieldHeader}>
              <View style={s.skrYieldTitleRow}>
                <Text style={s.skrYieldLogo}>◎</Text>
                <View><Text style={s.skrYieldTitle}>$SKR Staking Yield</Text><Text style={s.skrYieldSub}>Auto-detected · Passive income</Text></View>
              </View>
              <View style={s.skrYieldApyBadge}><Text style={s.skrYieldApyText}>{(skrIncome.apyUsed * 100).toFixed(0)}% APY</Text></View>
            </View>
            <View style={s.skrYieldNumbers}>
              <View style={s.skrYieldNumCol}>
                <Text style={s.skrYieldNumLabel}>Monthly Yield</Text>
                <Text style={s.skrYieldNumValue}>{skrIncome.monthlyYieldSkr.toLocaleString(undefined, { maximumFractionDigits: 1 })} SKR</Text>
                <Text style={s.skrYieldNumSub}>${skrIncome.monthlyYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</Text>
              </View>
              <View style={s.skrYieldDivider} />
              <View style={s.skrYieldNumCol}>
                <Text style={s.skrYieldNumLabel}>Annual Yield</Text>
                <Text style={s.skrYieldNumValue}>${skrIncome.annualYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                <Text style={s.skrYieldNumSub}>compounds automatically</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Asset-Earned Income */}
        {assets.filter(a => a.annualIncome > 0).length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: 24 }]}>
              <Text style={s.sectionTitle}>Asset-Earned Income</Text>
              <TouchableOpacity style={s.addButtonGold} onPress={() => router.push('/(tabs)/profile')}>
                <Text style={s.addButtonGoldText}>Manage →</Text>
              </TouchableOpacity>
            </View>
            <CollapsibleSection title="Asset-Earned Income" total={`$${assetTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`} totalColor={T.gold}>
              <View style={s.assetIncomeInfoBox}><Text style={s.assetIncomeInfoText}>💰 Your assets are working for you! These generate passive income automatically.</Text></View>
              {assets.filter(a => a.annualIncome > 0).map((asset) => {
                const monthlyIncome = asset.annualIncome / 12;
                const apy = asset.metadata?.type === 'crypto' && 'apy' in asset.metadata ? asset.metadata?.apy : null;
                return (
                  <LinearGradient key={asset.id} colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.assetIncomeCard, { borderColor: T.gold + '30' }]}>
                    <View style={s.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardName}>{asset.name}</Text>
                        <Text style={s.assetIncomeMeta}>
                          {asset.type === 'crypto' ? '🪙 Crypto' : asset.type === 'defi' ? '⚡ DeFi' : asset.type === 'stocks' ? '📈 Stocks' : asset.type === 'real_estate' ? '🏠 Real Estate' : asset.type === 'business' ? '🏢 Business' : '💰 Other'}
                          {apy && ` · ${(apy * 100).toFixed(2)}% APY`}
                        </Text>
                        <Text style={s.assetIncomeBalance}>Balance: ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                      </View>
                    </View>
                    <View style={s.cardNumbers}>
                      <View><Text style={s.assetIncomeAmountLabel}>Monthly Income</Text><Text style={s.assetIncomeAmount}>${monthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo</Text></View>
                      <View style={{ alignItems: 'flex-end' }}><Text style={s.assetIncomeAmountLabel}>Annual Income</Text><Text style={s.assetIncomeAnnual}>${asset.annualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</Text></View>
                    </View>
                  </LinearGradient>
                );
              })}
            </CollapsibleSection>
            <LinearGradient colors={T.gradients.green} style={[s.assetIncomeTotalCard, { borderColor: T.green + '80' }]}>
              <Text style={s.assetIncomeTotalLabel}>Total Asset Income</Text>
              <Text style={s.assetIncomeTotalAmount}>${(assets.filter(a => a.annualIncome > 0).reduce((sum, a) => sum + a.annualIncome, 0) / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</Text>
              <Text style={s.assetIncomeTotalAnnual}>${assets.filter(a => a.annualIncome > 0).reduce((sum, a) => sum + a.annualIncome, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</Text>
            </LinearGradient>
          </>
        )}
      </ScrollView>

      {/* Paycheck Breakdown Modal */}
      {selectedPaycheck && (
        <PaycheckBreakdownModal visible={!!selectedPaycheck} onClose={() => setSelectedPaycheck(null)} paycheckSource={selectedPaycheck} />
      )}

      {/* Add Income Modal */}
      <Modal visible={showIncomeModal} animationType="slide" transparent onRequestClose={() => setShowIncomeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView>
              <Text style={s.modalTitle}>Add Income Source</Text>

              <Text style={s.label}>Type</Text>
              <View style={s.pillRow}>
                {(['salary', 'freelance', 'business', 'trading', 'other'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[s.pill, srcType === t && s.pillActive]} onPress={() => { setSrcType(t); if (t !== 'trading') setSrcIsLoss(false); }}>
                    <Text style={[s.pillText, srcType === t && s.pillTextActive]}>{SOURCE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {srcType === 'salary' && <Text style={s.helperText}>Enter the net amount that actually deposits into your bank each pay period.</Text>}
              {srcType === 'trading' && <Text style={s.helperText}>Log your Drift perpetuals or other trading P&L.</Text>}
              {srcType === 'freelance' && <Text style={s.helperText}>Enter what you actually receive per payment after any taxes or fees.</Text>}
              {srcType === 'business' && <Text style={s.helperText}>Enter the net distribution or payment you receive.</Text>}

              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput}
                placeholder={srcType === 'trading' ? 'e.g., Drift Perps – Jan wins' : srcType === 'salary' ? 'e.g., Acme Corp Salary' : srcType === 'freelance' ? 'e.g., Freelance – Client X' : srcType === 'business' ? 'e.g., LLC Distribution' : 'e.g., Side income'}
                placeholderTextColor="#555" value={srcName} onChangeText={setSrcName} />

              <Text style={s.label}>Amount per Payment</Text>
              {srcType === 'trading' && (
                <View style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
                  <TouchableOpacity
                    style={[s.pill, !srcIsLoss && { backgroundColor: '#4ade80', borderColor: '#4ade80' }]}
                    onPress={() => setSrcIsLoss(false)}
                  >
                    <Text style={[s.pillText, !srcIsLoss && { color: '#080c18', fontWeight: '700' }]}>📈 Gain</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.pill, srcIsLoss && { backgroundColor: '#f87171', borderColor: '#f87171' }]}
                    onPress={() => setSrcIsLoss(true)}
                  >
                    <Text style={[s.pillText, srcIsLoss && { color: '#fff', fontWeight: '700' }]}>📉 Loss</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={s.inputRow}>
                <Text style={[s.currencySymbol, srcIsLoss && { color: '#f87171' }]}>{srcIsLoss ? '-$' : '$'}</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={srcAmount} onChangeText={setSrcAmount} />
              </View>

              <Text style={s.label}>How Often?</Text>
              <View style={s.pillRow}>
                {(['weekly', 'biweekly', 'twice_monthly', 'monthly', 'quarterly'] as const).map((f) => (
                  <TouchableOpacity key={f} style={[s.pill, srcFreq === f && s.pillActive]} onPress={() => setSrcFreq(f)}>
                    <Text style={[s.pillText, srcFreq === f && s.pillTextActive]}>{FREQ_LABELS[f]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {parseFloat(srcAmount) > 0 && (
                <Text style={[s.monthlyPreview, srcIsLoss && { color: '#f87171' }]}>
                  = {srcIsLoss ? '-' : ''}${toMonthly(parseFloat(srcAmount), srcFreq).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                </Text>
              )}

              <Text style={s.label}>Deposits Into</Text>
              {srcType === 'trading' && <Text style={s.helperText}>Pick where your trading wins land.</Text>}
              {bankAccounts.length === 0 ? (
                <Text style={s.noAccountsWarn}>⚠️ No bank accounts added yet — add one in Profile first.</Text>
              ) : (
                <View style={s.accountList}>
                  {bankAccounts.map((acct) => (
                    <TouchableOpacity key={acct.id} style={[s.accountOption, srcAccountId === acct.id && s.accountOptionActive]} onPress={() => setSrcAccountId(acct.id)}>
                      <View>
                        <Text style={[s.accountOptionName, srcAccountId === acct.id && s.accountOptionNameActive]}>{acct.name}</Text>
                        <Text style={s.accountOptionSub}>{acct.institution}  ·  ${(acct.currentBalance ?? 0).toLocaleString()}</Text>
                      </View>
                      {srcAccountId === acct.id && <Text style={s.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowIncomeModal(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[s.modalAddBtn, (!srcName || !srcAmount || !srcAccountId) && s.modalBtnDisabled]} onPress={handleAddIncome} disabled={!srcName || !srcAmount || !srcAccountId}>
                  <Text style={s.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scroll: { flex: 1, padding: 20 },

  // Summary
  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 18, marginBottom: 16 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 44, backgroundColor: T.border },
  summaryLabel: { fontSize: 10, color: T.green + 'bb', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontFamily: T.fontBold },
  summaryValueGreen: { fontSize: 22, color: T.green, fontFamily: T.fontExtraBold },
  summaryValuePurple: { fontSize: 22, color: '#c084fc', fontFamily: T.fontExtraBold },
  summaryPerMo: { fontSize: 11, color: T.textMuted, fontFamily: T.fontRegular },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: T.green, paddingHorizontal: 14, paddingVertical: 6, borderRadius: T.radius.sm },
  addButtonText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },
  addButtonBlue: { backgroundColor: T.blue, paddingHorizontal: 14, paddingVertical: 6, borderRadius: T.radius.sm },
  addButtonBlueText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },
  addButtonGold: { backgroundColor: T.gold, paddingHorizontal: 14, paddingVertical: 6, borderRadius: T.radius.sm },
  addButtonGoldText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },

  // Income cards
  incomeCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.green },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardName: { fontSize: 16, color: T.textPrimary, marginBottom: 3, fontFamily: T.fontBold },
  cardMeta: { fontSize: 13, color: T.green, marginBottom: 3, fontFamily: T.fontMedium },
  tapHint: { fontSize: 11, color: T.textDim, fontStyle: 'italic', fontFamily: T.fontRegular },
  deleteBtn: { fontSize: 18, color: T.redBright, padding: 2 },
  cardNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardAmount: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  cardFreq: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },
  cardMonthly: { fontSize: 15, color: T.green, marginLeft: 'auto', fontFamily: T.fontSemiBold },

  // Manage Breakdown
  manageBreakdownCard: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: T.gold + '60' },
  manageBreakdownContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manageBreakdownTitle: { fontSize: 16, color: T.gold, marginBottom: 4, fontFamily: T.fontBold },
  manageBreakdownSub: { fontSize: 13, color: T.textSecondary, fontFamily: T.fontRegular },
  manageBreakdownArrow: { fontSize: 24, color: T.gold },

  // Asset Income
  assetIncomeInfoBox: { backgroundColor: '#2a1f1e', borderRadius: T.radius.md, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: T.gold + '44' },
  assetIncomeInfoText: { fontSize: 13, color: T.textSecondary, lineHeight: 18, fontFamily: T.fontRegular },
  assetIncomeCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.gold },
  assetIncomeMeta: { fontSize: 13, color: T.gold, marginBottom: 2, fontFamily: T.fontMedium },
  assetIncomeBalance: { fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: T.fontRegular },
  assetIncomeAmountLabel: { fontSize: 11, color: T.textMuted, marginBottom: 2, fontFamily: T.fontBold, textTransform: 'uppercase', letterSpacing: 0.6 },
  assetIncomeAmount: { fontSize: 18, color: T.green, fontFamily: T.fontExtraBold },
  assetIncomeAnnual: { fontSize: 14, color: T.textMuted, fontFamily: T.fontSemiBold },
  assetIncomeTotalCard: { ...T.cardBase, borderWidth: 1.5, padding: 18, alignItems: 'center', marginTop: 6 },
  assetIncomeTotalLabel: { fontSize: 11, color: T.green + 'bb', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, fontFamily: T.fontBold },
  assetIncomeTotalAmount: { fontSize: 28, color: T.green, fontFamily: T.fontExtraBold },
  assetIncomeTotalAnnual: { fontSize: 14, color: T.textMuted, marginTop: 4, fontFamily: T.fontSemiBold },

  // Drift CTA
  driftCtaCard: { ...T.cardBase, borderWidth: 1.5, borderColor: T.blue + '50', marginBottom: 14 },
  driftCtaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  driftCtaTitle: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontBold },
  driftCtaBadge: { backgroundColor: T.blue + '22', borderWidth: 1, borderColor: T.blue, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2 },
  driftCtaBadgeText: { fontSize: 11, color: T.blue, fontFamily: T.fontBold },
  driftCtaSub: { fontSize: 13, color: T.textSecondary, marginBottom: 10, fontFamily: T.fontRegular },
  driftCtaDesc: { fontSize: 13, color: T.textSecondary, lineHeight: 19, marginTop: 4, marginBottom: 12, fontFamily: T.fontRegular },
  driftCtaBtn: { backgroundColor: T.blue, borderRadius: T.radius.sm, paddingVertical: 10, alignItems: 'center' },
  driftCtaBtnText: { color: '#fff', fontSize: 14, fontFamily: T.fontBold },

  // Empty
  emptyCard: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 6, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 13, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  // SKR
  skrYieldCard: { ...T.cardBase, borderWidth: 1.5, borderColor: T.gold + '80', marginTop: 12 },
  skrYieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  skrYieldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skrYieldLogo: { fontSize: 22, color: T.gold },
  skrYieldTitle: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontBold },
  skrYieldSub: { fontSize: 12, color: T.textMuted, marginTop: 1, fontFamily: T.fontRegular },
  skrYieldApyBadge: { backgroundColor: T.gold + '22', borderWidth: 1, borderColor: T.gold, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3 },
  skrYieldApyText: { fontSize: 12, color: T.gold, fontFamily: T.fontBold },
  skrYieldNumbers: { flexDirection: 'row', alignItems: 'center' },
  skrYieldNumCol: { flex: 1, alignItems: 'center' },
  skrYieldNumLabel: { fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3, fontFamily: T.fontBold },
  skrYieldNumValue: { fontSize: 16, color: T.green, fontFamily: T.fontExtraBold },
  skrYieldNumSub: { fontSize: 11, color: T.textMuted, marginTop: 2, fontFamily: T.fontRegular },
  skrYieldDivider: { width: 1, height: 40, backgroundColor: T.border },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 22, color: T.green, marginBottom: 18, fontFamily: T.fontExtraBold },
  label: { fontSize: 15, color: T.textPrimary, marginBottom: 6, marginTop: 14, fontFamily: T.fontBold },
  helperText: { fontSize: 13, color: T.textMuted, marginBottom: 6, lineHeight: 18, fontFamily: T.fontRegular },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, fontFamily: T.fontRegular },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, color: T.green, marginRight: 6, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 14, fontFamily: T.fontSemiBold },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  pillActive: { borderColor: T.green, backgroundColor: '#1a2f1e' },
  pillText: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium },
  pillTextActive: { color: T.green, fontFamily: T.fontBold },
  monthlyPreview: { fontSize: 14, color: T.green, marginTop: 8, fontFamily: T.fontSemiBold },
  noAccountsWarn: { fontSize: 14, color: T.redBright, padding: 12, backgroundColor: '#2a1a1e', borderRadius: T.radius.sm, marginTop: 4, fontFamily: T.fontMedium },
  accountList: { gap: 8 },
  accountOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  accountOptionActive: { borderColor: T.green, backgroundColor: '#1a2f1e' },
  accountOptionName: { fontSize: 15, color: T.textPrimary, marginBottom: 2, fontFamily: T.fontMedium },
  accountOptionNameActive: { color: T.green, fontFamily: T.fontBold },
  accountOptionSub: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },
  checkMark: { fontSize: 18, color: T.green, fontFamily: T.fontBold },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 16 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalAddBtn: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.green, alignItems: 'center' },
  modalBtnDisabled: { opacity: 0.4 },
  modalAddText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },
});
