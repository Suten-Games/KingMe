// app/(tabs)/assets.tsx
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { categorizeAssets, calculateTotalValue, calculateTotalIncome } from '../../src/utils/assetCalculations';
import type { Asset, RealEstateAsset, BankAccount } from '../../src/types';
import type { SKRHolding, SKRIncomeSnapshot } from '../../src/services/skr';

import ThesisModal from '../../src/components/ThesisModal';
import PortfolioSummary from '@/components/assets/PortfolioSummary';
import AddAssetButton from '@/components/assets/AddAssetButton';
import AddAssetModal from '@/components/assets/AddAssetModal';
import WalletSyncSection from '@/components/assets/WalletSyncSection';
import SKRCard from '@/components/assets/SKRCard';
import AssetCategoriesList from '@/components/assets/AssetCategoriesList';
import EmptyStateCard from '@/components/EmptyStateCard';
import CryptoOpportunityCard from '@/components/CryptoOpportunityCard';
import AccumulationPlanCard from '@/components/AccumulationPlanCard';
import { loadAllPlans, createPlan, getPlan, type AccumulationPlan } from '@/services/accumulationPlan';
import { CrownIcon } from '@/components/TabIcons';
import { addGoal, loadGoals, makeTokenGoal } from '@/services/goals';

// ── Build SKRCard props from a store asset ─────────────────
function buildSkrFromAsset(asset: Asset): { holding: SKRHolding; income: SKRIncomeSnapshot } | null {
  const meta = asset.metadata as any;
  if (!meta) return null;

  const totalBalance = meta.quantity || meta.balance || 0;
  const apy = (meta.apy || 0) / 100; // SKRCard expects decimal (0.205 not 20.5)
  const totalValue = asset.value;

  return {
    holding: {
      totalBalance,
      stakedBalance: totalBalance, // assume all staked for manual entry
      liquidBalance: 0,
      apy,
      priceUsd: 0
    },
    income: {
      totalValueUsd: totalValue,
      annualYieldUsd: asset.annualIncome,
      monthlyYieldUsd: asset.annualIncome / 12,
      monthlyYieldSkr: 0,
      apyUsed: 0
    },
  };
}

function isSkrAsset(a: Asset): boolean {
  return (a.metadata as any)?.symbol === 'SKR' || a.id === 'skr_staking';
}

