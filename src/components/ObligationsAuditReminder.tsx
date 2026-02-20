// src/components/ObligationsAuditReminder.tsx
// Shows a periodic reminder to review obligations for potential cuts/negotiations
// Appears every 30 days, dismissable for 30 days

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';

const DISMISS_KEY = 'obligations_audit_dismissed';
const DISMISS_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export default function ObligationsAuditReminder() {
  const router = useRouter();
  const obligations = useStore(s => s.obligations);
  const [dismissed, setDismissed] = useState(true); // hidden by default until loaded

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then(val => {
      if (!val || Date.now() - parseInt(val) >= DISMISS_DURATION) {
        setDismissed(false);
      }
    });
  }, []);

  if (dismissed || obligations.length === 0) return null;

  const totalMonthly = obligations.reduce((sum, o) => sum + o.amount, 0);
  const count = obligations.length;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.emoji}>🔍</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Time for an Obligations Audit</Text>
          <Text style={s.sub}>
            You have {count} obligations totaling ${totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo. 
            Any you can negotiate down, cancel, or consolidate?
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tips}>
        <Text style={s.tip}>📞 Call providers to negotiate rates (insurance, phone, internet)</Text>
        <Text style={s.tip}>🗑️ Cancel subscriptions you don't use</Text>
        <Text style={s.tip}>🔄 Refinance high-rate debts</Text>
      </View>

      <TouchableOpacity 
        style={s.button} 
        onPress={() => {
          handleDismiss();
          router.push('/(tabs)/obligations');
        }}
      >
        <Text style={s.buttonText}>Review Obligations →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c084fc30',
    borderLeftWidth: 4,
    borderLeftColor: '#c084fc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  emoji: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '800', color: '#c084fc' },
  sub: { fontSize: 13, color: '#a0a0b0', marginTop: 3, lineHeight: 18 },
  dismiss: { fontSize: 14, color: '#666', padding: 6, backgroundColor: '#ffffff10', borderRadius: 12, overflow: 'hidden' },
  tips: { gap: 6, marginBottom: 12 },
  tip: { fontSize: 12, color: '#888', lineHeight: 17 },
  button: {
    backgroundColor: '#c084fc20',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c084fc40',
  },
  buttonText: { fontSize: 14, fontWeight: '700', color: '#c084fc' },
});
