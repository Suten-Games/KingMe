// app/spending.tsx
// Full-page spending breakdown — every expense group with per-category drilldown and transactions.

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/useStore';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup, CustomCategoryDef } from '@/types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META } from '@/types/bankTransactionTypes';

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

// ── Resolve category → group, checking built-in then custom ──────────────
function resolveGroup(
  cat: BankTransactionCategory,
  customCategories: Record<string, CustomCategoryDef>,
): BankTransactionGroup | null {
  const builtIn = TRANSACTION_CATEGORY_META[cat as keyof typeof TRANSACTION_CATEGORY_META];
  if (builtIn) return builtIn.group;
  const custom = customCategories[cat];
  if (custom) return custom.group;
  return null;
}

// ── Resolve category → display info ──────────────────────────────────────
function resolveCategoryMeta(
  cat: BankTransactionCategory,
  customCategories: Record<string, CustomCategoryDef>,
): { label: string; emoji: string } {
  const builtIn = TRANSACTION_CATEGORY_META[cat as keyof typeof TRANSACTION_CATEGORY_META];
  if (builtIn) return builtIn;
  const custom = customCategories[cat];
  if (custom) return custom;
  return { label: cat, emoji: '📋' };
}

// ── Build unique month list from transactions ────────────────────────────
function getMonthOptions(transactions: BankTransaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    const m = t.date.substring(0, 7); // YYYY-MM
    if (m) set.add(m);
  }
  return Array.from(set).sort().reverse();
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryBreakdown {
  category: BankTransactionCategory;
  label: string;
  emoji: string;
  total: number;
  transactions: BankTransaction[];
}

interface GroupBreakdown {
  group: BankTransactionGroup;
  label: string;
  emoji: string;
  color: string;
  total: number;
  categories: CategoryBreakdown[];
}

