// src/components/SwapToast.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Animated toast for swap confirmations — bottom-anchored sibling to BadgeToast
// Matches BadgeToast's visual language: circular emoji, bold label/name/detail
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';

// ── Types ────────────────────────────────────────────────────────────────────

type ToastConfig =
  | { type: 'loading'; symbol: string; percentage: number; label?: string; detail?: string; topLabel?: string }
  | { type: 'success'; symbol: string; usdReceived: number; signature: string; label?: string; topLabel?: string }
  | { type: 'error'; message: string; topLabel?: string };

// ── Theme per state ──────────────────────────────────────────────────────────

const THEMES = {
  loading: {
    bg: '#0d1829',
    border: '#60a5fa80',
    emojiBg: '#1a2a4a',
    accent: '#60a5fa',
    defaultLabel: 'SWAP PENDING',
    emoji: '⏳',
  },
  success: {
    bg: '#0a1a10',
    border: '#4ade8080',
    emojiBg: '#0f2a1a',
    accent: '#4ade80',
    defaultLabel: 'SWAP COMPLETE',
    emoji: '✅',
  },
  error: {
    bg: '#1a0a0a',
    border: '#ff6b6b80',
    emojiBg: '#2a1010',
    accent: '#ff6b6b',
    defaultLabel: 'SWAP FAILED',
    emoji: '❌',
  },
} as const;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSwapToast() {
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const slideAnim = useRef(new Animated.Value(160)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const hideTimer = useRef<NodeJS.Timeout>();

  const hide = useCallback(() => {
    clearTimeout(hideTimer.current);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 160, duration: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 280, useNativeDriver: true }),
    ]).start(() => setConfig(null));
  }, [slideAnim, opacityAnim, scaleAnim]);

  const show = useCallback((cfg: ToastConfig) => {
    clearTimeout(hideTimer.current);
    setConfig(cfg);

    // Spring in from the bottom — same spring values as BadgeToast
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

    // Auto-dismiss after 5s for success/error; loading stays until replaced
    if (cfg.type !== 'loading') {
      hideTimer.current = setTimeout(hide, 5000);
    }
  }, [slideAnim, opacityAnim, scaleAnim, hide]);

  const ToastComponent = useCallback(() => {
    if (!config) return null;

    const theme = THEMES[config.type];
    const topLabel = config.topLabel || theme.defaultLabel;

    let name = '';
    let detail = '';

    if (config.type === 'loading') {
      name = config.label || `Trimming ${config.percentage}% of ${config.symbol}…`;
      detail = config.detail || 'Waiting for Phantom to sign';
    } else if (config.type === 'success') {
      name = config.label || `${config.symbol} → +$${(config.usdReceived ?? 0).toFixed(2)} received`;
      detail = `tx ${config.signature.slice(0, 12)}… · Tap to view on Solscan`;
    } else {
      name = 'Transaction failed';
      detail = config.message;
    }

    const handlePress = () => {
      if (config.type === 'success') {
        Linking.openURL(`https://solscan.io/tx/${config.signature}`);
      } else {
        hide();
      }
    };

    return (
      <Animated.View
        style={[
          s.container,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
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
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {/* Circular emoji — mirrors BadgeToast's emojiContainer */}
          <View style={[s.emojiContainer, { backgroundColor: theme.emojiBg, borderColor: theme.border }]}>
            <Text style={s.emoji}>{theme.emoji}</Text>
          </View>

          {/* Info block */}
          <View style={s.info}>
            <View style={s.titleRow}>
              <Text style={[s.label, { color: theme.accent }]}>{topLabel}</Text>
            </View>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            <Text style={s.detail} numberOfLines={1}>{detail}</Text>
          </View>

          {/* Dismiss X */}
          <TouchableOpacity
            onPress={hide}
            style={s.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [config, slideAnim, opacityAnim, scaleAnim, hide]);

  return { showToast: show, hideToast: hide, ToastComponent };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    color: '#ffffff',
    marginBottom: 3,
  },
  detail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#c0c0c0',
    lineHeight: 16,
  },
  closeBtn: {
    paddingLeft: 8,
  },
  closeText: {
    fontSize: 14,
    color: '#555',
  },
});
