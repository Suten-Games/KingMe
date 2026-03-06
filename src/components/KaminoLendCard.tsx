// src/components/KaminoLendCard.tsx
// Deposit/withdraw UI for Kamino lending — shown on asset detail pages
// and as a standalone card for yield opportunities.

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert as RNAlert,
} from 'react-native';
import { useWallet } from '../providers/wallet-provider';
import { executeKaminoDeposit, executeKaminoWithdraw, fetchKaminoBalances } from '../services/kaminoLend';
import { fetchLiveBalances } from '../services/jupiterSwap';
import { useSwapToast } from './SwapToast';
import type { Asset } from '../types';

function xAlert(t: string, m?: string) {
  Platform.OS === 'web' ? window.alert(m ? `${t}\n\n${m}` : t) : RNAlert.alert(t, m);
}

interface Props {
  asset: Asset;
  kaminoApy?: number; // Live APY from kaminoRates
}

const PERCENTAGES = [25, 50, 75, 100] as const;

export default function KaminoLendCard({ asset, kaminoApy }: Props) {
  const { connected, publicKey, signTransaction, signAndSendTransaction } = useWallet();
  const { showToast, ToastComponent } = useSwapToast();

  const meta = asset.metadata as any;
  const mint = meta?.tokenMint || meta?.mint || '';
  const symbol = meta?.symbol || asset.name;
  const balance = meta?.quantity || meta?.balance || 0;
  const isOnKamino = meta?.protocol?.toLowerCase() === 'kamino';
  const currentApy = meta?.apy || 0;

  const [mode, setMode] = useState<'deposit' | 'withdraw'>(isOnKamino ? 'withdraw' : 'deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [kaminoBalance, setKaminoBalance] = useState<number | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const apy = kaminoApy || currentApy || 0;
  const projectedAnnual = numAmount > 0 ? numAmount * (meta?.priceUSD || 1) * (apy / 100) : 0;

  // Fetch Kamino balance for withdraw mode
  useEffect(() => {
    if (!connected || !publicKey || !isOnKamino) return;
    fetchKaminoBalances(publicKey.toBase58()).then(pos => {
      const dep = pos.deposits.find(d =>
        d.symbol?.toUpperCase() === symbol.toUpperCase() || d.mint === mint
      );
      if (dep) setKaminoBalance(dep.amount);
    }).catch(() => {});
  }, [connected, publicKey, isOnKamino, symbol, mint]);

  const handlePercentage = (pct: number) => {
    const source = mode === 'withdraw' ? (kaminoBalance ?? balance) : balance;
    const val = source * (pct === 100 ? 0.999 : pct / 100);
    setAmount(val.toString());
  };

  const handleExecute = useCallback(async () => {
    if (numAmount <= 0) return xAlert('Enter an amount');
    if (!connected || !publicKey) return xAlert('Connect Wallet', 'Connect your wallet first.');

    setLoading(true);
    showToast({ type: 'loading', symbol, percentage: 0 });

    try {
      // Pre-flight: check SOL for fees
      const { solBalance } = await fetchLiveBalances(publicKey.toBase58());
      if (solBalance < 0.005) {
        setLoading(false);
        return xAlert('Not enough SOL', `You need ~0.005 SOL for fees. You have ${solBalance.toFixed(6)} SOL.`);
      }

      const result = mode === 'deposit'
        ? await executeKaminoDeposit(publicKey.toBase58(), mint, numAmount, signTransaction, signAndSendTransaction)
        : await executeKaminoWithdraw(publicKey.toBase58(), mint, numAmount, signTransaction, signAndSendTransaction);

      if (result.success) {
        showToast({
          type: 'success',
          symbol,
          usdReceived: numAmount * (meta?.priceUSD || 1),
          signature: result.signature || '',
        });
        setAmount('');
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
  }, [numAmount, mint, mode, connected, publicKey, signTransaction, signAndSendTransaction]);

  if (!mint || apy <= 0) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Kamino Lending</Text>
        <View style={s.apyBadge}>
          <Text style={s.apyText}>{apy.toFixed(2)}% APY</Text>
        </View>
      </View>

      {/* Mode toggle */}
      <View style={s.modeRow}>
        <TouchableOpacity
          style={[s.modeBtn, mode === 'deposit' && s.modeBtnActive]}
          onPress={() => { setMode('deposit'); setAmount(''); }}
        >
          <Text style={[s.modeBtnText, mode === 'deposit' && s.modeBtnTextActive]}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeBtn, mode === 'withdraw' && s.modeBtnActive]}
          onPress={() => { setMode('withdraw'); setAmount(''); }}
        >
          <Text style={[s.modeBtnText, mode === 'withdraw' && s.modeBtnTextActive]}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Amount input */}
      <View style={s.inputBox}>
        <View style={s.inputRow}>
          <Text style={s.inputSymbol}>{symbol}</Text>
          <Text style={s.inputBalance}>
            {mode === 'withdraw'
              ? `Supplied: ${(kaminoBalance ?? balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
              : `Bal: ${balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            }
          </Text>
        </View>
        <TextInput
          style={s.amountInput}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={s.pctRow}>
          {PERCENTAGES.map(p => (
            <TouchableOpacity key={p} style={s.pctPill} onPress={() => handlePercentage(p)}>
              <Text style={s.pctText}>{p === 100 ? 'MAX' : `${p}%`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Projected yield */}
      {mode === 'deposit' && numAmount > 0 && (
        <View style={s.projectionBox}>
          <Text style={s.projectionLabel}>Projected annual yield</Text>
          <Text style={s.projectionValue}>
            +${projectedAnnual.toFixed(2)}/yr (${(projectedAnnual / 12).toFixed(2)}/mo)
          </Text>
        </View>
      )}

      {/* Wallet warning */}
      {!connected && (
        <Text style={s.walletWarning}>Connect wallet to {mode}</Text>
      )}

      {/* Action button */}
      <TouchableOpacity
        style={[s.actionBtn, (numAmount <= 0 || loading || !connected) && s.actionBtnDisabled]}
        disabled={numAmount <= 0 || loading || !connected}
        onPress={handleExecute}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#080c18" />
        ) : (
          <Text style={s.actionBtnText}>
            {mode === 'deposit' ? `Deposit ${symbol} to Kamino` : `Withdraw ${symbol} from Kamino`}
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
    borderColor: '#3b82f625',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  apyBadge: {
    backgroundColor: '#4ade8020',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ade8040',
  },
  apyText: { fontSize: 13, fontWeight: '700', color: '#4ade80' },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1a1f2e',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#3b82f625', borderWidth: 1, borderColor: '#3b82f6' },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  modeBtnTextActive: { color: '#3b82f6' },

  // Input
  inputBox: {
    backgroundColor: '#080c18',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1a204030',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputSymbol: { fontSize: 16, fontWeight: '700', color: '#fff' },
  inputBalance: { fontSize: 12, color: '#666' },
  amountInput: { fontSize: 24, fontWeight: '700', color: '#fff', paddingVertical: 4 },
  pctRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pctPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#1a1f2e' },
  pctText: { fontSize: 11, fontWeight: '700', color: '#3b82f6' },

  // Projection
  projectionBox: {
    backgroundColor: '#4ade8010',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#4ade8020',
  },
  projectionLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  projectionValue: { fontSize: 14, fontWeight: '700', color: '#4ade80' },

  // Wallet
  walletWarning: { fontSize: 12, color: '#f4c430', textAlign: 'center', marginTop: 12 },

  // Action
  actionBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#080c18' },
});
