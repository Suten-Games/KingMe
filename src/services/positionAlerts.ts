// src/services/positionAlerts.ts
// Smart alert engine — scans your positions and surfaces actionable recommendations
import type { Asset, CryptoAsset } from '../types';
import { TokenPriceData } from './priceTracker';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertPriority = 'urgent' | 'high' | 'medium' | 'low';
export type AlertAction = 'trim' | 'sell' | 'stop_loss' | 'take_profit' | 'deploy_yield' | 'rebalance' | 'buy_dip' | 'watch';

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

// ─── Alert Generator ─────────────────────────────────────────────────────────

export function generatePositionAlerts(
  assets: Asset[],
  priceData: Record<string, TokenPriceData>,
): PositionAlert[] {
  const alerts: PositionAlert[] = [];
  const now = Date.now();

  // Get crypto assets only
  const cryptoAssets = assets.filter(a => a.type === 'crypto' && a.value >= THRESHOLDS.MIN_VALUE);
  const totalPortfolioValue = cryptoAssets.reduce((sum, a) => sum + a.value, 0);

  for (const asset of cryptoAssets) {
    const meta = asset.metadata as CryptoAsset;
    const mint = meta.tokenMint || meta.mint || '';
    const symbol = meta.symbol || asset.name;

    // Skip stablecoins
    if (STABLE_MINTS.has(mint)) continue;

    const price = priceData[mint];
    if (!price) continue;

    const positionPct = totalPortfolioValue > 0
      ? (asset.value / totalPortfolioValue) * 100
      : 0;

    // ── 1. Rapid pump (1h) — URGENT ──────────────────────────────────
    if (price.change1h !== null && price.change1h >= THRESHOLDS.PUMP_1H) {
      alerts.push({
        id: `pump-1h-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'urgent',
        action: 'trim',
        title: `${symbol} pumping +${price.change1h.toFixed(0)}% in 1 hour`,
        message: `Rapid pump detected. Consider trimming while it's hot.`,
        detail: `$${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} position. Sell 25-50% and rebuy if it dips.`,
        emoji: '🚀',
        actionLabel: 'Trim 25%',
        actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 25 },
        value: asset.value,
        change: price.change1h,
        timestamp: now,
      });
    }

    // ── 2. Strong pump (24h) — take profit ───────────────────────────
    if (price.change24h !== null && price.change24h >= THRESHOLDS.PUMP_24H && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      alerts.push({
        id: `pump-24h-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'high',
        action: 'take_profit',
        title: `${symbol} up +${price.change24h.toFixed(0)}% today`,
        message: `Strong day. Lock in gains before a pullback.`,
        detail: `Your $${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} is worth ${price.change24h.toFixed(0)}% more than yesterday. Take some off the table.`,
        emoji: '💰',
        actionLabel: 'Take Profit',
        actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 30 },
        value: asset.value,
        change: price.change24h,
        timestamp: now,
      });
    }
    // Moderate 24h pump
    else if (price.change24h !== null && price.change24h >= THRESHOLDS.PUMP_24H_MODERATE && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      alerts.push({
        id: `pump-mod-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'medium',
        action: 'watch',
        title: `${symbol} up +${price.change24h.toFixed(0)}% today`,
        message: `Nice move. Keep an eye on it.`,
        detail: `$${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} position. Consider setting a mental stop-loss.`,
        emoji: '📈',
        actionLabel: 'Set Alert',
        value: asset.value,
        change: price.change24h,
        timestamp: now,
      });
    }

    // ── 3. 7-day rally — strong take profit ──────────────────────────
    if (price.change7d !== null && price.change7d >= THRESHOLDS.PUMP_7D && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      // Don't duplicate if already have 24h alert
      const has24hAlert = alerts.some(a => a.mint === mint && (a.action === 'take_profit' || a.action === 'trim'));
      if (!has24hAlert) {
        alerts.push({
          id: `rally-7d-${mint}-${now}`,
          assetId: asset.id,
          assetName: asset.name,
          symbol,
          mint,
          priority: 'high',
          action: 'take_profit',
          title: `${symbol} up +${price.change7d.toFixed(0)}% this week`,
          message: `Massive weekly run. Don't ride it back down.`,
          detail: `Remember: pigs get slaughtered. Take 25-50% off the table and buy back on a dip.`,
          emoji: '🐷',
          actionLabel: 'Take 25% Profit',
          actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 25 },
          value: asset.value,
          change: price.change7d,
          timestamp: now,
        });
      }
    }

    // ── 4. Rapid dump (1h) — URGENT ──────────────────────────────────
    if (price.change1h !== null && price.change1h <= THRESHOLDS.DUMP_1H) {
      alerts.push({
        id: `dump-1h-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'urgent',
        action: 'stop_loss',
        title: `${symbol} dropping ${price.change1h.toFixed(0)}% in 1 hour`,
        message: `Rapid sell-off. Protect your position.`,
        detail: `$${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} at risk. Consider selling to USDC and rebuying lower.`,
        emoji: '🔻',
        actionLabel: 'Sell to USDC',
        actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 100 },
        value: asset.value,
        change: price.change1h,
        timestamp: now,
      });
    }

    // ── 5. Significant dump (24h) ────────────────────────────────────
    if (price.change24h !== null && price.change24h <= THRESHOLDS.DUMP_24H && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      alerts.push({
        id: `dump-24h-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'high',
        action: 'sell',
        title: `${symbol} down ${price.change24h.toFixed(0)}% today`,
        message: `Significant decline. Cut losses or hold conviction.`,
        detail: `Your position went from $${((asset.value / (1 + price.change24h / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 })} to $${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Do you still believe in this?`,
        emoji: '📉',
        actionLabel: 'Cut Losses',
        actionParams: { type: 'swap', fromMint: mint, fromSymbol: symbol, percentage: 100 },
        value: asset.value,
        change: price.change24h,
        timestamp: now,
      });
    }

    // ── 6. Falling from ATH — you're riding it down ──────────────────
    if (price.fromATH !== null && price.fromATH <= THRESHOLDS.DUMP_FROM_ATH && price.allTimeHigh && asset.value >= THRESHOLDS.MIN_VALUE_FOR_TRIM) {
      const peakValue = (asset.value / price.currentPrice) * price.allTimeHigh;
      const lostValue = peakValue - asset.value;

      // Only alert if meaningful money was lost
      if (lostValue > 100) {
        const hasOtherAlert = alerts.some(a => a.mint === mint && (a.action === 'sell' || a.action === 'stop_loss'));
        if (!hasOtherAlert) {
          alerts.push({
            id: `ath-fall-${mint}-${now}`,
            assetId: asset.id,
            assetName: asset.name,
            symbol,
            mint,
            priority: 'medium',
            action: 'sell',
            title: `${symbol} is ${Math.abs(price.fromATH).toFixed(0)}% off its high`,
            message: `You could have had $${peakValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Now it's $${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
            detail: `That's $${lostValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} left on the table. Consider selling and rebuying at support.`,
            emoji: '🎢',
            actionLabel: 'Review Position',
            value: asset.value,
            change: price.fromATH,
            timestamp: now,
          });
        }
      }
    }

    // ── 7. Concentrated position ─────────────────────────────────────
    if (positionPct >= THRESHOLDS.CONCENTRATED) {
      alerts.push({
        id: `concentrated-${mint}-${now}`,
        assetId: asset.id,
        assetName: asset.name,
        symbol,
        mint,
        priority: 'medium',
        action: 'rebalance',
        title: `${symbol} is ${positionPct.toFixed(0)}% of your portfolio`,
        message: `High concentration risk. One bad day could wipe your gains.`,
        detail: `Consider trimming to <15% and diversifying into stables or yield.`,
        emoji: '⚖️',
        actionLabel: 'Trim to 15%',
        actionParams: {
          type: 'swap',
          fromMint: mint,
          fromSymbol: symbol,
          percentage: Math.round(((positionPct - 15) / positionPct) * 100),
        },
        value: asset.value,
        change: price.change24h,
        timestamp: now,
      });
    }

    // ── 8. Idle capital — no yield ───────────────────────────────────
    if (asset.annualIncome === 0 && asset.value >= 500 && !meta.isStaked) {
      // Only for large non-earning positions, low priority
      const hasHigherAlert = alerts.some(a => a.mint === mint && (a.priority === 'urgent' || a.priority === 'high'));
      if (!hasHigherAlert) {
        alerts.push({
          id: `idle-${mint}-${now}`,
          assetId: asset.id,
          assetName: asset.name,
          symbol,
          mint,
          priority: 'low',
          action: 'deploy_yield',
          title: `${symbol} isn't earning anything`,
          message: `$${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} sitting idle.`,
          detail: `Deploy to Perena USD* (9.3% APY) or stake for yield.`,
          emoji: '💤',
          actionLabel: 'Earn Yield',
          actionParams: { type: 'deposit', protocol: 'perena' },
          value: asset.value,
          change: price.change24h,
          timestamp: now,
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
