// app/(tabs)/assets.tsx - Simplified with collapsible categories
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../src/store/useStore';
import { analyzeAllAccounts } from '../../src/services/cashflow';
import { fetchSKRHolding, calcSKRIncome } from '../../src/services/skr';
import CashFlowSummary from '../../src/components/CashFlowSummary';
import AssetSection from '../../src/components/AssetSection';
import { categorizeAssets, calculateCategoryTotal, calculateCategoryIncome, calculateTotalValue, calculateTotalIncome, getCategoryIcon, getCategoryLabel } from '../../src/utils/assetCalculations';
import type { Asset } from '../../src/types';
import type { SKRHolding, SKRIncomeSnapshot } from '../../src/services/skr';

export default function AssetsScreen() {
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [showBankEditModal, setShowBankEditModal] = useState(false);

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

  // Generic asset form state
  const [name, setName] = useState('');
  const [type, setType] = useState<Asset['type']>('crypto');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');

  // Retirement-specific form state
  const [retAccountType, setRetAccountType] = useState<'401k' | 'roth_401k' | 'ira' | 'roth_ira'>('401k');
  const [retInstitution, setRetInstitution] = useState('');
  const [retBalance, setRetBalance] = useState('');
  const [retContribution, setRetContribution] = useState('');
  const [retFrequency, setRetFrequency] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');
  const [retMatchPercent, setRetMatchPercent] = useState('');

  // Cash flow data
  const cashFlow = analyzeAllAccounts(bankAccounts, incomeSources, obligations, debts, assets, paycheckDeductions);

  // Categorize assets
  const categorized = useMemo(() => categorizeAssets(assets, bankAccounts), [assets, bankAccounts]);
  const totalValue = useMemo(() => calculateTotalValue(categorized), [categorized]);
  const totalIncome = useMemo(() => calculateTotalIncome(categorized), [categorized]);

  const resetForm = () => {
    setName('');
    setType('crypto');
    setValue('');
    setApy('');
    setRetAccountType('401k');
    setRetInstitution('');
    setRetBalance('');
    setRetContribution('');
    setRetFrequency('biweekly');
    setRetMatchPercent('');
    setEditingAsset(null);
    setShowAddModal(false);
  };

  const handleAddAsset = () => {
    // ── Retirement path ──────────────────────────────────────────────────
    if (type === 'retirement') {
      if (!retInstitution || !retBalance) return;

      const totalMonthlySalary = incomeSources.reduce((sum, s) => {
        if (s.frequency === 'biweekly') return sum + s.amount * 2.17;
        if (s.frequency === 'weekly') return sum + s.amount * 4.33;
        if (s.frequency === 'twice_monthly') return sum + s.amount * 2;
        return sum + s.amount;
      }, 0);
      const matchPct = parseFloat(retMatchPercent) || 0;
      const employerMatchDollars = matchPct > 0 ? totalMonthlySalary * (matchPct / 100) : 0;

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
      resetForm();
      return;
    }

    // ── Generic asset path ────────────────────────────────────────────────
    if (!name || !value) return;

    const assetValue = parseFloat(value);
    const assetApy = parseFloat(apy) || 0;
    const calculatedIncome = assetValue * (assetApy / 100);

    const newAsset: Asset = {
      id: Date.now().toString(),
      name,
      type,
      value: assetValue,
      annualIncome: calculatedIncome,
      metadata: {
        type: 'other',
        description: name,
        apy: assetApy,
      },
    };

    addAsset(newAsset);
    resetForm();
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
    
    if (asset.type === 'retirement' && asset.metadata.type === 'retirement') {
      setType('retirement');
      setRetAccountType(asset.metadata.accountType);
      setRetInstitution(asset.metadata.institution || '');
      setRetBalance(asset.value.toString());
      setRetContribution(asset.metadata.contributionAmount?.toString() || '0');
      setRetFrequency(asset.metadata.contributionFrequency || 'biweekly');
      setRetMatchPercent(asset.metadata.employerMatchPercent?.toString() || '0');
    } else {
      setType(asset.type);
      setName(asset.name);
      setValue(asset.value.toString());
      setApy(asset.metadata.apy?.toString() || '');
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

      const totalMonthlySalary = incomeSources.reduce((sum, s) => {
        if (s.frequency === 'biweekly') return sum + s.amount * 2.17;
        if (s.frequency === 'weekly') return sum + s.amount * 4.33;
        if (s.frequency === 'twice_monthly') return sum + s.amount * 2;
        return sum + s.amount;
      }, 0);

      const employerMatchDollars = (matchPercent / 100) * totalMonthlySalary;

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

      updatedAsset = {
        name,
        value: assetValue,
        annualIncome: income,
        metadata: {
          ...editingAsset.metadata,
          apy: assetApy,
        },
      };
    }

    updateAsset(editingAsset.id, updatedAsset);
    resetForm();
  };

  const getTypeLabel = (t: Asset['type']) => {
    const labels: Record<string, string> = {
      crypto: '₿ Crypto',
      stocks: '📈 Stocks',
      real_estate: '🏠 Real Estate',
      business: '💼 Business',
      retirement: '🏛️ Retirement',
      other: '💰 Other',
    };
    return labels[t] || '💰 Other';
  };

  const retMonthly = (() => {
    const amt = parseFloat(retContribution) || 0;
    if (retFrequency === 'weekly') return amt * 4.33;
    if (retFrequency === 'biweekly') return amt * 2.17;
    if (retFrequency === 'twice_monthly') return amt * 2;
    return amt;
  })();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>

        {/* ── Cash Flow Summary ── */}
        {/* <CashFlowSummary cashFlow={cashFlow} /> */}

        {/* ── Portfolio Summary ── */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Value</Text>
              <Text style={styles.summaryValue}>${totalValue.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Annual Income</Text>
              <Text style={styles.summaryIncome}>${totalIncome.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Add Asset Button */}
        <TouchableOpacity style={styles.addButtonLarge} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonLargeText}>+ Add Asset</Text>
        </TouchableOpacity>

        {/* ── SKR Auto-Detected Card ── */}
        {skrHolding && skrIncome && (
          <View style={styles.skrCard}>
            <View style={styles.skrHeader}>
              <View style={styles.skrLogoRow}>
                <Text style={styles.skrLogo}>◎</Text>
                <View>
                  <Text style={styles.skrTitle}>$SKR — Solana Mobile</Text>
                  <Text style={styles.skrSub}>Auto-detected from wallet</Text>
                </View>
              </View>
              <View style={styles.skrApyBadge}>
                <Text style={styles.skrApyText}>{((skrHolding.apy ?? 0) * 100).toFixed(0)}% APY</Text>
              </View>
            </View>

            <View style={styles.skrBarBg}>
              <View style={[
                styles.skrBarStaked,
                { width: `${skrHolding.totalBalance > 0 ? (skrHolding.stakedBalance / skrHolding.totalBalance) * 100 : 0}%` }
              ]} />
            </View>
            <View style={styles.skrBarLabels}>
              <Text style={styles.skrBarLabelStaked}>
                Staked: {skrHolding.stakedBalance.toLocaleString()} SKR
              </Text>
              <Text style={styles.skrBarLabelLiquid}>
                Liquid: {skrHolding.liquidBalance.toLocaleString()} SKR
              </Text>
            </View>

            <View style={styles.skrNumbers}>
              <View style={styles.skrNumCol}>
                <Text style={styles.skrNumLabel}>Total Value</Text>
                <Text style={styles.skrNumValue}>
                  ${skrIncome.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.skrNumCol}>
                <Text style={styles.skrNumLabel}>Monthly Yield</Text>
                <Text style={[styles.skrNumValue, { color: '#4ade80' }]}>
                  ${skrIncome.monthlyYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.skrNumCol}>
                <Text style={styles.skrNumLabel}>Annual Yield</Text>
                <Text style={[styles.skrNumValue, { color: '#4ade80' }]}>
                  ${skrIncome.annualYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Asset Categories ── */}
        <AssetSection
          title={getCategoryLabel('brokerage')}
          icon={getCategoryIcon('brokerage')}
          assets={categorized.brokerage}
          totalValue={calculateCategoryTotal(categorized.brokerage)}
          totalIncome={calculateCategoryIncome(categorized.brokerage)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
        />

        <AssetSection
          title={getCategoryLabel('cash')}
          icon={getCategoryIcon('cash')}
          assets={categorized.cash}
          totalValue={calculateCategoryTotal(categorized.cash)}
          totalIncome={calculateCategoryIncome(categorized.cash)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
          onBankAccountPress={handleBankAccountPress}
        />

        <AssetSection
          title={getCategoryLabel('realEstate')}
          icon={getCategoryIcon('realEstate')}
          assets={categorized.realEstate}
          totalValue={calculateCategoryTotal(categorized.realEstate)}
          totalIncome={calculateCategoryIncome(categorized.realEstate)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
        />

        <AssetSection
          title={getCategoryLabel('commodities')}
          icon={getCategoryIcon('commodities')}
          assets={categorized.commodities}
          totalValue={calculateCategoryTotal(categorized.commodities)}
          totalIncome={calculateCategoryIncome(categorized.commodities)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
        />

        <AssetSection
          title={getCategoryLabel('crypto')}
          icon={getCategoryIcon('crypto')}
          assets={categorized.crypto}
          totalValue={calculateCategoryTotal(categorized.crypto)}
          totalIncome={calculateCategoryIncome(categorized.crypto)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
        />

        <AssetSection
          title={getCategoryLabel('retirement')}
          icon={getCategoryIcon('retirement')}
          assets={categorized.retirement}
          totalValue={calculateCategoryTotal(categorized.retirement)}
          totalIncome={calculateCategoryIncome(categorized.retirement)}
          onAssetPress={handleEditAsset}
          onAssetDelete={handleRemoveAsset}
        />

      </ScrollView>

      {/* ── Add Asset Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
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
                      {getTypeLabel(t)}
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
                          {f === 'biweekly' ? 'Bi-weekly' : f === 'twice_monthly' ? '2x/mo' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {parseFloat(retContribution) > 0 && (
                    <Text style={styles.retMonthlyPreview}>= ${retMonthly.toFixed(0)}/mo pre-tax</Text>
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
                    <TouchableOpacity style={styles.modalCancelButton} onPress={resetForm}>
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

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={resetForm}>
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

  summaryBox: { 
    backgroundColor: '#1a1f2e', 
    padding: 20, 
    borderRadius: 12, 
    marginBottom: 16, 
    borderWidth: 2, 
    borderColor: '#4ade80' 
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 14, color: '#a0a0a0', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  summaryIncome: { fontSize: 24, fontWeight: 'bold', color: '#4ade80' },

  addButtonLarge: {
    backgroundColor: '#4ade80',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonLargeText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // SKR card
  skrCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  skrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  skrLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skrLogo: { fontSize: 28, color: '#f4c430' },
  skrTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  skrSub: { fontSize: 12, color: '#666', marginTop: 1 },
  skrApyBadge: {
    backgroundColor: '#f4c43022',
    borderWidth: 1,
    borderColor: '#f4c430',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skrApyText: { fontSize: 13, fontWeight: 'bold', color: '#f4c430' },
  skrBarBg: { height: 8, backgroundColor: '#0a0e1a', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  skrBarStaked: { height: '100%', backgroundColor: '#f4c430', borderRadius: 4 },
  skrBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  skrBarLabelStaked: { fontSize: 12, color: '#f4c430', fontWeight: '600' },
  skrBarLabelLiquid: { fontSize: 12, color: '#666' },
  skrNumbers: { flexDirection: 'row', marginBottom: 12 },
  skrNumCol: { flex: 1, alignItems: 'center' },
  skrNumLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  skrNumValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

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
});
