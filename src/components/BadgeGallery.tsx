// src/components/BadgeGallery.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Badge Gallery — Displays all badges, earned + locked, organized by category
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { BADGES, BADGE_MAP, TIER_COLORS, CATEGORY_LABELS } from '../types/badges';
import type { BadgeCategory, BadgeDefinition, BadgeTier, EarnedBadge } from '../types/badges';
import { useStore } from '../store/useStore';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function BadgeCard({ badge, earned }: { badge: BadgeDefinition; earned?: EarnedBadge }) {
  const isEarned = !!earned;
  const tierColors = TIER_COLORS[badge.tier];

  return (
    <View style={[
      s.badgeCard,
      isEarned
        ? { backgroundColor: tierColors.bg, borderColor: tierColors.border }
        : { backgroundColor: '#0a0e18', borderColor: '#1a2040' },
    ]}>
      {/* Emoji */}
      <View style={[
        s.badgeEmoji,
        isEarned
          ? { backgroundColor: tierColors.border }
          : { backgroundColor: '#1a2040' },
      ]}>
        <Text style={[s.emojiText, !isEarned && s.emojiLocked]}>
          {isEarned ? badge.emoji : '🔒'}
        </Text>
      </View>

      {/* Info */}
      <Text style={[s.badgeName, !isEarned && s.textLocked]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[s.badgeDesc, !isEarned && s.textLocked]} numberOfLines={2}>
        {badge.description}
      </Text>

      {/* Tier tag */}
      <View style={[s.tierTag, { backgroundColor: isEarned ? tierColors.border : '#1a204060' }]}>
        <Text style={[s.tierText, { color: isEarned ? tierColors.text : '#555' }]}>
          {badge.tier === 'kinged' ? '👑' : badge.tier === 'jump' ? '⬆️' : '♟️'}
          {' '}{badge.tier.toUpperCase()}
        </Text>
      </View>

      {/* Earned date */}
      {earned && (
        <Text style={s.earnedDate}>{formatDate(earned.earnedAt)}</Text>
      )}
    </View>
  );
}

export default function BadgeGallery() {
  const router = useRouter();
  const earnedBadges: EarnedBadge[] = useStore(s => s.earnedBadges || []);

  const earnedMap = useMemo(() =>
    Object.fromEntries(earnedBadges.map(b => [b.badgeId, b])),
    [earnedBadges]
  );

  const totalEarned = earnedBadges.length;
  const totalBadges = BADGES.length;
  const progress = totalBadges > 0 ? totalEarned / totalBadges : 0;

  // Group badges by category
  const categories: BadgeCategory[] = ['setup', 'trading', 'safety', 'streak', 'milestone'];

  // Stats
  const stats = useMemo(() => {
    const byTier: Record<BadgeTier, number> = { pawn: 0, jump: 0, kinged: 0 };
    for (const b of earnedBadges) {
      const def = BADGE_MAP[b.badgeId];
      if (def) byTier[def.tier]++;
    }
    return byTier;
  }, [earnedBadges]);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={s.backNav}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🏆 Badge Collection</Text>
        <Text style={s.headerSub}>
          {totalEarned} / {totalBadges} earned
        </Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Tier breakdown */}
      <View style={s.tierRow}>
        <View style={s.tierStat}>
          <Text style={[s.tierStatNum, { color: TIER_COLORS.pawn.text }]}>{stats.pawn}</Text>
          <Text style={s.tierStatLabel}>♟️ Pawn</Text>
        </View>
        <View style={s.tierStat}>
          <Text style={[s.tierStatNum, { color: TIER_COLORS.jump.text }]}>{stats.jump}</Text>
          <Text style={s.tierStatLabel}>⬆️ Jump</Text>
        </View>
        <View style={s.tierStat}>
          <Text style={[s.tierStatNum, { color: TIER_COLORS.kinged.text }]}>{stats.kinged}</Text>
          <Text style={s.tierStatLabel}>👑 Kinged</Text>
        </View>
      </View>

      {/* Categories */}
      {categories.map(cat => {
        const catBadges = BADGES.filter(b => b.category === cat);
        const catEarned = catBadges.filter(b => earnedMap[b.id]).length;
        const meta = CATEGORY_LABELS[cat];

        return (
          <View key={cat} style={s.categorySection}>
            <View style={s.categoryHeader}>
              <Text style={s.categoryEmoji}>{meta.emoji}</Text>
              <Text style={s.categoryTitle}>{meta.label}</Text>
              <Text style={s.categoryCount}>{catEarned}/{catBadges.length}</Text>
            </View>

            <View style={s.badgeGrid}>
              {catBadges.map(badge => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  earned={earnedMap[badge.id]}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* Footer motivation */}
      <View style={s.footer}>
        {totalEarned === 0 ? (
          <Text style={s.footerText}>Start your journey. Connect a wallet or import a statement to earn your first badge.</Text>
        ) : totalEarned < totalBadges * 0.25 ? (
          <Text style={s.footerText}>Good start. Keep making moves — every badge earned is a step toward freedom.</Text>
        ) : totalEarned < totalBadges * 0.75 ? (
          <Text style={s.footerText}>You're building momentum. The crowned badges are within reach.</Text>
        ) : totalEarned < totalBadges ? (
          <Text style={s.footerText}>Almost there. You're in rare company — most people never get this far.</Text>
        ) : (
          <Text style={s.footerText}>👑 Every badge earned. You've mastered the board. King of the Sea.</Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18', padding: 20 },

  backNav: { marginBottom: 12 },
  backText: { color: '#60a5fa', fontSize: 16, fontWeight: '600' },

  header: { marginBottom: 12 },
  headerTitle: { fontSize: 28, color: '#fff', fontWeight: '800', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#888' },

  progressBar: {
    height: 8,
    backgroundColor: '#1a2040',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 4,
  },

  tierRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tierStat: {
    flex: 1,
    backgroundColor: '#0c1020',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a2040',
  },
  tierStatNum: { fontSize: 24, fontWeight: '800' },
  tierStatLabel: { fontSize: 12, color: '#888', marginTop: 4 },

  categorySection: { marginBottom: 24 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryEmoji: { fontSize: 20 },
  categoryTitle: { fontSize: 18, color: '#fff', fontWeight: '700', flex: 1 },
  categoryCount: { fontSize: 14, color: '#888', fontWeight: '600' },

  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  badgeCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    minHeight: 140,
  },
  badgeEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emojiText: { fontSize: 22 },
  emojiLocked: { fontSize: 18, opacity: 0.5 },
  badgeName: { fontSize: 14, color: '#fff', fontWeight: '700', marginBottom: 4 },
  badgeDesc: { fontSize: 11, color: '#a0a0a0', lineHeight: 16 },
  textLocked: { color: '#444' },

  tierTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tierText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  earnedDate: {
    fontSize: 10,
    color: '#4ade8080',
    marginTop: 6,
  },

  footer: {
    backgroundColor: '#0c1020',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a2040',
    marginTop: 8,
  },
  footerText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
});
