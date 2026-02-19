// app/onboarding/reveal.tsx
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useMemo } from 'react';
import { FreedomScore } from '../../src/components/FreedomScore';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';

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

export default function RevealScreen() {
  const router = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const avatarType         = useStore((state) => state.settings.avatarType);
  const completeOnboarding = useStore((state) => state.completeOnboarding);
  const bankAccounts       = useStore((state) => state.bankAccounts);
  const incomeSources      = useStore((state) => state.income.sources || []);
  const obligations        = useStore((state) => state.obligations);
  const debts              = useStore((state) => state.debts);

  const freedom  = useFreedomScore();
  const cashFlow = useMemo(
    () => analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts),
    [bankAccounts, incomeSources, obligations, debts]
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  // ── derived ─────────────────────────────────────────────────────────────
  const monthlyOut   = cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments;
  const surplus      = cashFlow.totalMonthlyNet;
  const runwayMonths = monthlyOut > 0 ? cashFlow.totalBalance / monthlyOut : Infinity;
  const runwayLabel  = runwayMonths === Infinity ? '∞' : runwayMonths >= 12 ? `${(runwayMonths / 12).toFixed(1)}y` : `${runwayMonths.toFixed(1)}m`;
  const healthColor  = HEALTH_COLORS[cashFlow.healthStatus] || HEALTH_COLORS.stable;

  const isWeb = Platform.OS === 'web';

  // Content that goes inside the scroll area
  const contentBody = (
    <>
      {/* ── What it means ── */}
      <View style={styles.meaningCard}>
        <Text style={styles.meaningTitle}>What does this mean?</Text>
        <Text style={styles.meaningBody}>
          Your assets can sustain your current lifestyle for{' '}
          <Text style={styles.highlight}>{freedom.formatted}</Text>.{' '}
          {freedom.isKinged
            ? 'You\'ve reached financial freedom — your passive income covers everything. 👑'
            : freedom.days === 0
              ? 'Start by building income-generating assets to begin your journey.'
              : 'Keep growing your assets and trimming obligations to extend this.'}
        </Text>
      </View>

      {/* ── Breakdown row: In / Out / Surplus ── */}
      <View style={styles.breakdownRow}>
        <BreakdownItem label="Monthly In"  value={`$${cashFlow.totalMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}  color="#4ade80" />
        <BreakdownItem label="Monthly Out" value={`$${monthlyOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}                   color="#f87171" />
        <BreakdownItem label={surplus >= 0 ? 'Surplus' : 'Deficit'} value={`${surplus >= 0 ? '+' : ''}$${surplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color={surplus >= 0 ? '#4ade80' : '#f87171'} />
      </View>

      {/* ── Runway pill ── */}
      <View style={styles.runwayPill}>
        <Text style={styles.runwayLabel}>Runway</Text>
        <Text style={styles.runwayValue}>{runwayLabel}</Text>
        <Text style={styles.runwayNote}>of current reserves</Text>
      </View>

      {/* ── Cash flow health badge ── */}
      <View style={[styles.healthBadge, { backgroundColor: healthColor.bg, borderColor: healthColor.border }]}>
        <Text style={styles.healthEmoji}>{HEALTH_EMOJI[cashFlow.healthStatus]}</Text>
        <View style={styles.healthTextCol}>
          <Text style={[styles.healthStatus, { color: healthColor.text }]}>
            Cash flow: {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
          </Text>
          <Text style={styles.healthMessage}>{cashFlow.healthMessage}</Text>
        </View>
      </View>

      {/* ── First recommendation ── */}
      {cashFlow.recommendations.length > 0 && (
        <View style={styles.firstRec}>
          <Text style={styles.firstRecLabel}>First step</Text>
          <Text style={styles.firstRecText}>{cashFlow.recommendations[0]}</Text>
        </View>
      )}

      {/* ── CTA buttons ── */}
      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Enter Your Kingdom 👑</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Go Back & Edit</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.animatedContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        
        {isWeb ? (
          // ── Web layout: Title on top, sidebar below ──
          <>
            <Text style={styles.title}>Your Freedom Score</Text>
            <FreedomScore
              days={freedom.days}
              formatted={freedom.formatted}
              state={freedom.state}
              avatarType={avatarType}
              isKinged={freedom.isKinged}
              layout="sidebar"
            >
              <ScrollView style={styles.webScrollContent} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                {contentBody}
              </ScrollView>
            </FreedomScore>
          </>
        ) : (
          // ── Mobile layout: Scroll with hero on top ──
          <ScrollView style={styles.mobileScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Your Freedom Score</Text>
            <FreedomScore
              days={freedom.days}
              formatted={freedom.formatted}
              state={freedom.state}
              avatarType={avatarType}
              isKinged={freedom.isKinged}
            />
            {contentBody}
          </ScrollView>
        )}

      </Animated.View>
    </View>
  );
}

// ─── Breakdown sub-component ────────────────────────────────────────────
function BreakdownItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.breakdownItem}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  mobileScroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  webScrollContent: { flex: 1, padding: 20 },
  animatedContent: { flex: 1 },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4c430',
    textAlign: 'center',
    // marginTop: 40,
    marginBottom: 20,
  },

  // Meaning card
  meaningCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  meaningTitle: { fontSize: 16, fontWeight: 'bold', color: '#f4c430', marginBottom: 6 },
  meaningBody: { fontSize: 14, color: '#a0a0a0', lineHeight: 20 },
  highlight: { color: '#f4c430', fontWeight: 'bold' },

  // Breakdown row
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  breakdownItem: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  breakdownLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  breakdownValue: { fontSize: 17, fontWeight: 'bold' },

  // Runway pill
  runwayPill: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  runwayLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  runwayValue: { fontSize: 28, fontWeight: 'bold', color: '#60a5fa' },
  runwayNote: { fontSize: 12, color: '#666', marginTop: 2 },

  // Health badge
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  healthEmoji: { fontSize: 22, marginTop: 2 },
  healthTextCol: { flex: 1 },
  healthStatus: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  healthMessage: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },

  // First rec
  firstRec: {
    backgroundColor: '#1a1f2e',
    borderLeftWidth: 3,
    borderLeftColor: '#f4c430',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  firstRecLabel: { fontSize: 11, color: '#f4c430', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  firstRecText: { fontSize: 14, color: '#a0a0a0', lineHeight: 20 },

  // Buttons
  button: {
    backgroundColor: '#f4c430',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#0a0e1a' },
  secondaryButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  secondaryButtonText: { fontSize: 16, color: '#a0a0a0' },
});
