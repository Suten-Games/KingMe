// src/services/tradeInsights.ts
// Pure analysis — mines DriftTrade[] for patterns and behavioral signals
import type { DriftTrade } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'tip' | 'positive';

export interface TradeInsight {
  id: string;                              // 'insight-{category}-{timestamp}'
  category: string;                        // win_rate, risk_reward, losing_streak, etc.
  severity: InsightSeverity;
  title: string;
  message: string;
  detail?: string;                         // expandable deeper stats
  emoji: string;
  stats?: Record<string, string | number>;
}

// ─── Severity colors (matches app palette) ───────────────────────────────────

export function getInsightColor(severity: InsightSeverity): {
  bg: string; border: string; text: string; gradient: [string, string, string];
} {
  switch (severity) {
    case 'critical': return {
      bg: '#3a0e0e', border: '#ff6b6b80', text: '#ff8a8a',
      gradient: ['#3a0e0e', '#2a0808', '#0a0e1a'],
    };
    case 'warning': return {
      bg: '#3a2a0e', border: '#ffa04080', text: '#ffb060',
      gradient: ['#3a2a0e', '#2a1a06', '#0a0e1a'],
    };
    case 'tip': return {
      bg: '#0e2a3a', border: '#60a5fa80', text: '#80c0ff',
      gradient: ['#0e2a3a', '#081a2a', '#0a0e1a'],
    };
    case 'positive': return {
      bg: '#1a2a1a', border: '#4ade8080', text: '#80c0a0',
      gradient: ['#1a2a1a', '#0e1a0e', '#0a0e1a'],
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, warning: 1, tip: 2, positive: 3,
};

const NOW = () => Date.now();

function pct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(0)}%`;
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function isWin(t: DriftTrade): boolean { return t.pnlUsdc > 0; }
function isLoss(t: DriftTrade): boolean { return t.pnlUsdc < 0; }

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function weekOf(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateTradeInsights(trades: DriftTrade[]): TradeInsight[] {
  if (trades.length < 5) return [];

  // Sort ascending by date
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const insights: TradeInsight[] = [];
  const analyzers = [
    analyzeWinRate,
    analyzeRiskReward,
    analyzeAssetPerformance,
    analyzeDirectionPerformance,
    detectOvertrading,
    detectLosingStreak,
    analyzeSizeVsPerformance,
    detectTilt,
    generateFocusRecommendation,
    analyzeAllocationHabits,
  ];

  for (const analyze of analyzers) {
    const result = analyze(sorted);
    if (result) {
      if (Array.isArray(result)) {
        insights.push(...result);
      } else {
        insights.push(result);
      }
    }
  }

  insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return insights;
}

// ─── Analyzers ───────────────────────────────────────────────────────────────

function analyzeWinRate(trades: DriftTrade[]): TradeInsight | null {
  const wins = trades.filter(isWin).length;
  const total = trades.length;
  const winRate = pct(wins, total);
  const ts = NOW();

  // Check month-over-month trend
  const byMonth = new Map<string, DriftTrade[]>();
  for (const t of trades) {
    const m = monthOf(t.date);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(t);
  }
  const months = [...byMonth.keys()].sort();

  let declining = false;
  if (months.length >= 2) {
    const prev = byMonth.get(months[months.length - 2])!;
    const curr = byMonth.get(months[months.length - 1])!;
    const prevRate = pct(prev.filter(isWin).length, prev.length);
    const currRate = pct(curr.filter(isWin).length, curr.length);
    if (prevRate - currRate > 10) declining = true;
  }

  if (winRate < 40) {
    return {
      id: `insight-win_rate-${ts}`,
      category: 'win_rate',
      severity: 'critical',
      title: 'Win rate below 40%',
      message: `Only winning ${winRate.toFixed(0)}% of trades (${wins}/${total}). Your edge may have eroded.`,
      detail: `Review your last 10 trades. Are you following your setup criteria or taking impulsive entries?`,
      emoji: '🚨',
      stats: { 'Win Rate': `${winRate.toFixed(1)}%`, 'Wins': wins, 'Losses': total - wins },
    };
  }

  if (declining) {
    const prev = byMonth.get(months[months.length - 2])!;
    const curr = byMonth.get(months[months.length - 1])!;
    const prevRate = pct(prev.filter(isWin).length, prev.length);
    const currRate = pct(curr.filter(isWin).length, curr.length);
    return {
      id: `insight-win_rate-${ts}`,
      category: 'win_rate',
      severity: 'warning',
      title: 'Win rate declining',
      message: `Win rate dropped from ${prevRate.toFixed(0)}% to ${currRate.toFixed(0)}% this month.`,
      detail: `A 10%+ drop often signals changing market conditions or strategy drift. Review what changed.`,
      emoji: '📉',
      stats: { 'Last Month': `${prevRate.toFixed(0)}%`, 'This Month': `${currRate.toFixed(0)}%` },
    };
  }

  if (winRate >= 60) {
    return {
      id: `insight-win_rate-${ts}`,
      category: 'win_rate',
      severity: 'positive',
      title: `${winRate.toFixed(0)}% win rate`,
      message: `Winning ${wins} of ${total} trades. Your edge is working — keep doing what you're doing.`,
      emoji: '🎯',
      stats: { 'Win Rate': `${winRate.toFixed(1)}%`, 'Wins': wins, 'Trades': total },
    };
  }

  return null;
}

