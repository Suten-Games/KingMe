// src/components/PositionAlertCards.tsx
// Displays smart position alerts on the home screen with action buttons
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import type { Asset, CryptoAsset } from '../types';
import { recordPriceSnapshot, getTokenPriceData, TokenPriceData } from '../services/priceTracker';
import { getSwapQuote, executeSwap } from '../services/jupiterSwap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePositionAlerts, generateCashTransferAlerts, generateImportReminders, getAlertColor, PositionAlert } from '../services/positionAlerts';

const DISMISSED_KEY = 'dismissed_position_alerts';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function PositionAlertCards() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const obligations = useStore((state) => state.obligations);
  const debts = useStore((state) => state.debts);
  const bankTransactions = useStore((state) => state.bankTransactions || []);
  const { publicKey, signTransaction, connected } = useWallet();
  const [alerts, setAlerts] = useState<PositionAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);

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
      // Record snapshot (throttled internally to 30min)
      await recordPriceSnapshot(mints, cryptoMints);

      // Get price data with changes
      const priceData = await getTokenPriceData(mints, cryptoMints);

      // Log price changes for debugging
      for (const [mint, data] of Object.entries(priceData)) {
        const changes = [];
        if (data.change1h !== null) changes.push(`1h: ${data.change1h > 0 ? '+' : ''}${data.change1h.toFixed(1)}%`);
        if (data.change24h !== null) changes.push(`24h: ${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(1)}%`);
        if (data.change7d !== null) changes.push(`7d: ${data.change7d > 0 ? '+' : ''}${data.change7d.toFixed(1)}%`);
        if (changes.length > 0) {
          console.log(`📊 ${data.symbol}: $${data.currentPrice.toFixed(6)} (${changes.join(', ')})`);
        }
      }

      // Generate position alerts
      const newAlerts = generatePositionAlerts(assets, priceData);

      // Generate cash transfer alerts
      const usdcBalance = assets
        .filter(a => {
          const meta = a.metadata as CryptoAsset;
          const mint = meta?.tokenMint || meta?.mint || '';
          return mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        })
        .reduce((sum, a) => sum + a.value, 0);

      const cashAlerts = generateCashTransferAlerts(
        bankAccounts, obligations, debts, usdcBalance
      );
      newAlerts.push(...cashAlerts);

      // Generate import reminder alerts
      const txDates = bankTransactions.map(t => ({ date: t.date, bankAccountId: t.bankAccountId }));
      const importAlerts = generateImportReminders(bankAccounts, txDates);
      newAlerts.push(...importAlerts);

      // Re-sort all alerts by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      newAlerts.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

      console.log(`🔔 Generated ${newAlerts.length} alerts (${cashAlerts.length} cash transfer)`);
      setAlerts(newAlerts);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Failed to refresh position alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [assets, cryptoMints, bankAccounts, obligations, debts, bankTransactions]);

  // Initial load + periodic refresh
  useEffect(() => {
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

  // Handle action button
  const handleAction = useCallback(async (alert: PositionAlert) => {
    if (alert.actionParams?.type === 'swap') {
      console.log('🔴 TRIM CLICKED', alert.actionParams);
      const { fromMint, fromSymbol, percentage } = alert.actionParams;
      const toSymbol = 'USDC';
      const dollarValue = Math.round(alert.value * (percentage / 100));

      const asset = assets.find(a => {
        const meta = a.metadata as CryptoAsset;
        return meta?.tokenMint === fromMint || meta?.mint === fromMint;
      });

      // Cross-platform confirm
      const confirmed = Platform.OS === 'web'
        ? window.confirm(`Swap ${percentage}% (~$${dollarValue}) of ${fromSymbol} → ${toSymbol}?`)
        : await new Promise<boolean>(resolve => {
            Alert.alert(
              `Trim ${fromSymbol}`,
              `Swap ${percentage}% (~$${dollarValue}) of ${fromSymbol} → ${toSymbol}?`,
              [
                { text: 'Cancel', onPress: () => resolve(false) },
                { text: `Swap to ${toSymbol}`, onPress: () => resolve(true) },
              ]
            );
          });

      if (!confirmed) return;

      if (!connected || !publicKey) {
        Alert.alert('Connect Wallet', 'Connect your wallet first to execute swaps.');
        return;
      }
      if (!asset) {
        Alert.alert('Error', 'Could not find asset');
        return;
      }

      const meta = asset.metadata as CryptoAsset;
      const quantity = (meta?.quantity || meta?.balance || 0) * (percentage / 100);
      const decimals = (meta as any)?.decimals || 9;
      const lamports = Math.floor(quantity * Math.pow(10, decimals));
      const toMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

      try {
        console.log(`🔄 Executing swap: ${quantity} ${fromSymbol} → ${toSymbol}`);
        const result = await executeSwap(
          {
            inputMint: fromMint, outputMint: toMint, amount: lamports, userPublicKey: publicKey.toBase58(),
            inputDecimals: 0
          },
          signTransaction
        );

        if (result.success) {
          Alert.alert('Swap Complete! 🎉', `Swapped ${fromSymbol} → ${toSymbol}\n\nTx: ${result.signature?.slice(0, 12)}...`);
          handleDismiss(alert.id);
        } else if (result.error !== 'Transaction cancelled by user') {
          Alert.alert('Swap Failed', result.error || 'Something went wrong');
        }
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    } else if (alert.actionParams?.type === 'fuse_transfer') {
      const { amount, toAccount, toInstitution } = alert.actionParams;
      const msg = `Transfer $${amount} USDC → ${toInstitution} (${toAccount})\n\nOpen Fuse to initiate the transfer. It takes ~1 business day to arrive.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Transfer via Fuse', msg, [{ text: 'OK' }]);
      }
    } else if (alert.actionParams?.type === 'navigate_bank') {
      router.push(`/bank/${alert.actionParams.bankAccountId}`);
    } else if (alert.actionParams?.type === 'deposit') {
      router.push('/(tabs)/desires');
    } else {
      router.push(`/asset/${alert.assetId}`);
    }
  }, [router, assets, connected, publicKey, signTransaction, handleDismiss]);

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(a => {
    const baseId = a.id.replace(/-\d+$/, '');
    return !dismissed.has(baseId);
  });

  if (loading && visibleAlerts.length === 0) {
    return null; // Don't show loading spinner, just hide until ready
  }

  if (visibleAlerts.length === 0) return null;

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
