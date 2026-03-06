// app/companionship.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Companionship Tracker — tracks expenses for a secondary relationship.
// Privacy-first: all data stored in AsyncStorage only, never touches main store.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/store/useStore';
import {
  generateCompanionshipInsights, getInsightColor,
  type CompanionshipInsight,
} from '../src/services/companionshipInsights';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = 'companionship_tracker_data';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanionshipExpense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  notes?: string;
  paymentMethod: string;
}

interface CompanionProfile {
  alias: string;
  startDate: string;
  meetingFrequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
}

interface CompanionshipSettings {
  monthlyBudget: number;
  monthlyIncome: number; // 0 = auto from store
}

interface CompanionshipData {
  profile: CompanionProfile;
  expenses: CompanionshipExpense[];
  settings: CompanionshipSettings;
  importedTxIds?: string[]; // bank transaction IDs already imported
}

const CATEGORIES: Record<string, { emoji: string; label: string }> = {
  gifts: { emoji: '🎁', label: 'Gifts' },
  dining: { emoji: '🍽️', label: 'Dining' },
  travel_hotels: { emoji: '✈️', label: 'Travel/Hotels' },
  experiences: { emoji: '🎭', label: 'Experiences' },
  rent_housing: { emoji: '🏠', label: 'Rent/Housing' },
  cash_allowances: { emoji: '💵', label: 'Cash' },
  personal_care: { emoji: '💅', label: 'Personal Care' },
  communication: { emoji: '📱', label: 'Communication' },
  transportation: { emoji: '🚗', label: 'Transportation' },
  other: { emoji: '📦', label: 'Other' },
};

const PAYMENT_METHODS: Record<string, { emoji: string; label: string }> = {
  cash: { emoji: '💵', label: 'Cash' },
  card: { emoji: '💳', label: 'Card' },
  transfer: { emoji: '🏦', label: 'Transfer' },
  crypto: { emoji: '🪙', label: 'Crypto' },
  gift_card: { emoji: '🎫', label: 'Gift Card' },
};

const FREQUENCIES: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', irregular: 'Irregular',
};