// ── Accumulation Plans Section ───────────────────────────────────
function AccumulationPlansSection({ assets }: { assets: Asset[] }) {
  const [plans, setPlans] = useState<AccumulationPlan[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAllPlans().then(all => {
      if (!cancelled) setPlans(Object.values(all).filter(p => p.entries.length > 0));
    });
    return () => { cancelled = true; };
  }, []);

  if (plans.length === 0) return null;

  return (
    <View style={accSt.container}>
      {/* Accordion header — matches AssetCategoriesList row style */}
      <TouchableOpacity
        style={accSt.header}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={accSt.headerLeft}>
          <CrownIcon color="#f4c430" size={18} />
          <Text style={accSt.headerTitle}>Accumulation Plans</Text>
          <View style={accSt.badge}>
            <Text style={accSt.badgeText}>{plans.length}</Text>
          </View>
        </View>
        <Text style={[accSt.chevron, expanded && accSt.chevronOpen]}>▾</Text>
      </TouchableOpacity>

      {/* Collapsible body */}
      {expanded && (
        <View style={accSt.body}>
          {plans.map(plan => {
            const held = assets.find(a =>
              (a.metadata as any)?.mint === plan.mint ||
              (a.metadata as any)?.tokenMint === plan.mint
            );
            const walletHolding = held
              ? ((held.metadata as any)?.quantity ?? (held.metadata as any)?.balance)
              : undefined;

            return (
              <AccumulationPlanCard
                key={plan.mint}
                mint={plan.mint}
                symbol={plan.symbol}
                currentHolding={walletHolding}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const accSt = StyleSheet.create({
  container: {
    marginTop: 16,
    backgroundColor: '#0c1020',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f4c43020',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#f4c430',
    letterSpacing: 0.2,
  },
  badge: {
    backgroundColor: '#f4c43020',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#f4c43030',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#f4c430',
  },
  chevron: {
    fontSize: 16,
    color: '#f4c43080',
    transform: [{ rotate: '-90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '0deg' }],
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f4c43015',
  },
});

export default function AssetsScreen() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const incomeSources = useStore((state) => state.income.sources || []);
  const obligations = useStore((state) => state.obligations);
  const debts = useStore((state) => state.debts);
  const paycheckDeductions = useStore((state) => state.paycheckDeductions || []);
  const addAsset = useStore((state) => state.addAsset);
  const removeAsset = useStore((state) => state.removeAsset);
  const updateAsset = useStore((state) => state.updateAsset);
  const updateBankAccount = useStore((state) => state.updateBankAccount);
  const addThesis = useStore((state) => state.addThesis);
  const investmentTheses = useStore((state) => state.investmentTheses);

  const [showThesisModal, setShowThesisModal] = useState(false);
  const [thesisAsset, setThesisAsset] = useState<Asset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [showBankEditModal, setShowBankEditModal] = useState(false);
  const [bankEditValue, setBankEditValue] = useState('');

  // Target modal state
  const [targetAsset, setTargetAsset] = useState<Asset | null>(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetAvgPrice, setTargetAvgPrice] = useState('');
  const [showTargetModal, setShowTargetModal] = useState(false);

  const syncWalletAssets = useStore((state) => state.syncWalletAssets);
  const isLoadingAssets = useStore((state) => state.isLoadingAssets);
  const lastAssetSync = useStore((state) => state.lastAssetSync);
  const wallets = useStore((state) => state.wallets);

  // ── Auto-sync wallet on mount if stale ───────────────────
  useEffect(() => {
    if (wallets.length > 0 && lastAssetSync) {
      const lastSync = new Date(lastAssetSync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 60000;
      if (diffMinutes > 5) {
        syncWalletAssets(wallets[0]).catch(console.error);
      }
    }
  }, []);

  // ── SKR: detect from store ───────────────────────────────
  const skrAsset = useMemo(() => assets.find(isSkrAsset), [assets]);
  const skrData = useMemo(() => skrAsset ? buildSkrFromAsset(skrAsset) : null, [skrAsset]);

  // ── Categorize: SKR excluded from list (shown as card) ───
  // But totals use ALL assets so SKR still counts in portfolio
  const displayAssets = useMemo(() => assets.filter(a => !isSkrAsset(a)), [assets]);
  const categorized = useMemo(() => categorizeAssets(displayAssets, bankAccounts), [displayAssets, bankAccounts]);

  const allCategorized = useMemo(() => categorizeAssets(assets, bankAccounts), [assets, bankAccounts]);
  const totalValue = useMemo(() => calculateTotalValue(allCategorized), [allCategorized]);
  const totalIncome = useMemo(() => calculateTotalIncome(allCategorized), [allCategorized]);

  // Cash flow data
  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions);

  // ── Thesis prompt helper ─────────────────────────────────
  const promptThesisIfNeeded = (asset: Asset) => {
    const hasLowIncome = asset.annualIncome < (asset.value * 0.02);
    const appreciationTypes = ['crypto', 'defi', 'stocks', 'brokerage', 'real_estate', 'business'];

    if (asset.type === 'real_estate' &&
      (asset.metadata as RealEstateAsset)?.isPrimaryResidence) {
      return;
    }

    if (hasLowIncome && appreciationTypes.includes(asset.type)) {
      Alert.alert(
        'Add Investment Thesis?',
        'This looks like an appreciation play. Document why you\'re buying it and when you\'d sell?',
        [
          { text: 'Skip', style: 'cancel' },
          {
            text: 'Add Thesis',
            onPress: () => {
              setThesisAsset(asset);
              setShowThesisModal(true);
            },
          },
        ]
      );
    }
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleSyncWallet = async () => {
    if (wallets.length === 0) {
      Alert.alert('No Wallet Connected', 'Please connect a Solana wallet in Profile & Settings first.', [{ text: 'OK' }]);
      return;
    }
    try {
      await syncWalletAssets(wallets[0]);
      const syncedCount = assets.filter(a => a.isAutoSynced).length;
      Alert.alert('✅ Sync Complete', `Successfully synced ${syncedCount} assets from your wallet!`, [{ text: 'OK' }]);
    } catch {
      Alert.alert('Sync Failed', 'Could not sync wallet. Please try again later.', [{ text: 'OK' }]);
    }
  };

  const handleAddAsset = (asset: Asset) => {
    addAsset(asset);
    promptThesisIfNeeded(asset);
  };

  const handleUpdateAsset = (assetId: string, updates: Partial<Asset>) => {
    updateAsset(assetId, updates);
  };

  const handleRemoveAsset = (asset: Asset) => {
    removeAsset(asset.id);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setEditingAsset(null);
    setShowAddModal(false);
  };

  // const handleBankAccountPress = (accountId: string) => {
  //   const account = bankAccounts.find(a => a.id === accountId);
  //   if (account) {
  //     setEditingBankAccount(account);
  //     setBankEditValue('');
  //     setShowBankEditModal(true);
  //   }
  // };

    const handleBankAccountPress = (accountId: string) => {
    // Short press → detail screen
    router.push(`/bank/${accountId}`);
  };

  const handleBankAccountLongPress = (accountId: string) => {
    // Long press → quick balance edit
    const account = bankAccounts.find(a => a.id === accountId);
    if (account) {
      setEditingBankAccount(account);
      setBankEditValue('');
      setShowBankEditModal(true);
    }
  };

  const handleUpdateBankBalance = () => {
    if (!editingBankAccount) return;
    const newBalance = parseFloat(bankEditValue.replace(/,/g, '')) || 0;
    updateBankAccount(editingBankAccount.id, { currentBalance: newBalance });
    setEditingBankAccount(null);
    setBankEditValue('');
    setShowBankEditModal(false);
  };

  // ── Set accumulation target from asset card ─────────────────
  const handleSetTarget = async (asset: Asset) => {
    const meta = asset.metadata as any;
    const mint = meta?.tokenMint || meta?.mint || '';
    if (!mint) return;

    // Check if plan already exists
    const existing = await getPlan(mint);
    if (existing) {
      const msg = `${meta?.symbol || asset.name} already has an accumulation plan (${existing.targetAmount.toLocaleString()} target). Open goals page to manage it.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Plan exists', msg);
      return;
    }

    setTargetAsset(asset);
    setTargetAmount('');
    setTargetAvgPrice('');
    setShowTargetModal(true);
  };

  const handleCreateTarget = async () => {
    if (!targetAsset) return;
    const meta = targetAsset.metadata as any;
    const mint = meta?.tokenMint || meta?.mint || '';
    const symbol = meta?.symbol || targetAsset.name;
    const currentBalance = meta?.balance || 0;
    const amount = parseFloat(targetAmount.replace(/,/g, ''));

    if (!amount || amount <= 0) {
      const msg = 'Enter a target amount';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Missing target', msg);
      return;
    }

    // Create accumulation plan
    const avgPrice = parseFloat(targetAvgPrice) || 0;
    const initialEntries = avgPrice > 0 && currentBalance > 0
      ? [{ action: 'buy' as const, date: new Date().toISOString(), tokenAmount: currentBalance, pricePerToken: avgPrice, totalUSD: currentBalance * avgPrice, notes: 'Existing position' }]
      : [];
    await createPlan(mint, symbol, amount, initialEntries);

    // Also create a goal linked to the plan
    const goals = await loadGoals();
    const alreadyHasGoal = goals.some(g => g.mint === mint);
    if (!alreadyHasGoal) {
      await addGoal(makeTokenGoal(mint, symbol, amount, currentBalance));
    }

    setShowTargetModal(false);
    setTargetAsset(null);

    const successMsg = `Created accumulation target: ${amount.toLocaleString()} ${symbol}`;
    Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('Target set! 🎯', successMsg);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>

        {/* Wallet Sync */}
        {wallets.length > 0 && (
          <WalletSyncSection
            onSync={handleSyncWallet}
            isLoading={isLoadingAssets}
            lastSyncTime={lastAssetSync}
          />
        )}

        {/* Portfolio Summary */}
        <PortfolioSummary totalValue={totalValue} totalIncome={totalIncome} />

        {/* Quick links */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4c43010', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f4c43020', gap: 10 }}
          onPress={() => router.push('/watchlist')}
          activeOpacity={0.7}
        >
          <CrownIcon color="#f4c430" size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#f4c430' }}>Coin Watchlist</Text>
            <Text style={{ fontSize: 12, color: '#888' }}>Track coins for good entries</Text>
          </View>
          <Text style={{ fontSize: 16, color: '#f4c43060' }}>→</Text>
        </TouchableOpacity>

        {/* Add Asset Button */}
        <AddAssetButton onPress={() => setShowAddModal(true)} />

        {/* Empty state when no assets at all */}
        {assets.length === 0 && bankAccounts.length === 0 && (
          <EmptyStateCard category="assets" onAction={() => setShowAddModal(true)} />
        )}

        {/* Crypto opportunity — shown when no wallet/crypto */}
        <CryptoOpportunityCard />

        {/* SKR Card — shown if SKR asset exists in store */}
        {skrData && skrAsset && (
          <SKRCard
            holding={skrData.holding}
            income={skrData.income}
            onEdit={() => {
              setEditingAsset(skrAsset);
              setShowAddModal(true);
            }}
          />
        )}

        {/* Asset Categories (SKR filtered out to avoid duplication) */}
        <AssetCategoriesList
          categorized={categorized}
          onAssetPress={(asset) => router.push(`/asset/${asset.id}`)}
          onAssetDelete={handleRemoveAsset}
          onBankAccountPress={handleBankAccountPress}
          onSetTarget={handleSetTarget}
        />

        {/* Accumulation Plans — for held crypto with targets */}
        <AccumulationPlansSection assets={assets} />
      </ScrollView>

      {/* Add / Edit Asset Modal */}
      <AddAssetModal
        visible={showAddModal}
        onClose={handleCloseAddModal}
        onAddAsset={handleAddAsset}
        onUpdateAsset={handleUpdateAsset}
        editingAsset={editingAsset}
      />

      {/* Investment Thesis Modal */}
      {thesisAsset && (
        <ThesisModal
          visible={showThesisModal}
          asset={thesisAsset}
          existingThesis={investmentTheses.find(t => t.assetId === thesisAsset.id)}
          onClose={() => {
            setShowThesisModal(false);
            setThesisAsset(null);
          }}
          onSave={(thesisData) => {
            addThesis(thesisData);
            setShowThesisModal(false);
            setThesisAsset(null);
          }}
        />
      )}

      {/* Edit Bank Account Balance Modal */}
      <Modal
        visible={showBankEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowBankEditModal(false);
          setEditingBankAccount(null);
          setBankEditValue('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Bank Balance</Text>

            {editingBankAccount && (
              <>
                <View style={styles.bankAccountInfo}>
                  <Text style={styles.bankAccountName}>{editingBankAccount.name}</Text>
                  <Text style={styles.bankAccountInstitution}>
                    {editingBankAccount.institution} · {editingBankAccount.type}
                  </Text>
                  <Text style={styles.currentBalanceLabel}>
                    Current: ${(editingBankAccount.currentBalance ?? 0).toLocaleString()}
                  </Text>
                </View>

                <Text style={styles.label}>New Balance</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={(editingBankAccount.currentBalance ?? 0).toString()}
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={bankEditValue}
                    onChangeText={setBankEditValue}
                    autoFocus
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowBankEditModal(false);
                      setEditingBankAccount(null);
                      setBankEditValue('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalAddButton, !bankEditValue && styles.modalAddButtonDisabled]}
                    onPress={handleUpdateBankBalance}
                    disabled={!bankEditValue}
                  >
                    <Text style={styles.modalAddText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══ Set Accumulation Target Modal ═══ */}
      <Modal
        visible={showTargetModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowTargetModal(false); setTargetAsset(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {targetAsset && (() => {
              const meta = targetAsset.metadata as any;
              const symbol = meta?.symbol || targetAsset.name;
              const balance = meta?.balance || 0;
              const pricePerToken = balance > 0 ? targetAsset.value / balance : 0;
              const targetNum = parseFloat(targetAmount.replace(/,/g, '')) || 0;
              const needed = Math.max(0, targetNum - balance);
              const costEstimate = needed * pricePerToken;

              return (
                <>
                  <Text style={styles.modalTitle}>🎯 Set Target</Text>

                  <View style={tm.assetInfo}>
                    <Text style={tm.assetSymbol}>{symbol}</Text>
                    <Text style={tm.assetDetail}>
                      Current: {balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} tokens · ${targetAsset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    {pricePerToken > 0 && (
                      <Text style={tm.assetPrice}>
                        ≈ ${pricePerToken < 1 ? pricePerToken.toFixed(4) : pricePerToken.toFixed(2)}/token
                      </Text>
                    )}
                  </View>

                  <Text style={styles.label}>Target token amount</Text>
                  <TextInput
                    style={tm.input}
                    placeholder="e.g. 1000000"
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    autoFocus
                  />

                  <Text style={styles.label}>Avg buy price (optional)</Text>
                  <Text style={tm.hint}>If you already hold tokens, enter what you paid per token to track cost basis</Text>
                  <TextInput
                    style={tm.input}
                    placeholder={pricePerToken > 0 ? `Current: $${pricePerToken < 1 ? pricePerToken.toFixed(4) : pricePerToken.toFixed(2)}` : '$0.00'}
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    value={targetAvgPrice}
                    onChangeText={setTargetAvgPrice}
                  />

                  {/* Preview */}
                  {targetNum > 0 && (
                    <View style={tm.preview}>
                      <Text style={tm.previewLine}>
                        📦 {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {targetNum.toLocaleString()} {symbol}
                        <Text style={{ color: '#888' }}> ({balance > 0 ? ((balance / targetNum) * 100).toFixed(0) : 0}%)</Text>
                      </Text>
                      {needed > 0 && pricePerToken > 0 && (
                        <Text style={tm.previewLine}>
                          🛒 Need {needed.toLocaleString(undefined, { maximumFractionDigits: 0 })} more ≈ <Text style={{ color: '#f4c430' }}>${costEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text> at current price
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => { setShowTargetModal(false); setTargetAsset(null); }}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalAddButton, { backgroundColor: '#f4c430' }, !targetAmount && styles.modalAddButtonDisabled]}
                      onPress={handleCreateTarget}
                      disabled={!targetAmount}
                    >
                      <Text style={styles.modalAddText}>🎯 Set Target</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18' },
  scrollView: { flex: 1, padding: 20 },

  // Bank edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#080c18', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalTitle: { fontSize: 24, color: '#4ade80', marginBottom: 20, fontFamily: 'Inter_800ExtraBold' },
  label: { fontSize: 15, color: '#ffffff', marginBottom: 8, marginTop: 12, fontFamily: 'Inter_700Bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c1020', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#2a3050' },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 8, fontFamily: 'Inter_700Bold' },
  input: { flex: 1, fontSize: 20, color: '#ffffff', paddingVertical: 16, fontFamily: 'Inter_600SemiBold' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#2a3050', alignItems: 'center' },
  modalCancelText: { color: '#b0b0b8', fontSize: 16, fontFamily: 'Inter_500Medium' },
  modalAddButton: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#4ade80', alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: '#080c18', fontSize: 16, fontFamily: 'Inter_700Bold' },
  bankAccountInfo: { backgroundColor: '#0c1020', borderRadius: 14, padding: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#60a5fa', borderWidth: 1.5, borderColor: '#2a3050' },
  bankAccountName: { fontSize: 18, color: '#fff', marginBottom: 4, fontFamily: 'Inter_700Bold' },
  bankAccountInstitution: { fontSize: 14, color: '#888', marginBottom: 8, fontFamily: 'Inter_400Regular' },
  currentBalanceLabel: { fontSize: 16, color: '#4ade80', fontFamily: 'Inter_600SemiBold' },
});

const tm = StyleSheet.create({
  assetInfo: { backgroundColor: '#0c1020', borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f4c430', borderWidth: 1, borderColor: '#2a3050' },
  assetSymbol: { fontSize: 22, fontWeight: '800', color: '#f4c430', marginBottom: 4 },
  assetDetail: { fontSize: 13, color: '#b0b0b8' },
  assetPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  input: { backgroundColor: '#0c1020', borderRadius: 12, padding: 14, color: '#fff', fontSize: 18, borderWidth: 1, borderColor: '#2a3050', fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 11, color: '#666', marginBottom: 6, marginTop: -2 },
  preview: { backgroundColor: '#f4c43008', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#f4c43015' },
  previewLine: { fontSize: 13, color: '#b0b0b8', lineHeight: 20 },
});
