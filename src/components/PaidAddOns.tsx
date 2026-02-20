// src/components/PaidAddOns.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Premium features section for the Profile screen.
// Shows available paid tools with lock/unlock state.
// Long-press any tool to hide it. Hidden tools collapse under a toggle.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const UNLOCKED_KEY = 'paid_addons_unlocked';
const HIDDEN_KEY = 'paid_addons_hidden';

export interface AddOn {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: string;
  route: string;
  comingSoon?: boolean;
  hideable?: boolean;
}

const ADD_ONS: AddOn[] = [
  {
    id: 'business_dashboard',
    name: 'Business Dashboard',
    emoji: '🏢',
    description: 'Track your business — revenue, expenses, P&L, distributions',
    price: '$4.99',
    route: '/business',
    hideable: true,
  },
  {
    id: 'divorce_simulator',
    name: 'Divorce Simulator',
    emoji: '💔',
    description: 'Calculate the financial impact of divorce — alimony, child support, asset division by state',
    price: '$4.99',
    route: '/divorce-simulator',
    hideable: true,
  },
  {
    id: 'tax_optimizer',
    name: 'Tax Loss Harvesting',
    emoji: '🧾',
    description: 'Identify crypto tax loss harvesting opportunities across your portfolio',
    price: '$2.99',
    route: '/tax-optimizer',
    comingSoon: true,
  },
  {
    id: 'estate_planner',
    name: 'Estate Planner',
    emoji: '📜',
    description: 'Model inheritance, beneficiary splits, and estate tax implications',
    price: '$4.99',
    route: '/estate-planner',
    comingSoon: true,
  },
];

export default function PaidAddOns() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(UNLOCKED_KEY).then(raw => {
      if (raw) setUnlocked(new Set(JSON.parse(raw)));
    });
    AsyncStorage.getItem(HIDDEN_KEY).then(raw => {
      if (raw) setHidden(new Set(JSON.parse(raw)));
    });
  }, []);

  const saveHidden = useCallback(async (newHidden: Set<string>) => {
    setHidden(newHidden);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...newHidden]));
  }, []);

  const handlePress = (addon: AddOn) => {
    if (addon.comingSoon) return;
    router.push(addon.route as any);
  };

  const handleLongPress = (addon: AddOn) => {
    if (!addon.hideable) return;

    const isHidden = hidden.has(addon.id);

    if (isHidden) {
      // Unhide
      const next = new Set(hidden);
      next.delete(addon.id);
      saveHidden(next);
    } else {
      // Hide
      if (Platform.OS === 'web') {
        // No Alert on web — just do it
        const next = new Set(hidden);
        next.add(addon.id);
        saveHidden(next);
      } else {
        Alert.alert(
          `Hide ${addon.name}?`,
          'You can restore it from the hidden tools section below.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Hide', style: 'destructive', onPress: () => {
              const next = new Set(hidden);
              next.add(addon.id);
              saveHidden(next);
            }},
          ]
        );
      }
    }
  };

  const visibleAddOns = ADD_ONS.filter(a => !hidden.has(a.id));
  const hiddenAddOns = ADD_ONS.filter(a => hidden.has(a.id));

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>🔓 Premium Tools</Text>
      <Text style={s.sectionSub}>Advanced financial planning tools · long-press to hide</Text>

      {visibleAddOns.map(addon => (
        <AddOnCard
          key={addon.id}
          addon={addon}
          isUnlocked={unlocked.has(addon.id)}
          onPress={() => handlePress(addon)}
          onLongPress={() => handleLongPress(addon)}
        />
      ))}

      {/* Hidden tools toggle */}
      {hiddenAddOns.length > 0 && (
        <>
          <TouchableOpacity style={s.hiddenToggle} onPress={() => setShowHidden(!showHidden)}>
            <Text style={s.hiddenToggleText}>
              {showHidden ? '▾' : '▸'} {hiddenAddOns.length} hidden tool{hiddenAddOns.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          {showHidden && hiddenAddOns.map(addon => (
            <AddOnCard
              key={addon.id}
              addon={addon}
              isUnlocked={unlocked.has(addon.id)}
              isHidden
              onPress={() => handlePress(addon)}
              onLongPress={() => handleLongPress(addon)}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

function AddOnCard({ addon, isUnlocked, isHidden, onPress, onLongPress }: {
  addon: AddOn;
  isUnlocked: boolean;
  isHidden?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.card, addon.comingSoon && s.cardDisabled, isHidden && s.cardHidden]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={addon.comingSoon ? 1 : 0.7}
    >
      <View style={s.cardHeader}>
        <Text style={s.cardEmoji}>{addon.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{addon.name}</Text>
          <Text style={s.cardDesc}>{addon.description}</Text>
        </View>
        {isHidden ? (
          <View style={s.hiddenBadge}>
            <Text style={s.hiddenBadgeText}>Hidden</Text>
          </View>
        ) : addon.comingSoon ? (
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonText}>Soon</Text>
          </View>
        ) : isUnlocked ? (
          <View style={s.unlockedBadge}>
            <Text style={s.unlockedText}>✓</Text>
          </View>
        ) : (
          <View style={s.priceBadge}>
            <Text style={s.priceText}>{addon.price}</Text>
          </View>
        )}
      </View>
      {isHidden && (
        <Text style={s.unhideHint}>Long-press to restore</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d0', marginBottom: 2 },
  sectionSub: { fontSize: 12, color: '#666', marginBottom: 12 },

  card: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2a2f3e',
  },
  cardDisabled: { opacity: 0.5 },
  cardHidden: { opacity: 0.4, borderStyle: 'dashed' as any },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardDesc: { fontSize: 12, color: '#888', marginTop: 2, lineHeight: 16 },

  priceBadge: {
    backgroundColor: '#f4c43020', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#f4c43060',
  },
  priceText: { fontSize: 13, fontWeight: '800', color: '#f4c430' },

  unlockedBadge: {
    backgroundColor: '#4ade8020', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4ade8060',
  },
  unlockedText: { fontSize: 13, fontWeight: '800', color: '#4ade80' },

  comingSoonBadge: {
    backgroundColor: '#a855f720', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#a855f760',
  },
  comingSoonText: { fontSize: 11, fontWeight: '700', color: '#a855f7' },

  hiddenBadge: {
    backgroundColor: '#66666620', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#66666640',
  },
  hiddenBadgeText: { fontSize: 11, fontWeight: '700', color: '#666' },

  hiddenToggle: { paddingVertical: 10, alignItems: 'center' },
  hiddenToggleText: { fontSize: 13, color: '#555', fontWeight: '600' },

  unhideHint: { fontSize: 10, color: '#555', marginTop: 6, textAlign: 'center' },
});
