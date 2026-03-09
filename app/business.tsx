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
import SubpageHeader from '../src/components/SubpageHeader';
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

  // Setup tips (expandable for newbies)
  const [showEINTip, setShowEINTip] = useState(false);
  const [showBankTip, setShowBankTip] = useState(false);

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

  // ── Sync Claimable Referral Fees (via Jupiter preview) ────
  const syncReferralWallet = async () => {
    if (!connected || !publicKey) {
      Alert.alert('Connect Wallet', 'Connect your personal wallet first — it must be the one registered as the Jupiter referral partner.');
      return;
    }
    setSyncing(true);
    try {
      const KINGME_API = 'https://kingme-api.vercel.app';
      const API_KEY = process.env.EXPO_PUBLIC_KINGME_API_KEY || '';
      const partnerKey = publicKey.toBase58();

      const res = await fetch(`${KINGME_API}/api/referral/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ userPublicKey: partnerKey, action: 'preview' }),
      });
      const preview = await res.json();
      if (preview.error) throw new Error(preview.error);

      const claims = preview.claims || [];
      let solAmount = 0;
      let usdcAmount = 0;
      const otherTokens: { symbol: string; amount: number; valueUSD: number }[] = [];

      for (const c of claims) {
        if (c.symbol === 'SOL') { solAmount = c.uiAmount; }
        else if (c.symbol === 'USDC') { usdcAmount = c.uiAmount; }
        else { otherTokens.push({ symbol: c.symbol, amount: c.uiAmount, valueUSD: c.valueUSD }); }
      }

      await save({
        ...data,
        referralBalance: {
          sol: solAmount, usdc: usdcAmount, other: otherTokens,
          totalUSD: preview.totalValueUSD || 0,
          lastFetched: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      logError('Referral sync error:', err);
      Alert.alert('Sync Failed', err.message || 'Could not fetch claimable referral fees.');
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

    const KINGME_API = 'https://kingme-api.vercel.app';
    const API_KEY = process.env.EXPO_PUBLIC_KINGME_API_KEY || '';
    const APP_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
    const partnerKey = publicKey.toBase58();
    const businessWallet = data.referralWallet;
    const apiHeaders = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY };

    setClaiming(true);
    setClaimStatus('Checking claimable fees...');

    try {
      // 1. Preview — see what's claimable
      const previewRes = await fetch(`${KINGME_API}/api/referral/claim`, {
        method: 'POST',
        headers: apiHeaders,
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
      const buildRes = await fetch(`${KINGME_API}/api/referral/claim`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          userPublicKey: partnerKey,
          businessWallet,
          action: 'claim',
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.error) throw new Error(buildData.error);

      const { claimTransactions, transferTransactions, claims } = buildData;
      const rpcProxy = `${APP_BASE}/api/rpc/send`;

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

  // Income from imported transactions (CSV bank imports, referral claims, add-on revenue)
  // Excludes capital contributions which have their own section
  const contributionIds = new Set((data.contributions || []).map(c => c.id));
  const incomeTransactions = (data.transactions || []).filter(t =>
    t.type === 'income' && !contributionIds.has(t.id)
  );
  const totalTransactionIncome = incomeTransactions.reduce((s, t) => s + t.amount, 0);

  const claimableReferralFees = data.referralBalance?.totalUSD || 0;
  const bankBal = data.bankAccount?.balance || 0;
  const totalDistributions = data.distributions.reduce((s, d) => s + d.amount, 0);
  const totalContributions = (data.contributions || []).reduce((s, c) => s + c.amount, 0);
  const totalRevenue = totalTransactionIncome;
  const netPosition = bankBal + claimableReferralFees;

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      <SubpageHeader />

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
            <TouchableOpacity onPress={() => { setShowSetupModal(true); }}>
              <Text style={st.pageTitle}>{data.businessName || 'My Business'}</Text>
            </TouchableOpacity>
            <Text style={st.entityLabel}>{ENTITY_LABELS[data.entityType]}</Text>
          </View>
        </View>

        {data.businessDescription ? (
          <TouchableOpacity style={st.descriptionBox} activeOpacity={0.7}
            onPress={() => { setShowSetupModal(true); }}>
            <Text style={st.descriptionText}>{data.businessDescription}</Text>
            <Text style={st.editHint}>Tap to edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={st.descriptionBox} activeOpacity={0.7}
            onPress={() => { setShowSetupModal(true); }}>
            <Text style={[st.descriptionText, { fontStyle: 'italic' }]}>No description yet. Tap to add one.</Text>
          </TouchableOpacity>
        )}

      {/* ── Setup Checklist (shown when business is mostly empty) ── */}
      {(!data.businessName || !data.info?.ein || !data.bankAccount || (data.transactions || []).length === 0) && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Getting Started</Text>
          <View style={st.card}>
            <Text style={[st.guideText, { marginBottom: 12 }]}>
              Set up your business dashboard step by step. Complete these to unlock your full P&L tracking.
            </Text>
            <TouchableOpacity style={st.checklistItem} onPress={() => setShowSetupModal(true)}>
              <Text style={st.checklistIcon}>{data.businessName ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.checklistLabel}>Name your business</Text>
                <Text style={st.checklistSub}>Set your business name, entity type, and description</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.checklistItem} onPress={() => setShowInfoModal(true)}>
              <Text style={st.checklistIcon}>{data.info?.ein ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.checklistLabel}>Add business details</Text>
                <Text style={st.checklistSub}>EIN, state of formation, registered agent</Text>
                {!data.info?.ein && (
                  <TouchableOpacity onPress={() => setShowEINTip(!showEINTip)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={st.tipToggle}>{showEINTip ? 'Hide tips' : "Don't have an EIN yet?"}</Text>
                  </TouchableOpacity>
                )}
                {showEINTip && (
                  <View style={st.tipBox}>
                    <Text style={st.tipText}>An EIN (Employer Identification Number) is like a social security number for your business. You need one to open a business bank account and file taxes.</Text>
                    <Text style={st.tipStep}>1. Go to irs.gov/ein and click "Apply Online Now"</Text>
                    <Text style={st.tipStep}>2. Select your entity type (LLC, sole prop, etc.)</Text>
                    <Text style={st.tipStep}>3. Answer a few questions about your business</Text>
                    <Text style={st.tipStep}>4. You'll get your EIN immediately at the end — save the confirmation letter</Text>
                    <Text style={st.tipNote}>It's free and takes about 5 minutes. You'll need to have already formed your business entity with your state (usually through the Secretary of State website, $50-$200 depending on state).</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.checklistItem} onPress={() => setShowBankModal(true)}>
              <Text style={st.checklistIcon}>{data.bankAccount ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.checklistLabel}>Connect business bank account</Text>
                <Text style={st.checklistSub}>Add your business checking or savings account</Text>
                {!data.bankAccount && (
                  <TouchableOpacity onPress={() => setShowBankTip(!showBankTip)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={st.tipToggle}>{showBankTip ? 'Hide tips' : "Need to open one?"}</Text>
                  </TouchableOpacity>
                )}
                {showBankTip && (
                  <View style={st.tipBox}>
                    <Text style={st.tipText}>A dedicated business bank account keeps your personal and business finances separate — which is important for taxes, liability protection, and clean bookkeeping.</Text>
                    <Text style={st.tipStep}>1. Get your EIN first (see above)</Text>
                    <Text style={st.tipStep}>2. Gather your formation documents (Articles of Organization, Operating Agreement)</Text>
                    <Text style={st.tipStep}>3. Apply online or in-person at a bank — Mercury, Relay, and Bluevine are popular for small businesses with no monthly fees</Text>
                    <Text style={st.tipStep}>4. Most banks will ask for your EIN, formation docs, and a government ID</Text>
                    <Text style={st.tipNote}>Once open, all business income and expenses should go through this account. Export CSV statements periodically and import them here to track everything.</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.checklistItem} onPress={() => setShowImportModal(true)}>
              <Text style={st.checklistIcon}>{(data.transactions || []).length > 0 ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.checklistLabel}>Import transactions</Text>
                <Text style={st.checklistSub}>Upload a CSV from your business bank to track income and expenses</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.checklistItem} onPress={() => setShowExpenseModal(true)}>
              <Text style={st.checklistIcon}>{data.expenses.length > 0 ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.checklistLabel}>Add recurring expenses</Text>
                <Text style={st.checklistSub}>Hosting, tools, domains, subscriptions</Text>
              </View>
            </TouchableOpacity>
            {!data.swapReferralsEnabled && !data.referralWallet && (
              <TouchableOpacity style={st.checklistItem} onPress={() => save({ ...data, swapReferralsEnabled: true })}>
                <Text style={st.checklistIcon}>{'⬜'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.checklistLabel}>Enable swap referral fees</Text>
                  <Text style={st.checklistSub}>Earn on every token swap through Jupiter (optional)</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Business Info ─────────────────────────────────────── */}
      <View style={st.section}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Business Info</Text>
          <TouchableOpacity onPress={() => { setShowInfoModal(true); }}>
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
          <TouchableOpacity style={st.setupCard} onPress={() => { setShowInfoModal(true); }}>
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

      {/* ── Swap Referral Fees (only if enabled or wallet already set) ── */}
      {(data.swapReferralsEnabled || data.referralWallet) ? (
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Swap Referral Fees</Text>
            {data.referralWallet && (
              <TouchableOpacity onPress={syncReferralWallet} disabled={syncing}>
                {syncing ? <ActivityIndicator size="small" color="#f4c430" /> : <Text style={st.syncBtn}>Sync</Text>}
              </TouchableOpacity>
            )}
          </View>

          {!data.referralWallet ? (
            <View style={st.card}>
              <Text style={st.guideTitle}>Setup Guide</Text>
              <Text style={st.guideText}>
                Earn a fee on every token swap that happens through your app. Here's how to set it up:
              </Text>
              <View style={st.guideSteps}>
                <Text style={st.guideStep}>1. Go to referral.jup.ag and create a referral account using your personal Solana wallet</Text>
                <Text style={st.guideStep}>2. Add token accounts for each token you want to collect fees on (SOL, USDC, JUP, etc.)</Text>
                <Text style={st.guideStep}>3. Set your referral account public key in your app's server environment as JUPITER_REFERRAL_ACCOUNT</Text>
                <Text style={st.guideStep}>4. Enter your business wallet address below — claimed fees will be transferred here</Text>
              </View>
              <TouchableOpacity style={st.claimBtn} onPress={() => setShowWalletModal(true)}>
                <Text style={st.claimBtnText}>Set Business Wallet Address</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginTop: 12, alignItems: 'center' }}
                onPress={() => save({ ...data, swapReferralsEnabled: false })}
              >
                <Text style={st.mutedText}>Remove this section</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={st.card}>
              <Text style={st.cardLabel}>Business Wallet</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(true)}>
                <Text style={st.walletAddr}>{data.referralWallet.slice(0, 6)}...{data.referralWallet.slice(-6)}</Text>
              </TouchableOpacity>
              {data.referralBalance ? (
                <>
                  <Text style={[st.cardLabel, { marginTop: 12 }]}>Claimable Referral Fees</Text>
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
                <Text style={st.mutedText}>Tap sync to check claimable fees</Text>
              )}
            </View>
          )}
        </View>
      ) : null}

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

      {/* ── Income ──────────────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>📈 Income</Text>
        {incomeTransactions.length === 0 ? (
          <View style={st.card}>
            <Text style={st.mutedText}>No income recorded yet. Import bank CSV transactions, claim referral fees, or receive paid add-on purchases to see income here.</Text>
          </View>
        ) : (
          <View style={st.card}>
            <Text style={st.bigValue}>${totalTransactionIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
            {(() => {
              const referralIncome = incomeTransactions.filter(t => t.description?.includes('referral claim'));
              const addOnIncome = incomeTransactions.filter(t => t.category === 'income_other' && t.description?.includes('add-on'));
              const otherIncome = incomeTransactions.filter(t =>
                !t.description?.includes('referral claim') &&
                !(t.category === 'income_other' && t.description?.includes('add-on'))
              );
              return (
                <>
                  {referralIncome.length > 0 && (
                    <View style={st.plRow}>
                      <Text style={st.plLabel}>Swap Referral Fees ({referralIncome.length})</Text>
                      <Text style={st.plGreen}>${referralIncome.reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                    </View>
                  )}
                  {addOnIncome.length > 0 && (
                    <View style={st.plRow}>
                      <Text style={st.plLabel}>Paid Add-Ons ({addOnIncome.length})</Text>
                      <Text style={st.plGreen}>${addOnIncome.reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                    </View>
                  )}
                  {otherIncome.length > 0 && (
                    <View style={st.plRow}>
                      <Text style={st.plLabel}>Other Income ({otherIncome.length})</Text>
                      <Text style={st.plGreen}>${otherIncome.reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                    </View>
                  )}
                </>
              );
            })()}
            <Text style={[st.lastSync, { marginTop: 8 }]}>{incomeTransactions.length} transaction{incomeTransactions.length !== 1 ? 's' : ''}</Text>
          </View>
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
                <TouchableOpacity key={e.id} style={st.expenseRow} onPress={() => { setEditingExpenseId(e.id); setShowExpenseModal(true); }}>
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
            <Text style={st.plLabel}>Total Income</Text>
            <Text style={st.plGreen}>${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={st.plRow}>
            <Text style={st.plLabel}>Business Account Balance</Text>
            <Text style={st.plGreen}>${bankBal.toLocaleString()}</Text>
          </View>
          {claimableReferralFees > 0.01 && (
            <View style={st.plRow}>
              <Text style={st.plLabel}>Unclaimed Referral Fees</Text>
              <Text style={st.plGreen}>${claimableReferralFees.toFixed(2)}</Text>
            </View>
          )}
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

      {/* ── Add Revenue Streams (show when swap referrals not enabled) ── */}
      {!data.swapReferralsEnabled && !data.referralWallet && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Add Revenue Streams</Text>
          <TouchableOpacity
            style={st.revenueStreamCard}
            onPress={() => save({ ...data, swapReferralsEnabled: true })}
          >
            <Text style={st.revenueStreamEmoji}>{'⚡'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.revenueStreamTitle}>Crypto Swap Referral Fees</Text>
              <Text style={st.revenueStreamDesc}>
                If your app or platform lets users swap tokens through Jupiter, you can earn a referral fee on every trade. Fees accumulate on-chain and you claim them directly to your business wallet.
              </Text>
            </View>
            <Text style={st.aiToolArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      )}

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
  guideTitle: { fontSize: 16, fontWeight: '700' as const, color: '#fff', marginBottom: 8 },
  guideText: { fontSize: 13, color: '#a0a0a0', lineHeight: 20, marginBottom: 12 },
  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1f30' },
  checklistIcon: { fontSize: 18, marginTop: 1 },
  checklistLabel: { fontSize: 14, fontWeight: '600' as const, color: '#e8e0d0' },
  checklistSub: { fontSize: 12, color: '#666', marginTop: 2 },
  tipToggle: { fontSize: 12, color: '#f4c430', marginTop: 6 },
  tipBox: { backgroundColor: '#141825', borderRadius: 8, padding: 12, marginTop: 8, borderLeftWidth: 2, borderLeftColor: '#f4c43060' },
  tipText: { fontSize: 12, color: '#a0a0a0', lineHeight: 18, marginBottom: 8 },
  tipStep: { fontSize: 12, color: '#c0b890', lineHeight: 20, paddingLeft: 4 },
  tipNote: { fontSize: 11, color: '#777', lineHeight: 16, marginTop: 8, fontStyle: 'italic' as any },
  guideSteps: { marginBottom: 16 },
  guideStep: { fontSize: 13, color: '#c0b8a8', lineHeight: 22, marginBottom: 6, paddingLeft: 4 },
  revenueStreamCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: '#141825', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2a2f3e',
  },
  revenueStreamEmoji: { fontSize: 28, marginRight: 12 },
  revenueStreamTitle: { fontSize: 15, fontWeight: '700' as const, color: '#fff', marginBottom: 4 },
  revenueStreamDesc: { fontSize: 12, color: '#888', lineHeight: 18 },

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