export default function SpendingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bankTransactions = useStore(s => s.bankTransactions) || [];
  const customCategories = useStore(s => s.customCategories) || {};

  // Only expense transactions
  const expenses = useMemo(
    () => bankTransactions.filter(t => t.type === 'expense'),
    [bankTransactions],
  );

  const months = useMemo(() => getMonthOptions(expenses), [expenses]);
  const [selectedMonth, setSelectedMonth] = useState<string | 'all'>(() => months[0] || 'all');

  // Filter by selected month
  const filtered = useMemo(() => {
    if (selectedMonth === 'all') return expenses;
    return expenses.filter(t => t.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  // Group by category group, then by category
  const groupBreakdowns = useMemo(() => {
    const groupMap: Record<string, { total: number; catMap: Record<string, { total: number; txns: BankTransaction[] }> }> = {};

    for (const t of filtered) {
      const grp = resolveGroup(t.category, customCategories) || 'other';
      if (!groupMap[grp]) groupMap[grp] = { total: 0, catMap: {} };
      groupMap[grp].total += Math.abs(t.amount);

      const cat = t.category;
      if (!groupMap[grp].catMap[cat]) groupMap[grp].catMap[cat] = { total: 0, txns: [] };
      groupMap[grp].catMap[cat].total += Math.abs(t.amount);
      groupMap[grp].catMap[cat].txns.push(t);
    }

    // Exclude income group
    delete groupMap['income'];

    const result: GroupBreakdown[] = Object.entries(groupMap)
      .map(([grp, data]) => {
        const meta = TRANSACTION_GROUP_META[grp as BankTransactionGroup];
        const categories: CategoryBreakdown[] = Object.entries(data.catMap)
          .map(([cat, catData]) => {
            const catMeta = resolveCategoryMeta(cat as BankTransactionCategory, customCategories);
            return {
              category: cat as BankTransactionCategory,
              label: catMeta.label,
              emoji: catMeta.emoji,
              total: catData.total,
              transactions: catData.txns.sort((a, b) => b.date.localeCompare(a.date)),
            };
          })
          .sort((a, b) => b.total - a.total);

        return {
          group: grp as BankTransactionGroup,
          label: meta.label,
          emoji: meta.emoji,
          color: meta.color,
          total: data.total,
          categories,
        };
      })
      .sort((a, b) => b.total - a.total);

    return result;
  }, [filtered, customCategories]);

  const grandTotal = useMemo(
    () => groupBreakdowns.reduce((s, g) => s + g.total, 0),
    [groupBreakdowns],
  );

  const hasOther = groupBreakdowns.some(g => g.group === 'other');

  if (expenses.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backBtn}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Spending</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>No expense transactions yet</Text>
          <Text style={styles.emptySubtext}>Import bank transactions to see your spending breakdown</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backBtn}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Spending</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Month picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthContent}>
        <TouchableOpacity
          style={[styles.monthPill, selectedMonth === 'all' && styles.monthPillActive]}
          onPress={() => setSelectedMonth('all')}
        >
          <Text style={[styles.monthPillText, selectedMonth === 'all' && styles.monthPillTextActive]}>All time</Text>
        </TouchableOpacity>
        {months.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.monthPill, selectedMonth === m && styles.monthPillActive]}
            onPress={() => setSelectedMonth(m)}
          >
            <Text style={[styles.monthPillText, selectedMonth === m && styles.monthPillTextActive]}>{monthLabel(m)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Total banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Total spent</Text>
          <Text style={styles.totalAmount}>{fmt(grandTotal)}</Text>
          <Text style={styles.totalSub}>
            {selectedMonth === 'all'
              ? `${filtered.length} transactions`
              : `${monthLabel(selectedMonth)} · ${filtered.length} transactions`}
          </Text>
        </View>

        {/* Group cards */}
        {groupBreakdowns.map(group => (
          <GroupCard
            key={group.group}
            group={group}
            grandTotal={grandTotal}
          />
        ))}

        {/* Uncategorized CTA */}
        {hasOther && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/categorize')}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaBtnEmoji}>🗂️</Text>
            <View style={styles.ctaBtnContent}>
              <Text style={styles.ctaBtnText}>Sort uncategorized transactions</Text>
              <Text style={styles.ctaBtnSub}>Drag & drop to categorize "Other" items</Text>
            </View>
            <Text style={styles.ctaBtnArrow}>›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP CARD — expandable with category drilldown
// ═══════════════════════════════════════════════════════════════════════════

function GroupCard({ group, grandTotal }: { group: GroupBreakdown; grandTotal: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = grandTotal > 0 ? Math.round((group.total / grandTotal) * 100) : 0;

  return (
    <View style={styles.groupCard}>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.groupHeaderLeft}>
          <Text style={styles.groupEmoji}>{group.emoji}</Text>
          <View style={styles.groupHeaderInfo}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupCatCount}>{group.categories.length} categor{group.categories.length !== 1 ? 'ies' : 'y'}</Text>
          </View>
        </View>
        <View style={styles.groupHeaderRight}>
          <Text style={[styles.groupAmount, { color: group.color }]}>{fmt(group.total)}</Text>
          <Text style={styles.groupPct}>{pct}%</Text>
        </View>
      </TouchableOpacity>

      {/* Percentage bar */}
      <View style={styles.groupBarBg}>
        <View style={[styles.groupBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: group.color }]} />
      </View>

      {/* Expanded category rows */}
      {expanded && (
        <View style={styles.groupBody}>
          {group.categories.map(cat => (
            <CategoryRow key={cat.category} cat={cat} groupColor={group.color} groupTotal={group.total} />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY ROW — expandable with individual transactions
// ═══════════════════════════════════════════════════════════════════════════

function CategoryRow({ cat, groupColor, groupTotal }: { cat: CategoryBreakdown; groupColor: string; groupTotal: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = groupTotal > 0 ? Math.round((cat.total / groupTotal) * 100) : 0;

  return (
    <View style={styles.catRow}>
      <TouchableOpacity
        style={styles.catHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.catLeft}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
          <Text style={styles.catLabel}>{cat.label}</Text>
          <Text style={styles.catCount}>{cat.transactions.length}x</Text>
        </View>
        <Text style={[styles.catAmount, { color: groupColor }]}>{fmt(cat.total)}</Text>
      </TouchableOpacity>

      {/* Mini bar within group */}
      <View style={styles.catBarBg}>
        <View style={[styles.catBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: groupColor + '80' }]} />
      </View>

      {/* Expanded transactions */}
      {expanded && (
        <View style={styles.txList}>
          {cat.transactions.map(t => (
            <View key={t.id} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txDate}>{t.date}</Text>
                <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
              </View>
              <Text style={styles.txAmount}>{fmt(t.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f4c430',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e8e0d0',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888', textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 6 },

  // Month picker
  monthScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  monthContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  monthPillActive: {
    backgroundColor: '#f4c430',
    borderColor: '#f4c430',
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  monthPillTextActive: {
    color: '#0a0e1a',
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Total banner
  totalBanner: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f87171',
  },
  totalSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Group card
  groupCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  groupEmoji: { fontSize: 20 },
  groupHeaderInfo: {
    flex: 1,
  },
  groupLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e8e0d0',
  },
  groupCatCount: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  groupHeaderRight: {
    alignItems: 'flex-end',
  },
  groupAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupPct: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  groupBarBg: {
    height: 4,
    backgroundColor: '#0c1020',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  groupBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: '#0c102080',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },

  // Category row
  catRow: {
    marginBottom: 8,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, color: '#c0c0c0', fontWeight: '500' },
  catCount: { fontSize: 11, color: '#555' },
  catAmount: { fontSize: 13, fontWeight: '700' },
  catBarBg: {
    height: 3,
    backgroundColor: '#0c1020',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 3,
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Transaction list
  txList: {
    backgroundColor: '#0c102060',
    borderRadius: 8,
    marginTop: 6,
    padding: 8,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  txLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  txDate: {
    fontSize: 11,
    color: '#666',
    width: 70,
  },
  txDesc: {
    fontSize: 12,
    color: '#c0c0c0',
    flex: 1,
  },
  txAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },

  // Uncategorized CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4c43012',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#f4c43035',
    gap: 10,
  },
  ctaBtnEmoji: { fontSize: 20 },
  ctaBtnContent: { flex: 1 },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4c430',
  },
  ctaBtnSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  ctaBtnArrow: {
    fontSize: 22,
    fontWeight: '300',
    color: '#f4c430',
  },
});
