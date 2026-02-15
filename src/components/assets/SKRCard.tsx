// src/components/assets/SKRCard.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { SKRHolding, SKRIncomeSnapshot } from '../../services/skr';

interface SKRCardProps {
  holding: SKRHolding;
  income: SKRIncomeSnapshot;
  onEdit?: () => void;
}

export default function SKRCard({ holding, income, onEdit }: SKRCardProps) {
  const stakedPercentage = holding.totalBalance > 0 
    ? (holding.stakedBalance / holding.totalBalance) * 100 
    : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>◎</Text>
          <View>
            <Text style={styles.title}>$SKR — Solana Mobile</Text>
            <Text style={styles.subtitle}>Auto-detected from wallet</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.apyBadge}>
            <Text style={styles.apyText}>
              {((holding.apy ?? 0) * 100).toFixed(0)}% APY
            </Text>
          </View>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.barBackground}>
        <View style={[styles.barFilled, { width: `${stakedPercentage}%` }]} />
      </View>
      
      <View style={styles.barLabels}>
        <Text style={styles.barLabelStaked}>
          Staked: {holding.stakedBalance.toLocaleString()} SKR
        </Text>
        <Text style={styles.barLabelLiquid}>
          Liquid: {holding.liquidBalance.toLocaleString()} SKR
        </Text>
      </View>

      <View style={styles.numbers}>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Total Value</Text>
          <Text style={styles.numberValue}>
            ${income.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Monthly Yield</Text>
          <Text style={[styles.numberValue, styles.numberValueGreen]}>
            ${income.monthlyYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Annual Yield</Text>
          <Text style={[styles.numberValue, styles.numberValueGreen]}>
            ${income.annualYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    fontSize: 28,
    color: '#f4c430',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  apyBadge: {
    backgroundColor: '#f4c43022',
    borderWidth: 1,
    borderColor: '#f4c430',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  apyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ade80',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#0a0e1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFilled: {
    height: '100%',
    backgroundColor: '#f4c430',
    borderRadius: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  barLabelStaked: {
    fontSize: 12,
    color: '#f4c430',
    fontWeight: '600',
  },
  barLabelLiquid: {
    fontSize: 12,
    color: '#666',
  },
  numbers: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  numberCol: {
    flex: 1,
    alignItems: 'center',
  },
  numberLabel: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  numberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  numberValueGreen: {
    color: '#4ade80',
  },
});
