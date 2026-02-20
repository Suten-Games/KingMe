// src/components/SurplusCashPlan.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Analyzes EACH bank account individually, detects surplus cash,
// suggests cross-account transfers + allocation plan
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import type { BankAccount, Obligation, Debt } from '../types';

const DISMISS_KEY = 'surplus_plan_dismissed';
const DISMISS_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days
const SURPLUS_THRESHOLD = 500; // Only show if total surplus > $500
const CUSHION_MONTHS = 1.5;   // Keep 1.5 months of bills per account
const BUFFER_MONTHS = 3;      // USD* buffer target
const USD_STAR_APY = 9.34;

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// ── Per-account analysis ─────────────────────────────────────

interface AccountAnalysis {
  account: BankAccount;
  monthlyBills: number;       // obligations + debts from this account
  billNames: string[];        // what pulls from this account
  cushion: number;            // monthlyBills × CUSHION_MONTHS
  surplus: number;            // balance - cushion (negative = shortfall)
  isShort: boolean;
}

interface Transfer {
  from: BankAccount;
  to: BankAccount;
  amount: number;
  reason: string;
}

interface Allocation {
  label: string;
  emoji: string;
  amount: number;
  reason: string;
  impact: string;
  color: string;
}

interface SurplusPlan {
  show: boolean;
  accounts: AccountAnalysis[];
  transfers: Transfer[];
  totalSurplus: number;
  allocations: Allocation[];
}

