// app/categorize.tsx
// Transaction sorter — Browse individual transactions or Sort groups via drag-and-drop.

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal,
  ScrollView, Animated, PanResponder, Platform, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/useStore';
import type { BankTransaction, BankTransactionCategory, BankTransactionGroup, CustomCategoryDef } from '@/types/bankTransactionTypes';
import { TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '@/types/bankTransactionTypes';

const RECAT_OPTIONS = CATEGORY_OPTIONS;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Same pattern-cleaning logic as cashflow.ts computeVariableSpending */
function cleanPattern(desc: string): string {
  return desc
    .replace(/\d{2}\/\d{2}/g, '')
    .replace(/#\d+/g, '')
    .replace(/\d{4,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 35)
    .toLowerCase();
}

interface DescriptionGroup {
  pattern: string;
  sampleDescription: string;
  count: number;
  total: number;
  transactionIds: string[];
  transactions: BankTransaction[];
}

// ── Common emoji grid for custom category creation ──────────────────────────
const EMOJI_GRID = [
  '💸', '🎁', '🏋️', '🎲', '💅', '🍺', '🐕', '✂️', '🔑', '💊',
  '🎵', '📦', '🧹', '🚿', '🎭', '🌮', '🛍️', '💎', '🎯', '🔥',
];

// ── Category tile layout tracking ───────────────────────────────────────────
type TileLayout = { pageX: number; pageY: number; width: number; height: number; category: BankTransactionCategory };

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function CategorizePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bankTransactions = useStore(s => s.bankTransactions) || [];
  const updateBankTransaction = useStore(s => s.updateBankTransaction);
  const customCategories = useStore(s => s.customCategories) || {};
  const addCustomCategory = useStore(s => s.addCustomCategory);

  const [mode, setMode] = useState<'sort' | 'browse'>('sort');
  const [filterGroup, setFilterGroup] = useState<BankTransactionGroup | 'all'>('other');
  const [autoResult, setAutoResult] = useState<string | null>(null);

  // Resolve group for a transaction
  const resolveGroup = useCallback((cat: BankTransactionCategory): BankTransactionGroup | null => {
    const builtIn = TRANSACTION_CATEGORY_META[cat as keyof typeof TRANSACTION_CATEGORY_META];
    if (builtIn) return builtIn.group;
    const custom = customCategories[cat];
    if (custom) return custom.group;
    return null;
  }, [customCategories]);

  // Count uncategorized ("other" group) for the badge
  const otherCount = useMemo(
    () => bankTransactions.filter(t => t.type === 'expense' && resolveGroup(t.category) === 'other').length,
    [bankTransactions, resolveGroup],
  );

  const filteredExpenses = useMemo(
    () => bankTransactions.filter(t => {
      if (t.type !== 'expense') return false;
      if (filterGroup === 'all') return true;
      return resolveGroup(t.category) === filterGroup;
    }),
    [bankTransactions, filterGroup, resolveGroup],
  );

  // Auto-categorize: learn from already-sorted transactions
  const { patternMap, matchableCount } = useMemo(() => {
    // Build pattern → category from all non-"other" expense transactions
    const map = new Map<string, { category: BankTransactionCategory; count: number }>();
    for (const t of bankTransactions) {
      if (t.type !== 'expense') continue;
      const grp = resolveGroup(t.category);
      if (!grp || grp === 'other') continue;
      const pattern = cleanPattern(t.description);
      if (!pattern) continue;
      const existing = map.get(pattern);
      if (existing) {
        existing.count++;
      } else {
        map.set(pattern, { category: t.category, count: 1 });
      }
    }
    // Count how many "other" transactions match a known pattern
    let matchable = 0;
    for (const t of bankTransactions) {
      if (t.type !== 'expense') continue;
      const grp = resolveGroup(t.category);
      if (grp !== 'other') continue;
      const pattern = cleanPattern(t.description);
      if (pattern && map.has(pattern)) matchable++;
    }
    return { patternMap: map, matchableCount: matchable };
  }, [bankTransactions, resolveGroup]);

  const runAutoCategorize = useCallback(() => {
    let applied = 0;
    for (const t of bankTransactions) {
      if (t.type !== 'expense') continue;
      const grp = resolveGroup(t.category);
      if (grp !== 'other') continue;
      const pattern = cleanPattern(t.description);
      if (!pattern) continue;
      const match = patternMap.get(pattern);
      if (match) {
        updateBankTransaction(t.id, { category: match.category });
        applied++;
      }
    }
    setAutoResult(applied > 0 ? `Auto-categorized ${applied} transaction${applied !== 1 ? 's' : ''}` : 'No matches found');
    setTimeout(() => setAutoResult(null), 3000);
  }, [bankTransactions, patternMap, resolveGroup, updateBankTransaction]);

  const FILTER_OPTIONS: { value: BankTransactionGroup | 'all'; label: string; emoji: string }[] = [
    { value: 'other', label: 'Unsorted', emoji: '📋' },
    { value: 'all', label: 'All', emoji: '🔍' },
    { value: 'housing', label: 'Housing', emoji: '🏠' },
    { value: 'food', label: 'Food', emoji: '🍽️' },
    { value: 'transport', label: 'Transport', emoji: '🚗' },
    { value: 'utilities', label: 'Utilities', emoji: '💡' },
    { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
    { value: 'subscriptions', label: 'Subs', emoji: '🔁' },
    { value: 'medical', label: 'Medical', emoji: '🏥' },
    { value: 'personal', label: 'Personal', emoji: '👕' },
    { value: 'entertainment', label: 'Fun', emoji: '🎟️' },
    { value: 'financial', label: 'Financial', emoji: '📈' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backBtn}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sort Transactions</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Group filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, filterGroup === opt.value && styles.filterChipActive]}
            onPress={() => setFilterGroup(opt.value)}
          >
            <Text style={[styles.filterChipText, filterGroup === opt.value && styles.filterChipTextActive]}>
              {opt.emoji} {opt.label}{opt.value === 'other' && otherCount > 0 ? ` (${otherCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Auto-categorize */}
      {matchableCount > 0 && (
        <TouchableOpacity style={styles.autoBtn} onPress={runAutoCategorize}>
          <Text style={styles.autoBtnText}>⚡ Auto-categorize {matchableCount} transaction{matchableCount !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}
      {autoResult && (
        <Text style={styles.autoResult}>{autoResult}</Text>
      )}

      {/* Segmented control */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, mode === 'sort' && styles.segmentActive]}
          onPress={() => setMode('sort')}
        >
          <Text style={[styles.segmentText, mode === 'sort' && styles.segmentTextActive]}>Sort</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, mode === 'browse' && styles.segmentActive]}
          onPress={() => setMode('browse')}
        >
          <Text style={[styles.segmentText, mode === 'browse' && styles.segmentTextActive]}>Browse</Text>
        </TouchableOpacity>
      </View>

      {mode === 'sort'
        ? <SortMode transactions={filteredExpenses} updateBankTransaction={updateBankTransaction} router={router} customCategories={customCategories} addCustomCategory={addCustomCategory} />
        : <BrowseMode transactions={filteredExpenses} updateBankTransaction={updateBankTransaction} customCategories={customCategories} addCustomCategory={addCustomCategory} />
      }
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SORT MODE — Drag card → category tile
// ════════════════════════════════════════════════════════════════════════════

function SortMode({
  transactions,
  updateBankTransaction,
  router,
  customCategories,
  addCustomCategory,
}: {
  transactions: BankTransaction[];
  updateBankTransaction: (id: string, u: Partial<BankTransaction>) => void;
  router: ReturnType<typeof useRouter>;
  customCategories: Record<string, CustomCategoryDef>;
  addCustomCategory: (key: string, def: CustomCategoryDef) => void;
}) {
  const [sortedPatterns, setSortedPatterns] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('💸');
  const [newCatGroup, setNewCatGroup] = useState<BankTransactionGroup>('personal');

  // Group transactions by cleaned description pattern
  const groups = useMemo(() => {
    const map: Record<string, { txns: BankTransaction[]; sample: string }> = {};
    for (const t of transactions) {
      const pattern = cleanPattern(t.description);
      if (!pattern) continue;
      if (!map[pattern]) map[pattern] = { txns: [], sample: t.description };
      map[pattern].txns.push(t);
    }
    return Object.entries(map)
      .map(([pattern, { txns, sample }]): DescriptionGroup => ({
        pattern,
        sampleDescription: sample.substring(0, 50),
        count: txns.length,
        total: txns.reduce((s, t) => s + Math.abs(t.amount), 0),
        transactionIds: txns.map(t => t.id),
        transactions: txns.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const remaining = useMemo(
    () => groups.filter(g => !sortedPatterns.has(g.pattern)),
    [groups, sortedPatterns],
  );

  const totalGroups = groups.length;
  const sortedCount = totalGroups - remaining.length;
  const currentGroup = remaining[0] || null;
  const allDone = remaining.length === 0 && totalGroups > 0;

  // Custom category tiles for the grid
  const customCatTiles = useMemo(() =>
    Object.entries(customCategories).map(([key, def]) => ({
      key: key as BankTransactionCategory,
      ...def,
    })),
    [customCategories],
  );

  // Category tile layout refs for hit-testing during drag
  const tileLayouts = useRef<TileLayout[]>([]);
  const registerTile = useCallback((layout: TileLayout) => {
    tileLayouts.current = tileLayouts.current.filter(l => l.category !== layout.category);
    tileLayouts.current.push(layout);
  }, []);

  // Drag state
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<BankTransactionCategory | null>(null);

  const findHitCategory = useCallback((pageX: number, pageY: number): BankTransactionCategory | null => {
    for (const l of tileLayouts.current) {
      if (pageX >= l.pageX && pageX <= l.pageX + l.width && pageY >= l.pageY && pageY <= l.pageY + l.height) {
        return l.category;
      }
    }
    return null;
  }, []);

  const assignCategory = useCallback((category: BankTransactionCategory) => {
    if (!currentGroup) return;
    for (const id of currentGroup.transactionIds) {
      updateBankTransaction(id, { category });
    }
    // Animate card out
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSortedPatterns(prev => new Set(prev).add(currentGroup.pattern));
      setExpanded(false);
      setIsRenaming(false);
      // Reset for next card
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(1);
      opacity.setValue(1);
      setHoveredCategory(null);
    });
  }, [currentGroup, updateBankTransaction, pan, scale, opacity]);

  const handleRename = useCallback(() => {
    if (!currentGroup || !renameValue.trim()) return;
    for (const id of currentGroup.transactionIds) {
      updateBankTransaction(id, { description: renameValue.trim() });
    }
    setIsRenaming(false);
  }, [currentGroup, renameValue, updateBankTransaction]);

  const handleCreateCategory = useCallback(() => {
    if (!newCatLabel.trim()) return;
    const key = `custom_${newCatLabel.trim().toLowerCase().replace(/\s+/g, '_')}`;
    addCustomCategory(key, { label: newCatLabel.trim(), emoji: newCatEmoji, group: newCatGroup });
    // If there's a current group, assign it to the new category immediately
    if (currentGroup) {
      for (const id of currentGroup.transactionIds) {
        updateBankTransaction(id, { category: key as BankTransactionCategory });
      }
      setSortedPatterns(prev => new Set(prev).add(currentGroup.pattern));
      setExpanded(false);
    }
    setShowNewCatModal(false);
    setNewCatLabel('');
    setNewCatEmoji('💸');
    setNewCatGroup('personal');
  }, [newCatLabel, newCatEmoji, newCatGroup, addCustomCategory, currentGroup, updateBankTransaction]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isRenaming,
    onMoveShouldSetPanResponder: () => !isRenaming,
    onPanResponderGrant: () => {
      setIsDragging(true);
      Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }).start();
    },
    onPanResponderMove: (evt, gestureState) => {
      pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      const hit = findHitCategory(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      setHoveredCategory(hit);
    },
    onPanResponderRelease: (evt) => {
      setIsDragging(false);
      const hit = findHitCategory(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      if (hit) {
        assignCategory(hit);
      } else {
        // Spring back
        Animated.parallel([
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        setHoveredCategory(null);
      }
    },
  }), [pan, scale, findHitCategory, assignCategory, isRenaming]);

  // ── No transactions at all ──
  if (totalGroups === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>{'\u2705'}</Text>
        <Text style={styles.emptyText}>No uncategorized transactions</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── All sorted ──
  if (allDone) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.successEmoji}>{'🎉'}</Text>
        <Text style={styles.successTitle}>All sorted!</Text>
        <Text style={styles.successSub}>{totalGroups} transaction group{totalGroups !== 1 ? 's' : ''} categorized</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.sortContainer}
      contentContainerStyle={styles.sortContent}
      scrollEnabled={!isDragging}
    >
      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{sortedCount} of {totalGroups} sorted</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.round((sortedCount / totalGroups) * 100)}%` as any }]} />
        </View>
      </View>

      {/* Sort card */}
      {currentGroup && (
        <Animated.View
          style={[
            styles.sortCard,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale },
              ],
              opacity,
            },
            Platform.OS === 'web' && !expanded && { cursor: isDragging ? 'grabbing' : 'grab' } as any,
          ]}
          {...(expanded ? {} : panResponder.panHandlers)}
        >
          {/* Header row with description + actions */}
          <View style={styles.sortCardHeader}>
            {isRenaming ? (
              <View style={styles.renameRow}>
                <TextInput
                  style={styles.renameInput}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  placeholderTextColor="#555"
                  onSubmitEditing={handleRename}
                  {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                />
                <TouchableOpacity onPress={handleRename} style={styles.renameSaveBtn}>
                  <Text style={styles.renameSaveBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsRenaming(false)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.sortCardDesc} numberOfLines={2}>{currentGroup.sampleDescription}</Text>
            )}
          </View>

          <View style={styles.sortCardMeta}>
            <Text style={styles.sortCardCount}>{currentGroup.count} transaction{currentGroup.count !== 1 ? 's' : ''}</Text>
            <Text style={styles.sortCardTotal}>{fmt(currentGroup.total)} total</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.sortCardActions}>
            <TouchableOpacity
              style={styles.sortCardActionBtn}
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sortCardActionText}>{expanded ? '\u25B2 Collapse' : '\u25BC Expand'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sortCardActionBtn}
              onPress={() => { setRenameValue(currentGroup.sampleDescription); setIsRenaming(true); setExpanded(true); }}
              activeOpacity={0.7}
            >
              <Text style={styles.sortCardActionText}>Edit name</Text>
            </TouchableOpacity>
          </View>

          {/* Expanded transaction list */}
          {expanded && (
            <View style={styles.expandedList}>
              {currentGroup.transactions.map(t => (
                <View key={t.id} style={styles.expandedRow}>
                  <View style={styles.expandedRowLeft}>
                    <Text style={styles.expandedDate}>{t.date}</Text>
                    <Text style={styles.expandedDesc} numberOfLines={1}>{t.description}</Text>
                  </View>
                  <Text style={styles.expandedAmount}>{fmt(t.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {!expanded && <Text style={styles.sortCardHint}>Drag to a category below, or tap one</Text>}
        </Animated.View>
      )}

      {/* Category grid */}
      <Text style={styles.gridTitle}>Categories</Text>
      {RECAT_OPTIONS.map(optGroup => {
        const meta = TRANSACTION_GROUP_META[optGroup.group];
        // Collect custom categories that belong to this group
        const customInGroup = customCatTiles.filter(c => c.group === optGroup.group);
        return (
          <View key={optGroup.group} style={styles.gridSection}>
            <Text style={[styles.gridSectionTitle, { color: meta.color }]}>
              {meta.emoji} {meta.label}
            </Text>
            <View style={styles.gridTiles}>
              {optGroup.categories.map(cat => (
                <CategoryTile
                  key={cat.value}
                  category={cat.value}
                  label={cat.label}
                  emoji={meta.emoji}
                  color={meta.color}
                  isHovered={hoveredCategory === cat.value}
                  onPress={() => assignCategory(cat.value)}
                  onLayout={registerTile}
                />
              ))}
              {customInGroup.map(c => (
                <CategoryTile
                  key={c.key}
                  category={c.key}
                  label={c.label}
                  emoji={c.emoji}
                  color={meta.color}
                  isHovered={hoveredCategory === c.key}
                  onPress={() => assignCategory(c.key)}
                  onLayout={registerTile}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* + New Category tile */}
      <TouchableOpacity
        style={styles.newCatBtn}
        onPress={() => setShowNewCatModal(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.newCatBtnPlus}>+</Text>
        <Text style={styles.newCatBtnText}>New Category</Text>
      </TouchableOpacity>

      {/* Create Category Modal */}
      <Modal visible={showNewCatModal} transparent animationType="slide" onRequestClose={() => setShowNewCatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create Category</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newCatLabel}
              onChangeText={setNewCatLabel}
              placeholder="e.g. Mistress"
              placeholderTextColor="#555"
              autoFocus={Platform.OS === 'web'}
              {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
            />

            <Text style={styles.modalLabel}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_GRID.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiCell, newCatEmoji === e && styles.emojiCellActive]}
                  onPress={() => setNewCatEmoji(e)}
                >
                  <Text style={styles.emojiCellText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              <View style={styles.modalPillRow}>
                {(Object.keys(TRANSACTION_GROUP_META) as BankTransactionGroup[]).map(grp => {
                  const gm = TRANSACTION_GROUP_META[grp];
                  return (
                    <TouchableOpacity
                      key={grp}
                      style={[
                        styles.modalPill,
                        { borderColor: gm.color + '40' },
                        newCatGroup === grp && { borderColor: '#f4c430', backgroundColor: '#f4c43020' },
                      ]}
                      onPress={() => setNewCatGroup(grp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.modalPillText,
                        { color: gm.color },
                        newCatGroup === grp && { color: '#f4c430' },
                      ]}>
                        {gm.emoji} {gm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !newCatLabel.trim() && { opacity: 0.4 }]}
                onPress={handleCreateCategory}
                disabled={!newCatLabel.trim()}
              >
                <Text style={styles.modalSaveBtnText}>Create & Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowNewCatModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Category tile with layout measurement ───────────────────────────────────

function CategoryTile({
  category, label, emoji, color, isHovered, onPress, onLayout,
}: {
  category: BankTransactionCategory;
  label: string;
  emoji: string;
  color: string;
  isHovered: boolean;
  onPress: () => void;
  onLayout: (layout: TileLayout) => void;
}) {
  const ref = useRef<View>(null);

  const handleLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        onLayout({ pageX: x, pageY: y, width: w, height: h, category });
      }
    });
  }, [category, onLayout]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View
        ref={ref}
        onLayout={handleLayout}
        style={[
          styles.tile,
          { borderColor: color + '40' },
          isHovered && { borderColor: '#f4c430', borderWidth: 2, transform: [{ scale: 1.08 }] },
        ]}
      >
        <Text style={styles.tileEmoji}>{emoji}</Text>
        <Text style={[styles.tileLabel, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BROWSE MODE — Flat list with edit modal
// ════════════════════════════════════════════════════════════════════════════

function BrowseMode({
  transactions,
  updateBankTransaction,
  customCategories,
  addCustomCategory,
}: {
  transactions: BankTransaction[];
  updateBankTransaction: (id: string, u: Partial<BankTransaction>) => void;
  customCategories: Record<string, CustomCategoryDef>;
  addCustomCategory: (key: string, def: CustomCategoryDef) => void;
}) {
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<BankTransactionCategory>('other');

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  // Group custom categories by their group for the picker
  const customByGroup = useMemo(() => {
    const map: Record<string, { key: string; label: string; emoji: string }[]> = {};
    for (const [key, def] of Object.entries(customCategories)) {
      if (!map[def.group]) map[def.group] = [];
      map[def.group].push({ key, label: def.label, emoji: def.emoji });
    }
    return map;
  }, [customCategories]);

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

  const renderItem = useCallback(({ item }: { item: BankTransaction }) => (
    <TouchableOpacity style={styles.browseRow} onPress={() => openEdit(item)} activeOpacity={0.7}>
      <View style={styles.browseRowLeft}>
        <Text style={styles.browseDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.browseDate}>{item.date}</Text>
      </View>
      <Text style={styles.browseAmount}>{fmt(item.amount)}</Text>
    </TouchableOpacity>
  ), [openEdit]);

  return (
    <View style={styles.browseContainer}>
      {sorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No uncategorized transactions</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={t => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Edit modal */}
      <Modal visible={!!editingTx} transparent animationType="slide" onRequestClose={() => setEditingTx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>

            {/* Description input */}
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholderTextColor="#555"
              autoFocus={Platform.OS === 'web'}
            />

            {/* Category picker */}
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

            {/* Actions */}
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

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════

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

  // Group filter
  filterScroll: {
    maxHeight: 38,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  filterChipActive: {
    backgroundColor: '#f4c43020',
    borderColor: '#f4c430',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  filterChipTextActive: {
    color: '#f4c430',
  },

  // Auto-categorize
  autoBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f4c43015',
    borderWidth: 1,
    borderColor: '#f4c43040',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  autoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4c430',
  },
  autoResult: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ade80',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Segmented control
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1a1f2e',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#f4c430',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  segmentTextActive: {
    color: '#0a0e1a',
  },

  // Sort mode
  sortContainer: {
    flex: 1,
  },
  sortContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Progress bar
  progressRow: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c0c0c0',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1a1f2e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f4c430',
    borderRadius: 3,
  },

  // Sort card
  sortCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a3050',
    ...(Platform.OS === 'web' ? { userSelect: 'none' } : {}) as any,
  },

  sortCardHeader: {
    marginBottom: 8,
  },
  sortCardDesc: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e8e0d0',
  },
  sortCardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  sortCardCount: {
    fontSize: 13,
    color: '#888',
  },
  sortCardTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4c430',
  },
  sortCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sortCardActionBtn: {
    backgroundColor: '#0c1020',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  sortCardActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f4c430',
  },
  sortCardHint: {
    fontSize: 11,
    color: '#555',
    fontStyle: 'italic',
  },

  // Rename
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  renameInput: {
    flex: 1,
    backgroundColor: '#0c1020',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f4c43060',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#fff',
  },
  renameSaveBtn: {
    backgroundColor: '#f4c430',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  renameSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  renameCancelText: {
    fontSize: 12,
    color: '#666',
  },

  // Expanded transaction list
  expandedList: {
    borderTopWidth: 1,
    borderTopColor: '#2a305060',
    marginTop: 6,
    paddingTop: 6,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  expandedRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  expandedDate: {
    fontSize: 11,
    color: '#666',
    width: 70,
  },
  expandedDesc: {
    fontSize: 12,
    color: '#c0c0c0',
    flex: 1,
  },
  expandedAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },

  // New category button
  newCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c1020',
    borderWidth: 1,
    borderColor: '#f4c43040',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 20,
    gap: 6,
  },
  newCatBtnPlus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4c430',
  },
  newCatBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4c430',
  },

  // Emoji picker grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  emojiCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0c1020',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  emojiCellActive: {
    borderColor: '#f4c430',
    backgroundColor: '#f4c43020',
  },
  emojiCellText: {
    fontSize: 18,
  },

  // Category grid
  gridTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  gridSection: {
    marginBottom: 12,
  },
  gridSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  gridTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1020',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  tileEmoji: { fontSize: 13 },
  tileLabel: { fontSize: 12, fontWeight: '600' },

  // Empty / success states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#f4c430', marginBottom: 6 },
  successSub: { fontSize: 14, color: '#888', marginBottom: 24 },
  doneBtn: {
    backgroundColor: '#f4c430',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0e1a',
  },

  // Browse mode
  browseContainer: {
    flex: 1,
  },
  browseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  browseRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  browseDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e8',
  },
  browseDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  browseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f87171',
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
