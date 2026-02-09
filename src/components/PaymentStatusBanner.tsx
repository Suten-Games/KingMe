// app/components/PaymentStatusBanner.tsx - Monthly payment progress tracker
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { MonthlyPaymentStatus } from '../../src/utils/paymentCalendar';

interface PaymentStatusBannerProps {
  status: MonthlyPaymentStatus;
  onShowCalendar?: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PaymentStatusBanner({ status, onShowCalendar }: PaymentStatusBannerProps) {
  const totalItems = status.obligationsTotal + status.debtsTotal;
  const totalPaidItems = status.obligationsPaid + status.debtsPaid;
  const percentPaid = totalItems > 0 ? (totalPaidItems / totalItems) * 100 : 0;

  // Parse month for display
  const [year, monthNum] = status.month.split('-');
  const monthName = MONTH_NAMES[parseInt(monthNum) - 1];

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onShowCalendar}
      activeOpacity={0.7}
    >
      {/* Month Header */}
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{monthName} {year}</Text>
        {onShowCalendar && <Text style={styles.calendarHint}>📅 View Calendar</Text>}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${percentPaid}%` }]} />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {totalPaidItems} of {totalItems}
          </Text>
          <Text style={styles.statLabel}>paid</Text>
        </View>

        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#4ade80' }]}>
            ${status.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.statLabel}>paid</Text>
        </View>

        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#ff9f43' }]}>
            ${status.totalRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.statLabel}>remaining</Text>
        </View>
      </View>

      {/* Warnings */}
      {status.overdue.length > 0 && (
        <View style={styles.warningRow}>
          <Text style={styles.warningText}>⚠️ {status.overdue.length} overdue</Text>
        </View>
      )}
      
      {status.dueThisWeek.length > 0 && status.overdue.length === 0 && (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>⏰ {status.dueThisWeek.length} due this week</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  calendarHint: {
    fontSize: 13,
    color: '#60a5fa',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0a0e1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningRow: {
    backgroundColor: '#3a1a1a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
  },
  warningText: {
    fontSize: 13,
    color: '#ff9f43',
    fontWeight: '600',
  },
  infoRow: {
    backgroundColor: '#1a2a3a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  infoText: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
});
