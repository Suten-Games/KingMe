// src/services/positionAlerts.ts
// Smart alert engine — scans your positions and surfaces actionable recommendations
import type { Asset, CryptoAsset } from '../types';
import { TokenPriceData } from './priceTracker';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertPriority = 'urgent' | 'high' | 'medium' | 'low';
export type AlertAction = 'trim' | 'sell' | 'stop_loss' | 'take_profit' | 'deploy_yield' | 'rebalance' | 'buy_dip' | 'watch' | 'accumulate';

export interface PositionAlert {
  id: string;
  assetId: string;
  assetName: string;
  symbol: string;
  mint: string;
  priority: AlertPriority;
  action: AlertAction;
  title: string;
  message: string;
  detail: string;
  emoji: string;
  actionLabel: string;      // Button text
  actionParams?: any;       // For routing to swap/action
  value: number;            // Current position value
  change: number | null;    // 24h change %
  timestamp: number;
  dismissed?: boolean;
  hasAccPlan?: boolean;     // Whether this asset has an accumulation plan
}

// Accumulation plan context — lightweight info passed from plans
export interface AccPlanContext {
  mint: string;
  symbol: string;
  targetAmount: number;
  currentHolding: number;
  avgEntry: number;          // cost basis / avg buy price
  progressPct: number;
  strategy: 'accumulate' | 'extract';
}

// ─── Configuration ───────────────────────────────────────────────────────────

const THRESHOLDS = {
  // Pump alerts
  PUMP_1H: 15,           // +15% in 1 hour → urgent trim
  PUMP_24H: 30,          // +30% in 24h → take profit
  PUMP_24H_MODERATE: 15, // +15% in 24h → consider trimming
  PUMP_7D: 50,           // +50% in 7d → strong take profit

  // Dump alerts
  DUMP_1H: -10,          // -10% in 1 hour → urgent: set stop loss
  DUMP_24H: -20,         // -20% in 24h → consider cutting
  DUMP_FROM_ATH: -30,    // -30% from ATH → you're riding it down

  // Position sizing
  CONCENTRATED: 25,      // >25% of portfolio in one token
  LARGE_POSITION: 15,    // >15% of portfolio → watch closely

  // Minimum values to alert on
  MIN_VALUE: 50,         // Don't alert on dust positions
  MIN_VALUE_FOR_TRIM: 200, // Need at least $200 to suggest trimming
};

// Stablecoins and yield tokens — don't alert on price swings
const STABLE_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',   // USD*
]);

// Formatting helpers
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPrice(p: number): string {
  if (p < 0.001) return p.toExponential(2);
  if (p < 1) return p.toFixed(4);
  return p.toFixed(2);
}

// ─── Alert Generator ─────────────────────────────────────────────────────────