const DEFAULT_DATA: CompanionshipData = {
  profile: { alias: '', startDate: '', meetingFrequency: 'weekly' },
  expenses: [],
  settings: { monthlyBudget: 0, monthlyIncome: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeMonthlyIncome(storeIncome: any): number {
  let monthly = 0;
  // Salary
  if (storeIncome.salary) monthly += storeIncome.salary;
  if (storeIncome.otherIncome) monthly += storeIncome.otherIncome;
  // Income sources with frequency normalization
  for (const src of (storeIncome.sources || [])) {
    const amt = src.amount || 0;
    switch (src.frequency) {
      case 'weekly': monthly += amt * 4.33; break;
      case 'biweekly': monthly += amt * 2.17; break;
      case 'twice_monthly': monthly += amt * 2; break;
      case 'monthly': monthly += amt; break;
      case 'quarterly': monthly += amt / 3; break;
    }
  }
  return monthly;
}

function durationString(startDate: string): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (months < 1) return 'Just started';
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years} year${years > 1 ? 's' : ''}`;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CompanionshipTracker() {
  const router = useRouter();
  const storeIncome = useStore(s => s.income);
  const bankTransactions = useStore(s => s.bankTransactions || []);

  const [data, setData] = useState<CompanionshipData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Profile form
  const [profileAlias, setProfileAlias] = useState('');
  const [profileStartDate, setProfileStartDate] = useState('');
  const [profileFrequency, setProfileFrequency] = useState<string>('weekly');

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('dining');
  const [expPayment, setExpPayment] = useState('card');
  const [expNotes, setExpNotes] = useState('');
  const [expDate, setExpDate] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Settings form
  const [settingsBudget, setSettingsBudget] = useState('');
  const [settingsIncome, setSettingsIncome] = useState('');

  // Insights state
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  // ── Effective monthly income ──────────────────────────────
  const effectiveIncome = data.settings.monthlyIncome > 0
    ? data.settings.monthlyIncome
    : computeMonthlyIncome(storeIncome);

  // ── Insights ──────────────────────────────────────────────
  const insights = useMemo(() =>
    generateCompanionshipInsights(
      data.expenses,
      { monthlyBudget: data.settings.monthlyBudget, monthlyIncome: effectiveIncome },
      data.profile.startDate || undefined,
    ),
    [data.expenses, data.settings, effectiveIncome, data.profile.startDate]
  );

  // ── Load / Save ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const parsed = { ...DEFAULT_DATA, ...JSON.parse(raw) };
        setData(parsed);
        if (!parsed.profile.alias) setShowProfileModal(true);
      } else {
        setShowProfileModal(true);
      }
      setLoading(false);
    });
  }, []);

  const save = useCallback(async (newData: CompanionshipData) => {
    setData(newData);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  // ── Profile ────────────────────────────────────────────────
  const openProfileModal = () => {
    setProfileAlias(data.profile.alias);
    setProfileStartDate(data.profile.startDate);
    setProfileFrequency(data.profile.meetingFrequency);
    setShowProfileModal(true);
  };

  const saveProfile = () => {
    if (!profileAlias.trim()) return;
    save({
      ...data,
      profile: {
        alias: profileAlias.trim(),
        startDate: profileStartDate || new Date().toISOString().slice(0, 10),
        meetingFrequency: profileFrequency as any,
      },
    });
    setShowProfileModal(false);
  };

  // ── Expense CRUD ──────────────────────────────────────────
  const openAddExpense = () => {
    setEditingExpenseId(null);
    setExpDesc('');
    setExpAmount('');
    setExpCategory('dining');
    setExpPayment('card');
    setExpNotes('');
    setExpDate(new Date().toISOString().slice(0, 10));
    setShowExpenseModal(true);
  };

  const editExpense = (e: CompanionshipExpense) => {
    setEditingExpenseId(e.id);
    setExpDesc(e.description);
    setExpAmount(e.amount.toString());
    setExpCategory(e.category);
    setExpPayment(e.paymentMethod);
    setExpNotes(e.notes || '');
    setExpDate(e.date.slice(0, 10));
    setShowExpenseModal(true);
  };

  const saveExpense = () => {
    if (!expDesc || !expAmount) return;
    const expense: CompanionshipExpense = {
      id: editingExpenseId || Date.now().toString(),
      date: expDate || new Date().toISOString().slice(0, 10),
      category: expCategory,
      amount: parseFloat(expAmount),
      description: expDesc,
      notes: expNotes || undefined,
      paymentMethod: expPayment,
    };
    const newExpenses = editingExpenseId
      ? data.expenses.map(e => e.id === editingExpenseId ? expense : e)
      : [...data.expenses, expense];
    save({ ...data, expenses: newExpenses });
    setShowExpenseModal(false);
  };

  const deleteExpense = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    save({ ...data, expenses: data.expenses.filter(e => e.id !== id) });
  };

  // ── Auto-sync companion transactions from bank ──────────────
  useEffect(() => {
    if (loading) return;
    const alreadyImported = new Set(data.importedTxIds || []);
    const newTxs = bankTransactions.filter(
      t => t.category === 'personal_companion' && t.type === 'expense' && t.amount > 0 && !alreadyImported.has(t.id)
    );
    if (newTxs.length === 0) return;

    const newExpenses: CompanionshipExpense[] = newTxs.map(tx => ({
      id: `imp_${tx.id}`,
      date: tx.date,
      category: 'other',
      amount: tx.amount,
      description: tx.description,
      notes: 'Auto-synced from bank transactions',
      paymentMethod: 'card',
    }));

    save({
      ...data,
      expenses: [...data.expenses, ...newExpenses],
      importedTxIds: [...(data.importedTxIds || []), ...newTxs.map(t => t.id)],
    });
  }, [bankTransactions, loading]);

  // ── Settings ──────────────────────────────────────────────
  const openSettings = () => {
    setSettingsBudget(data.settings.monthlyBudget > 0 ? data.settings.monthlyBudget.toString() : '');
    setSettingsIncome(data.settings.monthlyIncome > 0 ? data.settings.monthlyIncome.toString() : '');
    setShowSettingsModal(true);
  };

  const saveSettings = () => {
    save({
      ...data,
      settings: {
        monthlyBudget: parseFloat(settingsBudget) || 0,
        monthlyIncome: parseFloat(settingsIncome) || 0,
      },
    });
    setShowSettingsModal(false);
  };

  // ── Computed values ────────────────────────────────────────
  const cm = currentMonthKey();
  const thisMonthExpenses = data.expenses.filter(e => e.date.startsWith(cm));
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Top category this month
  const catTotals = new Map<string, number>();
  for (const e of thisMonthExpenses) {
    catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amount);
  }
  const topCat = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];

  // Avg per meeting
  const meetingsPerMonth = data.profile.meetingFrequency === 'weekly' ? 4
    : data.profile.meetingFrequency === 'biweekly' ? 2
    : data.profile.meetingFrequency === 'monthly' ? 1
    : 3; // irregular guess
  const avgPerMeeting = meetingsPerMonth > 0 ? thisMonthTotal / meetingsPerMonth : 0;

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const e of data.expenses) {
      const m = e.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + e.amount);
    }
    const months = [...byMonth.keys()].sort().slice(-6);
    return months.map(m => ({ month: m, total: byMonth.get(m)! }));
  }, [data.expenses]);

  const maxMonthly = Math.max(...monthlyTrend.map(m => m.total), 1);

  // Expenses grouped by month (recent first)
  const expensesByMonth = useMemo(() => {
    const grouped = new Map<string, CompanionshipExpense[]>();
    const sorted = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));
    for (const e of sorted) {
      const m = e.date.slice(0, 7);
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m)!.push(e);
    }
    return [...grouped.entries()];
  }, [data.expenses]);

  // Category breakdown for current month
  const categoryBreakdown = useMemo(() => {
    const breakdown: { category: string; total: number }[] = [];
    const map = new Map<string, number>();
    for (const e of thisMonthExpenses) {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    for (const [cat, total] of map) breakdown.push({ category: cat, total });
    breakdown.sort((a, b) => b.total - a.total);
    return breakdown;
  }, [thisMonthExpenses]);

  const maxCatTotal = Math.max(...categoryBreakdown.map(c => c.total), 1);

  // Insight expand toggle
  const toggleInsight = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedInsights(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return <View style={st.loadingContainer}><ActivityIndicator color="#c084fc" size="large" /></View>;
  }

  const shownInsights = showAllInsights ? insights : insights.slice(0, 3);
  const hiddenInsightCount = insights.length - 3;

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={st.headerRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={st.backBtn}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openProfileModal}>
          <Text style={st.pageTitle}>💜 {data.profile.alias || 'Companionship'}</Text>
        </TouchableOpacity>
      </View>
      {data.profile.startDate ? (
        <Text style={st.subLabel}>{durationString(data.profile.startDate)} · {FREQUENCIES[data.profile.meetingFrequency]} · Tap name to edit</Text>
      ) : (
        <Text style={st.subLabel}>Tap name to set up profile</Text>
      )}

      {/* ── Insights ─────────────────────────────────────────── */}
      {insights.length > 0 && (
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>🧠 Insights</Text>
            <Text style={st.insightCount}>{insights.length}</Text>
          </View>

          {shownInsights.map(insight => {
            const color = getInsightColor(insight.severity);
            const isExpanded = expandedInsights.has(insight.id);
            return (
              <LinearGradient
                key={insight.id}
                colors={color.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[st.insightCard, { borderColor: color.border }]}
              >
                {insight.severity === 'critical' && (
                  <View style={st.criticalBadge}>
                    <Text style={st.criticalText}>CRITICAL</Text>
                  </View>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => insight.detail ? toggleInsight(insight.id) : undefined}
                >
                  <View style={st.insightTop}>
                    <Text style={st.insightEmoji}>{insight.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.insightTitle, { color: color.text }]}>{insight.title}</Text>
                      <Text style={st.insightMessage}>{insight.message}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {insight.stats && (
                  <View style={st.statsRow}>
                    {Object.entries(insight.stats).map(([key, val]) => (
                      <View key={key} style={st.statItem}>
                        <Text style={st.statLabel}>{key}</Text>
                        <Text style={[st.statValue, { color: color.text }]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {isExpanded && insight.detail && (
                  <View style={st.detailSection}>
                    <Text style={st.detailText}>{insight.detail}</Text>
                  </View>
                )}
                {insight.detail && !isExpanded && (
                  <TouchableOpacity onPress={() => toggleInsight(insight.id)}>
                    <Text style={st.expandHint}>Tap for details ›</Text>
                  </TouchableOpacity>
                )}
              </LinearGradient>
            );
          })}

          {hiddenInsightCount > 0 && !showAllInsights && (
            <TouchableOpacity style={st.moreButton} onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAllInsights(true);
            }}>
              <Text style={st.moreText}>+{hiddenInsightCount} more insights</Text>
            </TouchableOpacity>
          )}
          {showAllInsights && insights.length > 3 && (
            <TouchableOpacity style={st.moreButton} onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAllInsights(false);
            }}>
              <Text style={st.moreText}>Show less</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Summary Row ──────────────────────────────────────── */}
      <View style={st.summaryRow}>
        <View style={st.summaryCard}>
          <Text style={st.summaryLabel}>This Month</Text>
          <Text style={st.summaryValue}>${thisMonthTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
        </View>
        <View style={st.summaryCard}>
          <Text style={st.summaryLabel}>Top Category</Text>
          <Text style={st.summaryValue}>{topCat ? `${CATEGORIES[topCat[0]]?.emoji || '📦'} $${topCat[1].toFixed(0)}` : '—'}</Text>
        </View>
        <View style={st.summaryCard}>
          <Text style={st.summaryLabel}>Avg/Meeting</Text>
          <Text style={st.summaryValue}>${avgPerMeeting.toFixed(0)}</Text>
        </View>
      </View>

      {/* ── Monthly Trend ────────────────────────────────────── */}
      {monthlyTrend.length > 1 && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>📊 Monthly Trend</Text>
          {monthlyTrend.map(m => (
            <View key={m.month} style={st.trendRow}>
              <Text style={st.trendMonth}>{m.month.slice(5)}/{m.month.slice(2, 4)}</Text>
              <View style={st.trendBarBg}>
                <View style={[st.trendBarFill, { width: `${(m.total / maxMonthly) * 100}%` }]} />
              </View>
              <Text style={st.trendAmount}>${m.total.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Expenses ─────────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>💸 Expenses</Text>
          <TouchableOpacity onPress={openAddExpense}>
            <Text style={st.addBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {data.expenses.length === 0 ? (
          <TouchableOpacity style={st.emptyCard} onPress={openAddExpense}>
            <Text style={st.emptyEmoji}>📝</Text>
            <Text style={st.emptyText}>Track your first expense</Text>
            <Text style={st.emptySub}>Tap to add dining, gifts, travel, and more</Text>
          </TouchableOpacity>
        ) : (
          expensesByMonth.map(([month, expenses]) => (
            <View key={month}>
              <Text style={st.monthHeader}>{month}</Text>
              {expenses.map(e => {
                const cat = CATEGORIES[e.category] || CATEGORIES.other;
                const pay = PAYMENT_METHODS[e.paymentMethod] || PAYMENT_METHODS.cash;
                return (
                  <TouchableOpacity key={e.id} style={st.expenseRow} onPress={() => editExpense(e)}>
                    <Text style={st.expenseEmoji}>{cat.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.expenseName}>{e.description}</Text>
                      <Text style={st.expenseMeta}>{e.date.slice(5)} · {cat.label}</Text>
                    </View>
                    <Text style={st.expenseAmount}>${e.amount.toFixed(0)}</Text>
                    <View style={st.paymentPill}>
                      <Text style={st.paymentPillText}>{pay.emoji}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteExpense(e.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={st.deleteX}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </View>

      {/* ── Category Breakdown ───────────────────────────────── */}
      {categoryBreakdown.length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>📂 This Month by Category</Text>
          {categoryBreakdown.map(({ category, total }) => {
            const cat = CATEGORIES[category] || CATEGORIES.other;
            return (
              <View key={category} style={st.catRow}>
                <Text style={st.catEmoji}>{cat.emoji}</Text>
                <Text style={st.catLabel}>{cat.label}</Text>
                <View style={st.catBarBg}>
                  <View style={[st.catBarFill, { width: `${(total / maxCatTotal) * 100}%` }]} />
                </View>
                <Text style={st.catAmount}>${total.toFixed(0)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Settings ─────────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>⚙️ Settings</Text>
          <TouchableOpacity onPress={openSettings}>
            <Text style={st.addBtn}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={st.settingsCard}>
          <View style={st.settingsRow}>
            <Text style={st.settingsLabel}>Monthly Budget</Text>
            <Text style={st.settingsValue}>{data.settings.monthlyBudget > 0 ? `$${data.settings.monthlyBudget.toLocaleString()}` : 'Not set'}</Text>
          </View>
          <View style={st.settingsRow}>
            <Text style={st.settingsLabel}>Income Override</Text>
            <Text style={st.settingsValue}>{data.settings.monthlyIncome > 0 ? `$${data.settings.monthlyIncome.toLocaleString()}/mo` : `Auto ($${Math.round(effectiveIncome).toLocaleString()})`}</Text>
          </View>
          <View style={st.settingsRow}>
            <Text style={st.settingsLabel}>Total All-Time</Text>
            <Text style={[st.settingsValue, { color: '#c084fc' }]}>${data.expenses.reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
      </View>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="slide" onRequestClose={() => { if (data.profile.alias) setShowProfileModal(false); }}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>{data.profile.alias ? 'Edit Profile' : 'Set Up Companion Profile'}</Text>
            <Text style={st.modalSub}>This data is stored locally and never leaves your device</Text>

            <Text style={st.modalLabel}>Alias / Nickname</Text>
            <TextInput style={st.modalInput} placeholder="e.g. a name or nickname" placeholderTextColor="#666"
              value={profileAlias} onChangeText={setProfileAlias} />

            <Text style={st.modalLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput style={st.modalInput} placeholder="e.g. 2024-06-15" placeholderTextColor="#666"
              value={profileStartDate} onChangeText={setProfileStartDate} />

            <Text style={st.modalLabel}>Meeting Frequency</Text>
            <View style={st.pillRow}>
              {Object.entries(FREQUENCIES).map(([key, label]) => (
                <TouchableOpacity key={key}
                  style={[st.pill, profileFrequency === key && st.pillActive]}
                  onPress={() => setProfileFrequency(key)}>
                  <Text style={[st.pillText, profileFrequency === key && st.pillTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.modalBtns}>
              {data.profile.alias ? (
                <TouchableOpacity style={st.modalCancel} onPress={() => setShowProfileModal(false)}>
                  <Text style={st.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[st.modalSave, { flex: data.profile.alias ? 1 : undefined }]} onPress={saveProfile}>
                <Text style={st.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={showExpenseModal} transparent animationType="slide" onRequestClose={() => setShowExpenseModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <ScrollView>
              <Text style={st.modalTitle}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</Text>

              <TextInput style={st.modalInput} placeholder="Description (e.g. Dinner at Nobu)" placeholderTextColor="#666"
                value={expDesc} onChangeText={setExpDesc} />
              <TextInput style={st.modalInput} placeholder="Amount" placeholderTextColor="#666"
                keyboardType="numeric" value={expAmount} onChangeText={setExpAmount} />
              <TextInput style={st.modalInput} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#666"
                value={expDate} onChangeText={setExpDate} />

              <Text style={st.modalLabel}>Category</Text>
              <View style={st.pillRow}>
                {Object.entries(CATEGORIES).map(([key, { emoji, label }]) => (
                  <TouchableOpacity key={key}
                    style={[st.pill, expCategory === key && st.pillActive]}
                    onPress={() => setExpCategory(key)}>
                    <Text style={[st.pillText, expCategory === key && st.pillTextActive]}>{emoji} {label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.modalLabel}>Payment Method</Text>
              <View style={st.pillRow}>
                {Object.entries(PAYMENT_METHODS).map(([key, { emoji, label }]) => (
                  <TouchableOpacity key={key}
                    style={[st.pill, expPayment === key && st.pillActive]}
                    onPress={() => setExpPayment(key)}>
                    <Text style={[st.pillText, expPayment === key && st.pillTextActive]}>{emoji} {label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={st.modalInput} placeholder="Notes (optional)" placeholderTextColor="#666"
                value={expNotes} onChangeText={setExpNotes} />

              <View style={st.modalBtns}>
                <TouchableOpacity style={st.modalCancel} onPress={() => setShowExpenseModal(false)}>
                  <Text style={st.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalSave} onPress={saveExpense}>
                  <Text style={st.modalSaveText}>{editingExpenseId ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Companionship Settings</Text>
            <Text style={st.modalSub}>Set a monthly budget and income for insight calculations</Text>

            <Text style={st.modalLabel}>Monthly Budget ($)</Text>
            <TextInput style={st.modalInput} placeholder="e.g. 500" placeholderTextColor="#666"
              keyboardType="numeric" value={settingsBudget} onChangeText={setSettingsBudget} />

            <Text style={st.modalLabel}>Monthly Income Override ($)</Text>
            <TextInput style={st.modalInput} placeholder={`Leave blank for auto ($${Math.round(effectiveIncome).toLocaleString()})`} placeholderTextColor="#666"
              keyboardType="numeric" value={settingsIncome} onChangeText={setSettingsIncome} />
            <Text style={st.modalHint}>Set to 0 or leave blank to use your income from the main app</Text>

            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancel} onPress={() => setShowSettingsModal(false)}>
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalSave} onPress={saveSettings}>
                <Text style={st.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import modal removed — companion transactions auto-sync */}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 4 },
  backBtn: { fontSize: 16, color: '#c084fc', fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#c084fc' },
  subLabel: { fontSize: 12, color: '#666', marginBottom: 16, paddingLeft: 4 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d0', marginBottom: 10 },
  addBtn: { fontSize: 13, color: '#c084fc', fontWeight: '700' },

  // Insights
  insightCount: {
    fontSize: 13, fontWeight: '700', color: '#c084fc', backgroundColor: '#c084fc20',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
  },
  insightCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  criticalBadge: {
    position: 'absolute', top: -1, right: 16, backgroundColor: '#ff4444',
    paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, zIndex: 1,
  },
  criticalText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  insightTop: { flexDirection: 'row', alignItems: 'flex-start' },
  insightEmoji: { fontSize: 28, marginRight: 12, marginTop: 2 },
  insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  insightMessage: { fontSize: 13, fontWeight: '500', color: '#c0b890', lineHeight: 18 },
  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ffffff10',
  },
  statItem: { alignItems: 'center', minWidth: 60 },
  statLabel: { fontSize: 10, fontWeight: '500', color: '#666', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '700' },
  detailSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ffffff10' },
  detailText: { fontSize: 12, fontWeight: '400', color: '#888', lineHeight: 16 },
  expandHint: { fontSize: 11, fontWeight: '500', color: '#555', marginTop: 8 },
  moreButton: { alignItems: 'center', paddingVertical: 10 },
  moreText: { fontSize: 13, fontWeight: '600', color: '#c084fc' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2f3e',
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#e8e0d0' },

  // Monthly trend
  trendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  trendMonth: { width: 46, fontSize: 12, fontWeight: '600', color: '#888' },
  trendBarBg: { flex: 1, height: 14, backgroundColor: '#141825', borderRadius: 7, overflow: 'hidden', marginHorizontal: 8 },
  trendBarFill: { height: '100%', backgroundColor: '#c084fc60', borderRadius: 7 },
  trendAmount: { width: 55, fontSize: 12, fontWeight: '700', color: '#c084fc', textAlign: 'right' },

  // Expenses
  monthHeader: { fontSize: 13, fontWeight: '700', color: '#555', marginTop: 8, marginBottom: 6 },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  expenseEmoji: { fontSize: 20 },
  expenseName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  expenseMeta: { fontSize: 11, color: '#888', marginTop: 1 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#c084fc' },
  paymentPill: {
    backgroundColor: '#141825', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  paymentPillText: { fontSize: 12 },
  deleteX: { fontSize: 14, color: '#f87171', fontWeight: '700', paddingLeft: 4 },

  // Empty state
  emptyCard: {
    backgroundColor: '#141825', borderRadius: 14, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2f3e', borderStyle: 'dashed' as any,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#e8e0d0' },
  emptySub: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },

  // Category breakdown
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  catEmoji: { fontSize: 16, width: 24 },
  catLabel: { width: 80, fontSize: 12, fontWeight: '600', color: '#888' },
  catBarBg: { flex: 1, height: 12, backgroundColor: '#141825', borderRadius: 6, overflow: 'hidden', marginHorizontal: 8 },
  catBarFill: { height: '100%', backgroundColor: '#c084fc40', borderRadius: 6 },
  catAmount: { width: 55, fontSize: 12, fontWeight: '700', color: '#e8e0d0', textAlign: 'right' },

  // Settings
  settingsCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  settingsLabel: { fontSize: 14, color: '#888' },
  settingsValue: { fontSize: 14, fontWeight: '700', color: '#e8e0d0' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1f2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#888', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 12, marginBottom: 6 },
  modalHint: { fontSize: 11, color: '#555', marginTop: -4, marginBottom: 8 },
  modalInput: {
    backgroundColor: '#141825', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#2a2f3e', marginBottom: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#141825', borderWidth: 1, borderColor: '#2a2f3e',
  },
  pillActive: { backgroundColor: '#c084fc20', borderColor: '#c084fc' },
  pillText: { fontSize: 12, color: '#888', fontWeight: '600' },
  pillTextActive: { color: '#c084fc' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: '#888', fontWeight: '700' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#c084fc', alignItems: 'center' },
  modalSaveText: { fontSize: 15, color: '#0a0e1a', fontWeight: '800' },

});
