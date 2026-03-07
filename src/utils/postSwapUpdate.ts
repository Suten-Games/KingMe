// src/utils/postSwapUpdate.ts
// Called after every successful swap in KingMe.
// Updates:
//   1. Accumulation plan — logs a sell entry so token count + cost basis stay accurate
//   2. Zustand store asset — reduces quantity/balance/value so UI reflects the trim immediately
//   3. Goals — auto-updates because goals derive from accumulation plan entries

import { addEntry, getPlan } from '@/services/accumulationPlan';
import { useStore } from '@/store/useStore';
import type { CryptoAsset } from '@/types';
import { SwapEvents } from './swapEvents';
import { log, warn, error } from './logger';

interface PostSwapParams {
  fromMint: string;
  fromSymbol: string;
  tokenAmountSold: number;   // human-readable (e.g. 27350.5)
  pricePerToken: number;     // USD price at time of swap
  usdReceived: number;       // tokenAmountSold × pricePerToken (approx)
  signature: string;
}

export async function postSwapUpdate(params: PostSwapParams): Promise<void> {
  const { fromMint, fromSymbol, tokenAmountSold, pricePerToken, usdReceived, signature } = params;

  // ── 1. Log sell entry in accumulation plan (if one exists for this mint) ──
  try {
    const plan = await getPlan(fromMint);
    if (plan) {
      await addEntry(fromMint, {
        date: new Date().toISOString(),
        action: 'sell',
        tokenAmount: tokenAmountSold,
        pricePerToken,
        totalUSD: usdReceived,
        notes: `Trimmed via KingMe swap · tx ${signature.slice(0, 8)}...`,
      });
      log(`[POST_SWAP] Logged sell entry for ${fromSymbol}: ${tokenAmountSold} tokens @ $${pricePerToken.toFixed(6)}`);
    }
  } catch (err) {
    warn('[POST_SWAP] Failed to log accumulation entry:', err);
  }

  // ── 2. Update Zustand store asset balance immediately ──
  try {
    const { assets, updateAsset } = useStore.getState();
    const asset = assets.find(a => {
      const meta = a.metadata as CryptoAsset;
      return meta?.tokenMint === fromMint || meta?.mint === fromMint;
    });

    if (asset) {
      const meta = asset.metadata as CryptoAsset;
      const oldQty = meta?.quantity || meta?.balance || 0;
      const newQty = Math.max(0, oldQty - tokenAmountSold);
      const newValue = newQty * pricePerToken;

      updateAsset(asset.id, {
        value: newValue,
        metadata: {
          ...meta,
          quantity: newQty,
          balance: newQty,
        } as any,
      });

      log(
        `[POST_SWAP] Store updated: ${fromSymbol} qty ${oldQty.toFixed(0)} → ${newQty.toFixed(0)}, ` +
        `value $${asset.value.toFixed(2)} → $${newValue.toFixed(2)}`
      );
    }
  } catch (err) {
    warn('[POST_SWAP] Failed to update store asset:', err);
  }

  // ── 3. Emit event so subscribers (AccumulationAlerts, etc.) can reload ──
  SwapEvents.emit({
    mint: fromMint,
    symbol: fromSymbol,
    tokenAmount: tokenAmountSold,
    usdReceived,
    signature,
  });
}
