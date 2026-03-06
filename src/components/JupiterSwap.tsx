// src/components/JupiterSwap.tsx
// Jupiter-style bidirectional swap component for crypto asset detail page.
// Always visible (no collapsed state), with input/output fields, flip, slippage, auto-quote.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert as RNAlert, Image,
} from 'react-native';
import { useWallet } from '../providers/wallet-provider';
import {
  getSwapQuote, executeSwap, isSwapConfigured, getSwapDiagnostics,
  fetchMintDecimals, fetchLiveBalances, MINTS,
} from '../services/jupiterSwap';
import type { Asset } from '../types';
import { postSwapUpdate } from '../utils/postSwapUpdate';
import { useSwapToast } from './SwapToast';
import { lookupToken } from '../utils/tokenRegistry';

function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}

interface Props {
  asset: Asset;
}

const PERCENTAGES = [25, 50, 75, 100] as const;
// When selling MAX, use 99.9% to avoid "not enough tokens" from stale balances
// or floating-point rounding that overshoots the on-chain balance
const MAX_SELL_FACTOR = 0.999;

const OUTPUT_TOKENS = [
  { label: 'SOL', mint: MINTS.SOL, decimals: 9 },
  { label: 'USDC', mint: MINTS.USDC, decimals: 6 },
  { label: 'USDT', mint: MINTS.USDT, decimals: 6 },
  { label: 'PYUSD', mint: MINTS.PYUSD, decimals: 6 },
  { label: 'USD*', mint: MINTS['USD*'], decimals: 6 },
] as const;

const SLIPPAGE_OPTIONS = [50, 100, 200] as const; // bps: 0.5%, 1%, 2%

