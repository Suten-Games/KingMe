// app/bank-consolidation.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Bank Account Consolidation Analyzer — paid add-on ($2.99).
// Pure read-only analysis of existing store data.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import { useStore } from '../src/store/useStore';
import { getInsightColor } from '../src/services/tradeInsights';
import {
  analyzeConsolidation,
  type ConsolidationResult,
  type AccountAnalysis,
  type ConsolidationRecommendation,
  type ConsolidationInsight,
  type InstitutionScorecard,
} from '../src/services/consolidationInsights';

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function BankConsolidation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  const kingmeHeader = (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: Math.max(insets.top, 14) }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ padding: 8, marginRight: 2 }}>
          <Text style={{ fontSize: 20, color: '#60a5fa', fontWeight: '600' }}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} activeOpacity={0.7} onPress={() => router.replace('/')}>
          <Image source={require('../src/assets/images/kingmelogo.jpg')} style={{ width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' }} resizeMode="cover" />
          <MaskedView maskElement={<Text style={{ fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>}>
            <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28, opacity: 0, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>
        <View style={{ marginLeft: 'auto' }}><WalletHeaderButton /></View>
      </View>
      <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, marginTop: 10, borderRadius: 1 }} />
    </LinearGradient>
  );

  const bankAccounts = useStore(s => s.bankAccounts);
  const bankTransactions = useStore(s => s.bankTransactions || []);
  const obligations = useStore(s => s.obligations);
  const debts = useStore(s => s.debts);
  const incomeSources = useStore(s => s.income.sources || []);

  const result = useMemo<ConsolidationResult | null>(() => {
    if (bankAccounts.length === 0) return null;
    return analyzeConsolidation({
      bankAccounts,
      bankTransactions,
      obligations,
      debts,
      incomeSources,
    });
  }, [bankAccounts, bankTransactions, obligations, debts, incomeSources]);

  // ── Empty state: no accounts ──────────────────────────────
  if (bankAccounts.length === 0) {
    return (
      <View style={[s.container]}>
        {kingmeHeader}
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>🏦</Text>
          <Text style={s.emptyTitle}>No Bank Accounts</Text>
          <Text style={s.emptySub}>
            Add bank accounts from the Home tab to get consolidation analysis.
          </Text>
        </View>
      </View>
    );
  }

  if (!result) return null;

  const showConsolidationRecs = bankAccounts.length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      {kingmeHeader}
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: 60 }}
      >

      {/* ── Complexity Score Hero ──────────────────────────────── */}
      <ComplexityHero complexity={result.complexity} accountCount={bankAccounts.length} />

      {/* ── Recommendations ───────────────────────────────────── */}
      {showConsolidationRecs && result.recommendations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recommendations</Text>
          {result.recommendations.slice(0, 3).map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </View>
      )}

      {/* ── Account Breakdown ─────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Account Breakdown</Text>
        {result.accounts.map(acct => (
          <AccountCard key={acct.accountId} account={acct} />
        ))}
      </View>

      {/* ── Institution Scorecard ─────────────────────────────── */}
      {result.institutions.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Institution Scorecard</Text>
          {result.institutions.map(inst => (
            <InstitutionCard key={inst.name} inst={inst} />
          ))}
        </View>
      )}

      {/* ── Insights ──────────────────────────────────────────── */}
      {result.insights.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Insights</Text>
          {result.insights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </View>
      )}

      {/* ── What If ───────────────────────────────────────────── */}
      {showConsolidationRecs && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>What If You Consolidated?</Text>
          <WhatIfCard result={result} />
        </View>
      )}

      {/* ── No transactions note ──────────────────────────────── */}
      {bankTransactions.length === 0 && (
        <View style={s.noteCard}>
          <Text style={s.noteEmoji}>📥</Text>
          <Text style={s.noteText}>
            Import CSV bank statements for better activity analysis, fee detection, and recommendations.
          </Text>
        </View>
      )}
      <KingMeFooter />
    </ScrollView>
    </View>
  );
}

// ─── Complexity Hero ─────────────────────────────────────────────────────────

