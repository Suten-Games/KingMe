// src/components/assets/SKRCard.tsx
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { Transaction } from '@solana/web3.js';
import type { SKRHolding, SKRIncomeSnapshot } from '../../services/skr';
import { buildStakeTransaction, buildUnstakeTransaction } from '../../services/skr';
import { useWallet } from '../../providers/wallet-provider';

interface SKRCardProps {
  holding: SKRHolding;
  income: SKRIncomeSnapshot;
  onEdit?: () => void;
  onRefresh?: () => void;
}

export default function SKRCard({ holding, income, onEdit, onRefresh }: SKRCardProps) {
  const { publicKey, signAndSendTransaction, signTransaction } = useWallet();
  const [action, setAction] = useState<'stake' | 'unstake' | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const stakedPercentage = holding.totalBalance > 0
    ? (holding.stakedBalance / holding.totalBalance) * 100
    : 0;

  const unstakeTimeLeft = holding.isUnstaking && holding.unstakeTimestamp > 0
    ? Math.max(0, (holding.unstakeTimestamp + 48 * 3600) - Date.now() / 1000)
    : 0;
  const unstakeHoursLeft = Math.ceil(unstakeTimeLeft / 3600);

  const handleSubmit = async () => {
    if (!publicKey || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid amount of SKR.');
      return;
    }

    const wallet = publicKey.toBase58();
    setLoading(true);

    try {
      const { transaction: txBase64 } =
        action === 'stake'
          ? await buildStakeTransaction(wallet, amt)
          : await buildUnstakeTransaction(wallet, amt);

      // Deserialize the legacy Transaction from base64
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);

      const isWeb = Platform.OS === 'web';
      if (isWeb && signAndSendTransaction) {
        await signAndSendTransaction(tx);
      } else if (signTransaction) {
        const signed = await signTransaction(tx);
        const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
        const { Connection } = await import('@solana/web3.js');
        const conn = new Connection(rpcUrl, 'confirmed');
        await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      }

      Alert.alert(
        action === 'stake' ? 'Staked!' : 'Unstake Started',
        action === 'stake'
          ? `${amt} SKR staked successfully.`
          : `${amt} SKR unstaking (48-hour cooldown).`,
      );
      setAction(null);
      setAmount('');
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const maxAmount = action === 'stake' ? holding.liquidBalance : holding.stakedBalance;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>◎</Text>
          <View>
            <Text style={styles.title}>$SKR — Solana Mobile</Text>
            <Text style={styles.subtitle}>Auto-detected from wallet</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.apyBadge}>
            <Text style={styles.apyText}>
              {((holding.apy ?? 0) * 100).toFixed(0)}% APY
            </Text>
          </View>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.barBackground}>
        <View style={[styles.barFilled, { width: `${stakedPercentage}%` }]} />
      </View>

      <View style={styles.barLabels}>
        <Text style={styles.barLabelStaked}>
          Staked: {holding.stakedBalance.toLocaleString()} SKR
        </Text>
        <Text style={styles.barLabelLiquid}>
          Liquid: {holding.liquidBalance.toLocaleString()} SKR
        </Text>
      </View>

      {/* Unstaking banner */}
      {holding.isUnstaking && holding.unstakingBalance > 0 && (
        <View style={styles.unstakingBanner}>
          <Text style={styles.unstakingText}>
            Unstaking {holding.unstakingBalance.toLocaleString()} SKR
            {unstakeHoursLeft > 0 ? ` — ${unstakeHoursLeft}h remaining` : ' — Ready to claim'}
          </Text>
        </View>
      )}

      <View style={styles.numbers}>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Total Value</Text>
          <Text style={styles.numberValue}>
            ${income.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Monthly Yield</Text>
          <Text style={[styles.numberValue, styles.numberValueGreen]}>
            ${income.monthlyYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.numberCol}>
          <Text style={styles.numberLabel}>Annual Yield</Text>
          <Text style={[styles.numberValue, styles.numberValueGreen]}>
            ${income.annualYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Stake / Unstake buttons */}
      {publicKey && !action && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.stakeBtn]}
            onPress={() => setAction('stake')}
            disabled={holding.liquidBalance <= 0}
          >
            <Text style={styles.actionBtnText}>Stake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.unstakeBtn]}
            onPress={() => setAction('unstake')}
            disabled={holding.stakedBalance <= 0 || holding.isUnstaking}
          >
            <Text style={styles.actionBtnTextSecondary}>Unstake</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Amount input */}
      {action && (
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>
            {action === 'stake' ? 'Stake' : 'Unstake'} SKR
          </Text>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.maxBtn}
              onPress={() => setAmount(maxAmount.toString())}
            >
              <Text style={styles.maxBtnText}>MAX</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setAction(null); setAmount(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, action === 'stake' ? styles.stakeBtn : styles.unstakeBtn]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {action === 'stake' ? 'Confirm Stake' : 'Confirm Unstake'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    fontSize: 28,
    color: '#f4c430',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  apyBadge: {
    backgroundColor: '#f4c43022',
    borderWidth: 1,
    borderColor: '#f4c430',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  apyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ade80',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#0a0e1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFilled: {
    height: '100%',
    backgroundColor: '#f4c430',
    borderRadius: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  barLabelStaked: {
    fontSize: 12,
    color: '#f4c430',
    fontWeight: '600',
  },
  barLabelLiquid: {
    fontSize: 12,
    color: '#666',
  },
  unstakingBanner: {
    backgroundColor: '#f4c43015',
    borderWidth: 1,
    borderColor: '#f4c43040',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  unstakingText: {
    fontSize: 12,
    color: '#f4c430',
    fontWeight: '600',
    textAlign: 'center',
  },
  numbers: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  numberCol: {
    flex: 1,
    alignItems: 'center',
  },
  numberLabel: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  numberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  numberValueGreen: {
    color: '#4ade80',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  stakeBtn: {
    backgroundColor: '#f4c430',
  },
  unstakeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#f4c43080',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  actionBtnTextSecondary: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  inputRow: {
    marginTop: 10,
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  maxBtn: {
    backgroundColor: '#f4c43030',
    borderWidth: 1,
    borderColor: '#f4c430',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  maxBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  inputActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2a2f3e',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
});
