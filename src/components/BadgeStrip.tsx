// src/components/BadgeStrip.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Compact badge preview for home screen — shows recent badges + tap for gallery
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { BADGE_MAP, BADGES, TIER_COLORS } from '../types/badges';

export default function BadgeStrip() {
  const router = useRouter();
  const earnedBadges = useStore(s => s.earnedBadges || []);

  if (earnedBadges.length === 0) return null;

  const totalBadges = BADGES.length;
  const recentBadges = [...earnedBadges]
    .sort((a, b) => b.earnedAt - a.earnedAt)
    .slice(0, 6);

  return (
    <TouchableOpacity
      style={s.container}
      onPress={() => router.push('/badges')}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <Text style={s.title}>🏆 Badges</Text>
        <Text style={s.count}>{earnedBadges.length}/{totalBadges}</Text>
      </View>

      <View style={s.badgeRow}>
        {recentBadges.map(earned => {
          const badge = BADGE_MAP[earned.badgeId];
          if (!badge) return null;
          const colors = TIER_COLORS[badge.tier];
          return (
            <View
              key={earned.badgeId}
              style={[s.badgeCircle, { backgroundColor: colors.border }]}
            >
              <Text style={s.badgeEmoji}>{badge.emoji}</Text>
            </View>
          );
        })}
        {earnedBadges.length > 6 && (
          <View style={s.moreCircle}>
            <Text style={s.moreText}>+{earnedBadges.length - 6}</Text>
          </View>
        )}
        <View style={s.arrowBox}>
          <Text style={s.arrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#0c1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1a2040',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 14, color: '#fff', fontWeight: '700' },
  count: { fontSize: 13, color: '#888', fontWeight: '600' },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeEmoji: { fontSize: 20 },

  moreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a2040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: { fontSize: 12, color: '#888', fontWeight: '700' },

  arrowBox: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
  },
  arrow: { fontSize: 18, color: '#60a5fa', fontWeight: '700' },
});
