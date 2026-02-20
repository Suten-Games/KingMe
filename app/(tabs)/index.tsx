// app/(tabs)/index.tsx
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Platform, Alert, Modal } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FreedomScore } from '../../src/components/FreedomScore';
import CashFlowSummary from '../../src/components/CashFlowSummary';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import type { SKRIncomeSnapshot } from '../../src/services/skr';
import WhatIfCard from '@/components/WhatIfCard';
import WhatIfModal from '@/components/WhatIfModal';
import { Asset, WhatIfScenario } from '@/types';
import { generateSmartScenarios } from '@/utils/scenarioGenerator';
import ThesisAlerts from '@/components/ThesisAlerts';
import { useSwapScenario } from '@/hooks/useSwapScenario';
import { isOnChainScenario } from '@/services/jupiterSwap';
import TradingIncomeWarning from '../../src/components/TradingIncomeWarning';
import PositionAlertCards from '@/components/PositionAlertCards';
import BadgeStrip from '@/components/BadgeStrip';
import SurplusCashPlan from '@/components/SurplusCashPlan';
import ObligationsAuditReminder from '@/components/ObligationsAuditReminder';

const HEALTH_COLORS: Record<string, { bg: string[]; text: string; border: string }> = {
  critical:   { bg: ['#7a2020', '#3a0e0e', '#1a0808'], text: '#ff8a8a', border: '#ff6b6b80' },
  struggling: { bg: ['#7a4a1a', '#3a2210', '#1a1008'], text: '#ffb060', border: '#ffa04080' },
  stable:     { bg: ['#1a4a7a', '#102a4a', '#081828'], text: '#80c0ff', border: '#60a5fa80' },
  building:   { bg: ['#1a7a4a', '#0e3a22', '#081a10'], text: '#60ff9a', border: '#4ade8080' },
  thriving:   { bg: ['#4a7a1a', '#223a0e', '#101a08'], text: '#c0ff60', border: '#a3e63580' },
};

const HEALTH_EMOJI: Record<string, string> = {
  critical: '🔴', struggling: '🟠', stable: '🔵', building: '🟢', thriving: '🟡',
};

