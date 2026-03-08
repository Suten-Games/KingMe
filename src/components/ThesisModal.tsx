// src/components/ThesisModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import type { Asset, InvestmentThesis, ThesisInvalidator, ThesisTimeHorizon } from '../types';
import { parseNumber } from '../utils/parseNumber';

interface ThesisModalProps {
  visible: boolean;
  asset: Asset;
  existingThesis?: InvestmentThesis;
  onClose: () => void;
  onSave: (thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function ThesisModal({ 
  visible, 
  asset, 
  existingThesis,
  onClose, 
  onSave 
}: ThesisModalProps) {
  const currentPrice = (asset.metadata as any)?.priceUSD || 0;
  
  // Form state
  const [bullCase, setBullCase] = useState(existingThesis?.bullCase || '');
  const [targetPrice, setTargetPrice] = useState(
    existingThesis?.targetPrice?.toString() || ''
  );
  const [targetDate, setTargetDate] = useState(existingThesis?.targetDate || '');
  const [timeHorizon, setTimeHorizon] = useState<ThesisTimeHorizon>(
    existingThesis?.timeHorizon || '1yr'
  );
  const [entryPrice, setEntryPrice] = useState(
    existingThesis?.entryPrice?.toString() || currentPrice.toString()
  );
  const [reviewFrequency, setReviewFrequency] = useState(
    existingThesis?.reviewFrequency || 90
  );
  
  // Invalidators
  const [invalidators, setInvalidators] = useState<Omit<ThesisInvalidator, 'id'>[]>(
    existingThesis?.invalidators || []
  );
  
  // Add stop-loss invalidator
  const [enableStopLoss, setEnableStopLoss] = useState(false);
  const [stopLossPercent, setStopLossPercent] = useState('80');
  
  // Add deadline invalidator
  const [enableDeadline, setEnableDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [milestonePrice, setMilestonePrice] = useState('');
  
  // Get asset-type specific placeholder
  const getPlaceholder = () => {
    switch (asset.type) {
      case 'crypto':
        return "WhiteWhale will reach $1 because of strong fundamentals and growing TVL...";
      case 'stocks':
      case 'brokerage':
        return "Tesla will reach $400 because EV market is early and FSD is materializing...";
      case 'real_estate':
        return "Property will reach $600K because of tech hub growth and limited supply...";
      case 'business':
        return "Startup will reach $5M valuation because product-market fit is validated...";
      default:
        return "I believe this will appreciate because...";
    }
  };
  
  const handleSave = () => {
    if (!bullCase.trim()) {
      Alert.alert('Error', 'Please enter why you believe in this asset');
      return;
    }
    
    const entry = parseNumber(entryPrice) || currentPrice;
    const target = parseNumber(targetPrice) || undefined;
    
    // Build invalidators
    const finalInvalidators: Omit<ThesisInvalidator, 'id'>[] = [...invalidators];
    
    // Add stop-loss
    if (enableStopLoss && stopLossPercent) {
      const percent = parseNumber(stopLossPercent) / 100;
      const triggerPrice = entry * (1 - percent);
      
      finalInvalidators.push({
        type: 'price_drop',
        triggerPrice,
        triggerPercent: -parseNumber(stopLossPercent),
        isTriggered: false,
        description: `Stop-loss at -${stopLossPercent}% ($${triggerPrice.toFixed(4)})`,
      });
    }
    
    // Add deadline
    if (enableDeadline && deadline) {
      const milestoneTarget = parseNumber(milestonePrice) || target;
      
      finalInvalidators.push({
        type: 'time_based',
        deadline,
        milestonePrice: milestoneTarget,
        isTriggered: false,
        description: `Must reach $${milestoneTarget} by ${new Date(deadline).toLocaleDateString()}`,
      });
    }
    
    const thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'> = {
      assetId: asset.id,
      bullCase: bullCase.trim(),
      targetPrice: target,
      targetDate: targetDate || undefined,
      timeHorizon,
      entryPrice: entry,
      entryDate: existingThesis?.entryDate || new Date().toISOString(),
      invalidators: finalInvalidators.map((inv, i) => ({
        ...inv,
        id: `inv_${Date.now()}_${i}`,
      })),
      reviewFrequency,
      lastReviewed: existingThesis?.lastReviewed,
      notes: existingThesis?.notes,
    };
    
    onSave(thesis);
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Investment Thesis</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Asset Info */}
          <View style={styles.assetCard}>
            <Text style={styles.assetName}>{asset.name}</Text>
            <Text style={styles.assetPrice}>
              Current: ${currentPrice.toFixed(4)}
            </Text>
          </View>
          
          {/* Bull Case */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💭 Why are you buying this?</Text>
            <TextInput
              style={styles.textArea}
              placeholder={getPlaceholder()}
              placeholderTextColor="#666"
              value={bullCase}
              onChangeText={setBullCase}
              multiline
              numberOfLines={4}
            />
          </View>
          
          {/* Target & Entry */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Target Price</Text>
              <TextInput
                style={styles.input}
                placeholder="1.00"
                placeholderTextColor="#666"
                value={targetPrice}
                onChangeText={setTargetPrice}
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Entry Price</Text>
              <TextInput
                style={styles.input}
                placeholder={currentPrice.toString()}
                placeholderTextColor="#666"
                value={entryPrice}
                onChangeText={setEntryPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          
          {/* Time Horizon */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏱️ Time Horizon</Text>
            <View style={styles.chipRow}>
              {(['3mo', '6mo', '1yr', '2yr', '5yr', '10yr+'] as ThesisTimeHorizon[]).map(h => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.chip,
                    timeHorizon === h && styles.chipActive,
                  ]}
                  onPress={() => setTimeHorizon(h)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      timeHorizon === h && styles.chipTextActive,
                    ]}
                  >
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Invalidation Triggers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Invalidation Triggers</Text>
            <Text style={styles.sectionSubtitle}>
              When should you sell or reconsider?
            </Text>
            
            {/* Stop-Loss */}
            <View style={styles.triggerCard}>
              <View style={styles.triggerHeader}>
                <Text style={styles.triggerTitle}>Stop-Loss</Text>
                <Switch
                  value={enableStopLoss}
                  onValueChange={setEnableStopLoss}
                  trackColor={{ false: '#2a2f3e', true: '#4ade80' }}
                  thumbColor="#fff"
                />
              </View>
              {enableStopLoss && (
                <View style={styles.triggerContent}>
                  <Text style={styles.triggerLabel}>
                    Sell if price drops by:
                  </Text>
                  <View style={styles.percentRow}>
                    <TextInput
                      style={styles.percentInput}
                      value={stopLossPercent}
                      onChangeText={setStopLossPercent}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <Text style={styles.triggerHelper}>
                    Trigger: ${(parseNumber(entryPrice || '0') * (1 - parseNumber(stopLossPercent || '0') / 100)).toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Deadline */}
            <View style={styles.triggerCard}>
              <View style={styles.triggerHeader}>
                <Text style={styles.triggerTitle}>Time Deadline</Text>
                <Switch
                  value={enableDeadline}
                  onValueChange={setEnableDeadline}
                  trackColor={{ false: '#2a2f3e', true: '#4ade80' }}
                  thumbColor="#fff"
                />
              </View>
              {enableDeadline && (
                <View style={styles.triggerContent}>
                  <Text style={styles.triggerLabel}>
                    If not at $
                    <TextInput
                      style={styles.inlineInput}
                      value={milestonePrice}
                      onChangeText={setMilestonePrice}
                      keyboardType="decimal-pad"
                      placeholder={targetPrice || '0.50'}
                      placeholderTextColor="#666"
                    />
                    {' '}by
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026-12-31"
                    placeholderTextColor="#666"
                    value={deadline}
                    onChangeText={setDeadline}
                  />
                  <Text style={styles.triggerHelper}>
                    Format: YYYY-MM-DD
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Review Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Review Every</Text>
            <View style={styles.chipRow}>
              {[30, 60, 90, 180].map(days => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.chip,
                    reviewFrequency === days && styles.chipActive,
                  ]}
                  onPress={() => setReviewFrequency(days)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      reviewFrequency === days && styles.chipTextActive,
                    ]}
                  >
                    {days} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={{ height: 100 }} />
        </ScrollView>
        
        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {existingThesis ? 'Update' : 'Save'} Thesis
            </Text>
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
  assetCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  assetName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  assetPrice: {
    fontSize: 14,
    color: '#4ade80',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  chipActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  chipText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  chipTextActive: {
    color: '#0a0e1a',
    fontWeight: 'bold',
  },
  triggerCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  triggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  triggerContent: {
    marginTop: 12,
  },
  triggerLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentInput: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  percentSymbol: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  triggerHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  inlineInput: {
    minWidth: 60,
    backgroundColor: '#0a0e1a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  saveButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
});
