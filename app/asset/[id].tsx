import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import ThesisModal from '../../src/components/ThesisModal';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const asset = useStore((s) => s.assets.find(a => a.id === id));
  const thesis = useStore((s) => 
    s.investmentTheses.find(t => t.assetId === id)
  );
  const addThesis = useStore((s) => s.addThesis);
  const updateThesis = useStore((s) => s.updateThesis);
  const markThesisReviewed = useStore((s) => s.markThesisReviewed);
  const removeAsset = useStore((s) => s.removeAsset);
  
  const [showThesisModal, setShowThesisModal] = useState(false);
  
  if (!asset) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Asset not found</Text>
      </View>
    );
  }
  
  const currentPrice = (asset.metadata as any)?.priceUSD || 0;
  const isAppreciationAsset = asset.annualIncome < (asset.value * 0.02);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => {
            removeAsset(asset.id);
            router.back();
          }}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Asset Info Card */}
        <View style={styles.assetCard}>
          <Text style={styles.assetType}>{asset.type}</Text>
          <Text style={styles.assetName}>{asset.name}</Text>
          <Text style={styles.assetValue}>
            ${asset.value.toLocaleString()}
          </Text>
          {currentPrice > 0 && (
            <Text style={styles.assetPrice}>
              Current Price: ${currentPrice.toFixed(4)}
            </Text>
          )}
          {asset.annualIncome > 0 && (
            <Text style={styles.assetIncome}>
              Income: ${asset.annualIncome.toLocaleString()}/year
            </Text>
          )}
        </View>
        
        {/* ═══════════════════════════════════════════════════════ */}
        {/* Investment Thesis Section - THIS IS THE IMPORTANT PART */}
        {/* ═══════════════════════════════════════════════════════ */}
        
        {isAppreciationAsset && (
          <View style={styles.thesisSection}>
            <View style={styles.thesisSectionHeader}>
              <Text style={styles.sectionTitle}>💭 Investment Thesis</Text>
              {thesis && (
                <TouchableOpacity 
                  onPress={() => setShowThesisModal(true)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {thesis ? (
              <>
                {/* Bull Case */}
                <View style={styles.thesisCard}>
                  <Text style={styles.thesisLabel}>Why you bought this:</Text>
                  <Text style={styles.thesisBullCase}>{thesis.bullCase}</Text>
                </View>
                
                {/* Target & Performance */}
                {thesis.targetPrice && currentPrice > 0 && (
                  <View style={styles.targetRow}>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Entry</Text>
                      <Text style={styles.targetValue}>
                        ${thesis.entryPrice?.toFixed(4) || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Current</Text>
                      <Text style={styles.targetValue}>
                        ${currentPrice.toFixed(4)}
                      </Text>
                      {thesis.entryPrice && (
                        <Text style={[
                          styles.targetChange,
                          currentPrice > thesis.entryPrice 
                            ? styles.targetChangeGreen 
                            : styles.targetChangeRed
                        ]}>
                          {((currentPrice / thesis.entryPrice - 1) * 100).toFixed(1)}%
                        </Text>
                      )}
                    </View>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Target</Text>
                      <Text style={styles.targetValue}>
                        ${thesis.targetPrice.toFixed(4)}
                      </Text>
                      <Text style={styles.targetGain}>
                        +{((thesis.targetPrice / currentPrice - 1) * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                )}
                
                {/* Invalidators */}
                {thesis.invalidators.length > 0 && (
                  <View style={styles.invalidatorsSection}>
                    <Text style={styles.invalidatorsTitle}>
                      ⚠️ Exit Triggers
                    </Text>
                    {thesis.invalidators.map((inv) => (
                      <View 
                        key={inv.id} 
                        style={[
                          styles.invalidatorCard,
                          inv.isTriggered && styles.invalidatorTriggered
                        ]}
                      >
                        <Text style={styles.invalidatorIcon}>
                          {inv.isTriggered ? '❌' : '⚠️'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invalidatorText}>
                            {inv.description}
                          </Text>
                          {inv.isTriggered && (
                            <Text style={styles.triggeredText}>
                              Triggered on {new Date(inv.triggeredAt!).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Timeline & Review */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Time Horizon</Text>
                    <Text style={styles.metaValue}>{thesis.timeHorizon}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Last Reviewed</Text>
                    <Text style={styles.metaValue}>
                      {thesis.lastReviewed 
                        ? new Date(thesis.lastReviewed).toLocaleDateString()
                        : 'Never'
                      }
                    </Text>
                  </View>
                </View>
                
                {/* Actions */}
                <View style={styles.thesisActions}>
                  <TouchableOpacity 
                    style={styles.reviewButton}
                    onPress={() => markThesisReviewed(thesis.id)}
                  >
                    <Text style={styles.reviewButtonText}>
                      ✓ Mark Reviewed
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // No thesis yet
              <TouchableOpacity 
                style={styles.addThesisButton}
                onPress={() => setShowThesisModal(true)}
              >
                <Text style={styles.addThesisText}>
                  + Add Investment Thesis
                </Text>
                <Text style={styles.addThesisSubtext}>
                  Document why you bought this and when you'd sell
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Thesis Modal */}
        {isAppreciationAsset && (
          <ThesisModal
            visible={showThesisModal}
            asset={asset}
            existingThesis={thesis}
            onClose={() => setShowThesisModal(false)}
            onSave={(thesisData) => {
              if (thesis) {
                updateThesis(thesis.id, thesisData);
              } else {
                addThesis(thesisData);
              }
              setShowThesisModal(false);
            }}
          />
        )}
      </ScrollView>
    </View>
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
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#60a5fa',
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    fontSize: 16,
    color: '#f87171',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
  
  // Asset Card
  assetCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  assetType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  assetName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  assetValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 8,
  },
  assetPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  assetIncome: {
    fontSize: 14,
    color: '#4ade80',
  },
  
  // Thesis Section
  thesisSection: {
    marginBottom: 24,
  },
  thesisSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  editButtonText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
  },
  
  thesisCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  thesisLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  thesisBullCase: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  
  targetRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  targetCol: {
    flex: 1,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  targetValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  targetChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  targetChangeGreen: {
    color: '#4ade80',
  },
  targetChangeRed: {
    color: '#f87171',
  },
  targetGain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  
  invalidatorsSection: {
    marginBottom: 16,
  },
  invalidatorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  invalidatorCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  invalidatorTriggered: {
    borderLeftColor: '#f87171',
    backgroundColor: '#2a1f1f',
  },
  invalidatorIcon: {
    fontSize: 20,
  },
  invalidatorText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  triggeredText: {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
  },
  
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  metaLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  
  thesisActions: {
    gap: 10,
  },
  reviewButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  
  addThesisButton: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ade80',
    borderStyle: 'dashed',
  },
  addThesisText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 8,
  },
  addThesisSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});