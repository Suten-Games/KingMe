// app/net-worth.tsx
// Personal balance sheet — assets (left) vs liabilities (right), navigable by month

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useStore } from '@/store/useStore';
import PortfolioTrendCard from '@/components/PortfolioTrendCard';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import { getSnapshots, type PortfolioSnapshot } from '@/services/portfolioSnapshots';

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

// Asset type labels & emojis
const ASSET_TYPE_META: Record<string, { label: string; emoji: string }> = {
  crypto: { label: 'Crypto', emoji: '\u{1FA99}' },
  defi: { label: 'DeFi', emoji: '\u{1F4CA}' },
  real_estate: { label: 'Real Estate', emoji: '\u{1F3E0}' },
  stocks: { label: 'Stocks', emoji: '\u{1F4C8}' },
  brokerage: { label: 'Brokerage', emoji: '\u{1F4BC}' },
  business: { label: 'Business', emoji: '\u{1F3ED}' },
  retirement: { label: 'Retirement', emoji: '\u{1F3D6}\uFE0F' },
  bank_account: { label: 'Bank Account', emoji: '\u{1F3E6}' },
  other: { label: 'Other', emoji: '\u{1F4CB}' },
};

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

export default function NetWorthPage() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const assets = useStore(s => s.assets) || [];
  const bankAccounts = useStore(s => s.bankAccounts) || [];
  const debts = useStore(s => s.debts) || [];
  const obligations = useStore(s => s.obligations) || [];

  // Historical snapshots for month comparison
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  useEffect(() => { getSnapshots().then(setSnapshots); }, []);

  // Available months from snapshots
  const snapshotMonths = useMemo(() => {
    const set = new Set<string>();
    for (const s of snapshots) set.add(s.date.substring(0, 7));
    return Array.from(set).sort().reverse();
  }, [snapshots]);

  // Current month = live data, historical months = from snapshots
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allMonths = useMemo(() => {
    const set = new Set([currentMonth, ...snapshotMonths]);
    return Array.from(set).sort().reverse();
  }, [currentMonth, snapshotMonths]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const isCurrentMonth = selectedMonth === currentMonth;

  // ── Live balance sheet (current month) ──
  const liveData = useMemo(() => {
    // Group assets by type
    const assetGroups: Record<string, { items: Array<{ name: string; value: number }>; total: number }> = {};

    for (const a of assets) {
      const type = a.type || 'other';
      if (!assetGroups[type]) assetGroups[type] = { items: [], total: 0 };
      assetGroups[type].items.push({ name: a.name, value: a.value });
      assetGroups[type].total += a.value;
    }

    // Bank accounts as a group
    if (bankAccounts.length > 0) {
      const bankTotal = bankAccounts.reduce((s, b) => s + (b.currentBalance || 0), 0);
      if (!assetGroups['bank_account']) assetGroups['bank_account'] = { items: [], total: 0 };
      for (const b of bankAccounts) {
        assetGroups['bank_account'].items.push({ name: b.name, value: b.currentBalance || 0 });
      }
      assetGroups['bank_account'].total = bankTotal;
    }

    // Sort items within each group by value desc
    for (const grp of Object.values(assetGroups)) {
      grp.items.sort((a, b) => b.value - a.value);
    }

    const totalAssets = Object.values(assetGroups).reduce((s, g) => s + g.total, 0);

    // Liabilities: debts
    const debtItems = debts.map(d => ({
      name: d.name,
      value: d.balance ?? d.principal,
      monthlyPayment: d.monthlyPayment,
    })).sort((a, b) => b.value - a.value);

    const totalDebts = debtItems.reduce((s, d) => s + d.value, 0);

    return { assetGroups, totalAssets, debtItems, totalDebts, netWorth: totalAssets - totalDebts };
  }, [assets, bankAccounts, debts]);

  // ── Historical balance sheet (from snapshot) ──
  const historicalData = useMemo(() => {
    if (isCurrentMonth) return null;
    // Find the last snapshot in the selected month
    const monthSnaps = snapshots.filter(s => s.date.startsWith(selectedMonth));
    if (monthSnaps.length === 0) return null;
    const snap = monthSnaps[monthSnaps.length - 1]; // last day of month
    return snap;
  }, [selectedMonth, snapshots, isCurrentMonth]);

  // Get previous month's snapshot for comparison
  const prevMonthData = useMemo(() => {
    const idx = allMonths.indexOf(selectedMonth);
    if (idx < 0 || idx >= allMonths.length - 1) return null;
    const prevMonth = allMonths[idx + 1];
    if (isCurrentMonth && prevMonth) {
      const prevSnaps = snapshots.filter(s => s.date.startsWith(prevMonth));
      if (prevSnaps.length > 0) return prevSnaps[prevSnaps.length - 1];
    }
    if (!isCurrentMonth) {
      const prevSnaps = snapshots.filter(s => s.date.startsWith(prevMonth));
      if (prevSnaps.length > 0) return prevSnaps[prevSnaps.length - 1];
    }
    return null;
  }, [selectedMonth, allMonths, snapshots, isCurrentMonth]);

  // Data to display
  const displayNetWorth = isCurrentMonth ? liveData.netWorth : (historicalData?.netWorth ?? 0);
  const displayTotalAssets = isCurrentMonth ? liveData.totalAssets : (historicalData?.totalAssets ?? 0);
  const displayTotalDebts = isCurrentMonth ? liveData.totalDebts : (historicalData?.totalDebts ?? 0);

  const monthChange = prevMonthData ? displayNetWorth - prevMonthData.netWorth : null;
  const monthChangePct = prevMonthData && prevMonthData.netWorth !== 0
    ? ((displayNetWorth - prevMonthData.netWorth) / Math.abs(prevMonthData.netWorth)) * 100
    : null;

  const navigateMonth = (dir: -1 | 1) => {
    const idx = allMonths.indexOf(selectedMonth);
    const newIdx = idx - dir; // allMonths is sorted desc, so -dir
    if (newIdx >= 0 && newIdx < allMonths.length) {
      setSelectedMonth(allMonths[newIdx]);
    }
  };

  const canGoNewer = allMonths.indexOf(selectedMonth) > 0;
  const canGoOlder = allMonths.indexOf(selectedMonth) < allMonths.length - 1;

  const brandedHeader = (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.kmHeader, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={s.kmHeaderRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={s.kmBackButton}>
          <Text style={s.kmBackText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.kmBrand} activeOpacity={0.7} onPress={() => router.replace('/')}>
          <Image source={require('../src/assets/images/kingmelogo.jpg')} style={s.kmLogo} resizeMode="cover" />
          <MaskedView maskElement={<Text style={[s.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>KingMe</Text>}>
            <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={[s.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}>KingMe</Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>
        <View style={{ marginLeft: 'auto' }}>
          <WalletHeaderButton />
        </View>
      </View>
      <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.kmAccent} />
    </LinearGradient>
  );

  return (
    <View style={s.container}>
      {brandedHeader}

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* Portfolio Trend Card */}
        <PortfolioTrendCard />

        {/* Month Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} disabled={!canGoOlder} style={s.monthArrow}>
            <Text style={[s.monthArrowText, !canGoOlder && { opacity: 0.2 }]}>{'\u25C0'}</Text>
          </TouchableOpacity>
          <View style={s.monthCenter}>
            <Text style={s.monthTitle}>{monthLabel(selectedMonth)}</Text>
            {isCurrentMonth && <Text style={s.monthLive}>LIVE</Text>}
          </View>
          <TouchableOpacity onPress={() => navigateMonth(1)} disabled={!canGoNewer} style={s.monthArrow}>
            <Text style={[s.monthArrowText, !canGoNewer && { opacity: 0.2 }]}>{'\u25B6'}</Text>
          </TouchableOpacity>
        </View>

        {/* Net Worth Summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Net Worth</Text>
          <Text style={[s.summaryAmount, { color: displayNetWorth >= 0 ? '#4ade80' : '#f87171' }]}>
            {displayNetWorth < 0 ? '-' : ''}{fmt(displayNetWorth)}
          </Text>
          {monthChange !== null && (
            <Text style={[s.summaryChange, { color: monthChange >= 0 ? '#4ade80' : '#f87171' }]}>
              {monthChange >= 0 ? '\u25B2' : '\u25BC'} {fmt(monthChange)} ({monthChangePct !== null ? `${monthChangePct >= 0 ? '+' : ''}${monthChangePct.toFixed(1)}%` : ''}) vs prev month
            </Text>
          )}
        </View>

        {/* Balance Sheet: two-column layout */}
        <View style={s.balanceSheet}>
          {/* Left: Assets */}
          <View style={s.bsColumn}>
            <View style={s.bsColumnHeader}>
              <Text style={s.bsColumnTitle}>Assets</Text>
              <Text style={s.bsColumnTotal}>{fmt(displayTotalAssets)}</Text>
            </View>

            {isCurrentMonth ? (
              // Live: show grouped assets
              Object.entries(liveData.assetGroups)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([type, group]) => {
                  const meta = ASSET_TYPE_META[type] || ASSET_TYPE_META.other;
                  return (
                    <View key={type} style={s.bsGroup}>
                      <View style={s.bsGroupHeader}>
                        <Text style={s.bsGroupEmoji}>{meta.emoji}</Text>
                        <Text style={s.bsGroupLabel}>{meta.label}</Text>
                        <Text style={s.bsGroupTotal}>{fmt(group.total)}</Text>
                      </View>
                      {group.items.map((item, i) => (
                        <View key={i} style={s.bsItem}>
                          <Text style={s.bsItemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={s.bsItemValue}>{fmt(item.value)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })
            ) : historicalData ? (
              // Historical: show summary from snapshot
              <>
                {historicalData.totalCrypto > 0 && (
                  <View style={s.bsGroup}>
                    <View style={s.bsGroupHeader}>
                      <Text style={s.bsGroupEmoji}>{ASSET_TYPE_META.crypto.emoji}</Text>
                      <Text style={s.bsGroupLabel}>Crypto</Text>
                      <Text style={s.bsGroupTotal}>{fmt(historicalData.totalCrypto)}</Text>
                    </View>
                  </View>
                )}
                {historicalData.totalTrad > 0 && (
                  <View style={s.bsGroup}>
                    <View style={s.bsGroupHeader}>
                      <Text style={s.bsGroupEmoji}>{ASSET_TYPE_META.stocks.emoji}</Text>
                      <Text style={s.bsGroupLabel}>Traditional</Text>
                      <Text style={s.bsGroupTotal}>{fmt(historicalData.totalTrad)}</Text>
                    </View>
                  </View>
                )}
                {historicalData.totalCash > 0 && (
                  <View style={s.bsGroup}>
                    <View style={s.bsGroupHeader}>
                      <Text style={s.bsGroupEmoji}>{ASSET_TYPE_META.bank_account.emoji}</Text>
                      <Text style={s.bsGroupLabel}>Cash</Text>
                      <Text style={s.bsGroupTotal}>{fmt(historicalData.totalCash)}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={s.bsEmpty}>No snapshot data</Text>
            )}
          </View>

          {/* Right: Liabilities */}
          <View style={s.bsColumn}>
            <View style={[s.bsColumnHeader, { borderColor: '#f8717140' }]}>
              <Text style={[s.bsColumnTitle, { color: '#f87171' }]}>Liabilities</Text>
              <Text style={[s.bsColumnTotal, { color: '#f87171' }]}>{fmt(displayTotalDebts)}</Text>
            </View>

            {isCurrentMonth ? (
              liveData.debtItems.length > 0 ? (
                <View style={s.bsGroup}>
                  {liveData.debtItems.map((d, i) => (
                    <View key={i} style={s.bsItem}>
                      <Text style={s.bsItemName} numberOfLines={1}>{d.name}</Text>
                      <Text style={[s.bsItemValue, { color: '#f87171' }]}>{fmt(d.value)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.bsEmpty}>No debts</Text>
              )
            ) : historicalData ? (
              <View style={s.bsGroup}>
                <View style={s.bsGroupHeader}>
                  <Text style={s.bsGroupEmoji}>{'\u{1F4B3}'}</Text>
                  <Text style={s.bsGroupLabel}>Total Debts</Text>
                  <Text style={[s.bsGroupTotal, { color: '#f87171' }]}>{fmt(historicalData.totalDebts)}</Text>
                </View>
              </View>
            ) : (
              <Text style={s.bsEmpty}>No snapshot data</Text>
            )}
          </View>
        </View>

        {/* Monthly obligations (burn rate context) */}
        {isCurrentMonth && obligations.length > 0 && (
          <View style={s.burnCard}>
            <Text style={s.burnTitle}>Monthly Obligations</Text>
            <Text style={s.burnAmount}>
              {fmt(obligations.reduce((sum, o) => sum + o.amount, 0) + debts.reduce((sum, d) => sum + d.monthlyPayment, 0))}/mo
            </Text>
            <Text style={s.burnSub}>
              {debts.length} debts + {obligations.length} obligations
            </Text>
          </View>
        )}

        <KingMeFooter />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },

  // Header
  kmHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  kmHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kmBackButton: { padding: 8, marginRight: 2 },
  kmBackText: { fontSize: 20, color: '#60a5fa', fontWeight: '600' },
  kmBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kmLogo: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' },
  kmTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28 },
  kmAccent: { height: 1.5, marginTop: 10, borderRadius: 1 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // Month navigator
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 16 },
  monthArrow: { padding: 8 },
  monthArrowText: { fontSize: 18, color: '#f4c430', fontWeight: '700' },
  monthCenter: { alignItems: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#e8e0d0' },
  monthLive: { fontSize: 10, fontWeight: '800', color: '#4ade80', letterSpacing: 1.5, marginTop: 2 },

  // Summary
  summaryCard: { alignItems: 'center', marginBottom: 20, paddingVertical: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryAmount: { fontSize: 36, fontWeight: '800' },
  summaryChange: { fontSize: 13, fontWeight: '700', marginTop: 6 },

  // Balance sheet
  balanceSheet: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bsColumn: { flex: 1 },
  bsColumnHeader: {
    backgroundColor: '#1a1f2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4ade8040',
    alignItems: 'center',
  },
  bsColumnTitle: { fontSize: 13, fontWeight: '700', color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.5 },
  bsColumnTotal: { fontSize: 20, fontWeight: '800', color: '#4ade80', marginTop: 4 },

  bsGroup: {
    backgroundColor: '#1a1f2e',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  bsGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bsGroupEmoji: { fontSize: 14 },
  bsGroupLabel: { fontSize: 12, fontWeight: '600', color: '#c0c0c0', flex: 1 },
  bsGroupTotal: { fontSize: 13, fontWeight: '800', color: '#4ade80' },

  bsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: 20,
  },
  bsItemName: { fontSize: 11, color: '#888', flex: 1, marginRight: 6 },
  bsItemValue: { fontSize: 12, fontWeight: '700', color: '#c0c0c0' },

  bsEmpty: { fontSize: 12, color: '#555', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  // Burn rate card
  burnCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3050',
    marginBottom: 16,
  },
  burnTitle: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  burnAmount: { fontSize: 22, fontWeight: '800', color: '#f87171', marginTop: 4 },
  burnSub: { fontSize: 12, color: '#666', marginTop: 4 },
});
