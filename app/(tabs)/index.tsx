// app/(tabs)/index.tsx
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Platform } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FreedomScore } from '../../src/components/FreedomScore';
import CashFlowSummary from '../../src/components/CashFlowSummary';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import type { SKRIncomeSnapshot } from '../../src/services/skr';



// ─── Health badge colour map ────────────────────────────────────────────────
const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical:   { bg: '#3a1a1a', text: '#f87171', border: '#f87171' },
  struggling: { bg: '#3a2a1a', text: '#fb923c', border: '#fb923c' },
  stable:     { bg: '#1a2a3a', text: '#60a5fa', border: '#60a5fa' },
  building:   { bg: '#1a3a2a', text: '#4ade80', border: '#4ade80' },
  thriving:   { bg: '#2a3a1a', text: '#a3e635', border: '#a3e635' },
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
  

  const freedom = useFreedomScore();

  // ── cash flow ─────────────────────────────────────────────────────────────
  const cashFlow = useMemo(
    () => analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions),
    [bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions]
  );

  // ── SKR staking income (for insight card) ────────────────────────────────
  const wallets = useStore((state) => state.wallets);
  const [skrIncome, setSKRIncome] = useState<SKRIncomeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let holding = null;
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

  useEffect(() => {
    if (!onboardingComplete) {
      const timer = setTimeout(() => router.replace('/onboarding/welcome'), 500);
      return () => clearTimeout(timer);
    }
  }, [onboardingComplete]);

  if (!onboardingComplete) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // ── derived numbers ───────────────────────────────────────────────────────
  const monthlySurplus  = cashFlow.totalMonthlyNet;
  const monthlyOut      = cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments;
  const runwayMonths    = monthlyOut > 0 ? cashFlow.liquidAssets / monthlyOut : Infinity;
  const runwayLabel     = runwayMonths === Infinity ? '∞' : runwayMonths >= 12 ? `${(runwayMonths / 12).toFixed(1)}y` : `${runwayMonths.toFixed(1)}m`;

  const healthColor = HEALTH_COLORS[cashFlow.healthStatus] || HEALTH_COLORS.stable;

  // ── phase-specific insight card ───────────────────────────────────────────
  const insight = getInsight(cashFlow, freedom, skrIncome);

  const isWeb = Platform.OS === 'web';

  // ── the dashboard body (health badge → quick actions) ───────────────────
  // Extracted so it can be placed either inside a ScrollView (mobile)
  // or inside FreedomScore's sidebar children slot (web).
  const dashboardBody = (
    <View style={styles.content}>

      {/* ── Cash Flow Summary ─────────────────────────────────────────── */}
      <CashFlowSummary cashFlow={cashFlow} />

      {/* ── Health badge ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.healthBadge, { backgroundColor: healthColor.bg, borderColor: healthColor.border }]}
        onPress={() => router.push('/(tabs)/assets')}
      >
        <Text style={[styles.healthEmoji]}>{HEALTH_EMOJI[cashFlow.healthStatus]}</Text>
        <View style={styles.healthTextRow}>
          <Text style={[styles.healthLabel, { color: healthColor.text }]}>
            {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
          </Text>
          <Text style={styles.healthMessage}>{cashFlow.healthMessage}</Text>
        </View>
      </TouchableOpacity>

      {/* ── 4-card metrics grid ───────────────────────────────────────── */}
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Freedom"
          value={freedom.formatted}
          sub={freedom.isKinged ? 'KINGED 👑' : freedom.state}
          color="#f4c430"
        />
        <MetricCard
          label="Runway"
          value={runwayLabel}
          sub="of reserves"
          color="#60a5fa"
        />
        <MetricCard
          label="Monthly In"
          value={`$${cashFlow.totalMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="income"
          color="#4ade80"
        />
        <MetricCard
          label={monthlySurplus >= 0 ? 'Surplus' : 'Deficit'}
          value={`${monthlySurplus >= 0 ? '+' : ''}$${monthlySurplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="/month"
          color={monthlySurplus >= 0 ? '#4ade80' : '#f87171'}
        />
      </View>

      {/* ── Insight card ──────────────────────────────────────────────── */}
      <View style={styles.insightCard}>
        <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        <View>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightBody}>{insight.body}</Text>
        </View>
      </View>

      {/* ── Recommendations (top 2) ─────────────────────────────────── */}
      {cashFlow.recommendations.length > 0 && (
        <View style={styles.recsSection}>
          <Text style={styles.recsSectionTitle}>Next Steps</Text>
          {cashFlow.recommendations.slice(0, 2).map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <Text style={styles.recDot}>›</Text>
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Quick actions ───────────────────────────────────────────── */}
      {/* <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/income')}>
          <Text style={styles.actionButtonText}>💵 Income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/assets')}>
          <Text style={styles.actionButtonText}>📊 Assets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/desires')}>
          <Text style={styles.actionButtonText}>🎯 Desires</Text>
        </TouchableOpacity>
      </View> */}

      {/* ── Additional Tools ───────────────────────────────────── */}
      <View style={styles.toolsSection}>
        <Text style={styles.toolsSectionTitle}>Tools</Text>
        
        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => router.push('/trading')}
        >
          <View style={styles.toolLeft}>
            <Text style={styles.toolIcon}>📊</Text>
            <View>
              <Text style={styles.toolTitle}>Trading Tracker</Text>
              <Text style={styles.toolSubtitle}>Track trades and performance</Text>
            </View>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => router.push('/expenses')}
        >
          <View style={styles.toolLeft}>
            <Text style={styles.toolIcon}>💸</Text>
            <View>
              <Text style={styles.toolTitle}>Daily Expenses</Text>
              <Text style={styles.toolSubtitle}>Log daily spending</Text>
            </View>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toolCard}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.toolLeft}>
            <Text style={styles.toolIcon}>👤</Text>
            <View>
              <Text style={styles.toolTitle}>Profile & Settings</Text>
              <Text style={styles.toolSubtitle}>Accounts and backup</Text>
            </View>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  // ── WEB layout ────────────────────────────────────────────────────────────
  // Header full-width on top, then a flex row: image sidebar left | scrolling
  // dashboard right.  FreedomScore (sidebar mode) owns both panels — the image
  // panel and the children slot.  The children slot has overflow:scroll built in
  // so the dashboard scrolls independently while the image stays pinned.
  if (isWeb) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Full-width header */}
        <View style={styles.header}>
          <Text style={styles.logo}>👑 KingMe</Text>
        </View>

        {/* Sidebar row fills the rest of the viewport */}
        <FreedomScore
          days={freedom.days}
          formatted={freedom.formatted}
          state={freedom.state}
          avatarType={avatarType}
          isKinged={freedom.isKinged}
          layout="sidebar"
        >
          {/* This becomes sidebarContent — it scrolls on its own */}
          <ScrollView style={styles.webDashboardScroll} showsVerticalScrollIndicator={true}>
            {dashboardBody}
          </ScrollView>
        </FreedomScore>
      </View>
    );
  }

  // ── MOBILE layout (unchanged) ─────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>👑 KingMe</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* Full-width hero image with score circle on top */}
        <FreedomScore
          days={freedom.days}
          formatted={freedom.formatted}
          state={freedom.state}
          avatarType={avatarType}
          isKinged={freedom.isKinged}
          layout="hero"
        />

        {/* Dashboard body scrolls below the hero */}
        {dashboardBody}

      </ScrollView>
    </View>
  );
}

