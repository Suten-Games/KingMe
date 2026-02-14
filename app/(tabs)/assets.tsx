// app/(tabs)/assets.tsx - CORRECTED VERSION
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../src/store/useStore';
import { useRetirementCalculations } from '@/hooks/useRetirementCalculations';
import { useAssetFormState } from '@/hooks/useAssetFormState';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import { categorizeAssets, calculateTotalValue, calculateTotalIncome  } from '../../src/utils/assetCalculations';
import type { Asset, RealEstateAsset, RetirementAsset, BankAccount, StockAsset } from '../../src/types';
import type { SKRHolding, SKRIncomeSnapshot } from '../../src/services/skr';

import ThesisModal from '../../src/components/ThesisModal';
import PortfolioSummary from '@/components/assets/PortfolioSummary';
import AddAssetButton from '@/components/assets/AddAssetButton';
import WalletSyncSection from '@/components/assets/WalletSyncSection';
import SKRCard from '@/components/assets/SKRCard';
import AssetCategoriesList from '@/components/assets/AssetCategoriesList';
import { getAssetTypeLabel, getFrequencyLabel } from '@/utils/assetTypeHelpers';
import StockVestingFields from '@/components/assets/StockVestingFields';

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

  const syncWalletAssets = useStore((state) => state.syncWalletAssets);
  const isLoadingAssets = useStore((state) => state.isLoadingAssets);
  const lastAssetSync = useStore((state) => state.lastAssetSync);

  // ── SKR auto-detected holding ───────────────────────────────────────────
  const wallets = useStore((state) => state.wallets);
  const [skrHolding, setSkrHolding] = useState<SKRHolding | null>(null);
  const [skrIncome, setSKRIncome] = useState<SKRIncomeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let holding: SKRHolding | null = null;
      if (wallets.length > 0) {
        for (const addr of wallets) {
          holding = await fetchSKRHolding(addr);
          if (holding) break;
        }
      }
      if (!cancelled) {
        setSkrHolding(holding);
        setSKRIncome(holding ? calcSKRIncome(holding) : null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [wallets]);

  useEffect(() => {
    // Auto-sync if last sync was >5 mins ago
    if (wallets.length > 0 && lastAssetSync) {
      const lastSync = new Date(lastAssetSync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 60000;
      
      if (diffMinutes > 5) {
        syncWalletAssets(wallets[0]).catch(console.error);
      }
    }
  }, []); // Run once on mount

  const formState = useAssetFormState();
  const {
    name, setName,
    type, setType,
    value, setValue,
    apy, setApy,
    quantity, setQuantity,
    hasUnvestedShares, setHasUnvestedShares,
    vestedShares, setVestedShares,
    unvestedShares, setUnvestedShares,
    sharesPerVest, setSharesPerVest,
    vestingFrequency, setVestingFrequency,
    nextVestDate, setNextVestDate,
    isPrimaryResidence, setIsPrimaryResidence,
    retAccountType, setRetAccountType,
    retInstitution, setRetInstitution,
    retBalance, setRetBalance,
    retContribution, setRetContribution,
    retFrequency, setRetFrequency,
    retMatchPercent, setRetMatchPercent,
    resetForm,
  } = formState;

  
  // Cash flow data
  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions);

  // Categorize assets
  const categorized = useMemo(() => categorizeAssets(assets, bankAccounts), [assets, bankAccounts]);
  const totalValue = useMemo(() => calculateTotalValue(categorized), [categorized]);
  const totalIncome = useMemo(() => calculateTotalIncome(categorized), [categorized]);

  const retirementCalcs = useRetirementCalculations(
    retContribution,
    retFrequency,
    retMatchPercent,
    incomeSources
  );

  const handleResetForm = () => {
    formState.resetForm();
    setEditingAsset(null);
    setShowAddModal(false);
  };

  const handleSyncWallet = async () => {
    if (wallets.length === 0) {
      Alert.alert(
        'No Wallet Connected',
        'Please connect a Solana wallet in Profile & Settings first.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await syncWalletAssets(wallets[0]);
      
      const syncedCount = assets.filter(a => a.isAutoSynced).length;
      Alert.alert(
        '✅ Sync Complete',
        `Successfully synced ${syncedCount} assets from your wallet!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Sync Failed',
        'Could not sync wallet. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleAddAsset = () => {
    
    // ── Retirement path ──────────────────────────────────────────────────
    if (type === 'retirement') {
      if (!retInstitution || !retBalance) return;

      const { matchPercent: matchPct, employerMatchDollars } = retirementCalcs;
      
      const newAsset: Asset = {
        id: 'ret_' + Date.now().toString(),
        type: 'retirement',
        name: `${retAccountType === '401k' ? '401(k)' : retAccountType === 'roth_401k' ? 'Roth 401(k)' : retAccountType === 'ira' ? 'IRA' : 'Roth IRA'} — ${retInstitution}`,
        value: parseFloat(retBalance),
        annualIncome: 0,
        metadata: {
          type: 'retirement',
          accountType: retAccountType,
          institution: retInstitution,
          contributionAmount: parseFloat(retContribution) || 0,
          contributionFrequency: retFrequency,
          employerMatchPercent: matchPct || undefined,
          employerMatchDollars: employerMatchDollars || undefined,
        },
      };

      addAsset(newAsset);
      handleResetForm()
      const isAppreciationAsset = (asset: Asset) => {
        // Low or no income - bought for price appreciation
        const hasLowIncome = asset.annualIncome < (asset.value * 0.02); // Less than 2% yield
        
        // Asset types that are typically appreciation plays
        const appreciationTypes = ['crypto', 'stocks', 'brokerage', 'real_estate', 'business'];

        if (asset.type === 'real_estate' &&
          (asset.metadata as RealEstateAsset)?.isPrimaryResidence) {
          return false;
        }
        
        return hasLowIncome && appreciationTypes.includes(asset.type);
      };

      const showThesisPrompt = isAppreciationAsset(asset);

      if (showThesisPrompt) {
        Alert.alert(
          'Add Investment Thesis?',
          'This looks like an appreciation play. Document why you\'re buying it and when you\'d sell?',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Add Thesis',
              onPress: () => {
                setShowThesisModal(true);
                setThesisAsset(asset);
              }
            },
          ]
        );
      }
      return;
    }

    // ── Generic asset path ────────────────────────────────────────────────
    if (!name || !value) return;

    const assetValue = parseFloat(value);
    const assetApy = parseFloat(apy) || 0;
    const calculatedIncome = assetValue * (assetApy / 100);
    const assetQuantity = type === 'stocks' ? parseFloat(quantity) || 0 : undefined;

    if (type === 'real_estate') {
      const newAsset: Asset = {
        id: Date.now().toString(),
        name,
        type: 'real_estate',
        value: assetValue,
        annualIncome: calculatedIncome,
        metadata: {
          type: 'real_estate',
          apy: assetApy,
          isPrimaryResidence: isPrimaryResidence, // ← ADD THIS
        },
      };
      
      addAsset(newAsset);
      handleResetForm()
      
      // ── Thesis prompt (updated to skip primary residence) ───
      const isAppreciationAsset = (asset: Asset) => {
        const hasLowIncome = asset.annualIncome < (asset.value * 0.02);
        const appreciationTypes = ['crypto', 'stocks', 'brokerage', 'real_estate', 'business'];
        
        // Skip primary residence!
        if (asset.type === 'real_estate' && (asset.metadata as RealEstateAsset)?.isPrimaryResidence) {
          return false;
        }
        
        return hasLowIncome && appreciationTypes.includes(asset.type);
      };
      
      return;
    }

    let metadata: any = {
      type: type === 'stocks' ? 'stocks' : 'other',
      description: name,
      apy: assetApy,
      quantity: assetQuantity,
    };

    // Add stock-specific vesting data
    if (type === 'stocks' && assetQuantity) {
      metadata.shares = assetQuantity;
      
      if (hasUnvestedShares) {
        const vested = parseFloat(vestedShares) || 0;
        const unvested = parseFloat(unvestedShares) || 0;
        const perVest = parseFloat(sharesPerVest) || 0;
        
        metadata.vestedShares = vested;
        metadata.unvestedShares = unvested;
        
        if (perVest > 0) {
          metadata.vestingSchedule = {
            sharesPerVest: perVest,
            frequency: vestingFrequency,
            nextVestDate: nextVestDate || undefined,
          };
        }
      }
    }

    const newAsset: Asset = {
      id: Date.now().toString(),
      name,
      type,
      value: assetValue,
      annualIncome: calculatedIncome,
      metadata,
    };

    addAsset(newAsset);
    handleResetForm()
  };

  const handleRemoveAsset = (asset: Asset) => {
    removeAsset(asset.id);
  };

  const handleBankAccountPress = (accountId: string) => {
    const account = bankAccounts.find(a => a.id === accountId);
    if (account) {
      setEditingBankAccount(account);
      setShowBankEditModal(true);
    }
  };

  const handleUpdateBankBalance = () => {
    if (!editingBankAccount) return;
    
    const newBalance = parseFloat(value.replace(/,/g, '')) || 0;
    updateBankAccount(editingBankAccount.id, { currentBalance: newBalance });
    
    setEditingBankAccount(null);
    setValue('');
    setShowBankEditModal(false);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);

    if (asset.type === 'real_estate') {
      const metadata = asset.metadata as RealEstateAsset;
      setType('real_estate');
      setName(asset.name);
      setValue(asset.value.toString());
      setApy(asset.metadata?.apy?.toString() || '');
      setIsPrimaryResidence(metadata?.isPrimaryResidence || false);
    } else if (asset.type === 'retirement' && asset.metadata?.type === 'retirement') {
      setType('retirement');
      setRetAccountType(asset.metadata?.accountType);
      setRetInstitution(asset.metadata?.institution || '');
      setRetBalance(asset.value.toString());
      setRetContribution(asset.metadata?.contributionAmount?.toString() || '0');
      setRetFrequency(asset.metadata?.contributionFrequency || 'biweekly');
      setRetMatchPercent(asset.metadata?.employerMatchPercent?.toString() || '0');
    } else {
      // Generic asset (crypto, stocks, etc.)
      setType(asset.type);
      setName(asset.name);
      setValue(asset.value.toString());
      setApy(asset.metadata?.apy?.toString() || '');
      setQuantity(asset.metadata?.quantity?.toString() || '');
      
      // Load vesting data for stocks
      if (asset.type === 'stocks' && asset.metadata?.type === 'stocks') {
        const stockMeta = asset.metadata;
        const hasVesting = !!stockMeta.vestedShares || !!stockMeta.unvestedShares;
        
        setHasUnvestedShares(hasVesting);
        setVestedShares(stockMeta.vestedShares?.toString() || '');
        setUnvestedShares(stockMeta.unvestedShares?.toString() || '');
        
        if (stockMeta.vestingSchedule) {
          setSharesPerVest(stockMeta.vestingSchedule.sharesPerVest?.toString() || '');
          setVestingFrequency(stockMeta.vestingSchedule.frequency || 'yearly');
          setNextVestDate(stockMeta.vestingSchedule.nextVestDate || '');
        }
      }
    }
    
    setShowAddModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingAsset) return;

    let updatedAsset: Partial<Asset> = {};

    if (type === 'retirement') {
      if (!retInstitution || !retBalance) return;
      
      const balance = parseFloat(retBalance.replace(/,/g, '')) || 0;
      const contribution = parseFloat(retContribution.replace(/,/g, '')) || 0;
      const matchPercent = parseFloat(retMatchPercent.replace(/,/g, '')) || 0;
      const employerMatchDollars = retirementCalcs.employerMatchDollars;

      updatedAsset = {
        value: balance,
        metadata: {
          ...editingAsset.metadata,
          type: 'retirement' as const,
          accountType: retAccountType,
          institution: retInstitution,
          contributionAmount: contribution,
          contributionFrequency: retFrequency,
          employerMatchPercent: matchPercent,
          employerMatchDollars,
        },
      };
    } else {
      if (!name || !value) return;
  
      const assetValue = parseFloat(value.replace(/,/g, '')) || 0;
      const assetApy = parseFloat(apy) || 0;
      const income = assetValue * (assetApy / 100);
      const assetQuantity = type === 'stocks' ? parseFloat(quantity) || 0 : undefined;

      let metadata: any = {
        ...editingAsset.metadata,
        apy: assetApy,
        quantity: assetQuantity,
      };

      // Add isPrimaryResidence for real estate
      if (type === 'real_estate') {
        metadata = {
          ...metadata,
          type: 'real_estate',
          isPrimaryResidence: isPrimaryResidence,
        } as RealEstateAsset;
      }

      // Add vesting data for stocks
      if (type === 'stocks' && assetQuantity) {
        metadata.shares = assetQuantity;
        
        if (hasUnvestedShares) {
          const vested = parseFloat(vestedShares) || 0;
          const unvested = parseFloat(unvestedShares) || 0;
          const perVest = parseFloat(sharesPerVest) || 0;
          
          metadata.vestedShares = vested;
          metadata.unvestedShares = unvested;
          
          if (perVest > 0) {
            metadata.vestingSchedule = {
              sharesPerVest: perVest,
              frequency: vestingFrequency,
              nextVestDate: nextVestDate || undefined,
            };
          }
        } else {
          // Clear vesting data if toggle is off
          delete metadata.vestedShares;
          delete metadata.unvestedShares;
          delete metadata.vestingSchedule;
        }
      }

      updatedAsset = {
        name,
        value: assetValue,
        annualIncome: income,
        metadata: metadata,
      };
    }

    updateAsset(editingAsset.id, updatedAsset);
    handleResetForm();
    };

  
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>

          {/* Wallet Sync Button */}
          {wallets.length > 0 && (
            <WalletSyncSection
              onSync={handleSyncWallet}
              isLoading={isLoadingAssets}
              lastSyncTime={lastAssetSync}
            />
          )}

          {/* ── Cash Flow Summary ── */}
          {/* <CashFlowSummary cashFlow={cashFlow} /> */}

          {/* ── Portfolio Summary ── */}
          <PortfolioSummary
            totalValue={totalValue}
            totalIncome={totalIncome}
          />

          {/* Add Asset Button */}
          <AddAssetButton onPress={() => setShowAddModal(true)} />

          {/* ── SKR Auto-Detected Card ── */}
          {skrHolding && skrIncome && (
            <SKRCard holding={skrHolding} income={skrIncome} />
          )}

          {/* ── Asset Categories ── */}
          <AssetCategoriesList
            categorized={categorized}
            onAssetPress={(asset) => router.push(`/asset/${asset.id}`)}
            onAssetDelete={handleRemoveAsset}
            onBankAccountPress={handleBankAccountPress}
          />

        </ScrollView>

        {/* ── Add Asset Modal ── */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={handleResetForm}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView>
                <Text style={styles.modalTitle}>
                  {editingAsset
                    ? (type === 'retirement' ? 'Edit Retirement Account' : 'Edit Asset')
                    : (type === 'retirement' ? 'Add Retirement Account' : 'Add Asset')
                  }
                </Text>

                {/* Type picker */}
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeButtons}>
                  {(['crypto', 'stocks', 'real_estate', 'business', 'retirement', 'other'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeButton, type === t && styles.typeButtonActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
                        {getAssetTypeLabel(t)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {type === 'retirement' ? (
                  <>
                    <Text style={styles.label}>Account Type</Text>
                    <View style={styles.typeButtons}>
                      {(['401k', 'roth_401k', 'ira', 'roth_ira'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeButton, retAccountType === t && styles.typeButtonActive]}
                          onPress={() => setRetAccountType(t)}
                        >
                          <Text style={[styles.typeButtonText, retAccountType === t && styles.typeButtonTextActive]}>
                            {t === '401k' ? '401(k)' : t === 'roth_401k' ? 'Roth 401(k)' : t === 'ira' ? 'IRA' : 'Roth IRA'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Institution</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., Fidelity, Vanguard, Schwab"
                      placeholderTextColor="#666"
                      value={retInstitution}
                      onChangeText={setRetInstitution}
                    />

                    <Text style={styles.label}>Current Balance</Text>
                    <View style={styles.inputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={retBalance}
                        onChangeText={setRetBalance}
                      />
                    </View>

                    <Text style={styles.label}>Contribution Per Pay Period</Text>
                    <Text style={styles.helperText}>How much you put in each time you're paid.</Text>
                    <View style={styles.inputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={retContribution}
                        onChangeText={setRetContribution}
                      />
                    </View>

                    <Text style={styles.label}>Pay Frequency</Text>
                    <View style={styles.typeButtons}>
                      {(['weekly', 'biweekly', 'twice_monthly', 'monthly'] as const).map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={[styles.typeButton, retFrequency === f && styles.typeButtonActive]}
                          onPress={() => setRetFrequency(f)}
                        >
                          <Text style={[styles.typeButtonText, retFrequency === f && styles.typeButtonTextActive]}>
                            {getFrequencyLabel(f)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {parseFloat(retContribution) > 0 && (
                      <Text style={styles.retMonthlyPreview}>
                        = ${retirementCalcs.monthlyContribution.toFixed(0)}/mo pre-tax
                      </Text>
                    )}

                    <Text style={styles.label}>Employer Match (%)</Text>
                    <Text style={styles.helperText}>E.g. "4" means they match up to 4% of salary</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={retMatchPercent}
                        onChangeText={setRetMatchPercent}
                      />
                      <Text style={styles.percent}>%</Text>
                    </View>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity style={styles.modalCancelButton} onPress={handleResetForm}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalAddButton, (!retInstitution || !retBalance) && styles.modalAddButtonDisabled]}
                        onPress={editingAsset ? handleSaveEdit : handleAddAsset}
                        disabled={!retInstitution || !retBalance}
                      >
                        <Text style={styles.modalAddText}>{editingAsset ? 'Save' : 'Add'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., USDC in Kamino, 100 SOL"
                      placeholderTextColor="#666"
                      value={name}
                      onChangeText={setName}
                    />

                    <Text style={styles.label}>Current Value</Text>
                    <View style={styles.inputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={value}
                        onChangeText={setValue}
                      />
                    </View>

                    {type === 'stocks' && (
                      <>
                        <Text style={styles.label}>Number of Shares</Text>
                        <Text style={styles.helperText}>
                          How many shares do you own?
                        </Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="100"
                          placeholderTextColor="#666"
                          keyboardType="numeric"
                          value={quantity}
                          onChangeText={setQuantity}
                        />

                        <StockVestingFields
                          hasUnvestedShares={hasUnvestedShares}
                          setHasUnvestedShares={setHasUnvestedShares}
                          vestedShares={vestedShares}
                          setVestedShares={setVestedShares}
                          unvestedShares={unvestedShares}
                          setUnvestedShares={setUnvestedShares}
                          sharesPerVest={sharesPerVest}
                          setSharesPerVest={setSharesPerVest}
                          vestingFrequency={vestingFrequency}
                          setVestingFrequency={setVestingFrequency}
                          nextVestDate={nextVestDate}
                          setNextVestDate={setNextVestDate}
                        />
                      </>
                    )}

                    <Text style={styles.label}>APY (optional)</Text>
                    <Text style={styles.helperText}>Leave blank if not earning yield.</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={apy}
                        onChangeText={setApy}
                      />
                      <Text style={styles.percent}>%</Text>
                    </View>
                    
                    {/* Primary Residence Toggle - Only for real estate */}
                    {type === 'real_estate' && (
                      <>
                        <Text style={styles.label}>Property Type</Text>
                        <View style={styles.toggleRow}>
                          <TouchableOpacity
                            style={[
                              styles.toggleButton,
                              !isPrimaryResidence && styles.toggleButtonActive
                            ]}
                            onPress={() => setIsPrimaryResidence(false)}
                          >
                            <Text style={[
                              styles.toggleButtonText,
                              !isPrimaryResidence && styles.toggleButtonTextActive
                            ]}>
                              Investment Property
                            </Text>
                          </TouchableOpacity>
                        
                          <TouchableOpacity
                            style={[
                              styles.toggleButton,
                              isPrimaryResidence && styles.toggleButtonActive
                            ]}
                            onPress={() => setIsPrimaryResidence(true)}
                          >
                            <Text style={[
                              styles.toggleButtonText,
                              isPrimaryResidence && styles.toggleButtonTextActive
                            ]}>
                              Primary Residence
                            </Text>
                          </TouchableOpacity>
                        </View>
                      
                        {isPrimaryResidence && (
                          <View style={styles.helperBox}>
                            <Text style={styles.helperText}>
                              💡 Your primary residence won't prompt for investment thesis and won't appear in "rent out property" scenarios.
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  

                    <View style={styles.modalButtons}>
                      <TouchableOpacity style={styles.modalCancelButton} onPress={handleResetForm}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalAddButton, (!name || !value) && styles.modalAddButtonDisabled]}
                        onPress={editingAsset ? handleSaveEdit : handleAddAsset}
                        disabled={!name || !value}
                      >
                        <Text style={styles.modalAddText}>{editingAsset ? 'Save' : 'Add'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Edit Bank Account Balance Modal ── */}
        <Modal
          visible={showBankEditModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowBankEditModal(false);
            setEditingBankAccount(null);
            setValue('');
          }}
        >
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
                      value={value}
                      onChangeText={setValue}
                      autoFocus
                    />
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => {
                        setShowBankEditModal(false);
                        setEditingBankAccount(null);
                        setValue('');
                      }}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalAddButton, !value && styles.modalAddButtonDisabled]}
                      onPress={handleUpdateBankBalance}
                      disabled={!value}
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
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#4ade80', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, marginTop: 12 },
    helperText: { fontSize: 13, color: '#666', marginBottom: 8 },
    modalInput: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, fontSize: 16, color: '#ffffff', borderWidth: 2, borderColor: '#2a2f3e' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: '#2a2f3e' },
    currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 8 },
    input: { flex: 1, fontSize: 20, color: '#ffffff', paddingVertical: 16 },
    percent: { fontSize: 16, color: '#666', marginLeft: 8 },
    typeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeButton: { padding: 10, borderRadius: 8, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
    typeButtonActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
    typeButtonText: { fontSize: 13, color: '#666' },
    typeButtonTextActive: { color: '#4ade80', fontWeight: 'bold' },
    retMonthlyPreview: { fontSize: 14, color: '#c084fc', marginTop: 8, textAlign: 'right' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
    modalCancelButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
    modalCancelText: { color: '#a0a0a0', fontSize: 16 },
    modalAddButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
    modalAddButtonDisabled: { opacity: 0.5 },
    modalAddText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },

    autoSyncBadge: {
      backgroundColor: '#4ade80',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginTop: 4,
    },
    autoSyncBadgeText: {
      color: '#0a0e1a',
      fontSize: 10,
      fontWeight: 'bold',
    },

    // Bank edit modal
    bankAccountInfo: {
      backgroundColor: '#1a1f2e',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: '#60a5fa',
    },
    bankAccountName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 4,
    },
    bankAccountInstitution: {
      fontSize: 14,
      color: '#666',
      marginBottom: 8,
    },
    currentBalanceLabel: {
      fontSize: 16,
      color: '#4ade80',
      fontWeight: '600',
    },

    toggleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    toggleButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#2a2f3e',
      alignItems: 'center',
      backgroundColor: '#1a1f2e',
    },
    toggleButtonActive: {
      borderColor: '#4ade80',
      backgroundColor: '#1a2f1e',
    },
    toggleButtonText: {
      fontSize: 14,
      color: '#666',
    },
    toggleButtonTextActive: {
      color: '#4ade80',
      fontWeight: 'bold',
    },
    helperBox: {
      backgroundColor: '#1a2a3a',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: '#60a5fa',
    },
  });
