// src/components/SpendingGapAlert.tsx
// Shows auto-calculated variable spending from bank transactions.
// Category breakdown with coaching questions to help reduce spending.
// Bulk re-categorization for "Other" transactions.

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import type { OverallCashFlow, VariableSpendingGroup, UncategorizedGroup } from '../services/cashflow';
import type { BankTransactionCategory, BankTransactionGroup } from '../types/bankTransactionTypes';
import { TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '../types/bankTransactionTypes';

interface Props {
  cashFlow: OverallCashFlow;
}

const RECAT_OPTIONS = CATEGORY_OPTIONS;

export default function SpendingGapAlert({ cashFlow }: Props) {
  const monthlyDiscretionary = useStore(s => s.monthlyDiscretionary);
  const setMonthlyDiscretionary = useStore(s => s.setMonthlyDiscretionary);
  const customCategories = useStore(s => s.customCategories) || {};
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { variableSpending } = cashFlow;
  const hasAutoEstimate = variableSpending.autoEstimate > 0;
  const hasUserOverride = monthlyDiscretionary > 0;
  const hasObligations = cashFlow.totalMonthlyObligations > 0;
  const effective = variableSpending.effectiveDiscretionary;

  // Don't show if no obligations and no variable spending data
  if (!hasObligations && !hasAutoEstimate) return null;

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const handleSave = () => {
    const parsed = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
    if (parsed > 0) {
      setMonthlyDiscretionary(parsed);
      setEditing(false);
    }
  };

  const handleClearOverride = () => {
    setMonthlyDiscretionary(0);
    setEditing(false);
  };

  const startEdit = () => {
    setInputValue(String(effective || ''));
    setEditing(true);
    setExpanded(true);
  };

  // ── No data at all: prompt to import or estimate ──────────
  if (!hasAutoEstimate && !hasUserOverride) {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => {
            if (!expanded) setInputValue('');
            setExpanded(!expanded);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Variable spending not tracked</Text>
              <Text style={styles.headerSub}>
                Your tracked bills are {fmt(cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments)}/mo — but groceries, gas, dining, and other variable expenses aren't included yet.
              </Text>
            </View>
          </View>
          <Text style={styles.headerAction}>
            {expanded ? '' : 'Import transactions or set estimate  \u203A'}
          </Text>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.body}>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="e.g. 800"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoFocus={Platform.OS === 'web'}
              />
              <Text style={styles.inputSuffix}>/mo</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, !inputValue && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!inputValue}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Set Estimate</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>
              Import bank transactions for an automatic estimate based on your actual spending history.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Has data (auto-estimate and/or user override) ─────────
  const otherGroup = variableSpending.groups.find(g => g.group === 'other');
  const hasUncategorized = variableSpending.uncategorized.length > 0;

  return (
    <View style={styles.card}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitleActive}>
              Variable spending: {fmt(effective)}/mo
            </Text>
            <Text style={styles.headerSub}>
              {hasAutoEstimate
                ? `Based on ${variableSpending.monthsAnalyzed} month${variableSpending.monthsAnalyzed !== 1 ? 's' : ''} of transactions`
                : 'Manual estimate'}
              {hasUserOverride && hasAutoEstimate
                ? ` · Override: ${fmt(monthlyDiscretionary)}`
                : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={startEdit} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
            <Text style={styles.chevron}>{expanded ? '\u25B2' : '\u25BC'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Editing overlay */}
      {editing && (
        <View style={styles.body}>
          {hasAutoEstimate && (
            <View style={styles.autoHint}>
              <Text style={styles.autoHintText}>
                Auto-calculated: {fmt(variableSpending.autoEstimate)}/mo from your transactions
              </Text>
            </View>
          )}
          <View style={styles.inputRow}>
            <Text style={styles.inputPrefix}>$</Text>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={String(variableSpending.autoEstimate || 800)}
              placeholderTextColor="#555"
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus={Platform.OS === 'web'}
            />
            <Text style={styles.inputSuffix}>/mo</Text>
          </View>
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1 }, !inputValue && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!inputValue}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Save Override</Text>
            </TouchableOpacity>
            {hasUserOverride && hasAutoEstimate && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleClearOverride}
                activeOpacity={0.8}
              >
                <Text style={styles.resetBtnText}>Use Auto</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setEditing(false)}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category breakdown — expanded, not editing */}
      {expanded && !editing && variableSpending.groups.length > 0 && (
        <View style={styles.body}>
          {hasUncategorized && <SortAllButton count={variableSpending.uncategorized.length} />}
          <Text style={styles.breakdownTitle}>Where it goes</Text>
          {variableSpending.groups.map(g => (
            g.group === 'other' && hasUncategorized
              ? <OtherCategoryWithRecat
                  key={g.group}
                  group={g}
                  total={variableSpending.autoEstimate}
                  uncategorized={variableSpending.uncategorized}
                  customCategories={customCategories}
                />
              : <CategoryRow key={g.group} group={g} total={variableSpending.autoEstimate} />
          ))}

          {/* Total bar */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total variable</Text>
            <Text style={styles.totalValue}>{fmt(variableSpending.autoEstimate)}/mo</Text>
          </View>

          {hasUserOverride && (
            <Text style={styles.overrideNote}>
              Using your override of {fmt(monthlyDiscretionary)}/mo instead of the auto-calculated {fmt(variableSpending.autoEstimate)}/mo
            </Text>
          )}

          <ViewAllSpendingButton />
        </View>
      )}

      {/* No breakdown but expanded */}
      {expanded && !editing && variableSpending.groups.length === 0 && (
        <View style={styles.body}>
          <Text style={styles.hint}>
            Import bank transactions to see a breakdown of where your variable spending goes.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Standard category row with coaching ─────────────────────
function CategoryRow({ group, total }: { group: VariableSpendingGroup; total: number }) {
  const [showCoaching, setShowCoaching] = useState(false);
  const pct = total > 0 ? Math.round((group.monthly / total) * 100) : 0;
  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <TouchableOpacity
      style={styles.catRow}
      onPress={() => setShowCoaching(!showCoaching)}
      activeOpacity={0.7}
    >
      <View style={styles.catHeader}>
        <View style={styles.catLeft}>
          <Text style={styles.catEmoji}>{group.emoji}</Text>
          <Text style={styles.catLabel}>{group.label}</Text>
        </View>
        <Text style={[styles.catAmount, { color: group.color }]}>{fmt(group.monthly)}/mo</Text>
      </View>
      <View style={styles.catBarBg}>
        <View style={[styles.catBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: group.color }]} />
      </View>
      {showCoaching && group.coaching && (
        <View style={styles.coachingRow}>
          <Text style={styles.coachingText}>{group.coaching}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── "Other" row with expandable re-categorization ───────────
function OtherCategoryWithRecat({
  group, total, uncategorized, customCategories,
}: {
  group: VariableSpendingGroup;
  total: number;
  uncategorized: UncategorizedGroup[];
  customCategories: Record<string, { label: string; emoji: string; group: BankTransactionGroup }>;
}) {
  const updateBankTransaction = useStore(s => s.updateBankTransaction);
  const [showRecat, setShowRecat] = useState(false);
  const [recatDone, setRecatDone] = useState<Set<string>>(new Set());
  const pct = total > 0 ? Math.round((group.monthly / total) * 100) : 0;
  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const handleAssignCategory = (ug: UncategorizedGroup, category: BankTransactionCategory) => {
    for (const id of ug.transactionIds) {
      updateBankTransaction(id, { category });
    }
    setRecatDone(prev => new Set(prev).add(ug.pattern));
  };

  const remaining = uncategorized.filter(ug => !recatDone.has(ug.pattern));

  return (
    <View style={styles.catRow}>
      <TouchableOpacity onPress={() => setShowRecat(!showRecat)} activeOpacity={0.7}>
        <View style={styles.catHeader}>
          <View style={styles.catLeft}>
            <Text style={styles.catEmoji}>{group.emoji}</Text>
            <Text style={styles.catLabel}>{group.label}</Text>
            {remaining.length > 0 && (
              <View style={styles.recatBadge}>
                <Text style={styles.recatBadgeText}>{remaining.length} to sort</Text>
              </View>
            )}
          </View>
          <Text style={[styles.catAmount, { color: group.color }]}>{fmt(group.monthly)}/mo</Text>
        </View>
        <View style={styles.catBarBg}>
          <View style={[styles.catBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: group.color }]} />
        </View>
      </TouchableOpacity>

      {showRecat && (
        <View style={styles.recatSection}>
          {remaining.length > 0 && <SortAllButton count={remaining.length} />}
          <Text style={styles.recatTitle}>
            {remaining.length > 0
              ? 'Tap a category to assign these transactions:'
              : 'All sorted! Re-expand the breakdown to see updated numbers.'}
          </Text>

          {remaining.slice(0, 15).map(ug => (
            <RecatRow key={ug.pattern} group={ug} onAssign={(cat) => handleAssignCategory(ug, cat)} customCategories={customCategories} />
          ))}

          {remaining.length > 15 && (
            <Text style={styles.recatMore}>+ {remaining.length - 15} more — sort these first</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Single uncategorized transaction group with category picker ──
function RecatRow({
  group, onAssign, customCategories,
}: {
  group: UncategorizedGroup;
  onAssign: (category: BankTransactionCategory) => void;
  customCategories: Record<string, { label: string; emoji: string; group: BankTransactionGroup }>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <View style={styles.recatRow}>
      <TouchableOpacity
        style={styles.recatRowHeader}
        onPress={() => setShowPicker(!showPicker)}
        activeOpacity={0.7}
      >
        <View style={styles.recatRowLeft}>
          <Text style={styles.recatDesc} numberOfLines={1}>{group.sampleDescription}</Text>
          <Text style={styles.recatMeta}>
            {group.count}x · {fmt(group.total)} total
          </Text>
        </View>
        <Text style={styles.recatArrow}>{showPicker ? '\u25B4' : 'Assign \u203A'}</Text>
      </TouchableOpacity>

      {showPicker && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
          <View style={styles.pickerRow}>
            {RECAT_OPTIONS.map(optGroup => (
              optGroup.categories.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.pickerPill, { borderColor: TRANSACTION_GROUP_META[optGroup.group].color + '60' }]}
                  onPress={() => onAssign(cat.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerPillEmoji}>{TRANSACTION_GROUP_META[optGroup.group].emoji}</Text>
                  <Text style={[styles.pickerPillText, { color: TRANSACTION_GROUP_META[optGroup.group].color }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))
            ))}
            {Object.entries(customCategories).map(([key, def]) => {
              const grpMeta = TRANSACTION_GROUP_META[def.group];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.pickerPill, { borderColor: grpMeta.color + '60' }]}
                  onPress={() => onAssign(key as BankTransactionCategory)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerPillEmoji}>{def.emoji}</Text>
                  <Text style={[styles.pickerPillText, { color: grpMeta.color }]}>
                    {def.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── "View all spending" link to full spending breakdown ───────────────────
function ViewAllSpendingButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.viewAllBtn}
      onPress={() => router.push('/spending')}
      activeOpacity={0.7}
    >
      <Text style={styles.viewAllBtnEmoji}>{'📊'}</Text>
      <View style={styles.viewAllBtnContent}>
        <Text style={styles.viewAllBtnText}>View all spending</Text>
        <Text style={styles.viewAllBtnSub}>Full breakdown by category with drilldown</Text>
      </View>
      <Text style={styles.viewAllBtnArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── "Sort all transactions" link to full-page sorter ─────────────────────
function SortAllButton({ count }: { count?: number }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.sortAllBtn}
      onPress={() => router.push('/categorize')}
      activeOpacity={0.7}
    >
      <Text style={styles.sortAllBtnEmoji}>{'🗂️'}</Text>
      <View style={styles.sortAllBtnContent}>
        <Text style={styles.sortAllBtnText}>Sort transactions</Text>
        <Text style={styles.sortAllBtnSub}>
          {count ? `${count} group${count !== 1 ? 's' : ''} to categorize` : 'Drag & drop to categorize'}
        </Text>
      </View>
      <Text style={styles.sortAllBtnArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9f43',
    marginTop: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff9f43',
    marginBottom: 4,
  },
  headerTitleActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
  },
  headerAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9f43',
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9f43',
  },
  chevron: {
    fontSize: 10,
    color: '#666',
  },

  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  autoHint: {
    backgroundColor: '#ff9f4315',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ff9f4325',
  },
  autoHintText: {
    fontSize: 12,
    color: '#ff9f43',
    lineHeight: 17,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1020',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3050',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  inputPrefix: { fontSize: 18, fontWeight: '700', color: '#ff9f43', marginRight: 4 },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  inputSuffix: { fontSize: 14, color: '#666', marginLeft: 6 },

  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    backgroundColor: '#ff9f43',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  resetBtn: {
    backgroundColor: '#2a3050',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff9f43',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#666',
  },

  hint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    marginTop: 8,
    textAlign: 'center',
  },

  // Category breakdown
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catRow: {
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, color: '#c0c0c0' },
  catAmount: { fontSize: 13, fontWeight: '700' },
  catBarBg: {
    height: 4,
    backgroundColor: '#0c1020',
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  coachingRow: {
    backgroundColor: '#0c102080',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#ff9f4350',
  },
  coachingText: {
    fontSize: 12,
    color: '#ccc',
    lineHeight: 17,
    fontStyle: 'italic',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a305040',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff9f43',
  },
  overrideNote: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Re-categorization
  recatBadge: {
    backgroundColor: '#ff9f4320',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recatBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9f43',
  },

  recatSection: {
    marginTop: 8,
    backgroundColor: '#0c102060',
    borderRadius: 8,
    padding: 10,
  },
  recatTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  recatMore: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },

  recatRow: {
    marginBottom: 8,
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    overflow: 'hidden',
  },
  recatRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  recatRowLeft: {
    flex: 1,
    marginRight: 8,
  },
  recatDesc: {
    fontSize: 13,
    color: '#e0e0e8',
    fontWeight: '500',
  },
  recatMeta: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  recatArrow: {
    fontSize: 12,
    color: '#ff9f43',
    fontWeight: '600',
  },

  pickerScroll: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#0c1020',
  },
  pickerPillEmoji: { fontSize: 12 },
  pickerPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // View all spending button
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#818cf815',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#818cf835',
    gap: 10,
  },
  viewAllBtnEmoji: {
    fontSize: 20,
  },
  viewAllBtnContent: {
    flex: 1,
  },
  viewAllBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
  },
  viewAllBtnSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  viewAllBtnArrow: {
    fontSize: 22,
    fontWeight: '300',
    color: '#818cf8',
  },

  // Sort all transactions button
  sortAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4c43012',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f4c43035',
    gap: 10,
  },
  sortAllBtnEmoji: {
    fontSize: 20,
  },
  sortAllBtnContent: {
    flex: 1,
  },
  sortAllBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4c430',
  },
  sortAllBtnSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  sortAllBtnArrow: {
    fontSize: 22,
    fontWeight: '300',
    color: '#f4c430',
  },
});
