// src/components/TradingIncomeWarning.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useStore } from '../store/useStore';
import { analyzeAllAccounts } from '../services/cashflow';

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly': return (amount * 52) / 12;
    case 'biweekly': return (amount * 26) / 12;
    case 'twice_monthly': return amount * 2;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    default: return amount;
  }
}

const USD_STAR_APY = 9.34;
const BUFFER_MONTHS = 3;

interface TradingWarning {
  show: boolean;
  tradingMonthly: number;
  tradingPercent: number;
  shortfall: number;
  monthlyObligations: number;
  bufferNeeded: number;
  currentUsdStar: number;
  additionalNeeded: number;
  monthlyYieldAtBuffer: number;
  incomeWithoutTrading: number;
  // 401k specifics
  has401k: boolean;
  current401kMonthly: number;
  current401kPercent: number;
  grossPayMonthly: number;
  reduced401kMonthly: number;
  reduced401kPercent: number;
  can401kCoverShortfall: boolean;
}

export function useTradingIncomeRisk(): TradingWarning {
  const incomeSources = useStore((s) => s.income.sources || []);
  const bankAccounts = useStore((s) => s.bankAccounts);
  const obligations = useStore((s) => s.obligations);
  const debts = useStore((s) => s.debts);
  const assets = useStore((s) => s.assets);
  const preTaxDeductions = useStore((s) => s.preTaxDeductions || []);
  const taxes = useStore((s) => s.taxes || []);
  const postTaxDeductions = useStore((s) => s.postTaxDeductions || []);

  return useMemo(() => {
    const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts);

    const tradingMonthly = incomeSources
      .filter((s) => s.source === 'trading')
      .reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0);

    const totalMonthlyIncome = cashFlow.totalMonthlyIncome;
    const monthlyObligations = cashFlow.totalMonthlyObligations + cashFlow.totalMonthlyDebtPayments;

    const tradingPercent = totalMonthlyIncome > 0 ? tradingMonthly / totalMonthlyIncome : 0;
    const incomeWithoutTrading = totalMonthlyIncome - tradingMonthly;
    const wouldBeDeficit = incomeWithoutTrading < monthlyObligations;
    const shortfall = Math.max(0, monthlyObligations - incomeWithoutTrading);

    // ─── 401k / gross pay calculation ─────────────────────────────────
    const preTaxMonthly = preTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);
    const taxesMonthly = taxes.reduce((sum, t) => sum + toMonthly(t.perPayPeriod, t.frequency), 0);
    const postTaxMonthly = postTaxDeductions.reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);

    // Net paycheck income (salary/freelance/business — what hits the bank)
    const paycheckNetMonthly = incomeSources
      .filter((s) => s.source === 'salary' || s.source === 'freelance' || s.source === 'business')
      .reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0);

    // Gross = net paycheck + everything deducted before it hits the bank
    const grossPayMonthly = paycheckNetMonthly + preTaxMonthly + taxesMonthly + postTaxMonthly;

    // Find 401k contribution specifically
    const current401kMonthly = preTaxDeductions
      .filter((d) => d.type === '401k_contribution')
      .reduce((sum, d) => sum + toMonthly(d.perPayPeriod, d.frequency), 0);

    // Also check retirement assets for legacy 401k tracking
    const legacy401kMonthly = assets
      .filter((a) => a.type === 'retirement' && a.metadata?.type === 'retirement')
      .reduce((sum, a) => {
        const meta = a.metadata as any;
        const amt = meta?.contributionAmount || 0;
        const freq = meta?.contributionFrequency || 'monthly';
        return sum + toMonthly(amt, freq);
      }, 0);

    const total401kMonthly = current401kMonthly + legacy401kMonthly;
    const has401k = total401kMonthly > 0;
    const current401kPercent = grossPayMonthly > 0 ? (total401kMonthly / grossPayMonthly) * 100 : 0;

    // If trading dies, how much would 401k need to drop?
    const reduced401kMonthly = Math.max(0, total401kMonthly - shortfall);
    const reduced401kPercent = grossPayMonthly > 0 ? (reduced401kMonthly / grossPayMonthly) * 100 : 0;
    const can401kCoverShortfall = total401kMonthly >= shortfall;

    // ─── USD* / Perena ────────────────────────────────────────────────
    const currentUsdStar = assets
      .filter((a) => {
        const meta = a.metadata as any;
        return (
          meta?.symbol === 'USD*' ||
          meta?.mint === 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6' ||
          a.name?.toLowerCase().includes('usd*') ||
          a.name?.toLowerCase().includes('perena')
        );
      })
      .reduce((sum, a) => sum + a.value, 0);

    const bufferNeeded = monthlyObligations * BUFFER_MONTHS;
    const additionalNeeded = Math.max(0, bufferNeeded - currentUsdStar);
    const monthlyYieldAtBuffer = (bufferNeeded * USD_STAR_APY) / 100 / 12;

    return {
      show: tradingPercent > 0.20 && wouldBeDeficit,
      tradingMonthly,
      tradingPercent,
      shortfall,
      monthlyObligations,
      bufferNeeded,
      currentUsdStar,
      additionalNeeded,
      monthlyYieldAtBuffer,
      incomeWithoutTrading,
      has401k,
      current401kMonthly: total401kMonthly,
      current401kPercent,
      grossPayMonthly,
      reduced401kMonthly,
      reduced401kPercent,
      can401kCoverShortfall,
    };
  }, [incomeSources, bankAccounts, obligations, debts, assets, preTaxDeductions, taxes, postTaxDeductions]);
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtPct = (n: number) => n.toFixed(1);

