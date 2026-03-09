// app/business.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Business Dashboard — user-configurable business name and entity type.
// Tracks: referral wallet, business bank account, expenses, distributions, P&L
// Auto-syncs business net value → personal asset of type 'business'
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { VersionedTransaction } from '@solana/web3.js';
import { decode as b64decode } from 'base-64';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import { useWallet } from '../src/providers/wallet-provider';
import { useStore } from '../src/store/useStore';
import {
  type BusinessData, type PLSnapshot,
  ENTITY_LABELS, EXPENSE_CATEGORIES, DEFAULT_INFO, DEFAULT_DATA,
} from '../src/types/businessTypes';
import {
  SetupModal, WalletModal, BankModal, ExpenseModal,
  DistributionModal, ContributionModal, InfoModal, ImportModal, ReassignModal, AIModal,
} from '../src/components/business/BusinessModals';
import { log, warn, error as logError } from '@/utils/logger';

const STORAGE_KEY = 'business_dashboard_data';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ─── Auto-sync business → personal asset ─────────────────────────────────────

function syncBusinessAsset(data: BusinessData) {
  const store = useStore.getState();
  const bankBal = data.bankAccount?.balance || 0;
  const walletBal = data.referralBalance?.totalUSD || 0;
  const netValue = bankBal + walletBal;

  if (!data.businessName) return;

  const assetId = `biz_${data.businessName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const existing = store.assets.find(a => a.id === assetId);

  if (existing) {
    // Update value
    if (Math.abs(existing.value - netValue) > 1) {
      store.updateAsset(assetId, {
        value: netValue,
        name: data.businessName,
        metadata: {
          ...((existing.metadata || {}) as any),
          type: 'business',
          description: `${ENTITY_LABELS[data.entityType]} · Auto-synced from Business Dashboard`,
          bankBalance: bankBal,
          walletBalance: walletBal,
          lastSynced: new Date().toISOString(),
        },
      });
      log(`[BIZ] Updated ${data.businessName} asset: $${netValue}`);
    }
  } else {
    // Create new asset
    store.addAsset({
      id: assetId,
      type: 'business',
      name: data.businessName,
      value: netValue,
      annualIncome: 0, // Distributions are tracked separately
      metadata: {
        type: 'business',
        description: `${ENTITY_LABELS[data.entityType]} · Auto-synced from Business Dashboard`,
        bankBalance: bankBal,
        walletBalance: walletBal,
        lastSynced: new Date().toISOString(),
      } as any,
    });
    log(`[BIZ] Created ${data.businessName} asset: $${netValue}`);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BusinessDashboard() {
  const router = useRouter();
  const { publicKey, signTransaction, connected } = useWallet();
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<BusinessData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState('');
  // Modal visibility
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDistModal, setShowDistModal] = useState(false);
  const [showContribModal, setShowContribModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiType, setAIType] = useState<'business_plan' | 'tax_strategy' | 'expense_optimization'>('business_plan');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // P&L snapshots
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);

  // Break-even calculator
  const [revenuePerUser, setRevenuePerUser] = useState('4.99');

  // ── Load / Save ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const parsed = { ...DEFAULT_DATA, ...JSON.parse(raw) };
        setData(parsed);
        syncBusinessAsset(parsed);
        // Show setup if no business name
        if (!parsed.businessName) setShowSetupModal(true);
      } else {
        setShowSetupModal(true);
      }
      setLoading(false);
    });
  }, []);

  const save = useCallback(async (newData: BusinessData) => {
    setData(newData);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    // Auto-sync to personal assets
    syncBusinessAsset(newData);
  }, []);

  // Unified save handler for modals
  const handleModalSave = useCallback((updates: Partial<BusinessData>) => {
    save({ ...data, ...updates });
  }, [data, save]);

  // ── Sync Referral Wallet ───────────────────────────────────
  const syncReferralWallet = async () => {
    if (!data.referralWallet) {
      Alert.alert('No Wallet', 'Set your referral wallet address first.');
      return;
    }
    setSyncing(true);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
      const rpcProxy = `${API_BASE}/api/rpc/send`;

      // SOL balance
      const balResp = await fetch(rpcProxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [data.referralWallet] }),
      });
      const balData = await balResp.json();
      const solBalance = (balData.result?.value || 0) / 1e9;

      // Token accounts
      const tokResp = await fetch(rpcProxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'getTokenAccountsByOwner',
          params: [data.referralWallet, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
        }),
      });
      const tokData = await tokResp.json();
      const tokenAccounts = tokData.result?.value || [];

      let usdcBalance = 0;
      const otherTokens: { symbol: string; mint: string; amount: number }[] = [];
      for (const acct of tokenAccounts) {
        const info = acct.account?.data?.parsed?.info;
        if (!info) continue;
        const amount = info.tokenAmount?.uiAmount || 0;
        if (amount === 0) continue;
        if (info.mint === USDC_MINT) { usdcBalance = amount; }
        else { otherTokens.push({ symbol: info.mint.slice(0, 6), mint: info.mint, amount }); }
      }

      // Prices
      const mintsToPrice = [SOL_MINT, ...otherTokens.map(t => t.mint)];
      let prices: Record<string, number> = {};
      try {
        const priceResp = await fetch(`${JUPITER_PRICE_API}?ids=${mintsToPrice.join(',')}`);
        const priceData = await priceResp.json();
        for (const [mint, info] of Object.entries(priceData.data || {})) {
          prices[mint] = parseFloat((info as any).price || '0');
        }
      } catch {}

      const solPrice = prices[SOL_MINT] || 0;
      const otherWithValue = otherTokens.map(t => ({
        symbol: t.symbol, amount: t.amount, valueUSD: t.amount * (prices[t.mint] || 0),
      })).filter(t => t.valueUSD > 0.01);

      const totalUSD = (solBalance * solPrice) + usdcBalance + otherWithValue.reduce((s, t) => s + t.valueUSD, 0);

      await save({
        ...data,
        referralBalance: { sol: solBalance, usdc: usdcBalance, other: otherWithValue, totalUSD, lastFetched: new Date().toISOString() },
      });
    } catch (err: any) {
      logError('Referral sync error:', err);
      Alert.alert('Sync Failed', 'Could not sync referral data. Please check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Claim Referral Fees ───────────────────────────────────
  const claimReferralFees = async () => {
    if (!connected || !publicKey) {
      Alert.alert('Connect Wallet', 'Connect your personal wallet first — it must be the one registered as the Jupiter referral partner.');
      return;
    }
    if (!data.referralWallet) {
      Alert.alert('No Referral Wallet', 'Set your referral wallet address first.');
      return;
    }

    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
    const partnerKey = publicKey.toBase58();
    const businessWallet = data.referralWallet;

    setClaiming(true);
    setClaimStatus('Checking claimable fees...');

    try {
      // 1. Preview — see what's claimable
      const previewRes = await fetch(`${API_BASE}/api/referral/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: partnerKey, action: 'preview' }),
      });
      const preview = await previewRes.json();
      if (preview.error) throw new Error(preview.error);
      if (!preview.claims || preview.claims.length === 0) {
        Alert.alert('Nothing to Claim', 'No referral fees available to claim right now.');
        return;
      }

      // 2. Confirm with user
      const claimSummary = preview.claims
        .map((c: any) => `${c.uiAmount.toFixed(4)} ${c.symbol} ($${c.valueUSD.toFixed(2)})`)
        .join('\n');

      const confirmed = await new Promise<boolean>(resolve => {
        Alert.alert(
          `Claim $${preview.totalValueUSD.toFixed(2)} in Referral Fees`,
          `${claimSummary}\n\nFees will be claimed and transferred to your business wallet.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Claim & Transfer', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;

      // 3. Build transactions
      setClaimStatus('Building transactions...');
      const buildRes = await fetch(`${API_BASE}/api/referral/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPublicKey: partnerKey,
          businessWallet,
          action: 'claim',
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.error) throw new Error(buildData.error);

      const { claimTransactions, transferTransactions, claims } = buildData;
      const rpcProxy = `${API_BASE}/api/rpc/send`;

      // Helper: deserialize, sign, send, confirm
      const signAndSend = async (b64Tx: string, label: string) => {
        const bytes = Uint8Array.from(b64decode(b64Tx), (c: string) => c.charCodeAt(0));
        const tx = VersionedTransaction.deserialize(bytes);
        const signed = await signTransaction(tx);
        const raw = Buffer.from(signed.serialize()).toString('base64');
        const res = await fetch(rpcProxy, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'sendTransaction',
            params: [raw, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }],
          }),
        });
        const result = await res.json();
        if (result.error) throw new Error(`${label}: ${result.error.message || JSON.stringify(result.error)}`);
        log(`[REFERRAL] ${label} sent: ${result.result}`);

        // Wait for confirmation
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const statusRes = await fetch(rpcProxy, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method: 'getSignatureStatuses',
              params: [[result.result], { searchTransactionHistory: false }],
            }),
          });
          const statusData = await statusRes.json();
          const status = statusData.result?.value?.[0];
          if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
            if (status.err) throw new Error(`${label} failed on-chain: ${JSON.stringify(status.err)}`);
            return result.result;
          }
        }
        return result.result; // timed out waiting but tx was sent
      };

      // 4. Sign + send claim transactions
      for (let i = 0; i < claimTransactions.length; i++) {
        setClaimStatus(`Claiming fees (${i + 1}/${claimTransactions.length})...`);
        await signAndSend(claimTransactions[i], `Claim ${i + 1}`);
      }

      // 5. Sign + send transfer transactions
      for (let i = 0; i < transferTransactions.length; i++) {
        setClaimStatus(`Transferring to business wallet (${i + 1}/${transferTransactions.length})...`);
        await signAndSend(transferTransactions[i], `Transfer ${i + 1}`);
      }

      // 6. Log as business income
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const newTransactions = claims.map((c: any) => ({
        id: `referral_claim_${Date.now()}_${c.mint.slice(0, 8)}`,
        bankAccountId: 'business',
        date: dateStr,
        description: `Jupiter referral claim — ${c.uiAmount.toFixed(4)} ${c.symbol}`,
        amount: c.valueUSD,
        category: 'income_other' as const,
        type: 'income' as const,
        notes: `Claimed from referral program. Mint: ${c.mint}. Transferred to business wallet ${businessWallet.slice(0, 6)}...${businessWallet.slice(-4)}`,
        importedFrom: 'manual' as const,
      }));

      const updatedData = {
        ...data,
        transactions: [...(data.transactions || []), ...newTransactions],
      };

      // Update bank balance if business account exists
      if (updatedData.bankAccount) {
        updatedData.bankAccount = {
          ...updatedData.bankAccount,
          balance: updatedData.bankAccount.balance + preview.totalValueUSD,
          lastUpdated: now.toISOString(),
        };
      }

      await save(updatedData);

      // 7. Re-sync referral wallet to show zero balance
      setClaimStatus('Syncing...');
      await syncReferralWallet();

      Alert.alert(
        'Fees Claimed!',
        `$${preview.totalValueUSD.toFixed(2)} in referral fees claimed and transferred to your business wallet.\n\nLogged as business income.`,
      );

    } catch (err: any) {
      logError('[REFERRAL] Claim error:', err);
      Alert.alert('Claim Failed', err.message || 'Something went wrong claiming referral fees.');
    } finally {
      setClaiming(false);
      setClaimStatus('');
    }
  };

  // ── Calculations ───────────────────────────────────────────
  const monthlyExpenses = data.expenses.reduce((sum, e) => {
    if (e.frequency === 'monthly') return sum + e.amount;
    if (e.frequency === 'annual') return sum + e.amount / 12;
    return sum;
  }, 0);

  const annualExpenses = data.expenses.reduce((sum, e) => {
    if (e.frequency === 'monthly') return sum + e.amount * 12;
    if (e.frequency === 'annual') return sum + e.amount;
    if (e.frequency === 'one-time') return sum + e.amount;
    return sum;
  }, 0);

  const totalRevenue = data.referralBalance?.totalUSD || 0;
  const bankBal = data.bankAccount?.balance || 0;
  const totalDistributions = data.distributions.reduce((s, d) => s + d.amount, 0);
  const totalContributions = (data.contributions || []).reduce((s, c) => s + c.amount, 0);
  const netPosition = bankBal + totalRevenue;

  // Break-even
  const rpu = parseFloat(revenuePerUser) || 0;
  const usersToBreakEvenMonthly = rpu > 0 ? Math.ceil(monthlyExpenses / rpu) : 0;
  const usersToBreakEvenAnnual = rpu > 0 ? Math.ceil(annualExpenses / rpu) : 0;

  // ── Inline CRUD helpers ──────────────────────────────────────
  const deleteExpense = (id: string) => save({ ...data, expenses: data.expenses.filter(e => e.id !== id) });
  const deleteDistribution = (id: string) => save({ ...data, distributions: data.distributions.filter(d => d.id !== id) });
  const deleteContribution = (id: string) => save({ ...data, contributions: (data.contributions || []).filter(c => c.id !== id) });

  // ── Logo ─────────────────────────────────────────────────────
  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Store as base64 data URI for portability
    const uri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    save({ ...data, logoUri: uri });
  };

  // ── P&L Snapshot ────────────────────────────────────────────
  const takeSnapshot = () => {
    const now = new Date();
    const label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // Don't allow duplicate snapshots for the same month
    const existing = (data.plSnapshots || []);
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const alreadyExists = existing.find(s => {
      const d = new Date(s.date);
      return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
    });
    if (alreadyExists) {
      Alert.alert('Already Saved', `You already have a snapshot for ${label}. It will be updated.`);
      const updated = existing.map(s => {
        const d = new Date(s.date);
        if (`${d.getFullYear()}-${d.getMonth()}` === monthKey) {
          return { ...s, revenue: totalRevenue, bankBalance: bankBal, walletBalance: data.referralBalance?.totalUSD || 0,
            monthlyExpenses, annualExpenses, totalDistributions, totalContributions, netPosition, date: now.toISOString() };
        }
        return s;
      });
      save({ ...data, plSnapshots: updated });
      return;
    }
    const snapshot: PLSnapshot = {
      id: Date.now().toString(),
      date: now.toISOString(),
      label,
      revenue: totalRevenue,
      bankBalance: bankBal,
      walletBalance: data.referralBalance?.totalUSD || 0,
      monthlyExpenses,
      annualExpenses,
      totalDistributions,
      totalContributions,
      netPosition,
    };
    save({ ...data, plSnapshots: [...existing, snapshot] });
    Alert.alert('Snapshot Saved', `P&L snapshot for ${label} saved.`);
  };

  // ── PDF Export ──────────────────────────────────────────────
  const exportPDF = async (content: string, title: string) => {
    const logoHtml = data.logoUri
      ? `<img src="${data.logoUri}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;" />`
      : '';
    const htmlContent = content
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.6; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #f4c430; }
        .header h1 { margin: 0; font-size: 24px; color: #1a1a2e; }
        .header .entity { color: #666; font-size: 14px; margin-top: 4px; }
        h1 { font-size: 20px; color: #1a1a2e; margin-top: 24px; }
        h2 { font-size: 18px; color: #2a2a4e; margin-top: 20px; }
        h3 { font-size: 16px; color: #3a3a5e; margin-top: 16px; }
        p { margin: 8px 0; }
        ul { padding-left: 20px; }
        li { margin: 4px 0; }
        strong { color: #1a1a2e; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
      </style></head><body>
      <div class="header">
        ${logoHtml}
        <div>
          <h1 style="margin:0">${data.businessName}</h1>
          <div class="entity">${ENTITY_LABELS[data.entityType]}${data.info?.stateOfFormation ? ` \u00B7 ${data.info.stateOfFormation}` : ''}</div>
        </div>
      </div>
      <p>${htmlContent}</p>
      <div class="footer">Generated by KingMe Business Dashboard \u00B7 ${new Date().toLocaleDateString()}</div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const pdfName = `${data.businessName.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/\s/g, '_')}.pdf`;
      const newUri = `${FileSystem.cacheDirectory}${pdfName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: title });
      } else {
        Alert.alert('PDF Saved', `Saved to ${newUri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', 'Could not export data. Please try again.');
    }
  };

  if (loading) {
    return <View style={st.loadingContainer}><ActivityIndicator color="#f4c430" size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      <LinearGradient
        colors={['#10162a', '#0c1020', '#080c18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: Math.max(insets.top, 14) }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ padding: 8, marginRight: 2 }}>
            <Text style={{ fontSize: 20, color: '#60a5fa', fontWeight: '600' }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Image source={require('../src/assets/images/kingmelogo.jpg')} style={{ width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' }} resizeMode="cover" />
            <MaskedView maskElement={<Text style={{ fontSize: 18, fontWeight: '800', color: '#f4c430', letterSpacing: 1, lineHeight: 24, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>}>
              <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#f4c430', letterSpacing: 1, lineHeight: 24, opacity: 0, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>
              </LinearGradient>
            </MaskedView>
          </TouchableOpacity>
          <View style={{ marginLeft: 'auto' }}><WalletHeaderButton /></View>
        </View>
        <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, marginTop: 10, borderRadius: 1 }} />
      </LinearGradient>

      <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Business name + logo */}
        <View style={st.bizHeader}>
          <TouchableOpacity onPress={pickLogo} style={st.logoWrap}>
            {data.logoUri ? (
              <Image source={{ uri: data.logoUri }} style={st.logoImg} />
            ) : (
              <View style={st.logoPlaceholder}>
                <Text style={{ fontSize: 20, color: '#555' }}>+</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { setSetupName(data.businessName); setSetupDesc(data.businessDescription || ''); setSetupEntity(data.entityType); setShowSetupModal(true); }}>
              <Text style={st.pageTitle}>{data.businessName || 'My Business'}</Text>
            </TouchableOpacity>
            <Text style={st.entityLabel}>{ENTITY_LABELS[data.entityType]}</Text>
          </View>
        </View>

        {data.businessDescription ? (
          <TouchableOpacity style={st.descriptionBox} activeOpacity={0.7}
            onPress={() => { setSetupName(data.businessName); setSetupDesc(data.businessDescription || ''); setSetupEntity(data.entityType); setShowSetupModal(true); }}>
            <Text style={st.descriptionText}>{data.businessDescription}</Text>
            <Text style={st.editHint}>Tap to edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={st.descriptionBox} activeOpacity={0.7}
            onPress={() => { setSetupName(data.businessName); setSetupDesc(''); setSetupEntity(data.entityType); setShowSetupModal(true); }}>
            <Text style={[st.descriptionText, { fontStyle: 'italic' }]}>No description yet. Tap to add one.</Text>
          </TouchableOpacity>
        )}

      {/* ── Business Info ─────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Business Info</Text>
          <TouchableOpacity onPress={() => { setInfoForm(data.info || DEFAULT_INFO); setShowInfoModal(true); }}>
            <Text style={st.syncBtn}>{data.info?.ein ? 'Edit' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {data.info?.ein || data.info?.stateOfFormation || data.info?.members ? (
          <View style={st.card}>
            {data.info.ein ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>EIN</Text>
                <Text style={st.infoValue}>***-***{data.info.ein.slice(-4)}</Text>
              </View>
            ) : null}
            {data.info.stateOfFormation ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>State</Text>
                <Text style={st.infoValue}>{data.info.stateOfFormation}</Text>
              </View>
            ) : null}
            {data.info.formationDate ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Formed</Text>
                <Text style={st.infoValue}>{data.info.formationDate}</Text>
              </View>
            ) : null}
            {data.info.registeredAgent ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Registered Agent</Text>
                <Text style={st.infoValue}>{data.info.registeredAgent}</Text>
              </View>
            ) : null}
            {data.info.taxStatus ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Tax Status</Text>
                <Text style={st.infoValue}>{data.info.taxStatus}</Text>
              </View>
            ) : null}
            {data.info.fiscalYearEnd ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Fiscal Year</Text>
                <Text style={st.infoValue}>Ends {data.info.fiscalYearEnd}</Text>
              </View>
            ) : null}
            {data.info.businessAddress ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Address</Text>
                <Text style={st.infoValue}>{data.info.businessAddress}</Text>
              </View>
            ) : null}
            {data.info.members ? (
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>Members</Text>
                <Text style={st.infoValue}>{data.info.members}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity style={st.setupCard} onPress={() => { setInfoForm(DEFAULT_INFO); setShowInfoModal(true); }}>
            <Text style={st.setupEmoji}>{'📋'}</Text>
            <Text style={st.setupText}>Add business details</Text>
            <Text style={st.setupSub}>EIN, state of formation, registered agent, etc.</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── AI Tools ──────────────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>AI-Powered Tools</Text>
        <Text style={[st.mutedText, { marginBottom: 10 }]}>Generate insights using your business data</Text>
        <View style={{ gap: 8 }}>
          <TouchableOpacity style={st.aiToolBtn} onPress={() => { setAIType('business_plan'); setShowAIModal(true); }}>
            <Text style={st.aiToolEmoji}>{'📝'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.aiToolTitle}>Business Plan</Text>
              <Text style={st.aiToolDesc}>Executive summary, model, financials, growth strategy</Text>
            </View>
            <Text style={st.aiToolArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.aiToolBtn} onPress={() => { setAIType('tax_strategy'); setShowAIModal(true); }}>
            <Text style={st.aiToolEmoji}>{'🏛️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.aiToolTitle}>Tax Strategy</Text>
              <Text style={st.aiToolDesc}>Deductions, entity optimization, quarterly estimates</Text>
            </View>
            <Text style={st.aiToolArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.aiToolBtn} onPress={() => { setAIType('expense_optimization'); setShowAIModal(true); }}>
            <Text style={st.aiToolEmoji}>{'💡'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.aiToolTitle}>Expense Optimization</Text>
              <Text style={st.aiToolDesc}>Cost reduction, tool alternatives, scaling insights</Text>
            </View>
            <Text style={st.aiToolArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Referral Wallet ──────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>🪐 Referral Wallet</Text>
          {data.referralWallet && (
            <TouchableOpacity onPress={syncReferralWallet} disabled={syncing}>
              {syncing ? <ActivityIndicator size="small" color="#f4c430" /> : <Text style={st.syncBtn}>🔄 Sync</Text>}
            </TouchableOpacity>
          )}
        </View>

        {!data.referralWallet ? (
          <TouchableOpacity style={st.setupCard} onPress={() => setShowWalletModal(true)}>
            <Text style={st.setupEmoji}>👛</Text>
            <Text style={st.setupText}>Set referral wallet address</Text>
            <Text style={st.setupSub}>The wallet that receives swap referral fees</Text>
          </TouchableOpacity>
        ) : (
          <View style={st.card}>
            <TouchableOpacity onPress={() => setShowWalletModal(true)}>
              <Text style={st.walletAddr}>{data.referralWallet.slice(0, 6)}...{data.referralWallet.slice(-6)}</Text>
            </TouchableOpacity>
            {data.referralBalance ? (
              <>
                <Text style={st.bigValue}>${data.referralBalance.totalUSD.toFixed(2)}</Text>
                <View style={st.tokenRow}>
                  {data.referralBalance.sol > 0.001 && <View style={st.tokenPill}><Text style={st.tokenPillText}>{data.referralBalance.sol.toFixed(4)} SOL</Text></View>}
                  {data.referralBalance.usdc > 0.01 && <View style={st.tokenPill}><Text style={st.tokenPillText}>{data.referralBalance.usdc.toFixed(2)} USDC</Text></View>}
                  {data.referralBalance.other.map((t, i) => <View key={i} style={st.tokenPill}><Text style={st.tokenPillText}>{t.amount.toFixed(2)} {t.symbol}</Text></View>)}
                </View>
                <Text style={st.lastSync}>Last synced: {new Date(data.referralBalance.lastFetched).toLocaleString()}</Text>
                {data.referralBalance.totalUSD > 0.01 && (
                  <TouchableOpacity
                    style={[st.claimBtn, claiming && { opacity: 0.6 }]}
                    onPress={claimReferralFees}
                    disabled={claiming}
                  >
                    {claiming ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#0a0e1a" />
                        <Text style={st.claimBtnText}>{claimStatus}</Text>
                      </View>
                    ) : (
                      <Text style={st.claimBtnText}>Claim & Transfer to Business Wallet</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={st.mutedText}>Tap sync to fetch balances</Text>
            )}
          </View>
        )}
      </View>

      {/* ── Business Bank Account ────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>🏦 Business Account</Text>
          <TouchableOpacity onPress={() => setShowBankModal(true)}>
            <Text style={st.syncBtn}>{data.bankAccount ? '✏️ Edit' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {data.bankAccount ? (
          <TouchableOpacity style={st.card} onPress={() => setShowBankModal(true)} activeOpacity={0.85}>
            <Text style={st.cardLabel}>{data.bankAccount.name}</Text>
            <Text style={st.cardSub}>{data.bankAccount.institution}</Text>
            <Text style={st.bigValue}>${data.bankAccount.balance.toLocaleString()}</Text>
            <Text style={st.lastSync}>Updated: {new Date(data.bankAccount.lastUpdated).toLocaleDateString()}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={st.setupCard} onPress={() => setShowBankModal(true)}>
            <Text style={st.setupEmoji}>🏦</Text>
            <Text style={st.setupText}>Add business bank account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Expenses ─────────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>💸 Expenses</Text>
          <TouchableOpacity onPress={() => setShowExpenseModal(true)}>
            <Text style={st.syncBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {data.expenses.length === 0 ? (
          <TouchableOpacity style={st.setupCard} onPress={() => setShowExpenseModal(true)}>
            <Text style={st.setupEmoji}>📋</Text>
            <Text style={st.setupText}>Track business expenses</Text>
            <Text style={st.setupSub}>Hosting, Apple Developer, domains, APIs, etc.</Text>
          </TouchableOpacity>
        ) : (
          <>
            {data.expenses.map(e => {
              const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
              return (
                <TouchableOpacity key={e.id} style={st.expenseRow} onPress={() => editExpense(e)}>
                  <Text style={st.expenseEmoji}>{cat.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.expenseName}>{e.name}</Text>
                    <Text style={st.expenseMeta}>{cat.label} · {e.frequency}</Text>
                  </View>
                  <Text style={st.expenseAmount}>${e.amount.toFixed(2)}{e.frequency === 'monthly' ? '/mo' : e.frequency === 'annual' ? '/yr' : ''}</Text>
                  <TouchableOpacity onPress={() => deleteExpense(e.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={st.deleteX}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            <View style={st.totalBar}>
              <Text style={st.totalLabel}>Monthly Burn</Text>
              <Text style={st.totalValue}>${monthlyExpenses.toFixed(2)}/mo</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Capital Contributions ─────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>📥 Capital Contributions</Text>
          <TouchableOpacity onPress={() => setShowContribModal(true)}>
            <Text style={st.syncBtn}>+ Record</Text>
          </TouchableOpacity>
        </View>

        {(data.contributions || []).length === 0 ? (
          <View style={st.card}>
            <Text style={st.mutedText}>No contributions recorded</Text>
            <Text style={[st.mutedText, { fontSize: 11, marginTop: 4 }]}>
              Record when you fund {data.businessName || 'your business'} from personal accounts
            </Text>
          </View>
        ) : (
          <>
            {(data.contributions || []).slice(-5).reverse().map(c => (
              <View key={c.id} style={st.expenseRow}>
                <Text style={st.expenseEmoji}>📥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.expenseName}>${c.amount.toLocaleString()}</Text>
                  <Text style={st.expenseMeta}>{new Date(c.date).toLocaleDateString()}{c.notes ? ` · ${c.notes}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteContribution(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={st.deleteX}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={st.totalBar}>
              <Text style={st.totalLabel}>Total Contributed</Text>
              <Text style={st.totalValue}>${totalContributions.toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Distributions ────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>💰 Distributions</Text>
          <TouchableOpacity onPress={() => setShowDistModal(true)}>
            <Text style={st.syncBtn}>+ Record</Text>
          </TouchableOpacity>
        </View>

        {data.distributions.length === 0 ? (
          <View style={st.card}>
            <Text style={st.mutedText}>No distributions recorded yet</Text>
            <Text style={[st.mutedText, { fontSize: 11, marginTop: 4 }]}>
              Record when you transfer money from {data.businessName || 'your business'} to personal accounts
            </Text>
          </View>
        ) : (
          <>
            {data.distributions.slice(-5).reverse().map(d => (
              <View key={d.id} style={st.expenseRow}>
                <Text style={st.expenseEmoji}>💵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.expenseName}>${d.amount.toLocaleString()}</Text>
                  <Text style={st.expenseMeta}>{new Date(d.date).toLocaleDateString()}{d.notes ? ` · ${d.notes}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteDistribution(d.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={st.deleteX}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={st.totalBar}>
              <Text style={st.totalLabel}>Total Distributed</Text>
              <Text style={[st.totalValue, { color: '#4ade80' }]}>${totalDistributions.toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>

      {/* ── P&L Summary ──────────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>📊 P&L Overview</Text>
        <View style={st.plCard}>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Referral Fees (wallet)</Text>
            <Text style={st.plGreen}>${totalRevenue.toFixed(2)}</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Business Account</Text>
            <Text style={st.plGreen}>${bankBal.toLocaleString()}</Text>
          </View>
          <View style={st.plDivider} />
          <View style={st.plRow}>
            <Text style={st.plLabel}>Annual Expenses</Text>
            <Text style={st.plRed}>-${annualExpenses.toFixed(2)}</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Total Distributions</Text>
            <Text style={st.plRed}>-${totalDistributions.toLocaleString()}</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Total Contributions</Text>
            <Text style={st.plGreen}>+${totalContributions.toLocaleString()}</Text>
          </View>
          <View style={st.plDivider} />
          <View style={st.plRow}>
            <Text style={st.plLabelBold}>Business Net Position</Text>
            <Text style={[st.plValueBold, { color: netPosition >= 0 ? '#4ade80' : '#f87171' }]}>
              ${netPosition.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Runway</Text>
            <Text style={st.plValue}>
              {monthlyExpenses > 0 ? `${(netPosition / monthlyExpenses).toFixed(1)} months` : '∞'}
            </Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Personal Asset Value</Text>
            <Text style={st.plValue}>${netPosition > 0 ? netPosition.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</Text>
          </View>
        </View>
      </View>

      {/* ── P&L Snapshots ─────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Monthly Snapshots</Text>
          <TouchableOpacity onPress={takeSnapshot}>
            <Text style={st.syncBtn}>Save This Month</Text>
          </TouchableOpacity>
        </View>

        {(data.plSnapshots || []).length === 0 ? (
          <TouchableOpacity style={st.setupCard} onPress={takeSnapshot}>
            <Text style={st.setupEmoji}>{'📸'}</Text>
            <Text style={st.setupText}>Save your first P&L snapshot</Text>
            <Text style={st.setupSub}>Track how your business financials change month to month</Text>
          </TouchableOpacity>
        ) : (
          <>
            {(data.plSnapshots || []).slice().reverse().slice(0, showSnapshotHistory ? undefined : 3).map((s, i) => {
              const prev = (data.plSnapshots || []).slice().reverse()[i + 1];
              const delta = prev ? s.netPosition - prev.netPosition : 0;
              return (
                <View key={s.id} style={st.snapshotRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.snapshotLabel}>{s.label}</Text>
                    <Text style={st.expenseMeta}>
                      Rev ${s.revenue.toFixed(0)} | Exp ${s.monthlyExpenses.toFixed(0)}/mo | Bank ${s.bankBalance.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[st.snapshotNet, { color: s.netPosition >= 0 ? '#4ade80' : '#f87171' }]}>
                      ${s.netPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    {delta !== 0 && (
                      <Text style={{ fontSize: 11, color: delta > 0 ? '#4ade80' : '#f87171', fontWeight: '600' }}>
                        {delta > 0 ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {(data.plSnapshots || []).length > 3 && (
              <TouchableOpacity onPress={() => setShowSnapshotHistory(!showSnapshotHistory)}>
                <Text style={[st.syncBtn, { textAlign: 'center', marginTop: 8 }]}>
                  {showSnapshotHistory ? 'Show less' : `Show all ${(data.plSnapshots || []).length} snapshots`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ── Break-Even Calculator ──────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Break-Even Calculator</Text>
        <View style={st.plCard}>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Monthly Expenses</Text>
            <Text style={st.plRed}>${monthlyExpenses.toFixed(2)}/mo</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Annual Expenses</Text>
            <Text style={st.plRed}>${annualExpenses.toFixed(2)}/yr</Text>
          </View>
          <View style={st.plDivider} />
          <View style={[st.plRow, { alignItems: 'center' }]}>
            <Text style={st.plLabel}>Revenue per user</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#888', marginRight: 4 }}>$</Text>
              <TextInput
                style={st.breakEvenInput}
                value={revenuePerUser}
                onChangeText={setRevenuePerUser}
                keyboardType="numeric"
                placeholder="4.99"
                placeholderTextColor="#555"
              />
            </View>
          </View>
          <View style={st.plDivider} />
          <View style={st.plRow}>
            <Text style={st.plLabelBold}>Users to cover monthly</Text>
            <Text style={st.plValueBold}>{usersToBreakEvenMonthly.toLocaleString()}</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabelBold}>Users to cover annual</Text>
            <Text style={st.plValueBold}>{usersToBreakEvenAnnual.toLocaleString()}</Text>
          </View>
          {monthlyExpenses > 0 && rpu > 0 && (
            <>
              <View style={st.plDivider} />
              <View style={st.plRow}>
                <Text style={st.plLabel}>10 users/mo = </Text>
                <Text style={st.plGreen}>${(10 * rpu).toFixed(2)}/mo</Text>
              </View>
              <View style={st.plRow}>
                <Text style={st.plLabel}>50 users/mo = </Text>
                <Text style={st.plGreen}>${(50 * rpu).toFixed(2)}/mo</Text>
              </View>
              <View style={st.plRow}>
                <Text style={st.plLabel}>100 users/mo = </Text>
                <Text style={st.plGreen}>${(100 * rpu).toFixed(2)}/mo</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Business Transactions ───────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Transactions</Text>
          <TouchableOpacity onPress={() => setShowImportModal(true)}>
            <Text style={st.syncBtn}>Import CSV</Text>
          </TouchableOpacity>
        </View>

        {(data.transactions || []).length === 0 ? (
          <TouchableOpacity style={st.setupCard} onPress={() => setShowImportModal(true)}>
            <Text style={st.setupEmoji}>{'\uD83D\uDCC4'}</Text>
            <Text style={st.setupText}>Import business transactions</Text>
            <Text style={st.setupSub}>Upload a CSV from your business bank account</Text>
          </TouchableOpacity>
        ) : (
          <>
            {(data.transactions || []).slice(0, 10).map(t => (
              <View key={t.id} style={st.expenseRow}>
                <Text style={st.expenseEmoji}>{t.type === 'income' ? '\u2B06\uFE0F' : '\u2B07\uFE0F'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.expenseName} numberOfLines={1}>{t.description}</Text>
                  <Text style={st.expenseMeta}>{t.date}{t.importedFrom === 'reassigned' ? ' \u00B7 from personal' : ''}</Text>
                </View>
                <Text style={[st.expenseAmount, t.type === 'income' && { color: '#4ade80' }]}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                </Text>
              </View>
            ))}
            {(data.transactions || []).length > 10 && (
              <Text style={[st.mutedText, { textAlign: 'center', marginTop: 8 }]}>
                +{(data.transactions || []).length - 10} more transactions
              </Text>
            )}
            <View style={st.totalBar}>
              <Text style={st.totalLabel}>Total ({(data.transactions || []).length})</Text>
              <View>
                <Text style={[st.totalValue, { color: '#4ade80' }]}>
                  +${(data.transactions || []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
                <Text style={[st.totalValue, { color: '#f87171', fontSize: 12 }]}>
                  -${(data.transactions || []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Reassign Personal Transactions ─────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Personal {'\u2192'} Business</Text>
          <TouchableOpacity onPress={() => setShowReassignModal(true)}>
            <Text style={st.syncBtn}>Find & Move</Text>
          </TouchableOpacity>
        </View>
        <View style={st.card}>
          <Text style={st.descriptionText}>
            If you've been paying business expenses from personal accounts, you can find those transactions by category or keyword and reassign them here. The app will calculate how much you should transfer to your business account.
          </Text>
        </View>
      </View>

      {/* ═══════════════ MODALS ═══════════════ */}
      <SetupModal visible={showSetupModal} onClose={() => setShowSetupModal(false)} data={data} onSave={handleModalSave} />
      <WalletModal visible={showWalletModal} onClose={() => setShowWalletModal(false)} data={data} onSave={handleModalSave} />
      <BankModal visible={showBankModal} onClose={() => setShowBankModal(false)} data={data} onSave={handleModalSave} />
      <ExpenseModal visible={showExpenseModal} onClose={() => { setShowExpenseModal(false); setEditingExpenseId(null); }} data={data} onSave={handleModalSave} editId={editingExpenseId} />
      <DistributionModal visible={showDistModal} onClose={() => setShowDistModal(false)} data={data} onSave={handleModalSave} />
      <ContributionModal visible={showContribModal} onClose={() => setShowContribModal(false)} data={data} onSave={handleModalSave} />
      <InfoModal visible={showInfoModal} onClose={() => setShowInfoModal(false)} data={data} onSave={handleModalSave} />
      <ImportModal visible={showImportModal} onClose={() => setShowImportModal(false)} data={data} onSave={handleModalSave} />
      <ReassignModal visible={showReassignModal} onClose={() => setShowReassignModal(false)} data={data} onSave={handleModalSave} />
      <AIModal visible={showAIModal} onClose={() => setShowAIModal(false)} data={data} aiType={aiType} onGenerate={async () => {}} onExport={exportPDF} />

      <KingMeFooter />
    </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 4 },
  backBtn: { fontSize: 16, color: '#f4c430', fontWeight: '600' },

  bizHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 12, paddingBottom: 4 },
  logoWrap: { },
  logoImg: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: '#2a2f3e' },
  logoPlaceholder: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: '#141825',
    borderWidth: 1, borderColor: '#2a2f3e', borderStyle: 'dashed' as any,
    justifyContent: 'center', alignItems: 'center',
  },

  pageTitle: { fontSize: 24, fontWeight: '800', color: '#f4c430' },
  entityLabel: { fontSize: 12, color: '#666', marginBottom: 8 },

  descriptionBox: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2f3e', borderLeftWidth: 3, borderLeftColor: '#f4c43060',
  },
  descriptionText: { fontSize: 13, color: '#a0a0a0', lineHeight: 20 },
  editHint: { fontSize: 11, color: '#555', marginTop: 6, textAlign: 'right' as const },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d0' },
  syncBtn: { fontSize: 13, color: '#60a5fa', fontWeight: '700' },

  card: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  bigValue: { fontSize: 28, fontWeight: '800', color: '#4ade80', marginTop: 8 },
  walletAddr: { fontSize: 13, color: '#60a5fa', fontFamily: 'Inter_600SemiBold' },
  mutedText: { fontSize: 13, color: '#666' },
  lastSync: { fontSize: 11, color: '#555', marginTop: 8 },

  tokenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tokenPill: { backgroundColor: '#141825', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2f3e' },
  tokenPillText: { fontSize: 12, color: '#e8e0d0', fontWeight: '600' },
  claimBtn: {
    backgroundColor: '#f4c430', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center' as const, marginTop: 12,
  },
  claimBtnText: { color: '#0a0e1a', fontWeight: '700' as const, fontSize: 14 },

  setupCard: {
    backgroundColor: '#141825', borderRadius: 14, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2f3e', borderStyle: 'dashed' as any,
  },
  setupEmoji: { fontSize: 28, marginBottom: 8 },
  setupText: { fontSize: 15, fontWeight: '700', color: '#e8e0d0' },
  setupSub: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  expenseEmoji: { fontSize: 20 },
  expenseName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  expenseMeta: { fontSize: 11, color: '#888', marginTop: 1 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#fbbf24' },
  deleteX: { fontSize: 14, color: '#f87171', fontWeight: '700', paddingLeft: 8 },

  totalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#2a2f3e',
  },
  totalLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#fbbf24' },

  // P&L
  plCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  plLabel: { fontSize: 14, color: '#888' },
  plLabelBold: { fontSize: 14, fontWeight: '800', color: '#e8e0d0' },
  plGreen: { fontSize: 14, fontWeight: '700', color: '#4ade80' },
  plRed: { fontSize: 14, fontWeight: '700', color: '#f87171' },
  plValue: { fontSize: 14, fontWeight: '700', color: '#fbbf24' },
  plValueBold: { fontSize: 16, fontWeight: '800' },
  plDivider: { height: 1, backgroundColor: '#2a2f3e', marginVertical: 4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1f2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#888', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 12, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#141825', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#2a2f3e', marginBottom: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  catPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#141825', borderWidth: 1, borderColor: '#2a2f3e',
  },
  catPillActive: { backgroundColor: '#f4c43020', borderColor: '#f4c430' },
  catPillActive2: { backgroundColor: '#f4c430', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  catPillText: { fontSize: 12, color: '#888', fontWeight: '600' },
  catPillTextActive: { color: '#f4c430' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: '#888', fontWeight: '700' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f4c430', alignItems: 'center' },
  modalSaveText: { fontSize: 15, color: '#0a0e1a', fontWeight: '800' },

  // Business Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#2a2f3e' },
  infoLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#e8e0d0', fontWeight: '700', textAlign: 'right' as const, flex: 1, marginLeft: 12 },

  // AI Tools
  aiToolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  aiToolEmoji: { fontSize: 24 },
  aiToolTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  aiToolDesc: { fontSize: 11, color: '#888', marginTop: 2 },
  aiToolArrow: { fontSize: 16, color: '#555', fontWeight: '700' },
  aiResultBox: {
    backgroundColor: '#141825', borderRadius: 12, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  aiResultText: { fontSize: 13, color: '#d0d0d0', lineHeight: 20 },

  // Snapshots
  snapshotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  snapshotLabel: { fontSize: 14, fontWeight: '700', color: '#e8e0d0' },
  snapshotNet: { fontSize: 15, fontWeight: '800' },

  // Break-even
  breakEvenInput: {
    backgroundColor: '#141825', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    color: '#f4c430', fontSize: 14, fontWeight: '700', width: 60, textAlign: 'right' as const,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
});
