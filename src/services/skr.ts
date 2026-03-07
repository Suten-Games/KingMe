// src/services/skr.ts — SKR staking via KingMe API

import { log, warn, error as logError } from '../utils/logger';

const API_BASE = 'https://kingme-api.vercel.app/api/skr';

export interface SKRHolding {
  totalBalance: number;
  stakedBalance: number;
  liquidBalance: number;
  unstakingBalance: number;
  isUnstaking: boolean;
  unstakeTimestamp: number; // unix seconds, 0 if not unstaking
  priceUsd: number;
  apy?: number;
}

export interface SKRIncomeSnapshot {
  totalValueUsd: number;
  monthlyYieldUsd: number;
  annualYieldUsd: number;
  monthlyYieldSkr: number;
  apyUsed: number;
}

const SKR_APY = 0.209; // 20.9% APY from Guardian staking

/**
 * Fetch SKR balances (wallet + staking) from KingMe API
 */
export async function fetchSKRHolding(walletAddress: string): Promise<SKRHolding | null> {
  try {
    log('[SKR] Fetching balances for', walletAddress.slice(0, 8));

    const res = await fetch(`${API_BASE}/balances?wallet=${walletAddress}`);
    if (!res.ok) {
      logError('[SKR] API error:', res.status);
      return null;
    }

    const data = await res.json();
    const { walletBalance, totalStaked, totalUnstaking, stakes } = data;

    const totalBalance = (walletBalance || 0) + (totalStaked || 0) + (totalUnstaking || 0);
    if (totalBalance === 0) return null;

    const unstakeTs = stakes?.[0]?.unstakeTimestamp || 0;

    log(`[SKR] wallet=${walletBalance} staked=${totalStaked} unstaking=${totalUnstaking}`);

    return {
      totalBalance,
      stakedBalance: totalStaked || 0,
      liquidBalance: walletBalance || 0,
      unstakingBalance: totalUnstaking || 0,
      isUnstaking: (totalUnstaking || 0) > 0,
      unstakeTimestamp: unstakeTs,
      priceUsd: 0, // price comes from wallet sync
      apy: totalStaked > 0 ? SKR_APY : 0,
    };
  } catch (error) {
    logError('[SKR] fetchSKRHolding error:', error);
    return null;
  }
}

/**
 * Build a stake transaction (returns base64 serialized tx for signing)
 */
export async function buildStakeTransaction(
  walletAddress: string,
  amount: number,
): Promise<{ transaction: string; message: string }> {
  const res = await fetch(`${API_BASE}/stake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: walletAddress, amount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Stake failed' }));
    throw new Error(err.error || 'Failed to build stake transaction');
  }

  return res.json();
}

/**
 * Build an unstake transaction (returns base64 serialized tx for signing)
 */
export async function buildUnstakeTransaction(
  walletAddress: string,
  amount: number,
): Promise<{ transaction: string; message: string }> {
  const res = await fetch(`${API_BASE}/unstake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: walletAddress, amount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unstake failed' }));
    throw new Error(err.error || 'Failed to build unstake transaction');
  }

  return res.json();
}

/**
 * Calculate income from SKR holding
 */
export function calcSKRIncome(holding: SKRHolding): SKRIncomeSnapshot {
  const totalValueUsd = holding.totalBalance * holding.priceUsd;
  const annualYieldUsd = holding.stakedBalance * holding.priceUsd * (holding.apy || 0);
  const monthlyYieldUsd = annualYieldUsd / 12;
  const monthlyYieldSkr = (holding.stakedBalance * (holding.apy || 0)) / 12;

  return {
    totalValueUsd,
    monthlyYieldUsd,
    annualYieldUsd,
    monthlyYieldSkr,
    apyUsed: holding.apy || 0,
  };
}
