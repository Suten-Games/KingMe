// src/components/GoalsStrip.tsx
// ══════════════════════════════════════════════════════════════════
// Compact horizontal scroll of top goals for the home dashboard.
// Auto-populates CC debt, trading buffer, and accumulation plan goals
// on first load. Shows setup prompt when empty.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import TargetIcon from './icons/TargetIcon';
import {
  loadGoals, saveGoals, refreshGoalProgress,
  calcGoalProgress, sortByReachability, autoPopulateGoals,
  type GoalWithProgress,
} from '../services/goals';

function progressColor(pct: number): string {
  if (pct >= 100) return '#f4c430';
  if (pct >= 75) return '#4ade80';
  if (pct >= 50) return '#60a5fa';
  if (pct >= 25) return '#c084fc';
  return '#f87171';
}

export default function GoalsStrip() {
  const router = useRouter();
  const debts = useStore(s => s.debts);
  const bankAccounts = useStore(s => s.bankAccounts);
  const assets = useStore(s => s.assets);
  const obligations = useStore(s => s.obligations);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Auto-populate on first ever load
        const autoResult = await autoPopulateGoals({
          debts: debts.map(d => ({ ...d, interestRate: d.interestRate })),
          obligations: obligations.map(o => ({ amount: o.amount })),
          assets,
        });
        if (autoResult.created > 0) {
          console.log(`[GOALS] Auto-populated ${autoResult.created} goals:`, autoResult.goalNames);
        }

        let raw = await loadGoals();
        if (raw.length === 0) {
          if (!cancelled) { setGoals([]); setLoaded(true); }
          return;
        }

        raw = await refreshGoalProgress(raw, { debts, bankAccounts, assets });
        await saveGoals(raw);
        const withProgress = raw.map(g => calcGoalProgress(g));
        if (!cancelled) {
          setGoals(sortByReachability(withProgress).filter(g => !g.isComplete).slice(0, 8));
          setLoaded(true);
        }
      } catch (err) {
        console.error('[GOALS_STRIP] Error:', err);
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [debts, bankAccounts, assets, obligations]);

  if (!loaded) return null;

  // ── Empty state: prompt to set up goals ──────────────────────
  if (goals.length === 0) {
    return (
      <TouchableOpacity
        style={st.emptyCard}
        onPress={() => router.push('/goals' as any)}
        activeOpacity={0.8}
      >
        <View style={st.emptyRow}>
          <TargetIcon size={28} color="#f4c430" />
          <View style={{ flex: 1 }}>
            <Text style={st.emptyTitle}>Set Financial Goals</Text>
            <Text style={st.emptyBody}>Pay off debt, build a trading buffer, accumulate tokens — track it all here.</Text>
          </View>
          <Text style={st.emptyArrow}>→</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Has goals: show strip ────────────────────────────────────
  return (
    <View style={st.container}>
      <TouchableOpacity style={st.headerRow} onPress={() => router.push('/goals' as any)} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TargetIcon size={16} color="#f4c430" />
          <Text style={st.header}>Goals</Text>
        </View>
        <Text style={st.seeAll}>See all →</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.scroll}>
        {goals.map(g => {
          const color = progressColor(g.progressPct);
          return (
            <TouchableOpacity
              key={g.id}
              style={st.goalPill}
              onPress={() => router.push('/goals' as any)}
              activeOpacity={0.8}
            >
              {/* Progress ring */}
              <View style={[st.ringOuter, { borderColor: color + '30' }]}>
                <Text style={st.ringEmoji}>{g.emoji}</Text>
              </View>

              <Text style={st.goalName} numberOfLines={1}>{g.name}</Text>
              <Text style={[st.goalPct, { color }]}>{g.progressPct.toFixed(0)}%</Text>

              {/* Mini progress bar */}
              <View style={st.miniBar}>
                <View style={[st.miniBarFill, { width: `${Math.min(g.progressPct, 100)}%`, backgroundColor: color }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  header: { fontSize: 16, fontWeight: '700', color: '#f4c430' },
  seeAll: { fontSize: 12, color: '#f4c43080' },
  scroll: { gap: 10 },

  // Empty prompt
  emptyCard: {
    backgroundColor: '#0c102080',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f4c43018',
  },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#f4c430', marginBottom: 2 },
  emptyBody: { fontSize: 12, color: '#888', lineHeight: 16 },
  emptyArrow: { fontSize: 18, color: '#f4c43060' },

  // Goal pills
  goalPill: {
    width: 100,
    backgroundColor: '#0c1020',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a204030',
  },
  ringOuter: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  ringEmoji: { fontSize: 16 },
  goalName: { fontSize: 11, color: '#b0b0b8', fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  goalPct: { fontSize: 14, fontWeight: '800' },
  miniBar: { width: '100%', height: 3, backgroundColor: '#080c18', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
});