function analyzeRiskReward(trades: DriftTrade[]): TradeInsight | null {
  const wins = trades.filter(isWin);
  const losses = trades.filter(isLoss);
  if (wins.length === 0 || losses.length === 0) return null;

  const avgWin = wins.reduce((s, t) => s + t.pnlUsdc, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsdc, 0) / losses.length);
  if (avgLoss === 0) return null;

  const rr = avgWin / avgLoss;
  const ts = NOW();

  if (rr < 1.0) {
    return {
      id: `insight-risk_reward-${ts}`,
      category: 'risk_reward',
      severity: 'warning',
      title: `Risk/reward ratio: ${rr.toFixed(2)}`,
      message: `Average win (${fmtDollar(avgWin)}) is smaller than average loss (${fmtDollar(avgLoss)}). You need a high win rate to stay profitable.`,
      detail: `Target R:R of 1.5+ by cutting losses faster or holding winners longer.`,
      emoji: '⚖️',
      stats: { 'Avg Win': fmtDollar(avgWin), 'Avg Loss': fmtDollar(avgLoss), 'R:R': rr.toFixed(2) },
    };
  }

  if (rr < 1.5) {
    return {
      id: `insight-risk_reward-${ts}`,
      category: 'risk_reward',
      severity: 'tip',
      title: `R:R ratio could improve (${rr.toFixed(2)})`,
      message: `Avg win ${fmtDollar(avgWin)} vs avg loss ${fmtDollar(avgLoss)}. Tighten stops or let winners run.`,
      emoji: '💡',
      stats: { 'Avg Win': fmtDollar(avgWin), 'Avg Loss': fmtDollar(avgLoss), 'R:R': rr.toFixed(2) },
    };
  }

  if (rr >= 2.0) {
    return {
      id: `insight-risk_reward-${ts}`,
      category: 'risk_reward',
      severity: 'positive',
      title: `Strong risk/reward: ${rr.toFixed(1)}R`,
      message: `Winning ${fmtDollar(avgWin)} per win vs ${fmtDollar(avgLoss)} per loss. Great risk management.`,
      emoji: '💪',
      stats: { 'Avg Win': fmtDollar(avgWin), 'Avg Loss': fmtDollar(avgLoss), 'R:R': rr.toFixed(2) },
    };
  }

  return null;
}

