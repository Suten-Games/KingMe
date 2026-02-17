// src/hooks/useSwapScenario.ts
// ==============================================================
// Hook that bridges What-If scenarios with on-chain execution.
// Wraps the Jupiter swap service and integrates with the wallet
// provider and store's applyScenario.
// ==============================================================

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useWallet } from '@/providers/wallet-provider';
import { useStore } from '../store/useStore';
import {
  getSwapQuote,
  executeSwap,
  scenarioToSwapParams,
  isOnChainScenario,
  formatSwapAmount,
  MINTS,
  type SwapQuote,
  type SwapResult,
  type SwapParams,
} from '../services/jupiterSwap';
import type { WhatIfScenario } from '../types';


export type SwapState =
  | 'idle'
  | 'quoting'          // Fetching quote from Jupiter
  | 'confirming'       // Showing user the quote, waiting for confirmation
  | 'signing'          // Wallet popup is open
  | 'submitting'       // Transaction sent, waiting for confirmation
  | 'success'          // Done!
  | 'error';

export interface SwapScenarioState {
  state: SwapState;
  quote: SwapQuote | null;
  result: SwapResult | null;
  error: string | null;
  /** True if scenario involves on-chain action */
  isOnChain: boolean;
}

export function useSwapScenario() {
  const { publicKey, signTransaction, connected } = useWallet();
  const applyScenario = useStore((s) => s.applyScenario);
  const syncWalletAssets = useStore((s) => s.syncWalletAssets);
  const wallets = useStore((s) => s.wallets);

  const [swapState, setSwapState] = useState<SwapScenarioState>({
    state: 'idle',
    quote: null,
    result: null,
    error: null,
    isOnChain: false,
  });

  /**
   * Reset state (call when closing modal)
   */
  const reset = useCallback(() => {
    setSwapState({
      state: 'idle',
      quote: null,
      result: null,
      error: null,
      isOnChain: false,
    });
  }, []);

  /**
   * Check if a scenario has on-chain components and get a preview quote.
   * Call this when the user opens a scenario detail view.
   */
  const previewScenario = useCallback(async (scenario: WhatIfScenario) => {
    const onChain = isOnChainScenario(scenario.type);

    setSwapState({
      state: onChain ? 'quoting' : 'idle',
      quote: null,
      result: null,
      error: null,
      isOnChain: onChain,
    });

    if (!onChain) return;

    if (!connected || !publicKey) {
      setSwapState((prev) => ({
        ...prev,
        state: 'error',
        error: 'Connect your wallet to execute on-chain scenarios',
      }));
      return;
    }

    const swapParams = scenarioToSwapParams(scenario, publicKey.toBase58());

    if (!swapParams || swapParams.amount <= 0) {
      // Scenario is on-chain type but doesn't need a swap (e.g., staking existing tokens)
      setSwapState((prev) => ({ ...prev, state: 'idle', isOnChain: true }));
      return;
    }

    try {
      const quote = await getSwapQuote(swapParams);
      setSwapState({
        state: 'confirming',
        quote,
        result: null,
        error: null,
        isOnChain: true,
      });
    } catch (error: any) {
      console.error('[SWAP_HOOK] Quote error:', error);
      setSwapState({
        state: 'error',
        quote: null,
        result: null,
        error: error.message || 'Failed to get swap quote',
        isOnChain: true,
      });
    }
  }, [connected, publicKey]);

  /**
   * Apply a scenario — handles both on-chain and off-chain flows.
   *
   * On-chain flow:
   *   1. Execute swap via Jupiter
   *   2. Wait for confirmation
   *   3. Sync wallet to pick up new balances
   *   4. Apply local state changes
   *
   * Off-chain flow:
   *   1. Apply local state changes immediately
   */
  const applyWithSwap = useCallback(async (scenario: WhatIfScenario): Promise<boolean> => {
    const onChain = isOnChainScenario(scenario.type);

    if (!onChain) {
      // Off-chain: just apply the local state changes
      try {
        await applyScenario(scenario);
        return true;
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to apply scenario');
        return false;
      }
    }

    // On-chain flow
    if (!connected || !publicKey) {
      Alert.alert(
        'Wallet Required',
        'Connect your Solana wallet to execute this action on-chain.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const swapParams = scenarioToSwapParams(scenario, publicKey.toBase58());

    if (!swapParams || swapParams.amount <= 0) {
      // No swap needed, but might be a deposit action — apply local state
      try {
        await applyScenario(scenario);
        return true;
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to apply scenario');
        return false;
      }
    }

    // ── Execute the swap ────────────────────────────────────
    setSwapState((prev) => ({ ...prev, state: 'signing' }));

    const result = await executeSwap(swapParams, signTransaction);

    if (!result.success) {
      setSwapState((prev) => ({
        ...prev,
        state: 'error',
        result,
        error: result.error || 'Swap failed',
      }));

      if (result.error !== 'Transaction cancelled by user') {
        Alert.alert('Swap Failed', result.error || 'Something went wrong');
      }
      return false;
    }

    // ── Swap succeeded ──────────────────────────────────────
    setSwapState((prev) => ({ ...prev, state: 'submitting', result }));

    console.log(`[SWAP_HOOK] ✅ Swap confirmed: ${result.signature}`);

    // Sync wallet to pick up new balances
    try {
      if (wallets.length > 0) {
        console.log('[SWAP_HOOK] Syncing wallet after swap...');
        await syncWalletAssets(wallets[0]);
      }
    } catch (err) {
      console.warn('[SWAP_HOOK] Post-swap sync failed (non-critical):', err);
    }

    // Apply local state changes (update freedom score, scenarios, etc.)
    try {
      await applyScenario(scenario);
    } catch (err) {
      console.warn('[SWAP_HOOK] Local state update failed (non-critical):', err);
    }

    setSwapState({
      state: 'success',
      quote: swapState.quote,
      result,
      error: null,
      isOnChain: true,
    });

    return true;
  }, [connected, publicKey, signTransaction, applyScenario, syncWalletAssets, wallets, swapState.quote]);

  /**
   * Get a human-readable status message for the current swap state.
   */
  const statusMessage = useCallback((): string => {
    switch (swapState.state) {
      case 'quoting': return 'Getting best price...';
      case 'confirming': return 'Review swap details';
      case 'signing': return 'Approve in your wallet...';
      case 'submitting': return 'Confirming on Solana...';
      case 'success': return 'Swap complete! 🎉';
      case 'error': return swapState.error || 'Something went wrong';
      default: return '';
    }
  }, [swapState]);

  return {
    swapState,
    previewScenario,
    applyWithSwap,
    statusMessage,
    reset,
  };
}
