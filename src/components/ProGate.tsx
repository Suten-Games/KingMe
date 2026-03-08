// src/components/ProGate.tsx
// Reusable gate — renders children if Pro, otherwise shows locked state

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import { T } from '../theme';

interface ProGateProps {
  featureName: string;
  lockMessage: string;
  children: React.ReactNode;
}

export default function ProGate({ featureName, lockMessage, children }: ProGateProps) {
  const isPro = useStore((s) => s.isPro);
  const router = useRouter();

  if (isPro) return <>{children}</>;

  return (
    <LinearGradient
      colors={T.gradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.container}
    >
      <Text style={s.lockIcon}>🔒</Text>
      <Text style={s.featureName}>{featureName}</Text>
      <Text style={s.lockMessage}>{lockMessage}</Text>
      <TouchableOpacity
        style={s.button}
        activeOpacity={0.8}
        onPress={() => router.push('/pro-upgrade')}
      >
        <Text style={s.buttonText}>Get Crowned</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: {
    ...T.cardBase,
    borderColor: T.gold + '40',
    alignItems: 'center',
    paddingVertical: 28,
  },
  lockIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  featureName: {
    fontSize: 17,
    color: T.gold,
    fontFamily: T.fontExtraBold,
    marginBottom: 6,
    textAlign: 'center',
  },
  lockMessage: {
    fontSize: 13,
    color: T.textSecondary,
    fontFamily: T.fontRegular,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: T.gold,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: T.radius.sm,
  },
  buttonText: {
    color: T.bg,
    fontSize: 15,
    fontFamily: T.fontBold,
  },
});
