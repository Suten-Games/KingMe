// src/components/PositionAlertCards.tsx
// Displays smart position alerts on the home screen with action buttons
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import type { Asset, CryptoAsset } from '../types';
import { recordPriceSnapshot, getTokenPriceData, TokenPriceData } from '../services/priceTracker';
import { getSwapQuote, executeSwap, isSwapConfigured, getSwapDiagnostics, fetchMintDecimals } from '../services/jupiterSwap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePositionAlerts, getAlertColor, PositionAlert, AccPlanContext } from '@/services/positionAlerts';
import { loadAllPlans, computePlanStats } from '@/services/accumulationPlan';
import { useSwapToast } from './SwapToast';
import { postSwapUpdate } from '@/utils/postSwapUpdate';
import { playAlertSound } from '@/services/alertSound';
import ConfirmModal from './ConfirmModal';
import { log, warn, error as logError } from '../utils/logger';

// Platform-safe alert for errors
function xAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

const DISMISSED_KEY = 'dismissed_position_alerts';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function PositionAlertCards() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const { publicKey, signTransaction, signAndSendTransaction, connected } = useWallet();
  const [alerts, setAlerts] = useState<PositionAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [pendingSwap, setPendingSwap] = useState<{
    alert: PositionAlert;
    asset: Asset;
    fromMint: string;
    toMint: string;
    fromSymbol: string;
    percentage: number;
    dollarValue: number;
  } | null>(null);
  const { showToast, ToastComponent } = useSwapToast();

  // Get crypto assets with their mints
  const cryptoMints = React.useMemo(() => {
    const mintMap: Record<string, string> = {};
    assets
      .filter(a => a.type === 'crypto' && a.value >= 50)
      .forEach(a => {
        const meta = a.metadata as CryptoAsset;
        const mint = meta.tokenMint || meta.mint;
        const symbol = meta.symbol || a.name;
        if (mint) mintMap[mint] = symbol;
      });
    return mintMap;
  }, [assets]);

  // Build mint → wallet balance lookup for all crypto assets
  const mintToBalance = React.useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach(a => {
      const meta = a.metadata as CryptoAsset;
      const mint = meta?.tokenMint || meta?.mint;
      const bal = meta?.quantity ?? meta?.balance;
      if (mint && bal !== undefined) map[mint] = bal;
    });
    return map;
  }, [assets]);

  // Load dismissed alerts
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        // Clean up old dismissals (>24h old)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const fresh = Object.entries(parsed)
          .filter(([_, ts]) => (ts as number) > cutoff)
          .reduce((acc, [key, ts]) => ({ ...acc, [key]: ts }), {});
        setDismissed(new Set(Object.keys(fresh)));
        AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(fresh));
      }
    });
  }, []);

  // Fetch prices and generate alerts
  const refreshAlerts = useCallback(async () => {
    const mints = Object.keys(cryptoMints);
    if (mints.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // Load accumulation plans first so we can include their mints in price fetch
      let allPlans: Record<string, any> = {};
      try {
        allPlans = await loadAllPlans();
      } catch (err) {
        warn('[ALERTS] Failed to load accumulation plans:', err);
      }

      // Merge plan mints into the fetch so exited positions still get price data
      const allMintSymbols = { ...cryptoMints };
      for (const [mint, plan] of Object.entries(allPlans)) {
        if (!allMintSymbols[mint]) allMintSymbols[mint] = (plan as any).symbol;
      }
      const allMints = Object.keys(allMintSymbols);

      // Record snapshot (throttled internally to 30min)
      await recordPriceSnapshot(allMints, allMintSymbols);

      // Get price data with changes
      const priceData = await getTokenPriceData(allMints, allMintSymbols);

      // Log price changes for debugging
      for (const [mint, data] of Object.entries(priceData)) {
        const changes = [];
        if (data.change1h !== null) changes.push(`1h: ${data.change1h > 0 ? '+' : ''}${data.change1h.toFixed(1)}%`);
        if (data.change24h !== null) changes.push(`24h: ${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(1)}%`);
        if (data.change7d !== null) changes.push(`7d: ${data.change7d > 0 ? '+' : ''}${data.change7d.toFixed(1)}%`);
        if (changes.length > 0) {
          log(`📊 ${data.symbol}: $${data.currentPrice.toFixed(6)} (${changes.join(', ')})`);
        }
      }

      // Generate alerts with accumulation plan awareness
      let accPlans: AccPlanContext[] = [];
      const planMints = Object.keys(allPlans);
      if (planMints.length > 0) {
        accPlans = Object.entries(allPlans)
          .filter(([_, p]) => (p as any).entries.length > 0)
          .map(([mint, p]: [string, any]) => {
            const pd = priceData[mint];
            const stats = computePlanStats(p, pd?.currentPrice || 0, mintToBalance[mint]);
            return {
              mint,
              symbol: p.symbol,
              targetAmount: p.targetAmount,
              currentHolding: stats.currentHolding,
              avgEntry: stats.costBasis,
              progressPct: stats.progressPct,
              strategy: 'accumulate' as const,
            };
          });
      }

      // Pass kaminoRates for idle-capital yield suggestions
      const kaminoRates = (useStore.getState() as any).kaminoRates || {};
      const newAlerts = generatePositionAlerts(assets, priceData, accPlans, { kaminoRates });

      // ── TEST ALERT — remove after testing ──
      const bigTrout = assets.find(a => a.name?.toLowerCase().includes('trout'));
      if (bigTrout) {
        const meta = bigTrout.metadata as CryptoAsset;
        newAlerts.unshift({
          id: `test-pump-bigtrout-${Date.now()}`,
          assetId: bigTrout.id,
          assetName: bigTrout.name,
          symbol: meta.symbol || 'BigTrout',
          mint: meta.tokenMint || meta.mint || '',
          priority: 'high',
          action: 'take_profit',
          title: `BigTrout up +58% today`,
          message: `Strong pump. Lock in gains before a pullback.`,
          detail: `Your $${bigTrout.value.toFixed(0)} position is running. Take some off the table.`,
          emoji: '💰',
          actionLabel: 'Trim 25%',
          actionParams: { type: 'swap', fromMint: meta.tokenMint || meta.mint, fromSymbol: meta.symbol || 'BigTrout', percentage: 25 },
          value: bigTrout.value,
          change: 58,
          timestamp: Date.now(),
        });
      }
      // ── END TEST ──

      log(`🔔 Generated ${newAlerts.length} position alerts`);

      // Play alert sound for new urgent/high alerts that aren't dismissed
      const undismissedHigh = newAlerts.filter(a => {
        const baseId = a.id.replace(/-\d+$/, '');
        return (a.priority === 'urgent' || a.priority === 'high') && !dismissed.has(baseId);
      });
      if (undismissedHigh.length > 0) {
        const hasUrgent = undismissedHigh.some(a => a.priority === 'urgent');
        playAlertSound(hasUrgent ? 'urgent' : 'high');
      }

      setAlerts(newAlerts);
      setLastRefresh(Date.now());
    } catch (error) {
      logError('Failed to refresh position alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [assets, cryptoMints]);

  // Clear stale alerts immediately when assets change (e.g. persona switch),
  // then re-fetch fresh data
  useEffect(() => {
    setAlerts([]);
    setDismissed(new Set());
    refreshAlerts();
    const interval = setInterval(refreshAlerts, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  // Dismiss an alert
  const handleDismiss = useCallback(async (alertId: string) => {
    const baseId = alertId.replace(/-\d+$/, ''); // Strip timestamp for pattern matching
    const newDismissed = new Set(dismissed);
    newDismissed.add(baseId);
    setDismissed(newDismissed);

    // Persist
    const stored = await AsyncStorage.getItem(DISMISSED_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[baseId] = Date.now();
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(parsed));
  }, [dismissed]);

  // Handle action button — replaces Alert.alert with styled toast
  const handleAction = useCallback((alert: PositionAlert) => {
    if (alert.actionParams?.type === 'swap') {
      const { fromMint, fromSymbol, percentage } = alert.actionParams;
      const toMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
      const dollarValue = Math.round(alert.value * (percentage / 100));

      // Pre-flight checks — still use Alert for errors (not part of the flow)
      if (!isSwapConfigured()) {
        const diag = getSwapDiagnostics();
        xAlert('Swap Not Available', `The swap service isn't configured in this build.\n\nAPI URL: ${diag.apiUrl}\n\nSet EXPO_PUBLIC_API_URL in EAS env vars and rebuild.`);
        return;
      }
      if (!connected || !publicKey) {
        xAlert('Connect Wallet', 'Connect your wallet first to execute swaps.');
        return;
      }

      const asset = assets.find(a => {
        const meta = a.metadata as CryptoAsset;
        return meta?.tokenMint === fromMint || meta?.mint === fromMint;
      });
      if (!asset) {
        xAlert('Error', 'Could not find asset');
        return;
      }

      // Show styled confirm modal
      setPendingSwap({ alert, asset, fromMint, toMint, fromSymbol, percentage, dollarValue });
    } else if (alert.actionParams?.type === 'kamino_deposit') {
      // Navigate to asset detail page where KaminoLendCard lives
      router.push(`/asset/${alert.assetId}` as any);
    } else if (alert.actionParams?.type === 'deposit') {
      router.push('/(tabs)/desires');
    } else {
      router.push(`/asset/${alert.assetId}`);
    }
  }, [router, assets, connected, publicKey, signTransaction, handleDismiss, showToast]);

  const confirmSwap = useCallback(async () => {
    if (!pendingSwap || !publicKey) return;
    const { alert, asset, fromMint, toMint, fromSymbol, percentage, dollarValue } = pendingSwap;
    setPendingSwap(null);

    const meta = asset.metadata as CryptoAsset;
    const quantity = (meta?.quantity || meta?.balance || 0) * (percentage / 100);
    const decimals = (meta as any)?.decimals ?? await fetchMintDecimals(fromMint);

    log(`[SWAP] ${fromSymbol}: ${quantity} tokens, decimals=${decimals}, mint=${fromMint}`);
    showToast({ type: 'loading', symbol: fromSymbol, percentage });

    try {
      const result = await executeSwap(
        {
          inputMint: fromMint,
          outputMint: toMint,
          amount: quantity,
          userPublicKey: publicKey.toBase58(),
          inputDecimals: decimals,
        },
        signTransaction,
        signAndSendTransaction,
      );

      if (result.success) {
        const pricePerToken = quantity > 0 ? dollarValue / quantity : 0;
        await postSwapUpdate({
          fromMint, fromSymbol,
          tokenAmountSold: quantity,
          pricePerToken,
          usdReceived: dollarValue,
          signature: result.signature || '',
        });
        showToast({ type: 'success', symbol: fromSymbol, usdReceived: dollarValue, signature: result.signature || '' });
        handleDismiss(alert.id);
      } else if (result.error !== 'Transaction cancelled by user') {
        showToast({ type: 'error', message: result.error || 'Something went wrong' });
      } else {
        showToast({ type: 'error', message: 'Transaction cancelled.' });
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    }
  }, [pendingSwap, publicKey, signTransaction, showToast, handleDismiss]);

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(a => {
    const baseId = a.id.replace(/-\d+$/, '');
    return !dismissed.has(baseId);
  });

  if (loading && visibleAlerts.length === 0) {
    return null;
  }

  if (visibleAlerts.length === 0 && !pendingSwap) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>⚡ Position Alerts</Text>
        <Text style={s.headerCount}>{visibleAlerts.length}</Text>
      </View>

      {visibleAlerts.slice(0, 4).map((alert) => {
        const color = getAlertColor(alert.priority);

        return (
          <LinearGradient
            key={alert.id}
            colors={[color.bg, '#0a0e1a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.card, { borderColor: color.border }]}
          >
            {/* Priority badge */}
            {alert.priority === 'urgent' && (
              <View style={s.urgentBadge}>
                <Text style={s.urgentText}>URGENT</Text>
              </View>
            )}

            <View style={s.cardTop}>
              <Text style={s.emoji}>{alert.emoji}</Text>
              <View style={s.cardContent}>
                <Text style={[s.title, { color: color.text }]}>{alert.title}</Text>
                <Text style={s.message}>{alert.message}</Text>
                <Text style={s.detail}>{alert.detail}</Text>
              </View>
            </View>

            <View style={s.cardActions}>
              <TouchableOpacity
                style={[s.actionButton, { backgroundColor: color.border.replace('80', '') }]}
                onPress={() => handleAction(alert)}
                activeOpacity={0.7}
              >
                <Text style={s.actionText}>{alert.actionLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.dismissButton}
                onPress={() => handleDismiss(alert.id)}
                activeOpacity={0.7}
              >
                <Text style={s.dismissText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.detailButton}
                onPress={() => router.push(`/asset/${alert.assetId}`)}
                activeOpacity={0.7}
              >
                <Text style={s.detailText}>View →</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        );
      })}

      {visibleAlerts.length > 4 && (
        <TouchableOpacity style={s.moreButton}>
          <Text style={s.moreText}>+{visibleAlerts.length - 4} more alerts</Text>
        </TouchableOpacity>
      )}

      {/* Toast renders here, floats above everything */}
      <ToastComponent />

      <ConfirmModal
        visible={!!pendingSwap}
        title={pendingSwap ? `Trim ${pendingSwap.fromSymbol}` : ''}
        message={pendingSwap ? `Swap ${pendingSwap.percentage}% (~$${pendingSwap.dollarValue}) of ${pendingSwap.fromSymbol} → USDC?` : ''}
        confirmLabel="Swap"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={confirmSwap}
        onCancel={() => setPendingSwap(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#e8e0d0',
  },
  headerCount: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#f4c430',
    backgroundColor: '#f4c43020',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  urgentBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    backgroundColor: '#ff4444',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  urgentText: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    color: '#fff',
    letterSpacing: 1,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 28,
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#c0b890',
    marginBottom: 4,
    lineHeight: 18,
  },
  detail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#888',
    lineHeight: 16,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  dismissText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#666',
  },
  detailButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 'auto',
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#f4c430',
  },

  moreButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#60a5fa',
  },
});
