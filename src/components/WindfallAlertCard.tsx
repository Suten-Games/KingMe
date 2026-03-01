// src/components/WindfallAlertCard.tsx
// Surfaces when a large bank balance increase is detected.
// Shows a prioritized deployment plan with exchange-aware steps.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { WindfallAlert, DeploymentStep } from '../services/windfallPlanner';

interface Props {
  alert: WindfallAlert;
  onDismiss: (alertId: string) => void;
}

export default function WindfallAlertCard({ alert, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <LinearGradient
      colors={['#1a2e1a', '#0a0e1a']}
      style={st.card}
    >
      {/* Header */}
      <TouchableOpacity
        style={st.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={st.headerLeft}>
          <Text style={st.headerEmoji}>💰</Text>
          <View>
            <Text style={st.headerTitle}>
              ${fmt(alert.amount)} landed in {alert.accountName}
            </Text>
            <Text style={st.headerSub}>
              Here's how to put it to work
            </Text>
          </View>
        </View>
        <View style={st.headerRight}>
          <Text style={st.expandArrow}>{expanded ? '▾' : '▸'}</Text>
          <TouchableOpacity
            style={st.dismissBtn}
            onPress={() => onDismiss(alert.id)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={st.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={st.body}>
          {/* Summary bar */}
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>Total</Text>
              <Text style={st.summaryValue}>${fmt(alert.amount)}</Text>
            </View>
            <View style={st.summaryDivider} />
            {alert.reserved > 0 ? (
              <>
                <View style={st.summaryItem}>
                  <Text style={st.summaryLabel}>Reserved</Text>
                  <Text style={[st.summaryValue, { color: '#f87171' }]}>
                    ${fmt(alert.reserved)}
                  </Text>
                </View>
                <View style={st.summaryDivider} />
                <View style={st.summaryItem}>
                  <Text style={st.summaryLabel}>Deployable</Text>
                  <Text style={[st.summaryValue, { color: '#4ade80' }]}>
                    ${fmt(alert.deployable)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={st.summaryItem}>
                <Text style={st.summaryLabel}>Deployable</Text>
                <Text style={[st.summaryValue, { color: '#4ade80' }]}>
                  ${fmt(alert.amount)}
                </Text>
              </View>
            )}
          </View>

          {/* Steps */}
          <View style={st.steps}>
            {alert.steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                isExpanded={expandedStep === step.id}
                onToggle={() => setExpandedStep(
                  expandedStep === step.id ? null : step.id
                )}
              />
            ))}
          </View>

          {/* Exchange disclaimer */}
          {alert.steps.some(s => s.requiresExchange) && (
            <View style={st.exchangeNote}>
              <Text style={st.exchangeNoteText}>
                🏦 Steps marked with ⚡ require transferring funds to an exchange first before buying crypto. Plan for 1–3 business days for ACH.
              </Text>
            </View>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

function StepRow({
  step, index, isExpanded, onToggle,
}: {
  step: DeploymentStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const categoryColor = getCategoryColor(step.category);

  return (
    <TouchableOpacity
      style={[st.step, { borderColor: categoryColor + '30' }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={st.stepHeader}>
        <View style={st.stepLeft}>
          <View style={[st.stepNumber, { backgroundColor: categoryColor + '20', borderColor: categoryColor + '40' }]}>
            <Text style={[st.stepNumberText, { color: categoryColor }]}>{index + 1}</Text>
          </View>
          <Text style={st.stepEmoji}>{step.emoji}</Text>
          <View style={st.stepTitleArea}>
            <Text style={st.stepTitle}>{step.title}</Text>
            <Text style={[st.stepAmount, { color: categoryColor }]}>
              ${fmt(step.amount)}
              {step.requiresExchange && <Text style={st.exchangeTag}> ⚡</Text>}
            </Text>
          </View>
        </View>
        <Text style={st.stepArrow}>{isExpanded ? '▾' : '▸'}</Text>
      </View>

      {isExpanded && (
        <View style={st.stepBody}>
          <Text style={st.stepDescription}>{step.description}</Text>
          {step.exchangeNote && (
            <View style={st.stepExchangeNote}>
              <Text style={st.stepExchangeNoteText}>{step.exchangeNote}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[st.stepAction, { backgroundColor: categoryColor + '20', borderColor: categoryColor + '40' }]}
          >
            <Text style={[st.stepActionText, { color: categoryColor }]}>{step.actionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'emergency_fund':     return '#60a5fa';
    case 'high_interest_debt': return '#f87171';
    case 'accumulation_target': return '#f4c430';
    case 'goal':               return '#a78bfa';
    case 'yield':              return '#4ade80';
    case 'crypto_allocation':  return '#fb923c';
    case 'keep_liquid':        return '#94a3b8';
    default:                   return '#888';
  }
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4ade8030',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerEmoji: { fontSize: 28 },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4ade80',
    marginBottom: 2,
  },
  headerSub: { fontSize: 12, color: '#888' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandArrow: { fontSize: 16, color: '#888' },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 14, color: '#555' },

  body: { paddingHorizontal: 16, paddingBottom: 16 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#0c102060',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#2a305040' },
  summaryLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 3 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#fff' },

  steps: { gap: 8 },

  step: {
    backgroundColor: '#0c102060',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 11, fontWeight: '700' },
  stepEmoji: { fontSize: 18 },
  stepTitleArea: { flex: 1 },
  stepTitle: { fontSize: 13, fontWeight: '600', color: '#e0e0e8', marginBottom: 1 },
  stepAmount: { fontSize: 13, fontWeight: '700' },
  exchangeTag: { fontSize: 11 },
  stepArrow: { fontSize: 13, color: '#555', marginLeft: 8 },

  stepBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a305030' },
  stepDescription: { fontSize: 13, color: '#b0b0b8', lineHeight: 18, marginBottom: 10 },
  stepExchangeNote: {
    backgroundColor: '#f4c43010',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f4c43025',
  },
  stepExchangeNoteText: { fontSize: 12, color: '#f4c430', lineHeight: 16 },
  stepAction: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepActionText: { fontSize: 13, fontWeight: '600' },

  exchangeNote: {
    marginTop: 12,
    backgroundColor: '#1a2040',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3040a030',
  },
  exchangeNoteText: { fontSize: 12, color: '#8090b0', lineHeight: 17 },
});
