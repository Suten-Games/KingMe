// src/components/AssetTargetSection.tsx
// ══════════════════════════════════════════════════════════════════
// Drop-in section for the asset detail page (app/asset/[id].tsx).
// Shows existing accumulation plan or offers to create one.
// Import and render: <AssetTargetSection asset={asset} />
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Platform, Alert as RNAlert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { Asset } from '@/types';
import {
  getPlan, createPlan, addEntry, computePlanStats,
  type AccumulationPlan, type PlanStats,
} from '@/services/accumulationPlan';
import {
  addGoal, loadGoals, makeTokenGoal, formatNum,
} from '@/services/goals';

function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}

interface Props {
  asset: Asset;
}

export default function AssetTargetSection({ asset }: Props) {
  const router = useRouter();
  const meta = asset.metadata as any;
  const mint = meta?.tokenMint || meta?.mint || '';
  const symbol = meta?.symbol || asset.name;
  const balance = meta?.balance || 0;
  const pricePerToken = balance > 0 ? asset.value / balance : 0;

  const [plan, setPlan] = useState<AccumulationPlan | null>(null);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup form
  const [showSetup, setShowSetup] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [avgPriceInput, setAvgPriceInput] = useState('');

  // Quick log entry
  const [showLogEntry, setShowLogEntry] = useState(false);
  const [entryType, setEntryType] = useState<'buy' | 'sell'>('buy');
  const [entryTokens, setEntryTokens] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryNotes, setEntryNotes] = useState('');

  const refresh = useCallback(async () => {
    if (!mint) { setLoading(false); return; }
    try {
      const p = await getPlan(mint);
      setPlan(p);
      if (p) {
        setStats(computePlanStats(p, pricePerToken));
      }
    } catch {}
    setLoading(false);
  }, [mint, pricePerToken]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!mint || loading) return null;

  // ── No plan yet: show setup prompt ─────────────────────────
  if (!plan) {
    return (
      <View style={st.container}>
        <TouchableOpacity
          style={st.setupPrompt}
          onPress={() => setShowSetup(true)}
          activeOpacity={0.8}
        >
          <Text style={st.setupEmoji}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.setupTitle}>Set Accumulation Target</Text>
            <Text style={st.setupSub}>Track progress toward a token goal, manage cost basis, and get buy/sell signals.</Text>
          </View>
          <Text style={st.setupArrow}>→</Text>
        </TouchableOpacity>

        {/* Setup Modal */}
        <Modal visible={showSetup} animationType="slide" transparent>
          <View style={st.modalOverlay}>
            <View style={st.modalContent}>
              <Text style={st.modalTitle}>🎯 Set Target for {symbol}</Text>

              <View style={st.infoCard}>
                <Text style={st.infoLabel}>Current holdings</Text>
                <Text style={st.infoValue}>{balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} {symbol}</Text>
                <Text style={st.infoSub}>${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {pricePerToken > 0 ? `$${pricePerToken < 1 ? pricePerToken.toFixed(4) : pricePerToken.toFixed(2)}/token` : ''}</Text>
              </View>

              <Text style={st.fieldLabel}>Target token amount</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="e.g., 1000000"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={targetInput}
                onChangeText={setTargetInput}
                autoFocus
              />

              <Text style={st.fieldLabel}>Avg buy price (optional)</Text>
              <Text style={st.fieldHint}>If you already hold tokens, enter your avg price to track cost basis</Text>
              <TextInput
                style={st.fieldInput}
                placeholder={pricePerToken > 0 ? `Current: $${pricePerToken < 1 ? pricePerToken.toFixed(4) : pricePerToken.toFixed(2)}` : '$0.00'}
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={avgPriceInput}
                onChangeText={setAvgPriceInput}
              />

              {/* Preview */}
              {parseFloat(targetInput) > 0 && (
                <View style={st.preview}>
                  <Text style={st.previewText}>
                    📦 {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {parseFloat(targetInput).toLocaleString()} {symbol}
                    {' '}({((balance / parseFloat(targetInput)) * 100).toFixed(0)}%)
                  </Text>
                  {pricePerToken > 0 && (
                    <Text style={st.previewText}>
                      🛒 Need {formatNum(Math.max(0, parseFloat(targetInput) - balance))} more ≈ ${(Math.max(0, parseFloat(targetInput) - balance) * pricePerToken).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}
                </View>
              )}

              <View style={st.modalButtons}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setShowSetup(false)}>
                  <Text style={st.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.saveBtn, !targetInput && { opacity: 0.5 }]}
                  disabled={!targetInput}
                  onPress={async () => {
                    const target = parseFloat(targetInput.replace(/,/g, ''));
                    if (!target || target <= 0) return xAlert('Enter a target amount');
                    const avgPrice = parseFloat(avgPriceInput) || 0;
                    const initialEntries = avgPrice > 0 && balance > 0
                      ? [{ action: 'buy' as const, date: new Date().toISOString(), tokenAmount: balance, pricePerToken: avgPrice, totalUSD: balance * avgPrice, notes: 'Existing position' }]
                      : [];
                    await createPlan(mint, symbol, target, initialEntries);
                    // Also create a goal
                    const goals = await loadGoals();
                    if (!goals.some(g => g.mint === mint)) {
                      await addGoal(makeTokenGoal(mint, symbol, target, balance));
                    }
                    setShowSetup(false);
                    refresh();
                  }}
                >
                  <Text style={st.saveText}>🎯 Set Target</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Plan exists: show progress ─────────────────────────────
  if (!stats) return null;

  const progressPct = plan.targetAmount > 0 ? (stats.currentHolding / plan.targetAmount) * 100 : 0;
  const needed = Math.max(0, plan.targetAmount - stats.currentHolding);
  const costToComplete = needed * pricePerToken;
  const vsEntry = stats.costBasis > 0
    ? ((pricePerToken - stats.costBasis) / stats.costBasis) * 100
    : 0;

  return (
    <View style={st.container}>
      <Text style={st.sectionTitle}>🎯 Accumulation Target</Text>

      {/* Progress card */}
      <View style={st.progressCard}>
        <View style={st.progressHeader}>
          <Text style={st.progressLabel}>{formatNum(stats.currentHolding)} / {formatNum(plan.targetAmount)} {symbol}</Text>
          <Text style={[st.progressPct, { color: progressPct >= 100 ? '#f4c430' : progressPct >= 50 ? '#4ade80' : '#60a5fa' }]}>
            {progressPct.toFixed(0)}%
          </Text>
        </View>

        <View style={st.barBg}>
          <LinearGradient
            colors={progressPct >= 100 ? ['#f4c43080', '#f4c430'] : ['#4ade8060', '#4ade80']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[st.barFill, { width: `${Math.min(progressPct, 100)}%` }]}
          />
        </View>

        {/* Metrics */}
        <View style={st.metricsRow}>
          {stats.costBasis > 0 && (
            <View style={st.metric}>
              <Text style={st.metricLabel}>Avg Entry</Text>
              <Text style={st.metricValue}>${stats.costBasis < 1 ? stats.costBasis.toFixed(4) : stats.costBasis.toFixed(2)}</Text>
            </View>
          )}
          <View style={st.metric}>
            <Text style={st.metricLabel}>Current</Text>
            <Text style={st.metricValue}>${pricePerToken < 1 ? pricePerToken.toFixed(4) : pricePerToken.toFixed(2)}</Text>
          </View>
          {stats.costBasis > 0 && (
            <View style={st.metric}>
              <Text style={st.metricLabel}>vs Entry</Text>
              <Text style={[st.metricValue, { color: vsEntry >= 0 ? '#4ade80' : '#f87171' }]}>
                {vsEntry >= 0 ? '+' : ''}{vsEntry.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {needed > 0 && (
          <Text style={st.neededText}>
            Need {formatNum(needed)} more {pricePerToken > 0 ? `≈ $${costToComplete.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
          </Text>
        )}

        {progressPct >= 100 && (
          <Text style={st.completeText}>🎯 Target reached!</Text>
        )}

        {/* P&L row */}
        {(stats.unrealizedPnL !== 0 || stats.realizedPnL !== 0) && (
          <View style={st.pnlRow}>
            {stats.netCost > 0 && (
              <View style={st.metric}>
                <Text style={st.metricLabel}>Net Cost</Text>
                <Text style={st.metricValue}>${stats.netCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
            )}
            <View style={st.metric}>
              <Text style={st.metricLabel}>Unrealized</Text>
              <Text style={[st.metricValue, { color: stats.unrealizedPnL >= 0 ? '#4ade80' : '#f87171' }]}>
                {stats.unrealizedPnL >= 0 ? '+' : ''}${stats.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
            </View>
            {stats.realizedPnL !== 0 && (
              <View style={st.metric}>
                <Text style={st.metricLabel}>Realized</Text>
                <Text style={[st.metricValue, { color: stats.realizedPnL >= 0 ? '#4ade80' : '#f87171' }]}>
                  {stats.realizedPnL >= 0 ? '+' : ''}${stats.realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={st.actionRow}>
        <TouchableOpacity style={st.buyBtn} onPress={() => { setEntryType('buy'); setEntryPrice(pricePerToken > 0 ? (pricePerToken < 1 ? pricePerToken.toFixed(6) : pricePerToken.toFixed(2)) : ''); setEntryTokens(''); setEntryNotes(''); setShowLogEntry(true); }}>
          <Text style={st.buyBtnText}>📥 Log Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.sellBtn} onPress={() => { setEntryType('sell'); setEntryPrice(pricePerToken > 0 ? (pricePerToken < 1 ? pricePerToken.toFixed(6) : pricePerToken.toFixed(2)) : ''); setEntryTokens(''); setEntryNotes(''); setShowLogEntry(true); }}>
          <Text style={st.sellBtnText}>📤 Log Sell</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.goalsBtn} onPress={() => router.push('/goals' as any)}>
          <Text style={st.goalsBtnText}>📋 Goals</Text>
        </TouchableOpacity>
      </View>

      {/* Log Entry Modal */}
      <Modal visible={showLogEntry} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>{entryType === 'buy' ? '📥 Log Buy' : '📤 Log Sell'} — {symbol}</Text>

            <Text style={st.fieldLabel}>Token amount</Text>
            <TextInput
              style={st.fieldInput}
              placeholder="e.g., 50000"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={entryTokens}
              onChangeText={setEntryTokens}
              autoFocus
            />

            <Text style={st.fieldLabel}>Price per token</Text>
            <TextInput
              style={st.fieldInput}
              placeholder="$0.00"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={entryPrice}
              onChangeText={setEntryPrice}
            />

            {parseFloat(entryTokens) > 0 && parseFloat(entryPrice) > 0 && (
              <View style={st.preview}>
                <Text style={st.previewText}>
                  Total: ${(parseFloat(entryTokens) * parseFloat(entryPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <Text style={st.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={st.fieldInput}
              placeholder="e.g., Bought the dip"
              placeholderTextColor="#555"
              value={entryNotes}
              onChangeText={setEntryNotes}
            />

            <View style={st.modalButtons}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowLogEntry(false)}>
                <Text style={st.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.saveBtn, (!entryTokens || !entryPrice) && { opacity: 0.5 }]}
                disabled={!entryTokens || !entryPrice}
                onPress={async () => {
                  const tokens = parseFloat(entryTokens.replace(/,/g, ''));
                  const price = parseFloat(entryPrice);
                  if (!tokens || !price) return;
                  await addEntry(mint, {
                    action: entryType,
                    date: new Date().toISOString(),
                    tokenAmount: tokens,
                    pricePerToken: price,
                    totalUSD: tokens * price,
                    notes: entryNotes || undefined,
                  });
                  setShowLogEntry(false);
                  refresh();
                }}
              >
                <Text style={st.saveText}>Log {entryType === 'buy' ? 'Buy' : 'Sell'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#f4c430', marginBottom: 12 },

  // Setup prompt
  setupPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0c1020', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#f4c43020',
  },
  setupEmoji: { fontSize: 28 },
  setupTitle: { fontSize: 15, fontWeight: '700', color: '#f4c430', marginBottom: 2 },
  setupSub: { fontSize: 12, color: '#888', lineHeight: 16 },
  setupArrow: { fontSize: 20, color: '#f4c43060' },

  // Progress card
  progressCard: { backgroundColor: '#0c1020', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a204030' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  progressPct: { fontSize: 20, fontWeight: '800' },
  barBg: { height: 8, backgroundColor: '#080c18', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  barFill: { height: '100%', borderRadius: 4 },
  metricsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  pnlRow: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1a204030' },
  metric: { flex: 1 },
  metricLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 2 },
  neededText: { fontSize: 12, color: '#60a5fa', fontWeight: '600', marginTop: 6 },
  completeText: { fontSize: 14, color: '#f4c430', fontWeight: '700', textAlign: 'center', marginTop: 8 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  buyBtn: { flex: 1, backgroundColor: '#4ade8018', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4ade8030' },
  buyBtnText: { fontSize: 13, fontWeight: '700', color: '#4ade80' },
  sellBtn: { flex: 1, backgroundColor: '#f8717118', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f8717130' },
  sellBtnText: { fontSize: 13, fontWeight: '700', color: '#f87171' },
  goalsBtn: { paddingHorizontal: 16, backgroundColor: '#f4c43010', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f4c43020' },
  goalsBtnText: { fontSize: 13, fontWeight: '700', color: '#f4c430' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0c1020', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#f4c430', marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#888', marginTop: 12, marginBottom: 6 },
  fieldHint: { fontSize: 11, color: '#555', marginBottom: 4 },
  fieldInput: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a3050' },
  infoCard: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#f4c430', borderWidth: 1, borderColor: '#2a3050', marginBottom: 8 },
  infoLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  infoValue: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  infoSub: { fontSize: 12, color: '#888', marginTop: 2 },
  preview: { backgroundColor: '#f4c43008', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#f4c43015' },
  previewText: { fontSize: 13, color: '#b0b0b8', lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#888' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f4c430', alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#080c18' },
});
