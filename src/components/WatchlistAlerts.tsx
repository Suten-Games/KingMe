// src/components/WatchlistAlerts.tsx
// Shows actionable watchlist alerts on the home dashboard.
// These are tokens you're watching to buy — alerts surface entry opportunities
// and warn when tokens are running hot (wait for pullback).
// Also auto-adds held coins to watchlist for tracking.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWatchlist, getTokenPriceData, addToWatchlist, fetchPrices } from '../services/priceTracker';
import type { WatchlistToken, TokenPriceData } from '../services/priceTracker';
import { useStore } from '../store/useStore';

const WATCHLIST_EXT_KEY = 'watchlist_extended';
const DISMISSED_KEY = '@kingme:watchlist_alerts_dismissed';

interface WatchlistExt {
  mint: string;
  addedPrice: number;
  entryTarget1: number;
  entryTarget2: number;
  maxAllocationPct: number;
  takeProfitPct: number;
  stopLossPct: number;
  notes: string;
}

interface WatchlistAlert {
  id: string;
  mint: string;
  symbol: string;
  emoji: string;
  title: string;
  message: string;
  color: string;
}

const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'PYUSD', 'USD*', 'USDS', 'DAI']);

export default function WatchlistAlerts() {
  const router = useRouter();
  const assets = useStore(s => s.assets);
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Auto-add held coins to watchlist
  const autoTrackHeldCoins = useCallback(async (currentWatchlist: WatchlistToken[]) => {
    const watchedMints = new Set(currentWatchlist.map(t => t.mint));
    const cryptoAssets = assets.filter(a =>
      (a.type === 'crypto' || (a.type as string) === 'commodities' || a.type === 'defi') && a.value > 0.5
    );

    let added = 0;
    for (const asset of cryptoAssets) {
      const meta = asset.metadata as any;
      const mint = meta?.tokenMint || meta?.mint || '';
      const symbol = meta?.symbol || asset.name || '';
      if (!mint || mint.length < 10 || watchedMints.has(mint)) continue;
      if (STABLECOIN_SYMBOLS.has(symbol.toUpperCase())) continue;

      await addToWatchlist(mint, symbol);
      const prices = await fetchPrices([mint]);
      const currentPrice = prices[mint] || (meta?.priceUSD || 0);
      if (currentPrice > 0) {
        const extRaw2 = await AsyncStorage.getItem(WATCHLIST_EXT_KEY);
        const ext2: Record<string, WatchlistExt> = extRaw2 ? JSON.parse(extRaw2) : {};
        if (!ext2[mint]) {
          ext2[mint] = {
            mint,
            addedPrice: currentPrice,
            entryTarget1: currentPrice * 0.8,
            entryTarget2: currentPrice * 0.6,
            maxAllocationPct: 5,
            takeProfitPct: 100,
            stopLossPct: -25,
            notes: '',
          };
          await AsyncStorage.setItem(WATCHLIST_EXT_KEY, JSON.stringify(ext2));
        }
      }
      added++;
    }
    return added;
  }, [assets]);

  const load = useCallback(async () => {
    try {
      const dismissedRaw = await AsyncStorage.getItem(DISMISSED_KEY);
      const dismissedSet = new Set<string>(dismissedRaw ? JSON.parse(dismissedRaw) : []);
      setDismissed(dismissedSet);

      let watchlist = await getWatchlist();

      // Auto-add held coins
      const addedCount = await autoTrackHeldCoins(watchlist);
      if (addedCount > 0) watchlist = await getWatchlist();

      if (watchlist.length === 0) return;

      const extRaw = await AsyncStorage.getItem(WATCHLIST_EXT_KEY);
      const extData: Record<string, WatchlistExt> = extRaw ? JSON.parse(extRaw) : {};

      const symbolMap: Record<string, string> = {};
      for (const t of watchlist) symbolMap[t.mint] = t.symbol;
      const priceData = await getTokenPriceData(
        watchlist.map(t => t.mint),
        symbolMap,
      );

      const newAlerts: WatchlistAlert[] = [];
      for (const token of watchlist) {
        const ext = extData[token.mint];
        const price = priceData[token.mint];
        if (!ext || !price) continue;

        const currentPrice = price.currentPrice;
        if (!currentPrice || ext.addedPrice <= 0) continue;

        const changePct = ((currentPrice - ext.addedPrice) / ext.addedPrice) * 100;

        if (changePct <= -40) {
          newAlerts.push({
            id: `dv_${token.mint}`,
            mint: token.mint, symbol: token.symbol,
            emoji: '🔥',
            title: `${token.symbol} deep value — down ${Math.abs(changePct).toFixed(0)}%`,
            message: `Below your second entry target. Could be a strong buy.`,
            color: '#f87171',
          });
        } else if (changePct <= -20) {
          newAlerts.push({
            id: `se_${token.mint}`,
            mint: token.mint, symbol: token.symbol,
            emoji: '🟢',
            title: `${token.symbol} looks like a buy (${changePct.toFixed(0)}%)`,
            message: `Hit your first entry target. Good zone to start a position.`,
            color: '#4ade80',
          });
        } else if (changePct >= 50) {
          newAlerts.push({
            id: `rh_${token.mint}`,
            mint: token.mint, symbol: token.symbol,
            emoji: '🔴',
            title: `${token.symbol} running hot (+${changePct.toFixed(0)}%)`,
            message: `Way above your add price. Wait for a pullback before buying.`,
            color: '#f87171',
          });
        } else if (changePct >= 25) {
          newAlerts.push({
            id: `sm_${token.mint}`,
            mint: token.mint, symbol: token.symbol,
            emoji: '🚀',
            title: `${token.symbol} up ${changePct.toFixed(0)}% — momentum building`,
            message: `Strong move since you added it. Worth keeping an eye on.`,
            color: '#f4c430',
          });
        }
      }

      setAlerts(newAlerts);
    } catch (err) {
      console.warn('[WATCHLIST-ALERTS]', err);
    }
  }, [autoTrackHeldCoins]);

  useEffect(() => { load(); }, [load]);

  const handleDismiss = async (alertId: string) => {
    const next = new Set(dismissed);
    next.add(alertId);
    setDismissed(next);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  };

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => router.push('/watchlist' as any)} activeOpacity={0.7}>
        <Text style={s.header}>Watchlist Alerts</Text>
      </TouchableOpacity>
      {visible.map(alert => (
        <TouchableOpacity
          key={alert.id}
          style={[s.card, { borderLeftColor: alert.color }]}
          onPress={() => router.push('/watchlist' as any)}
          activeOpacity={0.8}
        >
          <View style={s.cardRow}>
            <Text style={s.emoji}>{alert.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{alert.title}</Text>
              <Text style={s.message}>{alert.message}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDismiss(alert.id)} hitSlop={12}>
              <Text style={s.dismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { fontSize: 14, fontWeight: '700', color: '#f4c430', marginBottom: 8, paddingHorizontal: 4 },
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji: { fontSize: 20, marginTop: 2 },
  title: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  message: { fontSize: 12, color: '#888', lineHeight: 16 },
  dismiss: { fontSize: 16, color: '#555', padding: 4 },
});
