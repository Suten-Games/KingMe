// app/components/DayPaymentsList.tsx - Show payments for a specific day
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { PaymentEvent } from '../../src/utils/paymentCalendar';

interface DayPaymentsListProps {
  day: number;
  month: number; // 0-11
  year: number;
  events: PaymentEvent[];
  onTogglePaid: (eventId: string, isPaid: boolean) => void;
  onClose: () => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DayPaymentsList({ day, month, year, events, onTogglePaid, onClose }: DayPaymentsListProps) {
  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.dateText}>{MONTH_NAMES[month]} {day}, {year}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No payments due this day</Text>
        </View>
      </View>
    );
  }

  const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
  const paidAmount = events.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{MONTH_NAMES[month]} {day}, {year}</Text>
          <Text style={styles.summaryText}>
            {events.filter(e => e.isPaid).length} of {events.length} paid • 
            ${paidAmount.toLocaleString()} of ${totalAmount.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Event List */}
      <ScrollView style={styles.eventList}>
        {events.map(event => (
          <TouchableOpacity
            key={event.id}
            style={[
              styles.eventCard,
              event.isPaid && styles.eventCardPaid,
              event.isOverdue && !event.isPaid && styles.eventCardOverdue,
            ]}
            onPress={() => onTogglePaid(event.id, !event.isPaid)}
            activeOpacity={0.7}
          >
            <View style={styles.eventLeft}>
              {/* Checkbox */}
              <View style={[styles.checkbox, event.isPaid && styles.checkboxChecked]}>
                {event.isPaid && <Text style={styles.checkmark}>✓</Text>}
              </View>

              {/* Event Info */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventName, event.isPaid && styles.eventNamePaid]}>
                  {event.name}
                </Text>
                <Text style={styles.eventAccount}>
                  {event.type === 'obligation' ? '📋' : '💳'} {event.accountName}
                </Text>
                {event.isOverdue && !event.isPaid && (
                  <Text style={styles.overdueLabel}>⚠️ OVERDUE</Text>
                )}
              </View>
            </View>

            {/* Amount */}
            <Text style={[
              styles.eventAmount,
              event.isPaid && styles.eventAmountPaid,
              event.isOverdue && !event.isPaid && styles.eventAmountOverdue,
            ]}>
              ${event.amount.toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mark All Paid Button */}
      {events.some(e => !e.isPaid) && (
        <TouchableOpacity 
          style={styles.markAllButton}
          onPress={() => {
            events.forEach(e => {
              if (!e.isPaid) onTogglePaid(e.id, true);
            });
          }}
        >
          <Text style={styles.markAllText}>Mark All as Paid</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0e1a',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f3e',
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#888',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    paddingHorizontal: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
  },
  eventList: {
    maxHeight: 400,
  },
  eventCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9f43',
  },
  eventCardPaid: {
    backgroundColor: '#1a3a2a',
    borderLeftColor: '#4ade80',
    opacity: 0.7,
  },
  eventCardOverdue: {
    backgroundColor: '#3a1a1a',
    borderLeftColor: '#ff4444',
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  checkmark: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  eventNamePaid: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  eventAccount: {
    fontSize: 13,
    color: '#666',
  },
  overdueLabel: {
    fontSize: 11,
    color: '#ff4444',
    fontWeight: 'bold',
    marginTop: 4,
  },
  eventAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventAmountPaid: {
    color: '#4ade80',
  },
  eventAmountOverdue: {
    color: '#ff4444',
  },
  markAllButton: {
    backgroundColor: '#4ade80',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  markAllText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