// ─── Metric card sub-component ────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
    </View>
  );
}

// ─── Phase-aware insight ──────────────────────────────────────────────────
function getInsight(cf: ReturnType<typeof analyzeAllAccounts>, freedom: any, skrIncome: SKRIncomeSnapshot | null) {
  if (cf.healthStatus === 'critical') {
    return {
      emoji: '⚡',
      title: 'Cash flow needs attention',
      body: cf.totalMonthlyNet < 0
        ? `You're spending ${Math.abs(cf.totalMonthlyNet).toFixed(0)} more than you earn each month. Fix this before anything else.`
        : cf.healthMessage,
    };
  }
  if (cf.healthStatus === 'struggling') {
    return {
      emoji: '🏗️',
      title: 'Building the foundation',
      body: `Only $${cf.totalMonthlyNet.toFixed(0)}/mo surplus. Focus on trimming obligations or boosting income before investing.`,
    };
  }
  if (cf.healthStatus === 'stable') {
    return {
      emoji: '🛡️',
      title: 'Emergency fund in progress',
      body: `You're saving, but runway is still under 3 months. Keep building that cushion.`,
    };
  }

  // ── building / thriving: show SKR insight if staking is active ──────────
  if (skrIncome && skrIncome.monthlyYieldUsd > 0) {
    const monthlyOut = cf.totalMonthlyObligations + cf.totalMonthlyDebtPayments;
    const dailyNeeds = monthlyOut / 30;
    // How many days of freedom does the SKR yield add per month?
    const freedomDaysAdded = dailyNeeds > 0 ? skrIncome.monthlyYieldUsd / dailyNeeds : 0;

    return {
      emoji: '◎',
      title: 'SKR staking → Freedom',
      body: `Your $SKR staking earns $${skrIncome.monthlyYieldUsd.toFixed(2)}/mo in passive yield — that's ${freedomDaysAdded.toFixed(1)} extra days of freedom every month, compounding automatically.`,
    };
  }

  if (cf.healthStatus === 'building') {
    return {
      emoji: '📈',
      title: 'Ready to invest',
      body: `Runway is solid. Your $${cf.totalMonthlyNet.toFixed(0)}/mo surplus can start working for you — staking, lending, or assets.`,
    };
  }
  // thriving
  return {
    emoji: '🚀',
    title: 'Invest aggressively',
    body: `You have ${(cf.totalBalance / (cf.totalMonthlyObligations + cf.totalMonthlyDebtPayments || 1)).toFixed(1)} months runway and $${cf.totalMonthlyNet.toFixed(0)}/mo to deploy. Push toward ${freedom.isKinged ? 'legacy' : 'KINGED'}.`,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', height: '100vh' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#f4c430' },

  header: {
    backgroundColor: '#0a0e1a',
    paddingTop: 50,
    paddingBottom: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#f4c430' },
  scrollContainer: { flex: 1 },
  // Web: the right-hand scroll pane inside the sidebar layout.
  // flex:1 so it fills the remaining width; height:100% so it scrolls
  // independently while the image panel stays pinned.
  webDashboardScroll: { flex: 1, height: '100%' },
  content: { padding: 20 },

  toolsSection: { 
    marginTop: 20,
    marginBottom: 20,
  },
  toolsSectionTitle: { 
    fontSize: 13, 
    color: '#666', 
    textTransform: 'uppercase', 
    letterSpacing: 0.8, 
    marginBottom: 12,
  },
  toolCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  toolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toolIcon: {
    fontSize: 28,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  toolSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  toolArrow: {
    fontSize: 28,
    color: '#666',
  },

  // Health badge
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  healthEmoji: { fontSize: 22, marginTop: 2 },
  healthTextRow: { flex: 1 },
  healthLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  healthMessage: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },

  // Metrics 2×2
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1f2e',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  metricLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  metricSub: { fontSize: 12, color: '#666' },

  // Insight
  insightCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  insightEmoji: { fontSize: 24 },
  insightTitle: { fontSize: 15, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  insightBody: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },

  // Recommendations
  recsSection: { marginBottom: 20 },
  recsSectionTitle: { fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  recRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  recDot: { color: '#f4c430', fontSize: 18, lineHeight: 20 },
  recText: { fontSize: 14, color: '#a0a0a0', flex: 1, lineHeight: 20 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  actionButtonText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
});
