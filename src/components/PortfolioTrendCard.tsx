// src/components/PortfolioTrendCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Compact card showing portfolio performance: sparkline + period % changes
// Place on home screen or assets tab
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useStore } from '../store/useStore';
import {
  recordPortfolioSnapshot,
  getPortfolioTrend,
  type PortfolioTrend,
} from '../services/portfolioSnapshots';

// ─── Mini Sparkline (pure RN, no deps) ───────────────────────────────────────

function Sparkline({ data, color, width = 120, height = 36 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2, // 2px padding
  }));

  // Build SVG-like line using thin Views (hacky but works without SVG dep)
  // Actually let's just use dots — simpler and looks clean
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 0 }}>
      {data.map((v, i) => {
        const barHeight = Math.max(2, ((v - min) / range) * (height - 4));
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: barHeight,
              backgroundColor: color + '60',
              borderTopLeftRadius: 1,
              borderTopRightRadius: 1,
              marginHorizontal: 0.5,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Period Pill ──────────────────────────────────────────────────────────────

function PeriodPill({ label, pct, dollars, isSelected, onPress }: {
  label: string;
  pct: number | null;
  dollars: number | null;
  isSelected: boolean;
  onPress: () => void;
}) {
  if (pct === null) return null;

  const isUp = pct >= 0;
  const color = isUp ? '#4ade80' : '#f87171';

  return (
    <TouchableOpacity
      style={[st.pill, isSelected && { borderColor: color, backgroundColor: color + '15' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={st.pillLabel}>{label}</Text>
      <Text style={[st.pillPct, { color }]}>
        {isUp ? '+' : ''}{pct.toFixed(1)}%
      </Text>
    </TouchableOpacity>
  );
}

// ─── Metric Selector ─────────────────────────────────────────────────────────

type MetricKey = 'netWorth' | 'totalAssets' | 'totalCrypto' | 'totalCash';

const METRIC_LABELS: Record<MetricKey, string> = {
  netWorth: 'Net Worth',
  totalAssets: 'Total Assets',
  totalCrypto: 'Crypto',
  totalCash: 'Cash',
};

// ─── Main Component ──────────────────────────────────────────────────────────

type PeriodKey = '1d' | '7d' | '30d' | '90d' | 'YTD' | '1y';

export default function PortfolioTrendCard({ onPress }: { onPress?: () => void } = {}) {
  const assets = useStore(s => s.assets);
  const bankAccounts = useStore(s => s.bankAccounts);
  const debts = useStore(s => s.debts);
  const [trend, setTrend] = useState<PortfolioTrend | null>(null);
  const [metric, setMetric] = useState<MetricKey>('netWorth');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('30d');
  const [expanded, setExpanded] = useState(false);

  // Record snapshot on mount (once per day)
  useEffect(() => {
    recordPortfolioSnapshot({ assets, bankAccounts, debts });
  }, [assets, bankAccounts, debts]);

  // Load trend data
  useEffect(() => {
    getPortfolioTrend(metric).then(setTrend);
  }, [metric, assets]);

  if (!trend || trend.snapshotCount === 0) return null;

  const periods: Array<{ key: PeriodKey; label: string; pct: number | null; dollars: number | null }> = [
    { key: '1d', label: '1D', pct: trend.pct1d, dollars: trend.change1d },
    { key: '7d', label: '7D', pct: trend.pct7d, dollars: trend.change7d },
    { key: '30d', label: '30D', pct: trend.pct30d, dollars: trend.change30d },
    { key: '90d', label: '90D', pct: trend.pct90d, dollars: trend.change90d },
    { key: 'YTD', label: 'YTD', pct: trend.pctYTD, dollars: trend.changeYTD },
    { key: '1y', label: '1Y', pct: trend.pct1y, dollars: trend.change1y },
  ];

  // Get currently selected period's data
  const activePeriod = periods.find(p => p.key === selectedPeriod);
  const activePct = activePeriod?.pct;
  const activeDollars = activePeriod?.dollars;
  const isUp = (activePct ?? 0) >= 0;
  const accentColor = isUp ? '#4ade80' : '#f87171';

  // How long we've been tracking
  const trackingDays = trend.firstSnapshotDate
    ? Math.floor((Date.now() - new Date(trend.firstSnapshotDate).getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return (
    <TouchableOpacity style={st.container} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      {/* Header: metric + value */}
      <TouchableOpacity
        style={st.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={st.headerLeft}>
          <Text style={st.metricLabel}>{METRIC_LABELS[metric]}</Text>
          <Text style={st.currentValue}>
            ${trend.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          {activePct !== null && (
            <Text style={[st.changeSummary, { color: accentColor }]}>
              {isUp ? '▲' : '▼'} {activeDollars != null ? `$${Math.abs(activeDollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''} ({isUp ? '+' : ''}{(activePct ?? 0).toFixed(1)}%) {selectedPeriod}
            </Text>
          )}
          {trend.snapshotCount < 3 && (
            <Text style={st.newBadge}>📊 Tracking started — trends appear after a few days</Text>
          )}
        </View>

        {/* Sparkline */}
        {trend.sparkline30d.length >= 2 && (
          <View style={st.sparklineWrap}>
            <Sparkline data={trend.sparkline30d} color={accentColor} width={100} height={32} />
            <Text style={st.sparklineLabel}>30d</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Period pills */}
      <View style={st.pillRow}>
        {periods.map(p => (
          <PeriodPill
            key={p.key}
            label={p.label}
            pct={p.pct}
            dollars={p.dollars}
            isSelected={selectedPeriod === p.key}
            onPress={() => setSelectedPeriod(p.key)}
          />
        ))}
      </View>

      {/* Expanded: metric selector + ATH/ATL */}
      {expanded && (
        <View style={st.expandedSection}>
          {/* Metric toggle */}
          <View style={st.metricRow}>
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map(k => (
              <TouchableOpacity
                key={k}
                style={[st.metricBtn, metric === k && st.metricBtnActive]}
                onPress={() => setMetric(k)}
              >
                <Text style={[st.metricBtnText, metric === k && st.metricBtnTextActive]}>
                  {METRIC_LABELS[k]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats row */}
          <View style={st.statsRow}>
            {trend.allTimeHigh !== null && (
              <View style={st.statItem}>
                <Text style={st.statLabel}>All-Time High</Text>
                <Text style={st.statValue}>${trend.allTimeHigh.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
            )}
            {trend.allTimeLow !== null && (
              <View style={st.statItem}>
                <Text style={st.statLabel}>All-Time Low</Text>
                <Text style={st.statValue}>${trend.allTimeLow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
            )}
            <View style={st.statItem}>
              <Text style={st.statLabel}>Tracking</Text>
              <Text style={st.statValue}>
                {trackingDays < 7 ? `${trackingDays}d` : trackingDays < 60 ? `${Math.floor(trackingDays / 7)}w` : `${Math.floor(trackingDays / 30)}mo`}
              </Text>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: { flex: 1 },
  metricLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  currentValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 2 },
  changeSummary: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  newBadge: { fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' },

  // Sparkline
  sparklineWrap: { alignItems: 'center' },
  sparklineLabel: { fontSize: 9, color: '#555', marginTop: 3 },

  // Period pills
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2f3e',
    backgroundColor: '#141825',
    paddingVertical: 6,
    alignItems: 'center',
  },
  pillLabel: { fontSize: 10, color: '#666', fontWeight: '600' },
  pillPct: { fontSize: 12, fontWeight: '800', marginTop: 1 },

  // Expanded
  expandedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2f3e',
    paddingTop: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  metricBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#141825',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  metricBtnActive: {
    backgroundColor: '#60a5fa20',
    borderColor: '#60a5fa60',
  },
  metricBtnText: { fontSize: 11, color: '#666', fontWeight: '600' },
  metricBtnTextActive: { color: '#60a5fa' },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#141825',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: '#666', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
