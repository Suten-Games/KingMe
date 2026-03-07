// src/components/AccumulationAlerts.tsx
// Shows compact accumulation signals on the home screen.
// Reloads automatically when a swap completes (via SwapEvents bus).

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  loadAllPlans, computePlanStats, generateAccSignals,
  type AccumulationPlan, type AccSignal,
} from '@/services/accumulationPlan';
import { getTokenPriceData } from '../services/priceTracker';
import AccumulationPlanCard from './AccumulationPlanCard';
import TargetIcon from './icons/TargetIcon';
import { SwapEvents } from '@/utils/swapEvents';
import { useStore } from '@/store/useStore';
import type { CryptoAsset } from '@/types';
import { log, warn, error } from '../utils/logger';

export default function AccumulationAlerts() {
  const assets = useStore(s => s.assets);

  const [planAlerts, setPlanAlerts] = useState<Array<{
    plan: AccumulationPlan;
    signals: AccSignal[];
    price: number;
    atl: number | null;
    assetId?: string;
    walletBalance?: number;
  }>>([]); 

  // Build mint → assetId and mint → wallet balance lookups from the store
  const { mintToAssetId, mintToBalance } = React.useMemo(() => {
    const mintToAssetId: Record<string, string> = {};
    const mintToBalance: Record<string, number> = {};
    assets.forEach(a => {
      const meta = a.metadata as CryptoAsset;
      const mint = meta?.tokenMint || meta?.mint;
      if (mint) {
        mintToAssetId[mint] = a.id;
        const bal = meta?.quantity ?? meta?.balance;
        if (bal !== undefined) mintToBalance[mint] = bal;
      }
    });
    return { mintToAssetId, mintToBalance };
  }, [assets]);

  const load = useCallback(async () => {
    try {
      const plans = await loadAllPlans();
      const mints = Object.keys(plans);
      if (mints.length === 0) {
        setPlanAlerts([]);
        return;
      }

      const symbolMap: Record<string, string> = {};
      mints.forEach(m => { symbolMap[m] = plans[m].symbol; });

      const priceData = await getTokenPriceData(mints, symbolMap);
      const results: typeof planAlerts = [];

      for (const mint of mints) {
        const plan = plans[mint];
        if (plan.entries.length === 0) continue;

        const pd = priceData[mint];
        const price = pd?.currentPrice || 0;
        if (price <= 0) continue;

        const stats = computePlanStats(plan, price, mintToBalance[mint]);
        const signals = generateAccSignals(plan, stats, price, null);
        if (signals.length > 0) {
          results.push({
            plan,
            signals,
            price,
            atl: null,
            assetId: mintToAssetId[mint],
            walletBalance: mintToBalance[mint],
          });
        }
      }

      setPlanAlerts(results);
    } catch (err) {
      error('[ACC_ALERTS] Error:', err);
    }
  }, [mintToAssetId]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Re-load whenever a swap completes
  useEffect(() => {
    const unsubscribe = SwapEvents.on((payload) => {
      log(`[ACC_ALERTS] Swap detected for ${payload.symbol}, reloading signals…`);
      load();
    });
    return () => { unsubscribe(); };
  }, [load]);

  if (planAlerts.length === 0) return null;

  return (
    <View style={st.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TargetIcon size={18} color="#f4c430" />
        <Text style={[st.header, { marginBottom: 0 }]}>Accumulation Signals</Text>
      </View>
      {planAlerts.map(({ plan, price, atl, assetId, walletBalance }) => (
        <AccumulationPlanCard
          key={plan.mint}
          mint={plan.mint}
          symbol={plan.symbol}
          currentPrice={price}
          allTimeLow={atl}
          assetId={assetId}
          currentHolding={walletBalance}
          compact
        />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { fontSize: 16, fontWeight: '700', color: '#f4c430', marginBottom: 8 },
});
