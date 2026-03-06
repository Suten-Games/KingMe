// app/spending.tsx
// Full-page spending breakdown — every expense group with per-category drilldown and transactions.
// Includes obligations/debts as recurring items + edit modal for bank transactions.

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useStore } from '@/store/useStore';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup, CustomCategoryDef } from '@/types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '@/types/bankTransactionTypes';
import type { ObligationCategory } from '@/types';
import { autoCategorize } from '@/utils/csvBankImport';

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const RECAT_OPTIONS = CATEGORY_OPTIONS;

// ── ObligationCategory → BankTransactionGroup mapping ───────────────────────
const OBLIGATION_GROUP_MAP: Record<ObligationCategory, BankTransactionGroup> = {
  housing: 'housing',
  utilities: 'utilities',
  insurance: 'insurance',
  debt_service: 'financial',
  daily_living: 'personal',
  retirement: 'financial',
  other: 'other',
};

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
  return { label: cat, emoji: '\u{1F4CB}' };
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

// A "display item" in the drilldown — either a real bank transaction or a synthetic recurring entry
interface DisplayItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  isRecurring: boolean;
  bankTransaction?: BankTransaction; // present only for real txns (editable)
}

interface CategoryBreakdown {
  category: BankTransactionCategory;
  label: string;
  emoji: string;
  total: number;
  items: DisplayItem[];
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
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bankTransactions = useStore(s => s.bankTransactions) || [];
  const customCategories = useStore(s => s.customCategories) || {};
  const obligations = useStore(s => s.obligations) || [];
  const debts = useStore(s => s.debts) || [];
  const updateBankTransaction = useStore(s => s.updateBankTransaction);

  // Edit modal state
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<BankTransactionCategory>('other');

  const openEdit = useCallback((tx: BankTransaction) => {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditCategory(tx.category);
  }, []);

  const handleSave = useCallback(() => {
    if (!editingTx) return;
    updateBankTransaction(editingTx.id, {
      description: editDesc.trim() || editingTx.description,
      category: editCategory,
    });
    setEditingTx(null);
  }, [editingTx, editDesc, editCategory, updateBankTransaction]);

  // Custom categories grouped for the picker
  const customByGroup = useMemo(() => {
    const map: Record<string, { key: string; label: string; emoji: string }[]> = {};
    for (const [key, def] of Object.entries(customCategories)) {
      if (!map[def.group]) map[def.group] = [];
      map[def.group].push({ key, label: def.label, emoji: def.emoji });
    }
    return map;
  }, [customCategories]);

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

  // Number of months covered by transaction data (for scaling recurring costs in "all time")
  const monthCount = Math.max(months.length, 1);

