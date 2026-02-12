// app/components/WhatIfModal.tsx
import { WhatIfScenario } from '@/types';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';

interface WhatIfModalProps {
  visible: boolean;
  scenario: WhatIfScenario | null;
  onClose: () => void;
  onApply: (scenario: WhatIfScenario) => void;
}

export default function WhatIfModal({ 
  visible, 
  scenario, 
  onClose, 
  onApply 
}: WhatIfModalProps) {
  if (!scenario) return null;
  
  const { impact, emoji, title, description, reasoning, risks, steps } = scenario;
  
  const freedomGainMonths = impact.freedomDelta;
  const freedomGainYears = freedomGainMonths / 12;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>What-If Scenario</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          {/* Before → After */}
          <View style={styles.beforeAfter}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Before</Text>
              <View style={styles.columnCard}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Freedom</Text>
                  <Text style={styles.metricValue}>
                    {impact.freedomBefore >= 12 
                      ? `${(impact.freedomBefore / 12).toFixed(1)}y`
                      : `${impact.freedomBefore.toFixed(1)}mo`}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={styles.metricValue}>
                    ${Math.round(impact.monthlyIncomeBefore)}/mo
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.arrow}>→</Text>
            
            <View style={styles.column}>
              <Text style={styles.columnLabel}>After</Text>
              <View style={[styles.columnCard, styles.columnCardAfter]}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Freedom</Text>
                  <Text style={[styles.metricValue, styles.metricValueGreen]}>
                    {impact.freedomAfter >= 12 
                      ? `${(impact.freedomAfter / 12).toFixed(1)}y`
                      : `${impact.freedomAfter.toFixed(1)}mo`}
                  </Text>
                  <Text style={styles.metricDelta}>
                    +{freedomGainYears >= 1 
                      ? `${freedomGainYears.toFixed(1)}y` 
                      : `${freedomGainMonths.toFixed(1)}mo`}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={[styles.metricValue, styles.metricValueGreen]}>
                    ${Math.round(impact.monthlyIncomeAfter)}/mo
                  </Text>
                  <Text style={styles.metricDelta}>
                    +${Math.round(impact.monthlyIncomeDelta)}/mo
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Why This Works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 Why This Works</Text>
            <Text style={styles.sectionText}>{reasoning}</Text>
          </View>
          
          {/* Investment Required */}
          {impact.investmentRequired > 0 && (
            <View style={styles.investmentBox}>
              <Text style={styles.investmentLabel}>Investment Required</Text>
              <Text style={styles.investmentAmount}>
                ${impact.investmentRequired.toLocaleString()}
              </Text>
              {impact.roi && (
                <Text style={styles.investmentROI}>
                  {impact.roi.toFixed(1)}% annual return
                </Text>
              )}
            </View>
          )}
          
          {impact.investmentRequired === 0 && (
            <View style={[styles.investmentBox, styles.freeBox]}>
              <Text style={styles.freeLabel}>💰 No Investment Required</Text>
              <Text style={styles.freeText}>
                This just repositions your existing assets!
              </Text>
            </View>
          )}
          
          {/* Steps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 How to Do This</Text>
            {steps.map((step, index) => (
              <View key={index} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
          
          {/* Risks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Things to Consider</Text>
            {risks.map((risk, index) => (
              <View key={index} style={styles.risk}>
                <Text style={styles.riskBullet}>•</Text>
                <Text style={styles.riskText}>{risk}</Text>
              </View>
            ))}
          </View>
          
          <View style={{ height: 100 }} />
        </ScrollView>
        
        {/* Apply Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => onApply(scenario)}
          >
            <Text style={styles.applyButtonText}>Apply This Scenario</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  beforeAfter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  columnCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
  },
  columnCardAfter: {
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  metric: {
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricValueGreen: {
    color: '#4ade80',
  },
  metricDelta: {
    fontSize: 13,
    color: '#4ade80',
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    color: '#666',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#a0a0a0',
    lineHeight: 24,
  },
  investmentBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
  },
  investmentLabel: {
    fontSize: 13,
    color: '#fbbf24',
    marginBottom: 8,
  },
  investmentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  investmentROI: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  freeBox: {
    borderColor: '#4ade80',
  },
  freeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 8,
  },
  freeText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2f3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60a5fa',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#a0a0a0',
    lineHeight: 22,
  },
  risk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  riskBullet: {
    fontSize: 18,
    color: '#f87171',
    marginRight: 8,
    marginTop: -2,
  },
  riskText: {
    flex: 1,
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  applyButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
});
