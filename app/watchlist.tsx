// app/watchlist.tsx
// ══════════════════════════════════════════════════════════════════
// Coin Watchlist — track coins you don't hold, get entry signals
// when they dip, position sizing suggestions, and exit plans.
// Hooks into existing priceTracker infrastructure.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Platform, Alert as RNAlert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/store/useStore';
import {
  fetchPrices, recordPriceSnapshot, getTokenPriceData,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  type TokenPriceData, type WatchlistToken,
} from '../src/services/priceTracker';
import AccumulationPlanCard from '../src/components/AccumulationPlanCard';

// ── Cross-platform alert ──────────────────────────────────────────
function alert(title: string, msg?: string) {
  if (Platform.OS === 'web') window.alert(msg ? `${title}\n\n${msg}` : title);
  else RNAlert.alert(title, msg);
}
function confirm(title: string, msg: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${msg}`)) onYes(); }
  else RNAlert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: onYes }]);
}

// ── Extended watchlist item with entry/exit plan ──────────────────
const WATCHLIST_EXT_KEY = 'watchlist_extended';

interface WatchlistExt {
  mint: string;
  addedPrice: number;       // price when added
  entryTarget1: number;     // -20% from added price
  entryTarget2: number;     // -40% from added price
  maxAllocationPct: number; // default 5%
  takeProfitPct: number;    // default 100% (2x)
  stopLossPct: number;      // default -25%
  notes: string;
}

async function loadExtData(): Promise<Record<string, WatchlistExt>> {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_EXT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
async function saveExtData(data: Record<string, WatchlistExt>): Promise<void> {
  await AsyncStorage.setItem(WATCHLIST_EXT_KEY, JSON.stringify(data));
}

// ── Popular Solana tokens for quick-add ──────────────────────────
const POPULAR_TOKENS = [
  { symbol: 'SOL',     name: 'Solana',      mint: 'So11111111111111111111111111111111111111112' },
  { symbol: 'JUP',     name: 'Jupiter',     mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'BONK',    name: 'Bonk',        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF',     name: 'dogwifhat',   mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'JTO',     name: 'Jito',        mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL' },
  { symbol: 'PYTH',    name: 'Pyth Network',mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  { symbol: 'RENDER',  name: 'Render',      mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' },
  { symbol: 'HNT',     name: 'Helium',      mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux' },
  { symbol: 'RAY',     name: 'Raydium',     mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol: 'ORCA',    name: 'Orca',        mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
  { symbol: 'W',       name: 'Wormhole',    mint: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ' },
  { symbol: 'TRUMP',   name: 'OFFICIAL TRUMP', mint: 'HaP8r3ksG76PhQLTqR8FYBeNiQpejcFbQmiHbg787Ut' },
  { symbol: 'FARTCOIN', name: 'Fartcoin',    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
];

// ── Entry signal logic ───────────────────────────────────────────

interface EntrySignal {
  level: 'none' | 'watching' | 'interesting' | 'strong' | 'extreme';
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

function getEntrySignal(ext: WatchlistExt, currentPrice: number): EntrySignal {
  const dropFromAdd = ((currentPrice - ext.addedPrice) / ext.addedPrice) * 100;

  if (dropFromAdd <= -40) return {
    level: 'extreme', label: 'Deep value zone', emoji: '🔥',
    color: '#f87171', bgColor: '#f8717120',
  };
  if (dropFromAdd <= -20) return {
    level: 'strong', label: 'Good entry zone', emoji: '🟢',
    color: '#4ade80', bgColor: '#4ade8020',
  };
  if (dropFromAdd <= -10) return {
    level: 'interesting', label: 'Getting interesting', emoji: '👀',
    color: '#f4c430', bgColor: '#f4c43020',
  };
  if (dropFromAdd >= 50) return {
    level: 'watching', label: 'Running hot — wait for pullback', emoji: '🔴',
    color: '#f87171', bgColor: '#f8717115',
  };
  return {
    level: 'none', label: 'Tracking', emoji: '📊',
    color: '#888', bgColor: '#88888815',
  };
}

function getExitSignal(ext: WatchlistExt, currentPrice: number, entryPrice: number): string | null {
  if (entryPrice <= 0) return null;
  const gainPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  if (gainPct >= ext.takeProfitPct) return `🎯 Take profit target hit (+${gainPct.toFixed(0)}%)`;
  if (gainPct <= ext.stopLossPct) return `🛑 Stop loss triggered (${gainPct.toFixed(0)}%)`;
  return null;
}

// ── Main Component ───────────────────────────────────────────────

export default function WatchlistScreen() {
  const router = useRouter();
  const assets = useStore(s => s.assets);
  const totalPortfolio = useMemo(
    () => assets.reduce((sum, a) => sum + a.value, 0),
    [assets]
  );

  const [watchlist, setWatchlist] = useState<WatchlistToken[]>([]);
  const [extData, setExtData] = useState<Record<string, WatchlistExt>>({});
  const [priceData, setPriceData] = useState<Record<string, TokenPriceData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualMint, setManualMint] = useState('');
  const [manualSymbol, setManualSymbol] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [editingMint, setEditingMint] = useState<string | null>(null);

  // Load watchlist and prices
  const loadData = useCallback(async () => {
    try {
      const wl = await getWatchlist();
      const ext = await loadExtData();
      setWatchlist(wl);
      setExtData(ext);

      if (wl.length > 0) {
        const mints = wl.map(t => t.mint);
        const symbolMap: Record<string, string> = {};
        wl.forEach(t => { symbolMap[t.mint] = t.symbol; });

        await recordPriceSnapshot(mints, symbolMap);
        const pd = await getTokenPriceData(mints, symbolMap);
        setPriceData(pd);
      }
    } catch (err) {
      console.error('Watchlist load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Add coin
  const handleAddCoin = async (mint: string, symbol: string, name?: string) => {
    // Fetch current price for entry target calc
    const prices = await fetchPrices([mint]);
    const currentPrice = prices[mint] || 0;

    await addToWatchlist(mint, symbol, name);

    const ext: WatchlistExt = {
      mint,
      addedPrice: currentPrice,
      entryTarget1: currentPrice * 0.8,  // -20%
      entryTarget2: currentPrice * 0.6,  // -40%
      maxAllocationPct: 5,
      takeProfitPct: 100,   // 2x
      stopLossPct: -25,
      notes: '',
    };

    const newExtData = { ...extData, [mint]: ext };
    await saveExtData(newExtData);
    setExtData(newExtData);

    setShowAddModal(false);
    setSearchQuery('');
    setManualMint('');
    setManualSymbol('');
    await loadData();
  };

  // Remove coin
  const handleRemove = (mint: string, symbol: string) => {
    confirm('Remove from watchlist?', `Remove ${symbol}?`, async () => {
      await removeFromWatchlist(mint);
      const newExt = { ...extData };
      delete newExt[mint];
      await saveExtData(newExt);
      setExtData(newExt);
      setWatchlist(prev => prev.filter(t => t.mint !== mint));
      setPriceData(prev => {
        const copy = { ...prev };
        delete copy[mint];
        return copy;
      });
    });
  };

  // Update settings
  const handleUpdateSettings = async (mint: string, updates: Partial<WatchlistExt>) => {
    const newExt = { ...extData, [mint]: { ...extData[mint], ...updates } };
    await saveExtData(newExt);
    setExtData(newExt);
    setEditingMint(null);
  };

  // Filter for search
  const filteredPopular = useMemo(() => {
    const watchedMints = new Set(watchlist.map(t => t.mint));
    const held = new Set(assets.filter(a => a.type === 'crypto').map(a => {
      const m = a.metadata as any;
      return m?.tokenMint || m?.mint || '';
    }));
    return POPULAR_TOKENS
      .filter(t => !watchedMints.has(t.mint) && !held.has(t.mint))
      .filter(t =>
        !searchQuery ||
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [searchQuery, watchlist, assets]);

  // Sort: signal items first
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      const extA = extData[a.mint];
      const extB = extData[b.mint];
      const priceA = priceData[a.mint];
      const priceB = priceData[b.mint];
      if (!extA || !extB || !priceA || !priceB) return 0;
      const sigA = getEntrySignal(extA, priceA.currentPrice);
      const sigB = getEntrySignal(extB, priceB.currentPrice);
      const rank = { extreme: 0, strong: 1, interesting: 2, watching: 3, none: 4 };
      return (rank[sigA.level] ?? 4) - (rank[sigB.level] ?? 4);
    });
  }, [watchlist, extData, priceData]);

  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color="#f4c430" />
        <Text style={st.loadingText}>Loading watchlist...</Text>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.title}>🎯 Coin Watchlist</Text>
            <Text style={st.subtitle}>
              {watchlist.length} coin{watchlist.length !== 1 ? 's' : ''} tracked
              {totalPortfolio > 0 && ` · Portfolio: $${totalPortfolio.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </Text>
          </View>
          <View style={st.headerButtons}>
            <TouchableOpacity style={st.refreshButton} onPress={handleRefresh} disabled={refreshing}>
              {refreshing
                ? <ActivityIndicator size="small" color="#f4c430" />
                : <Text style={st.refreshButtonText}>↻</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={st.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={st.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legend */}
        <View style={st.legend}>
          <View style={st.legendItem}><Text style={[st.legendDot, { color: '#f87171' }]}>🔥</Text><Text style={st.legendLabel}>-40% deep value</Text></View>
          <View style={st.legendItem}><Text style={[st.legendDot, { color: '#4ade80' }]}>🟢</Text><Text style={st.legendLabel}>-20% good entry</Text></View>
          <View style={st.legendItem}><Text style={[st.legendDot, { color: '#f4c430' }]}>👀</Text><Text style={st.legendLabel}>-10% watching</Text></View>
        </View>

        {/* Position sizing info */}
        {totalPortfolio > 0 && (
          <View style={st.sizingInfo}>
            <Text style={st.sizingText}>
              💡 5% position = <Text style={st.sizingAmount}>${(totalPortfolio * 0.05).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              {' · '}2% = <Text style={st.sizingAmount}>${(totalPortfolio * 0.02).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </Text>
          </View>
        )}

        {/* Empty state */}
        {watchlist.length === 0 && (
          <View style={st.emptyState}>
            <Text style={st.emptyEmoji}>🎯</Text>
            <Text style={st.emptyTitle}>No coins on your watchlist</Text>
            <Text style={st.emptyBody}>
              Add coins you're interested in. We'll track prices and alert you when they drop into good entry zones.
            </Text>
            <TouchableOpacity style={st.emptyButton} onPress={() => setShowAddModal(true)}>
              <Text style={st.emptyButtonText}>+ Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Watchlist items */}
        {sortedWatchlist.map((token) => {
          const price = priceData[token.mint];
          const ext = extData[token.mint];
          if (!ext) return null;

          const currentPrice = price?.currentPrice ?? 0;
          const signal = getEntrySignal(ext, currentPrice);
          const dropFromAdd = ext.addedPrice > 0
            ? ((currentPrice - ext.addedPrice) / ext.addedPrice) * 100
            : 0;
          const maxPosition = totalPortfolio > 0
            ? (totalPortfolio * ext.maxAllocationPct / 100)
            : 0;

          const isEditing = editingMint === token.mint;

          return (
            <View key={token.mint} style={[st.card, { borderColor: signal.color + '30' }]}>
              <LinearGradient
                colors={[signal.bgColor, 'transparent']}
                style={st.cardGradient}
              >
                {/* Signal badge */}
                {signal.level !== 'none' && (
                  <View style={[st.signalBadge, { backgroundColor: signal.bgColor, borderColor: signal.color + '40' }]}>
                    <Text style={[st.signalText, { color: signal.color }]}>
                      {signal.emoji} {signal.label}
                    </Text>
                  </View>
                )}

                {/* Main info row */}
                <View style={st.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardSymbol}>{token.symbol}</Text>
                    <Text style={st.cardPrice}>
                      {currentPrice > 0
                        ? `$${currentPrice < 0.01 ? currentPrice.toExponential(2) : currentPrice.toLocaleString(undefined, { maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}`
                        : 'Loading...'}
                    </Text>
                  </View>
                  <View style={st.changesCol}>
                    {price?.change1h != null && (
                      <Text style={[st.changeText, { color: price.change1h >= 0 ? '#4ade80' : '#f87171' }]}>
                        1h: {price.change1h >= 0 ? '+' : ''}{price.change1h.toFixed(1)}%
                      </Text>
                    )}
                    {price?.change24h != null && (
                      <Text style={[st.changeText, { color: price.change24h >= 0 ? '#4ade80' : '#f87171' }]}>
                        24h: {price.change24h >= 0 ? '+' : ''}{price.change24h.toFixed(1)}%
                      </Text>
                    )}
                    {price?.change7d != null && (
                      <Text style={[st.changeText, { color: price.change7d >= 0 ? '#4ade80' : '#f87171' }]}>
                        7d: {price.change7d >= 0 ? '+' : ''}{price.change7d.toFixed(1)}%
                      </Text>
                    )}
                  </View>
                </View>

                {/* Drop from add price */}
                <View style={st.detailRow}>
                  <Text style={st.detailLabel}>Since added</Text>
                  <Text style={[st.detailValue, { color: dropFromAdd >= 0 ? '#4ade80' : '#f87171' }]}>
                    {dropFromAdd >= 0 ? '+' : ''}{dropFromAdd.toFixed(1)}%
                    {ext.addedPrice > 0 && ` (added at $${ext.addedPrice < 0.01 ? ext.addedPrice.toExponential(2) : ext.addedPrice.toLocaleString(undefined, { maximumFractionDigits: ext.addedPrice < 1 ? 6 : 2 })})`}
                  </Text>
                </View>

                {/* From ATH */}
                {price?.fromATH != null && price.fromATH < -5 && (
                  <View style={st.detailRow}>
                    <Text style={st.detailLabel}>From ATH</Text>
                    <Text style={[st.detailValue, { color: '#f87171' }]}>
                      {price.fromATH.toFixed(1)}%
                    </Text>
                  </View>
                )}

                {/* Entry targets */}
                <View style={st.targetsRow}>
                  <View style={[st.targetBox, currentPrice <= ext.entryTarget1 && { borderColor: '#4ade80', backgroundColor: '#4ade8015' }]}>
                    <Text style={st.targetLabel}>Entry 1 (-20%)</Text>
                    <Text style={[st.targetPrice, currentPrice <= ext.entryTarget1 && { color: '#4ade80' }]}>
                      ${ext.entryTarget1 < 0.01 ? ext.entryTarget1.toExponential(2) : ext.entryTarget1.toLocaleString(undefined, { maximumFractionDigits: ext.entryTarget1 < 1 ? 6 : 2 })}
                    </Text>
                    {currentPrice <= ext.entryTarget1 && <Text style={st.targetHit}>✓ HIT</Text>}
                  </View>
                  <View style={[st.targetBox, currentPrice <= ext.entryTarget2 && { borderColor: '#f87171', backgroundColor: '#f8717115' }]}>
                    <Text style={st.targetLabel}>Entry 2 (-40%)</Text>
                    <Text style={[st.targetPrice, currentPrice <= ext.entryTarget2 && { color: '#f87171' }]}>
                      ${ext.entryTarget2 < 0.01 ? ext.entryTarget2.toExponential(2) : ext.entryTarget2.toLocaleString(undefined, { maximumFractionDigits: ext.entryTarget2 < 1 ? 6 : 2 })}
                    </Text>
                    {currentPrice <= ext.entryTarget2 && <Text style={st.targetHit}>✓ HIT</Text>}
                  </View>
                </View>

                {/* Position sizing */}
                {maxPosition > 0 && (
                  <View style={st.detailRow}>
                    <Text style={st.detailLabel}>Max position ({ext.maxAllocationPct}%)</Text>
                    <Text style={st.detailValue}>${maxPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}

                {/* Exit plan */}
                <View style={st.exitRow}>
                  <View style={st.exitItem}>
                    <Text style={st.exitLabel}>Take profit</Text>
                    <Text style={[st.exitValue, { color: '#4ade80' }]}>+{ext.takeProfitPct}%</Text>
                  </View>
                  <View style={st.exitDivider} />
                  <View style={st.exitItem}>
                    <Text style={st.exitLabel}>Stop loss</Text>
                    <Text style={[st.exitValue, { color: '#f87171' }]}>{ext.stopLossPct}%</Text>
                  </View>
                </View>

                {/* Accumulation Plan */}
                <View style={{ marginTop: 10 }}>
                  <AccumulationPlanCard
                    mint={token.mint}
                    symbol={token.symbol}
                    currentPrice={currentPrice}
                    allTimeLow={null}
                  />
                </View>

                {/* Notes */}
                {ext.notes ? (
                  <View style={st.notesBox}>
                    <Text style={st.notesText}>📝 {ext.notes}</Text>
                  </View>
                ) : null}

                {/* Actions */}
                <View style={st.actionsRow}>
                  <TouchableOpacity style={st.editButton} onPress={() => setEditingMint(isEditing ? null : token.mint)}>
                    <Text style={st.editButtonText}>{isEditing ? '✕ Close' : '⚙️ Settings'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.removeButton} onPress={() => handleRemove(token.mint, token.symbol)}>
                    <Text style={st.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                {/* Inline settings editor */}
                {isEditing && (
                  <SettingsEditor
                    ext={ext}
                    onSave={(updates) => handleUpdateSettings(token.mint, updates)}
                    onCancel={() => setEditingMint(null)}
                  />
                )}
              </LinearGradient>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add Coin Modal ── */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Add Coin to Watchlist</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchQuery(''); setShowManual(false); }}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <TextInput
              style={st.searchInput}
              placeholder="Search by name or symbol..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />

            <ScrollView style={st.searchResults} showsVerticalScrollIndicator={false}>
              {/* Popular tokens */}
              {filteredPopular.map((token) => (
                <TouchableOpacity
                  key={token.mint}
                  style={st.searchItem}
                  onPress={() => handleAddCoin(token.mint, token.symbol, token.name)}
                >
                  <View>
                    <Text style={st.searchSymbol}>{token.symbol}</Text>
                    <Text style={st.searchName}>{token.name}</Text>
                  </View>
                  <Text style={st.searchAdd}>+ Add</Text>
                </TouchableOpacity>
              ))}

              {filteredPopular.length === 0 && !showManual && (
                <View style={st.noResults}>
                  <Text style={st.noResultsText}>No matches in popular tokens</Text>
                </View>
              )}
            </ScrollView>

            {/* Manual mint entry */}
            <TouchableOpacity style={st.manualToggle} onPress={() => setShowManual(!showManual)}>
              <Text style={st.manualToggleText}>{showManual ? '▾ Hide manual entry' : '▸ Add by mint address'}</Text>
            </TouchableOpacity>

            {showManual && (
              <View style={st.manualSection}>
                <TextInput
                  style={st.searchInput}
                  placeholder="Token symbol (e.g. BONK)"
                  placeholderTextColor="#666"
                  value={manualSymbol}
                  onChangeText={setManualSymbol}
                />
                <TextInput
                  style={[st.searchInput, { marginTop: 8 }]}
                  placeholder="Mint address"
                  placeholderTextColor="#666"
                  value={manualMint}
                  onChangeText={setManualMint}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[st.manualAddButton, (!manualMint || !manualSymbol) && { opacity: 0.4 }]}
                  onPress={() => manualMint && manualSymbol && handleAddCoin(manualMint.trim(), manualSymbol.trim().toUpperCase())}
                  disabled={!manualMint || !manualSymbol}
                >
                  <Text style={st.manualAddText}>+ Add Token</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Settings Editor Sub-component ────────────────────────────────

function SettingsEditor({ ext, onSave, onCancel }: {
  ext: WatchlistExt;
  onSave: (updates: Partial<WatchlistExt>) => void;
  onCancel: () => void;
}) {
  const [alloc, setAlloc] = useState(ext.maxAllocationPct.toString());
  const [tp, setTp] = useState(ext.takeProfitPct.toString());
  const [sl, setSl] = useState(Math.abs(ext.stopLossPct).toString());
  const [notes, setNotes] = useState(ext.notes);
  const [entry1, setEntry1] = useState(ext.entryTarget1.toString());
  const [entry2, setEntry2] = useState(ext.entryTarget2.toString());

  return (
    <View style={st.settingsBox}>
      <Text style={st.settingsTitle}>Position Settings</Text>

      <View style={st.settingsRow}>
        <View style={st.settingsField}>
          <Text style={st.settingsLabel}>Max allocation %</Text>
          <TextInput style={st.settingsInput} value={alloc} onChangeText={setAlloc} keyboardType="numeric" />
        </View>
        <View style={st.settingsField}>
          <Text style={st.settingsLabel}>Take profit %</Text>
          <TextInput style={st.settingsInput} value={tp} onChangeText={setTp} keyboardType="numeric" />
        </View>
        <View style={st.settingsField}>
          <Text style={st.settingsLabel}>Stop loss %</Text>
          <TextInput style={st.settingsInput} value={sl} onChangeText={setSl} keyboardType="numeric" />
        </View>
      </View>

      <View style={st.settingsRow}>
        <View style={[st.settingsField, { flex: 1 }]}>
          <Text style={st.settingsLabel}>Entry target 1 ($)</Text>
          <TextInput style={st.settingsInput} value={entry1} onChangeText={setEntry1} keyboardType="numeric" />
        </View>
        <View style={[st.settingsField, { flex: 1 }]}>
          <Text style={st.settingsLabel}>Entry target 2 ($)</Text>
          <TextInput style={st.settingsInput} value={entry2} onChangeText={setEntry2} keyboardType="numeric" />
        </View>
      </View>

      <Text style={st.settingsLabel}>Notes</Text>
      <TextInput
        style={[st.settingsInput, { minHeight: 60, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Why are you watching this coin?"
        placeholderTextColor="#555"
        multiline
      />

      <TouchableOpacity
        style={st.settingsSave}
        onPress={() => onSave({
          maxAllocationPct: parseFloat(alloc) || 5,
          takeProfitPct: parseFloat(tp) || 100,
          stopLossPct: -(parseFloat(sl) || 25),
          notes,
          entryTarget1: parseFloat(entry1) || ext.entryTarget1,
          entryTarget2: parseFloat(entry2) || ext.entryTarget2,
        })}
      >
        <Text style={st.settingsSaveText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18' },
  scroll: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, backgroundColor: '#080c18', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4c430', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  refreshButton: { backgroundColor: '#1a2040', borderRadius: 10, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a305060' },
  refreshButtonText: { fontSize: 20, color: '#f4c430' },
  addButton: { backgroundColor: '#f4c430', borderRadius: 10, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  addButtonText: { fontSize: 14, fontWeight: '700', color: '#080c18' },

  // Legend
  legend: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { fontSize: 12 },
  legendLabel: { fontSize: 11, color: '#888' },

  // Position sizing info
  sizingInfo: { backgroundColor: '#f4c43010', borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: '#f4c43020' },
  sizingText: { fontSize: 12, color: '#b0b0b8' },
  sizingAmount: { color: '#f4c430', fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 300 },
  emptyButton: { backgroundColor: '#f4c430', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  emptyButtonText: { fontSize: 16, fontWeight: '700', color: '#080c18' },

  // Card
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
  cardGradient: { padding: 16 },

  // Signal badge
  signalBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  signalText: { fontSize: 12, fontWeight: '700' },

  // Card main row
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardSymbol: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  cardPrice: { fontSize: 16, color: '#b0b0b8', fontWeight: '600' },
  changesCol: { alignItems: 'flex-end', gap: 2 },
  changeText: { fontSize: 12, fontWeight: '600' },

  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: '#888' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#b0b0b8' },

  // Entry targets
  targetsRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  targetBox: { flex: 1, backgroundColor: '#1a204060', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2a305040', alignItems: 'center' },
  targetLabel: { fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  targetPrice: { fontSize: 14, fontWeight: '700', color: '#b0b0b8' },
  targetHit: { fontSize: 10, fontWeight: '700', color: '#4ade80', marginTop: 4 },

  // Exit plan
  exitRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6, backgroundColor: '#0c102080', borderRadius: 10, padding: 10 },
  exitItem: { flex: 1, alignItems: 'center' },
  exitDivider: { width: 1, height: 24, backgroundColor: '#2a305060' },
  exitLabel: { fontSize: 10, color: '#888', marginBottom: 2, textTransform: 'uppercase' },
  exitValue: { fontSize: 15, fontWeight: '700' },

  // Notes
  notesBox: { backgroundColor: '#f4c43010', borderRadius: 8, padding: 8, marginTop: 4 },
  notesText: { fontSize: 12, color: '#b0b0b8', fontStyle: 'italic' },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editButton: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', alignItems: 'center' },
  editButtonText: { fontSize: 13, color: '#b0b0b8', fontWeight: '600' },
  removeButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#f8717130', alignItems: 'center' },
  removeButtonText: { fontSize: 13, color: '#f87171', fontWeight: '600' },

  // Settings editor
  settingsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a305040' },
  settingsTitle: { fontSize: 14, fontWeight: '700', color: '#f4c430', marginBottom: 10 },
  settingsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  settingsField: { flex: 1 },
  settingsLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  settingsInput: { backgroundColor: '#0c1020', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a305060' },
  settingsSave: { backgroundColor: '#f4c430', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  settingsSaveText: { fontSize: 14, fontWeight: '700', color: '#080c18' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0c1020', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430' },
  modalClose: { fontSize: 24, color: '#888', padding: 4 },

  // Search
  searchInput: { backgroundColor: '#080c18', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3050' },
  searchResults: { maxHeight: 300, marginTop: 12 },
  searchItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#1a204040' },
  searchSymbol: { fontSize: 16, fontWeight: '700', color: '#fff' },
  searchName: { fontSize: 12, color: '#888', marginTop: 2 },
  searchAdd: { fontSize: 14, fontWeight: '700', color: '#4ade80' },
  noResults: { padding: 20, alignItems: 'center' },
  noResultsText: { fontSize: 14, color: '#888' },

  // Manual entry
  manualToggle: { paddingVertical: 12 },
  manualToggleText: { fontSize: 14, color: '#f4c430', fontWeight: '600' },
  manualSection: { marginTop: 4 },
  manualAddButton: { backgroundColor: '#4ade80', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  manualAddText: { fontSize: 15, fontWeight: '700', color: '#080c18' },
});
