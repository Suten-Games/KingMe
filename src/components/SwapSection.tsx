// src/components/SwapSection.tsx
// ══════════════════════════════════════════════════════════════════
// Drop-in swap UI for asset detail page. Swap any token → USDC or USD*.
// Usage: <SwapSection asset={asset} />
// ══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert as RNAlert,
} from 'react-native';
import { useWallet } from '../providers/wallet-provider';
import {
  getSwapQuote, executeSwap, isSwapConfigured, getSwapDiagnostics,
  fetchMintDecimals, MINTS,
} from '../services/jupiterSwap';
import type { Asset } from '../types';
import { postSwapUpdate } from '../utils/postSwapUpdate';
import { useSwapToast } from './SwapToast';
import { log, warn, error } from '../utils/logger';
import { parseNumber } from '../utils/parseNumber';

function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}

interface Props {
  asset: Asset;
}

const PERCENTAGES = [25, 50, 75, 100] as const;

const OUTPUT_OPTIONS = [
  { label: 'USDC', mint: MINTS.USDC, decimals: 6 },
  { label: 'USD*', mint: MINTS['USD*'], decimals: 6 },
] as const;

export default function SwapSection({ asset }: Props) {
  const { connected, publicKey, signTransaction, signAndSendTransaction } = useWallet();
  const { showToast, ToastComponent } = useSwapToast();

  const meta = asset.metadata as any;
  const mint = meta?.tokenMint || meta?.mint || '';
  const symbol = meta?.symbol || asset.name;
  const balance = meta?.quantity || meta?.balance || 0;
  const pricePerToken = balance > 0 ? asset.value / balance : 0;

  // State
  const [expanded, setExpanded] = useState(false);
  const [outputIdx, setOutputIdx] = useState(0);
  const [pct, setPct] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<string | null>(null);

  const output = OUTPUT_OPTIONS[outputIdx];
  const tokenAmount = pct
    ? balance * (pct / 100)
    : parseNumber(customAmount) || 0;
  const dollarValue = tokenAmount * pricePerToken;

  const handleQuote = useCallback(async () => {
    if (tokenAmount <= 0) return xAlert('Enter an amount');
    if (!connected || !publicKey) return xAlert('Connect Wallet', 'Connect your wallet first.');
    if (!isSwapConfigured()) {
      const d = getSwapDiagnostics();
      return xAlert('Swap Not Available', `API URL: ${d.apiUrl}\n\nSet EXPO_PUBLIC_API_URL in EAS env vars and rebuild.`);
    }

    setLoading(true);
    setQuoteInfo(null);
    try {
      const decimals = meta?.decimals ?? await fetchMintDecimals(mint);
      const quote = await getSwapQuote({
        inputMint: mint,
        outputMint: output.mint,
        amount: tokenAmount,
        inputDecimals: decimals,
        userPublicKey: publicKey.toBase58(),
      });

      const outAmount = parseInt(quote.outAmount) / Math.pow(10, output.decimals);
      setQuoteInfo(`≈ ${outAmount.toFixed(2)} ${output.label}`);
    } catch (e: any) {
      setQuoteInfo(`Quote failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tokenAmount, mint, output, connected, publicKey, meta]);

  const handleSwap = useCallback(async () => {
    if (tokenAmount <= 0) return xAlert('Enter an amount');
    if (!connected || !publicKey) return xAlert('Connect Wallet', 'Connect your wallet first.');
    if (!isSwapConfigured()) {
      const d = getSwapDiagnostics();
      return xAlert('Swap Not Available', `API URL: ${d.apiUrl}\n\nSet EXPO_PUBLIC_API_URL in EAS env vars and rebuild.`);
    }

    setLoading(true);
    showToast({ type: 'loading', symbol, percentage: pct || 0 });
    try {
      const decimals = meta?.decimals ?? await fetchMintDecimals(mint);

      log(`[SWAP] ${symbol}: ${tokenAmount} tokens → ${output.label}, decimals=${decimals}`);

      const result = await executeSwap(
        {
          inputMint: mint,
          outputMint: output.mint,
          amount: tokenAmount,
          inputDecimals: decimals,
          userPublicKey: publicKey.toBase58(),
        },
        signTransaction,
        signAndSendTransaction,
      );

      if (result.success) {
        // Update accumulation plan, store balance, emit event for AccumulationAlerts
        await postSwapUpdate({
          fromMint: mint,
          fromSymbol: symbol,
          tokenAmountSold: tokenAmount,
          pricePerToken,
          usdReceived: dollarValue,
          signature: result.signature || '',
        });

        showToast({
          type: 'success',
          symbol,
          usdReceived: dollarValue,
          signature: result.signature || '',
        });

        setExpanded(false);
        setPct(null);
        setCustomAmount('');
        setQuoteInfo(null);
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
  }, [tokenAmount, mint, symbol, output, connected, publicKey, signTransaction, meta]);

  if (!mint || asset.type !== 'crypto') return null;

  // ── Collapsed: just a button ───────────────────────────────
  if (!expanded) {
    return (
      <TouchableOpacity style={s.swapButton} onPress={() => setExpanded(true)} activeOpacity={0.8}>
        <Text style={s.swapButtonText}>⚡ Swap {symbol}</Text>
      </TouchableOpacity>
    );
  }

  // ── Expanded: full swap UI ─────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>⚡ Swap {symbol}</Text>
        <TouchableOpacity onPress={() => { setExpanded(false); setQuoteInfo(null); }}>
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Output token toggle */}
      <Text style={s.label}>Swap to</Text>
      <View style={s.outputRow}>
        {OUTPUT_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            style={[s.outputPill, outputIdx === i && s.outputPillActive]}
            onPress={() => { setOutputIdx(i); setQuoteInfo(null); }}
          >
            <Text style={[s.outputPillText, outputIdx === i && s.outputPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount selection */}
      <Text style={s.label}>Amount</Text>
      <View style={s.pctRow}>
        {PERCENTAGES.map(p => (
          <TouchableOpacity
            key={p}
            style={[s.pctPill, pct === p && s.pctPillActive]}
            onPress={() => { setPct(p); setCustomAmount(''); setQuoteInfo(null); }}
          >
            <Text style={[s.pctPillText, pct === p && s.pctPillTextActive]}>{p}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom amount */}
      <View style={s.customRow}>
        <Text style={s.customLabel}>or</Text>
        <TextInput
          style={s.customInput}
          placeholder={`e.g., ${Math.floor(balance * 0.1)}`}
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={customAmount}
          onChangeText={v => { setCustomAmount(v); setPct(null); setQuoteInfo(null); }}
        />
        <Text style={s.customUnit}>{symbol}</Text>
      </View>

      {/* Preview */}
      {tokenAmount > 0 && (
        <View style={s.previewBox}>
          <Text style={s.previewText}>
            {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {symbol}
            {' '}≈ ${dollarValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
          {quoteInfo && (
            <Text style={[s.quoteText, quoteInfo.startsWith('≈') ? {} : { color: '#f87171' }]}>
              {quoteInfo}
            </Text>
          )}
        </View>
      )}

      {/* Wallet status */}
      {!connected && (
        <Text style={s.walletWarning}>⚠️ Connect wallet to swap</Text>
      )}

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.quoteBtn, (tokenAmount <= 0 || loading) && { opacity: 0.4 }]}
          disabled={tokenAmount <= 0 || loading}
          onPress={handleQuote}
        >
          {loading && !quoteInfo ? (
            <ActivityIndicator size="small" color="#60a5fa" />
          ) : (
            <Text style={s.quoteBtnText}>Get Quote</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.execBtn, (tokenAmount <= 0 || loading || !connected) && { opacity: 0.4 }]}
          disabled={tokenAmount <= 0 || loading || !connected}
          onPress={handleSwap}
        >
          {loading && quoteInfo ? (
            <ActivityIndicator size="small" color="#080c18" />
          ) : (
            <Text style={s.execBtnText}>Swap → {output.label}</Text>
          )}
        </TouchableOpacity>
      </View>
      <ToastComponent />
    </View>
  );
}

const s = StyleSheet.create({
  // Collapsed button
  swapButton: {
    backgroundColor: '#60a5fa15',
    borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: '#60a5fa30',
    alignItems: 'center',
  },
  swapButtonText: { fontSize: 15, fontWeight: '700', color: '#60a5fa' },

  // Expanded container
  container: {
    backgroundColor: '#0c1020', borderRadius: 14, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#60a5fa25',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#60a5fa' },
  closeBtn: { fontSize: 18, color: '#555', padding: 4 },

  label: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },

  // Output toggle
  outputRow: { flexDirection: 'row', gap: 8 },
  outputPill: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#080c18', borderWidth: 1, borderColor: '#1a204030',
  },
  outputPillActive: { borderColor: '#60a5fa', backgroundColor: '#60a5fa15' },
  outputPillText: { fontSize: 14, fontWeight: '600', color: '#555' },
  outputPillTextActive: { color: '#60a5fa' },

  // Percentage pills
  pctRow: { flexDirection: 'row', gap: 6 },
  pctPill: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#080c18', borderWidth: 1, borderColor: '#1a204030',
  },
  pctPillActive: { borderColor: '#4ade80', backgroundColor: '#4ade8015' },
  pctPillText: { fontSize: 14, fontWeight: '700', color: '#555' },
  pctPillTextActive: { color: '#4ade80' },

  // Custom amount
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  customLabel: { fontSize: 12, color: '#555' },
  customInput: {
    flex: 1, backgroundColor: '#080c18', borderRadius: 10, padding: 10,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#1a204030',
  },
  customUnit: { fontSize: 13, color: '#888', fontWeight: '600' },

  // Preview
  previewBox: {
    marginTop: 12, backgroundColor: '#080c18', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1a204015',
  },
  previewText: { fontSize: 14, color: '#b0b0b8', fontWeight: '600' },
  quoteText: { fontSize: 14, color: '#4ade80', fontWeight: '700', marginTop: 4 },

  walletWarning: { fontSize: 12, color: '#f4c430', textAlign: 'center', marginTop: 10 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quoteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#60a5fa30', backgroundColor: '#60a5fa10',
  },
  quoteBtnText: { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  execBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#60a5fa',
  },
  execBtnText: { fontSize: 14, fontWeight: '700', color: '#080c18' },
});
