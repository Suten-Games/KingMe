// src/components/TradeInsightCards.tsx
// Surfaces trade pattern insights as dismissable alert cards on the home screen
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import { generateTradeInsights, getInsightColor, TradeInsight } from '../services/tradeInsights';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DISMISSED_KEY = 'dismissed_trade_insights';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24h

export default function TradeInsightCards() {
  const driftTrades = useStore(s => s.driftTrades || []);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const insights = useMemo(() => generateTradeInsights(driftTrades), [driftTrades]);

  // Load dismissed state
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(raw => {
      if (!raw) return;
      const parsed: Record<string, number> = JSON.parse(raw);
      // Clean up expired dismissals
      const cutoff = Date.now() - DISMISS_DURATION;
      const fresh: Record<string, number> = {};
      for (const [key, ts] of Object.entries(parsed)) {
        if (ts > cutoff) fresh[key] = ts;
      }
      setDismissed(fresh);
      AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(fresh));
    });
  }, []);

  // Dismiss by category (not exact id) — same insight won't reappear for 24h
  const handleDismiss = useCallback(async (insight: TradeInsight) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newDismissed = { ...dismissed, [insight.category]: Date.now() };
    setDismissed(newDismissed);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
  }, [dismissed]);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter dismissed
  const visible = useMemo(() => {
    const cutoff = Date.now() - DISMISS_DURATION;
    return insights.filter(i => {
      const ts = dismissed[i.category];
      return !ts || ts < cutoff;
    });
  }, [insights, dismissed]);

  if (driftTrades.length < 5 || visible.length === 0) return null;

  const shown = showAll ? visible : visible.slice(0, 3);
  const hiddenCount = visible.length - 3;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🧠 Trade Insights</Text>
        <Text style={s.headerCount}>{visible.length}</Text>
      </View>

      {shown.map(insight => {
        const color = getInsightColor(insight.severity);
        const isExpanded = expanded.has(insight.id);

        return (
          <LinearGradient
            key={insight.id}
            colors={color.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.card, { borderColor: color.border }]}
          >
            {/* Severity badge for critical */}
            {insight.severity === 'critical' && (
              <View style={s.criticalBadge}>
                <Text style={s.criticalText}>CRITICAL</Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => insight.detail ? toggleExpand(insight.id) : undefined}
            >
              <View style={s.cardTop}>
                <Text style={s.emoji}>{insight.emoji}</Text>
                <View style={s.cardContent}>
                  <Text style={[s.title, { color: color.text }]}>{insight.title}</Text>
                  <Text style={s.message}>{insight.message}</Text>
                </View>

                {/* Dismiss X */}
                <TouchableOpacity
                  style={s.dismissX}
                  onPress={() => handleDismiss(insight)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={s.dismissXText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {/* Stats row */}
            {insight.stats && (
              <View style={s.statsRow}>
                {Object.entries(insight.stats).map(([key, val]) => (
                  <View key={key} style={s.statItem}>
                    <Text style={s.statLabel}>{key}</Text>
                    <Text style={[s.statValue, { color: color.text }]}>{val}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expandable detail */}
            {isExpanded && insight.detail && (
              <View style={s.detailSection}>
                <Text style={s.detailText}>{insight.detail}</Text>
              </View>
            )}

            {/* Expand hint */}
            {insight.detail && !isExpanded && (
              <TouchableOpacity onPress={() => toggleExpand(insight.id)}>
                <Text style={s.expandHint}>Tap for details ›</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        );
      })}

      {/* Show more / less */}
      {hiddenCount > 0 && !showAll && (
        <TouchableOpacity
          style={s.moreButton}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAll(true);
          }}
        >
          <Text style={s.moreText}>+{hiddenCount} more insights</Text>
        </TouchableOpacity>
      )}

      {showAll && visible.length > 3 && (
        <TouchableOpacity
          style={s.moreButton}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAll(false);
          }}
        >
          <Text style={s.moreText}>Show less</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#e8e0d0',
  },
  headerCount: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#f4c430',
    backgroundColor: '#f4c43020',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  criticalBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    backgroundColor: '#ff4444',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    zIndex: 1,
  },
  criticalText: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    color: '#fff',
    letterSpacing: 1,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 28,
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#c0b890',
    lineHeight: 18,
  },

  dismissX: {
    padding: 4,
    marginLeft: 8,
  },
  dismissXText: {
    fontSize: 16,
    color: '#555',
    fontFamily: 'Inter_600SemiBold',
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffffff10',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#666',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },

  detailSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffffff10',
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#888',
    lineHeight: 16,
  },

  expandHint: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#555',
    marginTop: 8,
  },

  moreButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#60a5fa',
  },
});