function analyzeAssetPerformance(trades: DriftTrade[]): TradeInsight[] | null {
  const byAsset = new Map<string, DriftTrade[]>();
  for (const t of trades) {
    if (!byAsset.has(t.asset)) byAsset.set(t.asset, []);
    byAsset.get(t.asset)!.push(t);
  }

  // Need at least 2 assets with 3+ trades each
  const qualified = [...byAsset.entries()].filter(([_, ts]) => ts.length >= 3);
  if (qualified.length < 2) return null;

  const assetStats = qualified.map(([asset, ts]) => {
    const totalPnl = ts.reduce((s, t) => s + t.pnlUsdc, 0);
    const wr = pct(ts.filter(isWin).length, ts.length);
    return { asset, totalPnl, winRate: wr, count: ts.length };
  });

  assetStats.sort((a, b) => b.totalPnl - a.totalPnl);
  const best = assetStats[0];
  const worst = assetStats[assetStats.length - 1];
  const ts = NOW();
  const results: TradeInsight[] = [];

  results.push({
    id: `insight-best_asset-${ts}`,
    category: 'best_asset',
    severity: 'positive',
    title: `${best.asset} is your best asset`,
    message: `${fmtDollar(best.totalPnl)} profit across ${best.count} trades (${best.winRate.toFixed(0)}% win rate).`,
    detail: `Consider increasing allocation to ${best.asset} setups when conditions align.`,
    emoji: '🏆',
    stats: { 'PnL': fmtDollar(best.totalPnl), 'Win Rate': `${best.winRate.toFixed(0)}%`, 'Trades': best.count },
  });

  if (worst.totalPnl < 0) {
    results.push({
      id: `insight-worst_asset-${ts}`,
      category: 'worst_asset',
      severity: 'warning',
      title: `${worst.asset} is bleeding money`,
      message: `${fmtDollar(worst.totalPnl)} over ${worst.count} trades (${worst.winRate.toFixed(0)}% win rate).`,
      detail: `Consider reducing size on ${worst.asset} or taking a break from it until conditions improve.`,
      emoji: '🩸',
      stats: { 'PnL': fmtDollar(worst.totalPnl), 'Win Rate': `${worst.winRate.toFixed(0)}%`, 'Trades': worst.count },
    });
  }

  return results.length > 0 ? results : null;
}

function analyzeDirectionPerformance(trades: DriftTrade[]): TradeInsight | null {
  const longs = trades.filter(t => t.direction === 'long');
  const shorts = trades.filter(t => t.direction === 'short');
  if (longs.length < 3 || shorts.length < 3) return null;

  const longWR = pct(longs.filter(isWin).length, longs.length);
  const shortWR = pct(shorts.filter(isWin).length, shorts.length);
  const gap = Math.abs(longWR - shortWR);

  if (gap < 15) return null;

  const better = longWR > shortWR ? 'long' : 'short';
  const worse = better === 'long' ? 'short' : 'long';
  const betterWR = better === 'long' ? longWR : shortWR;
  const worseWR = better === 'long' ? shortWR : longWR;

  return {
    id: `insight-direction-${NOW()}`,
    category: 'direction',
    severity: 'tip',
    title: `You're better going ${better}`,
    message: `${better.charAt(0).toUpperCase() + better.slice(1)} win rate: ${betterWR.toFixed(0)}% vs ${worse}: ${worseWR.toFixed(0)}%.`,
    detail: `Consider sizing down on ${worse} trades or skipping low-conviction ${worse} setups.`,
    emoji: better === 'long' ? '📈' : '📉',
    stats: { 'Long WR': `${longWR.toFixed(0)}%`, 'Short WR': `${shortWR.toFixed(0)}%`, 'Gap': `${gap.toFixed(0)}%` },
  };
}