export default function HomeScreen() {
  const router = useRouter();
  const onboardingComplete = useStore((state) => state.onboardingComplete);
  const avatarType          = useStore((state) => state.settings.avatarType);
  const bankAccounts        = useStore((state) => state.bankAccounts);
  const incomeSources       = useStore((state) => state.income.sources || []);
  const obligations         = useStore((state) => state.obligations);
  const debts               = useStore((state) => state.debts);
  const assets              = useStore((state) => state.assets);
  const paycheckDeductions  = useStore((state) => state.paycheckDeductions || []);
  const [selectedScenario, setSelectedScenario] = useState<WhatIfScenario | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [infoModal, setInfoModal] = useState<'freedom' | 'runway' | null>(null);

  const scenarios = useStore(s => s.whatIfScenarios);
  const generateScenarios = useStore(s => s.generateScenarios);
  const applyScenario = useStore(s => s.applyScenario);
  const thesisAlerts = useStore(s => s.thesisAlerts);
  const dismissThesisAlert = useStore(s => s.dismissThesisAlert);
  const checkThesisAlerts = useStore(s => s.checkThesisAlerts);

  const { swapState, previewScenario, applyWithSwap, reset } = useSwapScenario();

  const freedom = useFreedomScore();

  const cashFlow = useMemo(
    () => analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions),
    [bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions]
  );

  const wallets = useStore((state) => state.wallets);
  const [skrIncome, setSKRIncome] = useState<SKRIncomeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let holding = null;
      if (wallets.length > 0) { for (const addr of wallets) { holding = await fetchSKRHolding(addr); if (holding) break; } }
      if (!cancelled) setSKRIncome(holding ? calcSKRIncome(holding) : null);
    }
    load();
    return () => { cancelled = true; };
  }, [wallets]);

  useEffect(() => { checkThesisAlerts(); const i = setInterval(() => checkThesisAlerts(), 86400000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!onboardingComplete) { const t = setTimeout(() => router.replace('/onboarding/welcome'), 500); return () => clearTimeout(t); } }, [onboardingComplete]);

  if (!onboardingComplete) {
    return (<View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>);
  }

  useEffect(() => { generateScenarios(); }, []);

  //const handleViewScenario = (s: WhatIfScenario) => { setSelectedScenario(s); setShowModal(true); };
  const handleViewScenario = (s: WhatIfScenario) => {
    setSelectedScenario(s);
    setShowModal(true);
    previewScenario(s);  // Fetches Jupiter quote in background for on-chain scenarios
  };
  // const handleApplyScenario = async (s: WhatIfScenario) => {
  //   try { await applyScenario(s); setShowModal(false); Alert.alert('Scenario Applied! 🎉', 'Your assets have been updated.', [{ text: 'OK' }]); }
  //   catch { Alert.alert('Error', 'Failed to apply scenario'); }
  // };
  const handleApplyScenario = async (s: WhatIfScenario) => {
    const success = await applyWithSwap(s);
    if (success) {
      const onChain = isOnChainScenario(s.type);
      if (!onChain) {
        setShowModal(false);
        reset();
        Alert.alert('Scenario Applied! 🎉', 'Your financial plan has been updated.', [{ text: 'OK' }]);
      }
      // On-chain: modal stays open showing success + tx signature
      // User taps "Done — Close" to dismiss
    }
  };

  const monthlySurplus = cashFlow.totalMonthlyNet;
  const monthlyOut = cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments;
  const runwayMonths = monthlyOut > 0 ? cashFlow.liquidAssets / monthlyOut : Infinity;
  const runwayLabel = runwayMonths === Infinity ? '∞' : runwayMonths >= 12 ? `${(runwayMonths / 12).toFixed(1)}y` : `${runwayMonths.toFixed(1)}m`;
  const healthColor = HEALTH_COLORS[cashFlow.healthStatus] || HEALTH_COLORS.stable;
  const insight = getInsight(cashFlow, freedom, skrIncome);
  const isWeb = Platform.OS === 'web';

  const dashboardBody = (
    <View style={styles.content}>
      <CashFlowSummary cashFlow={cashFlow} />
      <PositionAlertCards  />
      <BadgeStrip />

      <ThesisAlerts alerts={thesisAlerts} onDismiss={dismissThesisAlert} onReview={(id) => router.push(`/asset/${id}`)} />

      {/* ── Health Badge ──────────────────────────────────────────── */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/assets')}>
        <LinearGradient colors={healthColor.bg as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.healthBadge, { borderColor: healthColor.border }]}>
          <Text style={styles.healthEmoji}>{HEALTH_EMOJI[cashFlow.healthStatus]}</Text>
          <View style={styles.healthTextRow}>
            <Text style={[styles.healthLabel, { color: healthColor.text }]}>
              {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
            </Text>
            <Text style={styles.healthMessage}>{cashFlow.healthMessage}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Metrics Grid ──────────────────────────────────────────── */}
      <View style={styles.metricsGrid}>
        <GradientMetricCard label="Freedom" value={freedom.formatted}
          sub={freedom.isKinged ? 'KINGED 👑' : freedom.state} color="#f4c430"
          gradientColors={['#504010', '#2a2008', '#151005']}
          borderColor="#f4c43080" onInfo={() => setInfoModal('freedom')} />
        <GradientMetricCard label="Runway" value={runwayLabel}
          sub="of reserves" color="#60a5fa"
          gradientColors={['#1a3868', '#102040', '#081020']}
          borderColor="#60a5fa80" onInfo={() => setInfoModal('runway')} />
        <GradientMetricCard label="Monthly In"
          value={`$${cashFlow.totalMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="income" color="#4ade80"
          gradientColors={['#184830', '#0e2818', '#08180c']}
          borderColor="#4ade8080" />
        <GradientMetricCard
          label={monthlySurplus >= 0 ? 'Surplus' : 'Deficit'}
          value={`${monthlySurplus >= 0 ? '+' : ''}$${monthlySurplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="/month" color={monthlySurplus >= 0 ? '#4ade80' : '#f87171'}
          gradientColors={monthlySurplus >= 0 ? ['#184830', '#0e2818', '#08180c'] : ['#581818', '#300c0c', '#1a0606']}
          borderColor={monthlySurplus >= 0 ? '#4ade8080' : '#f8717180'} />
      </View>

      {/* ── Insight Card ──────────────────────────────────────────── */}
      <LinearGradient colors={['#222a48', '#161c34', '#0e1224']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.insightCard}>
        <View style={styles.insightEmojiContainer}>
          <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightBody}>{insight.body}</Text>
        </View>
      </LinearGradient>

      <TradingIncomeWarning />
      <SurplusCashPlan />
      <ObligationsAuditReminder />

      {/* ── Recommendations ───────────────────────────────────────── */}
      {cashFlow.recommendations.length > 0 && (
        <View style={styles.recsSection}>
          <Text style={styles.recsSectionTitle}>Next Steps</Text>
          {cashFlow.recommendations.slice(0, 2).map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <LinearGradient colors={['#f4c430', '#e0a010']} style={styles.recDot} />
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Scenarios ─────────────────────────────────────────────── */}
      {scenarios.length > 0 && (
        <View style={styles.scenariosSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎯 Ways to Increase Your Freedom</Text>
            <Text style={styles.sectionSubtitle}>Personalized moves based on your portfolio</Text>
          </View>
          {scenarios.slice(0, 3).map(sc => (
            <WhatIfCard key={sc.id} scenario={sc} onPress={() => handleViewScenario(sc)} />
          ))}
          {scenarios.length > 3 && (
            <TouchableOpacity onPress={() => {}}>
              <LinearGradient colors={['#1a2a50', '#121830']} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All {scenarios.length} Scenarios →</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* <WhatIfModal visible={showModal} scenario={selectedScenario} onClose={() => setShowModal(false)} onApply={handleApplyScenario} /> */}
      <WhatIfModal
        visible={showModal}
        scenario={selectedScenario}
        onClose={() => { setShowModal(false); setSelectedScenario(null); reset(); }}
        onApply={handleApplyScenario}
        swapState={swapState}
      />  

      {/* ── Info Explanation Modal ─────────────────────────────── */}
      <Modal visible={infoModal !== null} animationType="fade" transparent onRequestClose={() => setInfoModal(null)}>
        <TouchableOpacity style={styles.infoModalOverlay} activeOpacity={1} onPress={() => setInfoModal(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <LinearGradient
              colors={infoModal === 'freedom' ? ['#3d3010', '#1e1808', '#0e0c04'] : ['#1a3868', '#102040', '#081020']}
              style={styles.infoModalContent}>
              <View style={styles.infoModalHeader}>
                <Text style={[styles.infoModalTitle, { color: infoModal === 'freedom' ? '#f4c430' : '#60a5fa' }]}>
                  {infoModal === 'freedom' ? '👑 Freedom Score' : '🛡️ Runway'}
                </Text>
                <TouchableOpacity onPress={() => setInfoModal(null)} style={styles.infoModalClose}>
                  <Text style={styles.infoModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {infoModal === 'freedom' ? (
                <View style={styles.infoModalBody}>
                  <Text style={styles.infoModalQuestion}>What is this?</Text>
                  <Text style={styles.infoModalAnswer}>
                    Your Freedom Score is how many months you could survive without working — living entirely off your passive income and liquid assets.
                  </Text>

                  <Text style={styles.infoModalQuestion}>How is it calculated?</Text>
                  <View style={styles.infoFormula}>
                    <Text style={styles.infoFormulaText}>
                      (Liquid Assets + Annual Passive Income){'\n'}÷ Monthly Expenses
                    </Text>
                  </View>
                  <Text style={styles.infoModalAnswer}>
                    Liquid assets include bank balances and liquid crypto. Monthly expenses include all obligations and debt payments. Passive income includes staking yields, dividends, and rental income.
                  </Text>

                  <Text style={styles.infoModalQuestion}>What's the goal?</Text>
                  <Text style={styles.infoModalAnswer}>
                    When your passive income covers 100% of your expenses indefinitely, you reach <Text style={{ color: '#f4c430', fontFamily: 'Inter_700Bold' }}>KINGED</Text> status — true financial freedom.
                  </Text>

                  <View style={styles.infoCurrentBox}>
                    <Text style={styles.infoCurrentLabel}>Your Freedom</Text>
                    <Text style={[styles.infoCurrentValue, { color: '#f4c430' }]}>{freedom.formatted}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.infoModalBody}>
                  <Text style={styles.infoModalQuestion}>What is this?</Text>
                  <Text style={styles.infoModalAnswer}>
                    Runway is how long your liquid cash reserves would last if all income stopped today — covering only your fixed monthly obligations and debt payments.
                  </Text>

                  <Text style={styles.infoModalQuestion}>How is it calculated?</Text>
                  <View style={styles.infoFormula}>
                    <Text style={styles.infoFormulaText}>
                      Total Liquid Cash{'\n'}÷ (Monthly Obligations + Debt Payments)
                    </Text>
                  </View>
                  <Text style={styles.infoModalAnswer}>
                    This only counts cash in your bank accounts — not investments or crypto. It's your pure emergency buffer. Most experts recommend at least 3–6 months of runway.
                  </Text>

                  <Text style={styles.infoModalQuestion}>How is it different from Freedom?</Text>
                  <Text style={styles.infoModalAnswer}>
                    Freedom includes passive income — runway does not. Runway is your raw safety net. Freedom is your long-term trajectory toward financial independence.
                  </Text>

                  <View style={styles.infoCurrentBox}>
                    <Text style={styles.infoCurrentLabel}>Your Runway</Text>
                    <Text style={[styles.infoCurrentValue, { color: '#60a5fa' }]}>{runwayLabel}</Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Tools ─────────────────────────────────────────────────── */}
      <View style={styles.toolsSection}>
        <Text style={styles.toolsSectionTitle}>Tools</Text>
        <ToolCard emoji="📊" title="Trading Tracker" sub="Track trades and performance"
          colors={['#1a2a50', '#121830']} accent="#60a5fa" onPress={() => router.push('/trading')} />
        <ToolCard emoji="💸" title="Daily Expenses" sub="Log daily spending"
          colors={['#402a1a', '#281810']} accent="#fb923c" onPress={() => router.push('/expenses')} />
        <ToolCard emoji="👤" title="Profile & Settings" sub="Accounts and backup"
          colors={['#2a1a40', '#181028']} accent="#a78bfa" onPress={() => router.push('/profile')} />
      </View>
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.container}><StatusBar barStyle="light-content" />
        <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
          avatarType={avatarType} isKinged={freedom.isKinged} layout="sidebar">
          <ScrollView style={styles.webDashboardScroll} showsVerticalScrollIndicator={true}>{dashboardBody}</ScrollView>
        </FreedomScore>
      </View>
    );
  }

  return (
    <View style={styles.container}><StatusBar barStyle="light-content" />
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
          avatarType={avatarType} isKinged={freedom.isKinged} layout="hero" />
        {dashboardBody}
      </ScrollView>
    </View>
  );
}

// ─── Gradient Metric Card ────────────────────────────────────────────────────
function GradientMetricCard({ label, value, sub, color, gradientColors, borderColor, onInfo }: {
  label: string; value: string; sub: string; color: string;
  gradientColors: [string, string, string]; borderColor: string;
  onInfo?: () => void;
}) {
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.metricCard, { borderLeftColor: color, borderColor }]}>
      <View style={styles.metricLabelRow}>
        <Text style={[styles.metricLabel, { color: color + 'cc' }]}>{label}</Text>
        {onInfo && (
          <TouchableOpacity onPress={onInfo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={[styles.infoButton, { borderColor: color + '60' }]}>
              <Text style={[styles.infoButtonText, { color: color + 'bb' }]}>ℹ</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricSub, { color: color + '88' }]}>{sub}</Text>
    </LinearGradient>
  );
}

// ─── Tool Card ───────────────────────────────────────────────────────────────
function ToolCard({ emoji, title, sub, colors, accent, onPress }: {
  emoji: string; title: string; sub: string; colors: [string, string]; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.toolCardGradient, { borderLeftColor: accent, borderColor: accent + '30' }]}>
        <View style={styles.toolLeft}>
          <View style={[styles.toolIconBg, { borderColor: accent + '50', backgroundColor: accent + '15' }]}>
            <Text style={styles.toolIcon}>{emoji}</Text>
          </View>
          <View>
            <Text style={styles.toolTitle}>{title}</Text>
            <Text style={styles.toolSubtitle}>{sub}</Text>
          </View>
        </View>
        <Text style={[styles.toolArrow, { color: accent }]}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Phase insight ───────────────────────────────────────────────────────────
function getInsight(cf: ReturnType<typeof analyzeAllAccounts>, freedom: any, skrIncome: SKRIncomeSnapshot | null) {
  if (cf.healthStatus === 'critical') return { emoji: '⚡', title: 'Cash flow needs attention', body: cf.totalMonthlyNet < 0 ? `You're spending ${Math.abs(cf.totalMonthlyNet).toFixed(0)} more than you earn each month.` : cf.healthMessage };
  if (cf.healthStatus === 'struggling') return { emoji: '🏗️', title: 'Building the foundation', body: `Only $${cf.totalMonthlyNet.toFixed(0)}/mo surplus. Trim obligations or boost income.` };
  if (cf.healthStatus === 'stable') return { emoji: '🛡️', title: 'Emergency fund in progress', body: `You're saving, but runway is under 3 months. Keep building.` };
  if (skrIncome && skrIncome.monthlyYieldUsd > 0) {
    const dailyNeeds = (cf.totalMonthlyObligations + cf.totalMonthlyDebtPayments) / 30;
    const days = dailyNeeds > 0 ? skrIncome.monthlyYieldUsd / dailyNeeds : 0;
    return { emoji: '◎', title: 'SKR staking → Freedom', body: `$SKR earns $${skrIncome.monthlyYieldUsd.toFixed(2)}/mo — ${days.toFixed(1)} extra freedom days/month.` };
  }
  if (cf.healthStatus === 'building') return { emoji: '📈', title: 'Ready to invest', body: `Runway is solid. Deploy your $${cf.totalMonthlyNet.toFixed(0)}/mo surplus into yield.` };
  return { emoji: '🚀', title: 'Invest aggressively', body: `${(cf.totalBalance / (cf.totalMonthlyObligations + cf.totalMonthlyDebtPayments || 1)).toFixed(1)} months runway, $${cf.totalMonthlyNet.toFixed(0)}/mo to deploy. Push toward ${freedom.isKinged ? 'legacy' : 'KINGED'}.` };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18', height: '100vh' },
  loadingContainer: { flex: 1, backgroundColor: '#080c18', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#f4c430', fontFamily: 'Inter_600SemiBold' },
  scrollContainer: { flex: 1 },
  webDashboardScroll: { flex: 1, height: '100%' },
  content: { padding: 20 },

  // Health badge
  healthBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 18, borderRadius: 16, borderWidth: 1.5, marginBottom: 20,
  },
  healthEmoji: { fontSize: 26, marginTop: 1 },
  healthTextRow: { flex: 1 },
  healthLabel: { fontSize: 17, fontFamily: 'Inter_800ExtraBold', marginBottom: 4, letterSpacing: 0.3 },
  healthMessage: { fontSize: 13, color: '#c0c0c0', lineHeight: 20, fontFamily: 'Inter_400Regular' },

  // Metric cards
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    flex: 1, minWidth: '45%', padding: 18, borderRadius: 16,
    borderLeftWidth: 4, borderWidth: 1.5,
  },
  metricLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  metricLabel: {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8,
    fontFamily: 'Inter_800ExtraBold',
  },
  metricValue: { fontSize: 30, marginBottom: 4, fontFamily: 'Inter_800ExtraBold' },
  metricSub: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Info button (on metric cards)
  infoButton: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff08',
  },
  infoButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: -1 },

  // Insight
  insightCard: {
    flexDirection: 'row', gap: 14, padding: 20, borderRadius: 16,
    marginBottom: 20, borderWidth: 1.5, borderColor: '#2a3060',
  },
  insightEmojiContainer: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#0c1020',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#2a3060',
  },
  insightEmoji: { fontSize: 22 },
  insightTitle: { fontSize: 17, color: '#ffffff', marginBottom: 6, fontFamily: 'Inter_700Bold' },
  insightBody: { fontSize: 14, color: '#b8b8c0', lineHeight: 21, fontFamily: 'Inter_400Regular' },

  // Recs
  recsSection: { marginBottom: 24 },
  recsSectionTitle: { fontSize: 11, color: '#f4c430', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontFamily: 'Inter_800ExtraBold' },
  recRow: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  recDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  recText: { fontSize: 14, color: '#c0c0c8', flex: 1, lineHeight: 22, fontFamily: 'Inter_400Regular' },

  // Tools
  toolsSection: { marginTop: 10, marginBottom: 40 },
  toolsSectionTitle: { fontSize: 11, color: '#f4c430', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontFamily: 'Inter_800ExtraBold' },
  toolCardGradient: {
    padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 4, borderWidth: 1, borderRadius: 14, marginBottom: 10,
  },
  toolLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  toolIconBg: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  toolIcon: { fontSize: 22 },
  toolTitle: { fontSize: 15, color: '#fff', marginBottom: 3, fontFamily: 'Inter_600SemiBold' },
  toolSubtitle: { fontSize: 12, color: '#999', fontFamily: 'Inter_400Regular' },
  toolArrow: { fontSize: 30, fontFamily: 'Inter_600SemiBold' },

  // Scenarios
  scenariosSection: { paddingVertical: 20 },
  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 23, color: '#fff', marginBottom: 6, fontFamily: 'Inter_800ExtraBold' },
  sectionSubtitle: { fontSize: 14, color: '#888', fontFamily: 'Inter_400Regular' },
  viewAllButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#60a5fa50' },
  viewAllText: { fontSize: 14, color: '#60a5fa', fontFamily: 'Inter_700Bold' },

  // Info explanation modal
  infoModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  infoModalContent: {
    width: '100%', maxWidth: 420, borderRadius: 20, padding: 24,
    borderWidth: 1.5, borderColor: '#2a305080',
  },
  infoModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  infoModalTitle: { fontSize: 22, fontFamily: 'Inter_800ExtraBold' },
  infoModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff10', justifyContent: 'center', alignItems: 'center' },
  infoModalCloseText: { fontSize: 16, color: '#888', fontFamily: 'Inter_600SemiBold' },
  infoModalBody: { gap: 6 },
  infoModalQuestion: { fontSize: 14, color: '#ffffff', fontFamily: 'Inter_700Bold', marginTop: 12 },
  infoModalAnswer: { fontSize: 14, color: '#b0b0b8', lineHeight: 22, fontFamily: 'Inter_400Regular' },
  infoFormula: {
    backgroundColor: '#00000030', borderRadius: 12, padding: 14, marginVertical: 8,
    borderWidth: 1, borderColor: '#ffffff10',
  },
  infoFormulaText: { fontSize: 14, color: '#e0e0e8', fontFamily: 'Inter_600SemiBold', textAlign: 'center', lineHeight: 22 },
  infoCurrentBox: {
    backgroundColor: '#00000030', borderRadius: 14, padding: 16, marginTop: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#ffffff10',
  },
  infoCurrentLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Inter_700Bold' },
  infoCurrentValue: { fontSize: 32, fontFamily: 'Inter_800ExtraBold' },
});
