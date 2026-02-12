// src/components/ThesisAlerts.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ThesisAlert } from '../types';

interface ThesisAlertsProps {
  alerts: ThesisAlert[];
  onDismiss: (alertId: string) => void;
  onReview: (assetId: string) => void;
}

export default function ThesisAlerts({ alerts, onDismiss, onReview }: ThesisAlertsProps) {
  if (alerts.length === 0) return null;
  
  // Group by severity
  const critical = alerts.filter(a => a.severity === 'critical' && !a.dismissedAt);
  const warning = alerts.filter(a => a.severity === 'warning' && !a.dismissedAt);
  const success = alerts.filter(a => a.severity === 'success' && !a.dismissedAt);
  const info = alerts.filter(a => a.severity === 'info' && !a.dismissedAt);
  
  const displayAlerts = [...critical, ...warning, ...success, ...info].slice(0, 3);
  
  if (displayAlerts.length === 0) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚨 Thesis Alerts</Text>
      
      {displayAlerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDismiss={() => onDismiss(alert.id)}
          onReview={() => onReview(alert.assetId)}
        />
      ))}
      
      {alerts.filter(a => !a.dismissedAt).length > 3 && (
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>
            View All {alerts.filter(a => !a.dismissedAt).length} Alerts →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AlertCard({ 
  alert, 
  onDismiss, 
  onReview 
}: { 
  alert: ThesisAlert; 
  onDismiss: () => void; 
  onReview: () => void;
}) {
  const config = ALERT_CONFIG[alert.severity];
  
  return (
    <View style={[styles.alertCard, { borderLeftColor: config.color }]}>
      <View style={styles.alertHeader}>
        <View style={styles.alertTitleRow}>
          <Text style={styles.alertEmoji}>{config.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertAsset}>{alert.assetName}</Text>
            <Text style={[styles.alertType, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.alertMessage}>{alert.message}</Text>
      
      <View style={styles.alertActions}>
        {alert.action === 'sell' && (
          <TouchableOpacity style={[styles.actionButton, styles.sellButton]}>
            <Text style={styles.sellButtonText}>Review & Sell</Text>
          </TouchableOpacity>
        )}
        {alert.action === 'review' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.reviewButton]}
            onPress={onReview}
          >
            <Text style={styles.reviewButtonText}>Review Thesis</Text>
          </TouchableOpacity>
        )}
        {alert.action === 'celebrate' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.celebrateButton]}
            onPress={onReview}
          >
            <Text style={styles.celebrateButtonText}>View Details 🎉</Text>
          </TouchableOpacity>
        )}
        {alert.action === 'update' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.updateButton]}
            onPress={onReview}
          >
            <Text style={styles.updateButtonText}>Update Thesis</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ALERT_CONFIG = {
  critical: {
    emoji: '🔴',
    label: 'Critical',
    color: '#f87171',
  },
  warning: {
    emoji: '⚠️',
    label: 'Warning',
    color: '#fbbf24',
  },
  info: {
    emoji: 'ℹ️',
    label: 'Info',
    color: '#60a5fa',
  },
  success: {
    emoji: '🎉',
    label: 'Success',
    color: '#4ade80',
  },
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  alertCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  alertEmoji: {
    fontSize: 24,
  },
  alertAsset: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  alertType: {
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 18,
    color: '#666',
  },
  alertMessage: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sellButton: {
    backgroundColor: '#f87171',
  },
  sellButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  reviewButton: {
    backgroundColor: '#fbbf24',
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  updateButton: {
    backgroundColor: '#60a5fa',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  celebrateButton: {
    backgroundColor: '#4ade80',
  },
  celebrateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  viewAllButton: {
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
});
