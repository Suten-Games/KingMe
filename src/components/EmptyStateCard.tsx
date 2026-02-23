// src/components/EmptyStateCard.tsx
// ══════════════════════════════════════════════════════════════════
// Tab-specific empty state cards. Drop into any tab when the
// category has no data. Each card explains WHY the data matters
// and gives a clear CTA to add it.
// ══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type EmptyCategory =
  | 'income'
  | 'obligations'
  | 'bank-accounts'
  | 'assets'
  | 'debts';

interface Props {
  category: EmptyCategory;
  onAction?: () => void;
}

const CARDS: Record<EmptyCategory, {
  emoji: string;
  title: string;
  body: string;
  why: string;
  cta: string;
  accent: string;
  accentBg: string;
  realistic?: boolean; // false = might legitimately be empty
}> = {
  income: {
    emoji: '💰',
    title: 'How much do you make?',
    body: "Add your salary, side income, or any money coming in — even a rough estimate helps.",
    why: "Without income, your freedom score shows 0. Everyone earns something — let's count it.",
    cta: '+ Add Income',
    accent: '#4ade80',
    accentBg: '#4ade8015',
    realistic: true,
  },
  obligations: {
    emoji: '📋',
    title: 'What are your monthly bills?',
    body: "Rent, phone, subscriptions, utilities, insurance — the stuff you pay every month.",
    why: "Everyone has bills. Without them, we can't calculate your real surplus or freedom timeline.",
    cta: '+ Add Obligation',
    accent: '#f4c430',
    accentBg: '#f4c43015',
    realistic: true,
  },
  'bank-accounts': {
    emoji: '🏦',
    title: 'Where does your money live?',
    body: "Add your checking, savings, CashApp, Venmo — anywhere you keep cash.",
    why: "Bank balances feed your runway calculation — how long you could survive without income.",
    cta: '+ Add Account',
    accent: '#4ade80',
    accentBg: '#4ade8015',
  },
  assets: {
    emoji: '📈',
    title: "What do you own?",
    body: "401k, savings, car, crypto, investments — anything with value counts toward your net worth.",
    why: "Assets are the building blocks of financial freedom. Even small ones add up over time.",
    cta: '+ Add Asset',
    accent: '#4ade80',
    accentBg: '#4ade8015',
  },
  debts: {
    emoji: '💳',
    title: 'Tracking debts (optional)',
    body: "Student loans, credit cards, car payments — if you owe it, track it here.",
    why: "No debts? That's actually great. If that changes, we'll help you make a payoff plan.",
    cta: '+ Add Debt',
    accent: '#f87171',
    accentBg: '#f8717115',
  },
};

export default function EmptyStateCard({ category, onAction }: Props) {
  const card = CARDS[category];

  return (
    <View style={[st.container, { borderColor: `${card.accent}25` }]}>
      <LinearGradient
        colors={[card.accentBg, 'transparent']}
        style={st.gradient}
      >
        <Text style={st.emoji}>{card.emoji}</Text>
        <Text style={[st.title, { color: card.accent }]}>{card.title}</Text>
        <Text style={st.body}>{card.body}</Text>

        {/* Why it matters */}
        <View style={[st.whyBox, { backgroundColor: card.accentBg, borderColor: `${card.accent}20` }]}>
          <Text style={st.whyLabel}>Why this matters</Text>
          <Text style={st.whyText}>{card.why}</Text>
        </View>

        {/* CTA */}
        {onAction && (
          <TouchableOpacity
            style={[st.button, { backgroundColor: card.accent }]}
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={st.buttonText}>{card.cta}</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  gradient: {
    padding: 20,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#b0b0b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 320,
  },
  whyBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    width: '100%',
  },
  whyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 13,
    color: '#b0b0b8',
    lineHeight: 18,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080c18',
  },
});