function detectOvertrading(trades: DriftTrade[]): TradeInsight | null {
  const byWeek = new Map<string, DriftTrade[]>();
  for (const t of trades) {
    const w = weekOf(t.date);
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w)!.push(t);
  }

  const weeks = [...byWeek.keys()].sort();
  if (weeks.length < 3) return null;

  // Average of all weeks except the current one
  const currentWeek = weeks[weeks.length - 1];
  const priorWeeks = weeks.slice(0, -1);
  const avgCount = priorWeeks.reduce((s, w) => s + byWeek.get(w)!.length, 0) / priorWeeks.length;
  const currentCount = byWeek.get(currentWeek)!.length;

  if (avgCount > 0 && currentCount > avgCount * 1.5) {
    return {
      id: `insight-overtrading-${NOW()}`,
      category: 'overtrading',
      severity: 'warning',
      title: 'Overtrading this week',
      message: `${currentCount} trades this week vs your average of ${avgCount.toFixed(1)}/week. More trades ≠ more profit.`,
      detail: `Quality over quantity. Are all these setups A+ or are you forcing trades?`,
      emoji: '⚡',
      stats: { 'This Week': currentCount, 'Avg/Week': avgCount.toFixed(1), 'Over By': `${((currentCount / avgCount - 1) * 100).toFixed(0)}%` },
    };
  }

  return null;
}

function detectLosingStreak(trades: DriftTrade[]): TradeInsight | null {
  // Check for active streak at the end
  let streak = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (isLoss(trades[i])) streak++;
    else break;
  }

  if (streak < 3) return null;

  const streakTrades = trades.slice(-streak);
  const totalLoss = streakTrades.reduce((s, t) => s + t.pnlUsdc, 0);

  return {
    id: `insight-losing_streak-${NOW()}`,
    category: 'losing_streak',
    severity: streak >= 5 ? 'critical' : 'warning',
    title: `${streak}-trade losing streak`,
    message: `Last ${streak} trades all losers (${fmtDollar(totalLoss)}). Consider pausing to reset.`,
    detail: streak >= 5
      ? `5+ losses in a row is a red flag. Step away, review your journal, and come back with fresh eyes.`
      : `3+ losses can trigger tilt. Reduce size on your next trade or take the day off.`,
    emoji: streak >= 5 ? '🛑' : '🔥',
    stats: { 'Streak': streak, 'Total Loss': fmtDollar(totalLoss) },
  };
}

