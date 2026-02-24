// app/asset/[id].tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import ThesisModal from '../../src/components/ThesisModal';
import AddAssetModal from '../../src/components/assets/AddAssetModal';
import AssetTargetSection from '@/components/AssetTargetSection';
import SwapSection from '../../src/components/SwapSection';
import type { Asset, RealEstateAsset, StockAsset } from '../../src/types';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const asset = useStore((s) => s.assets.find(a => a.id === id));
  const thesis = useStore((s) => s.investmentTheses.find(t => t.assetId === id));
  const addAsset = useStore((s) => s.addAsset);
  const addThesis = useStore((s) => s.addThesis);
  const updateThesis = useStore((s) => s.updateThesis);
  const updateAsset = useStore((s) => s.updateAsset);
  const markThesisReviewed = useStore((s) => s.markThesisReviewed);
  const removeAsset = useStore((s) => s.removeAsset);

  const [showThesisModal, setShowThesisModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  if (!asset) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Asset not found</Text>
      </View>
    );
  }

  // Extract display info from metadata
  const meta = asset.metadata as any;
  const currentPrice = meta?.priceUSD || meta?.currentPrice || 0;
  const quantity = meta?.quantity || meta?.balance || meta?.shares || 0;
  const symbol = meta?.symbol || meta?.ticker || '';
  const logoURI = meta?.logoURI || '';
  const protocol = meta?.protocol || '';
  const apy = meta?.apy || meta?.dividendYield || 0;

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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editHeaderButton}>
            <Text style={styles.editHeaderText}>Edit</Text>
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
      </View>

      <ScrollView style={styles.content}>
        {/* Asset Info Card */}
        <View style={styles.assetCard}>
          {/* Icon + name row */}
          <View style={styles.assetCardHeader}>
            {logoURI ? (
              <Image source={{ uri: logoURI }} style={styles.assetCardIcon} resizeMode="contain" />
            ) : (
              <View style={styles.assetCardIconPlaceholder}>
                <Text style={styles.assetCardIconText}>
                  {(symbol || asset.name[0] || '?').charAt(0)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.assetType}>{asset.type.toUpperCase()}</Text>
              <Text style={styles.assetName}>{asset.name}</Text>
              {protocol ? <Text style={styles.assetProtocol}>{protocol}</Text> : null}
            </View>
          </View>

          {/* Value */}
          <Text style={styles.assetValue}>
            ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>

          {/* Quantity + price row */}
          {quantity > 0 && symbol ? (
            <Text style={styles.assetMeta}>
              {quantity.toLocaleString()} {symbol}
              {currentPrice > 0 ? ` @ $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : ''}
            </Text>
          ) : currentPrice > 0 ? (
            <Text style={styles.assetMeta}>
              Current Price: ${currentPrice.toFixed(4)}
            </Text>
          ) : null}

          {/* APY + Income */}
          <View style={styles.assetCardStats}>
            {apy > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>APY</Text>
                <Text style={styles.statValue}>{apy.toFixed(2)}%</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Annual Income</Text>
              <Text style={[styles.statValue, asset.annualIncome > 0 ? styles.incomeGreen : styles.incomeZero]}>
                ${asset.annualIncome.toLocaleString()}/yr
              </Text>
            </View>
          </View>

          {asset.annualIncome === 0 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>⚠️ Not generating income — consider staking or deploying into yield</Text>
            </View>
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
          /* Stock Vesting Section */
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
                  <View style={styles.vestingBarContainer}>
                    <View style={styles.vestingBarBackground}>
                      <View style={[styles.vestingBarFilled, { width: `${vestedPercent}%` }]} />
                    </View>
                    <View style={styles.vestingBarLabels}>
                      <Text style={styles.vestingBarLabelVested}>✅ Vested: {vestedShares.toLocaleString()} shares</Text>
                      <Text style={styles.vestingBarLabelUnvested}>🔒 Locked: {unvestedShares.toLocaleString()} shares</Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total Shares</Text>
                      <Text style={styles.metricValue}>{totalShares.toLocaleString()}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Vested %</Text>
                      <Text style={[styles.metricValue, { color: '#4ade80' }]}>{vestedPercent.toFixed(0)}%</Text>
                    </View>
                  </View>

                  {stockMeta.vestingSchedule && (
                    <View style={styles.vestingScheduleCard}>
                      <Text style={styles.vestingScheduleTitle}>Next Vesting Event</Text>
                      <View style={styles.vestingScheduleRow}>
                        <View style={styles.vestingScheduleItem}>
                          <Text style={styles.vestingScheduleLabel}>Shares</Text>
                          <Text style={styles.vestingScheduleValue}>+{stockMeta.vestingSchedule.sharesPerVest}</Text>
                        </View>
                        <View style={styles.vestingScheduleItem}>
                          <Text style={styles.vestingScheduleLabel}>Frequency</Text>
                          <Text style={styles.vestingScheduleValue}>{stockMeta.vestingSchedule.frequency}</Text>
                        </View>
                        {stockMeta.vestingSchedule.nextVestDate && (
                          <View style={styles.vestingScheduleItem}>
                            <Text style={styles.vestingScheduleLabel}>Next Date</Text>
                            <Text style={styles.vestingScheduleValue}>{new Date(stockMeta.vestingSchedule.nextVestDate).toLocaleDateString()}</Text>
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
          /* Investment Thesis Section */
          <View style={styles.thesisSection}>
            <View style={styles.thesisSectionHeader}>
              <Text style={styles.sectionTitle}>💭 Investment Thesis</Text>
              {thesis && (
                <TouchableOpacity onPress={() => setShowThesisModal(true)} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {thesis ? (
              <>
                <View style={styles.thesisCard}>
                  <Text style={styles.thesisLabel}>Why you bought this:</Text>
                  <Text style={styles.thesisBullCase}>{thesis.bullCase}</Text>
                </View>

                {thesis.targetPrice && currentPrice > 0 && (
                  <View style={styles.targetRow}>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Entry</Text>
                      <Text style={styles.targetValue}>${thesis.entryPrice?.toFixed(4) || 'N/A'}</Text>
                    </View>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Current</Text>
                      <Text style={styles.targetValue}>${currentPrice.toFixed(4)}</Text>
                      {thesis.entryPrice && (
                        <Text style={[styles.targetChange, currentPrice > thesis.entryPrice ? styles.targetChangeGreen : styles.targetChangeRed]}>
                          {((currentPrice / thesis.entryPrice - 1) * 100).toFixed(1)}%
                        </Text>
                      )}
                    </View>
                    <View style={styles.targetCol}>
                      <Text style={styles.targetLabel}>Target</Text>
                      <Text style={styles.targetValue}>${thesis.targetPrice.toFixed(4)}</Text>
                      <Text style={styles.targetGain}>+{((thesis.targetPrice / currentPrice - 1) * 100).toFixed(0)}%</Text>
                    </View>
                  </View>
                )}

                {thesis.invalidators.length > 0 && (
                  <View style={styles.invalidatorsSection}>
                    <Text style={styles.invalidatorsTitle}>⚠️ Exit Triggers</Text>
                    {thesis.invalidators.map((inv) => (
                      <View key={inv.id} style={[styles.invalidatorCard, inv.isTriggered && styles.invalidatorTriggered]}>
                        <Text style={styles.invalidatorIcon}>{inv.isTriggered ? '❌' : '⚠️'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invalidatorText}>{inv.description}</Text>
                          {inv.isTriggered && (
                            <Text style={styles.triggeredText}>Triggered on {new Date(inv.triggeredAt!).toLocaleDateString()}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Profit/Loss Calculator */}
                {thesis.targetPrice && thesis.entryPrice && currentPrice > 0 && (
                  <View style={styles.profitLossSection}>
                    <Text style={styles.sectionTitle}>💰 Profit/Loss Potential</Text>
                    {(() => {
                      const qty = quantity || 1;
                      const entryPrice = thesis.entryPrice;
                      const targetPrice = thesis.targetPrice;
                      const currentValue = asset.value;
                      const entryValue = entryPrice * qty;
                      const targetValue = targetPrice * qty;
                      const potentialProfit = targetValue - currentValue;
                      const profitPercent = ((targetPrice / currentPrice) - 1) * 100;

                      const stopLossInvalidators = thesis.invalidators.filter(inv => inv.type === 'price_drop' && inv.triggerPrice);
                      const stopLoss = stopLossInvalidators.length > 0 ? Math.min(...stopLossInvalidators.map(inv => inv.triggerPrice!)) : null;
                      const stopLossValue = stopLoss ? stopLoss * qty : null;
                      const potentialLoss = stopLossValue ? currentValue - stopLossValue : null;
                      const lossPercent = stopLoss ? ((currentPrice / stopLoss) - 1) * 100 : null;
                      const riskReward = (potentialLoss && potentialLoss > 0) ? potentialProfit / potentialLoss : null;
                      const currentPnL = currentValue - entryValue;
                      const currentPnLPercent = ((currentPrice / entryPrice) - 1) * 100;

                      return (
                        <>
                          <View style={styles.plCard}>
                            <Text style={styles.plCardTitle}>Current Position</Text>
                            <View style={styles.plRow}>
                              <View style={styles.plCol}>
                                <Text style={styles.plLabel}>Entry Cost</Text>
                                <Text style={styles.plValue}>${entryValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                <Text style={styles.plSubtext}>{qty.toLocaleString()} @ ${entryPrice.toFixed(4)}</Text>
                              </View>
                              <View style={styles.plCol}>
                                <Text style={styles.plLabel}>Current Value</Text>
                                <Text style={styles.plValue}>${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                <Text style={[styles.plChange, currentPnL >= 0 ? styles.green : styles.red]}>
                                  {currentPnL >= 0 ? '+' : ''}${Math.abs(currentPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({currentPnLPercent >= 0 ? '+' : ''}{currentPnLPercent.toFixed(1)}%)
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={[styles.plCard, styles.profitCard]}>
                            <View style={styles.plCardHeader}>
                              <Text style={styles.plCardTitle}>🎯 If Target Hit</Text>
                              <Text style={styles.plTargetPrice}>${targetPrice.toFixed(4)}</Text>
                            </View>
                            <View style={styles.plRow}>
                              <View style={styles.plCol}>
                                <Text style={styles.plLabel}>Profit</Text>
                                <Text style={[styles.plBigValue, styles.green]}>+${potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                              </View>
                              <View style={styles.plCol}>
                                <Text style={styles.plLabel}>Gain</Text>
                                <Text style={[styles.plBigValue, styles.green]}>+{profitPercent.toFixed(0)}%</Text>
                              </View>
                            </View>
                          </View>

                          {stopLoss && potentialLoss && (
                            <View style={[styles.plCard, styles.lossCard]}>
                              <View style={styles.plCardHeader}>
                                <Text style={styles.plCardTitle}>⚠️ If Stop-Loss Hit</Text>
                                <Text style={styles.plStopPrice}>${stopLoss.toFixed(4)}</Text>
                              </View>
                              <View style={styles.plRow}>
                                <View style={styles.plCol}>
                                  <Text style={styles.plLabel}>Loss</Text>
                                  <Text style={[styles.plBigValue, styles.red]}>-${potentialLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                </View>
                                <View style={styles.plCol}>
                                  <Text style={styles.plLabel}>Drop</Text>
                                  <Text style={[styles.plBigValue, styles.red]}>-{lossPercent!.toFixed(0)}%</Text>
                                </View>
                              </View>
                            </View>
                          )}

                          {riskReward && (
                            <View style={styles.rrCard}>
                              <Text style={styles.rrLabel}>Risk/Reward Ratio</Text>
                              <Text style={[styles.rrValue, riskReward >= 2 ? styles.green : riskReward >= 1 ? styles.yellow : styles.red]}>
                                {riskReward.toFixed(2)}:1
                              </Text>
                              <Text style={styles.rrExplain}>
                                {riskReward >= 3 ? '🟢 Excellent trade setup' : riskReward >= 2 ? '🟡 Good risk/reward' : riskReward >= 1 ? '🟠 Acceptable ratio' : '🔴 Poor risk/reward'}
                              </Text>
                            </View>
                          )}

                          <View style={styles.decisionCard}>
                            <Text style={styles.decisionTitle}>📊 What To Do</Text>
                            <Text style={styles.decisionText}>
                              {currentPrice >= targetPrice
                                ? '🎉 TARGET HIT! Consider selling to lock in profits'
                                : stopLoss && currentPrice <= stopLoss
                                  ? '⚠️ STOP-LOSS HIT! Exit to prevent further losses'
                                  : `💎 HOLD - ${((currentPrice / targetPrice) * 100).toFixed(0)}% to target`
                              }
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Time Horizon</Text>
                    <Text style={styles.metaValue}>{thesis.timeHorizon}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Last Reviewed</Text>
                    <Text style={styles.metaValue}>
                      {thesis.lastReviewed ? new Date(thesis.lastReviewed).toLocaleDateString() : 'Never'}
                    </Text>
                  </View>
                </View>

                <View style={styles.thesisActions}>
                  <TouchableOpacity style={styles.reviewButton} onPress={() => markThesisReviewed(thesis.id)}>
                    <Text style={styles.reviewButtonText}>✓ Mark Reviewed</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.addThesisButton} onPress={() => setShowThesisModal(true)}>
                <Text style={styles.addThesisText}>+ Add Investment Thesis</Text>
                <Text style={styles.addThesisSubtext}>Document why you bought this and when you'd sell</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Accumulation Target — crypto only */}
        {asset.type === 'crypto' && (
          <AssetTargetSection asset={asset} />
        )}

        {/* Swap — crypto only */}
        {asset.type === 'crypto' && (
          <SwapSection asset={asset} />
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

      {/* Edit Asset Modal */}
      <AddAssetModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onAddAsset={(newAsset) => {
          // Shouldn't happen in edit mode, but handle gracefully
          addAsset(newAsset);
          setShowEditModal(false);
        }}
        onUpdateAsset={(assetId, updates) => {
          updateAsset(assetId, updates);
          setShowEditModal(false);
        }}
        editingAsset={asset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#1a1f2e',
  },
  backButton: { padding: 8 },
  backText: { fontSize: 16, color: '#60a5fa' },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  editHeaderButton: { padding: 8 },
  editHeaderText: { fontSize: 16, color: '#4ade80', fontWeight: '600' },
  deleteButton: { padding: 8 },
  deleteText: { fontSize: 16, color: '#f87171' },
  content: { flex: 1, padding: 20 },
  errorText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 100 },

  // Asset Card — enhanced
  assetCard: {
    backgroundColor: '#1a1f2e', borderRadius: 16, padding: 24, marginBottom: 24,
    borderWidth: 2, borderColor: '#4ade80',
  },
  assetCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16,
  },
  assetCardIcon: { width: 48, height: 48, borderRadius: 24 },
  assetCardIconPlaceholder: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2f3e',
    justifyContent: 'center', alignItems: 'center',
  },
  assetCardIconText: { fontSize: 20, fontWeight: 'bold', color: '#4ade80' },
  assetType: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  assetName: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  assetProtocol: { fontSize: 14, color: '#60a5fa', marginTop: 2 },
  assetValue: { fontSize: 36, fontWeight: 'bold', color: '#4ade80', marginBottom: 4 },
  assetMeta: { fontSize: 14, color: '#666', marginBottom: 12 },
  assetCardStats: { flexDirection: 'row', gap: 24, marginTop: 8 },
  statItem: {},
  statLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '600', color: '#fff' },
  incomeGreen: { color: '#4ade80' },
  incomeZero: { color: '#666' },
  warningBanner: {
    backgroundColor: '#2a1f0e', borderRadius: 8, padding: 12, marginTop: 16,
    borderLeftWidth: 3, borderLeftColor: '#ff9800',
  },
  warningBannerText: { fontSize: 13, color: '#ff9800', lineHeight: 18 },

  // Primary Residence
  primaryResidenceSection: { marginBottom: 24 },
  infoCard: { backgroundColor: '#1a2a3a', borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: '#60a5fa' },
  infoText: { fontSize: 14, color: '#a0c4ff', lineHeight: 20 },

  // Vesting
  vestingSection: { marginBottom: 24 },
  vestingBarContainer: { marginBottom: 16 },
  vestingBarBackground: { height: 12, backgroundColor: '#0a0e1a', borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  vestingBarFilled: { height: '100%', backgroundColor: '#4ade80', borderRadius: 6 },
  vestingBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  vestingBarLabelVested: { fontSize: 13, color: '#4ade80', fontWeight: '600' },
  vestingBarLabelUnvested: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metricItem: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2f3e', alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  metricValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  vestingScheduleCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  vestingScheduleTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  vestingScheduleRow: { flexDirection: 'row', gap: 12 },
  vestingScheduleItem: { flex: 1, alignItems: 'center' },
  vestingScheduleLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  vestingScheduleValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  // Thesis
  thesisSection: { marginBottom: 24 },
  thesisSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  editButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#60a5fa' },
  editButtonText: { fontSize: 14, color: '#60a5fa', fontWeight: '600' },
  thesisCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  thesisLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  thesisBullCase: { fontSize: 16, color: '#fff', lineHeight: 24 },
  targetRow: { flexDirection: 'row', backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 16, gap: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  targetCol: { flex: 1, alignItems: 'center' },
  targetLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  targetValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  targetChange: { fontSize: 14, fontWeight: '600' },
  targetChangeGreen: { color: '#4ade80' },
  targetChangeRed: { color: '#f87171' },
  targetGain: { fontSize: 14, fontWeight: '600', color: '#666' },
  invalidatorsSection: { marginBottom: 16 },
  invalidatorsTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  invalidatorCard: { flexDirection: 'row', gap: 12, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#fbbf24', borderWidth: 1, borderColor: '#2a2f3e' },
  invalidatorTriggered: { borderLeftColor: '#f87171', backgroundColor: '#2a1f1f' },
  invalidatorIcon: { fontSize: 20 },
  invalidatorText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  triggeredText: { fontSize: 12, color: '#f87171', marginTop: 4 },

  // P&L
  profitLossSection: { marginTop: 24, marginBottom: 24 },
  plCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2f3e' },
  profitCard: { borderColor: '#4ade80', borderWidth: 1.5 },
  lossCard: { borderColor: '#ef4444', borderWidth: 1.5 },
  plCardTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 12 },
  plCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  plTargetPrice: { fontSize: 16, fontWeight: '700', color: '#4ade80' },
  plStopPrice: { fontSize: 16, fontWeight: '700', color: '#ef4444' },
  plRow: { flexDirection: 'row', gap: 16 },
  plCol: { flex: 1 },
  plLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  plValue: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  plBigValue: { fontSize: 24, fontWeight: '700' },
  plSubtext: { fontSize: 12, color: '#666' },
  plChange: { fontSize: 13, fontWeight: '600' },
  green: { color: '#4ade80' },
  red: { color: '#ef4444' },
  yellow: { color: '#fbbf24' },
  rrCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2f3e' },
  rrLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  rrValue: { fontSize: 36, fontWeight: '700', marginBottom: 8 },
  rrExplain: { fontSize: 13, color: '#999' },
  decisionCard: { backgroundColor: '#0a0e1a', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#4ade80' },
  decisionTitle: { fontSize: 14, fontWeight: '600', color: '#4ade80', marginBottom: 8 },
  decisionText: { fontSize: 16, fontWeight: '600', color: '#fff', lineHeight: 24 },

  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2f3e', alignItems: 'center' },
  metaLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  metaValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  thesisActions: { gap: 10 },
  reviewButton: { backgroundColor: '#4ade80', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  reviewButtonText: { fontSize: 16, fontWeight: 'bold', color: '#0a0e1a' },
  addThesisButton: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#4ade80', borderStyle: 'dashed' },
  addThesisText: { fontSize: 18, fontWeight: 'bold', color: '#4ade80', marginBottom: 8 },
  addThesisSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
});
