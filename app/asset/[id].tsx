// app/asset/[id].tsx
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, Linking, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useStore } from '../../src/store/useStore';
import ThesisModal from '../../src/components/ThesisModal';
import AddAssetModal from '../../src/components/assets/AddAssetModal';
import AssetTargetSection from '@/components/AssetTargetSection';
import JupiterSwap from '../../src/components/JupiterSwap';
import SparklineChart from '../../src/components/SparklineChart';
import { loadSnapshotsForMint, fetchTokenInfo, getTokenPriceData } from '../../src/services/priceTracker';
import type { TokenProjectInfo, TokenPriceData, PriceSnapshot } from '../../src/services/priceTracker';
import { lookupToken } from '../../src/utils/tokenRegistry';
import type { Asset, RealEstateAsset, StockAsset } from '../../src/types';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

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

  // Crypto-specific state
  const [sparklineData, setSparklineData] = useState<PriceSnapshot[]>([]);
  const [priceData, setPriceData] = useState<TokenPriceData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenProjectInfo | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  // Key levels inline editing
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
  const mint = meta?.tokenMint || meta?.mint || '';
  const logoURI = meta?.logoURI || '';
  const protocol = meta?.protocol || '';
  const apy = meta?.apy || meta?.dividendYield || 0;
  const isCrypto = asset.type === 'crypto' || asset.type === 'defi';

  const isPrimaryResidence = asset.type === 'real_estate' &&
    (asset.metadata as RealEstateAsset)?.isPrimaryResidence;
  const isAppreciationAsset = !isPrimaryResidence &&
    asset.annualIncome < (asset.value * 0.02);

  // Load crypto data
  useEffect(() => {
    if (!isCrypto || !mint) return;
    let cancelled = false;

    (async () => {
      // Load sparkline snapshots
      const snapshots = await loadSnapshotsForMint(mint);
      if (!cancelled) setSparklineData(snapshots);

      // Load price data (24h, 7d, ATH)
      const symbolMap: Record<string, string> = { [mint]: symbol };
      const data = await getTokenPriceData([mint], symbolMap);
      if (!cancelled && data[mint]) setPriceData(data[mint]);

      // Load project info
      const info = await fetchTokenInfo(mint);
      if (!cancelled) setTokenInfo(info);
    })();

    return () => { cancelled = true; };
  }, [isCrypto, mint, symbol]);

  // Stop-loss from thesis invalidators
  const stopLossInvalidators = thesis?.invalidators.filter(
    inv => inv.type === 'price_drop' && inv.triggerPrice
  ) || [];
  const stopLossPrice = stopLossInvalidators.length > 0
    ? Math.min(...stopLossInvalidators.map(inv => inv.triggerPrice!))
    : null;

  // Key level editing handlers
  const handleLevelSave = (field: string, value: string) => {
    if (!thesis) return;
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setEditingLevel(null);
      return;
    }

    if (field === 'entry') {
      updateThesis(thesis.id, { entryPrice: numVal });
    } else if (field === 'target') {
      updateThesis(thesis.id, { targetPrice: numVal });
    } else if (field === 'stopLoss') {
      // Update or add stop-loss invalidator
      const existing = stopLossInvalidators[0];
      if (existing) {
        const updatedInvalidators = thesis.invalidators.map(inv =>
          inv.id === existing.id ? { ...inv, triggerPrice: numVal, description: `Stop-loss at $${numVal}` } : inv
        );
        updateThesis(thesis.id, { invalidators: updatedInvalidators });
      } else {
        updateThesis(thesis.id, {
          invalidators: [...thesis.invalidators, {
            id: `sl-${Date.now()}`,
            type: 'price_drop' as any,
            triggerPrice: numVal,
            description: `Stop-loss at $${numVal}`,
            isTriggered: false,
          }],
        });
      }
    }
    setEditingLevel(null);
  };

  const handleRemoveStopLoss = () => {
    if (!thesis) return;
    const updated = thesis.invalidators.filter(
      inv => !(inv.type === 'price_drop' && inv.triggerPrice)
    );
    updateThesis(thesis.id, { invalidators: updated });
  };

  const handleAddStopLoss = () => {
    setEditingLevel('stopLoss');
    setEditValue('');
  };

  // Format price for display (auto decimal places)
  const fmtPrice = (p: number) => {
    if (p >= 100) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  };

  const changePill = (change: number | null) => {
    if (change == null) return null;
    const isPos = change >= 0;
    return (
      <View style={[styles.changePill, isPos ? styles.changePillGreen : styles.changePillRed]}>
        <Text style={[styles.changePillText, isPos ? styles.changeTextGreen : styles.changeTextRed]}>
          {isPos ? '+' : ''}{change.toFixed(1)}%
        </Text>
      </View>
    );
  };

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

        {/* ════════════════════════════════════════════════════════════ */}
        {/* CRYPTO HERO SECTION                                        */}
        {/* ════════════════════════════════════════════════════════════ */}
        {isCrypto ? (
          <>
            <View style={styles.heroSection}>
              {/* Logo + Name + Symbol */}
              <View style={styles.heroHeader}>
                {logoURI ? (
                  <Image source={{ uri: logoURI }} style={styles.heroLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.heroLogoPlaceholder}>
                    <Text style={styles.heroLogoText}>
                      {(symbol || asset.name[0] || '?').charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{asset.name}</Text>
                  <View style={styles.heroSymbolRow}>
                    <View style={styles.symbolBadge}>
                      <Text style={styles.symbolBadgeText}>{symbol}</Text>
                    </View>
                    {protocol ? <Text style={styles.heroProtocol}>{protocol}</Text> : null}
                  </View>
                </View>
              </View>

              {/* Price + 24h Change */}
              <View style={styles.priceRow}>
                <Text style={styles.heroPrice}>${fmtPrice(currentPrice)}</Text>
                {changePill(priceData?.change24h ?? null)}
              </View>

              {/* Value + Quantity */}
              <Text style={styles.heroValue}>
                ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
              {quantity > 0 && (
                <Text style={styles.heroQuantity}>
                  {quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol}
                </Text>
              )}

              {/* Sparkline Chart */}
              <View style={styles.chartContainer}>
                <SparklineChart
                  data={sparklineData.map(s => ({ price: s.price, timestamp: s.timestamp }))}
                  width={screenWidth - 80}
                  height={100}
                />
              </View>

              {/* Quick Stats Row */}
              <View style={styles.quickStats}>
                <View style={styles.quickStatItem}>
                  <Text style={styles.quickStatLabel}>24h</Text>
                  <Text style={[
                    styles.quickStatValue,
                    (priceData?.change24h ?? 0) >= 0 ? styles.green : styles.red,
                  ]}>
                    {priceData?.change24h != null ? `${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(1)}%` : '—'}
                  </Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Text style={styles.quickStatLabel}>7d</Text>
                  <Text style={[
                    styles.quickStatValue,
                    (priceData?.change7d ?? 0) >= 0 ? styles.green : styles.red,
                  ]}>
                    {priceData?.change7d != null ? `${priceData.change7d >= 0 ? '+' : ''}${priceData.change7d.toFixed(1)}%` : '—'}
                  </Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Text style={styles.quickStatLabel}>ATH</Text>
                  <Text style={[styles.quickStatValue, styles.red]}>
                    {priceData?.fromATH != null ? `${priceData.fromATH.toFixed(0)}%` : '—'}
                  </Text>
                </View>
                {apy > 0 && (
                  <View style={styles.quickStatItem}>
                    <Text style={styles.quickStatLabel}>APY</Text>
                    <Text style={[styles.quickStatValue, styles.green]}>{apy.toFixed(2)}%</Text>
                  </View>
                )}
              </View>

              {/* Income */}
              <View style={styles.heroIncomeRow}>
                <Text style={styles.statLabel}>Annual Income</Text>
                <Text style={[styles.statValue, asset.annualIncome > 0 ? styles.incomeGreen : styles.incomeZero]}>
                  ${asset.annualIncome.toLocaleString()}/yr
                </Text>
              </View>

              {asset.annualIncome === 0 && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningBannerText}>Not generating income — consider staking or deploying into yield</Text>
                </View>
              )}
            </View>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* KEY LEVELS                                              */}
            {/* ═══════════════════════════════════════════════════════ */}
            {thesis && (thesis.entryPrice || thesis.targetPrice) && (
              <View style={styles.keyLevelsSection}>
                <Text style={styles.sectionTitle}>Key Levels</Text>

                {/* Price bar visualization */}
                {thesis.entryPrice && thesis.targetPrice && currentPrice > 0 && (
                  <View style={styles.priceBar}>
                    {(() => {
                      const low = Math.min(thesis.entryPrice, currentPrice, stopLossPrice || Infinity) * 0.95;
                      const high = thesis.targetPrice * 1.05;
                      const range = high - low || 1;
                      const entryPct = ((thesis.entryPrice - low) / range) * 100;
                      const currentPct = ((currentPrice - low) / range) * 100;
                      const targetPct = ((thesis.targetPrice - low) / range) * 100;
                      const slPct = stopLossPrice ? ((stopLossPrice - low) / range) * 100 : null;

                      return (
                        <>
                          <View style={styles.priceBarTrack}>
                            <View style={[styles.priceBarFill, { left: `${Math.min(entryPct, currentPct)}%`, width: `${Math.abs(currentPct - entryPct)}%` }]} />
                          </View>
                          <View style={[styles.priceBarMarker, { left: `${entryPct}%` }]}>
                            <View style={[styles.markerDot, { backgroundColor: '#60a5fa' }]} />
                          </View>
                          <View style={[styles.priceBarMarker, { left: `${currentPct}%` }]}>
                            <View style={[styles.markerDot, { backgroundColor: '#fff' }]} />
                          </View>
                          <View style={[styles.priceBarMarker, { left: `${targetPct}%` }]}>
                            <View style={[styles.markerDot, { backgroundColor: '#4ade80' }]} />
                          </View>
                          {slPct != null && (
                            <View style={[styles.priceBarMarker, { left: `${slPct}%` }]}>
                              <View style={[styles.markerDot, { backgroundColor: '#ef4444' }]} />
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>
                )}

                {/* Level chips */}
                <View style={styles.levelChips}>
                  {/* Entry */}
                  <TouchableOpacity
                    style={[styles.levelChip, styles.levelChipEntry]}
                    onPress={() => { setEditingLevel('entry'); setEditValue(thesis.entryPrice?.toString() || ''); }}
                  >
                    <Text style={styles.levelChipLabel}>Entry</Text>
                    {editingLevel === 'entry' ? (
                      <TextInput
                        style={styles.levelChipInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        autoFocus
                        onBlur={() => handleLevelSave('entry', editValue)}
                        onSubmitEditing={() => handleLevelSave('entry', editValue)}
                      />
                    ) : (
                      <Text style={styles.levelChipValue}>${fmtPrice(thesis.entryPrice || 0)}</Text>
                    )}
                  </TouchableOpacity>

                  {/* Current */}
                  <View style={[styles.levelChip, styles.levelChipCurrent]}>
                    <Text style={styles.levelChipLabel}>Current</Text>
                    <Text style={styles.levelChipValue}>${fmtPrice(currentPrice)}</Text>
                    {thesis.entryPrice && (
                      <Text style={[styles.levelChipChange, currentPrice >= thesis.entryPrice ? styles.green : styles.red]}>
                        {((currentPrice / thesis.entryPrice - 1) * 100).toFixed(1)}%
                      </Text>
                    )}
                  </View>

                  {/* Target */}
                  <TouchableOpacity
                    style={[styles.levelChip, styles.levelChipTarget]}
                    onPress={() => { setEditingLevel('target'); setEditValue(thesis.targetPrice?.toString() || ''); }}
                  >
                    <Text style={styles.levelChipLabel}>Target</Text>
                    {editingLevel === 'target' ? (
                      <TextInput
                        style={styles.levelChipInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        autoFocus
                        onBlur={() => handleLevelSave('target', editValue)}
                        onSubmitEditing={() => handleLevelSave('target', editValue)}
                      />
                    ) : (
                      <Text style={[styles.levelChipValue, styles.green]}>
                        ${fmtPrice(thesis.targetPrice || 0)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Stop-Loss */}
                  {stopLossPrice ? (
                    <TouchableOpacity
                      style={[styles.levelChip, styles.levelChipStopLoss]}
                      onPress={() => { setEditingLevel('stopLoss'); setEditValue(stopLossPrice.toString()); }}
                    >
                      <View style={styles.levelChipHeader}>
                        <Text style={styles.levelChipLabel}>Stop-Loss</Text>
                        <TouchableOpacity onPress={handleRemoveStopLoss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeX}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      {editingLevel === 'stopLoss' ? (
                        <TextInput
                          style={styles.levelChipInput}
                          value={editValue}
                          onChangeText={setEditValue}
                          keyboardType="numeric"
                          autoFocus
                          onBlur={() => handleLevelSave('stopLoss', editValue)}
                          onSubmitEditing={() => handleLevelSave('stopLoss', editValue)}
                        />
                      ) : (
                        <Text style={[styles.levelChipValue, styles.red]}>${fmtPrice(stopLossPrice)}</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.levelChip, styles.levelChipAdd]} onPress={handleAddStopLoss}>
                      {editingLevel === 'stopLoss' ? (
                        <>
                          <Text style={styles.levelChipLabel}>Stop-Loss</Text>
                          <TextInput
                            style={styles.levelChipInput}
                            value={editValue}
                            onChangeText={setEditValue}
                            keyboardType="numeric"
                            autoFocus
                            placeholder="$0.00"
                            placeholderTextColor="#555"
                            onBlur={() => handleLevelSave('stopLoss', editValue)}
                            onSubmitEditing={() => handleLevelSave('stopLoss', editValue)}
                          />
                        </>
                      ) : (
                        <Text style={styles.addStopLossText}>+ Add Stop-Loss</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PROJECT INFO                                            */}
            {/* ═══════════════════════════════════════════════════════ */}
            {tokenInfo && (tokenInfo.description || tokenInfo.websiteUrl || tokenInfo.twitterUrl) && (
              <View style={styles.projectInfoSection}>
                <Text style={styles.sectionTitle}>About {symbol}</Text>

                {tokenInfo.description && (
                  <TouchableOpacity onPress={() => setDescExpanded(e => !e)} activeOpacity={0.7}>
                    <Text
                      style={styles.projectDescription}
                      numberOfLines={descExpanded ? undefined : 3}
                    >
                      {tokenInfo.description}
                    </Text>
                    {!descExpanded && tokenInfo.description.length > 120 && (
                      <Text style={styles.readMore}>Read more</Text>
                    )}
                  </TouchableOpacity>
                )}

                <View style={styles.socialLinks}>
                  {tokenInfo.websiteUrl && (
                    <TouchableOpacity style={styles.socialBtn} onPress={() => Linking.openURL(tokenInfo.websiteUrl!)}>
                      <Text style={styles.socialBtnText}>🌐 Website</Text>
                    </TouchableOpacity>
                  )}
                  {tokenInfo.twitterUrl && (
                    <TouchableOpacity style={styles.socialBtn} onPress={() => Linking.openURL(tokenInfo.twitterUrl!)}>
                      <Text style={styles.socialBtnText}>🐦 Twitter</Text>
                    </TouchableOpacity>
                  )}
                  {tokenInfo.discordUrl && (
                    <TouchableOpacity style={styles.socialBtn} onPress={() => Linking.openURL(tokenInfo.discordUrl!)}>
                      <Text style={styles.socialBtnText}>💬 Discord</Text>
                    </TouchableOpacity>
                  )}
                  {tokenInfo.telegramUrl && (
                    <TouchableOpacity style={styles.socialBtn} onPress={() => Linking.openURL(tokenInfo.telegramUrl!)}>
                      <Text style={styles.socialBtnText}>💬 Telegram</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* JUPITER SWAP                                            */}
            {/* ═══════════════════════════════════════════════════════ */}
            <JupiterSwap asset={asset} />

            {/* ═══════════════════════════════════════════════════════ */}
            {/* INVESTMENT THESIS (crypto — without target row)         */}
            {/* ═══════════════════════════════════════════════════════ */}
            {isAppreciationAsset && (
              <View style={styles.thesisSection}>
                <View style={styles.thesisSectionHeader}>
                  <Text style={styles.sectionTitle}>Investment Thesis</Text>
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

                    {/* Entry/Current/Target row moved to Key Levels — skip here */}

                    {thesis.invalidators.length > 0 && (
                      <View style={styles.invalidatorsSection}>
                        <Text style={styles.invalidatorsTitle}>Exit Triggers</Text>
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
                        <Text style={styles.sectionTitle}>Profit/Loss Potential</Text>
                        {(() => {
                          const qty = quantity || 1;
                          const entryPrice = thesis.entryPrice;
                          const targetPrice = thesis.targetPrice;
                          const currentValue = asset.value;
                          const entryValue = entryPrice * qty;
                          const targetValue = targetPrice * qty;
                          const potentialProfit = targetValue - currentValue;
                          const profitPercent = ((targetPrice / currentPrice) - 1) * 100;

                          const stopLoss = stopLossPrice;
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
                                  <Text style={styles.plCardTitle}>If Target Hit</Text>
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
                                    <Text style={styles.plCardTitle}>If Stop-Loss Hit</Text>
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
                                    {riskReward >= 3 ? 'Excellent trade setup' : riskReward >= 2 ? 'Good risk/reward' : riskReward >= 1 ? 'Acceptable ratio' : 'Poor risk/reward'}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.decisionCard}>
                                <Text style={styles.decisionTitle}>What To Do</Text>
                                <Text style={styles.decisionText}>
                                  {currentPrice >= targetPrice
                                    ? 'TARGET HIT! Consider selling to lock in profits'
                                    : stopLoss && currentPrice <= stopLoss
                                      ? 'STOP-LOSS HIT! Exit to prevent further losses'
                                      : `HOLD - ${((currentPrice / targetPrice) * 100).toFixed(0)}% to target`
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
                        <Text style={styles.reviewButtonText}>Mark Reviewed</Text>
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
            )}

            {/* Accumulation Target */}
            <AssetTargetSection asset={asset} />
          </>
        ) : (
          /* ════════════════════════════════════════════════════════════ */
          /* NON-CRYPTO: Original layout (unchanged)                     */
          /* ════════════════════════════════════════════════════════════ */
          <>
            {/* Asset Info Card */}
            <View style={styles.assetCard}>
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

              <Text style={styles.assetValue}>
                ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>

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
                  <Text style={styles.warningBannerText}>Not generating income — consider deploying into yield</Text>
                </View>
              )}
            </View>

            {/* Non-crypto thesis/vesting sections */}
            {isPrimaryResidence ? (
              <View style={styles.primaryResidenceSection}>
                <Text style={styles.sectionTitle}>Primary Residence</Text>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    This is your primary residence. It won't appear in investment scenarios or prompt for an investment thesis.
                  </Text>
                </View>
              </View>
            ) : asset.type === 'stocks' && (asset.metadata as StockAsset)?.unvestedShares ? (
              <View style={styles.vestingSection}>
                <Text style={styles.sectionTitle}>Vesting Schedule</Text>
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
                          <Text style={styles.vestingBarLabelVested}>Vested: {vestedShares.toLocaleString()} shares</Text>
                          <Text style={styles.vestingBarLabelUnvested}>Locked: {unvestedShares.toLocaleString()} shares</Text>
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
                          Only your vested shares ({vestedShares.toLocaleString()}) will count toward dividend income scenarios. Unvested shares are locked until they vest.
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            ) : isAppreciationAsset ? (
              <View style={styles.thesisSection}>
                <View style={styles.thesisSectionHeader}>
                  <Text style={styles.sectionTitle}>Investment Thesis</Text>
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
                        <Text style={styles.invalidatorsTitle}>Exit Triggers</Text>
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

                    {thesis.targetPrice && thesis.entryPrice && currentPrice > 0 && (
                      <View style={styles.profitLossSection}>
                        <Text style={styles.sectionTitle}>Profit/Loss Potential</Text>
                        {(() => {
                          const qty = quantity || 1;
                          const entryPrice = thesis.entryPrice;
                          const targetPrice = thesis.targetPrice;
                          const currentValue = asset.value;
                          const entryValue = entryPrice * qty;
                          const targetValue = targetPrice * qty;
                          const potentialProfit = targetValue - currentValue;
                          const profitPercent = ((targetPrice / currentPrice) - 1) * 100;

                          const slInvalidators = thesis.invalidators.filter(inv => inv.type === 'price_drop' && inv.triggerPrice);
                          const sl = slInvalidators.length > 0 ? Math.min(...slInvalidators.map(inv => inv.triggerPrice!)) : null;
                          const slValue = sl ? sl * qty : null;
                          const potentialLoss = slValue ? currentValue - slValue : null;
                          const lossPercent = sl ? ((currentPrice / sl) - 1) * 100 : null;
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
                                  <Text style={styles.plCardTitle}>If Target Hit</Text>
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

                              {sl && potentialLoss && (
                                <View style={[styles.plCard, styles.lossCard]}>
                                  <View style={styles.plCardHeader}>
                                    <Text style={styles.plCardTitle}>If Stop-Loss Hit</Text>
                                    <Text style={styles.plStopPrice}>${sl.toFixed(4)}</Text>
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
                                    {riskReward >= 3 ? 'Excellent trade setup' : riskReward >= 2 ? 'Good risk/reward' : riskReward >= 1 ? 'Acceptable ratio' : 'Poor risk/reward'}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.decisionCard}>
                                <Text style={styles.decisionTitle}>What To Do</Text>
                                <Text style={styles.decisionText}>
                                  {currentPrice >= targetPrice
                                    ? 'TARGET HIT! Consider selling to lock in profits'
                                    : sl && currentPrice <= sl
                                      ? 'STOP-LOSS HIT! Exit to prevent further losses'
                                      : `HOLD - ${((currentPrice / targetPrice) * 100).toFixed(0)}% to target`
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
                        <Text style={styles.reviewButtonText}>Mark Reviewed</Text>
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
          </>
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

  // ════════════════════════════════════════════════════════════════
  // CRYPTO HERO
  // ════════════════════════════════════════════════════════════════
  heroSection: {
    backgroundColor: '#1a1f2e', borderRadius: 16, padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  heroLogo: { width: 64, height: 64, borderRadius: 32 },
  heroLogoPlaceholder: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#2a2f3e',
    justifyContent: 'center', alignItems: 'center',
  },
  heroLogoText: { fontSize: 28, fontWeight: 'bold', color: '#4ade80' },
  heroName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  heroSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  symbolBadge: {
    backgroundColor: '#2a2f3e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  symbolBadgeText: { fontSize: 12, fontWeight: '700', color: '#60a5fa' },
  heroProtocol: { fontSize: 13, color: '#60a5fa' },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  heroPrice: { fontSize: 32, fontWeight: '800', color: '#fff' },

  changePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  changePillGreen: { backgroundColor: '#4ade8020' },
  changePillRed: { backgroundColor: '#ef444420' },
  changePillText: { fontSize: 14, fontWeight: '700' },
  changeTextGreen: { color: '#4ade80' },
  changeTextRed: { color: '#ef4444' },

  heroValue: { fontSize: 16, color: '#4ade80', fontWeight: '600', marginBottom: 2 },
  heroQuantity: { fontSize: 14, color: '#888', marginBottom: 12 },

  chartContainer: { marginVertical: 12, alignItems: 'center' },

  quickStats: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 12 },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  quickStatValue: { fontSize: 14, fontWeight: '700', color: '#fff' },

  heroIncomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  // ════════════════════════════════════════════════════════════════
  // KEY LEVELS
  // ════════════════════════════════════════════════════════════════
  keyLevelsSection: { marginBottom: 24 },

  priceBar: { height: 24, marginVertical: 12, position: 'relative' },
  priceBarTrack: {
    position: 'absolute', top: 10, left: 0, right: 0, height: 4,
    backgroundColor: '#2a2f3e', borderRadius: 2,
  },
  priceBarFill: {
    position: 'absolute', height: '100%', backgroundColor: '#60a5fa40', borderRadius: 2,
  },
  priceBarMarker: { position: 'absolute', top: 4 },
  markerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#0a0e1a', marginLeft: -7 },

  levelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12, minWidth: '46%',
    borderWidth: 1, borderColor: '#2a2f3e', flex: 1,
  },
  levelChipEntry: { borderColor: '#60a5fa40' },
  levelChipCurrent: { borderColor: '#ffffff20' },
  levelChipTarget: { borderColor: '#4ade8040' },
  levelChipStopLoss: { borderColor: '#ef444440' },
  levelChipAdd: { borderStyle: 'dashed', borderColor: '#ef444440', justifyContent: 'center', alignItems: 'center' },
  levelChipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelChipLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  levelChipValue: { fontSize: 16, fontWeight: '700', color: '#fff' },
  levelChipChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  levelChipInput: {
    fontSize: 16, fontWeight: '700', color: '#fff', borderBottomWidth: 1,
    borderBottomColor: '#60a5fa', paddingVertical: 2, minWidth: 60,
  },
  removeX: { fontSize: 14, color: '#ef4444', fontWeight: '700', padding: 2 },
  addStopLossText: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

  // ════════════════════════════════════════════════════════════════
  // PROJECT INFO
  // ════════════════════════════════════════════════════════════════
  projectInfoSection: {
    backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  projectDescription: { fontSize: 14, color: '#b0b0b8', lineHeight: 22, marginTop: 8 },
  readMore: { fontSize: 13, color: '#60a5fa', fontWeight: '600', marginTop: 4 },
  socialLinks: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  socialBtn: {
    backgroundColor: '#2a2f3e', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
  },
  socialBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // ════════════════════════════════════════════════════════════════
  // ORIGINAL NON-CRYPTO STYLES
  // ════════════════════════════════════════════════════════════════
  assetCard: {
    backgroundColor: '#1a1f2e', borderRadius: 16, padding: 24, marginBottom: 24,
    borderWidth: 2, borderColor: '#4ade80',
  },
  assetCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
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
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
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
  profitLossSection: { marginTop: 16, marginBottom: 24 },
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
