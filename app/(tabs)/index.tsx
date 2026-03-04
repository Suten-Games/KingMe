// app/(tabs)/index.tsx
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Platform, Alert, Modal } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FreedomScore } from '../../src/components/FreedomScore';
import CashFlowSummary from '../../src/components/CashFlowSummary';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import WhatIfCard from '@/components/WhatIfCard';
import WhatIfModal from '@/components/WhatIfModal';
import { Asset, WhatIfScenario, CryptoAsset, RealEstateAsset, StockAsset, BusinessAsset } from '@/types';
import { generateSmartScenarios } from '@/utils/scenarioGenerator';
import ThesisAlerts from '@/components/ThesisAlerts';
import { useSwapScenario } from '@/hooks/useSwapScenario';
import { isOnChainScenario } from '@/services/jupiterSwap';
import TradingIncomeWarning from '../../src/components/TradingIncomeWarning';
import PositionAlertCards from '@/components/PositionAlertCards';
import BadgeStrip from '@/components/BadgeStrip';
import { FREEDOM_THRESHOLDS } from '@/utils/constants';
import SetupChecklist from '@/components/SetupChecklist';
import AccumulationAlerts from '@/components/AccumulationAlerts';
import GoalsStrip from '@/components/GoalsStrip';
import PortfolioTrendCard from '@/components/PortfolioTrendCard';
import WindfallAlertCard from '@/components/WindfallAlertCard';
import SpendingGapAlert from '../../src/components/SpendingGapAlert';
import TradeInsightCards from '@/components/TradeInsightCards';

// ── Next Level Helper ─────────────────────────────────────────────────────────
const FREEDOM_LEVELS = [
  { key: 'drowning',   label: 'Drowning',   emoji: '🌊', max: FREEDOM_THRESHOLDS.DROWNING },
  { key: 'struggling', label: 'Struggling',  emoji: '🏊', max: FREEDOM_THRESHOLDS.STRUGGLING },
  { key: 'breaking',   label: 'Breaking Free', emoji: '🔓', max: FREEDOM_THRESHOLDS.BREAKING },
  { key: 'rising',     label: 'Rising',      emoji: '🚀', max: FREEDOM_THRESHOLDS.RISING },
  { key: 'enthroned',  label: 'Enthroned',   emoji: '👑', max: Infinity },
] as const;

function getNextLevel(days: number) {
  for (let i = 0; i < FREEDOM_LEVELS.length; i++) {
    const level = FREEDOM_LEVELS[i];
    if (days < level.max) {
      const prevMax = i > 0 ? FREEDOM_LEVELS[i - 1].max : 0;
      const nextLevel = i < FREEDOM_LEVELS.length - 1 ? FREEDOM_LEVELS[i + 1] : null;
      const daysToNext = nextLevel ? level.max - days : 0;
      const progressInLevel = (days - prevMax) / (level.max - prevMax);
      return {
        current: level,
        next: nextLevel,
        daysToNext,
        progressInLevel: Math.min(1, Math.max(0, progressInLevel)),
        currentIndex: i,
      };
    }
  }
  // Already at top
  return {
    current: FREEDOM_LEVELS[FREEDOM_LEVELS.length - 1],
    next: null,
    daysToNext: 0,
    progressInLevel: 1,
    currentIndex: FREEDOM_LEVELS.length - 1,
  };
}

