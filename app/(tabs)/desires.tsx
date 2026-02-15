// app/(tabs)/desires.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { researchDesire, calculateDesireImpact } from '../../src/services/claude';
import type { Desire } from '../../src/types';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { T } from '../../src/theme';

const PURPLE = '#a78bfa';

export default function DesiresScreen() {
  const desires = useStore((state) => state.desires);
  const addDesire = useStore((state) => state.addDesire);
  const removeDesire = useStore((state) => state.removeDesire);
  const freedom = useFreedomScore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [desireName, setDesireName] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<any>(null);

  const handleStartResearch = async () => {
    if (!desireName.trim()) return;
    setIsResearching(true); setShowAddModal(false); setShowResearchModal(true);
    try {
      const result = await researchDesire(desireName, freedom);
      setResearchResult(result);
    } catch (error: any) {
      setResearchResult({ error: true, message: error.message || 'Failed to research desire.' });
    } finally { setIsResearching(false); }
  };

  const handleAddDesireFromResearch = () => {
    if (!researchResult || researchResult.error) return;
    addDesire({
      id: Date.now().toString(), name: researchResult.productName || desireName,
      estimatedCost: researchResult.recommendedPrice || 0, priority: 'medium', category: 'other',
      notes: researchResult.summary,
      aiResearch: { researchedAt: new Date().toISOString(), recommendation: researchResult.recommendation, alternatives: researchResult.alternatives || [] },
    });
    setShowResearchModal(false); setResearchResult(null); setDesireName('');
  };

  const handleManualAdd = () => {
    setShowAddModal(false); setShowResearchModal(true);
    setResearchResult({ manual: true, productName: desireName, recommendedPrice: 0 });
  };

  const totalDesires = desires.reduce((sum, d) => sum + d.estimatedCost, 0);

  return (
    <View style={s.container}>
      <ResponsiveContainer>
        <ScrollView style={s.scrollView}>
          {/* Summary */}
          <LinearGradient colors={T.gradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.summaryBox, { borderColor: PURPLE + '80' }]}>
            <Text style={s.summaryLabel}>Total Desired Purchases</Text>
            <Text style={s.summaryValue}>${totalDesires.toLocaleString()}</Text>
            <Text style={s.summarySubtext}>{desires.length} {desires.length === 1 ? 'desire' : 'desires'} tracked</Text>
          </LinearGradient>

          {/* AI Info */}
          <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.infoBox}>
            <Text style={s.infoText}>✨ Let AI help you research and plan your purchases. Get recommendations, see impact on your freedom score, and find the best time to buy.</Text>
          </LinearGradient>

          {/* List */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Your Desires</Text>
              <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
                <Text style={s.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {desires.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No desires yet</Text>
                <Text style={s.emptySubtext}>Tell us what you want and let AI help you plan it</Text>
              </View>
            ) : (
              desires.map((desire) => (
                <LinearGradient key={desire.id} colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.desireCard, { borderColor: PURPLE + '40' }]}>
                  <View style={s.desireHeader}>
                    <View style={s.desireHeaderLeft}>
                      <Text style={s.desireName}>{desire.name}</Text>
                      {desire.aiResearch && <Text style={s.aiLabel}>✨ AI Researched</Text>}
                    </View>
                    <TouchableOpacity onPress={() => removeDesire(desire.id)}>
                      <Text style={s.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.desireCost}>${desire.estimatedCost.toLocaleString()}</Text>
                  {desire.notes && <Text style={s.desireNotes} numberOfLines={2}>{desire.notes}</Text>}
                  {desire.aiResearch && (
                    <TouchableOpacity style={s.viewDetailsButton}>
                      <Text style={s.viewDetailsText}>View AI Recommendation</Text>
                    </TouchableOpacity>
                  )}
                </LinearGradient>
              ))
            )}
          </View>
        </ScrollView>
      </ResponsiveContainer>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>What do you want?</Text>
            <Text style={s.label}>Tell me what you're looking for</Text>
            <TextInput style={s.modalInput} placeholder="e.g., a new dishwasher, gaming laptop, vacation" placeholderTextColor="#555" value={desireName} onChangeText={setDesireName} multiline autoFocus />
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancelButton} onPress={() => { setShowAddModal(false); setDesireName(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalAddButton, !desireName.trim() && s.modalAddButtonDisabled]} onPress={handleStartResearch} disabled={!desireName.trim()}>
                <Text style={s.modalAddText}>✨ Research with AI</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.manualButton} onPress={handleManualAdd} disabled={!desireName.trim()}>
              <Text style={s.manualButtonText}>Skip AI, add manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Research Modal */}
      <Modal visible={showResearchModal} animationType="slide" transparent={false} onRequestClose={() => setShowResearchModal(false)}>
        <View style={s.researchContainer}>
          <ScrollView style={s.researchScrollView}>
            {isResearching ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={T.gold} />
                <Text style={s.loadingText}>AI is researching...</Text>
                <Text style={s.loadingSubtext}>Searching products, comparing prices, calculating impact</Text>
              </View>
            ) : researchResult?.error ? (
              <View style={s.errorContainer}>
                <Text style={s.errorTitle}>Research Failed</Text>
                <Text style={s.errorText}>{researchResult.message}</Text>
                <TouchableOpacity style={s.retryButton} onPress={handleStartResearch}>
                  <Text style={s.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : researchResult?.manual ? (
              <View style={{ padding: 20 }}>
                <Text style={s.researchTitle}>Add Manually</Text>
                <Text style={s.label}>Estimated Cost</Text>
                <View style={s.inputContainer}>
                  <Text style={[s.currencySymbol, { color: PURPLE }]}>$</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                    onChangeText={(t) => setResearchResult({ ...researchResult, recommendedPrice: parseFloat(t) || 0 })} />
                </View>
              </View>
            ) : researchResult ? (
              <View style={{ paddingBottom: 100 }}>
                <Text style={s.researchTitle}>AI Recommendation</Text>
                <LinearGradient colors={T.gradients.purple} style={[s.productBox, { borderColor: PURPLE + '80' }]}>
                  <Text style={s.productName}>{researchResult.productName}</Text>
                  <Text style={s.productPrice}>${researchResult.recommendedPrice?.toLocaleString()}</Text>
                  <Text style={s.productDescription}>{researchResult.summary}</Text>
                </LinearGradient>
                <LinearGradient colors={T.gradients.card} style={s.impactBox}>
                  <Text style={s.impactTitle}>Impact on Freedom Score</Text>
                  <View style={s.impactRow}><Text style={s.impactLabel}>Current:</Text><Text style={s.impactCurrent}>{freedom.formatted}</Text></View>
                  <View style={s.impactRow}><Text style={s.impactLabel}>After purchase:</Text><Text style={s.impactAfter}>{researchResult.impactDays} days</Text></View>
                  <View style={s.impactRow}><Text style={s.impactLabel}>Change:</Text>
                    <Text style={[s.impactChange, researchResult.impactChange < 0 && s.impactChangeNegative]}>
                      {researchResult.impactChange > 0 ? '+' : ''}{researchResult.impactChange} days
                    </Text>
                  </View>
                </LinearGradient>
                <LinearGradient colors={T.gradients.card} style={s.recommendationBox}>
                  <Text style={s.recommendationTitle}>💡 Recommendation</Text>
                  <Text style={s.recommendationText}>{researchResult.recommendation}</Text>
                </LinearGradient>
              </View>
            ) : null}
          </ScrollView>

          {!isResearching && !researchResult?.error && (
            <View style={s.researchButtonContainer}>
              <TouchableOpacity style={s.researchCancelButton} onPress={() => { setShowResearchModal(false); setResearchResult(null); setDesireName(''); }}>
                <Text style={s.researchCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.researchAddButton} onPress={handleAddDesireFromResearch}>
                <Text style={s.researchAddText}>Add to Desires</Text>
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

  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  summaryLabel: { fontSize: 12, color: PURPLE + 'cc', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: T.fontBold },
  summaryValue: { fontSize: 34, color: PURPLE, fontFamily: T.fontExtraBold },
  summarySubtext: { fontSize: 13, color: T.textMuted, marginTop: 6, fontFamily: T.fontRegular },

  infoBox: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.gold, borderColor: T.border },
  infoText: { fontSize: 14, color: T.textSecondary, lineHeight: 21, fontFamily: T.fontRegular },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: PURPLE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.textPrimary, fontFamily: T.fontBold, fontSize: 14 },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  desireCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: PURPLE },
  desireHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  desireHeaderLeft: { flex: 1 },
  desireName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  aiLabel: { fontSize: 12, color: T.gold, fontFamily: T.fontSemiBold },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },
  desireCost: { fontSize: 22, color: PURPLE, marginBottom: 8, fontFamily: T.fontExtraBold },
  desireNotes: { fontSize: 14, color: T.textSecondary, lineHeight: 20, marginBottom: 8, fontFamily: T.fontRegular },
  viewDetailsButton: { marginTop: 8, paddingVertical: 8 },
  viewDetailsText: { fontSize: 14, color: T.gold, fontFamily: T.fontSemiBold },

  // Modals
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

  // Research
  researchContainer: { flex: 1, backgroundColor: T.bg },
  researchScrollView: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
  loadingText: { fontSize: 18, color: T.textPrimary, marginTop: 20, fontFamily: T.fontSemiBold },
  loadingSubtext: { fontSize: 14, color: T.textMuted, marginTop: 8, textAlign: 'center', fontFamily: T.fontRegular },
  errorContainer: { padding: 40, alignItems: 'center' },
  errorTitle: { fontSize: 24, color: T.redBright, marginBottom: 12, fontFamily: T.fontExtraBold },
  errorText: { fontSize: 16, color: T.textSecondary, textAlign: 'center', marginBottom: 20, fontFamily: T.fontRegular },
  retryButton: { backgroundColor: T.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: T.radius.sm },
  retryButtonText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, marginRight: 8, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16, fontFamily: T.fontSemiBold },

  researchTitle: { fontSize: 28, color: T.gold, marginBottom: 20, fontFamily: T.fontExtraBold },
  productBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  productName: { fontSize: 20, color: T.textPrimary, marginBottom: 8, fontFamily: T.fontBold },
  productPrice: { fontSize: 28, color: PURPLE, marginBottom: 12, fontFamily: T.fontExtraBold },
  productDescription: { fontSize: 14, color: T.textSecondary, lineHeight: 20, fontFamily: T.fontRegular },

  impactBox: { ...T.cardBase, borderColor: T.border, padding: 20 },
  impactTitle: { fontSize: 18, color: T.textPrimary, marginBottom: 12, fontFamily: T.fontBold },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  impactLabel: { fontSize: 16, color: T.textSecondary, fontFamily: T.fontRegular },
  impactCurrent: { fontSize: 16, color: T.green, fontFamily: T.fontBold },
  impactAfter: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontBold },
  impactChange: { fontSize: 16, color: T.green, fontFamily: T.fontBold },
  impactChangeNegative: { color: T.redBright },

  recommendationBox: { ...T.cardBase, borderColor: T.border, borderLeftWidth: 4, borderLeftColor: T.gold, padding: 20 },
  recommendationTitle: { fontSize: 18, color: T.gold, marginBottom: 12, fontFamily: T.fontBold },
  recommendationText: { fontSize: 16, color: T.textPrimary, lineHeight: 24, fontFamily: T.fontRegular },

  researchButtonContainer: { flexDirection: 'row', gap: 12, padding: 20, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  researchCancelButton: { flex: 1, padding: 18, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  researchCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  researchAddButton: { flex: 1, padding: 18, borderRadius: T.radius.md, backgroundColor: PURPLE, alignItems: 'center' },
  researchAddText: { color: T.textPrimary, fontSize: 16, fontFamily: T.fontBold },
});