export default function JupiterSwap({ asset }: Props) {
  const { connected, publicKey, signTransaction, signAndSendTransaction } = useWallet();
  const { showToast, ToastComponent } = useSwapToast();

  const meta = asset.metadata as any;
  const mint = meta?.tokenMint || meta?.mint || '';
  const symbol = meta?.symbol || asset.name;
  const balance = meta?.quantity || meta?.balance || 0;
  const pricePerToken = balance > 0 ? asset.value / balance : 0;
  const tokenInfo = lookupToken(symbol);
  const logoURI = tokenInfo?.logoURI || meta?.logoURI || '';

  // State
  const [flipped, setFlipped] = useState(false); // false = sell asset, true = buy asset
  const [outputIdx, setOutputIdx] = useState(1); // default USDC
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(100);
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSlippage, setShowSlippage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteOutput, setQuoteOutput] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!mint || asset.type !== 'crypto') return null;

  const output = OUTPUT_TOKENS[outputIdx];
  const outputTokenInfo = lookupToken(output.label);
  const outputLogoURI = outputTokenInfo?.logoURI || '';

  const inputMint = flipped ? output.mint : mint;
  const outputMint = flipped ? mint : output.mint;
  const inputSymbol = flipped ? output.label : symbol;
  const outputSymbol = flipped ? symbol : output.label;
  const inputLogo = flipped ? outputLogoURI : logoURI;
  const inputBalance = flipped ? null : balance; // Only show balance for own token
  const numAmount = parseFloat(amount) || 0;

  // Auto-quote with 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuoteOutput(null);
    setQuoteError(null);

    if (numAmount <= 0 || !connected || !publicKey) return;
    if (!isSwapConfigured()) return;

    setQuoting(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const decimals = flipped
          ? output.decimals
          : (meta?.decimals ?? await fetchMintDecimals(mint));

        const quote = await getSwapQuote({
          inputMint,
          outputMint,
          amount: numAmount,
          inputDecimals: decimals,
          userPublicKey: publicKey.toBase58(),
          slippageBps,
        });

        const outDecimals = flipped
          ? (meta?.decimals ?? await fetchMintDecimals(mint))
          : output.decimals;
        const outAmount = parseInt(quote.outAmount) / Math.pow(10, outDecimals);
        setQuoteOutput(`~${outAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`);
      } catch (e: any) {
        setQuoteError(e.message?.slice(0, 60) || 'Quote failed');
      } finally {
        setQuoting(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [numAmount, inputMint, outputMint, slippageBps, connected]);

  const handlePercentage = (pct: number) => {
    if (!inputBalance) return;
    // For MAX: use 99.9% to avoid "not enough tokens" errors from
    // stale balance data or floating-point precision issues
    const effectivePct = pct === 100 ? MAX_SELL_FACTOR : (pct / 100);
    const val = inputBalance * effectivePct;
    setAmount(val.toString());
  };

  const handleFlip = () => {
    setFlipped(f => !f);
    setAmount('');
    setQuoteOutput(null);
    setQuoteError(null);
  };

  const handleSwap = useCallback(async () => {
    if (numAmount <= 0) return xAlert('Enter an amount');
    if (!connected || !publicKey) return xAlert('Connect Wallet', 'Connect your wallet first.');
    if (!isSwapConfigured()) {
      const d = getSwapDiagnostics();
      return xAlert('Swap Not Available', `API URL: ${d.apiUrl}\n\nSet EXPO_PUBLIC_API_URL in EAS env vars and rebuild.`);
    }

    setLoading(true);
    showToast({ type: 'loading', symbol: inputSymbol, percentage: 0 });

    try {
      // Pre-flight: check live on-chain balances to avoid Phantom rejection
      const walletAddr = publicKey.toBase58();
      const { solBalance, tokenBalance } = await fetchLiveBalances(walletAddr, inputMint);

      const MIN_SOL_FOR_FEE = 0.005; // ~0.005 SOL covers tx fee + priority fee + ATA rent
      if (solBalance < MIN_SOL_FOR_FEE) {
        setLoading(false);
        return xAlert(
          'Not enough SOL for fees',
          `You need at least ~0.005 SOL for transaction fees. You have ${solBalance.toFixed(6)} SOL.`
        );
      }

      // Cap the sell amount at the actual on-chain balance
      let swapAmount = numAmount;
      if (tokenBalance !== null && tokenBalance >= 0) {
        if (numAmount > tokenBalance) {
          console.log(`[JUPITER] Capping amount from ${numAmount} to on-chain balance ${tokenBalance}`);
          swapAmount = tokenBalance * MAX_SELL_FACTOR; // leave tiny buffer
          if (swapAmount <= 0) {
            setLoading(false);
            return xAlert('No tokens', `Your on-chain ${inputSymbol} balance is ${tokenBalance}. Sync your wallet to update.`);
          }
        }
      }

      const decimals = flipped
        ? output.decimals
        : (meta?.decimals ?? await fetchMintDecimals(mint));

      const result = await executeSwap(
        {
          inputMint,
          outputMint,
          amount: swapAmount,
          inputDecimals: decimals,
          userPublicKey: walletAddr,
          slippageBps,
        },
        signTransaction,
        signAndSendTransaction,
      );

      if (result.success) {
        // Only call postSwapUpdate when selling the asset token (not buying)
        if (!flipped) {
          await postSwapUpdate({
            fromMint: mint,
            fromSymbol: symbol,
            tokenAmountSold: numAmount,
            pricePerToken,
            usdReceived: numAmount * pricePerToken,
            signature: result.signature || '',
          });
        }

        showToast({
          type: 'success',
          symbol: inputSymbol,
          usdReceived: numAmount * pricePerToken,
          signature: result.signature || '',
        });

        setAmount('');
        setQuoteOutput(null);
      } else if (result.error !== 'Transaction cancelled by user') {
        showToast({ type: 'error', message: result.error || 'Something went wrong' });
      } else {
        showToast({ type: 'error', message: 'Transaction cancelled.' });
      }
    } catch (e: any) {
      xAlert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [numAmount, inputMint, outputMint, slippageBps, connected, publicKey, signTransaction, meta, flipped]);

  const effectiveSlippage = customSlippage ? parseInt(customSlippage) || slippageBps : slippageBps;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Swap</Text>
        <TouchableOpacity onPress={() => setShowSlippage(v => !v)} style={s.gearBtn}>
          <Text style={s.gearText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Slippage Settings */}
      {showSlippage && (
        <View style={s.slippageRow}>
          <Text style={s.slippageLabel}>Slippage</Text>
          <View style={s.slippagePills}>
            {SLIPPAGE_OPTIONS.map(bps => (
              <TouchableOpacity
                key={bps}
                style={[s.slippagePill, slippageBps === bps && !customSlippage && s.slippagePillActive]}
                onPress={() => { setSlippageBps(bps); setCustomSlippage(''); }}
              >
                <Text style={[s.slippagePillText, slippageBps === bps && !customSlippage && s.slippagePillTextActive]}>
                  {(bps / 100).toFixed(1)}%
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[s.slippageInput, customSlippage ? s.slippageInputActive : null]}
              placeholder="Custom"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={customSlippage}
              onChangeText={v => { setCustomSlippage(v); }}
            />
          </View>
        </View>
      )}

      {/* Input (Selling) */}
      <Text style={s.fieldLabel}>{flipped ? "You're buying" : "You're selling"}</Text>
      <View style={s.tokenBox}>
        <View style={s.tokenRow}>
          <View style={s.tokenIdent}>
            {inputLogo ? (
              <Image source={{ uri: inputLogo }} style={s.tokenLogo} />
            ) : (
              <View style={s.tokenLogoPlaceholder}>
                <Text style={s.tokenLogoText}>{inputSymbol[0]}</Text>
              </View>
            )}
            <Text style={s.tokenSymbol}>{inputSymbol}</Text>
          </View>
          {inputBalance != null && (
            <Text style={s.balanceText}>Bal: {inputBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          )}
        </View>
        <TextInput
          style={s.amountInput}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        {!flipped && inputBalance != null && (
          <View style={s.pctRow}>
            {PERCENTAGES.map(p => (
              <TouchableOpacity key={p} style={s.pctPill} onPress={() => handlePercentage(p)}>
                <Text style={s.pctText}>{p === 100 ? 'MAX' : `${p}%`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Flip Button */}
      <View style={s.flipContainer}>
        <TouchableOpacity style={s.flipBtn} onPress={handleFlip}>
          <Text style={s.flipText}>↕</Text>
        </TouchableOpacity>
      </View>

      {/* Output (Buying) */}
      <Text style={s.fieldLabel}>{flipped ? "You're selling" : "You're buying"}</Text>
      <View style={s.tokenBox}>
        <View style={s.tokenRow}>
          <TouchableOpacity style={s.outputSelector} onPress={() => {
            // Cycle through output tokens
            setOutputIdx(i => (i + 1) % OUTPUT_TOKENS.length);
            setQuoteOutput(null);
          }}>
            {outputLogoURI ? (
              <Image source={{ uri: outputLogoURI }} style={s.tokenLogo} />
            ) : (
              <View style={s.tokenLogoPlaceholder}>
                <Text style={s.tokenLogoText}>{outputSymbol[0]}</Text>
              </View>
            )}
            <Text style={s.tokenSymbol}>{outputSymbol}</Text>
            <Text style={s.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {quoting && <ActivityIndicator size="small" color="#60a5fa" />}
        </View>
        <View style={s.outputValueRow}>
          {quoteOutput ? (
            <Text style={s.outputAmount}>{quoteOutput}</Text>
          ) : quoteError ? (
            <Text style={s.outputError}>{quoteError}</Text>
          ) : (
            <Text style={s.outputPlaceholder}>—</Text>
          )}
        </View>
      </View>

      {/* Wallet warning */}
      {!connected && (
        <Text style={s.walletWarning}>Connect wallet to swap</Text>
      )}

      {/* Swap Button */}
      <TouchableOpacity
        style={[s.swapBtn, (numAmount <= 0 || loading || !connected) && s.swapBtnDisabled]}
        disabled={numAmount <= 0 || loading || !connected}
        onPress={handleSwap}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#0a0e1a" />
        ) : (
          <Text style={s.swapBtnText}>
            Swap → {outputSymbol}
          </Text>
        )}
      </TouchableOpacity>

      <ToastComponent />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#0c1020',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#60a5fa25',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  gearBtn: { padding: 4 },
  gearText: { fontSize: 18 },

  // Slippage
  slippageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#080c18',
    borderRadius: 10,
    padding: 10,
  },
  slippageLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  slippagePills: { flexDirection: 'row', gap: 6, flex: 1 },
  slippagePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1a1f2e',
  },
  slippagePillActive: { backgroundColor: '#60a5fa25', borderWidth: 1, borderColor: '#60a5fa' },
  slippagePillText: { fontSize: 12, color: '#666', fontWeight: '600' },
  slippagePillTextActive: { color: '#60a5fa' },
  slippageInput: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 12,
    maxWidth: 70,
  },
  slippageInputActive: { borderWidth: 1, borderColor: '#60a5fa' },

  // Field labels
  fieldLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6 },

  // Token box
  tokenBox: {
    backgroundColor: '#080c18',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1a204030',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenIdent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenLogo: { width: 28, height: 28, borderRadius: 14 },
  tokenLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2f3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoText: { fontSize: 14, fontWeight: 'bold', color: '#60a5fa' },
  tokenSymbol: { fontSize: 16, fontWeight: '700', color: '#fff' },
  balanceText: { fontSize: 12, color: '#666' },
  amountInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    paddingVertical: 4,
  },
  pctRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pctPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1a1f2e',
  },
  pctText: { fontSize: 11, fontWeight: '700', color: '#60a5fa' },

  // Flip
  flipContainer: { alignItems: 'center', marginVertical: 8 },
  flipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1f2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c1020',
  },
  flipText: { fontSize: 18, color: '#60a5fa', fontWeight: '700' },

  // Output
  outputSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownArrow: { fontSize: 10, color: '#666', marginLeft: 2 },
  outputValueRow: { paddingVertical: 4 },
  outputAmount: { fontSize: 24, fontWeight: '700', color: '#4ade80' },
  outputError: { fontSize: 14, color: '#f87171' },
  outputPlaceholder: { fontSize: 24, fontWeight: '700', color: '#333' },

  // Wallet
  walletWarning: { fontSize: 12, color: '#f4c430', textAlign: 'center', marginTop: 12 },

  // Swap button
  swapBtn: {
    backgroundColor: '#60a5fa',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  swapBtnDisabled: { opacity: 0.4 },
  swapBtnText: { fontSize: 16, fontWeight: '800', color: '#0a0e1a' },
});