function formatDaysNice(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

const HEALTH_COLORS: Record<string, { bg: string[]; text: string; border: string }> = {
  critical:   { bg: ['#7a2020', '#3a0e0e', '#1a0808'], text: '#ff8a8a', border: '#ff6b6b80' },
  struggling: { bg: ['#7a4a1a', '#3a2210', '#1a1008'], text: '#ffb060', border: '#ffa04080' },
  stable:     { bg: ['#1a4a7a', '#102a4a', '#081828'], text: '#80c0ff', border: '#60a5fa80' },
  building:   { bg: ['#1a7a4a', '#0e3a22', '#081a10'], text: '#60ff9a', border: '#4ade8080' },
  thriving:   { bg: ['#4a7a1a', '#223a0e', '#101a08'], text: '#c0ff60', border: '#a3e63580' },
};

const HEALTH_EMOJI: Record<string, string> = {
  critical: '🔴', struggling: '🟠', stable: '🔵', building: '🟢', thriving: '🟡',
};

export default function HomeScreen() {
  const router = useRouter();
  const onboardingComplete = useStore((state) => state.onboardingComplete);
  const avatarType          = useStore((state) => state.settings.avatarType);
  const bankAccounts        = useStore((state) => state.bankAccounts);
  const incomeSources       = useStore((state) => state.income.sources || []);
  const obligations         = useStore((state) => state.obligations);
  const debts               = useStore((state) => state.debts);
  const assets              = useStore((state) => state.assets);
  const paycheckDeductions  = useStore((state) => state.paycheckDeductions || []);
  const monthlyDiscretionary = useStore((state) => state.monthlyDiscretionary || 0);
  const bankTransactions    = useStore((state) => state.bankTransactions || []);
  const customCategories    = useStore((state) => state.customCategories || {});
  const [selectedScenario, setSelectedScenario] = useState<WhatIfScenario | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [infoModal, setInfoModal] = useState<'freedom' | 'runway' | null>(null);
  const [infoDetails, setInfoDetails] = useState(false);
  const [includeHouse, setIncludeHouse] = useState(false);
  const [showCashFlow, setShowCashFlow] = useState(false);

  const scenarios = useStore(s => s.whatIfScenarios);
  const generateScenarios = useStore(s => s.generateScenarios);
  const applyScenario = useStore(s => s.applyScenario);
  const thesisAlerts = useStore(s => s.thesisAlerts);
  const dismissThesisAlert = useStore(s => s.dismissThesisAlert);
  const checkThesisAlerts = useStore(s => s.checkThesisAlerts);

  const windfallAlerts = useStore(s => (s as any).windfallAlerts || []);
  const dismissWindfallAlert = useStore(s => (s as any).dismissWindfallAlert);

  const { swapState, previewScenario, applyWithSwap, reset } = useSwapScenario();

  const freedom = useFreedomScore();
  const nextLevel = getNextLevel(freedom.days);

  const cashFlow = useMemo(
    () => analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions, monthlyDiscretionary, bankTransactions, customCategories),
    [bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions, monthlyDiscretionary, bankTransactions, customCategories]
  );

  const wallets = useStore((state) => state.wallets);


  const lastPriceRefresh = useStore(s => s.lastPriceRefresh);
  const refreshMarketPrices = useStore(s => s.refreshMarketPrices);

  useEffect(() => { checkThesisAlerts(); const i = setInterval(() => checkThesisAlerts(), 86400000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!onboardingComplete) { const t = setTimeout(() => router.replace('/onboarding/intro'), 500); return () => clearTimeout(t); } }, [onboardingComplete]);

  // Auto-refresh stock/crypto prices if stale (>5min) or never fetched
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const isStale = !lastPriceRefresh || (Date.now() - new Date(lastPriceRefresh).getTime() > STALE_MS);
    if (isStale) refreshMarketPrices().catch(console.error);
  }, []);

  if (!onboardingComplete) {
    return (<View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>);
  }

  useEffect(() => { generateScenarios(); }, []);

  //const handleViewScenario = (s: WhatIfScenario) => { setSelectedScenario(s); setShowModal(true); };
  const handleViewScenario = (s: WhatIfScenario) => {
    setSelectedScenario(s);
    setShowModal(true);
    previewScenario(s);  // Fetches Jupiter quote in background for on-chain scenarios
  };
  // const handleApplyScenario = async (s: WhatIfScenario) => {
  //   try { await applyScenario(s); setShowModal(false); Alert.alert('Scenario Applied! 🎉', 'Your assets have been updated.', [{ text: 'OK' }]); }
  //   catch { Alert.alert('Error', 'Failed to apply scenario'); }
  // };
  const handleApplyScenario = async (s: WhatIfScenario) => {
    // Drift scenarios: navigate to trading page to adjust balances manually
    if (s.type === 'drift_yield') {
      setShowModal(false);
      setSelectedScenario(null);
      reset();
      router.push('/protocol/Drift');
      return;
    }

    const success = await applyWithSwap(s);
    if (success) {
      const onChain = isOnChainScenario(s.type);
      if (!onChain) {
        setShowModal(false);
        reset();
        Alert.alert('Scenario Applied! 🎉', 'Your financial plan has been updated.', [{ text: 'OK' }]);
      }
      // On-chain: modal stays open showing success + tx signature
      // User taps "Done — Close" to dismiss
    }
  };

  const monthlySurplus = cashFlow.totalMonthlyNet;
  const monthlyOut = cashFlow.totalMonthlyOut;
  const runwayMonths = monthlyOut > 0 ? cashFlow.liquidAssets / monthlyOut : Infinity;
  const runwayLabel = runwayMonths === Infinity ? '∞' : runwayMonths >= 12 ? `${(runwayMonths / 12).toFixed(1)}y` : `${runwayMonths.toFixed(1)}m`;
  const healthColor = HEALTH_COLORS[cashFlow.healthStatus] || HEALTH_COLORS.stable;
  const insight = getInsight(cashFlow, freedom);
  const isWeb = Platform.OS === 'web';

  // ── Breakdown data for info modals ────────────────────────
  const breakdown = useMemo(() => {
    const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

    // Group assets by type
    let bankTotal = bankAccounts.reduce((s, a) => s + (typeof a.currentBalance === 'number' && !isNaN(a.currentBalance) ? a.currentBalance : 0), 0);
    let cryptoTotal = 0, defiTotal = 0, stockTotal = 0, realEstateTotal = 0, businessTotal = 0, retirementTotal = 0;
    let cryptoYield = 0, dividendYield = 0, rentalNet = 0, bizDistributions = 0, retirementAfterPenalty = 0;

    // Sum mortgage debts for real estate equity fallback
    const totalMortgageBalance = debts
      .filter(d => d.name.toLowerCase().includes('mortgage'))
      .reduce((sum, d) => sum + (d.balance ?? d.principal ?? 0), 0);

    for (const a of assets) {
      const val = a.value || 0;
      switch (a.type) {
        case 'crypto': {
          cryptoTotal += val;
          const m = a.metadata as CryptoAsset;
          if (m?.apy && m.apy > 0) cryptoYield += val * (m.apy / 100);
          break;
        }
        case 'defi': {
          defiTotal += val;
          const m = a.metadata as CryptoAsset;
          if (m?.apy && m.apy > 0) cryptoYield += val * (m.apy / 100);
          break;
        }
        case 'stocks': {
          stockTotal += val;
          const m = a.metadata as StockAsset;
          if (m?.dividendYield) dividendYield += val * (m.dividendYield / 100);
          break;
        }
        case 'real_estate': {
          const m = a.metadata as RealEstateAsset;
          const mortgage = (m?.mortgageBalance || 0) > 0 ? m!.mortgageBalance! : totalMortgageBalance;
          realEstateTotal += Math.max(0, val - mortgage);
          rentalNet += ((m?.monthlyRentalIncome || 0) - (m?.monthlyExpenses || 0)) * 12;
          break;
        }
        case 'business': {
          businessTotal += val;
          const m = a.metadata as BusinessAsset;
          bizDistributions += m?.annualDistributions || 0;
          break;
        }
        default:
          if ((a.metadata as any)?.type === 'retirement' || a.type === 'retirement') {
            retirementTotal += val;
            const acctType = (a.metadata as any)?.accountType || '';
            const isRoth = acctType.startsWith('roth');
            retirementAfterPenalty += val * (1 - (isRoth ? 0.10 : 0.35));
          }
          break;
      }
    }

    const totalPassiveIncome = cryptoYield + dividendYield + rentalNet + bizDistributions;
    const monthlyObligations = cashFlow.totalMonthlyObligations;
    const monthlyDebt = cashFlow.totalMonthlyDebtPayments;
    const annualExpenses = cashFlow.totalMonthlyOut * 12;

    // Runway: liquidAssets / monthlyOut (bank + all non-retirement assets)
    const runwayLiquid = cashFlow.liquidAssets;
    const runwayBurn = cashFlow.totalMonthlyOut;

    // Freedom: liquidAssets / (dailyNeeds - dailyAssetIncome)
    // Freedom liquid = crypto + defi + stocks + retirement (after penalty)
    const freedomLiquid = cryptoTotal + defiTotal + stockTotal + retirementAfterPenalty;
    const freedomDailyBurn = freedom.dailyNeeds - freedom.dailyAssetIncome;
    const freedomMonthlyBurn = freedomDailyBurn * 30;

    // "Sell the house" scenario: add equity, but add rent to burn
    // Estimate rent as ~0.7% of property value/mo (national avg rent-to-value ratio)
    // Remove existing housing obligations (mortgage payment) since you'd no longer pay that
    const estMonthlyRent = assets
      .filter(a => a.type === 'real_estate')
      .reduce((s, a) => s + Math.round((a.value || 0) * 0.005), 0); // 0.5% of value = downsized rental
    const currentHousingCost = obligations
      .filter(o => o.category === 'housing')
      .reduce((s, o) => s + o.amount, 0);
    const houseNetBurnChange = estMonthlyRent - currentHousingCost; // could be negative if mortgage > rent
    const houseFreedomLiquid = freedomLiquid + realEstateTotal;
    const houseFreedomBurn = freedomMonthlyBurn + houseNetBurnChange;
    const houseFreedomMonths = houseFreedomBurn > 0 ? houseFreedomLiquid / houseFreedomBurn : Infinity;
    const houseFreedomFormatted = houseFreedomMonths === Infinity ? 'Forever'
      : houseFreedomMonths >= 24 ? `${(houseFreedomMonths / 12).toFixed(1)}y`
      : houseFreedomMonths >= 2 ? `${Math.round(houseFreedomMonths)} months`
      : `${Math.round(houseFreedomMonths * 30)} days`;

    return {
      fmt, bankTotal, cryptoTotal, defiTotal, stockTotal, realEstateTotal,
      businessTotal, retirementTotal, retirementAfterPenalty, cryptoYield,
      dividendYield, rentalNet, bizDistributions, totalPassiveIncome,
      monthlyObligations, monthlyDebt, annualExpenses, runwayLiquid, runwayBurn,
      freedomLiquid, freedomDailyBurn, freedomMonthlyBurn,
      estMonthlyRent, currentHousingCost, houseNetBurnChange,
      houseFreedomLiquid, houseFreedomBurn, houseFreedomFormatted,
    };
  }, [assets, bankAccounts, cashFlow, freedom, obligations]);

  const dashboardBody = (
    <View style={styles.content}>
      <SetupChecklist />



      <PositionAlertCards  />
            {windfallAlerts
        .filter((a: any) => !a.dismissedAt)
        .map((alert: any) => (
          <WindfallAlertCard
            key={alert.id}
            alert={alert}
            onDismiss={dismissWindfallAlert}
          />
        ))
      }
      <AccumulationAlerts />
      

      <ThesisAlerts alerts={thesisAlerts} onDismiss={dismissThesisAlert} onReview={(id) => router.push(`/asset/${id}`)} />

      {/* ── Health Badge ──────────────────────────────────────────── */}
      <TouchableOpacity onPress={() => setShowCashFlow(!showCashFlow)}>
        <LinearGradient colors={healthColor.bg as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.healthBadge, { borderColor: healthColor.border }]}>
          <Text style={styles.healthEmoji}>{HEALTH_EMOJI[cashFlow.healthStatus]}</Text>
          <View style={styles.healthTextRow}>
            <Text style={[styles.healthLabel, { color: healthColor.text }]}>
              {cashFlow.healthStatus.charAt(0).toUpperCase() + cashFlow.healthStatus.slice(1)}
            </Text>
            <Text style={styles.healthMessage}>{cashFlow.healthMessage}</Text>
          </View>
          <Text style={{ color: '#888', fontSize: 12 }}>{showCashFlow ? '▲' : '▼'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {showCashFlow && (
        <CashFlowSummary cashFlow={cashFlow}>
          <SpendingGapAlert cashFlow={cashFlow} />
        </CashFlowSummary>
      )}

      {/* ── Metrics Grid ──────────────────────────────────────────── */}
      <View style={styles.metricsGrid}>
        <GradientMetricCard label="Freedom" value={freedom.formatted}
          sub={freedom.isKinged ? 'KINGED 👑' : nextLevel.next ? `${formatDaysNice(nextLevel.daysToNext)} to ${nextLevel.next.label}` : freedom.state} color="#f4c430"
          gradientColors={['#504010', '#2a2008', '#151005']}
          borderColor="#f4c43080" onInfo={() => setInfoModal('freedom')} />
        <GradientMetricCard label="Runway" value={runwayLabel}
          sub="of reserves" color="#60a5fa"
          gradientColors={['#1a3868', '#102040', '#081020']}
          borderColor="#60a5fa80" onInfo={() => setInfoModal('runway')} />
        <GradientMetricCard label="Monthly In"
          value={`$${cashFlow.totalMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="income" color="#4ade80"
          gradientColors={['#184830', '#0e2818', '#08180c']}
          borderColor="#4ade8080" />
        <GradientMetricCard
          label={monthlySurplus >= 0 ? 'Surplus' : 'Deficit'}
          value={`${monthlySurplus >= 0 ? '+' : ''}$${monthlySurplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="/month" color={monthlySurplus >= 0 ? '#4ade80' : '#f87171'}
          gradientColors={monthlySurplus >= 0 ? ['#184830', '#0e2818', '#08180c'] : ['#581818', '#300c0c', '#1a0606']}
          borderColor={monthlySurplus >= 0 ? '#4ade8080' : '#f8717180'} />
      </View>

      {/* ── Insight Card ──────────────────────────────────────────── */}
      <LinearGradient colors={['#222a48', '#161c34', '#0e1224']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.insightCard}>
        <View style={styles.insightEmojiContainer}>
          <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightBody}>{insight.body}</Text>
        </View>
      </LinearGradient>

      <PortfolioTrendCard />

      <TradingIncomeWarning />

      <TradeInsightCards />

      {/* ── Recommendations ───────────────────────────────────────── */}
      {cashFlow.recommendations.length > 0 && (
        <View style={styles.recsSection}>
          <Text style={styles.recsSectionTitle}>Next Steps</Text>
          {cashFlow.recommendations.slice(0, 2).map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <LinearGradient colors={['#f4c430', '#e0a010']} style={styles.recDot} />
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Scenarios ─────────────────────────────────────────────── */}
      {scenarios.length > 0 && (
        <View style={styles.scenariosSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎯 Ways to Increase Your Freedom</Text>
            <Text style={styles.sectionSubtitle}>Personalized moves based on your portfolio</Text>
          </View>
          {scenarios.slice(0, 3).map(sc => (
            <WhatIfCard key={sc.id} scenario={sc} onPress={() => handleViewScenario(sc)} />
          ))}
          {scenarios.length > 3 && (
            <TouchableOpacity onPress={() => {}}>
              <LinearGradient colors={['#1a2a50', '#121830']} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All {scenarios.length} Scenarios →</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* <WhatIfModal visible={showModal} scenario={selectedScenario} onClose={() => setShowModal(false)} onApply={handleApplyScenario} /> */}
      <WhatIfModal
        visible={showModal}
        scenario={selectedScenario}
        onClose={() => { setShowModal(false); setSelectedScenario(null); reset(); }}
        onApply={handleApplyScenario}
        swapState={swapState}
      />  


      
      <GoalsStrip />
      


      {/* ── Info Explanation Modal ─────────────────────────────── */}
      <Modal visible={infoModal !== null} animationType="fade" transparent onRequestClose={() => { setInfoModal(null); setInfoDetails(false); setIncludeHouse(false); }}>
        <TouchableOpacity style={styles.infoModalOverlay} activeOpacity={1} onPress={() => { setInfoModal(null); setInfoDetails(false); setIncludeHouse(false); }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <LinearGradient
              colors={infoModal === 'freedom' ? ['#3d3010', '#1e1808', '#0e0c04'] : ['#1a3868', '#102040', '#081020']}
              style={styles.infoModalContent}>
              <View style={styles.infoModalHeader}>
                <Text style={[styles.infoModalTitle, { color: infoModal === 'freedom' ? '#f4c430' : '#60a5fa' }]}>
                  {infoModal === 'freedom' ? '👑 Freedom Score' : '🛡️ Runway'}
                </Text>
                <TouchableOpacity onPress={() => setInfoModal(null)} style={styles.infoModalClose}>
                  <Text style={styles.infoModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {infoModal === 'freedom' ? (
                <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={styles.infoModalBody}>
                  <Text style={styles.infoModalAnswer}>
                    How long you could survive without working — living off liquid assets, offset by passive income.
                  </Text>

                  <View style={styles.infoFormula}>
                    <Text style={styles.infoFormulaText}>
                      {breakdown.fmt(breakdown.freedomLiquid)} liquid ÷ {breakdown.fmt(Math.round(breakdown.freedomMonthlyBurn))}/mo burn = <Text style={{ color: '#f4c430' }}>{freedom.formatted}</Text>
                    </Text>
                  </View>

                  <View style={styles.infoCurrentBox}>
                    <Text style={styles.infoCurrentLabel}>Your Freedom</Text>
                    <Text style={[styles.infoCurrentValue, { color: '#f4c430' }]}>{freedom.formatted}</Text>
                  </View>

                  <TouchableOpacity style={styles.detailsToggle} onPress={() => setInfoDetails(!infoDetails)}>
                    <Text style={styles.detailsToggleText}>{infoDetails ? 'Hide details' : 'Show the math'}</Text>
                  </TouchableOpacity>

                  {infoDetails && (<>
                    <Text style={styles.infoModalQuestion}>Liquid Assets</Text>
                    <View style={styles.infoFormula}>
                      {breakdown.cryptoTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Crypto</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.cryptoTotal)}</Text></View>}
                      {breakdown.defiTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>DeFi</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.defiTotal)}</Text></View>}
                      {breakdown.stockTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Stocks</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.stockTotal)}</Text></View>}
                      {breakdown.retirementTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>401k/IRA (after penalty)</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.retirementAfterPenalty)}</Text></View>}
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 4 }]}><Text style={[styles.breakdownLabel, { color: '#fff' }]}>Total Liquid</Text><Text style={[styles.breakdownValue, { color: '#f4c430' }]}>{breakdown.fmt(breakdown.freedomLiquid)}</Text></View>
                    </View>
                    {breakdown.retirementTotal > 0 && (
                      <Text style={[styles.infoModalAnswer, { fontStyle: 'italic' }]}>
                        401k/IRA: {breakdown.fmt(breakdown.retirementTotal)} gross, {breakdown.fmt(breakdown.retirementAfterPenalty)} after 10% penalty + ~25% tax.
                      </Text>
                    )}
                    {breakdown.realEstateTotal > 0 && !includeHouse && (
                      <TouchableOpacity style={[styles.detailsToggle, { marginTop: 4, backgroundColor: '#ffffff08', borderColor: '#f4c43030' }]} onPress={() => setIncludeHouse(true)}>
                        <Text style={[styles.detailsToggleText, { color: '#f4c430' }]}>What if I sold the house?</Text>
                      </TouchableOpacity>
                    )}
                    {includeHouse && breakdown.realEstateTotal > 0 && (
                      <View style={[styles.infoFormula, { borderColor: '#f4c43030' }]}>
                        <Text style={[styles.infoModalQuestion, { marginTop: 0 }]}>Sell the house scenario</Text>
                        <View style={[styles.breakdownRow, { marginTop: 6 }]}><Text style={styles.breakdownLabel}>Home equity added</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>+{breakdown.fmt(breakdown.realEstateTotal)}</Text></View>
                        <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>New liquid total</Text><Text style={[styles.breakdownValue, { color: '#f4c430' }]}>{breakdown.fmt(breakdown.houseFreedomLiquid)}</Text></View>
                        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 6 }]}><Text style={styles.breakdownLabel}>Drop mortgage/housing</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>-{breakdown.fmt(breakdown.currentHousingCost)}/mo</Text></View>
                        <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Add rent (downsized est.)</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>+{breakdown.fmt(breakdown.estMonthlyRent)}/mo</Text></View>
                        <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Net burn change</Text><Text style={[styles.breakdownValue, { color: breakdown.houseNetBurnChange <= 0 ? '#4ade80' : '#f87171' }]}>{breakdown.houseNetBurnChange <= 0 ? '-' : '+'}{breakdown.fmt(Math.abs(breakdown.houseNetBurnChange))}/mo</Text></View>
                        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#f4c43030', paddingTop: 6, marginTop: 6 }]}><Text style={[styles.breakdownLabel, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>Freedom with house sold</Text><Text style={[styles.breakdownValue, { color: '#f4c430', fontFamily: 'Inter_700Bold' }]}>{breakdown.houseFreedomFormatted}</Text></View>
                        <TouchableOpacity style={{ alignSelf: 'center', marginTop: 8 }} onPress={() => setIncludeHouse(false)}>
                          <Text style={[styles.detailsToggleText, { fontSize: 12 }]}>Hide scenario</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.infoModalQuestion}>Passive Income vs Expenses</Text>
                    <View style={styles.infoFormula}>
                      {breakdown.cryptoYield > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Staking/DeFi yield</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>+{breakdown.fmt(breakdown.cryptoYield)}/yr</Text></View>}
                      {breakdown.dividendYield > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Dividends</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>+{breakdown.fmt(breakdown.dividendYield)}/yr</Text></View>}
                      {breakdown.rentalNet > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Rental income (net)</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>+{breakdown.fmt(breakdown.rentalNet)}/yr</Text></View>}
                      {breakdown.bizDistributions > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Business distributions</Text><Text style={[styles.breakdownValue, { color: '#4ade80' }]}>+{breakdown.fmt(breakdown.bizDistributions)}/yr</Text></View>}
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 4 }]}><Text style={styles.breakdownLabel}>Obligations</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>-{breakdown.fmt(breakdown.monthlyObligations)}/mo</Text></View>
                      {breakdown.monthlyDebt > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Debt payments</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>-{breakdown.fmt(breakdown.monthlyDebt)}/mo</Text></View>}
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 4 }]}><Text style={[styles.breakdownLabel, { color: '#fff' }]}>Net monthly burn</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>{breakdown.fmt(Math.round(breakdown.freedomMonthlyBurn))}/mo</Text></View>
                    </View>

                    {breakdown.totalPassiveIncome > 0 && (
                      <Text style={styles.infoModalAnswer}>
                        Your {breakdown.fmt(breakdown.totalPassiveIncome)}/yr passive income offsets expenses. Without it, you'd have {breakdown.freedomDailyBurn > 0 ? Math.round(breakdown.freedomLiquid / ((freedom.dailyNeeds) * 30)) + ' months' : '∞'}.
                      </Text>
                    )}

                    <Text style={styles.infoModalQuestion}>Goal</Text>
                    <Text style={styles.infoModalAnswer}>
                      When passive income covers 100% of expenses = <Text style={{ color: '#f4c430', fontFamily: 'Inter_700Bold' }}>KINGED</Text>. Need {breakdown.fmt(Math.round(freedom.dailyNeeds * 365))}/yr — currently at {breakdown.fmt(Math.round(breakdown.totalPassiveIncome))}/yr ({breakdown.annualExpenses > 0 ? Math.round((breakdown.totalPassiveIncome / breakdown.annualExpenses) * 100) : 0}%).
                    </Text>
                  </>)}

                  {/* ── Next Level Progress ─── */}
                  {nextLevel.next && (
                    <View style={styles.nextLevelBox}>
                      <View style={styles.nextLevelHeader}>
                        <Text style={styles.nextLevelCurrent}>{nextLevel.current.emoji} {nextLevel.current.label}</Text>
                        <Text style={styles.nextLevelArrow}>→</Text>
                        <Text style={styles.nextLevelTarget}>{nextLevel.next.emoji} {nextLevel.next.label}</Text>
                      </View>
                      <View style={styles.nextLevelBarBg}>
                        <View style={[styles.nextLevelBarFill, { width: `${(nextLevel.progressInLevel * 100).toFixed(0)}%` }]} />
                      </View>
                      <Text style={styles.nextLevelSub}>
                        {formatDaysNice(nextLevel.daysToNext)} to go · {(nextLevel.progressInLevel * 100).toFixed(0)}% through {nextLevel.current.label.toLowerCase()}
                      </Text>
                    </View>
                  )}

                  {infoDetails && (
                    <View style={styles.allLevelsBox}>
                      <Text style={styles.infoModalQuestion}>Freedom Levels</Text>
                      {FREEDOM_LEVELS.map((level, i) => {
                        const isCurrent = i === nextLevel.currentIndex;
                        const isPast = i < nextLevel.currentIndex;
                        return (
                          <View key={level.key} style={[styles.levelRow, isCurrent && styles.levelRowCurrent]}>
                            <Text style={styles.levelEmoji}>{level.emoji}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.levelName, isCurrent && { color: '#f4c430' }, isPast && { color: '#4ade80' }]}>
                                {level.label} {isCurrent ? '← You' : isPast ? '✓' : ''}
                              </Text>
                            </View>
                            <Text style={styles.levelThreshold}>
                              {level.max === Infinity ? '∞' : level.max >= 365 ? `${(level.max / 365).toFixed(0)}y` : `${level.max}d`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                </ScrollView>
              ) : (
                <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={styles.infoModalBody}>
                  <Text style={styles.infoModalAnswer}>
                    How long all your sellable assets would cover bills if income stopped. Includes everything except retirement accounts.
                  </Text>

                  <View style={styles.infoFormula}>
                    <Text style={styles.infoFormulaText}>
                      {breakdown.fmt(breakdown.runwayLiquid)} total ÷ {breakdown.fmt(breakdown.runwayBurn)}/mo burn = <Text style={{ color: '#60a5fa' }}>{runwayLabel}</Text>
                    </Text>
                  </View>

                  <View style={styles.infoCurrentBox}>
                    <Text style={styles.infoCurrentLabel}>Your Runway</Text>
                    <Text style={[styles.infoCurrentValue, { color: '#60a5fa' }]}>{runwayLabel}</Text>
                  </View>

                  <TouchableOpacity style={styles.detailsToggle} onPress={() => setInfoDetails(!infoDetails)}>
                    <Text style={styles.detailsToggleText}>{infoDetails ? 'Hide details' : 'Show the math'}</Text>
                  </TouchableOpacity>

                  {infoDetails && (<>
                    <Text style={styles.infoModalQuestion}>What's counted</Text>
                    <View style={styles.infoFormula}>
                      {breakdown.bankTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Bank accounts</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.bankTotal)}</Text></View>}
                      {breakdown.cryptoTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Crypto</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.cryptoTotal)}</Text></View>}
                      {breakdown.defiTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>DeFi positions</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.defiTotal)}</Text></View>}
                      {breakdown.stockTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Stocks</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.stockTotal)}</Text></View>}
                      {breakdown.realEstateTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Real estate equity</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.realEstateTotal)}</Text></View>}
                      {breakdown.businessTotal > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Business equity</Text><Text style={styles.breakdownValue}>{breakdown.fmt(breakdown.businessTotal)}</Text></View>}
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 4 }]}><Text style={[styles.breakdownLabel, { color: '#fff' }]}>Total</Text><Text style={[styles.breakdownValue, { color: '#60a5fa' }]}>{breakdown.fmt(breakdown.runwayLiquid)}</Text></View>
                    </View>
                    {breakdown.retirementTotal > 0 && (
                      <Text style={[styles.infoModalAnswer, { fontStyle: 'italic' }]}>
                        Not counted: Retirement ({breakdown.fmt(breakdown.retirementTotal)}) — can't liquidate without penalties.
                      </Text>
                    )}

                    <Text style={styles.infoModalQuestion}>Monthly burn</Text>
                    <View style={styles.infoFormula}>
                      <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Obligations</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>{breakdown.fmt(breakdown.monthlyObligations)}/mo</Text></View>
                      {breakdown.monthlyDebt > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Debt payments</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>{breakdown.fmt(breakdown.monthlyDebt)}/mo</Text></View>}
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#ffffff15', paddingTop: 6, marginTop: 4 }]}><Text style={[styles.breakdownLabel, { color: '#fff' }]}>Total burn</Text><Text style={[styles.breakdownValue, { color: '#f87171' }]}>{breakdown.fmt(breakdown.runwayBurn)}/mo</Text></View>
                    </View>

                    <Text style={styles.infoModalAnswer}>
                      This assumes selling everything (crypto, stocks{breakdown.realEstateTotal > 0 ? ', even the house' : ''}) to cover bills. Freedom offsets burn with passive income ({breakdown.fmt(Math.round(breakdown.totalPassiveIncome))}/yr) — runway does not.
                    </Text>
                  </>)}
                </View>
                </ScrollView>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Tools ─────────────────────────────────────────────────── */}
      <View style={styles.toolsSection}>
        <Text style={styles.toolsSectionTitle}>Tools</Text>
        <ToolCard emoji="📊" title="Trading Tracker" sub="Track trades and performance"
          colors={['#1a2a50', '#121830']} accent="#60a5fa" onPress={() => router.push('/trading')} />
        <ToolCard emoji="💸" title="Daily Expenses" sub="Log daily spending"
          colors={['#402a1a', '#281810']} accent="#fb923c" onPress={() => router.push('/expenses')} />
        <ToolCard emoji="🧾" title="View All Spending" sub="Full breakdown with editing"
          colors={['#3a1a1a', '#281018']} accent="#f87171" onPress={() => router.push('/spending')} />
        <ToolCard emoji="👤" title="Profile & Settings" sub="Accounts and backup"
          colors={['#2a1a40', '#181028']} accent="#a78bfa" onPress={() => router.push('/profile')} />
      </View>

      <View style={styles.toolsSection}>
        <Text style={styles.toolsSectionTitle}>Badges</Text>
        <BadgeStrip />
      </View>


    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.container}><StatusBar barStyle="light-content" />
        <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
          avatarType={avatarType} isKinged={freedom.isKinged} layout="sidebar">
          <ScrollView style={styles.webDashboardScroll} showsVerticalScrollIndicator={true}>{dashboardBody}</ScrollView>
        </FreedomScore>
      </View>
    );
  }

  return (
    <View style={styles.container}><StatusBar barStyle="light-content" />
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <FreedomScore days={freedom.days} formatted={freedom.formatted} state={freedom.state}
          avatarType={avatarType} isKinged={freedom.isKinged} layout="hero" />
        {dashboardBody}
      </ScrollView>
    </View>
  );
}