  // Group by category group, then by category — now includes obligations & debts
  const groupBreakdowns = useMemo(() => {
    const groupMap: Record<string, { total: number; catMap: Record<string, { total: number; items: DisplayItem[] }> }> = {};

    const ensureGroup = (grp: string) => {
      if (!groupMap[grp]) groupMap[grp] = { total: 0, catMap: {} };
    };
    const ensureCat = (grp: string, cat: string) => {
      ensureGroup(grp);
      if (!groupMap[grp].catMap[cat]) groupMap[grp].catMap[cat] = { total: 0, items: [] };
    };

    // 1) Bank transactions — skip transfers & categories that duplicate Debt/Obligation objects
    const EXCLUDED_CATS = new Set([
      'transfer_between_accounts', 'transfer_to_other',   // account movements, not spending
      'financial_debt_payment',                            // credit card payments are transfers, not spending
      'financial_investment', 'financial_savings_transfer', // account movements, not spending
    ]);

    for (const t of filtered) {
      if (EXCLUDED_CATS.has(t.category)) continue;
      const grp = resolveGroup(t.category, customCategories) || 'other';
      ensureCat(grp, t.category);
      const amt = Math.abs(t.amount);
      groupMap[grp].total += amt;
      groupMap[grp].catMap[t.category].total += amt;
      groupMap[grp].catMap[t.category].items.push({
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        isRecurring: false,
        bankTransaction: t,
      });
    }

    // Helper: check if an obligation/debt name has a matching bank transaction this month
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const monthTxns = selectedMonth !== 'all'
      ? bankTransactions.filter(t => t.type !== 'income' && t.date.startsWith(selectedMonth))
      : [];
    const hasMatchingBankTx = (name: string, payee: string | undefined, amount: number) => {
      const nameNorm = normalize(name);
      const payeeNorm = payee ? normalize(payee) : '';
      return monthTxns.some(t => {
        const descNorm = normalize(t.description);
        const nameMatch = nameNorm.length >= 4 && descNorm.includes(nameNorm);
        const payeeMatch = payeeNorm.length >= 4 && descNorm.includes(payeeNorm);
        const amtClose = amount > 0 && Math.abs(t.amount - amount) / amount < 0.3;
        return nameMatch || payeeMatch || amtClose;
      });
    };

    // 2) Obligations — monthly costs, only if no matching bank transaction found
    for (const ob of obligations) {
      if (selectedMonth !== 'all' && hasMatchingBankTx(ob.name, ob.payee, ob.amount)) continue;
      // Try to place 'other' obligations in a better group using autoCategorize
      let grp: BankTransactionGroup = OBLIGATION_GROUP_MAP[ob.category] || 'other';
      let obCatKey = ob.category as string;
      if (grp === 'other') {
        const autoCat = autoCategorize(ob.name + ' ' + (ob.payee || ''));
        if (autoCat !== 'other') {
          const autoGroup = resolveGroup(autoCat, customCategories);
          if (autoGroup) { grp = autoGroup; obCatKey = autoCat; }
        }
      }
      const syntheticCat = `_obligation_${obCatKey}`;
      ensureCat(grp, syntheticCat);
      // For "all time", scale by monthCount so proportions are fair against bank txn totals
      const amt = selectedMonth === 'all' ? ob.amount * monthCount : ob.amount;
      groupMap[grp].total += amt;
      groupMap[grp].catMap[syntheticCat].total += amt;
      groupMap[grp].catMap[syntheticCat].items.push({
        id: `ob_${ob.id}`,
        description: ob.name,
        amount: ob.amount,
        date: '',
        isRecurring: true,
      });
    }

    // 3) Debts — monthly payments, only if no matching bank transaction found
    for (const d of debts) {
      if (!d.monthlyPayment) continue;
      if (selectedMonth !== 'all' && hasMatchingBankTx(d.name, d.payee, d.monthlyPayment)) continue;
      const grp: BankTransactionGroup = 'financial';
      const syntheticCat = '_debt_payment';
      ensureCat(grp, syntheticCat);
      const amt = selectedMonth === 'all' ? d.monthlyPayment * monthCount : d.monthlyPayment;
      groupMap[grp].total += amt;
      groupMap[grp].catMap[syntheticCat].total += amt;
      groupMap[grp].catMap[syntheticCat].items.push({
        id: `debt_${d.id}`,
        description: d.name,
        amount: d.monthlyPayment,
        date: '',
        isRecurring: true,
      });
    }

    // Exclude non-spending groups
    delete groupMap['income'];
    delete groupMap['transfers'];

    const result: GroupBreakdown[] = Object.entries(groupMap)
      .map(([grp, data]) => {
        const meta = TRANSACTION_GROUP_META[grp as BankTransactionGroup];
        if (!meta) return null;
        const categories: CategoryBreakdown[] = Object.entries(data.catMap)
          .map(([cat, catData]) => {
            // Synthetic obligation/debt categories get friendly labels
            let label: string;
            let emoji: string;
            if (cat === '_debt_payment') {
              label = 'Debt Payments';
              emoji = '\u{1F4B3}';
            } else if (cat.startsWith('_obligation_')) {
              const obCatKey = cat.replace('_obligation_', '');
              // Try built-in category meta first (e.g. medical_dental), then obligation group map
              const catMeta = TRANSACTION_CATEGORY_META[obCatKey as keyof typeof TRANSACTION_CATEGORY_META];
              if (catMeta) {
                label = `${catMeta.label} (recurring)`;
                emoji = catMeta.emoji;
              } else {
                const groupForOb = OBLIGATION_GROUP_MAP[obCatKey as ObligationCategory];
                const groupMeta = groupForOb ? TRANSACTION_GROUP_META[groupForOb] : null;
                label = groupMeta ? `${groupMeta.label} (recurring)` : 'Recurring';
                emoji = '\u{1F501}';
              }
            } else {
              const catMeta = resolveCategoryMeta(cat as BankTransactionCategory, customCategories);
              label = catMeta.label;
              emoji = catMeta.emoji;
            }
            return {
              category: cat as BankTransactionCategory,
              label,
              emoji,
              total: catData.total,
              items: catData.items.sort((a, b) => {
                // Recurring items at bottom, then by date desc
                if (a.isRecurring !== b.isRecurring) return a.isRecurring ? 1 : -1;
                return b.date.localeCompare(a.date);
              }),
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
      .filter(Boolean)
      .sort((a, b) => b!.total - a!.total) as GroupBreakdown[];

    return result;
  }, [filtered, bankTransactions, customCategories, obligations, debts, selectedMonth, monthCount]);

  const grandTotal = useMemo(
    () => groupBreakdowns.reduce((s, g) => s + g.total, 0),
    [groupBreakdowns],
  );

  const hasOther = groupBreakdowns.some(g => g.group === 'other');
  const hasData = expenses.length > 0 || obligations.length > 0 || debts.length > 0;

  const brandedHeader = (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.kmHeader, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={styles.kmHeaderRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.kmBackButton}>
          <Text style={styles.kmBackText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.kmBrand} activeOpacity={0.7} onPress={() => router.replace('/')}>
          <Image source={require('../src/assets/images/kingmelogo.jpg')} style={styles.kmLogo} resizeMode="cover" />
          <MaskedView maskElement={<Text style={[styles.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>KingMe</Text>}>
            <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={[styles.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}>KingMe</Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>
        <View style={{ marginLeft: 'auto' }}>
          <WalletHeaderButton />
        </View>
      </View>
      <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.kmAccent} />
    </LinearGradient>
  );

  if (!hasData) {
    return (
      <View style={styles.container}>
        {brandedHeader}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'\u{1F4CA}'}</Text>
          <Text style={styles.emptyText}>No expense transactions yet</Text>
          <Text style={styles.emptySubtext}>Import bank transactions to see your spending breakdown</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {brandedHeader}

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
              : `${monthLabel(selectedMonth)} \u00B7 ${filtered.length} transactions`}
          </Text>
        </View>

        {/* Group cards */}
        {groupBreakdowns.map(group => (
          <GroupCard
            key={group.group}
            group={group}
            grandTotal={grandTotal}
            onEditTx={openEdit}
          />
        ))}

        {/* Uncategorized CTA */}
        {hasOther && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/categorize')}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaBtnEmoji}>{'\u{1F5C2}\uFE0F'}</Text>
            <View style={styles.ctaBtnContent}>
              <Text style={styles.ctaBtnText}>Sort uncategorized transactions</Text>
              <Text style={styles.ctaBtnSub}>Drag & drop to categorize "Other" items</Text>
            </View>
            <Text style={styles.ctaBtnArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        )}
        <KingMeFooter />
      </ScrollView>

      {/* Edit Transaction Modal */}
      <Modal visible={!!editingTx} transparent animationType="slide" onRequestClose={() => setEditingTx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholderTextColor="#555"
              autoFocus={Platform.OS === 'web'}
              {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
            />

            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView style={styles.modalPickerScroll} contentContainerStyle={styles.modalPickerContent}>
              {RECAT_OPTIONS.map(optGroup => {
                const meta = TRANSACTION_GROUP_META[optGroup.group];
                const customInGroup = customByGroup[optGroup.group] || [];
                return (
                  <View key={optGroup.group}>
                    <Text style={[styles.modalGroupLabel, { color: meta.color }]}>
                      {meta.emoji} {meta.label}
                    </Text>
                    <View style={styles.modalPillRow}>
                      {optGroup.categories.map(cat => (
                        <TouchableOpacity
                          key={cat.value}
                          style={[
                            styles.modalPill,
                            { borderColor: meta.color + '40' },
                            editCategory === cat.value && { borderColor: '#f4c430', backgroundColor: '#f4c43020' },
                          ]}
                          onPress={() => setEditCategory(cat.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.modalPillText,
                            { color: meta.color },
                            editCategory === cat.value && { color: '#f4c430' },
                          ]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {customInGroup.map(c => (
                        <TouchableOpacity
                          key={c.key}
                          style={[
                            styles.modalPill,
                            { borderColor: meta.color + '40' },
                            editCategory === c.key && { borderColor: '#f4c430', backgroundColor: '#f4c43020' },
                          ]}
                          onPress={() => setEditCategory(c.key as BankTransactionCategory)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.modalPillText,
                            { color: meta.color },
                            editCategory === c.key && { color: '#f4c430' },
                          ]}>
                            {c.emoji} {c.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingTx(null)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP CARD — expandable with category drilldown
// ═══════════════════════════════════════════════════════════════════════════

function GroupCard({ group, grandTotal, onEditTx }: { group: GroupBreakdown; grandTotal: number; onEditTx: (tx: BankTransaction) => void }) {
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
            <CategoryRow key={cat.category} cat={cat} groupColor={group.color} groupTotal={group.total} onEditTx={onEditTx} />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY ROW — expandable with individual transactions + recurring items
// ═══════════════════════════════════════════════════════════════════════════

function CategoryRow({ cat, groupColor, groupTotal, onEditTx }: { cat: CategoryBreakdown; groupColor: string; groupTotal: number; onEditTx: (tx: BankTransaction) => void }) {
  const [expanded, setExpanded] = useState(false);
  const pct = groupTotal > 0 ? Math.round((cat.total / groupTotal) * 100) : 0;
  const itemCount = cat.items.length;

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
          <Text style={styles.catCount}>{itemCount}x</Text>
        </View>
        <Text style={[styles.catAmount, { color: groupColor }]}>{fmt(cat.total)}</Text>
      </TouchableOpacity>

      {/* Mini bar within group */}
      <View style={styles.catBarBg}>
        <View style={[styles.catBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: groupColor + '80' }]} />
      </View>

      {/* Expanded items */}
      {expanded && (
        <View style={styles.txList}>
          {cat.items.map(item => (
            item.isRecurring ? (
              // Recurring obligation/debt row — not tappable for editing
              <View key={item.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.recurringBadge}>Recurring</Text>
                  <Text style={styles.txDescRecurring} numberOfLines={1}>{'\u{1F501}'} {item.description}</Text>
                </View>
                <Text style={styles.txAmountRecurring}>{fmt(item.amount)}/mo</Text>
              </View>
            ) : (
              // Bank transaction row — tappable for editing
              <TouchableOpacity
                key={item.id}
                style={styles.txRow}
                onPress={() => item.bankTransaction && onEditTx(item.bankTransaction)}
                activeOpacity={0.7}
              >
                <View style={styles.txLeft}>
                  <Text style={styles.txDate}>{item.date}</Text>
                  <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
                </View>
                <Text style={styles.txAmount}>{fmt(item.amount)}</Text>
              </TouchableOpacity>
            )
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
  kmHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  kmHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kmBackButton: { padding: 8, marginRight: 2 },
  kmBackText: { fontSize: 20, color: '#60a5fa', fontWeight: '600' },
  kmBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kmLogo: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' },
  kmTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28 },
  kmAccent: { height: 1.5, marginTop: 10, borderRadius: 1 },
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

  // Transaction / item list
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

  // Recurring obligation/debt items
  recurringBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0a0e1a',
    backgroundColor: '#818cf880',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  txDescRecurring: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  txAmountRecurring: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
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

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f1322',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e8e0d0',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0c1020',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3050',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any,
  },
  modalPickerScroll: {
    maxHeight: 280,
    marginTop: 4,
  },
  modalPickerContent: {
    paddingBottom: 8,
  },
  modalGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  modalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0c1020',
  },
  modalPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: 20,
    gap: 8,
  },
  modalSaveBtn: {
    backgroundColor: '#f4c430',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    color: '#666',
  },
});
