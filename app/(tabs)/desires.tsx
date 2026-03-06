// app/(tabs)/desires.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { generateActionPlan } from '../../src/services/desirePlanner';
import type { ActionPlan, ActionStep } from '../../src/services/desirePlanner';
import ActionPlanCard from '../../src/components/ActionPlanCard';
import type { Desire } from '../../src/types';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { T } from '../../src/theme';

const PURPLE = '#a78bfa';

const LOADING_MESSAGES = [
  'Analyzing your financial picture...',
  'Researching the best options...',
  'Checking your income & obligations...',
  'Evaluating risk exposure...',
  'Building your action plan...',
];

export default function DesiresScreen() {
  const router = useRouter();
  const desires = useStore((state) => state.desires);
  const addDesire = useStore((state) => state.addDesire);
  const removeDesire = useStore((state) => state.removeDesire);
  const freedom = useFreedomScore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [desireName, setDesireName] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual add state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCost, setManualCost] = useState('');

  // Rotate loading messages
  const startLoadingMessages = () => {
    setLoadingMsg(0);
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return interval;
  };

  const handleStartResearch = async () => {
    if (!desireName.trim()) return;
    setIsResearching(true);
    setError(null);
    setActionPlan(null);
    setShowAddModal(false);
    setShowPlanModal(true);

    const interval = startLoadingMessages();

    try {
      const plan = await generateActionPlan(desireName);
      setActionPlan(plan);
    } catch (err: any) {
      setError(err.message || 'Failed to generate plan. Check your connection.');
    } finally {
      clearInterval(interval);
      setIsResearching(false);
    }
  };

  const handleExecuteStep = (step: ActionStep) => {
    // Wire each action type to existing app flows
    switch (step.execution?.action) {
      case 'jupiter_swap':
      case 'perena_deposit':
        // TODO: Open WhatIfModal with pre-filled swap params
        // For now, navigate to home where scenarios live
        setShowPlanModal(false);
        router.push('/(tabs)/');
        break;
      case 'dca_setup':
        // Future: Jupiter DCA integration
        // For now: info toast
        break;
      case 'navigate':
        setShowPlanModal(false);
        const screen = step.execution.params?.targetScreen || '';
        if (screen) router.push(`/(tabs)/${screen}` as any);
        break;
      default:
        break;
    }
  };

  const handleAddDesireFromPlan = () => {
    if (!actionPlan) return;
    addDesire({
      id: Date.now().toString(),
      name: actionPlan.productRecommendation || actionPlan.desire,
      estimatedCost: actionPlan.estimatedCost || 0,
      priority: 'medium',
      category: 'other',
      notes: actionPlan.summary,
      aiResearch: {
        researchedAt: new Date().toISOString(),
        recommendation: actionPlan.steps.map((s) => `${s.title}: ${s.description}`).join('\n'),
        alternatives: [],
      },
    });
    setShowPlanModal(false);
    setActionPlan(null);
    setDesireName('');
  };

  const handleManualAdd = () => {
    setShowAddModal(false);
    setShowManualModal(true);
  };

  const handleSaveManual = () => {
    if (!desireName.trim()) return;
    addDesire({
      id: Date.now().toString(),
      name: desireName,
      estimatedCost: parseFloat(manualCost) || 0,
      priority: 'medium',
      category: 'other',
    });
    setShowManualModal(false);
    setDesireName('');
    setManualCost('');
  };

  // View a previously saved desire's cached plan (no API call)
  const [viewingDesire, setViewingDesire] = useState<Desire | null>(null);

  const handleViewDesire = (desire: Desire) => {
    setViewingDesire(desire);
  };

  const totalDesires = desires.reduce((sum, d) => sum + d.estimatedCost, 0);

  return (
    <View style={s.container}>
      <ResponsiveContainer>
        <ScrollView style={s.scrollView}>
          {/* Summary */}
          <LinearGradient colors={T.gradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.summaryBox, { borderColor: PURPLE + '80' }]}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Total Desires</Text>
                <Text style={s.summaryValue}>${totalDesires.toLocaleString()}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Freedom</Text>
                <Text style={[s.summaryValue, { color: T.green }]}>{freedom.formatted}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Tracked</Text>
                <Text style={s.summaryValue}>{desires.length}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Agent CTA */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => setShowAddModal(true)}>
            <LinearGradient colors={['#1a1a2e', '#16213e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.agentCta}>
              <Text style={s.agentCtaIcon}>🤖</Text>
              <View style={s.agentCtaText}>
                <Text style={s.agentCtaTitle}>What do you want?</Text>
                <Text style={s.agentCtaSub}>Tell me and I'll build a plan to get it — with executable steps</Text>
              </View>
              <Text style={s.agentCtaArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Desire List */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your Desires</Text>
              <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
                <Text style={s.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {desires.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>✨</Text>
                <Text style={s.emptyText}>No desires yet</Text>
                <Text style={s.emptySubtext}>Tell the agent what you want — a car, a vacation, a new laptop — and it'll build a financial plan to get there</Text>
              </View>
            ) : (
              desires.map((desire) => (
                <TouchableOpacity key={desire.id} activeOpacity={0.8} onPress={() => handleViewDesire(desire)}>
                  <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.desireCard, { borderColor: PURPLE + '40' }]}>
                    <View style={s.desireHeader}>
                      <View style={s.desireHeaderLeft}>
                        <Text style={s.desireName}>{desire.name}</Text>
                        {desire.aiResearch && <Text style={s.aiLabel}>🤖 Agent Planned</Text>}
                      </View>
                      <TouchableOpacity onPress={() => removeDesire(desire.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={s.deleteButton}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={s.desireCost}>${desire.estimatedCost.toLocaleString()}</Text>
                    {desire.notes && <Text style={s.desireNotes} numberOfLines={2}>{desire.notes}</Text>}
                    {desire.aiResearch && (
                      <View style={s.viewPlanButton}>
                        <Text style={s.viewPlanText}>View Action Plan →</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </ResponsiveContainer>

      {/* ═══ Add Modal ═══ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>What do you want?</Text>
            <Text style={s.label}>Describe what you're looking for</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g., a Cybertruck, gaming laptop, Hawaii vacation, pay off student loans..."
              placeholderTextColor="#555"
              value={desireName}
              onChangeText={setDesireName}
              multiline
              autoFocus
            />
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancelButton} onPress={() => { setShowAddModal(false); setDesireName(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalAddButton, !desireName.trim() && s.modalAddButtonDisabled]}
                onPress={handleStartResearch}
                disabled={!desireName.trim()}
              >
                <Text style={s.modalAddText}>🤖 Build Plan</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.manualButton} onPress={handleManualAdd} disabled={!desireName.trim()}>
              <Text style={s.manualButtonText}>Skip AI, add manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ Manual Add Modal ═══ */}
      <Modal visible={showManualModal} animationType="slide" transparent onRequestClose={() => setShowManualModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Add Manually</Text>
            <Text style={s.label}>{desireName}</Text>
            <Text style={[s.label, { marginTop: 16 }]}>Estimated Cost</Text>
            <View style={s.inputContainer}>
              <Text style={[s.currencySymbol, { color: PURPLE }]}>$</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={manualCost}
                onChangeText={setManualCost}
                autoFocus
              />
            </View>
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancelButton} onPress={() => { setShowManualModal(false); setDesireName(''); setManualCost(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalAddButton} onPress={handleSaveManual}>
                <Text style={s.modalAddText}>Add Desire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ View Saved Desire Modal ═══ */}
      <Modal visible={!!viewingDesire} animationType="slide" transparent={false} onRequestClose={() => setViewingDesire(null)}>
        <View style={s.planContainer}>
          <ScrollView style={s.planScroll} showsVerticalScrollIndicator={false}>
            {viewingDesire && (
              <View>
                <Text style={s.viewTitle}>{viewingDesire.name}</Text>
                <Text style={s.viewCost}>${viewingDesire.estimatedCost.toLocaleString()}</Text>

                {viewingDesire.notes && (
                  <View style={s.viewSection}>
                    <Text style={s.viewSectionTitle}>Summary</Text>
                    <Text style={s.viewBody}>{viewingDesire.notes}</Text>
                  </View>
                )}

                {viewingDesire.aiResearch && (
                  <View style={s.viewSection}>
                    <Text style={s.viewSectionTitle}>Action Plan</Text>
                    {viewingDesire.aiResearch.recommendation.split('\n').map((line, i) => (
                      <View key={i} style={s.viewStepRow}>
                        <Text style={s.viewStepNum}>{i + 1}</Text>
                        <Text style={s.viewStepText}>{line}</Text>
                      </View>
                    ))}
                    <Text style={s.viewResearchedAt}>Researched {new Date(viewingDesire.aiResearch.researchedAt).toLocaleDateString()}</Text>
                  </View>
                )}

                {viewingDesire.researchedProduct && (
                  <View style={s.viewSection}>
                    <Text style={s.viewSectionTitle}>Recommended Product</Text>
                    <Text style={s.viewBody}>{viewingDesire.researchedProduct.name} — ${viewingDesire.researchedProduct.price.toLocaleString()}</Text>
                    {viewingDesire.researchedProduct.description && <Text style={s.viewBody}>{viewingDesire.researchedProduct.description}</Text>}
                  </View>
                )}

                <TouchableOpacity
                  style={[s.modalAddButton, { marginTop: 20, backgroundColor: PURPLE }]}
                  onPress={() => { setViewingDesire(null); setDesireName(viewingDesire.name); handleStartResearch(); }}
                >
                  <Text style={s.modalAddText}>🤖 Regenerate Plan</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={s.planBottomBar}>
            <TouchableOpacity style={s.planCancelButton} onPress={() => setViewingDesire(null)}>
              <Text style={s.planCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ Action Plan Modal ═══ */}
      <Modal visible={showPlanModal} animationType="slide" transparent={false} onRequestClose={() => setShowPlanModal(false)}>
        <View style={s.planContainer}>
          <ScrollView style={s.planScroll} showsVerticalScrollIndicator={false}>
            {isResearching ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={T.gold} />
                <Text style={s.loadingText}>🤖 Agent is working...</Text>
                <Text style={s.loadingSubtext}>{LOADING_MESSAGES[loadingMsg]}</Text>
              </View>
            ) : error ? (
              <View style={s.errorContainer}>
                <Text style={s.errorTitle}>Plan Failed</Text>
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity style={s.retryButton} onPress={handleStartResearch}>
                  <Text style={s.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelRetryButton} onPress={() => { setShowPlanModal(false); setError(null); }}>
                  <Text style={s.cancelRetryText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : actionPlan ? (
              <ActionPlanCard
                plan={actionPlan}
                onExecuteStep={handleExecuteStep}
                onAddDesire={handleAddDesireFromPlan}
                onDismiss={() => { setShowPlanModal(false); setActionPlan(null); setDesireName(''); }}
              />
            ) : null}
          </ScrollView>

          {/* Sticky bottom bar for plan modal */}
          {!isResearching && !error && actionPlan && (
            <View style={s.planBottomBar}>
              <TouchableOpacity style={s.planCancelButton} onPress={() => { setShowPlanModal(false); setActionPlan(null); setDesireName(''); }}>
                <Text style={s.planCancelText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.planSaveButton} onPress={handleAddDesireFromPlan}>
                <Text style={s.planSaveText}>Save & Track</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },

  // Summary
  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 18, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: T.border },
  summaryLabel: { fontSize: 10, color: PURPLE + 'bb', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontFamily: T.fontBold },
  summaryValue: { fontSize: 22, color: PURPLE, fontFamily: T.fontExtraBold },

  // Agent CTA
  agentCta: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.gold + '44',
  },
  agentCtaIcon: { fontSize: 32, marginRight: 14 },
  agentCtaText: { flex: 1 },
  agentCtaTitle: { fontSize: 18, color: T.gold, fontFamily: T.fontExtraBold, marginBottom: 2 },
  agentCtaSub: { fontSize: 13, color: T.textSecondary, fontFamily: T.fontRegular, lineHeight: 18 },
  agentCtaArrow: { fontSize: 22, color: T.gold, fontFamily: T.fontBold },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: PURPLE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.textPrimary, fontFamily: T.fontBold, fontSize: 14 },

  // Empty
  emptyState: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', lineHeight: 21, fontFamily: T.fontRegular },

  // Desire cards
  desireCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: PURPLE },
  desireHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  desireHeaderLeft: { flex: 1 },
  desireName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  aiLabel: { fontSize: 12, color: T.gold, fontFamily: T.fontSemiBold },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },
  desireCost: { fontSize: 22, color: PURPLE, marginBottom: 8, fontFamily: T.fontExtraBold },
  desireNotes: { fontSize: 14, color: T.textSecondary, lineHeight: 20, marginBottom: 8, fontFamily: T.fontRegular },
  viewPlanButton: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: PURPLE + '15', borderRadius: 8, alignSelf: 'flex-start' },
  viewPlanText: { fontSize: 13, color: PURPLE, fontFamily: T.fontSemiBold },

  // Add modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 24, color: T.gold, marginBottom: 20, fontFamily: T.fontExtraBold },
  label: { fontSize: 15, color: T.textPrimary, marginBottom: 8, marginTop: 12, fontFamily: T.fontBold },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, minHeight: 80, textAlignVertical: 'top', fontFamily: T.fontRegular },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalAddButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.gold, alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },
  manualButton: { padding: 12, alignItems: 'center', marginTop: 12 },
  manualButtonText: { color: T.textMuted, fontSize: 14, fontFamily: T.fontRegular },

  // Manual modal
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, marginRight: 8, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16, fontFamily: T.fontSemiBold },

  // Plan modal
  planContainer: { flex: 1, backgroundColor: T.bg },
  planScroll: { flex: 1, padding: 20 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 120 },
  loadingText: { fontSize: 20, color: T.gold, marginTop: 20, fontFamily: T.fontBold },
  loadingSubtext: { fontSize: 14, color: T.textMuted, marginTop: 8, textAlign: 'center', fontFamily: T.fontRegular },

  // Error
  errorContainer: { padding: 40, alignItems: 'center' },
  errorTitle: { fontSize: 24, color: T.redBright, marginBottom: 12, fontFamily: T.fontExtraBold },
  errorText: { fontSize: 16, color: T.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 22, fontFamily: T.fontRegular },
  retryButton: { backgroundColor: T.gold, paddingHorizontal: 32, paddingVertical: 14, borderRadius: T.radius.md, marginBottom: 12 },
  retryButtonText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },
  cancelRetryButton: { paddingVertical: 12 },
  cancelRetryText: { color: T.textMuted, fontSize: 14, fontFamily: T.fontRegular },

  // Plan bottom bar
  planBottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  planCancelButton: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  planCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  planSaveButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: PURPLE, alignItems: 'center' },
  planSaveText: { color: T.textPrimary, fontSize: 16, fontFamily: T.fontBold },

  // View saved desire
  viewTitle: { fontSize: 24, color: T.textPrimary, fontFamily: T.fontExtraBold, marginBottom: 4 },
  viewCost: { fontSize: 28, color: PURPLE, fontFamily: T.fontExtraBold, marginBottom: 20 },
  viewSection: { marginBottom: 20, backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, borderWidth: 1, borderColor: T.border },
  viewSectionTitle: { fontSize: 14, color: PURPLE, fontFamily: T.fontBold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  viewBody: { fontSize: 15, color: T.textSecondary, lineHeight: 22, fontFamily: T.fontRegular },
  viewStepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  viewStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: PURPLE + '20', color: PURPLE, fontSize: 12, fontFamily: T.fontBold, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  viewStepText: { flex: 1, fontSize: 14, color: T.textSecondary, lineHeight: 20, fontFamily: T.fontRegular },
  viewResearchedAt: { fontSize: 12, color: T.textDim, marginTop: 10, fontFamily: T.fontRegular },
});