// ─── Gradient Metric Card ────────────────────────────────────────────────────
function GradientMetricCard({ label, value, sub, color, gradientColors, borderColor, onInfo }: {
  label: string; value: string; sub: string; color: string;
  gradientColors: [string, string, string]; borderColor: string;
  onInfo?: () => void;
}) {
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.metricCard, { borderLeftColor: color, borderColor }]}>
      <View style={styles.metricLabelRow}>
        <Text style={[styles.metricLabel, { color: color + 'cc' }]}>{label}</Text>
        {onInfo && (
          <TouchableOpacity onPress={onInfo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={[styles.infoButton, { borderColor: color + '60' }]}>
              <Text style={[styles.infoButtonText, { color: color + 'bb' }]}>ℹ</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricSub, { color: color + '88' }]}>{sub}</Text>
    </LinearGradient>
  );
}

// ─── Tool Card ───────────────────────────────────────────────────────────────
function ToolCard({ emoji, title, sub, colors, accent, onPress }: {
  emoji: string; title: string; sub: string; colors: [string, string]; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.toolCardGradient, { borderLeftColor: accent, borderColor: accent + '30' }]}>
        <View style={styles.toolLeft}>
          <View style={[styles.toolIconBg, { borderColor: accent + '50', backgroundColor: accent + '15' }]}>
            <Text style={styles.toolIcon}>{emoji}</Text>
          </View>
          <View>
            <Text style={styles.toolTitle}>{title}</Text>
            <Text style={styles.toolSubtitle}>{sub}</Text>
          </View>
        </View>
        <Text style={[styles.toolArrow, { color: accent }]}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Phase insight ───────────────────────────────────────────────────────────
