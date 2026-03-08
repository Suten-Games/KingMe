// app/goals.tsx
// ══════════════════════════════════════════════════════════════════
// Unified Goals screen — token accumulation, debt payoff, savings
// targets, DeFi buffers, custom goals. Sorted most reachable first.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Platform, Alert as RNAlert, RefreshControl, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useStore } from '../src/store/useStore';
import { parseNumber } from '../src/utils/parseNumber';
import ConfirmModal from '../src/components/ConfirmModal';
import { SwapEvents } from '../src/utils/swapEvents';
import TargetIcon from '../src/components/icons/TargetIcon';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import {
  loadGoals, saveGoals, addGoal, updateGoal, removeGoal,
  refreshGoalProgress, calcGoalProgress, sortByReachability,
  makeDebtGoal, makeSavingsGoal, makeTokenGoal, makeCustomGoal,
  autoPopulateGoals,
  type Goal, type GoalType, type GoalStrategy, type GoalWithProgress,
  formatNum,
} from '../src/services/goals';
import { log, warn, error as logError } from '@/utils/logger';

// ── Cross-platform helpers ───────────────────────────────────────
function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}

// ── Color palette for goal progress ──────────────────────────────
function progressColor(pct: number): string {
  if (pct >= 100) return '#f4c430';
  if (pct >= 75) return '#4ade80';
  if (pct >= 50) return '#60a5fa';
  if (pct >= 25) return '#c084fc';
  return '#f87171';
}

function strategyLabel(s: GoalStrategy): string {
  return s === 'extract' ? 'Extract' : 'Accumulate';
}

const TYPE_EMOJIS: Record<GoalType, string> = {
  accumulate: '🎯',
  debt_payoff: '💳',
  savings_target: '🏦',
  defi_target: '💰',
  custom: '⭐',
};

