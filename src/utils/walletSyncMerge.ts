// src/utils/walletSyncMerge.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Smart merge for wallet sync results.
// Preserves user-set fields (type, protocol, APY, leverage, name edits)
// Only updates: balance, price, value, logoURI
// ═══════════════════════════════════════════════════════════════════════════════

import type { Asset } from '../types';

interface SyncedAsset {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  category: string;
  logoURI?: string;
  apy?: number;
}

interface MergeResult {
  assets: Asset[];
  newCount: number;
  updatedCount: number;
  removedCount: number;
  newTokens: string[];    // symbols of newly discovered tokens
  priceChanges: Array<{ symbol: string; oldPrice: number; newPrice: number }>;
}

// Fields that the user may have manually set — NEVER overwrite these from sync
const USER_PRESERVED_FIELDS = [
  'type',          // user changed crypto → defi
  'name',          // user renamed the asset
  'annualIncome',  // user set APY-based income
  'notes',         // user notes
] as const;

// Metadata fields preserved from user edits
const USER_PRESERVED_META = [
  'protocol',      // user set "Diversifi", "Kamino", etc.
  'apy',           // user set custom APY
  'description',   // user description
  'positionType',  // staking, lending, loop, etc.
  'supplied',      // leverage position
  'borrowed',      // leverage position
  'leverage',      // leverage multiplier
  'healthFactor',  // health %
  'isStaked',      // user marked as staked
] as const;

export function mergeWalletSync(
  existingAssets: Asset[],
  syncedAssets: SyncedAsset[],
  walletAddress: string,
): MergeResult {
  const result: Asset[] = [];
  let newCount = 0;
  let updatedCount = 0;
  const newTokens: string[] = [];
  const priceChanges: Array<{ symbol: string; oldPrice: number; newPrice: number }> = [];

  // Index existing assets by mint for fast lookup
  const existingByMint = new Map<string, Asset>();
  const existingNonWallet: Asset[] = [];

  for (const asset of existingAssets) {
    const meta = asset.metadata as any;
    const mint = meta?.mint || meta?.tokenMint;
    if (mint && asset.isAutoSynced) {
      existingByMint.set(mint, asset);
    } else {
      // Non-wallet assets (manual entries, bank accounts, real estate, etc.)
      existingNonWallet.push(asset);
    }
  }

  // Track which existing assets got updated (to detect removed tokens)
  const updatedMints = new Set<string>();

  // Process each synced asset
  for (const synced of syncedAssets) {
    const existing = existingByMint.get(synced.mint);

    if (existing) {
      // ── EXISTING TOKEN: update balance/price only ──────────
      const oldMeta = (existing.metadata || {}) as any;
      const oldPrice = oldMeta.priceUSD || 0;

      // Track significant price changes (>5%)
      if (oldPrice > 0 && synced.priceUSD > 0) {
        const changePct = Math.abs((synced.priceUSD - oldPrice) / oldPrice);
        if (changePct > 0.05) {
          priceChanges.push({
            symbol: synced.symbol,
            oldPrice,
            newPrice: synced.priceUSD,
          });
        }
      }

      // Merge: update balance/price/value, preserve everything else
      const mergedMeta = {
        ...oldMeta,
        // Only update these from sync:
        balance: synced.balance,
        quantity: synced.balance,
        priceUSD: synced.priceUSD,
        // Update logo if we didn't have one before
        logoURI: oldMeta.logoURI || synced.logoURI,
      };

      const mergedAsset: Asset = {
        ...existing,
        // Update value from new balance × price
        value: synced.valueUSD,
        // Recalculate annual income if APY is set
        annualIncome: oldMeta.apy
          ? (synced.valueUSD * oldMeta.apy) / 100
          : existing.annualIncome,
        metadata: mergedMeta,
      };

      result.push(mergedAsset);
      updatedMints.add(synced.mint);
      updatedCount++;
    } else {
      // ── NEW TOKEN: create fresh asset ──────────────────────
      const newAsset: Asset = {
        id: `wallet_${synced.mint.slice(0, 8)}_${Date.now()}`,
        name: synced.name,
        type: synced.category as Asset['type'],
        value: synced.valueUSD,
        annualIncome: synced.apy ? (synced.valueUSD * synced.apy) / 100 : 0,
        isAutoSynced: true,
        metadata: {
          type: 'crypto' as const,
          mint: synced.mint,
          tokenMint: synced.mint,
          symbol: synced.symbol,
          balance: synced.balance,
          quantity: synced.balance,
          priceUSD: synced.priceUSD,
          logoURI: synced.logoURI,
          apy: synced.apy,
          walletAddress,
        },
      };

      result.push(newAsset);
      newCount++;
      newTokens.push(synced.symbol);
    }
  }

  // Count tokens that disappeared from wallet (balance went to 0)
  let removedCount = 0;
  for (const [mint, asset] of existingByMint) {
    if (!updatedMints.has(mint)) {
      // Token no longer in wallet — keep it but mark value as 0
      // (User can manually delete if they want)
      result.push({
        ...asset,
        value: 0,
        metadata: {
          ...(asset.metadata as any),
          balance: 0,
          quantity: 0,
        },
      });
      removedCount++;
    }
  }

  // Add back all non-wallet assets unchanged
  result.push(...existingNonWallet);

  // Sort: highest value first
  result.sort((a, b) => b.value - a.value);

  return {
    assets: result,
    newCount,
    updatedCount,
    removedCount,
    newTokens,
    priceChanges,
  };
}

/**
 * Update prices for existing assets from price tracker data.
 * This is the lightweight version — no Helius call needed.
 * Only updates price + value, preserves everything else.
 */
export function updateAssetPrices(
  assets: Asset[],
  prices: Record<string, number>, // mint → price
): Asset[] {
  return assets.map(asset => {
    const meta = asset.metadata as any;
    const mint = meta?.mint || meta?.tokenMint;
    if (!mint || !prices[mint]) return asset;

    const newPrice = prices[mint];
    const balance = meta?.balance || meta?.quantity || 0;
    const newValue = balance * newPrice;

    // Skip if price hasn't changed meaningfully
    if (Math.abs(newValue - asset.value) < 0.01) return asset;

    return {
      ...asset,
      value: newValue,
      // Recalculate income if APY is set
      annualIncome: meta?.apy ? (newValue * meta.apy) / 100 : asset.annualIncome,
      metadata: {
        ...meta,
        priceUSD: newPrice,
      },
    };
  });
}
