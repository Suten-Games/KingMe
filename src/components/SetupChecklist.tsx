// src/components/SetupChecklist.tsx
// ══════════════════════════════════════════════════════════════════
// Persistent banner on home screen when critical data is missing.
// Shows checklist of what the user needs to add for the app to work.
// Cannot be dismissed — the app literally can't function without data.
// ══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';

interface CheckItem {
  key: string;
  label: string;
  done: boolean;
  route: string;
  emoji: string;
  priority: 'critical' | 'recommended' | 'optional';
}

export default function SetupChecklist() {
  const router = useRouter();
  const income = useStore(s => s.income);
  const obligations = useStore(s => s.obligations);
  const bankAccounts = useStore(s => s.bankAccounts);
  const assets = useStore(s => s.assets);
  const debts = useStore(s => s.debts);
  const wallets = useStore(s => s.wallets);

  const hasIncome = income.salary > 0 || income.otherIncome > 0 || (income.sources?.length ?? 0) > 0;
  const hasObligations = obligations.length > 0;
  const hasBankAccounts = bankAccounts.length > 0;
  const hasAssets = assets.length > 0;
  const hasDebts = debts.length > 0;
  const hasWallet = wallets.length > 0;

  const items: CheckItem[] = [
    { key: 'income',      label: 'Add your income',          done: hasIncome,       route: '/(tabs)/income',       emoji: '💰', priority: 'critical' },
    { key: 'obligations', label: 'Add your monthly bills',   done: hasObligations,  route: '/(tabs)/obligations',  emoji: '📋', priority: 'critical' },
    { key: 'bank',        label: 'Add a bank account',       done: hasBankAccounts,  route: '/(tabs)/assets',       emoji: '🏦', priority: 'recommended' },
    { key: 'assets',      label: 'Add your assets',          done: hasAssets,        route: '/(tabs)/assets',       emoji: '📈', priority: 'recommended' },
    { key: 'debts',       label: 'Track your debts',         done: hasDebts,         route: '/(tabs)/debts',        emoji: 'optional' as any, priority: 'optional' },
    { key: 'wallet',      label: 'Connect a Solana wallet',  done: hasWallet,        route: '/wallet-setup',        emoji: '👛', priority: 'optional' },
  ];

  const criticalMissing = items.filter(i => i.priority === 'critical' && !i.done);
  const recommendedMissing = items.filter(i => i.priority === 'recommended' && !i.done);
  const completedCount = items.filter(i => i.done).length;
  const totalItems = items.length;

  // If critical items are done, don't show the banner
  // (recommended and optional items show gentler nudges on their respective tabs)
  if (criticalMissing.length === 0 && recommendedMissing.length === 0) return null;

  const progress = completedCount / totalItems;
  const isCritical = criticalMissing.length > 0;

  return (
    <View style={st.container}>
      <LinearGradient
        colors={isCritical ? ['#f4c43015', '#f4c43008', 'transparent'] : ['#4ade8010', '#4ade8005', 'transparent']}
        style={st.gradient}
      >
        {/* Header */}
        <View style={st.header}>
          <Text style={st.headerIcon}>{isCritical ? '⚡' : '📊'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>
              {isCritical
                ? 'Your freedom score needs real data'
                : 'Almost there — add more to improve accuracy'}
            </Text>
            <Text style={st.subtitle}>
              {isCritical
                ? "We can't calculate your financial freedom without knowing what you earn and spend."
                : `${completedCount} of ${totalItems} complete`}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={st.progressBg}>
          <View style={[st.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Missing items */}
        <View style={st.items}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[st.item, item.done && st.itemDone]}
              onPress={() => !item.done && router.push(item.route as any)}
              disabled={item.done}
              activeOpacity={0.7}
            >
              <Text style={st.itemCheck}>{item.done ? '✅' : '○'}</Text>
              <Text style={[st.itemLabel, item.done && st.itemLabelDone]}>
                {item.label}
              </Text>
              {!item.done && item.priority === 'critical' && (
                <View style={st.criticalBadge}>
                  <Text style={st.criticalBadgeText}>Required</Text>
                </View>
              )}
              {!item.done && item.priority !== 'critical' && (
                <Text style={st.itemArrow}>→</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Backup note when no wallet */}
        {!hasWallet && (
          <View style={st.backupNote}>
            <Text style={st.backupNoteIcon}>🔒</Text>
            <Text style={st.backupNoteText}>
              Without a Solana wallet, your data stays on this device only. Connect a wallet to unlock encrypted cloud backup.
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f4c43030',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4c430',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#b0b0b8',
    lineHeight: 18,
  },

  // Progress
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a2040',
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#f4c430',
  },

  // Items
  items: {
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 10,
  },
  itemDone: {
    opacity: 0.45,
  },
  itemCheck: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  criticalBadge: {
    backgroundColor: '#f4c43020',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  criticalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f4c430',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemArrow: {
    fontSize: 14,
    color: '#555',
  },

  // Backup note
  backupNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a204060',
  },
  backupNoteIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  backupNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
  },
});
