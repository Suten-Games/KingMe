// src/components/ProDiscoveryCard.tsx
// Compact home-screen card promoting KingMe Pro — self-hides if already Pro

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import { T } from '../theme';

const FEATURES = [
  'AI Desires Planner',
  'Full What-If Scenarios',
  'All Add-Ons Included',
];

export default function ProDiscoveryCard() {
  const isPro = useStore(s => s.isPro);
  const router = useRouter();

  if (isPro) return null;

  return (
    <LinearGradient
      colors={T.gradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.card}
    >
      <View style={s.row}>
        <Image
          source={require('../assets/images/kingmelogo.jpg')}
          style={s.logo}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={s.headline}>Get Crowned</Text>
          {FEATURES.map(f => (
            <View key={f} style={s.featureRow}>
              <Text style={s.check}>✓</Text>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={s.button}
        activeOpacity={0.8}
        onPress={() => router.push('/pro-upgrade')}
      >
        <Text style={s.buttonText}>Get Crowned — $19.99</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: {
    ...T.cardBase,
    borderColor: T.gold + '40',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.gold + '50',
  },
  headline: {
    fontSize: 15,
    color: T.gold,
    fontFamily: T.fontExtraBold,
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  check: {
    fontSize: 12,
    color: T.gold,
    fontFamily: T.fontBold,
  },
  featureText: {
    fontSize: 12,
    color: T.textSecondary,
    fontFamily: T.fontMedium,
  },
  button: {
    backgroundColor: T.gold,
    paddingVertical: 10,
    borderRadius: T.radius.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: T.bg,
    fontSize: 14,
    fontFamily: T.fontBold,
  },
});
