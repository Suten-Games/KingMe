// app/(tabs)/assets.tsx
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert
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
    },
    income: {
      totalValueUsd: totalValue,
      annualYieldUsd: asset.annualIncome,
      monthlyYieldUsd: asset.annualIncome / 12,
    },
  };
}

function isSkrAsset(a: Asset): boolean {
  return (a.metadata as any)?.symbol === 'SKR' || a.id === 'skr_staking';
}

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

  const handleBankAccountPress = (accountId: string) => {
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

        {/* Add Asset Button */}
        <AddAssetButton onPress={() => setShowAddModal(true)} />

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
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scrollView: { flex: 1, padding: 20 },

  // Bank edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#4ade80', marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, marginTop: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: '#2a2f3e' },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 8 },
  input: { flex: 1, fontSize: 20, color: '#ffffff', paddingVertical: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { color: '#a0a0a0', fontSize: 16 },
  modalAddButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
  bankAccountInfo: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#60a5fa' },
  bankAccountName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  bankAccountInstitution: { fontSize: 14, color: '#666', marginBottom: 8 },
  currentBalanceLabel: { fontSize: 16, color: '#4ade80', fontWeight: '600' },
});
