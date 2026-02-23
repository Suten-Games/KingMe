// src/components/AccumulationAlerts.tsx
// Shows compact accumulation signals on the home screen
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  loadAllPlans, computePlanStats, generateAccSignals,
  type AccumulationPlan, type AccSignal,
} from '@/services/accumulationPlan';
import { getTokenPriceData } from '../services/priceTracker';
import AccumulationPlanCard from './AccumulationPlanCard';

export default function AccumulationAlerts() {
  const [planAlerts, setPlanAlerts] = useState<Array<{
    plan: AccumulationPlan;
    signals: AccSignal[];
    price: number;
    atl: number | null;
  }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const plans = await loadAllPlans();
        const mints = Object.keys(plans);
        if (mints.length === 0) return;

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

          const stats = computePlanStats(plan, price);
          const signals = generateAccSignals(plan, stats, price, null);
          if (signals.length > 0) {
            results.push({ plan, signals, price, atl: null });
          }
        }

        if (!cancelled) setPlanAlerts(results);
      } catch (err) {
        console.error('[ACC_ALERTS] Error:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (planAlerts.length === 0) return null;

  return (
    <View style={st.container}>
      <Text style={st.header}>🎯 Accumulation Signals</Text>
      {planAlerts.map(({ plan, price, atl }) => (
        <AccumulationPlanCard
          key={plan.mint}
          mint={plan.mint}
          symbol={plan.symbol}
          currentPrice={price}
          allTimeLow={atl}
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