interface Props {
  onDismiss?: () => void;
  onPerenaAction?: () => void;
}

export default function TradingIncomeWarning({ onDismiss, onPerenaAction }: Props) {
  const risk = useTradingIncomeRisk();

  if (!risk.show) return null;

  const pct = Math.round(risk.tradingPercent * 100);
  const hasUsdStar = risk.currentUsdStar > 0;
  const bufferComplete = risk.additionalNeeded <= 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>Trading Income Risk</Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={s.dismissBtn}>
            <Text style={s.dismissText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* The problem */}
      <Text style={s.body}>
        Trading is <Text style={s.orange}>{pct}%</Text> of your income
        (<Text style={s.white}>${fmt(risk.tradingMonthly)}/mo</Text>).
        Your obligations are{' '}
        <Text style={s.white}>${fmt(risk.monthlyObligations)}/mo</Text> — without
        trading you'd be{' '}
        <Text style={s.red}>${fmt(risk.shortfall)}/mo short</Text>.
      </Text>

      {/* 401k impact callout */}
      {risk.has401k && (
        <View style={s.retirementBox}>
          <Text style={s.retirementText}>
            {risk.can401kCoverShortfall ? (
              <>
                You'd have to drop your 401k contribution from{' '}
                <Text style={s.purple}>{fmtPct(risk.current401kPercent)}%</Text>
                {' '}(${fmt(risk.current401kMonthly)}/mo) to{' '}
                <Text style={s.orange}>{fmtPct(risk.reduced401kPercent)}%</Text>
                {' '}(${fmt(risk.reduced401kMonthly)}/mo) to cover the{' '}
                <Text style={s.red}>${fmt(risk.shortfall)}/mo</Text> shortfall.
                That's <Text style={s.red}>${fmt(risk.current401kMonthly - risk.reduced401kMonthly)}/mo</Text> less
                going to your future.
              </>
            ) : (
              <>
                Even zeroing out your 401k (currently{' '}
                <Text style={s.purple}>{fmtPct(risk.current401kPercent)}%</Text> /{' '}
                ${fmt(risk.current401kMonthly)}/mo) wouldn't cover the full{' '}
                <Text style={s.red}>${fmt(risk.shortfall)}/mo</Text> shortfall.
                You'd still be <Text style={s.red}>${fmt(risk.shortfall - risk.current401kMonthly)}/mo short</Text>.
              </>
            )}
          </Text>
        </View>
      )}

      {/* Numbers breakdown */}
      <View style={s.numbersRow}>
        <View style={s.numberBox}>
          <Text style={s.numberLabel}>Obligations</Text>
          <Text style={s.numberValue}>${fmt(risk.monthlyObligations)}</Text>
          <Text style={s.numberSub}>/month</Text>
        </View>
        <View style={s.numberBox}>
          <Text style={s.numberLabel}>Without Trading</Text>
          <Text style={[s.numberValue, { color: '#ff6b6b' }]}>${fmt(risk.incomeWithoutTrading)}</Text>
          <Text style={s.numberSub}>/month</Text>
        </View>
        <View style={s.numberBox}>
          <Text style={s.numberLabel}>Shortfall</Text>
          <Text style={[s.numberValue, { color: '#ff6b6b' }]}>-${fmt(risk.shortfall)}</Text>
          <Text style={s.numberSub}>/month</Text>
        </View>
      </View>

      {/* Action plan */}
      <View style={s.actionBox}>
        <Text style={s.actionTitle}>🛡️ Action Plan</Text>

        {/* 1: Stop losses */}
        <Text style={s.actionItem}>
          <Text style={s.actionBullet}>1. </Text>
          <Text style={s.orange}>Set stop-losses on every open position. </Text>
          One bad trade could wipe ${fmt(risk.tradingMonthly)} of monthly income.
        </Text>

        {/* 2: Perena buffer */}
        <Text style={s.actionItem}>
          <Text style={s.actionBullet}>2. </Text>
          Build a <Text style={s.gold}>${fmt(risk.bufferNeeded)} buffer</Text> in{' '}
          <Text style={s.gold}>Perena USD*</Text> ({BUFFER_MONTHS} months of obligations
          earning <Text style={s.green}>{USD_STAR_APY}% APY</Text>).
        </Text>

        {/* USD* status */}
        {hasUsdStar && !bufferComplete && (
          <View style={s.usdStarStatus}>
            <Text style={s.usdStarText}>
              You have <Text style={s.green}>${fmt(risk.currentUsdStar)}</Text> in USD* —
              deposit <Text style={s.gold}>${fmt(risk.additionalNeeded)} more</Text> to
              complete your buffer.
            </Text>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${Math.min((risk.currentUsdStar / risk.bufferNeeded) * 100, 100)}%` }]} />
            </View>
            <Text style={s.progressLabel}>
              ${fmt(risk.currentUsdStar)} / ${fmt(risk.bufferNeeded)}
            </Text>
          </View>
        )}
        {bufferComplete && (
          <View style={s.usdStarStatus}>
            <Text style={s.usdStarText}>
              <Text style={s.green}>✓ Your ${fmt(risk.currentUsdStar)} in USD* covers your {BUFFER_MONTHS}-month buffer.</Text>
              {'\n'}Earning ~<Text style={s.green}>${fmt(risk.monthlyYieldAtBuffer)}/mo</Text> in yield while it sits.
            </Text>
          </View>
        )}
        {!hasUsdStar && (
          <View style={s.usdStarStatus}>
            <Text style={s.usdStarText}>
              Swap <Text style={s.gold}>${fmt(risk.bufferNeeded)} USDC → USD*</Text> to
              earn <Text style={s.green}>${fmt(risk.monthlyYieldAtBuffer)}/mo</Text> on your safety net
              instead of $0 in a savings account.
            </Text>
          </View>
        )}

        {/* 3: Risk sizing */}
        <Text style={s.actionItem}>
          <Text style={s.actionBullet}>3. </Text>
          Cap risk at <Text style={s.orange}>1-2% per trade</Text> (
          <Text style={s.orange}>${(risk.tradingMonthly * 0.01).toFixed(2)}-${(risk.tradingMonthly * 0.02).toFixed(2)}</Text>
          {' '}of your ${fmt(risk.tradingMonthly)}/mo).
          A 50% drawdown wipes ${fmt(Math.round(risk.tradingMonthly / 2))}/mo and
          leaves you <Text style={s.red}>${fmt(Math.round(risk.shortfall + risk.tradingMonthly / 2))}/mo short</Text>.
        </Text>
      </View>

      {/* CTA for Perena */}
      {!bufferComplete && onPerenaAction && (
        <TouchableOpacity style={s.ctaButton} onPress={onPerenaAction} activeOpacity={0.8}>
          <Text style={s.ctaText}>
            {hasUsdStar
              ? `Deposit $${fmt(risk.additionalNeeded)} more → USD*`
              : `Build $${fmt(risk.bufferNeeded)} USD* Buffer`}
          </Text>
          <Text style={s.ctaSub}>Earn {USD_STAR_APY}% APY on your safety net</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#2a1a1e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#ff6b6b44',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: { fontSize: 20, marginRight: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#ff6b6b', flex: 1 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 16, color: '#666' },

  body: {
    fontSize: 14,
    color: '#c0c0c0',
    lineHeight: 21,
    marginBottom: 12,
  },
  white: { color: '#ffffff', fontWeight: '600' },
  orange: { color: '#ff9f43', fontWeight: 'bold' },
  red: { color: '#ff6b6b', fontWeight: 'bold' },
  green: { color: '#4ade80', fontWeight: 'bold' },
  gold: { color: '#f4c430', fontWeight: 'bold' },
  purple: { color: '#c084fc', fontWeight: 'bold' },

  // 401k callout
  retirementBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#c084fc',
  },
  retirementText: {
    fontSize: 13,
    color: '#c0c0c0',
    lineHeight: 21,
  },

  // Numbers row
  numbersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  numberBox: {
    flex: 1,
    backgroundColor: '#1a0e12',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  numberLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  numberValue: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  numberSub: { fontSize: 10, color: '#666', marginTop: 1 },

  // Action plan
  actionBox: {
    backgroundColor: '#1a0e12',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ff9f43', marginBottom: 10 },
  actionItem: {
    fontSize: 13,
    color: '#a0a0a0',
    lineHeight: 20,
    marginBottom: 10,
  },
  actionBullet: { color: '#ff9f43', fontWeight: 'bold' },

  // USD* status
  usdStarStatus: {
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    marginLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#f4c430',
  },
  usdStarText: {
    fontSize: 13,
    color: '#c0c0c0',
    lineHeight: 20,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2a2f3e',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },

  // CTA
  ctaButton: {
    backgroundColor: '#f4c430',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: 'bold', color: '#0a0e1a' },
  ctaSub: { fontSize: 12, color: '#0a0e1a88', marginTop: 2 },
});
