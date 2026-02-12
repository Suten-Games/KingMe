// src/components/assets/PortfolioSummary.tsx
import { View, Text, StyleSheet } from 'react-native';

interface PortfolioSummaryProps {
  totalValue: number;
  totalIncome: number;
}

export default function PortfolioSummary({ 
  totalValue, 
  totalIncome 
}: PortfolioSummaryProps) {
  return (
    <View style={styles.summaryBox}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={styles.summaryValue}>
            ${totalValue.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Annual Income</Text>
          <Text style={styles.summaryIncome}>
            ${totalIncome.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  summaryIncome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ade80',
  },
});
