// app/components/PaymentCalendar.tsx - Visual calendar with payment dots
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import type { PaymentEvent } from '../../src/utils/paymentCalendar';

interface PaymentCalendarProps {
  year: number;
  month: number; // 0-11
  events: PaymentEvent[];
  onDayPress?: (day: number) => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PaymentCalendar({ year, month, events, onDayPress }: PaymentCalendarProps) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = isCurrentMonth ? today.getDate() : null;

  // Get calendar grid data
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group events by day
  const eventsByDay: Record<number, PaymentEvent[]> = {};
  events.forEach(event => {
    const day = event.dueDate.getDate();
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(event);
  });

  // Get status for a day
  const getDayStatus = (day: number): 'none' | 'paid' | 'due' | 'overdue' => {
    const dayEvents = eventsByDay[day] || [];
    if (dayEvents.length === 0) return 'none';
    
    const hasOverdue = dayEvents.some(e => e.isOverdue);
    if (hasOverdue) return 'overdue';
    
    const allPaid = dayEvents.every(e => e.isPaid);
    if (allPaid) return 'paid';
    
    return 'due';
  };

  // Render a single day cell
  const renderDay = (day: number) => {
    const status = getDayStatus(day);
    const dayEvents = eventsByDay[day] || [];
    const isToday = day === todayDate;

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          isToday && styles.dayToday,
          status === 'overdue' && styles.dayOverdue,
          status === 'due' && styles.dayDue,
          status === 'paid' && styles.dayPaid,
        ]}
        onPress={() => onDayPress?.(day)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayNumber,
          isToday && styles.dayNumberToday,
          status !== 'none' && styles.dayNumberActive,
        ]}>
          {day}
        </Text>
        {dayEvents.length > 0 && (
          <View style={styles.eventDots}>
            {dayEvents.slice(0, 3).map((event, i) => (
              <View
                key={i}
                style={[
                  styles.eventDot,
                  event.isPaid && styles.eventDotPaid,
                  event.isOverdue && styles.eventDotOverdue,
                ]}
              />
            ))}
            {dayEvents.length > 3 && (
              <Text style={styles.eventMore}>+{dayEvents.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.header}>
        <Text style={styles.monthName}>{MONTH_NAMES[month]} {year}</Text>
      </View>

      {/* Day names */}
      <View style={styles.dayNamesRow}>
        {DAY_NAMES.map(name => (
          <View key={name} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendar}>
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDay }, (_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}
        
        {/* Days of month */}
        {daysArray.map(renderDay)}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff4444' }]} />
          <Text style={styles.legendText}>Overdue</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff9f43' }]} />
          <Text style={styles.legendText}>Due</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4ade80' }]} />
          <Text style={styles.legendText}>Paid</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  monthName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  dayOverdue: {
    backgroundColor: '#3a1a1a',
  },
  dayDue: {
    backgroundColor: '#3a2a1a',
  },
  dayPaid: {
    backgroundColor: '#1a3a2a',
  },
  dayNumber: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  dayNumberToday: {
    color: '#60a5fa',
  },
  dayNumberActive: {
    color: '#fff',
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ff9f43',
  },
  eventDotPaid: {
    backgroundColor: '#4ade80',
  },
  eventDotOverdue: {
    backgroundColor: '#ff4444',
  },
  eventMore: {
    fontSize: 8,
    color: '#888',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2f3e',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },
});
