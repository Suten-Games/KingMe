// src/components/ActionPlanCard.tsx
// Renders an agentic action plan with executable on-chain steps

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ActionPlan, ActionStep } from '../services/desirePlanner';
import { T } from '../theme';

const URGENCY_COLORS = {
  now: '#ff6b6b',
  this_week: '#ff9f43',
  this_month: '#f4c430',
  ongoing: '#4ade80',
};

const URGENCY_LABELS = {
  now: 'Do Now',
  this_week: 'This Week',
  this_month: 'This Month',
  ongoing: 'Ongoing',
};

const TYPE_ICONS: Record<string, string> = {
  swap: '⚡',
  dca: '🔄',
  deposit: '🏦',
  reduce_expense: '✂️',
  set_stoploss: '🛡️',
  adjust_401k: '📊',
  info: '💡',
};

interface Props {
  plan: ActionPlan;
  onExecuteStep: (step: ActionStep) => void;
  onAddDesire: () => void;
  onDismiss?: () => void;
}

export default function ActionPlanCard({ plan, onExecuteStep, onAddDesire, onDismiss }: Props) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerEmoji}>🤖</Text>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Action Plan</Text>
          <Text style={s.headerSub}>{plan.productRecommendation}</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={s.dismissBtn}>
            <Text style={s.dismissText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Product + Cost */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={s.productBox}>
        <Text style={s.productName}>{plan.productRecommendation}</Text>
        <Text style={s.productCost}>${fmt(plan.estimatedCost)}</Text>
        <Text style={s.productSummary}>{plan.summary}</Text>
      </LinearGradient>

      {/* Impact Summary */}
      <View style={s.impactRow}>
        <View style={s.impactBox}>
          <Text style={s.impactLabel}>Freedom Now</Text>
          <Text style={s.impactValue}>{plan.currentFreedomDays}d</Text>
        </View>
        <View style={s.impactArrow}>
          <Text style={s.impactArrowText}>→</Text>
        </View>
        <View style={s.impactBox}>
          <Text style={s.impactLabel}>After Purchase</Text>
          <Text style={[s.impactValue, plan.freedomAfterPurchase < plan.currentFreedomDays && s.impactNegative]}>
            {plan.freedomAfterPurchase}d
          </Text>
        </View>
        <View style={s.impactBox}>
          <Text style={s.impactLabel}>Timeline</Text>
          <Text style={s.impactValue}>
            {plan.canAffordNow ? 'Now ✓' : `${plan.timelineMonths}mo`}
          </Text>
        </View>
      </View>

      {/* Risk Warnings */}
      {plan.riskWarnings && plan.riskWarnings.length > 0 && (
        <View style={s.warningsBox}>
          {plan.riskWarnings.map((warning, i) => (
            <Text key={i} style={s.warningText}>⚠️ {warning}</Text>
          ))}
        </View>
      )}

      {/* Steps */}
      <View style={s.stepsContainer}>
        <Text style={s.stepsTitle}>Steps to Get There</Text>
        {plan.steps.map((step, i) => (
          <View key={step.id || i} style={s.stepCard}>
            <View style={s.stepHeader}>
              <View style={s.stepNumberBox}>
                <Text style={s.stepNumber}>{i + 1}</Text>
              </View>
              <View style={s.stepInfo}>
                <View style={s.stepTitleRow}>
                  <Text style={s.stepIcon}>{TYPE_ICONS[step.type] || '📋'}</Text>
                  <Text style={s.stepTitle}>{step.title}</Text>
                </View>
                <Text style={s.stepDescription}>{step.description}</Text>
                {step.impact && <Text style={s.stepImpact}>{step.impact}</Text>}
              </View>
              <View style={[s.urgencyBadge, { backgroundColor: URGENCY_COLORS[step.urgency] + '22', borderColor: URGENCY_COLORS[step.urgency] }]}>
                <Text style={[s.urgencyText, { color: URGENCY_COLORS[step.urgency] }]}>
                  {URGENCY_LABELS[step.urgency]}
                </Text>
              </View>
            </View>

            {/* Execute button */}
            {step.executable && step.execution && (
              <TouchableOpacity
                style={[s.executeButton, step.urgency === 'now' && s.executeButtonUrgent]}
                onPress={() => onExecuteStep(step)}
                activeOpacity={0.8}
              >
                <Text style={s.executeButtonText}>
                  {step.execution.action === 'jupiter_swap' && `Swap $${fmt(step.execution.params?.amount || 0)} ${step.execution.params?.fromToken} → ${step.execution.params?.toToken}`}
                  {step.execution.action === 'perena_deposit' && `Deposit $${fmt(step.execution.params?.amount || 0)} → USD*`}
                  {step.execution.action === 'dca_setup' && `Set Up ${step.execution.params?.frequency} DCA`}
                  {step.execution.action === 'navigate' && `Go to ${step.execution.params?.targetScreen}`}
                </Text>
                <Text style={s.executeButtonSub}>⚡ One tap to execute</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Alternative plan */}
      {plan.alternativePlan && (
        <View style={s.alternativeBox}>
          <Text style={s.alternativeTitle}>💡 Alternative Path</Text>
          <Text style={s.alternativeText}>{plan.alternativePlan}</Text>
        </View>
      )}

      {/* Bottom CTA */}
      <TouchableOpacity style={s.addDesireButton} onPress={onAddDesire} activeOpacity={0.8}>
        <Text style={s.addDesireText}>Track This Desire</Text>
        <Text style={s.addDesireSub}>Save plan and track progress</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerEmoji: { fontSize: 28, marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, color: T.gold, fontWeight: 'bold' },
  headerSub: { fontSize: 14, color: T.textSecondary, marginTop: 2 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 20, color: '#666' },

  // Product
  productBox: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#a78bfa44',
  },
  productName: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  productCost: { fontSize: 32, color: '#a78bfa', fontWeight: 'bold', marginBottom: 8 },
  productSummary: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },

  // Impact
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  impactBox: {
    flex: 1,
    backgroundColor: '#141825',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  impactLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  impactValue: { fontSize: 18, fontWeight: 'bold', color: '#4ade80' },
  impactNegative: { color: '#ff6b6b' },
  impactArrow: { paddingHorizontal: 2 },
  impactArrowText: { fontSize: 18, color: '#555' },

  // Warnings
  warningsBox: {
    backgroundColor: '#2a1a1e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
  },
  warningText: { fontSize: 13, color: '#ff9f9f', lineHeight: 20, marginBottom: 4 },

  // Steps
  stepsContainer: { marginBottom: 14 },
  stepsTitle: { fontSize: 18, color: T.textPrimary, fontWeight: 'bold', marginBottom: 12 },
  stepCard: {
    backgroundColor: '#141825',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumberBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumber: { fontSize: 14, color: T.gold, fontWeight: 'bold' },
  stepInfo: { flex: 1 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  stepIcon: { fontSize: 16 },
  stepTitle: { fontSize: 15, color: T.textPrimary, fontWeight: 'bold' },
  stepDescription: { fontSize: 13, color: T.textSecondary, lineHeight: 19 },
  stepImpact: { fontSize: 12, color: '#4ade80', marginTop: 4, fontWeight: '600' },
  urgencyBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  urgencyText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  // Execute button
  executeButton: {
    backgroundColor: T.gold + '15',
    borderWidth: 1.5,
    borderColor: T.gold + '44',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  executeButtonUrgent: {
    backgroundColor: T.gold,
    borderColor: T.gold,
  },
  executeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: T.gold,
  },
  executeButtonSub: {
    fontSize: 11,
    color: T.gold + '88',
    marginTop: 2,
  },

  // Alternative
  alternativeBox: {
    backgroundColor: '#1a2a1e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  alternativeTitle: { fontSize: 14, color: '#4ade80', fontWeight: 'bold', marginBottom: 6 },
  alternativeText: { fontSize: 13, color: T.textSecondary, lineHeight: 20 },

  // CTA
  addDesireButton: {
    backgroundColor: '#a78bfa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  addDesireText: { fontSize: 16, fontWeight: 'bold', color: '#0a0e1a' },
  addDesireSub: { fontSize: 12, color: '#0a0e1a88', marginTop: 2 },
});
