// src/components/BadgeToast.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Animated toast that pops up when a new badge is earned
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { BADGE_MAP, TIER_COLORS } from '../types/badges';
import type { BadgeDefinition, BadgeTier } from '../types/badges';
import { useStore } from '../store/useStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_DURATION = 5000; // 5 seconds visible

export default function BadgeToast() {
  const earnedBadges = useStore(s => s.earnedBadges || []);
  const markBadgeSeen = useStore(s => s.markBadgeSeen);

  const [currentBadge, setCurrentBadge] = useState<BadgeDefinition | null>(null);
  const [currentTier, setCurrentTier] = useState<BadgeTier>('pawn');
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const queue = useRef<string[]>([]);
  const isShowing = useRef(false);

  const showNext = useCallback(() => {
    if (queue.current.length === 0 || isShowing.current) return;

    const badgeId = queue.current.shift()!;
    const badge = BADGE_MAP[badgeId];
    if (!badge) return;

    isShowing.current = true;
    setCurrentBadge(badge);
    setCurrentTier(badge.tier);

    // Slide in + scale
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration
    setTimeout(() => {
      dismissToast(badgeId);
    }, TOAST_DURATION);
  }, []);

  const dismissToast = useCallback((badgeId: string) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      markBadgeSeen(badgeId);
      setCurrentBadge(null);
      isShowing.current = false;

      // Show next if queued
      setTimeout(() => showNext(), 500);
    });
  }, [markBadgeSeen, showNext]);

  // Watch for unseen badges
  useEffect(() => {
    const unseen = earnedBadges.filter(b => !b.seen).map(b => b.badgeId);
    if (unseen.length > 0) {
      queue.current = [...new Set([...queue.current, ...unseen])];
      showNext();
    }
  }, [earnedBadges, showNext]);

  if (!currentBadge) return null;

  const tierColors = TIER_COLORS[currentTier];

  return (
    <Animated.View
      style={[
        s.container,
        {
          backgroundColor: tierColors.bg,
          borderColor: tierColors.border,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={s.content}
        onPress={() => dismissToast(currentBadge.id)}
        activeOpacity={0.9}
      >
        {/* Badge emoji with glow */}
        <View style={[s.emojiContainer, { backgroundColor: tierColors.border }]}>
          <Text style={s.emoji}>{currentBadge.emoji}</Text>
        </View>

        {/* Badge info */}
        <View style={s.info}>
          <View style={s.titleRow}>
            <Text style={s.achievedLabel}>BADGE EARNED</Text>
            <Text style={[s.tierLabel, { color: tierColors.text }]}>
              {currentTier === 'kinged' ? '👑 KINGED' : currentTier === 'jump' ? '⬆️ JUMP' : '♟️ PAWN'}
            </Text>
          </View>
          <Text style={s.badgeName}>{currentBadge.name}</Text>
          <Text style={s.celebration}>{currentBadge.celebration}</Text>
          {currentBadge.freedomBoost && (
            <Text style={s.boost}>↗ {currentBadge.freedomBoost}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 2,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  emoji: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  achievedLabel: {
    fontSize: 10,
    color: '#4ade80',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tierLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '800',
    marginBottom: 3,
  },
  celebration: {
    fontSize: 13,
    color: '#c0c0c0',
    lineHeight: 18,
  },
  boost: {
    fontSize: 11,
    color: '#4ade8090',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
