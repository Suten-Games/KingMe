// app/onboarding/reveal.tsx
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useMemo } from 'react';
import { FreedomScore } from '../../src/components/FreedomScore';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { T } from '../../src/theme';

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical:   { bg: '#2a0c0c', text: T.red,    border: T.red },
  struggling: { bg: '#2a1a0c', text: T.orange, border: T.orange },
  stable:     { bg: '#0c1a2a', text: T.blue,   border: T.blue },
  building:   { bg: '#0c2a1a', text: T.green,  border: T.green },
  thriving:   { bg: '#1a2a0c', text: T.green,  border: T.green },
};
const HEALTH_EMOJI: Record<string, string> = {
  critical: '🔴', struggling: '🟠', stable: '🔵', building: '🟢', thriving: '🟡',
};

export default function RevealScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const avatarType = useStore((s) => s.settings.avatarType);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const bankAccounts = useStore((s) => s.bankAccounts);
  const incomeSources = useStore((s) => s.income.sources || []);
  const obligations = useStore((s) => s.obligations);
  const debts = useStore((s) => s.debts);

  const freedom = useFreedomScore();
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

  const monthlyOut = cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments;
  const surplus = cashFlow.totalMonthlyNet;
  const runwayMonths = monthlyOut > 0 ? cashFlow.totalBalance / monthlyOut : Infinity;
  const runwayLabel = runwayMonths === Infinity ? '∞' : runwayMonths >= 12 ? `${(runwayMonths / 12).toFixed(1)}y` : `${runwayMonths.toFixed(1)}m`;
  const healthColor = HEALTH_COLORS[cashFlow.healthStatus] || HEALTH_COLORS.stable;
  const isWeb = Platform.OS === 'web';

  const contentBody = (
    <>
      <View style={st.meaningCard}>
        <Text style={st.meaningTitle}>What does this mean?</Text>
        <Text style={st.meaningBody}>
          Your assets can sustain your current lifestyle for{' '}
          <Text style={st.highlight}>{freedom.formatted}</Text>.{' '}
          {freedom.isKinged
            ? "You've reached financial freedom — your passive income covers everything. 👑"
            : freedom.days === 0
              ? 'Start by building income-generating assets to begin your journey.'
              : 'Keep growing your assets and trimming obligations to extend this.'}
        </Text>
      </View>

      <View style={st.breakdownRow}>
        <BreakdownItem label="Monthly In" value={`$${cashFlow.totalMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color={T.green} />
        <BreakdownItem label="Monthly Out" value={`$${monthlyOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color={T.red} />
        <BreakdownItem label={surplus >= 0 ? 'Surplus' : 'Deficit'} value={`${surplus >= 0 ? '+' : ''}$${surplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color={surplus >= 0 ? T.green : T.red} />
      </View>

      <View style={st.runwayPill}>
        <Text style={st.runwayLabel}>Runway</Text>
        <Text style={st.runwayValue}>{runwayLabel}</Text>
        <Text style={st.runwayNote}>of current reserves</Text>
      </View>

      <View style={[st.healthBadge, { backgroundColor: healthColor.bg, borderColor: healthColor.border }]}>
        <Text style={st.healthEmoji}>{HEALTH_EMOJI[cashFlow.healthStatus]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[st.healthStatus, { color: healthColor.text }]}>
            Cash flow: {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
          </Text>
          <Text style={st.healthMessage}>{cashFlow.healthMessage}</Text>
        </View>
      </View>

      {cashFlow.recommendations.length > 0 && (
        <View style={st.firstRec}>
          <Text style={st.firstRecLabel}>First step</Text>
          <Text style={st.firstRecText}>{cashFlow.recommendations[0]}</Text>
        </View>
      )}

      <TouchableOpacity style={st.button} onPress={handleFinish}>
        <Text style={st.buttonText}>Enter Your Kingdom 👑</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.secondaryButton} onPress={() => router.back()}>
        <Text style={st.secondaryButtonText}>Go Back & Edit</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={st.container}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {isWeb ? (
          <>
            <Text style={st.title}>Your Freedom Score</Text>
            <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
              avatarType={avatarType} isKinged={freedom.isKinged} layout="sidebar">
              <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>{contentBody}</ScrollView>
            </FreedomScore>
          </>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={st.title}>Your Freedom Score</Text>
            <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
              avatarType={avatarType} isKinged={freedom.isKinged} />
            {contentBody}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

function BreakdownItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={st.breakdownItem}>
      <Text style={st.breakdownLabel}>{label}</Text>
      <Text style={[st.breakdownValue, { color }]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  title: { fontSize: 28, fontWeight: 'bold', color: T.gold, textAlign: 'center', marginBottom: 20 },

  meaningCard: { backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md, marginTop: 16, marginBottom: 20 },
  meaningTitle: { fontSize: 16, fontWeight: 'bold', color: T.gold, marginBottom: 6 },
  meaningBody: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },
  highlight: { color: T.gold, fontWeight: 'bold' },

  breakdownRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  breakdownItem: { flex: 1, backgroundColor: T.bgCard, padding: 12, borderRadius: 10, alignItems: 'center' },
  breakdownLabel: { fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  breakdownValue: { fontSize: 17, fontWeight: 'bold' },

  runwayPill: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14, alignItems: 'center', marginBottom: 16 },
  runwayLabel: { fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  runwayValue: { fontSize: 28, fontWeight: 'bold', color: T.blue },
  runwayNote: { fontSize: 12, color: T.textMuted, marginTop: 2 },

  healthBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 16,
  },
  healthEmoji: { fontSize: 22, marginTop: 2 },
  healthStatus: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  healthMessage: { fontSize: 13, color: T.textSecondary, lineHeight: 18 },

  firstRec: {
    backgroundColor: T.bgCard, borderLeftWidth: 3, borderLeftColor: T.gold,
    padding: 14, borderRadius: T.radius.md, marginBottom: 24,
  },
  firstRecLabel: { fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  firstRecText: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },

  button: { backgroundColor: T.gold, padding: 18, borderRadius: T.radius.md, alignItems: 'center', marginBottom: 12 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: T.bg },
  secondaryButton: {
    padding: 18, borderRadius: T.radius.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.border,
  },
  secondaryButtonText: { fontSize: 16, color: T.textSecondary },
});