function useSurplusPlan(): SurplusPlan {
  const bankAccounts = useStore(s => s.bankAccounts);
  const obligations = useStore(s => s.obligations);
  const debts = useStore(s => s.debts);
  const assets = useStore(s => s.assets);

  return useMemo(() => {
    const activeAccounts = bankAccounts.filter(
      a => a.type === 'checking' || a.type === 'savings'
    );

    if (activeAccounts.length === 0) {
      return { show: false, accounts: [], transfers: [], totalSurplus: 0, allocations: [] };
    }

    // ── 1. Analyze each account ──────────────────────────────
    const analyses: AccountAnalysis[] = activeAccounts.map(account => {
      // Find obligations that pull from this account
      const acctObligations = obligations.filter(o => o.bankAccountId === account.id);
      const acctDebts = debts.filter(d => d.bankAccountId === account.id);

      const monthlyBills =
        acctObligations.reduce((sum, o) => sum + o.amount, 0) +
        acctDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);

      const billNames = [
        ...acctObligations.map(o => o.name),
        ...acctDebts.map(d => d.name),
      ];

      const cushion = monthlyBills * CUSHION_MONTHS;
      const surplus = (account.currentBalance || 0) - cushion;

      return {
        account,
        monthlyBills,
        billNames,
        cushion,
        surplus,
        isShort: surplus < 0,
      };
    });

    // Also find obligations/debts with no account assigned — split across all
    const unassignedObligations = obligations.filter(
      o => !o.bankAccountId || !activeAccounts.some(a => a.id === o.bankAccountId)
    );
    const unassignedDebts = debts.filter(
      d => !d.bankAccountId || !activeAccounts.some(a => a.id === d.bankAccountId)
    );
    const unassignedMonthly =
      unassignedObligations.reduce((sum, o) => sum + o.amount, 0) +
      unassignedDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);

    // Spread unassigned bills across accounts proportionally by balance
    if (unassignedMonthly > 0 && analyses.length > 0) {
      const totalBalance = analyses.reduce((s, a) => s + (a.account.currentBalance || 0), 0);
      for (const analysis of analyses) {
        const share = totalBalance > 0
          ? ((analysis.account.currentBalance || 0) / totalBalance) * unassignedMonthly
          : unassignedMonthly / analyses.length;
        analysis.monthlyBills += share;
        analysis.cushion = analysis.monthlyBills * CUSHION_MONTHS;
        analysis.surplus = (analysis.account.currentBalance || 0) - analysis.cushion;
        analysis.isShort = analysis.surplus < 0;
        if (unassignedObligations.length > 0) {
          analysis.billNames.push(`(+ unassigned bills)`);
        }
      }
    }

    // ── 2. Suggest cross-account transfers ───────────────────
    const transfers: Transfer[] = [];
    const shortAccounts = analyses.filter(a => a.isShort);
    const surplusAccounts = analyses
      .filter(a => a.surplus > SURPLUS_THRESHOLD)
      .sort((a, b) => b.surplus - a.surplus);

    for (const short of shortAccounts) {
      const needed = Math.abs(short.surplus);
      let remainingNeed = needed;

      for (const surplus of surplusAccounts) {
        if (remainingNeed <= 0) break;
        const available = surplus.surplus;
        if (available <= 0) continue;

        const transferAmt = Math.min(remainingNeed, available * 0.8); // Don't drain surplus account
        if (transferAmt < 50) continue; // Skip tiny transfers

        transfers.push({
          from: surplus.account,
          to: short.account,
          amount: Math.round(transferAmt),
          reason: `${short.account.name} is $${fmt(Math.round(needed))} short for upcoming bills`,
        });

        remainingNeed -= transferAmt;
        surplus.surplus -= transferAmt; // Track for subsequent iterations
      }
    }

    // ── 3. Calculate total deployable surplus ────────────────
    // After suggested transfers, what's left across all surplus accounts
    const totalSurplus = analyses
      .filter(a => a.surplus > 0)
      .reduce((sum, a) => sum + a.surplus, 0);

    if (totalSurplus < SURPLUS_THRESHOLD && transfers.length === 0) {
      return { show: false, accounts: analyses, transfers: [], totalSurplus: 0, allocations: [] };
    }

    // ── 4. Build allocation plan for surplus ─────────────────
    const allocations: Allocation[] = [];
    let remaining = totalSurplus;

    // A. USD* buffer gap
    const usdStarBalance = assets
      .filter(a => {
        const meta = a.metadata as any;
        return (
          meta?.symbol === 'USD*' ||
          meta?.mint === 'BenJy1n3WTx9mTjEvy63e8Q1j4RqUc6E4VBMz3ir4Wo6' ||
          a.name?.toLowerCase().includes('usd*') ||
          a.name?.toLowerCase().includes('perena')
        );
      })
      .reduce((sum, a) => sum + a.value, 0);

    const totalMonthlyBills = analyses.reduce((s, a) => s + a.monthlyBills, 0);
    const bufferTarget = totalMonthlyBills * BUFFER_MONTHS;
    const bufferGap = Math.max(0, bufferTarget - usdStarBalance);

    if (bufferGap > 0 && remaining > 0) {
      const toBuffer = Math.min(bufferGap, remaining);
      const monthlyYield = (toBuffer * USD_STAR_APY) / 100 / 12;
      allocations.push({
        label: 'USD* Buffer',
        emoji: '🛟',
        amount: toBuffer,
        reason: usdStarBalance > 0
          ? `Fill buffer gap ($${fmt(usdStarBalance)} → $${fmt(usdStarBalance + toBuffer)} of $${fmt(bufferTarget)} target)`
          : `Start your ${BUFFER_MONTHS}-month safety buffer ($${fmt(bufferTarget)} target)`,
        impact: `Earns ~$${fmt(monthlyYield)}/mo at ${USD_STAR_APY}% APY while protecting you`,
        color: '#f4c430',
      });
      remaining -= toBuffer;
    }

    // B. High-interest debt payoff (> 5%)
    const highInterestDebts = debts
      .filter(d => (d.interestRate || 0) > 5 && (d.remainingBalance || d.principal || 0) > 0)
      .sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));

    for (const debt of highInterestDebts) {
      if (remaining <= 0) break;
      const balance = debt.remainingBalance || debt.principal || 0;
      const payoff = Math.min(balance, remaining);
      const isFullPayoff = payoff >= balance;
      const rate = debt.interestRate || 0;
      allocations.push({
        label: isFullPayoff ? `Pay off ${debt.name}` : `Pay down ${debt.name}`,
        emoji: '💀',
        amount: payoff,
        reason: `${rate > 1 ? rate.toFixed(1) : (rate * 100).toFixed(1)}% interest — ${isFullPayoff ? 'eliminates' : 'reduces'} $${fmt(debt.monthlyPayment)}/mo payment`,
        impact: isFullPayoff
          ? `Frees $${fmt(debt.monthlyPayment)}/mo → directly increases freedom score`
          : `Saves ~$${fmt(payoff * (rate > 1 ? rate : rate * 100) / 100 / 12)}/mo in interest`,
        color: '#ff6b6b',
      });
      remaining -= payoff;
    }

    // C. Low-interest debt (≤ 5%)
    const lowInterestDebts = debts
      .filter(d => (d.interestRate || 0) > 0 && (d.interestRate || 0) <= 5 && (d.remainingBalance || d.principal || 0) > 0)
      .sort((a, b) => (a.remainingBalance || a.principal || 0) - (b.remainingBalance || b.principal || 0)); // smallest first (snowball)

    for (const debt of lowInterestDebts) {
      if (remaining <= 0) break;
      const balance = debt.remainingBalance || debt.principal || 0;
      const payoff = Math.min(balance, remaining);
      const isFullPayoff = payoff >= balance;
      allocations.push({
        label: isFullPayoff ? `Pay off ${debt.name}` : `Extra on ${debt.name}`,
        emoji: '📉',
        amount: payoff,
        reason: `Low rate but ${isFullPayoff ? 'kills a $' + fmt(debt.monthlyPayment) + '/mo payment entirely' : 'reduces principal faster'}`,
        impact: isFullPayoff ? `One less bill pulling from your accounts` : `Shortens payoff timeline`,
        color: '#ff9f43',
      });
      remaining -= payoff;
    }

    // D. Excess → yield or invest
    if (remaining > 0) {
      const extraYield = (remaining * USD_STAR_APY) / 100 / 12;
      if (bufferGap <= 0) {
        allocations.push({
          label: 'Extra USD* (yield)',
          emoji: '💰',
          amount: remaining,
          reason: 'Buffer is full — park excess for yield instead of 0% in checking',
          impact: `Earns ~$${fmt(extraYield)}/mo passive at ${USD_STAR_APY}% APY`,
          color: '#4ade80',
        });
      } else {
        allocations.push({
          label: 'Deploy to DeFi / Invest',
          emoji: '🎯',
          amount: remaining,
          reason: 'After buffer + debts, put the rest to work',
          impact: 'Grow your portfolio and passive income',
          color: '#60a5fa',
        });
      }
    }

    return {
      show: totalSurplus >= SURPLUS_THRESHOLD || transfers.length > 0,
      accounts: analyses,
      transfers,
      totalSurplus,
      allocations,
    };
  }, [bankAccounts, obligations, debts, assets]);
}

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