export function generatePositionAlerts(
  assets: Asset[],
  priceData: Record<string, TokenPriceData>,
  accPlans?: AccPlanContext[],
  context?: { kaminoRates?: Record<string, { supplyApr: number; borrowApr: number; tvl: number }> },
): PositionAlert[] {
  const alerts: PositionAlert[] = [];
  const now = Date.now();

  // Index accumulation plans by mint for quick lookup
  const plansByMint: Record<string, AccPlanContext> = {};
  if (accPlans) {
    for (const p of accPlans) { plansByMint[p.mint] = p; }
  }

  // Get crypto assets only
  const cryptoAssets = assets.filter(a => a.type === 'crypto' && a.value >= THRESHOLDS.MIN_VALUE);
  const totalPortfolioValue = cryptoAssets.reduce((sum, a) => sum + a.value, 0);

  for (const asset of cryptoAssets) {
    const meta = asset.metadata as CryptoAsset;
    const mint = meta.tokenMint || meta.mint || '';
    const symbol = meta.symbol || asset.name;

    const isStable = STABLE_MINTS.has(mint);
    const price = priceData[mint];

    // Stablecoins: skip price-based alerts but still check idle capital
    if (isStable) {
      // ── Idle stablecoin — suggest yield deployment ───────────────
      if (asset.value >= 100 && asset.annualIncome === 0) {
        const kaminoRate = (context as any)?.kaminoRates?.['USDC'] || (context as any)?.kaminoRates?.[symbol];
        const kaminoApy = kaminoRate?.supplyApr || 0;
        const monthlyYield = asset.value * (kaminoApy || 9.3) / 100 / 12;

        alerts.push({
          id: `idle-stable-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: asset.value >= 500 ? 'high' : 'medium',
          action: 'deploy_yield',
          title: `$${fmtNum(asset.value)} ${symbol} sitting idle`,
          message: `Put your ${symbol} to work earning yield.`,
          detail: kaminoApy > 0
            ? `Deposit to Kamino Lend for ${kaminoApy.toFixed(1)}% APY (+$${monthlyYield.toFixed(0)}/mo).`
            : `Deploy to Perena USD* (9.3% APY) or Kamino Lend for yield (+$${monthlyYield.toFixed(0)}/mo).`,
          emoji: '💰',
          actionLabel: kaminoApy > 0 ? `Lend on Kamino (${kaminoApy.toFixed(1)}%)` : 'Earn Yield',
          actionParams: kaminoApy > 0
            ? { type: 'kamino_deposit', mint, symbol }
            : { type: 'deposit', protocol: 'perena' },
          value: asset.value, change: null, timestamp: now,
        });
      }
      continue;
    }

    if (!price) continue;

    const positionPct = totalPortfolioValue > 0
      ? (asset.value / totalPortfolioValue) * 100
      : 0;

    // Check for accumulation plan
    const plan = plansByMint[mint];
    const isAccumulating = plan && plan.strategy === 'accumulate';
    const belowEntry = isAccumulating && plan.avgEntry > 0 && price.currentPrice < plan.avgEntry;
    const aboveEntry = isAccumulating && plan.avgEntry > 0 && price.currentPrice >= plan.avgEntry;
    const pctFromEntry = isAccumulating && plan.avgEntry > 0
      ? ((price.currentPrice - plan.avgEntry) / plan.avgEntry) * 100
      : 0;

    // ── Helper: plan-aware formatting ──────────────────────────────
    const fmtVal = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const planTag = isAccumulating ? ` (${plan.progressPct.toFixed(0)}% to ${fmtNum(plan.targetAmount)} target)` : '';

    // ── 1. Rapid pump (1h) — URGENT ──────────────────────────────────
    if (price.change1h !== null && price.change1h >= THRESHOLDS.PUMP_1H) {
      if (isAccumulating && aboveEntry) {
        // Accumulating + above entry → trim to lower cost basis
        alerts.push({
          id: `pump-1h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'urgent',
          action: 'trim',
          title: `${symbol} pumping +${price.change1h.toFixed(0)}% in 1 hour`,
          message: `+${pctFromEntry.toFixed(0)}% above your $${fmtPrice(plan.avgEntry)} entry. Trim to lower cost basis, buy back on the dip.`,
          detail: `Sell some → lock profit → wait for pullback → accumulate more tokens at a lower avg.${planTag}`,
          emoji: '🎯',
          actionLabel: 'Trim & Reload',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 25 },
          value: asset.value, change: price.change1h, timestamp: now, hasAccPlan: true,
        });
      } else {
        alerts.push({
          id: `pump-1h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'urgent',
          action: 'trim',
          title: `${symbol} pumping +${price.change1h.toFixed(0)}% in 1 hour`,
          message: `Rapid pump detected. Consider trimming while it's hot.`,
          detail: `$${fmtVal(asset.value)} position. Sell 25-50% and rebuy if it dips.`,
          emoji: '🚀',
          actionLabel: 'Trim 25%',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 25 },
          value: asset.value, change: price.change1h, timestamp: now,
        });
      }
    }

    // ── 2. Strong pump (24h) — take profit ───────────────────────────
    if (price.change24h !== null && price.change24h >= THRESHOLDS.PUMP_24H && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      if (isAccumulating && aboveEntry) {
        alerts.push({
          id: `pump-24h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'high',
          action: 'take_profit',
          title: `${symbol} up +${price.change24h.toFixed(0)}% today`,
          message: `+${pctFromEntry.toFixed(0)}% above entry. Take profit → lower cost basis → re-accumulate on pullback.`,
          detail: `Strong day while you're still building. Sell some to lock gains and buy more tokens cheaper next dip.${planTag}`,
          emoji: '🎯',
          actionLabel: 'Take Profit & Reload',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 30 },
          value: asset.value, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      } else {
        alerts.push({
          id: `pump-24h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'high',
          action: 'take_profit',
          title: `${symbol} up +${price.change24h.toFixed(0)}% today`,
          message: `Strong day. Lock in gains before a pullback.`,
          detail: `Your $${fmtVal(asset.value)} is worth ${price.change24h.toFixed(0)}% more than yesterday. Take some off the table.`,
          emoji: '💰',
          actionLabel: 'Take Profit',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 30 },
          value: asset.value, change: price.change24h, timestamp: now,
        });
      }
    }
    // Moderate 24h pump
    else if (price.change24h !== null && price.change24h >= THRESHOLDS.PUMP_24H_MODERATE && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      alerts.push({
        id: `pump-mod-${mint}-${now}`,
        assetId: asset.id, assetName: asset.name, symbol, mint,
        priority: 'medium',
        action: 'watch',
        title: `${symbol} up +${price.change24h.toFixed(0)}% today`,
        message: isAccumulating && aboveEntry
          ? `+${pctFromEntry.toFixed(0)}% above your entry. Monitor for trim opportunity.`
          : `Nice move. Keep an eye on it.`,
        detail: isAccumulating
          ? `$${fmtVal(asset.value)} position.${planTag}`
          : `$${fmtVal(asset.value)} position. Consider setting a mental stop-loss.`,
        emoji: '📈',
        actionLabel: 'Set Alert',
        value: asset.value, change: price.change24h, timestamp: now, hasAccPlan: !!isAccumulating,
      });
    }

    // ── 3. 7-day rally — strong take profit ──────────────────────────
    if (price.change7d !== null && price.change7d >= THRESHOLDS.PUMP_7D && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      const has24hAlert = alerts.some(a => a.mint === mint && (a.action === 'take_profit' || a.action === 'trim'));
      if (!has24hAlert) {
        alerts.push({
          id: `rally-7d-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'high',
          action: 'take_profit',
          title: `${symbol} up +${price.change7d.toFixed(0)}% this week`,
          message: isAccumulating && aboveEntry
            ? `Massive run. Trim some → lower cost basis → accumulate more on pullback.`
            : `Massive weekly run. Don't ride it back down.`,
          detail: isAccumulating
            ? `You're +${pctFromEntry.toFixed(0)}% above entry. Sell some to lock gains and buy back cheaper.${planTag}`
            : `Remember: pigs get slaughtered. Take 25-50% off the table and buy back on a dip.`,
          emoji: isAccumulating ? '🎯' : '🐷',
          actionLabel: isAccumulating ? 'Trim & Reload' : 'Take 25% Profit',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 25 },
          value: asset.value, change: price.change7d, timestamp: now, hasAccPlan: !!isAccumulating,
        });
      }
    }

    // ── 4. Rapid dump (1h) — URGENT ──────────────────────────────────
    if (price.change1h !== null && price.change1h <= THRESHOLDS.DUMP_1H) {
      if (isAccumulating && belowEntry) {
        // Accumulating + below entry → this is an opportunity
        alerts.push({
          id: `dump-1h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'high', // downgrade from urgent — dump is expected for accumulators
          action: 'accumulate',
          title: `${symbol} dropping ${price.change1h.toFixed(0)}% — accumulation zone`,
          message: `${pctFromEntry.toFixed(0)}% below your $${fmtPrice(plan.avgEntry)} avg. Flash dip = chance to lower your cost basis.`,
          detail: `If your thesis holds, this is the price you wished you'd bought at.${planTag}`,
          emoji: '🎯',
          actionLabel: 'Log Buy',
          value: asset.value, change: price.change1h, timestamp: now, hasAccPlan: true,
        });
      } else {
        alerts.push({
          id: `dump-1h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'urgent',
          action: 'stop_loss',
          title: `${symbol} dropping ${price.change1h.toFixed(0)}% in 1 hour`,
          message: `Rapid sell-off. Protect your position.`,
          detail: `$${fmtVal(asset.value)} at risk. Consider selling to USDC and rebuying lower.`,
          emoji: '🔻',
          actionLabel: 'Sell to USDC',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 100 },
          value: asset.value, change: price.change1h, timestamp: now,
        });
      }
    }

    // ── 5. Significant dump (24h) ────────────────────────────────────
    if (price.change24h !== null && price.change24h <= THRESHOLDS.DUMP_24H && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      if (isAccumulating && belowEntry) {
        alerts.push({
          id: `dump-24h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'medium', // downgrade — accumulators expect dips
          action: 'accumulate',
          title: `${symbol} down ${Math.abs(price.change24h).toFixed(0)}% — deep discount`,
          message: `${Math.abs(pctFromEntry).toFixed(0)}% below your entry. Add more to lower your avg?`,
          detail: `Your avg buy is $${fmtPrice(plan.avgEntry)}. Current: $${fmtPrice(price.currentPrice)}. Buying here lowers your cost basis.${planTag}`,
          emoji: '🔥',
          actionLabel: 'Log Buy',
          value: asset.value, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      } else {
        alerts.push({
          id: `dump-24h-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'high',
          action: 'sell',
          title: `${symbol} down ${price.change24h.toFixed(0)}% today`,
          message: `Significant decline. Cut losses or hold conviction.`,
          detail: `Your position went from $${fmtVal(asset.value / (1 + price.change24h / 100))} to $${fmtVal(asset.value)}. Do you still believe in this?`,
          emoji: '📉',
          actionLabel: 'Cut Losses',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 100 },
          value: asset.value, change: price.change24h, timestamp: now,
        });
      }
    }

    // ── 6. Falling from ATH — you're riding it down ──────────────────
    if (price.fromATH !== null && price.fromATH <= THRESHOLDS.DUMP_FROM_ATH && price.allTimeHigh && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      const peakValue = (asset.value / price.currentPrice) * price.allTimeHigh;
      const lostValue = peakValue - asset.value;

      if (lostValue > 100) {
        const hasOtherAlert = alerts.some(a => a.mint === mint && (a.action === 'sell' || a.action === 'stop_loss' || a.action === 'accumulate'));
        if (!hasOtherAlert) {
          if (isAccumulating && belowEntry) {
            alerts.push({
              id: `ath-fall-${mint}-${now}`,
              assetId: asset.id, assetName: asset.name, symbol, mint,
              priority: 'low', // downgrade — expected for accumulators buying dips
              action: 'accumulate',
              title: `${symbol} is ${Math.abs(price.fromATH).toFixed(0)}% off its high`,
              message: `Below your $${fmtPrice(plan.avgEntry)} avg entry. Accumulation zone if thesis intact.`,
              detail: `Price pulled back from ATH. You're building toward ${fmtNum(plan.targetAmount)} ${plan.symbol} — dips are your friend.${planTag}`,
              emoji: '🎯',
              actionLabel: 'Review Plan',
              value: asset.value, change: price.fromATH, timestamp: now, hasAccPlan: true,
            });
          } else {
            alerts.push({
              id: `ath-fall-${mint}-${now}`,
              assetId: asset.id, assetName: asset.name, symbol, mint,
              priority: 'medium',
              action: 'sell',
              title: `${symbol} is ${Math.abs(price.fromATH).toFixed(0)}% off its high`,
              message: `You could have had $${fmtVal(peakValue)}. Now it's $${fmtVal(asset.value)}.`,
              detail: `That's $${fmtVal(lostValue)} left on the table. Consider selling and rebuying at support.`,
              emoji: '🎢',
              actionLabel: 'Review Position',
              value: asset.value, change: price.fromATH, timestamp: now,
            });
          }
        }
      }
    }

    // ── 7. Concentrated position ─────────────────────────────────────
    if (positionPct >= THRESHOLDS.CONCENTRATED) {
      if (isAccumulating) {
        // Accumulating — concentration is intentional but still risky
        alerts.push({
          id: `concentrated-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'low', // downgrade — intentional concentration
          action: 'watch',
          title: `${symbol} is ${positionPct.toFixed(0)}% of your portfolio`,
          message: `Intentional concentration per your accumulation plan.`,
          detail: `You're building toward ${fmtNum(plan.targetAmount)} ${plan.symbol}. High conviction = high concentration, but manage your risk.${planTag}`,
          emoji: '🎯',
          actionLabel: 'Review Plan',
          value: asset.value, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      } else {
        alerts.push({
          id: `concentrated-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: 'medium',
          action: 'rebalance',
          title: `${symbol} is ${positionPct.toFixed(0)}% of your portfolio`,
          message: `High concentration risk. One bad day could wipe your gains.`,
          detail: `Consider trimming to <15% and diversifying into stables or yield.`,
          emoji: '⚖️',
          actionLabel: 'Trim to 15%',
          actionParams: {
            type: 'swap', fromMint: mint, fromSymbol: symbol,
            percentage: Math.round(((positionPct - 15) / positionPct) * 100),
          },
          value: asset.value, change: price.change24h, timestamp: now,
        });
      }
    }

    // ── 8. Idle capital — no yield (suggest Kamino or Perena) ───────
    if (asset.annualIncome === 0 && asset.value >= 500 && !meta.isStaked) {
      const hasHigherAlert = alerts.some(a => a.mint === mint && (a.priority === 'urgent' || a.priority === 'high'));
      if (!hasHigherAlert) {
        // Check if Kamino has a rate for this token (passed via kaminoRates in context)
        const kaminoRate = (context as any)?.kaminoRates?.[symbol] || (context as any)?.kaminoRates?.[symbol.toUpperCase()];
        const kaminoApy = kaminoRate?.supplyApr || 0;

        const detail = kaminoApy > 0
          ? `Deposit to Kamino Lend for ${kaminoApy.toFixed(1)}% APY (+$${(asset.value * kaminoApy / 100 / 12).toFixed(0)}/mo).`
          : `Deploy to Perena USD* (9.3% APY) or Kamino Lend for yield.`;

        alerts.push({
          id: `idle-${mint}-${now}`,
          assetId: asset.id, assetName: asset.name, symbol, mint,
          priority: kaminoApy > 3 ? 'medium' : 'low',
          action: 'deploy_yield',
          title: `${symbol} isn't earning anything`,
          message: `$${fmtVal(asset.value)} sitting idle.`,
          detail,
          emoji: '💤',
          actionLabel: kaminoApy > 0 ? `Lend on Kamino (${kaminoApy.toFixed(1)}%)` : 'Earn Yield',
          actionParams: kaminoApy > 0
            ? { type: 'kamino_deposit', mint, symbol }
            : { type: 'deposit', protocol: 'perena' },
          value: asset.value, change: price.change24h, timestamp: now,
        });
      }
    }
  }

  // ── Re-entry alerts for exited accumulation positions ──────────────────────
  if (accPlans) {
    const heldMints = new Set(cryptoAssets.map(a => {
      const m = a.metadata as CryptoAsset;
      return m.tokenMint || m.mint || '';
    }));

    for (const plan of accPlans) {
      // Only for fully exited positions that aren't already covered by the asset loop
      if (plan.currentHolding > 0 || heldMints.has(plan.mint)) continue;
      if (plan.avgEntry <= 0) continue;

      const price = priceData[plan.mint];
      if (!price || !price.currentPrice) continue;

      const pctFromEntry = ((price.currentPrice - plan.avgEntry) / plan.avgEntry) * 100;
      const reEntryPrice = price.currentPrice * 0.6; // 40% drop target

      if (pctFromEntry <= -40 && price.change24h !== null && price.change24h > 0) {
        // Dropped 40%+ AND showing recovery (positive 24h change)
        alerts.push({
          id: `reentry-zone-${plan.mint}-${now}`,
          assetId: '', assetName: plan.symbol, symbol: plan.symbol, mint: plan.mint,
          priority: 'high',
          action: 'accumulate',
          title: `${plan.symbol} — re-entry zone`,
          message: `${pctFromEntry.toFixed(0)}% below your $${fmtPrice(plan.avgEntry)} avg and showing signs of recovery.`,
          detail: `Price bouncing after a deep drop. Good time to start re-accumulating if thesis still holds.`,
          emoji: '🎯',
          actionLabel: 'Buy',
          value: 0, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      } else if (pctFromEntry <= -40) {
        // Deep drop but still falling
        alerts.push({
          id: `reentry-watch-${plan.mint}-${now}`,
          assetId: '', assetName: plan.symbol, symbol: plan.symbol, mint: plan.mint,
          priority: 'medium',
          action: 'watch',
          title: `${plan.symbol} ${pctFromEntry.toFixed(0)}% below your entry`,
          message: `Deep discount vs your $${fmtPrice(plan.avgEntry)} avg. Watch for a bounce before re-entering.`,
          detail: `Wait for positive momentum (green day) before buying back in.`,
          emoji: '👀',
          actionLabel: 'Watch',
          value: 0, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      } else if (pctFromEntry >= 0) {
        // Still above entry — show re-entry target
        alerts.push({
          id: `reentry-wait-${plan.mint}-${now}`,
          assetId: '', assetName: plan.symbol, symbol: plan.symbol, mint: plan.mint,
          priority: 'low',
          action: 'watch',
          title: `${plan.symbol} — waiting to re-enter`,
          message: `Still +${pctFromEntry.toFixed(0)}% above your avg. Target re-entry around $${fmtPrice(reEntryPrice)}.`,
          detail: `Wait for a 40%+ pullback from current price before re-accumulating.`,
          emoji: '⏳',
          actionLabel: 'Watch',
          value: 0, change: price.change24h, timestamp: now, hasAccPlan: true,
        });
      }
    }
  }

  // Sort: urgent first, then high, medium, low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAlertColor(priority: AlertPriority): { bg: string; border: string; text: string } {
  switch (priority) {
    case 'urgent': return { bg: '#3a0e0e', border: '#ff6b6b80', text: '#ff8a8a' };
    case 'high':   return { bg: '#3a2a0e', border: '#ffa04080', text: '#ffb060' };
    case 'medium': return { bg: '#0e2a3a', border: '#60a5fa80', text: '#80c0ff' };
    case 'low':    return { bg: '#1a2a1a', border: '#4ade8040', text: '#80c0a0' };
  }
}

// ─── Cash Transfer Alerts ────────────────────────────────────────────────────
// Checks bank balances against upcoming obligations and suggests USDC transfers

interface BankAccountInfo {
  id: string;
  name: string;
  institution: string;
  currentBalance: number;
  type: 'checking' | 'savings' | 'investment';
}

interface ObligationInfo {
  name: string;
  amount: number;
  dueDate?: number;
  bankAccountId?: string;
}

interface DebtInfo {
  name: string;
  monthlyPayment: number;
  dueDate?: number;
  bankAccountId?: string;
}

const TRANSFER_LEAD_DAYS = 1; // Fuse takes 1 day
const LOOKAHEAD_DAYS = 7;     // Warn about bills in the next 7 days
const BUFFER_MULTIPLIER = 1.1; // Keep 10% buffer above bills

// ─── Stale Import Alerts ─────────────────────────────────────────────────────
// Nudge user to import bank statements when data is getting old

interface TransactionDate {
  date: string; // ISO date string
  bankAccountId: string;
}

const IMPORT_STALE_DAYS = 7;   // Nudge after 7 days
const IMPORT_URGENT_DAYS = 14; // Stronger nudge after 14 days

export function generateImportReminders(
  bankAccounts: BankAccountInfo[],
  transactionDates: TransactionDate[], // Just need dates + account IDs
): PositionAlert[] {
  const alerts: PositionAlert[] = [];
  const now = Date.now();

  for (const account of bankAccounts) {
    // Find most recent transaction for this account
    const accountTxDates = transactionDates
      .filter(t => t.bankAccountId === account.id)
      .map(t => new Date(t.date).getTime())
      .filter(t => !isNaN(t));

    const mostRecent = accountTxDates.length > 0 ? Math.max(...accountTxDates) : 0;
    const daysSince = mostRecent > 0
      ? Math.floor((now - mostRecent) / (24 * 60 * 60 * 1000))
      : Infinity;

    if (daysSince < IMPORT_STALE_DAYS) continue;

    const isUrgent = daysSince >= IMPORT_URGENT_DAYS;
    const neverImported = mostRecent === 0;

    alerts.push({
      id: `import-reminder-${account.id}-${now}`,
      assetId: account.id,
      assetName: account.name,
      symbol: '',
      mint: '',
      priority: isUrgent ? 'high' : 'low',
      action: 'watch',
      title: neverImported
        ? `Import ${account.name} transactions`
        : `${account.name} data is ${daysSince} days old`,
      message: neverImported
        ? `No transactions imported yet. Import a CSV to enable bill tracking and balance warnings.`
        : `Import your latest statement to keep balance and bill tracking accurate.`,
      detail: neverImported
        ? `Tap to go to ${account.name} and import your first CSV.`
        : `Last transaction: ${new Date(mostRecent).toLocaleDateString()}. KingMe works best with fresh data.`,
      emoji: neverImported ? '📄' : '🔄',
      actionLabel: 'Import Now',
      actionParams: { type: 'navigate_bank', bankAccountId: account.id },
      value: 0,
      change: null,
      timestamp: now,
    });
  }

  return alerts;
}

// ─── Cash Transfer Alerts ────────────────────────────────────────────────────
export function generateCashTransferAlerts(
  bankAccounts: BankAccountInfo[],
  obligations: ObligationInfo[],
  debts: DebtInfo[],
  usdcBalance: number, // Available USDC to transfer
): PositionAlert[] {
  const alerts: PositionAlert[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  for (const account of bankAccounts) {
    if (account.type === 'investment') continue;

    // Find bills coming due for this account within lookahead window
    const upcomingBills: Array<{ name: string; amount: number; daysUntil: number }> = [];

    const allBills = [
      ...obligations.filter(o => o.bankAccountId === account.id).map(o => ({
        name: o.name, amount: o.amount, dueDate: o.dueDate || 1,
      })),
      ...debts.filter(d => d.bankAccountId === account.id).map(d => ({
        name: d.name, amount: d.monthlyPayment, dueDate: d.dueDate || 1,
      })),
    ];

    for (const bill of allBills) {
      let daysUntil = bill.dueDate - currentDay;
      if (daysUntil < 0) daysUntil += daysInMonth; // wraps to next month
      // Only count bills within our lookahead window
      if (daysUntil <= LOOKAHEAD_DAYS) {
        upcomingBills.push({ name: bill.name, amount: bill.amount, daysUntil });
      }
    }

    if (upcomingBills.length === 0) continue;

    const totalUpcoming = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
    const neededWithBuffer = totalUpcoming * BUFFER_MULTIPLIER;
    const shortfall = neededWithBuffer - account.currentBalance;

    if (shortfall <= 0) continue; // Balance covers upcoming bills

    // Need to transfer — is there enough time?
    const soonestBill = upcomingBills.sort((a, b) => a.daysUntil - b.daysUntil)[0];
    const isUrgent = soonestBill.daysUntil <= TRANSFER_LEAD_DAYS + 1; // Tomorrow or today
    const isTight = soonestBill.daysUntil <= TRANSFER_LEAD_DAYS + 3;

    // Build bill list for detail
    const billList = upcomingBills
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .map(b => `${b.name}: $${b.amount.toFixed(0)} in ${b.daysUntil}d`)
      .join(', ');

    const transferAmount = Math.ceil(shortfall);
    const canCoverFromUSDC = usdcBalance >= transferAmount;

    alerts.push({
      id: `cash-transfer-${account.id}-${Date.now()}`,
      assetId: account.id,
      assetName: account.name,
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      priority: isUrgent ? 'urgent' : isTight ? 'high' : 'medium',
      action: 'rebalance',
      title: isUrgent
        ? `Transfer $${transferAmount} to ${account.name} NOW`
        : `Transfer $${transferAmount} to ${account.name}`,
      message: isUrgent
        ? `Bills hit ${soonestBill.daysUntil === 0 ? 'today' : 'tomorrow'} and balance is $${account.currentBalance.toFixed(0)}. Transfer takes 1 day.`
        : `$${totalUpcoming.toFixed(0)} in bills coming within ${LOOKAHEAD_DAYS} days. Balance: $${account.currentBalance.toFixed(0)}.`,
      detail: canCoverFromUSDC
        ? `Send $${transferAmount} USDC via Fuse → ${account.institution}. Bills: ${billList}`
        : `Need $${transferAmount} but only $${usdcBalance.toFixed(0)} USDC available. Bills: ${billList}`,
      emoji: isUrgent ? '🚨' : '🏦',
      actionLabel: canCoverFromUSDC ? `Transfer $${transferAmount}` : 'View Account',
      actionParams: canCoverFromUSDC
        ? { type: 'fuse_transfer', amount: transferAmount, toAccount: account.name, toInstitution: account.institution }
        : undefined,
      value: transferAmount,
      change: null,
      timestamp: Date.now(),
    });
  }

  return alerts;
}