// ══════════════════════════════════════════════════════════════════
export default function GoalsScreen() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const debts = useStore(s => s.debts);
  const bankAccounts = useStore(s => s.bankAccounts);
  const assets = useStore(s => s.assets);
  const obligations = useStore(s => s.obligations);

  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GoalWithProgress | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Add form state
  const [formType, setFormType] = useState<GoalType>('accumulate');
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('🎯');
  const [formStrategy, setFormStrategy] = useState<GoalStrategy>('accumulate');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formUnit, setFormUnit] = useState('tokens');
  const [formNotes, setFormNotes] = useState('');

  // Linked asset state
  const [formLinkedAssetId, setFormLinkedAssetId] = useState<string | null>(null);
  const [formLinkedMint, setFormLinkedMint] = useState<string | null>(null);
  const [formLinkedDebtId, setFormLinkedDebtId] = useState<string | null>(null);
  const [formLinkedBankId, setFormLinkedBankId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState('');

  // Quick add
  const [quickDebtId, setQuickDebtId] = useState('');
  const [quickBankId, setQuickBankId] = useState('');
  const [quickBankTarget, setQuickBankTarget] = useState('');

  // ── Load & refresh ───────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Auto-populate on first visit (CC debts, trading buffer, acc plans)
      await autoPopulateGoals({
        debts: debts.map(d => ({ ...d, interestRate: d.interestRate })),
        obligations: obligations.map(o => ({ amount: o.amount })),
        assets,
      });

      let raw = await loadGoals();

      // Migrate legacy accumulation_plan goals → asset_tokens
      let migrated = false;
      raw = raw.map(g => {
        if (g.autoSource?.type !== 'accumulation_plan') return g;
        const mint = g.mint || g.autoSource.sourceId;
        const matchedAsset = assets.find(a => {
          const meta = a.metadata as any;
          return meta?.mint === mint || meta?.tokenMint === mint;
        });
        migrated = true;
        return {
          ...g,
          autoSource: { type: 'asset_tokens' as const, sourceId: matchedAsset?.id || mint },
          assetId: matchedAsset?.id || g.assetId,
        };
      });
      if (migrated) await saveGoals(raw);

      // Auto-update from store data
      raw = await refreshGoalProgress(raw, { debts, bankAccounts, assets });
      await saveGoals(raw);

      // Compute progress and sort
      const withProgress = raw.map(g => calcGoalProgress(g));
      setGoals(sortByReachability(withProgress));
    } catch (err) {
      logError('[GOALS] Load error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [debts, bankAccounts, assets, obligations]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-refresh immediately when any swap completes (from any screen)
  useEffect(() => {
    const unsub = SwapEvents.on(() => {
      refresh();
    });
    return () => { unsub(); };
  }, [refresh]);

  // ── Handlers ─────────────────────────────────────────────────
  const resetForm = () => {
    setFormType('accumulate');
    setFormName('');
    setFormEmoji('🎯');
    setFormStrategy('accumulate');
    setFormTarget('');
    setFormCurrent('');
    setFormUnit('tokens');
    setFormNotes('');
    setFormLinkedAssetId(null);
    setFormLinkedMint(null);
    setFormLinkedDebtId(null);
    setFormLinkedBankId(null);
    setAssetSearch('');
    setEditingGoal(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return xAlert('Give your goal a name');
    const target = parseNumber(formTarget);
    if (!target || target <= 0) return xAlert('Set a target amount');
    const current = parseNumber(formCurrent) || 0;

    // Build autoSource if linked
    let autoSource = undefined;
    if (formLinkedMint) {
      autoSource = { type: 'asset_tokens' as const, sourceId: formLinkedAssetId || formLinkedMint };
    } else if (formLinkedDebtId) {
      autoSource = { type: 'debt_balance' as const, sourceId: formLinkedDebtId };
    } else if (formLinkedBankId) {
      autoSource = { type: 'bank_balance' as const, sourceId: formLinkedBankId };
    }

    if (editingGoal) {
      await updateGoal(editingGoal.id, {
        name: formName.trim(),
        emoji: formEmoji,
        strategy: formStrategy,
        targetAmount: target,
        currentAmount: current,
        targetUnit: formUnit,
        notes: formNotes || undefined,
        type: formType,
        mint: formLinkedMint || undefined,
        assetId: formLinkedAssetId || undefined,
        debtId: formLinkedDebtId || undefined,
        bankAccountId: formLinkedBankId || undefined,
        autoSource,
      });
    } else {
      await addGoal({
        type: formType,
        name: formName.trim(),
        emoji: formEmoji,
        strategy: formStrategy,
        targetAmount: target,
        targetUnit: formUnit,
        currentAmount: current,
        notes: formNotes || undefined,
        mint: formLinkedMint || undefined,
        symbol: formLinkedMint ? formUnit : undefined,
        assetId: formLinkedAssetId || undefined,
        debtId: formLinkedDebtId || undefined,
        bankAccountId: formLinkedBankId || undefined,
        autoSource,
      });
    }

    resetForm();
    setShowAddModal(false);
    refresh();
  };

  const handleDelete = (goal: GoalWithProgress) => setConfirmDelete(goal);
  const confirmDeleteGoal = async () => {
    if (!confirmDelete) return;
    await removeGoal(confirmDelete.id);
    setConfirmDelete(null);
    refresh();
  };

  const handleEdit = (goal: GoalWithProgress) => {
    setEditingGoal(goal);
    setFormType(goal.type);
    setFormName(goal.name);
    setFormEmoji(goal.emoji);
    setFormStrategy(goal.strategy);
    setFormTarget(goal.targetAmount.toString());
    setFormCurrent(goal.currentAmount.toString());
    setFormUnit(goal.targetUnit);
    setFormNotes(goal.notes || '');
    setFormLinkedAssetId(goal.assetId || null);
    setFormLinkedMint(goal.mint || null);
    setFormLinkedDebtId(goal.debtId || null);
    setFormLinkedBankId(goal.bankAccountId || null);
    setShowAddModal(true);
  };

  const handleQuickDebt = async () => {
    const debt = debts.find(d => d.id === quickDebtId);
    if (!debt) return xAlert('Select a debt');
    const existing = goals.find(g => g.debtId === debt.id);
    if (existing) return xAlert('Already tracking', `"${existing.name}" already exists.`);
    await addGoal(makeDebtGoal(debt));
    setQuickDebtId('');
    setShowQuickAdd(false);
    refresh();
  };

  const handleQuickBank = async () => {
    const acct = bankAccounts.find(a => a.id === quickBankId);
    const target = parseNumber(quickBankTarget);
    if (!acct) return xAlert('Select an account');
    if (!target || target <= 0) return xAlert('Set a target balance');
    await addGoal(makeSavingsGoal(acct, target));
    setQuickBankId('');
    setQuickBankTarget('');
    setShowQuickAdd(false);
    refresh();
  };

  const handleMarkComplete = async (goal: GoalWithProgress) => {
    await updateGoal(goal.id, { completedAt: new Date().toISOString() });
    refresh();
  };

  const handleUpdateManual = async (goal: GoalWithProgress, newAmount: string) => {
    const val = parseNumber(newAmount);
    if (isNaN(val)) return;
    await updateGoal(goal.id, { currentAmount: val });
    refresh();
  };

  // ── Stats ────────────────────────────────────────────────────
  const completedCount = goals.filter(g => g.isComplete).length;
  const activeCount = goals.length - completedCount;
  const avgProgress = goals.length > 0
    ? goals.reduce((sum, g) => sum + g.progressPct, 0) / goals.length
    : 0;

  // ══════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: '#080c18' }}>
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[st.kmHeader, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={st.kmHeaderRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={st.kmBackButton}>
          <Text style={st.kmBackText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.kmBrand} activeOpacity={0.7} onPress={() => router.replace('/')}>
          <Image source={require('../src/assets/images/kingmelogo.jpg')} style={st.kmLogo} resizeMode="cover" />
          <MaskedView maskElement={<Text style={[st.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>KingMe</Text>}>
            <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={[st.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}>KingMe</Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>
        <View style={{ marginLeft: 'auto' }}>
          <WalletHeaderButton />
        </View>
      </View>
      <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.kmAccent} />
    </LinearGradient>

    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f4c430" />}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TargetIcon size={22} color="#f4c430" />
        <Text style={st.title}>Goals</Text>
      </View>
      <Text style={st.subtitle}>Most reachable first</Text>

      {/* Summary strip */}
      {goals.length > 0 && (
        <View style={st.summaryRow}>
          <View style={st.summaryItem}>
            <Text style={st.summaryNum}>{activeCount}</Text>
            <Text style={st.summaryLabel}>Active</Text>
          </View>
          <View style={st.summaryDivider} />
          <View style={st.summaryItem}>
            <Text style={[st.summaryNum, { color: '#4ade80' }]}>{completedCount}</Text>
            <Text style={st.summaryLabel}>Done</Text>
          </View>
          <View style={st.summaryDivider} />
          <View style={st.summaryItem}>
            <Text style={[st.summaryNum, { color: progressColor(avgProgress) }]}>{avgProgress.toFixed(0)}%</Text>
            <Text style={st.summaryLabel}>Avg</Text>
          </View>
        </View>
      )}

      {/* Add buttons */}
      <View style={st.addRow}>
        <TouchableOpacity style={st.addButton} onPress={() => { resetForm(); setShowAddModal(true); }}>
          <Text style={st.addButtonText}>+ New Goal</Text>
        </TouchableOpacity>
        {(debts.length > 0 || bankAccounts.length > 0) && (
          <TouchableOpacity style={st.quickButton} onPress={() => setShowQuickAdd(true)}>
            <Text style={st.quickButtonText}>⚡ Quick Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Goal cards */}
      {goals.length === 0 && (
        <View style={st.emptyCard}>
          <TargetIcon size={40} color="#f4c430" />
          <Text style={st.emptyTitle}>No goals yet</Text>
          <Text style={st.emptyBody}>
            Set targets for anything: accumulate 1M WHALE, pay off your CC, build a $23K trading buffer, or save $10K in your emergency fund.
          </Text>
        </View>
      )}

      {goals.map((goal) => {
        const pColor = progressColor(goal.progressPct);
        const isComplete = goal.isComplete;

        return (
          <View key={goal.id} style={[st.goalCard, isComplete && st.goalCardComplete]}>
            <TouchableOpacity
              onPress={() => handleEdit(goal)}
              onLongPress={() => handleDelete(goal)}
              activeOpacity={0.85}
            >
              {/* Top row: emoji + name + progress % */}
              <View style={st.goalHeader}>
                <Text style={st.goalEmoji}>{goal.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[st.goalName, isComplete && st.goalNameComplete]}>
                    {goal.name}
                    {isComplete && ' ✅'}
                  </Text>
                  <Text style={st.goalType}>
                    {goal.strategy === 'extract' ? '📤 Extract' : '📥 Accumulate'}
                    {goal.notes ? ` · ${goal.notes}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={st.goalDeleteBtn}
                  onPress={(e) => { e.stopPropagation(); handleDelete(goal); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={st.goalDeleteText}>✕</Text>
                </TouchableOpacity>
                <View style={st.goalPctCircle}>
                  <Text style={[st.goalPctText, { color: pColor }]}>
                    {goal.progressPct.toFixed(0)}%
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={st.progressBarBg}>
                <LinearGradient
                  colors={[pColor + '80', pColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.progressBarFill, { width: `${Math.min(goal.progressPct, 100)}%` }]}
                />
              </View>

              {/* Numbers row */}
              <View style={st.numbersRow}>
                <Text style={st.numbersCurrentLabel}>
                  {goal.strategy === 'extract' ? 'Remaining' : 'Current'}
                </Text>
                <Text style={st.numbersCurrent}>
                  {goal.targetUnit === '$' ? '$' : ''}
                  {goal.strategy === 'extract'
                    ? goal.currentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : formatNum(goal.currentAmount)
                  }
                  {goal.targetUnit !== '$' ? ` ${goal.targetUnit}` : ''}
                </Text>
                <View style={st.numbersArrow}>
                  <Text style={{ color: '#555', fontSize: 12 }}>→</Text>
                </View>
                <Text style={st.numbersTargetLabel}>Target</Text>
                <Text style={st.numbersTarget}>
                  {goal.strategy === 'extract' ? '$0'
                    : `${goal.targetUnit === '$' ? '$' : ''}${formatNum(goal.targetAmount)}${goal.targetUnit !== '$' ? ` ${goal.targetUnit}` : ''}`
                  }
                </Text>
              </View>

              {/* Remaining label */}
              <Text style={[st.remainingText, { color: pColor }]}>
                {goal.remainingLabel}
              </Text>
            </TouchableOpacity>

            {/* Quick update for manual goals */}
            {!goal.autoSource && !isComplete && (
              <ManualUpdater
                goal={goal}
                onUpdate={(val) => handleUpdateManual(goal, val)}
              />
            )}
          </View>
        );
      })}

      <View style={{ height: 40 }} />

      {/* ═══════════ ADD / EDIT MODAL ═══════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <ScrollView style={st.modalScroll}>
            <View style={st.modalContent}>
              <Text style={st.modalTitle}>{editingGoal ? '✏️ Edit Goal' : '🎯 New Goal'}</Text>

              {/* Strategy toggle */}
              <Text style={st.fieldLabel}>What are you doing?</Text>
              <View style={st.toggleRow}>
                <TouchableOpacity
                  style={[st.toggleBtn, formStrategy === 'accumulate' && { backgroundColor: '#4ade80', borderColor: '#4ade80' }]}
                  onPress={() => setFormStrategy('accumulate')}
                >
                  <Text style={[st.toggleText, formStrategy === 'accumulate' && { color: '#080c18' }]}>📥 Accumulating</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.toggleBtn, formStrategy === 'extract' && { backgroundColor: '#f87171', borderColor: '#f87171' }]}
                  onPress={() => setFormStrategy('extract')}
                >
                  <Text style={[st.toggleText, formStrategy === 'extract' && { color: '#fff' }]}>📤 Paying off</Text>
                </TouchableOpacity>
              </View>

              {/* ── Link to existing asset/debt/account ─────────── */}
              <View style={st.linkSection}>
                <Text style={st.linkSectionTitle}>🔗 Link to an asset, debt, or account</Text>
                <Text style={st.linkSectionHint}>Tap to auto-fill and sync progress automatically</Text>

                {/* Show linked badge if selected */}
                {(formLinkedAssetId || formLinkedDebtId || formLinkedBankId) ? (
                  <View style={st.linkedBadge}>
                    <Text style={st.linkedBadgeText}>
                      ✓ Linked: {formName || '(selected)'}
                    </Text>
                    <TouchableOpacity onPress={() => { setFormLinkedAssetId(null); setFormLinkedMint(null); setFormLinkedDebtId(null); setFormLinkedBankId(null); }}>
                      <Text style={{ color: '#f87171', fontSize: 14, marginLeft: 8 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Search bar */}
                    <TextInput
                      style={st.linkSearchInput}
                      placeholder="🔍  Search by name..."
                      placeholderTextColor="#555"
                      value={assetSearch}
                      onChangeText={setAssetSearch}
                    />

                    {/* Quick-pick chips: show all items, filtered by search */}
                    <ScrollView style={st.linkResults} nestedScrollEnabled>
                      {/* Crypto assets */}
                      {assets
                        .filter(a => a.type === 'crypto' && (!assetSearch || 
                          a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
                          ((a.metadata as any)?.symbol || '').toLowerCase().includes(assetSearch.toLowerCase())
                        ))
                        .slice(0, assetSearch ? 6 : 4)
                        .map(a => {
                          const meta = a.metadata as any;
                          const sym = meta?.symbol || a.name;
                          const bal = meta?.balance || 0;
                          const mint = meta?.tokenMint || meta?.mint || '';
                          return (
                            <TouchableOpacity
                              key={a.id}
                              style={st.linkChip}
                              onPress={() => {
                                setFormLinkedAssetId(a.id);
                                setFormLinkedMint(mint);
                                setFormLinkedDebtId(null);
                                setFormLinkedBankId(null);
                                setFormName(formName || `${sym} Target`);
                                setFormUnit(sym);
                                setFormCurrent(bal.toString());
                                setFormEmoji('🎯');
                                setFormStrategy('accumulate');
                                setFormType('accumulate');
                                setAssetSearch('');
                              }}
                            >
                              <Text style={st.linkChipEmoji}>🪙</Text>
                              <Text style={st.linkChipName} numberOfLines={1}>{sym}</Text>
                              <Text style={st.linkChipSub}>{bal > 0 ? `${formatNum(bal)}` : ''} · ${a.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </TouchableOpacity>
                          );
                        })}

                      {/* Debts */}
                      {debts
                        .filter(d => !assetSearch || d.name.toLowerCase().includes(assetSearch.toLowerCase()))
                        .slice(0, assetSearch ? 4 : 3)
                        .map(d => {
                          const bal = d.balance ?? d.principal;
                          return (
                            <TouchableOpacity
                              key={d.id}
                              style={st.linkChip}
                              onPress={() => {
                                setFormLinkedDebtId(d.id);
                                setFormLinkedAssetId(null);
                                setFormLinkedMint(null);
                                setFormLinkedBankId(null);
                                setFormName(formName || `Pay off ${d.name}`);
                                setFormUnit('$');
                                setFormTarget(bal.toString());
                                setFormCurrent(bal.toString());
                                setFormEmoji('💳');
                                setFormStrategy('extract');
                                setFormType('debt_payoff');
                                setAssetSearch('');
                              }}
                            >
                              <Text style={st.linkChipEmoji}>💳</Text>
                              <Text style={st.linkChipName} numberOfLines={1}>{d.name}</Text>
                              <Text style={[st.linkChipSub, { color: '#f87171' }]}>${bal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </TouchableOpacity>
                          );
                        })}

                      {/* Bank accounts */}
                      {bankAccounts
                        .filter(a => !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.institution.toLowerCase().includes(assetSearch.toLowerCase()))
                        .slice(0, assetSearch ? 4 : 3)
                        .map(a => (
                          <TouchableOpacity
                            key={a.id}
                            style={st.linkChip}
                            onPress={() => {
                              setFormLinkedBankId(a.id);
                              setFormLinkedAssetId(null);
                              setFormLinkedMint(null);
                              setFormLinkedDebtId(null);
                              setFormName(formName || `${a.name} Target`);
                              setFormUnit('$');
                              setFormCurrent(a.currentBalance.toString());
                              setFormEmoji('🏦');
                              setFormStrategy('accumulate');
                              setFormType('savings_target');
                              setAssetSearch('');
                            }}
                          >
                            <Text style={st.linkChipEmoji}>🏦</Text>
                            <Text style={st.linkChipName} numberOfLines={1}>{a.name}</Text>
                            <Text style={[st.linkChipSub, { color: '#4ade80' }]}>${a.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                          </TouchableOpacity>
                        ))}

                      {assets.filter(a => a.type === 'crypto').length === 0 && debts.length === 0 && bankAccounts.length === 0 && (
                        <Text style={{ color: '#555', textAlign: 'center', paddingVertical: 12, fontSize: 13 }}>No assets, debts, or accounts found. Add some first, or create a manual goal below.</Text>
                      )}
                    </ScrollView>
                  </>
                )}
              </View>

              {/* Divider */}
              <View style={st.orDivider}>
                <View style={st.orLine} />
                <Text style={st.orText}>or set up manually</Text>
                <View style={st.orLine} />
              </View>

              {/* Emoji picker (quick) */}
              <Text style={st.fieldLabel}>Icon</Text>
              <View style={st.emojiRow}>
                {['🎯', '💰', '💳', '🏦', '🐋', '⭐', '🔥', '🚀', '👑', '💎', '🏠', '🎓'].map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[st.emojiBtn, formEmoji === e && st.emojiBtnActive]}
                    onPress={() => setFormEmoji(e)}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Name */}
              <Text style={st.fieldLabel}>Goal name</Text>
              <TextInput
                style={st.fieldInput}
                placeholder={formStrategy === 'extract' ? 'e.g., Pay off Chase CC' : 'e.g., 1M WHALE'}
                placeholderTextColor="#555"
                value={formName}
                onChangeText={setFormName}
              />

              {/* Target */}
              <Text style={st.fieldLabel}>
                {formStrategy === 'extract' ? 'Starting balance (what you owe)' : 'Target amount'}
              </Text>
              <TextInput
                style={st.fieldInput}
                placeholder="e.g., 1000000"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={formTarget}
                onChangeText={setFormTarget}
              />

              {/* Unit */}
              <Text style={st.fieldLabel}>Unit</Text>
              <View style={st.unitRow}>
                {['$', 'tokens'].map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[st.unitBtn, formUnit === u && st.unitBtnActive]}
                    onPress={() => setFormUnit(u)}
                  >
                    <Text style={[st.unitText, formUnit === u && st.unitTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[st.fieldInput, { flex: 1, marginLeft: 8, marginTop: 0 }]}
                  placeholder="Custom (WHALE, USD*, SOL...)"
                  placeholderTextColor="#555"
                  value={!['$', 'tokens'].includes(formUnit) ? formUnit : ''}
                  onChangeText={(v) => setFormUnit(v || 'tokens')}
                />
              </View>

              {/* Current */}
              <Text style={st.fieldLabel}>
                {formStrategy === 'extract' ? 'Current balance remaining' : 'Current progress'}
              </Text>
              <TextInput
                style={st.fieldInput}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={formCurrent}
                onChangeText={setFormCurrent}
              />

              {/* Notes */}
              <Text style={st.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="Why this goal matters..."
                placeholderTextColor="#555"
                value={formNotes}
                onChangeText={setFormNotes}
              />

              {/* Preview */}
              {parseNumber(formTarget) > 0 && (
                <View style={st.previewBox}>
                  <Text style={st.previewText}>
                    {formEmoji} {formName || '(name)'} —{' '}
                    {formStrategy === 'extract'
                      ? `$${parseNumber(formCurrent || '0').toLocaleString()} → $0`
                      : `${formatNum(parseNumber(formCurrent || '0'))} → ${formatNum(parseNumber(formTarget))} ${formUnit}`
                    }
                  </Text>
                </View>
              )}

              {/* Buttons */}
              <View style={st.modalButtons}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => { resetForm(); setShowAddModal(false); }}>
                  <Text style={st.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.saveBtn} onPress={handleSave}>
                  <Text style={st.saveBtnText}>{editingGoal ? 'Save Changes' : 'Create Goal'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ═══════════ QUICK ADD MODAL ═══════════ */}
      <Modal visible={showQuickAdd} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>⚡ Quick Add Goal</Text>

            {/* Debt payoff */}
            {debts.length > 0 && (
              <View style={st.quickSection}>
                <Text style={st.quickLabel}>💳 Pay off a debt</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.quickScroll}>
                  {debts.map(d => {
                    const bal = d.balance ?? d.principal;
                    const alreadyTracked = goals.some(g => g.debtId === d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[st.quickCard, quickDebtId === d.id && st.quickCardActive, alreadyTracked && st.quickCardDisabled]}
                        onPress={() => !alreadyTracked && setQuickDebtId(d.id)}
                        disabled={alreadyTracked}
                      >
                        <Text style={st.quickCardName}>{d.name}</Text>
                        <Text style={[st.quickCardBal, { color: '#f87171' }]}>${bal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                        {alreadyTracked && <Text style={st.quickCardDone}>✓ tracking</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {quickDebtId && (
                  <TouchableOpacity style={st.quickAddBtn} onPress={handleQuickDebt}>
                    <Text style={st.quickAddBtnText}>Add Debt Payoff Goal</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Savings target */}
            {bankAccounts.length > 0 && (
              <View style={st.quickSection}>
                <Text style={st.quickLabel}>🏦 Savings target</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.quickScroll}>
                  {bankAccounts.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[st.quickCard, quickBankId === a.id && st.quickCardActive]}
                      onPress={() => setQuickBankId(a.id)}
                    >
                      <Text style={st.quickCardName}>{a.name}</Text>
                      <Text style={[st.quickCardBal, { color: '#4ade80' }]}>${a.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {quickBankId && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={st.fieldLabel}>Target balance</Text>
                    <TextInput
                      style={st.fieldInput}
                      placeholder="e.g., 10000"
                      placeholderTextColor="#555"
                      keyboardType="numeric"
                      value={quickBankTarget}
                      onChangeText={setQuickBankTarget}
                    />
                    <TouchableOpacity style={st.quickAddBtn} onPress={handleQuickBank}>
                      <Text style={st.quickAddBtnText}>Add Savings Goal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={st.cancelBtn} onPress={() => { setShowQuickAdd(false); setQuickDebtId(''); setQuickBankId(''); setQuickBankTarget(''); }}>
              <Text style={st.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <KingMeFooter />
    </ScrollView>

    <ConfirmModal
      visible={!!confirmDelete}
      title="Delete goal?"
      message={confirmDelete ? `Remove "${confirmDelete.name}"? This cannot be undone.` : ''}
      confirmLabel="Delete"
      cancelLabel="Keep"
      destructive
      onConfirm={confirmDeleteGoal}
      onCancel={() => setConfirmDelete(null)}
    />
    </View>
  );
}

// ── Manual Update Mini-Form ──────────────────────────────────────
function ManualUpdater({ goal, onUpdate }: { goal: GoalWithProgress; onUpdate: (val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(goal.currentAmount.toString());

  if (!editing) {
    return (
      <TouchableOpacity style={st.manualBtn} onPress={() => setEditing(true)}>
        <Text style={st.manualBtnText}>📝 Update progress</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={st.manualRow}>
      <TextInput
        style={st.manualInput}
        keyboardType="numeric"
        value={val}
        onChangeText={setVal}
        autoFocus
      />
      <TouchableOpacity style={st.manualSave} onPress={() => { onUpdate(val); setEditing(false); }}>
        <Text style={st.manualSaveText}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.manualCancel} onPress={() => setEditing(false)}>
        <Text style={st.manualCancelText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18' },
  content: { padding: 16, paddingBottom: 40 },

  // KingMe header
  kmHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  kmHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kmBackButton: { padding: 8, marginRight: 2 },
  kmBackText: { fontSize: 20, color: '#60a5fa', fontWeight: '600' },
  kmBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kmLogo: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' },
  kmTitle: { fontSize: 18, fontWeight: '800', color: '#f4c430', letterSpacing: 1, lineHeight: 24 },
  kmAccent: { height: 1.5, marginTop: 10, borderRadius: 1 },

  title: { fontSize: 28, fontWeight: '800', color: '#f4c430', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 16 },

  // Summary
  summaryRow: { flexDirection: 'row', backgroundColor: '#0c1020', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1a204040' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#1a204060', marginHorizontal: 8 },
  summaryNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Add buttons
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addButton: { flex: 1, backgroundColor: '#f4c430', padding: 14, borderRadius: 12, alignItems: 'center' },
  addButtonText: { fontSize: 15, fontWeight: '700', color: '#080c18' },
  quickButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f4c43040', alignItems: 'center' },
  quickButtonText: { fontSize: 15, fontWeight: '600', color: '#f4c430' },

  // Empty
  emptyCard: { backgroundColor: '#0c1020', borderRadius: 16, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#1a204040', borderStyle: 'dashed' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f4c430', marginBottom: 8 },
  emptyBody: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },

  // Goal card
  goalCard: { backgroundColor: '#0c1020', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1a204030' },
  goalCardComplete: { borderColor: '#f4c43020', opacity: 0.7 },
  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  goalEmoji: { fontSize: 28, marginTop: 2 },
  goalName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  goalNameComplete: { textDecorationLine: 'line-through', color: '#888' },
  goalType: { fontSize: 11, color: '#888' },
  goalDeleteBtn: { padding: 4, marginRight: 4 },
  goalDeleteText: { fontSize: 16, color: '#ff444480', fontWeight: 'bold' },
  goalPctCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#080c18', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1a204060' },
  goalPctText: { fontSize: 15, fontWeight: '800' },

  // Progress bar
  progressBarBg: { height: 8, backgroundColor: '#080c18', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', borderRadius: 4 },

  // Numbers row
  numbersRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  numbersCurrentLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginRight: 4 },
  numbersCurrent: { fontSize: 14, fontWeight: '700', color: '#fff' },
  numbersArrow: { marginHorizontal: 8 },
  numbersTargetLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginRight: 4 },
  numbersTarget: { fontSize: 14, fontWeight: '700', color: '#888' },

  remainingText: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Manual updater
  manualBtn: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1a204030', alignItems: 'center' },
  manualBtnText: { fontSize: 13, color: '#60a5fa', fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1a204030' },
  manualInput: { flex: 1, backgroundColor: '#080c18', borderRadius: 10, padding: 10, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3050' },
  manualSave: { width: 40, backgroundColor: '#4ade80', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  manualSaveText: { color: '#080c18', fontSize: 18, fontWeight: '700' },
  manualCancel: { width: 40, borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', justifyContent: 'center', alignItems: 'center' },
  manualCancelText: { color: '#888', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%' },
  modalContent: { backgroundColor: '#0c1020', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', marginBottom: 16 },

  fieldLabel: { fontSize: 13, color: '#888', marginTop: 12, marginBottom: 6 },
  fieldInput: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3050' },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },

  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a204040' },
  emojiBtnActive: { borderColor: '#f4c430', backgroundColor: '#f4c43015' },

  // Link section
  linkSection: { backgroundColor: '#080c18', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f4c43020', marginTop: 12 },
  linkSectionTitle: { fontSize: 14, fontWeight: '700', color: '#f4c430', marginBottom: 2 },
  linkSectionHint: { fontSize: 11, color: '#666', marginBottom: 10 },
  linkSearchInput: { backgroundColor: '#0c1020', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a3050', marginBottom: 8 },
  linkResults: { maxHeight: 220 },
  linkChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c1020', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#1a204030', gap: 8 },
  linkChipEmoji: { fontSize: 18 },
  linkChipName: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  linkChipSub: { fontSize: 12, color: '#888' },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4ade8010', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#4ade8030' },
  linkedBadgeText: { fontSize: 13, color: '#4ade80', fontWeight: '600', flex: 1 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#1a204040' },
  orText: { fontSize: 12, color: '#555', marginHorizontal: 12 },

  unitRow: { flexDirection: 'row', alignItems: 'center' },
  unitBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', marginRight: 6 },
  unitBtnActive: { borderColor: '#f4c430', backgroundColor: '#f4c43015' },
  unitText: { fontSize: 14, color: '#888', fontWeight: '600' },
  unitTextActive: { color: '#f4c430' },

  previewBox: { backgroundColor: '#f4c43008', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#f4c43015' },
  previewText: { fontSize: 13, color: '#b0b0b8' },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#888' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f4c430', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#080c18' },

  // Quick add
  quickSection: { marginBottom: 18 },
  quickLabel: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 8 },
  quickScroll: { marginBottom: 4 },
  quickCard: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, marginRight: 10, minWidth: 140, borderWidth: 1, borderColor: '#2a305040' },
  quickCardActive: { borderColor: '#f4c430', backgroundColor: '#f4c43008' },
  quickCardDisabled: { opacity: 0.5 },
  quickCardName: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 4 },
  quickCardBal: { fontSize: 16, fontWeight: '700' },
  quickCardDone: { fontSize: 11, color: '#4ade80', marginTop: 4 },
  quickAddBtn: { backgroundColor: '#f4c430', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  quickAddBtnText: { fontSize: 15, fontWeight: '700', color: '#080c18' },
});
