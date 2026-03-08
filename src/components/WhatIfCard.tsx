// src/components/WhatIfCard.tsx
import { WhatIfScenario } from '@/types';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { isOnChainScenario } from '@/services/jupiterSwap';

interface WhatIfCardProps {
  scenario: WhatIfScenario;
  onPress: () => void;
  onDismiss?: () => void;
}

export default function WhatIfCard({ scenario, onPress, onDismiss }: WhatIfCardProps) {
  const { impact, emoji, title, description, difficulty, timeframe } = scenario;
  const onChain = isOnChainScenario(scenario.type);

  const freedomGainMonths = impact.freedomDelta;
  const freedomGainYears = freedomGainMonths / 12;

  // Format freedom gain
  const freedomDisplay = freedomGainYears >= 1
    ? `+${freedomGainYears.toFixed(1)} years`
    : `+${freedomGainMonths.toFixed(1)} months`;

  // Color based on impact
  const impactColor =
    freedomGainMonths > 12 ? '#4ade80' :
    freedomGainMonths > 3 ? '#60a5fa' :
    '#a855f7';

  const difficultyColor = {
    easy: '#4ade80',
    medium: '#fbbf24',
    hard: '#f87171',
  }[difficulty];

  return (
    <TouchableOpacity
      style={[styles.card, onChain && styles.cardOnChain]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.headerRight}>
          {onChain && (
            <View style={styles.onChainBadge}>
              <Text style={styles.onChainText}>⚡ On-Chain</Text>
            </View>
          )}
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
            <Text style={[styles.difficultyText, { color: difficultyColor }]}>
              {difficulty}
            </Text>
          </View>
          <Text style={styles.timeframe}>{timeframe}</Text>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.dismissBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.impactRow}>
        <View style={styles.impactItem}>
          <Text style={styles.impactLabel}>Freedom</Text>
          <Text style={[styles.impactValue, { color: impactColor }]}>
            {freedomDisplay}
          </Text>
        </View>

        <View style={styles.impactDivider} />

        <View style={styles.impactItem}>
          <Text style={styles.impactLabel}>
            {impact.monthlyIncomeDelta > 0 ? 'Income' : (impact as any).monthlySavings > 0 ? 'Savings' : 'Income'}
          </Text>
          <Text style={styles.impactValue}>
            {(impact as any).monthlySavings > 0 && impact.monthlyIncomeDelta === 0
              ? `+$${Math.round((impact as any).monthlySavings)}/mo`
              : `+$${Math.round(impact.monthlyIncomeDelta)}/mo`}
          </Text>
        </View>

        {impact.investmentRequired > 0 && (
          <>
            <View style={styles.impactDivider} />
            <View style={styles.impactItem}>
              <Text style={styles.impactLabel}>Investment</Text>
              <Text style={styles.impactInvestment}>
                ${(impact.investmentRequired / 1000).toFixed(0)}K
              </Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.actionButton, onChain && styles.actionButtonOnChain]}
        onPress={onPress}
      >
        <Text style={[styles.actionText, onChain && styles.actionTextOnChain]}>
          {onChain ? '⚡ Execute On-Chain →' : 'View Details →'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  cardOnChain: {
    borderColor: '#f4c43030',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 32,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  onChainBadge: {
    backgroundColor: '#f4c43018',
    borderWidth: 1,
    borderColor: '#f4c43050',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  onChainText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f4c430',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeframe: {
    fontSize: 12,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 16,
    lineHeight: 20,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141825',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  impactItem: {
    flex: 1,
    alignItems: 'center',
  },
  impactDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2f3e',
    marginHorizontal: 8,
  },
  impactLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  impactValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  impactInvestment: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  actionButton: {
    backgroundColor: '#2a2f3e',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonOnChain: {
    backgroundColor: '#f4c43012',
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  actionTextOnChain: {
    color: '#f4c430',
  },
  dismissBtn: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    paddingLeft: 4,
  },
});
