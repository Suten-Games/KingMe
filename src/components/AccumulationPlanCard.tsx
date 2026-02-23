// src/components/AccumulationPlanCard.tsx
// ══════════════════════════════════════════════════════════════════
// Shows accumulation plan for a token: target progress, cost basis,
// buy/sell signals, and entry history. Used on home, assets, watchlist.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, Platform, Alert as RNAlert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPlan, savePlan, createPlan, addEntry, removeEntry,
  computePlanStats, generateAccSignals, formatNum, formatPrice,
  type AccumulationPlan, type PlanStats, type AccSignal, type AccEntry,
} from '../services/accumulationPlan';
import { fetchPrices } from '../services/priceTracker';

function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}
function xConfirm(t: string, m: string, fn: () => void) {
  Platform.OS === 'web' ? window.confirm(`${t}\n\n${m}`) && fn() : RNAlert.alert(t, m, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: fn }]);
}

interface Props {
  mint: string;
  symbol: string;
  currentPrice?: number;
  currentHolding?: number;   // from wallet sync — if available, show alongside plan
  allTimeLow?: number | null;
  compact?: boolean;         // compact mode for home screen alerts
}

export default function AccumulationPlanCard({
  mint, symbol, currentPrice: propPrice, currentHolding: walletHolding,
  allTimeLow, compact = false,
}: Props) {
  const [plan, setPlan] = useState<AccumulationPlan | null>(null);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [signals, setSignals] = useState<AccSignal[]>([]);
  const [currentPrice, setCurrentPrice] = useState(propPrice || 0);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  // Setup form
  const [setupTarget, setSetupTarget] = useState('');
  const [setupInitialTokens, setSetupInitialTokens] = useState('');
  const [setupInitialPrice, setSetupInitialPrice] = useState('');

  // Add entry form
  const [entryAction, setEntryAction] = useState<'buy' | 'sell'>('buy');
  const [entryTokens, setEntryTokens] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryNotes, setEntryNotes] = useState('');

  // Load plan
  const loadPlan = useCallback(async () => {
    try {
      const p = await getPlan(mint);
      setPlan(p);
      if (p) {
        // Fetch fresh price if not passed in
        let price = propPrice || 0;
        if (!price) {
          const prices = await fetchPrices([mint]);
          price = prices[mint] || 0;
        }
        setCurrentPrice(price);
        const s = computePlanStats(p, price);
        setStats(s);
        const sigs = generateAccSignals(p, s, price, allTimeLow);
        setSignals(sigs);
      }
    } catch (err) {
      console.error('[ACC_PLAN] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [mint, propPrice, allTimeLow]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Update stats when propPrice changes
  useEffect(() => {
    if (propPrice && propPrice !== currentPrice && plan) {
      setCurrentPrice(propPrice);
      const s = computePlanStats(plan, propPrice);
      setStats(s);
      setSignals(generateAccSignals(plan, s, propPrice, allTimeLow));
    }
  }, [propPrice]);

  // Create plan
  const handleCreate = async () => {
    const target = parseFloat(setupTarget);
    if (!target || target <= 0) return xAlert('Enter a target token amount');

    const initialTokens = parseFloat(setupInitialTokens) || 0;
    const initialPrice = parseFloat(setupInitialPrice) || currentPrice;

    const initialEntries: Omit<AccEntry, 'id'>[] = [];
    if (initialTokens > 0 && initialPrice > 0) {
      initialEntries.push({
        date: new Date().toISOString(),
        action: 'buy',
        tokenAmount: initialTokens,
        pricePerToken: initialPrice,
        totalUSD: initialTokens * initialPrice,
        notes: 'Initial position',
      });
    }

    const p = await createPlan(mint, symbol, target, initialEntries);
    setPlan(p);
    setShowSetup(false);
    setSetupTarget('');
    setSetupInitialTokens('');
    setSetupInitialPrice('');
    await loadPlan();
  };

  // Add entry
  const handleAddEntry = async () => {
    const tokens = parseFloat(entryTokens);
    const price = parseFloat(entryPrice) || currentPrice;
    if (!tokens || tokens <= 0) return xAlert('Enter token amount');
    if (!price || price <= 0) return xAlert('Enter price per token');

    await addEntry(mint, {
      date: new Date().toISOString(),
      action: entryAction,
      tokenAmount: tokens,
      pricePerToken: price,
      totalUSD: tokens * price,
      notes: entryNotes || undefined,
    });

    setShowAddEntry(false);
    setEntryTokens('');
    setEntryPrice('');
    setEntryNotes('');
    await loadPlan();
  };

  // Delete entry
  const handleDeleteEntry = (entryId: string) => {
    xConfirm('Delete entry?', 'Remove this trade from your history?', async () => {
      await removeEntry(mint, entryId);
      await loadPlan();
    });
  };

  // Update target
  const handleUpdateTarget = async (newTarget: number) => {
    if (!plan || newTarget <= 0) return;
    plan.targetAmount = newTarget;
    await savePlan(plan);
    await loadPlan();
  };

  if (loading) return null;

  // ── No plan yet — show create prompt ─────────────────────────
  if (!plan) {
    if (compact) return null; // Don't show setup prompt in compact mode
    return (
      <TouchableOpacity style={st.setupPrompt} onPress={() => setShowSetup(true)}>
        <Text style={st.setupEmoji}>🎯</Text>
        <Text style={st.setupTitle}>Set Accumulation Target</Text>
        <Text style={st.setupBody}>How many {symbol} do you want? Track your cost basis and get buy/sell signals.</Text>

        {/* Setup modal */}
        <Modal visible={showSetup} animationType="slide" transparent>
          <View style={st.modalOverlay}>
            <View style={st.modalContent}>
              <Text style={st.modalTitle}>🎯 Accumulation Plan</Text>
              <Text style={st.modalSubtitle}>Set your target bag size for {symbol}</Text>

              <Text style={st.fieldLabel}>Target tokens</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="e.g. 1000000"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={setupTarget}
                onChangeText={setSetupTarget}
              />
              {parseFloat(setupTarget) > 0 && currentPrice > 0 && (
                <Text style={st.fieldHint}>
                  ≈ ${(parseFloat(setupTarget) * currentPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })} at current price
                </Text>
              )}

              <Text style={st.fieldLabel}>Current holding (optional)</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="Tokens you already hold"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={setupInitialTokens}
                onChangeText={setSetupInitialTokens}
              />

              <Text style={st.fieldLabel}>Avg buy price (optional)</Text>
              <TextInput
                style={st.fieldInput}
                placeholder={currentPrice > 0 ? `Current: $${formatPrice(currentPrice)}` : '$0.00'}
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={setupInitialPrice}
                onChangeText={setSetupInitialPrice}
              />

              <View style={st.modalButtons}>
                <TouchableOpacity style={st.cancelButton} onPress={() => setShowSetup(false)}>
                  <Text style={st.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.confirmButton} onPress={handleCreate}>
                  <Text style={st.confirmText}>Create Plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </TouchableOpacity>
    );
  }

  // ── Has plan — show card ─────────────────────────────────────
  if (!stats) return null;

  const pctFromEntry = stats.costBasis > 0 ? ((currentPrice - stats.costBasis) / stats.costBasis) * 100 : 0;
  const isAboveEntry = pctFromEntry > 0;
  const tokensNeeded = Math.max(0, plan.targetAmount - stats.currentHolding);
  const dollarsToTarget = tokensNeeded * currentPrice;
  const topSignal = signals[0];

  // ── Compact mode (home alerts) ───────────────────────────────
  if (compact && topSignal) {
    return (
      <LinearGradient
        colors={[topSignal.color + '15', '#0a0e1a']}
        style={[st.compactCard, { borderColor: topSignal.color + '30' }]}
      >
        <View style={st.compactRow}>
          <Text style={st.compactEmoji}>{topSignal.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[st.compactTitle, { color: topSignal.color }]}>{topSignal.title}</Text>
            <Text style={st.compactMessage}>{topSignal.message}</Text>
          </View>
        </View>
        <View style={st.compactMeta}>
          <Text style={st.compactMetaText}>
            {formatNum(stats.currentHolding)}/{formatNum(plan.targetAmount)} tokens · Avg: ${formatPrice(stats.costBasis)}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  if (compact && !topSignal) return null;

  // ── Full card ────────────────────────────────────────────────
  return (
    <View style={st.card}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <LinearGradient colors={['#1a204040', '#0a0e1a']} style={st.cardHeader}>
          {/* Header row */}
          <View style={st.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>🎯 {symbol} Accumulation</Text>
              <Text style={st.headerSubtitle}>
                {formatNum(stats.currentHolding)} / {formatNum(plan.targetAmount)} tokens
                {stats.progressPct >= 100 ? ' ✅' : ` · ${stats.progressPct.toFixed(0)}%`}
              </Text>
            </View>
            <Text style={st.expandArrow}>{expanded ? '▾' : '▸'}</Text>
          </View>

          {/* Progress bar */}
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${Math.min(stats.progressPct, 100)}%` }]} />
          </View>

          {/* Signal badge */}
          {topSignal && (
            <View style={[st.signalBadge, { backgroundColor: topSignal.color + '15', borderColor: topSignal.color + '30' }]}>
              <Text style={[st.signalText, { color: topSignal.color }]}>
                {topSignal.emoji} {topSignal.title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={st.cardBody}>
          {/* Key metrics grid */}
          <View style={st.metricsGrid}>
            <View style={st.metric}>
              <Text style={st.metricLabel}>Avg Entry</Text>
              <Text style={st.metricValue}>${formatPrice(stats.costBasis)}</Text>
            </View>
            <View style={st.metric}>
              <Text style={st.metricLabel}>Current</Text>
              <Text style={[st.metricValue, { color: isAboveEntry ? '#4ade80' : '#f87171' }]}>
                ${formatPrice(currentPrice)}
              </Text>
            </View>
            <View style={st.metric}>
              <Text style={st.metricLabel}>vs Entry</Text>
              <Text style={[st.metricValue, { color: isAboveEntry ? '#4ade80' : '#f87171' }]}>
                {pctFromEntry >= 0 ? '+' : ''}{pctFromEntry.toFixed(1)}%
              </Text>
            </View>
            <View style={st.metric}>
              <Text style={st.metricLabel}>Position $</Text>
              <Text style={st.metricValue}>
                ${(stats.currentHolding * currentPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>

          {/* Tokens needed */}
          {tokensNeeded > 0 && (
            <View style={st.neededRow}>
              <Text style={st.neededLabel}>Need {formatNum(tokensNeeded)} more</Text>
              <Text style={st.neededValue}>≈ ${dollarsToTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} at current price</Text>
            </View>
          )}

          {/* P&L */}
          <View style={st.pnlRow}>
            <View style={st.pnlItem}>
              <Text style={st.pnlLabel}>Net Cost</Text>
              <Text style={st.pnlValue}>${stats.netCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
            <View style={st.pnlDivider} />
            <View style={st.pnlItem}>
              <Text style={st.pnlLabel}>Unrealized</Text>
              <Text style={[st.pnlValue, { color: stats.unrealizedPnL >= 0 ? '#4ade80' : '#f87171' }]}>
                {stats.unrealizedPnL >= 0 ? '+' : ''}${stats.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
            </View>
            {stats.realizedPnL !== 0 && (
              <>
                <View style={st.pnlDivider} />
                <View style={st.pnlItem}>
                  <Text style={st.pnlLabel}>Realized</Text>
                  <Text style={[st.pnlValue, { color: stats.realizedPnL >= 0 ? '#4ade80' : '#f87171' }]}>
                    {stats.realizedPnL >= 0 ? '+' : ''}${stats.realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* All signals */}
          {signals.length > 0 && (
            <View style={st.signalsSection}>
              {signals.map((sig, i) => (
                <View key={i} style={[st.signalRow, { backgroundColor: sig.color + '08' }]}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>{sig.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.signalRowTitle, { color: sig.color }]}>{sig.title}</Text>
                    <Text style={st.signalRowMsg}>{sig.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Strategy hint */}
          <View style={st.strategyBox}>
            <Text style={st.strategyText}>
              {isAboveEntry
                ? `📈 You're green. Sell some → lower cost basis → buy back on dip.`
                : `📉 Below entry. ${tokensNeeded > 0 ? 'Accumulate more to lower your avg and reach target.' : 'Hold tight — thesis intact.'}`
              }
            </Text>
          </View>

          {/* Action buttons */}
          <View style={st.actionsRow}>
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: '#4ade8020', borderColor: '#4ade8030' }]} onPress={() => { setEntryAction('buy'); setEntryPrice(currentPrice > 0 ? currentPrice.toString() : ''); setShowAddEntry(true); }}>
              <Text style={[st.actionBtnText, { color: '#4ade80' }]}>📥 Log Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: '#f8717120', borderColor: '#f8717130' }]} onPress={() => { setEntryAction('sell'); setEntryPrice(currentPrice > 0 ? currentPrice.toString() : ''); setShowAddEntry(true); }}>
              <Text style={[st.actionBtnText, { color: '#f87171' }]}>📤 Log Sell</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.actionBtn, { borderColor: '#2a305060' }]} onPress={() => setShowHistory(!showHistory)}>
              <Text style={st.actionBtnText}>📋 {plan.entries.length}</Text>
            </TouchableOpacity>
          </View>

          {/* Entry history */}
          {showHistory && (
            <View style={st.historySection}>
              <Text style={st.historyTitle}>Trade History ({plan.entries.length})</Text>
              {[...plan.entries].reverse().map((e) => (
                <View key={e.id} style={st.historyItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.historyAction, { color: e.action === 'buy' ? '#4ade80' : '#f87171' }]}>
                      {e.action === 'buy' ? '📥' : '📤'} {e.action.toUpperCase()} {formatNum(e.tokenAmount)} @ ${formatPrice(e.pricePerToken)}
                    </Text>
                    <Text style={st.historyDate}>
                      {new Date(e.date).toLocaleDateString()} · ${e.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEntry(e.id)} style={st.historyDelete}>
                    <Text style={{ color: '#f8717180', fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {plan.entries.length === 0 && (
                <Text style={st.historyEmpty}>No trades logged yet</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Add Entry Modal ── */}
      <Modal visible={showAddEntry} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>
              {entryAction === 'buy' ? '📥 Log Buy' : '📤 Log Sell'}
            </Text>

            <View style={st.toggleRow}>
              <TouchableOpacity
                style={[st.toggleBtn, entryAction === 'buy' && { backgroundColor: '#4ade80', borderColor: '#4ade80' }]}
                onPress={() => setEntryAction('buy')}
              >
                <Text style={[st.toggleText, entryAction === 'buy' && { color: '#080c18' }]}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.toggleBtn, entryAction === 'sell' && { backgroundColor: '#f87171', borderColor: '#f87171' }]}
                onPress={() => setEntryAction('sell')}
              >
                <Text style={[st.toggleText, entryAction === 'sell' && { color: '#fff' }]}>Sell</Text>
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>Token amount</Text>
            <TextInput
              style={st.fieldInput}
              placeholder="e.g. 50000"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={entryTokens}
              onChangeText={setEntryTokens}
            />

            <Text style={st.fieldLabel}>Price per token ($)</Text>
            <TextInput
              style={st.fieldInput}
              placeholder={currentPrice > 0 ? `Current: $${formatPrice(currentPrice)}` : '$0.00'}
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={entryPrice}
              onChangeText={setEntryPrice}
            />

            {parseFloat(entryTokens) > 0 && parseFloat(entryPrice) > 0 && (
              <Text style={st.fieldHint}>
                = ${(parseFloat(entryTokens) * parseFloat(entryPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })} total
              </Text>
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
              <TouchableOpacity style={st.cancelButton} onPress={() => setShowAddEntry(false)}>
                <Text style={st.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.confirmButton, { backgroundColor: entryAction === 'buy' ? '#4ade80' : '#f87171' }]}
                onPress={handleAddEntry}
              >
                <Text style={st.confirmText}>Log {entryAction === 'buy' ? 'Buy' : 'Sell'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // Setup prompt
  setupPrompt: { backgroundColor: '#1a204040', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f4c43020', borderStyle: 'dashed', alignItems: 'center' },
  setupEmoji: { fontSize: 36, marginBottom: 8 },
  setupTitle: { fontSize: 16, fontWeight: '700', color: '#f4c430', marginBottom: 6 },
  setupBody: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },

  // Compact card
  compactCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 8 },
  compactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  compactEmoji: { fontSize: 20, marginTop: 2 },
  compactTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  compactMessage: { fontSize: 12, color: '#b0b0b8', lineHeight: 16 },
  compactMeta: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#2a305030' },
  compactMetaText: { fontSize: 11, color: '#888' },

  // Full card
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a305040', marginBottom: 12 },
  cardHeader: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f4c430', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: '#b0b0b8' },
  expandArrow: { fontSize: 18, color: '#888', marginTop: 2 },

  // Progress bar
  progressBar: { height: 6, backgroundColor: '#1a204060', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#f4c430', borderRadius: 3 },

  // Signal badge
  signalBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginTop: 10 },
  signalText: { fontSize: 12, fontWeight: '700' },

  // Card body
  cardBody: { padding: 16, paddingTop: 0 },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metric: { flex: 1, minWidth: '40%', backgroundColor: '#0c102060', borderRadius: 10, padding: 10, alignItems: 'center' },
  metricLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  metricValue: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Needed row
  neededRow: { backgroundColor: '#f4c43008', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  neededLabel: { fontSize: 12, color: '#f4c430', fontWeight: '600' },
  neededValue: { fontSize: 11, color: '#888' },

  // P&L
  pnlRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c102060', borderRadius: 10, padding: 10, marginBottom: 10 },
  pnlItem: { flex: 1, alignItems: 'center' },
  pnlDivider: { width: 1, height: 24, backgroundColor: '#2a305040' },
  pnlLabel: { fontSize: 10, color: '#888', marginBottom: 2, textTransform: 'uppercase' },
  pnlValue: { fontSize: 14, fontWeight: '700', color: '#b0b0b8' },

  // Signals
  signalsSection: { marginBottom: 10, gap: 6 },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: 10 },
  signalRowTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  signalRowMsg: { fontSize: 12, color: '#b0b0b8', lineHeight: 16 },

  // Strategy
  strategyBox: { backgroundColor: '#f4c43008', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f4c43015' },
  strategyText: { fontSize: 12, color: '#b0b0b8', lineHeight: 18 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#b0b0b8' },

  // History
  historySection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a305030' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1a204030' },
  historyAction: { fontSize: 13, fontWeight: '600' },
  historyDate: { fontSize: 11, color: '#666', marginTop: 2 },
  historyDelete: { padding: 8 },
  historyEmpty: { fontSize: 13, color: '#555', textAlign: 'center', paddingVertical: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0c1020', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#888', marginTop: 12, marginBottom: 6 },
  fieldInput: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3050' },
  fieldHint: { fontSize: 12, color: '#f4c430', marginTop: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#888' },
  confirmButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f4c430', alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#080c18' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
});