function getInsight(cf: ReturnType<typeof analyzeAllAccounts>, freedom: any) {
  const monthlyBurn = cf.totalMonthlyOut;
  const runwayMonths = monthlyBurn > 0 ? cf.liquidAssets / monthlyBurn : Infinity;
  const surplus = cf.totalMonthlyNet;
  const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  if (cf.healthStatus === 'critical') {
    return { emoji: '⚡', title: 'Cash flow needs attention', body: cf.totalMonthlyNet < 0 ? `Spending $${Math.abs(surplus).toFixed(0)}/mo more than you earn. Fix this before anything else.` : cf.healthMessage };
  }
  if (cf.healthStatus === 'struggling') {
    return { emoji: '🏗️', title: 'Building the foundation', body: `$${surplus.toFixed(0)}/mo surplus — thin margin. Focus on cutting obligations or boosting income.` };
  }
  if (cf.healthStatus === 'stable') {
    return { emoji: '🛡️', title: 'Stacking reserves', body: `${runwayMonths.toFixed(0)} months of runway. Keep building toward 6+ months before going aggressive.` };
  }
  if (cf.healthStatus === 'building') {
    return { emoji: '📈', title: 'Ready to deploy', body: `${runwayMonths.toFixed(0)} months runway, ${fmtK(surplus)}/mo surplus. Start deploying into yield-bearing assets.` };
  }
  // thriving
  if (freedom.isKinged) {
    return { emoji: '👑', title: 'You\'re KINGED', body: `Passive income covers all expenses. ${fmtK(surplus)}/mo surplus to compound or enjoy.` };
  }
  const pctToKinged = freedom.dailyNeeds > 0 ? Math.round((freedom.dailyAssetIncome / freedom.dailyNeeds) * 100) : 0;
  return { emoji: '🚀', title: 'Compounding toward freedom', body: `${(runwayMonths / 12).toFixed(1)}y runway, ${fmtK(surplus)}/mo to deploy. Passive income covers ${pctToKinged}% of expenses.` };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18', height: '100vh' },
  loadingContainer: { flex: 1, backgroundColor: '#080c18', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#f4c430', fontFamily: 'Inter_600SemiBold' },
  scrollContainer: { flex: 1 },
  webDashboardScroll: { flex: 1, height: '100%' },
  content: { padding: 20 },

  // Health badge
  healthBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 18, borderRadius: 16, borderWidth: 1.5, marginBottom: 20,
  },
  healthEmoji: { fontSize: 26, marginTop: 1 },
  healthTextRow: { flex: 1 },
  healthLabel: { fontSize: 17, fontFamily: 'Inter_800ExtraBold', marginBottom: 4, letterSpacing: 0.3 },
  healthMessage: { fontSize: 13, color: '#c0c0c0', lineHeight: 20, fontFamily: 'Inter_400Regular' },

  // Metric cards
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    flex: 1, minWidth: '45%', padding: 18, borderRadius: 16,
    borderLeftWidth: 4, borderWidth: 1.5,
  },
  metricLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  metricLabel: {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8,
    fontFamily: 'Inter_800ExtraBold',
  },
  metricValue: { fontSize: 30, marginBottom: 4, fontFamily: 'Inter_800ExtraBold' },
  metricSub: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Info button (on metric cards)
  infoButton: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff08',
  },
  infoButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: -1 },

  // Insight
  insightCard: {
    flexDirection: 'row', gap: 14, padding: 20, borderRadius: 16,
    marginBottom: 20, borderWidth: 1.5, borderColor: '#2a3060',
  },
  insightEmojiContainer: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#0c1020',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#2a3060',
  },
  insightEmoji: { fontSize: 22 },
  insightTitle: { fontSize: 17, color: '#ffffff', marginBottom: 6, fontFamily: 'Inter_700Bold' },
  insightBody: { fontSize: 14, color: '#b8b8c0', lineHeight: 21, fontFamily: 'Inter_400Regular' },

  // Recs
  recsSection: { marginBottom: 24 },
  recsSectionTitle: { fontSize: 11, color: '#f4c430', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontFamily: 'Inter_800ExtraBold' },
  recRow: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  recDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  recText: { fontSize: 14, color: '#c0c0c8', flex: 1, lineHeight: 22, fontFamily: 'Inter_400Regular' },

  // Tools
  toolsSection: { marginTop: 10, marginBottom: 40 },
  toolsSectionTitle: { fontSize: 11, color: '#f4c430', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontFamily: 'Inter_800ExtraBold' },
  toolCardGradient: {
    padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 4, borderWidth: 1, borderRadius: 14, marginBottom: 10,
  },
  toolLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  toolIconBg: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  toolIcon: { fontSize: 22 },
  toolTitle: { fontSize: 15, color: '#fff', marginBottom: 3, fontFamily: 'Inter_600SemiBold' },
  toolSubtitle: { fontSize: 12, color: '#999', fontFamily: 'Inter_400Regular' },
  toolArrow: { fontSize: 30, fontFamily: 'Inter_600SemiBold' },

  // Scenarios
  scenariosSection: { paddingVertical: 20 },
  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 23, color: '#fff', marginBottom: 6, fontFamily: 'Inter_800ExtraBold' },
  sectionSubtitle: { fontSize: 14, color: '#888', fontFamily: 'Inter_400Regular' },
  viewAllButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#60a5fa50' },
  viewAllText: { fontSize: 14, color: '#60a5fa', fontFamily: 'Inter_700Bold' },

  // Info explanation modal
  infoModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  infoModalContent: {
    width: '100%', maxWidth: 420, borderRadius: 20, padding: 24,
    borderWidth: 1.5, borderColor: '#2a305080',
  },
  infoModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  infoModalTitle: { fontSize: 22, fontFamily: 'Inter_800ExtraBold' },
  infoModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff10', justifyContent: 'center', alignItems: 'center' },
  infoModalCloseText: { fontSize: 16, color: '#888', fontFamily: 'Inter_600SemiBold' },
  infoModalBody: { gap: 6 },
  infoModalQuestion: { fontSize: 14, color: '#ffffff', fontFamily: 'Inter_700Bold', marginTop: 12 },
  infoModalAnswer: { fontSize: 14, color: '#b0b0b8', lineHeight: 22, fontFamily: 'Inter_400Regular' },
  infoFormula: {
    backgroundColor: '#00000030', borderRadius: 12, padding: 14, marginVertical: 8,
    borderWidth: 1, borderColor: '#ffffff10',
  },
  infoFormulaText: { fontSize: 14, color: '#e0e0e8', fontFamily: 'Inter_600SemiBold', textAlign: 'center', lineHeight: 22 },
  infoCurrentBox: {
    backgroundColor: '#00000030', borderRadius: 14, padding: 16, marginTop: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#ffffff10',
  },
  infoCurrentLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Inter_700Bold' },
  infoCurrentValue: { fontSize: 32, fontFamily: 'Inter_800ExtraBold' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  breakdownLabel: { fontSize: 13, color: '#b0b0b8', fontFamily: 'Inter_400Regular' },
  breakdownValue: { fontSize: 13, color: '#e0e0e8', fontFamily: 'Inter_600SemiBold' },
  detailsToggle: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, marginTop: 8, borderRadius: 20, backgroundColor: '#ffffff10', borderWidth: 1, borderColor: '#ffffff15' },
  detailsToggleText: { fontSize: 13, color: '#888', fontFamily: 'Inter_600SemiBold' },

  // Next Level Progress
  nextLevelBox: {
    marginTop: 16,
    backgroundColor: 'rgba(244, 196, 48, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.2)',
  },
  nextLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  nextLevelCurrent: { fontSize: 14, color: '#888', fontFamily: 'Inter_600SemiBold' },
  nextLevelArrow: { fontSize: 14, color: '#f4c430' },
  nextLevelTarget: { fontSize: 14, color: '#f4c430', fontFamily: 'Inter_700Bold' },
  nextLevelBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  nextLevelBarFill: {
    height: '100%',
    backgroundColor: '#f4c430',
    borderRadius: 4,
  },
  nextLevelSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },

  // All Levels
  allLevelsBox: { marginTop: 16 },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  levelRowCurrent: {
    backgroundColor: 'rgba(244, 196, 48, 0.1)',
  },
  levelEmoji: { fontSize: 18, width: 28, textAlign: 'center' },
  levelName: { fontSize: 13, color: '#666', fontFamily: 'Inter_600SemiBold' },
  levelThreshold: { fontSize: 12, color: '#555', fontFamily: 'Inter_500Medium' },
});
