import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import ThesisModal from '../../src/components/ThesisModal';
import type { RealEstateAsset, StockAsset } from '../../src/types';

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
  const isPrimaryResidence = asset.type === 'real_estate' && 
    (asset.metadata as RealEstateAsset)?.isPrimaryResidence;
  const isAppreciationAsset = !isPrimaryResidence && 
    asset.annualIncome < (asset.value * 0.02);
  
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
        {/* PRIMARY RESIDENCE / VESTING / THESIS SECTIONS           */}
        {/* ═══════════════════════════════════════════════════════ */}
        
        {isPrimaryResidence ? (
          <View style={styles.primaryResidenceSection}>
            <Text style={styles.sectionTitle}>🏠 Primary Residence</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                This is your primary residence. It won't appear in investment scenarios or prompt for an investment thesis.
              </Text>
            </View>
          </View>
        ) : asset.type === 'stocks' && (asset.metadata as StockAsset)?.unvestedShares ? (
          /* ═══════════════════════════════════════════════════════ */
          /* Stock Vesting Section (for stocks with unvested shares) */
          /* ═══════════════════════════════════════════════════════ */
          <View style={styles.vestingSection}>
            <Text style={styles.sectionTitle}>🔒 Vesting Schedule</Text>
            
            {(() => {
              const stockMeta = asset.metadata as StockAsset;
              const totalShares = stockMeta.quantity || stockMeta.shares || 0;
              const vestedShares = stockMeta.vestedShares || 0;
              const unvestedShares = stockMeta.unvestedShares || 0;
              const vestedPercent = totalShares > 0 ? (vestedShares / totalShares) * 100 : 0;
              
              return (
                <>
                  {/* Progress Bar */}
                  <View style={styles.vestingBarContainer}>
                    <View style={styles.vestingBarBackground}>
                      <View style={[styles.vestingBarFilled, { width: `${vestedPercent}%` }]} />
                    </View>
                    <View style={styles.vestingBarLabels}>
                      <Text style={styles.vestingBarLabelVested}>
                        ✅ Vested: {vestedShares.toLocaleString()} shares
                      </Text>
                      <Text style={styles.vestingBarLabelUnvested}>
                        🔒 Locked: {unvestedShares.toLocaleString()} shares
                      </Text>
                    </View>
                  </View>

                  {/* Vesting Metrics */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total Shares</Text>
                      <Text style={styles.metricValue}>
                        {totalShares.toLocaleString()}
                      </Text>
                    </View>
                    
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Vested %</Text>
                      <Text style={[styles.metricValue, { color: '#4ade80' }]}>
                        {vestedPercent.toFixed(0)}%
                      </Text>
                    </View>
                  </View>

                  {/* Vesting Schedule */}
                  {stockMeta.vestingSchedule && (
                    <View style={styles.vestingScheduleCard}>
                      <Text style={styles.vestingScheduleTitle}>Next Vesting Event</Text>
                      
                      <View style={styles.vestingScheduleRow}>
                        <View style={styles.vestingScheduleItem}>
                          <Text style={styles.vestingScheduleLabel}>Shares</Text>
                          <Text style={styles.vestingScheduleValue}>
                            +{stockMeta.vestingSchedule.sharesPerVest}
                          </Text>
                        </View>
                        
                        <View style={styles.vestingScheduleItem}>
                          <Text style={styles.vestingScheduleLabel}>Frequency</Text>
                          <Text style={styles.vestingScheduleValue}>
                            {stockMeta.vestingSchedule.frequency}
                          </Text>
                        </View>
                        
                        {stockMeta.vestingSchedule.nextVestDate && (
                          <View style={styles.vestingScheduleItem}>
                            <Text style={styles.vestingScheduleLabel}>Next Date</Text>
                            <Text style={styles.vestingScheduleValue}>
                              {new Date(stockMeta.vestingSchedule.nextVestDate).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                      💡 Only your vested shares ({vestedShares.toLocaleString()}) will count toward dividend income scenarios. Unvested shares are locked until they vest.
                    </Text>
                  </View>
                </>
              );
            })()}
          </View>
        ) : isAppreciationAsset ? (
          /* ═══════════════════════════════════════════════════════ */
          /* Investment Thesis Section (for non-primary investments) */
          /* ═══════════════════════════════════════════════════════ */
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
        ) : null}
        
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
  
  // Primary Residence Section
  primaryResidenceSection: {
    marginBottom: 24,
  },
  
  // Info Card (used by primary residence and vesting)
  infoCard: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  infoText: {
    fontSize: 14,
    color: '#a0c4ff',
    lineHeight: 20,
  },
  
  // Vesting Section
  vestingSection: {
    marginBottom: 24,
  },
  vestingBarContainer: {
    marginBottom: 16,
  },
  vestingBarBackground: {
    height: 12,
    backgroundColor: '#0a0e1a',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  vestingBarFilled: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 6,
  },
  vestingBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vestingBarLabelVested: {
    fontSize: 13,
    color: '#4ade80',
    fontWeight: '600',
  },
  vestingBarLabelUnvested: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  vestingScheduleCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  vestingScheduleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  vestingScheduleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  vestingScheduleItem: {
    flex: 1,
    alignItems: 'center',
  },
  vestingScheduleLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  vestingScheduleValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
