// app/business.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Business Dashboard — user-configurable business name and entity type.
// Tracks: referral wallet, business bank account, expenses, distributions, P&L
// Auto-syncs business net value → personal asset of type 'business'
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/store/useStore';

const STORAGE_KEY = 'business_dashboard_data';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ─── Types ───────────────────────────────────────────────────────────────────

type EntityType = 'llc' | 's_corp' | 'c_corp' | 'sole_prop' | 'partnership' | 'other';

const ENTITY_LABELS: Record<EntityType, string> = {
  llc: 'LLC', s_corp: 'S-Corp', c_corp: 'C-Corp',
  sole_prop: 'Sole Proprietorship', partnership: 'Partnership', other: 'Other',
};

interface BusinessExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual' | 'one-time';
  category: 'hosting' | 'dev_tools' | 'marketing' | 'legal' | 'domain' | 'api' | 'other';
  notes?: string;
}

interface Distribution {
  id: string;
  amount: number;
  date: string; // ISO date
  notes?: string;
}

interface BusinessData {
  businessName: string;
  entityType: EntityType;
  referralWallet: string;
  referralBalance: {
    sol: number;
    usdc: number;
    other: { symbol: string; amount: number; valueUSD: number }[];
    totalUSD: number;
    lastFetched: string;
  } | null;
  bankAccount: {
    name: string;
    institution: string;
    balance: number;
    lastUpdated: string;
  } | null;
  expenses: BusinessExpense[];
  distributions: Distribution[];
  contributions: Distribution[]; // Capital contributions (personal → business)
}

const EXPENSE_CATEGORIES: Record<string, { emoji: string; label: string }> = {
  hosting: { emoji: '☁️', label: 'Hosting' },
  dev_tools: { emoji: '🔧', label: 'Dev Tools' },
  marketing: { emoji: '📢', label: 'Marketing' },
  legal: { emoji: '⚖️', label: 'Legal' },
  domain: { emoji: '🌐', label: 'Domains' },
  api: { emoji: '🔌', label: 'APIs' },
  other: { emoji: '📦', label: 'Other' },
};

const DEFAULT_DATA: BusinessData = {
  businessName: '',
  entityType: 'llc',
  referralWallet: '',
  referralBalance: null,
  bankAccount: null,
  expenses: [],
  distributions: [],
  contributions: [],
};

// ─── Auto-sync business → personal asset ─────────────────────────────────────