export default function SurplusCashPlan() {
  const plan = useSurplusPlan();
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then(val => {
      if (val && Date.now() - parseInt(val) < DISMISS_DURATION) {
        setDismissed(true);
      }
    });
  }, []);

  if (!plan.show || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerEmoji}>💰</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Surplus Cash Detected</Text>
          <Text style={s.headerSub}>
            {plan.totalSurplus > 0
              ? `$${fmt(plan.totalSurplus)} above what your accounts need`
              : 'Some accounts need rebalancing'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Per-account breakdown */}
      <TouchableOpacity onPress={() => setShowDetails(!showDetails)} activeOpacity={0.8}>
        <View style={s.accountsRow}>
          {plan.accounts.map(a => {
            const isOk = a.surplus >= 0;
            return (
              <View key={a.account.id} style={[s.accountPill, isOk ? s.pillOk : s.pillShort]}>
                <Text style={s.accountName} numberOfLines={1}>{a.account.name}</Text>
                <Text style={[s.accountBal, isOk ? s.balOk : s.balShort]}>
                  ${fmt(a.account.currentBalance || 0)}
                </Text>
                <Text style={s.accountNeed}>
                  {isOk
                    ? `+$${fmt(a.surplus)} surplus`
                    : `-$${fmt(Math.abs(a.surplus))} short`}
                </Text>
                <Text style={s.accountBills}>${fmt(a.monthlyBills)}/mo bills</Text>
              </View>
            );
          })}
        </View>
        <Text style={s.tapHint}>{showDetails ? '▲ Hide details' : '▼ Tap for details'}</Text>
      </TouchableOpacity>

      {/* Expanded: per-account bill breakdown */}
      {showDetails && plan.accounts.map(a => (
        a.billNames.length > 0 && (
          <View key={`detail-${a.account.id}`} style={s.detailBox}>
            <Text style={s.detailTitle}>{a.account.name} — {a.account.institution}</Text>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Balance</Text>
              <Text style={s.detailValue}>${fmt(a.account.currentBalance || 0)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Monthly bills</Text>
              <Text style={s.detailValue}>${fmt(a.monthlyBills)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Cushion ({CUSHION_MONTHS}mo)</Text>
              <Text style={s.detailValue}>${fmt(a.cushion)}</Text>
            </View>
            <View style={[s.detailRow, s.detailRowHighlight]}>
              <Text style={s.detailLabel}>{a.surplus >= 0 ? 'Surplus' : 'Shortfall'}</Text>
              <Text style={[s.detailValue, a.surplus >= 0 ? s.surplusText : s.shortText]}>
                {a.surplus >= 0 ? '+' : ''}${fmt(a.surplus)}
              </Text>
            </View>
            {a.billNames.length > 0 && (
              <Text style={s.detailBills}>
                Bills: {a.billNames.slice(0, 5).join(', ')}{a.billNames.length > 5 ? ` +${a.billNames.length - 5} more` : ''}
              </Text>
            )}
          </View>
        )
      ))}

      {/* Cross-account transfers */}
      {plan.transfers.length > 0 && (
        <View style={s.transferSection}>
          <Text style={s.sectionTitle}>🔄 Transfer Between Accounts</Text>
          {plan.transfers.map((t, i) => (
            <View key={i} style={s.transferRow}>
              <View style={s.transferFlow}>
                <Text style={s.transferFrom}>{t.from.name}</Text>
                <Text style={s.transferArrow}>→</Text>
                <Text style={s.transferTo}>{t.to.name}</Text>
              </View>
              <Text style={s.transferAmount}>${fmt(t.amount)}</Text>
              <Text style={s.transferReason}>{t.reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Allocation plan */}
      {plan.allocations.length > 0 && (
        <View style={s.planBox}>
          <Text style={s.sectionTitle}>
            📋 Recommended Plan {plan.totalSurplus > 0 && `· $${fmt(plan.totalSurplus)}`}
          </Text>

          {plan.allocations.map((alloc, i) => (
            <View key={i} style={s.allocRow}>
              <View style={[s.allocDot, { backgroundColor: alloc.color }]} />
              <View style={s.allocContent}>
                <View style={s.allocHeader}>
                  <Text style={s.allocLabel}>
                    {alloc.emoji} {alloc.label}
                  </Text>
                  <Text style={[s.allocAmount, { color: alloc.color }]}>
                    ${fmt(alloc.amount)}
                  </Text>
                </View>
                <Text style={s.allocReason}>{alloc.reason}</Text>
                <Text style={s.allocImpact}>↗ {alloc.impact}</Text>
              </View>
            </View>
          ))}

          {/* Visual bar */}
          {plan.totalSurplus > 0 && (
            <View style={s.barContainer}>
              {plan.allocations.map((alloc, i) => (
                <View
                  key={i}
                  style={[
                    s.barSegment,
                    {
                      backgroundColor: alloc.color,
                      flex: alloc.amount / plan.totalSurplus,
                    },
                    i === 0 && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
                    i === plan.allocations.length - 1 && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={s.footerHint}>Dismisses for 3 days · Reappears when balances change</Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container: {
    backgroundColor: '#0c1a10',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4ade8044',
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerEmoji: { fontSize: 24 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#4ade80' },
  headerSub: { fontSize: 13, color: '#a0c0a0', marginTop: 2 },
  dismiss: { fontSize: 14, color: '#666', padding: 6, backgroundColor: '#ffffff10', borderRadius: 12, overflow: 'hidden' },

  // Per-account row
  accountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  accountPill: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  pillOk: { backgroundColor: '#0a1a10', borderColor: '#4ade8030' },
  pillShort: { backgroundColor: '#1a0e10', borderColor: '#ff6b6b30' },
  accountName: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 4 },
  accountBal: { fontSize: 16, fontWeight: '800' },
  balOk: { color: '#ffffff' },
  balShort: { color: '#ff6b6b' },
  accountNeed: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  accountBills: { fontSize: 10, color: '#666', marginTop: 2 },
  tapHint: { fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 10, marginTop: 4 },

  // Detail expansion
  detailBox: {
    backgroundColor: '#0a1210',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a2040',
  },
  detailTitle: { fontSize: 13, fontWeight: '700', color: '#e0e0e0', marginBottom: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailRowHighlight: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1a2040',
  },
  detailLabel: { fontSize: 12, color: '#888' },
  detailValue: { fontSize: 12, fontWeight: '700', color: '#fff' },
  surplusText: { color: '#4ade80' },
  shortText: { color: '#ff6b6b' },
  detailBills: { fontSize: 10, color: '#555', marginTop: 6 },

  // Transfers
  transferSection: {
    backgroundColor: '#0a1018',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#60a5fa30',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#60a5fa', marginBottom: 10 },
  transferRow: {
    marginBottom: 10,
  },
  transferFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  transferFrom: { fontSize: 13, color: '#ff9f43', fontWeight: '700' },
  transferArrow: { fontSize: 14, color: '#60a5fa', fontWeight: '800' },
  transferTo: { fontSize: 13, color: '#4ade80', fontWeight: '700' },
  transferAmount: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 2 },
  transferReason: { fontSize: 11, color: '#888' },

  // Allocation plan
  planBox: {
    backgroundColor: '#0a1210',
    borderRadius: 12,
    padding: 14,
  },
  allocRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  allocDot: {
    width: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  allocContent: { flex: 1 },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  allocLabel: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  allocAmount: { fontSize: 14, fontWeight: '800' },
  allocReason: { fontSize: 12, color: '#a0a0a0', lineHeight: 17 },
  allocImpact: { fontSize: 11, color: '#4ade8090', marginTop: 2, fontStyle: 'italic' },

  // Bar
  barContainer: {
    flexDirection: 'row',
    height: 8,
    gap: 2,
    marginTop: 8,
  },
  barSegment: {
    height: '100%',
  },

  // Footer
  footerHint: { fontSize: 10, color: '#444', textAlign: 'center', marginTop: 10 },
});