function analyzeSizeVsPerformance(trades: DriftTrade[]): TradeInsight | null {
  const sizes = trades.map(t => t.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  if (median === 0) return null;

  const small = trades.filter(t => t.size <= median);
  const large = trades.filter(t => t.size > median);
  if (small.length < 3 || large.length < 3) return null;

  const smallWR = pct(small.filter(isWin).length, small.length);
  const largeWR = pct(large.filter(isWin).length, large.length);

  if (smallWR - largeWR > 10) {
    return {
      id: `insight-size_performance-${NOW()}`,
      category: 'size_performance',
      severity: 'warning',
      title: 'Large trades underperform',
      message: `Small trades win ${smallWR.toFixed(0)}% vs large trades at ${largeWR.toFixed(0)}%. Size may be affecting your decisions.`,
      detail: `Larger positions create more emotional pressure, leading to earlier exits or wider stops. Consider scaling in instead of going big upfront.`,
      emoji: '📏',
      stats: { 'Small WR': `${smallWR.toFixed(0)}%`, 'Large WR': `${largeWR.toFixed(0)}%`, 'Median Size': fmtDollar(median) },
    };
  }

  return null;
}

function detectTilt(trades: DriftTrade[]): TradeInsight | null {
  // Look for: loss followed by 2+ trades within 2 hours that are also losses
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  let latestTilt: { triggerIdx: number; revengeCount: number; totalLoss: number } | null = null;

  for (let i = 0; i < trades.length - 2; i++) {
    if (!isLoss(trades[i])) continue;

    const triggerTime = new Date(trades[i].date).getTime();
    let revengeCount = 0;
    let revengeLoss = 0;

    for (let j = i + 1; j < trades.length; j++) {
      const nextTime = new Date(trades[j].date).getTime();
      if (nextTime - triggerTime > TWO_HOURS) break;
      if (isLoss(trades[j])) {
        revengeCount++;
        revengeLoss += trades[j].pnlUsdc;
      }
    }

    if (revengeCount >= 2) {
      latestTilt = {
        triggerIdx: i,
        revengeCount,
        totalLoss: trades[i].pnlUsdc + revengeLoss,
      };
    }
  }

  if (!latestTilt) return null;

  const triggerDate = new Date(trades[latestTilt.triggerIdx].date).getTime();
  const isRecent = Date.now() - triggerDate < SEVEN_DAYS;

  return {
    id: `insight-tilt-${NOW()}`,
    category: 'tilt',
    severity: isRecent ? 'critical' : 'warning',
    title: isRecent ? 'Tilt detected — revenge trading' : 'Tilt pattern in recent history',
    message: `After a loss, you fired ${latestTilt.revengeCount} more trades within 2 hours — all losers (${fmtDollar(latestTilt.totalLoss)}).`,
    detail: isRecent
      ? `This just happened. Walk away. No more trades today. Your next trade should be tomorrow with a clear plan.`
      : `You've shown a pattern of revenge trading after losses. Add a rule: after any loss, wait 2 hours minimum.`,
    emoji: isRecent ? '😤' : '⚠️',
    stats: { 'Revenge Trades': latestTilt.revengeCount, 'Total Loss': fmtDollar(latestTilt.totalLoss) },
  };
}

function generateFocusRecommendation(trades: DriftTrade[]): TradeInsight | null {
  // Find best asset + direction combo with 5+ trades
  const combos = new Map<string, DriftTrade[]>();
  for (const t of trades) {
    const key = `${t.asset}-${t.direction}`;
    if (!combos.has(key)) combos.set(key, []);
    combos.get(key)!.push(t);
  }

  const qualified = [...combos.entries()]
    .filter(([_, ts]) => ts.length >= 5)
    .map(([key, ts]) => {
      const [asset, direction] = key.split('-');
      const totalPnl = ts.reduce((s, t) => s + t.pnlUsdc, 0);
      const wr = pct(ts.filter(isWin).length, ts.length);
      return { asset, direction, totalPnl, winRate: wr, count: ts.length };
    })
    .filter(c => c.totalPnl > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);

  if (qualified.length === 0) return null;

  const best = qualified[0];
  return {
    id: `insight-focus-${NOW()}`,
    category: 'focus',
    severity: 'positive',
    title: `Best edge: ${best.asset} ${best.direction}s`,
    message: `${fmtDollar(best.totalPnl)} profit from ${best.count} trades at ${best.winRate.toFixed(0)}% win rate.`,
    detail: `This is your highest-conviction setup. Consider sizing up here and reducing bets elsewhere.`,
    emoji: '🎯',
    stats: {
      'PnL': fmtDollar(best.totalPnl),
      'Win Rate': `${best.winRate.toFixed(0)}%`,
      'Trades': best.count,
    },
  };
}

function analyzeAllocationHabits(trades: DriftTrade[]): TradeInsight | null {
  const winners = trades.filter(t => isWin(t) && t.allocation);
  if (winners.length < 3) return null;

  const totalProfit = winners.reduce((s, t) => s + t.pnlUsdc, 0);
  const totalLeftInDrift = winners.reduce((s, t) => s + (t.allocation?.leftInDrift || 0), 0);

  if (totalProfit <= 0) return null;
  const driftPct = pct(totalLeftInDrift, totalProfit);

  if (driftPct > 60) {
    return {
      id: `insight-allocation-${NOW()}`,
      category: 'allocation',
      severity: 'tip',
      title: `${driftPct.toFixed(0)}% of profits stay in Drift`,
      message: `You're compounding ${fmtDollar(totalLeftInDrift)} of ${fmtDollar(totalProfit)} in profits back into trading.`,
      detail: `Compounding is powerful but also increases risk. Consider extracting 30-50% to bank/crypto to lock in real gains.`,
      emoji: '🔄',
      stats: {
        'Left in Drift': fmtDollar(totalLeftInDrift),
        'Total Profit': fmtDollar(totalProfit),
        'Drift %': `${driftPct.toFixed(0)}%`,
      },
    };
  }

  return null;
}