function syncBusinessAsset(data: BusinessData) {
  const store = useStore.getState();
  const bankBal = data.bankAccount?.balance || 0;
  const walletBal = data.referralBalance?.totalUSD || 0;
  const netValue = bankBal + walletBal;

  if (!data.businessName || netValue <= 0) return;

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
      console.log(`[BIZ] Updated ${data.businessName} asset: $${netValue}`);
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
    console.log(`[BIZ] Created ${data.businessName} asset: $${netValue}`);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BusinessDashboard() {
  const router = useRouter();
  const [data, setData] = useState<BusinessData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDistModal, setShowDistModal] = useState(false);
  const [showContribModal, setShowContribModal] = useState(false);

  // Setup form
  const [setupName, setSetupName] = useState('');
  const [setupEntity, setSetupEntity] = useState<EntityType>('llc');

  // Expense form
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFreq, setExpFreq] = useState<'monthly' | 'annual' | 'one-time'>('monthly');
  const [expCategory, setExpCategory] = useState<string>('hosting');
  const [expNotes, setExpNotes] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Bank form
  const [bankName, setBankName] = useState('');
  const [bankInstitution, setBankInstitution] = useState('');
  const [bankBalance, setBankBalance] = useState('');

  // Wallet form
  const [walletInput, setWalletInput] = useState('');

  // Distribution form
  const [distAmount, setDistAmount] = useState('');
  const [distNotes, setDistNotes] = useState('');

  // Contribution form
  const [contribAmount, setContribAmount] = useState('');
  const [contribNotes, setContribNotes] = useState('');

  // ── Load / Save ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const parsed = { ...DEFAULT_DATA, ...JSON.parse(raw) };
        setData(parsed);
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

  // ── Setup ──────────────────────────────────────────────────
  const handleSetup = () => {
    if (!setupName.trim()) return;
    const newData = { ...data, businessName: setupName.trim(), entityType: setupEntity };
    save(newData);
    setShowSetupModal(false);
  };

  // ── Sync Referral Wallet ───────────────────────────────────
  const syncReferralWallet = async () => {
    if (!data.referralWallet) {
      Alert.alert('No Wallet', 'Set your referral wallet address first.');
      return;
    }
    setSyncing(true);
    try {
      const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

      // SOL balance
      const balResp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [data.referralWallet] }),
      });
      const balData = await balResp.json();
      const solBalance = (balData.result?.value || 0) / 1e9;

      // Token accounts
      const tokResp = await fetch(rpcUrl, {
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
      console.error('Referral sync error:', err);
      Alert.alert('Sync Failed', err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Expense CRUD ───────────────────────────────────────────
  const addExpense = () => {
    if (!expName || !expAmount) return;
    const expense: BusinessExpense = {
      id: editingExpenseId || Date.now().toString(),
      name: expName, amount: parseFloat(expAmount), frequency: expFreq,
      category: expCategory as any, notes: expNotes || undefined,
    };
    const newExpenses = editingExpenseId
      ? data.expenses.map(e => e.id === editingExpenseId ? expense : e)
      : [...data.expenses, expense];
    save({ ...data, expenses: newExpenses });
    resetExpenseForm();
  };

  const deleteExpense = (id: string) => save({ ...data, expenses: data.expenses.filter(e => e.id !== id) });

  const editExpense = (e: BusinessExpense) => {
    setEditingExpenseId(e.id); setExpName(e.name); setExpAmount(e.amount.toString());
    setExpFreq(e.frequency); setExpCategory(e.category); setExpNotes(e.notes || '');
    setShowExpenseModal(true);
  };

  const resetExpenseForm = () => {
    setExpName(''); setExpAmount(''); setExpFreq('monthly');
    setExpCategory('hosting'); setExpNotes(''); setEditingExpenseId(null);
    setShowExpenseModal(false);
  };

  // ── Bank Account ───────────────────────────────────────────
  const saveBankAccount = () => {
    if (!bankName || !bankBalance) return;
    save({ ...data, bankAccount: { name: bankName, institution: bankInstitution, balance: parseFloat(bankBalance), lastUpdated: new Date().toISOString() } });
    setShowBankModal(false);
  };

  // ── Wallet ─────────────────────────────────────────────────
  const saveWallet = () => {
    if (!walletInput || walletInput.length < 30) return;
    save({ ...data, referralWallet: walletInput.trim() });
    setShowWalletModal(false);
  };

  // ── Distribution ───────────────────────────────────────────
  const recordDistribution = () => {
    const amount = parseFloat(distAmount);
    if (!amount || amount <= 0) return;
    const dist: Distribution = {
      id: Date.now().toString(),
      amount,
      date: new Date().toISOString(),
      notes: distNotes || undefined,
    };
    save({ ...data, distributions: [...data.distributions, dist] });
    setDistAmount(''); setDistNotes(''); setShowDistModal(false);

    // Also add as income source in personal store
    // (Optional — user can do this manually too)
    Alert.alert(
      'Distribution Recorded',
      `$${amount.toLocaleString()} distribution from ${data.businessName}.\n\nAdd to personal income?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => {
          const store = useStore.getState();
          const currentOther = store.income.otherIncome || 0;
          useStore.setState({
            income: { ...store.income, otherIncome: currentOther + amount },
          });
        }},
      ]
    );
  };

  const deleteDistribution = (id: string) => {
    save({ ...data, distributions: data.distributions.filter(d => d.id !== id) });
  };

  // ── Capital Contributions ──────────────────────────────────
  const recordContribution = () => {
    const amount = parseFloat(contribAmount);
    if (!amount || amount <= 0) return;
    const contrib: Distribution = {
      id: Date.now().toString(),
      amount,
      date: new Date().toISOString(),
      notes: contribNotes || undefined,
    };
    save({ ...data, contributions: [...(data.contributions || []), contrib] });
    setContribAmount(''); setContribNotes(''); setShowContribModal(false);
  };

  const deleteContribution = (id: string) => {
    save({ ...data, contributions: (data.contributions || []).filter(c => c.id !== id) });
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

  if (loading) {
    return <View style={st.loadingContainer}><ActivityIndicator color="#f4c430" size="large" /></View>;
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={st.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={st.backBtn}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSetupName(data.businessName); setSetupEntity(data.entityType); setShowSetupModal(true); }}>
          <Text style={st.pageTitle}>🏢 {data.businessName || 'My Business'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={st.entityLabel}>{ENTITY_LABELS[data.entityType]} · Tap name to edit</Text>

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
            <TouchableOpacity onPress={() => { setWalletInput(data.referralWallet); setShowWalletModal(true); }}>
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
          <TouchableOpacity onPress={() => {
            if (data.bankAccount) { setBankName(data.bankAccount.name); setBankInstitution(data.bankAccount.institution); setBankBalance(data.bankAccount.balance.toString()); }
            setShowBankModal(true);
          }}>
            <Text style={st.syncBtn}>{data.bankAccount ? '✏️ Edit' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {data.bankAccount ? (
          <View style={st.card}>
            <Text style={st.cardLabel}>{data.bankAccount.name}</Text>
            <Text style={st.cardSub}>{data.bankAccount.institution}</Text>
            <Text style={st.bigValue}>${data.bankAccount.balance.toLocaleString()}</Text>
            <Text style={st.lastSync}>Updated: {new Date(data.bankAccount.lastUpdated).toLocaleDateString()}</Text>
          </View>
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

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Setup / Edit Business Modal */}
      <Modal visible={showSetupModal} transparent animationType="slide" onRequestClose={() => { if (data.businessName) setShowSetupModal(false); }}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>{data.businessName ? 'Edit Business' : 'Set Up Your Business'}</Text>
            <Text style={st.modalSub}>This information is only stored on your device</Text>

            <Text style={st.modalLabel}>Business Name</Text>
            <TextInput style={st.modalInput} placeholder="e.g. Suten LLC, My Consulting" placeholderTextColor="#666"
              value={setupName} onChangeText={setSetupName} />

            <Text style={st.modalLabel}>Entity Type</Text>
            <View style={st.pillRow}>
              {(Object.entries(ENTITY_LABELS) as [EntityType, string][]).map(([key, label]) => (
                <TouchableOpacity key={key}
                  style={[st.catPill, setupEntity === key && st.catPillActive]}
                  onPress={() => setSetupEntity(key)}>
                  <Text style={[st.catPillText, setupEntity === key && st.catPillTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.modalBtns}>
              {data.businessName ? (
                <TouchableOpacity style={st.modalCancel} onPress={() => setShowSetupModal(false)}>
                  <Text style={st.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[st.modalSave, { flex: data.businessName ? 1 : undefined }]} onPress={handleSetup}>
                <Text style={st.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <Modal visible={showWalletModal} transparent animationType="slide" onRequestClose={() => setShowWalletModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Referral Wallet Address</Text>
            <Text style={st.modalSub}>The wallet receiving swap referral fees</Text>
            <TextInput style={st.modalInput} placeholder="Solana wallet address" placeholderTextColor="#666"
              value={walletInput} onChangeText={setWalletInput} autoCapitalize="none" />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancel} onPress={() => setShowWalletModal(false)}>
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalSave} onPress={saveWallet}>
                <Text style={st.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank Modal */}
      <Modal visible={showBankModal} transparent animationType="slide" onRequestClose={() => setShowBankModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Business Bank Account</Text>
            <TextInput style={st.modalInput} placeholder="Account name" placeholderTextColor="#666"
              value={bankName} onChangeText={setBankName} />
            <TextInput style={st.modalInput} placeholder="Institution (e.g. Mercury, Chase)" placeholderTextColor="#666"
              value={bankInstitution} onChangeText={setBankInstitution} />
            <TextInput style={st.modalInput} placeholder="Current balance" placeholderTextColor="#666"
              keyboardType="numeric" value={bankBalance} onChangeText={setBankBalance} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancel} onPress={() => setShowBankModal(false)}>
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalSave} onPress={saveBankAccount}>
                <Text style={st.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={showExpenseModal} transparent animationType="slide" onRequestClose={resetExpenseForm}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <ScrollView>
              <Text style={st.modalTitle}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</Text>
              <TextInput style={st.modalInput} placeholder="Expense name (e.g. Vercel Pro)" placeholderTextColor="#666"
                value={expName} onChangeText={setExpName} />
              <TextInput style={st.modalInput} placeholder="Amount" placeholderTextColor="#666"
                keyboardType="numeric" value={expAmount} onChangeText={setExpAmount} />

              <Text style={st.modalLabel}>Category</Text>
              <View style={st.pillRow}>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, { emoji, label }]) => (
                  <TouchableOpacity key={key}
                    style={[st.catPill, expCategory === key && st.catPillActive]}
                    onPress={() => setExpCategory(key)}>
                    <Text style={[st.catPillText, expCategory === key && st.catPillTextActive]}>{emoji} {label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.modalLabel}>Frequency</Text>
              <View style={st.pillRow}>
                {(['monthly', 'annual', 'one-time'] as const).map(f => (
                  <TouchableOpacity key={f}
                    style={[st.catPill, expFreq === f && st.catPillActive]}
                    onPress={() => setExpFreq(f)}>
                    <Text style={[st.catPillText, expFreq === f && st.catPillTextActive]}>
                      {f === 'one-time' ? 'One-time' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={st.modalInput} placeholder="Notes (optional)" placeholderTextColor="#666"
                value={expNotes} onChangeText={setExpNotes} />

              <View style={st.modalBtns}>
                <TouchableOpacity style={st.modalCancel} onPress={resetExpenseForm}>
                  <Text style={st.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalSave} onPress={addExpense}>
                  <Text style={st.modalSaveText}>{editingExpenseId ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Distribution Modal */}
      <Modal visible={showDistModal} transparent animationType="slide" onRequestClose={() => setShowDistModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Record Distribution</Text>
            <Text style={st.modalSub}>
              A distribution is money transferred from {data.businessName || 'your business'} to your personal accounts
            </Text>
            <TextInput style={st.modalInput} placeholder="Amount" placeholderTextColor="#666"
              keyboardType="numeric" value={distAmount} onChangeText={setDistAmount} />
            <TextInput style={st.modalInput} placeholder="Notes (optional)" placeholderTextColor="#666"
              value={distNotes} onChangeText={setDistNotes} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancel} onPress={() => { setShowDistModal(false); setDistAmount(''); setDistNotes(''); }}>
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalSave} onPress={recordDistribution}>
                <Text style={st.modalSaveText}>Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contribution Modal */}
      <Modal visible={showContribModal} transparent animationType="slide" onRequestClose={() => setShowContribModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Record Capital Contribution</Text>
            <Text style={st.modalSub}>
              Money transferred from your personal accounts to fund {data.businessName || 'your business'}
            </Text>
            <TextInput style={st.modalInput} placeholder="Amount" placeholderTextColor="#666"
              keyboardType="numeric" value={contribAmount} onChangeText={setContribAmount} />
            <TextInput style={st.modalInput} placeholder="Notes (optional, e.g. 'From Chase checking')" placeholderTextColor="#666"
              value={contribNotes} onChangeText={setContribNotes} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancel} onPress={() => { setShowContribModal(false); setContribAmount(''); setContribNotes(''); }}>
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalSave} onPress={recordContribution}>
                <Text style={st.modalSaveText}>Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 4 },
  backBtn: { fontSize: 16, color: '#f4c430', fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#f4c430' },
  entityLabel: { fontSize: 12, color: '#666', marginBottom: 16, paddingLeft: 4 },

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
  catPillText: { fontSize: 12, color: '#888', fontWeight: '600' },
  catPillTextActive: { color: '#f4c430' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: '#888', fontWeight: '700' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f4c430', alignItems: 'center' },
  modalSaveText: { fontSize: 15, color: '#0a0e1a', fontWeight: '800' },
});
