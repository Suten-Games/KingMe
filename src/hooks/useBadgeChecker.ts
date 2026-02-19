// src/hooks/useBadgeChecker.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Hook that evaluates badges on state changes and awards new ones
// Drop this into _layout.tsx or home screen to enable badge tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { evaluateBadges, getISODate, getISOWeek } from '../services/badgeEngine';
import { calculateFreedom } from '../utils/calculations';

export function useBadgeChecker() {
  const wallets = useStore(s => s.wallets);
  const bankAccounts = useStore(s => s.bankAccounts);
  const income = useStore(s => s.income);
  const assets = useStore(s => s.assets);
  const obligations = useStore(s => s.obligations);
  const debts = useStore(s => s.debts);
  const bankTransactions = useStore(s => s.bankTransactions || []);
  const earnedBadges = useStore(s => s.earnedBadges || []);
  const trimCount = useStore(s => s.trimCount || 0);
  const importWeeks = useStore(s => s.importWeeks || []);
  const appOpenDays = useStore(s => s.appOpenDays || []);
  const awardBadge = useStore(s => s.awardBadge);
  const recordAppOpen = useStore(s => s.recordAppOpen);

  const lastCheck = useRef(0);

  // Record daily app open
  useEffect(() => {
    recordAppOpen();
  }, []);

  // Run badge evaluation when state changes (throttled to every 5 seconds)
  useEffect(() => {
    const now = Date.now();
    if (now - lastCheck.current < 5000) return;
    lastCheck.current = now;

    // Calculate freedom score
    const assetIncome = assets.reduce((sum, a) => sum + (a.annualIncome || 0), 0);
    const totalIncome = (income.salary || 0) + (income.otherIncome || 0) + assetIncome;
    const monthlyIncome = totalIncome / 12;
    const monthlyObligations = obligations.reduce((sum, o) => sum + o.amount, 0)
      + debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const dailyNeeds = monthlyObligations / 30;
    const dailyAssetIncome = assetIncome / 365;
    const freedomDays = dailyNeeds > 0
      ? dailyAssetIncome >= dailyNeeds
        ? Infinity
        : Math.floor(totalAssets / (dailyNeeds - dailyAssetIncome))
      : totalAssets > 0 ? Infinity : 0;
    const isKinged = dailyAssetIncome >= dailyNeeds && dailyNeeds > 0;

    const result = evaluateBadges({
      wallets,
      bankAccounts,
      income,
      assets,
      obligations,
      debts,
      bankTransactions,
      earnedBadges,
      trimCount,
      importWeeks,
      appOpenDays,
      freedomDays: freedomDays === Infinity ? 99999 : freedomDays,
      isKinged,
    });

    // Award any new badges
    for (const badgeId of result.newBadges) {
      console.log(`🏅 Badge earned: ${badgeId}`);
      awardBadge(badgeId);
    }
  }, [
    wallets, bankAccounts, income, assets, obligations, debts,
    bankTransactions, trimCount, importWeeks, appOpenDays,
  ]);
}