function ComplexityHero({ complexity, accountCount }: {
  complexity: ConsolidationResult['complexity'];
  accountCount: number;
}) {
  const gradeGradient = complexity.score <= 40
    ? ['#1a2a1a', '#0e1a0e', '#0a0e1a'] as [string, string, string]
    : complexity.score <= 55
      ? ['#3a2a0e', '#2a1a06', '#0a0e1a'] as [string, string, string]
      : ['#3a0e0e', '#2a0808', '#0a0e1a'] as [string, string, string];

  return (
    <LinearGradient colors={gradeGradient} style={s.heroCard}>
      <View style={s.heroTop}>
        <View style={s.heroScoreWrap}>
          <Text style={[s.heroScore, { color: complexity.color }]}>{complexity.score}</Text>
          <Text style={s.heroScoreLabel}>/ 100</Text>
        </View>
        <View style={s.heroGradeWrap}>
          <Text style={[s.heroGrade, { color: complexity.color }]}>{complexity.grade}</Text>
          <Text style={s.heroGradeLabel}>Complexity</Text>
        </View>
      </View>
      <Text style={s.heroSub}>
        {accountCount} account{accountCount !== 1 ? 's' : ''} analyzed
      </Text>
      <View style={s.factorGrid}>
        {complexity.factors.map(f => (
          <View key={f.label} style={s.factorItem}>
            <Text style={s.factorValue}>{f.value}</Text>
            <Text style={s.factorLabel}>{f.label}</Text>
            <View style={s.factorBar}>
              <View style={[s.factorFill, { width: `${Math.min((f.weighted / f.weight) * 100, 100)}%`, backgroundColor: complexity.color }]} />
            </View>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: ConsolidationRecommendation }) {
  return (
    <LinearGradient colors={['#1e2640', '#161c34', '#0e1224']} style={s.recCard}>
      <View style={s.recHeader}>
        <Text style={s.recEmoji}>{rec.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.recAction}>{rec.action}</Text>
          <Text style={s.recReason}>{rec.reason}</Text>
        </View>
        {rec.annualSavings > 0 && (
          <View style={s.savingsBadge}>
            <Text style={s.savingsText}>{fmt(rec.annualSavings)}/yr</Text>
          </View>
        )}
      </View>
      <Text style={s.recImpact}>{rec.impact}</Text>
    </LinearGradient>
  );
}

// ─── Account Card ────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: AccountAnalysis }) {
  const activityPct = Math.min(account.monthlyAvgTxns / 30, 1) * 100;

  return (
    <View style={s.acctCard}>
      <View style={s.acctHeader}>
        <View style={{ flex: 1 }}>
          <View style={s.acctNameRow}>
            <Text style={s.acctName}>{account.name}</Text>
            {account.isDormant && (
              <View style={s.dormantBadge}>
                <Text style={s.dormantText}>Dormant</Text>
              </View>
            )}
          </View>
          <Text style={s.acctSub}>
            {account.institution} · {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
          </Text>
        </View>
        <Text style={s.acctBalance}>{fmt(account.balance)}</Text>
      </View>

      {/* Activity meter */}
      <View style={s.meterRow}>
        <Text style={s.meterLabel}>Activity</Text>
        <View style={s.meterTrack}>
          <View style={[s.meterFill, { width: `${activityPct}%` }]} />
        </View>
        <Text style={s.meterValue}>{account.monthlyAvgTxns}/mo</Text>
      </View>

      {/* Stats row */}
      <View style={s.acctStats}>
        {account.annualFees > 0 && (
          <View style={s.statPill}>
            <Text style={s.statPillRed}>💸 {fmt(account.annualFees)}/yr fees</Text>
          </View>
        )}
        {account.billsAssigned > 0 && (
          <View style={s.statPill}>
            <Text style={s.statPillText}>📋 {account.billsAssigned} bill{account.billsAssigned !== 1 ? 's' : ''}</Text>
          </View>
        )}
        {account.incomeSourcesCount > 0 && (
          <View style={s.statPill}>
            <Text style={s.statPillText}>💵 {account.incomeSourcesCount} income</Text>
          </View>
        )}
        <View style={s.statPill}>
          <Text style={account.csvSupport ? s.statPillGreen : s.statPillDim}>
            {account.csvSupport ? '✅ CSV' : '❌ CSV'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Institution Card ────────────────────────────────────────────────────────

function InstitutionCard({ inst }: { inst: InstitutionScorecard }) {
  return (
    <View style={s.instCard}>
      <View style={s.instHeader}>
        <Text style={s.instName}>{inst.name}</Text>
        <Text style={s.instBalance}>{fmt(inst.totalBalance)}</Text>
      </View>
      <View style={s.instStats}>
        <Text style={s.instStat}>{inst.accountCount} account{inst.accountCount !== 1 ? 's' : ''}</Text>
        <Text style={s.instDot}>·</Text>
        <Text style={inst.csvSupport ? s.instStatGreen : s.instStatDim}>
          {inst.csvSupport ? 'CSV ✓' : 'No CSV'}
        </Text>
        {inst.totalAnnualFees > 0 && (
          <>
            <Text style={s.instDot}>·</Text>
            <Text style={s.instStatRed}>{fmt(inst.totalAnnualFees)}/yr fees</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Insight Card ────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: ConsolidationInsight }) {
  const colors = getInsightColor(insight.severity);

  return (
    <LinearGradient colors={colors.gradient} style={[s.insightCard, { borderColor: colors.border }]}>
      <Text style={s.insightEmoji}>{insight.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.insightTitle, { color: colors.text }]}>{insight.title}</Text>
        <Text style={s.insightMsg}>{insight.message}</Text>
      </View>
    </LinearGradient>
  );
}

// ─── What If Card ────────────────────────────────────────────────────────────

function WhatIfCard({ result }: { result: ConsolidationResult }) {
  const { whatIf } = result;
  const hasChange = whatIf.currentAccounts !== whatIf.recommendedAccounts
    || whatIf.currentInstitutions !== whatIf.recommendedInstitutions
    || whatIf.annualFeeSavings > 0;

  if (!hasChange) {
    return (
      <View style={s.whatIfCard}>
        <Text style={s.whatIfNoChange}>Your accounts are already well-consolidated. No major changes recommended.</Text>
      </View>
    );
  }

  return (
    <View style={s.whatIfCard}>
      <View style={s.whatIfRow}>
        {/* Current */}
        <View style={s.whatIfCol}>
          <Text style={s.whatIfLabel}>Current</Text>
          <Text style={s.whatIfBig}>{whatIf.currentAccounts}</Text>
          <Text style={s.whatIfSub}>account{whatIf.currentAccounts !== 1 ? 's' : ''}</Text>
          <Text style={s.whatIfMuted}>{whatIf.currentInstitutions} institution{whatIf.currentInstitutions !== 1 ? 's' : ''}</Text>
        </View>

        <Text style={s.whatIfArrow}>→</Text>

        {/* Recommended */}
        <View style={s.whatIfCol}>
          <Text style={[s.whatIfLabel, { color: '#4ade80' }]}>Recommended</Text>
          <Text style={[s.whatIfBig, { color: '#4ade80' }]}>{whatIf.recommendedAccounts}</Text>
          <Text style={s.whatIfSub}>account{whatIf.recommendedAccounts !== 1 ? 's' : ''}</Text>
          <Text style={s.whatIfMuted}>{whatIf.recommendedInstitutions} institution{whatIf.recommendedInstitutions !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {whatIf.annualFeeSavings > 0 && (
        <View style={s.whatIfSavings}>
          <Text style={s.whatIfSavingsText}>
            Estimated savings: {fmt(whatIf.annualFeeSavings)}/yr
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 16 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 4 },
  backBtn: { fontSize: 16, color: '#f4c430', fontWeight: '600' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430' },

  // Sections
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d0', marginBottom: 10 },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 120 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#e8e0d0', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, paddingHorizontal: 40 },

  // Complexity Hero
  heroCard: {
    borderRadius: 16, padding: 20, marginTop: 16,
    borderWidth: 1.5, borderColor: '#2a3050',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroScoreWrap: { flexDirection: 'row', alignItems: 'baseline' },
  heroScore: { fontSize: 56, fontWeight: '800' },
  heroScoreLabel: { fontSize: 18, color: '#666', marginLeft: 4 },
  heroGradeWrap: { alignItems: 'center' },
  heroGrade: { fontSize: 40, fontWeight: '800' },
  heroGradeLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  heroSub: { fontSize: 13, color: '#888', marginTop: 8 },
  factorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16,
  },
  factorItem: { width: '30%', minWidth: 90 },
  factorValue: { fontSize: 16, fontWeight: '800', color: '#e8e0d0' },
  factorLabel: { fontSize: 10, color: '#888', marginBottom: 4 },
  factorBar: {
    height: 4, borderRadius: 2, backgroundColor: '#1a2040', overflow: 'hidden',
  },
  factorFill: { height: '100%', borderRadius: 2 },

  // Recommendation
  recCard: {
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a3050',
  },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recEmoji: { fontSize: 24 },
  recAction: { fontSize: 15, fontWeight: '800', color: '#fff' },
  recReason: { fontSize: 12, color: '#999', marginTop: 3, lineHeight: 17 },
  recImpact: { fontSize: 12, color: '#60a5fa', marginTop: 8, fontWeight: '600' },
  savingsBadge: {
    backgroundColor: '#4ade8020', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#4ade8060',
  },
  savingsText: { fontSize: 11, fontWeight: '800', color: '#4ade80' },

  // Account Card
  acctCard: {
    backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2a2f3e',
  },
  acctHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  acctNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acctName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  acctSub: { fontSize: 12, color: '#888', marginTop: 2 },
  acctBalance: { fontSize: 16, fontWeight: '800', color: '#fbbf24' },
  dormantBadge: {
    backgroundColor: '#f8717120', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#f8717160',
  },
  dormantText: { fontSize: 10, fontWeight: '700', color: '#f87171' },

  // Activity meter
  meterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  meterLabel: { fontSize: 11, color: '#888', width: 50 },
  meterTrack: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: '#141825',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%', borderRadius: 3, backgroundColor: '#60a5fa',
  },
  meterValue: { fontSize: 11, color: '#888', width: 42, textAlign: 'right' },

  // Stat pills
  acctStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  statPill: {
    backgroundColor: '#141825', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  statPillText: { fontSize: 11, color: '#e8e0d0', fontWeight: '600' },
  statPillRed: { fontSize: 11, color: '#f87171', fontWeight: '600' },
  statPillGreen: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  statPillDim: { fontSize: 11, color: '#555', fontWeight: '600' },

  // Institution Card
  instCard: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#2a2f3e',
  },
  instHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  instName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  instBalance: { fontSize: 14, fontWeight: '800', color: '#fbbf24' },
  instStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  instStat: { fontSize: 12, color: '#888' },
  instStatGreen: { fontSize: 12, color: '#4ade80', fontWeight: '600' },
  instStatDim: { fontSize: 12, color: '#555' },
  instStatRed: { fontSize: 12, color: '#f87171', fontWeight: '600' },
  instDot: { fontSize: 12, color: '#444' },

  // Insight Card
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1,
  },
  insightEmoji: { fontSize: 22 },
  insightTitle: { fontSize: 14, fontWeight: '800' },
  insightMsg: { fontSize: 12, color: '#999', marginTop: 3, lineHeight: 17 },

  // What If
  whatIfCard: {
    backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  whatIfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  whatIfCol: { alignItems: 'center' },
  whatIfLabel: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 4 },
  whatIfBig: { fontSize: 36, fontWeight: '800', color: '#fbbf24' },
  whatIfSub: { fontSize: 12, color: '#888', marginTop: 2 },
  whatIfMuted: { fontSize: 11, color: '#555', marginTop: 2 },
  whatIfArrow: { fontSize: 28, color: '#555', fontWeight: '800' },
  whatIfSavings: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#2a2f3e',
    alignItems: 'center',
  },
  whatIfSavingsText: { fontSize: 14, fontWeight: '800', color: '#4ade80' },
  whatIfNoChange: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },

  // Note card
  noteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#141825', borderRadius: 12, padding: 14, marginTop: 20,
    borderWidth: 1, borderColor: '#2a2f3e', borderStyle: 'dashed' as any,
  },
  noteEmoji: { fontSize: 22 },
  noteText: { flex: 1, fontSize: 12, color: '#888', lineHeight: 17 },
});
