// app/watchlist.tsx
// ══════════════════════════════════════════════════════════════════
// Coin Watchlist — track all coins you hold + coins you're watching.
// Shows price performance, and for movers suggests swapping from
// underperforming coins or buying with available funds.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Platform, Alert as RNAlert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import { useStore } from '../src/store/useStore';
import { useWallet } from '../src/providers/wallet-provider';
import {
  getSwapQuote, executeSwap, isSwapConfigured,
  fetchMintDecimals, fetchLiveBalances, MINTS,
} from '../src/services/jupiterSwap';
import { useSwapToast } from '../src/components/SwapToast';
import { postSwapUpdate } from '../src/utils/postSwapUpdate';
import { parseNumber } from '../src/utils/parseNumber';
import {
  fetchPrices, recordPriceSnapshot, getTokenPriceData,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  type TokenPriceData, type WatchlistToken,
} from '../src/services/priceTracker';
import { log, warn, error as logError } from '@/utils/logger';
import { lookupToken } from '../src/utils/tokenRegistry';

// ── Cross-platform alert ──────────────────────────────────────────
function alert(title: string, msg?: string) {
  if (Platform.OS === 'web') window.alert(msg ? `${title}\n\n${msg}` : title);
  else RNAlert.alert(title, msg);
}
function confirm(title: string, msg: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${msg}`)) onYes(); }
  else RNAlert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: onYes }]);
}

// ── Price formatting — no scientific notation ─────────────────────
function formatPrice(p: number): string {
  if (p <= 0) return '$0.00';
  if (p < 0.000001) {
    const sig = p.toPrecision(2);
    return '$' + parseFloat(sig).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (p < 0.0001) return '$' + p.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 0.01) return '$' + p.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 1) return '$' + p.toFixed(4);
  if (p < 1000) return '$' + p.toFixed(2);
  return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
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

// ── Stablecoins — for identifying "available to buy with" ────────
const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'PYUSD', 'USD*', 'USDS', 'DAI']);
const SOL_MINT = 'So11111111111111111111111111111111111111112';

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
  if (dropFromAdd >= 25) return {
    level: 'strong', label: `Up ${dropFromAdd.toFixed(0)}% — strong move`, emoji: '🚀',
    color: '#4ade80', bgColor: '#4ade8020',
  };
  if (dropFromAdd >= 10) return {
    level: 'interesting', label: `Up ${dropFromAdd.toFixed(0)}% since added`, emoji: '📈',
    color: '#f4c430', bgColor: '#f4c43020',
  };
  return {
    level: 'none', label: 'Tracking', emoji: '📊',
    color: '#888', bgColor: '#88888815',
  };
}

// ── Identify underperforming coins and available funds ────────────

interface FundingOption {
  assetId: string;
  symbol: string;
  mint: string;
  value: number;
  change24h: number | null;
  type: 'stablecoin' | 'underperformer' | 'sol';
  label: string;
}

function findFundingOptions(
  assets: any[],
  priceData: Record<string, TokenPriceData>,
  excludeMint: string,
): FundingOption[] {
  const options: FundingOption[] = [];

  for (const asset of assets) {
    // Include any asset with a mint address (covers crypto, defi, brokerage-mapped commodity tokens)
    if (!(asset.metadata as any)?.tokenMint && !(asset.metadata as any)?.mint) continue;
    const meta = asset.metadata as any;
    const mint = meta?.tokenMint || meta?.mint || '';
    if (!mint || mint === excludeMint) continue;
    if (asset.value < 1) continue; // skip dust

    const symbol = (meta?.symbol || asset.name || '').toUpperCase();
    const pd = priceData[mint];

    if (STABLECOIN_SYMBOLS.has(symbol)) {
      options.push({
        assetId: asset.id,
        symbol,
        mint,
        value: asset.value,
        change24h: 0,
        type: 'stablecoin',
        label: `${formatUSD(asset.value)} ${symbol} available`,
      });
    } else if (mint === SOL_MINT) {
      options.push({
        assetId: asset.id,
        symbol: 'SOL',
        mint,
        value: asset.value,
        change24h: pd?.change24h ?? null,
        type: 'sol',
        label: `${formatUSD(asset.value)} SOL`,
      });
    } else if (pd && pd.change24h != null && pd.change24h < -5) {
      options.push({
        assetId: asset.id,
        symbol: meta?.symbol || asset.name,
        mint,
        value: asset.value,
        change24h: pd.change24h,
        type: 'underperformer',
        label: `${meta?.symbol || asset.name} ${formatUSD(asset.value)} (${pd.change24h.toFixed(1)}% 24h)`,
      });
    }
  }

  // Sort: stablecoins first, then SOL, then worst performers
  options.sort((a, b) => {
    const rank = { stablecoin: 0, sol: 1, underperformer: 2 };
    if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type];
    return (a.change24h ?? 0) - (b.change24h ?? 0); // worst first for underperformers
  });

  return options.slice(0, 5);
}

function formatUSD(v: number): string {
  if (v >= 1000) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4);
}

// ── Main Component ───────────────────────────────────────────────

export default function WatchlistScreen() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const assets = useStore(s => s.assets);
  const { connected, publicKey, signTransaction, signAndSendTransaction } = useWallet();
  const { showToast, ToastComponent } = useSwapToast();
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
  const [expandedMint, setExpandedMint] = useState<string | null>(null);

  // ── Inline swap modal state ──
  const [swapModal, setSwapModal] = useState<{
    targetMint: string;
    targetSymbol: string;
    sourceMint: string;
    sourceSymbol: string;
  } | null>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [swapBalance, setSwapBalance] = useState<number | null>(null);
  const [swapQuote, setSwapQuote] = useState<string | null>(null);
  const [swapQuoting, setSwapQuoting] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const swapDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-add all held crypto tokens to watchlist
  const autoTrackHeldCoins = useCallback(async (currentWatchlist: WatchlistToken[]) => {
    const watchedMints = new Set(currentWatchlist.map(t => t.mint));
    // Include any asset that has a Solana mint address (crypto, defi, brokerage/commodity tokens)
    const cryptoAssets = assets.filter(a => {
      if (a.value <= 0.5) return false;
      const meta = a.metadata as any;
      const hasMint = !!(meta?.tokenMint || meta?.mint);
      return hasMint;
    });

    let added = 0;
    for (const asset of cryptoAssets) {
      const meta = asset.metadata as any;
      const mint = meta?.tokenMint || meta?.mint || '';
      const symbol = meta?.symbol || asset.name || '';
      if (!mint || mint.length < 10 || watchedMints.has(mint)) continue;
      // Skip stablecoins
      if (STABLECOIN_SYMBOLS.has(symbol.toUpperCase())) continue;

      await addToWatchlist(mint, symbol);

      // Create ext data with current price as the added price
      const prices = await fetchPrices([mint]);
      const currentPrice = prices[mint] || (meta?.priceUSD || 0);
      if (currentPrice > 0) {
        const ext = await loadExtData();
        if (!ext[mint]) {
          ext[mint] = {
            mint,
            addedPrice: currentPrice,
            entryTarget1: currentPrice * 0.8,
            entryTarget2: currentPrice * 0.6,
            maxAllocationPct: 5,
            takeProfitPct: 100,
            stopLossPct: -25,
            notes: '',
          };
          await saveExtData(ext);
        }
      }
      added++;
    }
    if (added > 0) log(`[WATCHLIST] Auto-added ${added} held coins to watchlist`);
    return added;
  }, [assets]);

  // Load watchlist and prices
  const loadData = useCallback(async () => {
    try {
      let wl = await getWatchlist();

      // Fix stale mints: map old wrong mints to correct ones
      const MINT_FIXES: Record<string, string> = {
        'SKRy1C6Smucp4Wz2MPnKgvDRFgDHraoskMJH3a2fMec': 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
        'SKRy4ABKZ3dFJEmb47aNqWoMnajpVnFozTPCiZD3eHv': 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
      };
      let fixedAny = false;
      for (const token of wl) {
        if (MINT_FIXES[token.mint]) {
          log(`[WATCHLIST] Fixing stale mint for ${token.symbol}: ${token.mint.slice(0, 8)} → ${MINT_FIXES[token.mint].slice(0, 8)}`);
          await removeFromWatchlist(token.mint);
          await addToWatchlist(MINT_FIXES[token.mint], token.symbol);
          fixedAny = true;
        }
      }
      if (fixedAny) {
        wl = await getWatchlist();
        // Migrate ext data to new mints
        const ext = await loadExtData();
        let extChanged = false;
        for (const [oldMint, newMint] of Object.entries(MINT_FIXES)) {
          if (ext[oldMint] && !ext[newMint]) {
            ext[newMint] = { ...ext[oldMint], mint: newMint };
            delete ext[oldMint];
            extChanged = true;
          }
        }
        if (extChanged) await saveExtData(ext);
      }

      // Auto-add held coins that aren't tracked yet
      const addedCount = await autoTrackHeldCoins(wl);
      if (addedCount > 0) wl = await getWatchlist();

      const ext = await loadExtData();
      setWatchlist(wl);
      setExtData(ext);

      if (wl.length > 0) {
        const mints = wl.map(t => t.mint);
        const symbolMap: Record<string, string> = {};
        wl.forEach(t => { symbolMap[t.mint] = t.symbol; });

        // Also get prices for all wallet tokens (for funding options)
        const walletMints = assets
          .filter(a => !!(a.metadata as any)?.tokenMint || !!(a.metadata as any)?.mint)
          .map(a => {
            const m = a.metadata as any;
            return m?.tokenMint || m?.mint || '';
          })
          .filter(m => m && m.length > 10);

        const allMints = [...new Set([...mints, ...walletMints])];
        const allSymbolMap = { ...symbolMap };
        for (const asset of assets) {
          const m = (asset.metadata as any)?.tokenMint || (asset.metadata as any)?.mint;
          if (m) allSymbolMap[m] = (asset.metadata as any)?.symbol || asset.name;
        }

        await recordPriceSnapshot(allMints, allSymbolMap);
        const pd = await getTokenPriceData(allMints, allSymbolMap);
        setPriceData(pd);
      }
    } catch (err) {
      logError('Watchlist load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [autoTrackHeldCoins, assets]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Add coin
  const handleAddCoin = async (mint: string, symbol: string, name?: string) => {
    const prices = await fetchPrices([mint]);
    const currentPrice = prices[mint] || 0;

    await addToWatchlist(mint, symbol, name);

    const ext: WatchlistExt = {
      mint,
      addedPrice: currentPrice,
      entryTarget1: currentPrice * 0.8,
      entryTarget2: currentPrice * 0.6,
      maxAllocationPct: 5,
      takeProfitPct: 100,
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

  // Check if the user holds this coin
  const getHeldAsset = useCallback((mint: string) => {
    return assets.find(a => {
      const m = (a.metadata as any)?.tokenMint || (a.metadata as any)?.mint;
      return m === mint && a.value > 0;
    });
  }, [assets]);

  // ── Inline swap helpers ──
  const SWAP_PCTS = [25, 50, 75, 100] as const;

  const openSwapModal = useCallback(async (targetMint: string, targetSymbol: string, sourceMint: string, sourceSymbol: string) => {
    setSwapModal({ targetMint, targetSymbol, sourceMint, sourceSymbol });
    setSwapAmount('');
    setSwapQuote(null);
    setSwapError(null);
    setSwapBalance(null);

    if (connected && publicKey) {
      try {
        const { tokenBalance, solBalance } = await fetchLiveBalances(publicKey.toBase58(), sourceMint);
        setSwapBalance(sourceMint === MINTS.SOL ? solBalance : tokenBalance);
      } catch {}
    }
  }, [connected, publicKey]);

  const closeSwapModal = () => {
    setSwapModal(null);
    setSwapAmount('');
    setSwapQuote(null);
    setSwapError(null);
    setSwapBalance(null);
  };

  // Auto-quote when amount changes
  useEffect(() => {
    if (swapDebounce.current) clearTimeout(swapDebounce.current);
    setSwapQuote(null);
    setSwapError(null);

    const num = parseNumber(swapAmount) || 0;
    if (!swapModal || num <= 0 || !connected || !publicKey) return;

    setSwapQuoting(true);
    swapDebounce.current = setTimeout(async () => {
      try {
        const inputDecimals = await fetchMintDecimals(swapModal.sourceMint);
        const quote = await getSwapQuote({
          inputMint: swapModal.sourceMint,
          outputMint: swapModal.targetMint,
          amount: num,
          inputDecimals,
          userPublicKey: publicKey.toBase58(),
          slippageBps: 100,
        });
        const outDecimals = await fetchMintDecimals(swapModal.targetMint);
        const outAmount = parseInt(quote.outAmount) / Math.pow(10, outDecimals);
        setSwapQuote(`~${outAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${swapModal.targetSymbol}`);
      } catch (e: any) {
        setSwapError(e.message?.slice(0, 60) || 'Quote failed');
      } finally {
        setSwapQuoting(false);
      }
    }, 500);

    return () => { if (swapDebounce.current) clearTimeout(swapDebounce.current); };
  }, [swapAmount, swapModal, connected, publicKey]);

  const handleSwapExecute = useCallback(async () => {
    const num = parseNumber(swapAmount) || 0;
    if (!swapModal || num <= 0 || !connected || !publicKey) return;

    setSwapLoading(true);
    setSwapError(null);
    showToast({ type: 'loading', symbol: swapModal.targetSymbol, percentage: 0 });

    try {
      const walletAddr = publicKey.toBase58();
      const { solBalance } = await fetchLiveBalances(walletAddr);
      if (solBalance < 0.005) {
        setSwapLoading(false);
        return alert('Not enough SOL', `You need ~0.005 SOL for fees. You have ${solBalance.toFixed(6)} SOL.`);
      }

      const inputDecimals = await fetchMintDecimals(swapModal.sourceMint);
      const result = await executeSwap(
        {
          inputMint: swapModal.sourceMint,
          outputMint: swapModal.targetMint,
          amount: num,
          inputDecimals,
          userPublicKey: walletAddr,
          slippageBps: 100,
        },
        signTransaction,
        signAndSendTransaction,
      );

      if (result.success) {
        showToast({ type: 'success', symbol: swapModal.targetSymbol, usdReceived: num, signature: result.signature || '' });
        closeSwapModal();
        // Refresh prices after swap
        setTimeout(() => loadData(), 3000);
      } else if (result.error !== 'Transaction cancelled by user') {
        showToast({ type: 'error', message: result.error || 'Swap failed' });
        setSwapError(result.error || 'Swap failed');
      } else {
        showToast({ type: 'error', message: 'Transaction cancelled.' });
      }
    } catch (e: any) {
      setSwapError(e.message || 'Swap failed');
    } finally {
      setSwapLoading(false);
    }
  }, [swapAmount, swapModal, connected, publicKey, signTransaction, signAndSendTransaction]);

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
      {/* KingMe branded header */}
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

      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Watchlist sub-header */}
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

          // Fall back to store asset price if Jupiter/DexScreener didn't return one
          let currentPrice = price?.currentPrice ?? 0;
          if (currentPrice <= 0) {
            const storeAsset = assets.find(a => {
              const m = (a.metadata as any)?.tokenMint || (a.metadata as any)?.mint;
              return m === token.mint;
            });
            if (storeAsset) currentPrice = (storeAsset.metadata as any)?.priceUSD || 0;
          }
          const signal = getEntrySignal(ext, currentPrice);
          const dropFromAdd = ext.addedPrice > 0
            ? ((currentPrice - ext.addedPrice) / ext.addedPrice) * 100
            : 0;

          const isEditing = editingMint === token.mint;
          const isExpanded = expandedMint === token.mint;
          const heldAsset = getHeldAsset(token.mint);
          const fundingOptions = isExpanded ? findFundingOptions(assets, priceData, token.mint) : [];
          const totalAvailable = fundingOptions.reduce((sum, f) => sum + f.value, 0);

          return (
            <TouchableOpacity
              key={token.mint}
              style={[st.card, { borderColor: signal.color + '30' }]}
              onPress={() => setExpandedMint(isExpanded ? null : token.mint)}
              activeOpacity={0.85}
            >
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

                {/* Held badge */}
                {heldAsset && (
                  <TouchableOpacity
                    style={st.heldBadge}
                    onPress={() => router.push(`/asset/${heldAsset.id}` as any)}
                  >
                    <Text style={st.heldBadgeText}>
                      💰 Holding {formatUSD(heldAsset.value)}
                      {(heldAsset.metadata as any)?.quantity ? ` · ${((heldAsset.metadata as any).quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token.symbol}` : ''}
                      {' →'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Main info row */}
                <View style={st.cardRow}>
                  {(() => {
                    const logo = lookupToken(token.symbol)?.logoURI;
                    return logo ? (
                      <Image source={{ uri: logo }} style={st.coinLogo} />
                    ) : (
                      <View style={st.coinLogoPlaceholder}>
                        <Text style={st.coinLogoText}>{token.symbol[0]}</Text>
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardSymbol}>{token.symbol}</Text>
                    <Text style={st.cardPrice}>
                      {currentPrice > 0 ? formatPrice(currentPrice) : 'Loading...'}
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
                    {ext.addedPrice > 0 && ` (added at ${formatPrice(ext.addedPrice)})`}
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

                {/* ── Expanded: Funding Options ── */}
                {isExpanded && (
                  <View style={st.fundingSection}>
                    {/* If coin is up — suggest buying more or taking profit */}
                    {dropFromAdd >= 10 && heldAsset && (
                      <View style={st.insightBox}>
                        <Text style={st.insightText}>
                          📈 Up {dropFromAdd.toFixed(0)}% since added — you hold {formatUSD(heldAsset.value)}
                        </Text>
                      </View>
                    )}

                    {/* Available funds to buy */}
                    {fundingOptions.length > 0 && (
                      <>
                        <Text style={st.fundingTitle}>
                          {dropFromAdd < 0 ? '💰 Fund a buy' : '💰 Add to position'}
                        </Text>

                        {/* Available stables / SOL */}
                        {fundingOptions.filter(f => f.type === 'stablecoin' || f.type === 'sol').length > 0 && (
                          <View style={st.fundingGroup}>
                            <Text style={st.fundingGroupLabel}>Available funds</Text>
                            {fundingOptions.filter(f => f.type === 'stablecoin' || f.type === 'sol').map(f => (
                              <TouchableOpacity
                                key={f.assetId}
                                style={st.fundingRow}
                                onPress={() => openSwapModal(token.mint, token.symbol, f.mint, f.symbol)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={st.fundingSymbol}>{f.symbol}</Text>
                                  <Text style={st.fundingValue}>{formatUSD(f.value)}</Text>
                                </View>
                                <Text style={st.fundingAction}>Buy {token.symbol} →</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Underperforming coins to swap from */}
                        {fundingOptions.filter(f => f.type === 'underperformer').length > 0 && (
                          <View style={st.fundingGroup}>
                            <Text style={st.fundingGroupLabel}>Swap from underperformers</Text>
                            {fundingOptions.filter(f => f.type === 'underperformer').map(f => (
                              <TouchableOpacity
                                key={f.assetId}
                                style={st.fundingRow}
                                onPress={() => openSwapModal(token.mint, token.symbol, f.mint, f.symbol)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={st.fundingSymbol}>{f.symbol}</Text>
                                  <Text style={st.fundingValue}>
                                    {formatUSD(f.value)}
                                    <Text style={{ color: '#f87171' }}> ({f.change24h?.toFixed(1)}% 24h)</Text>
                                  </Text>
                                </View>
                                <Text style={st.fundingAction}>Buy {token.symbol} →</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        <Text style={st.fundingTotal}>
                          Total available: {formatUSD(totalAvailable)}
                        </Text>
                      </>
                    )}

                    {fundingOptions.length === 0 && (
                      <View style={st.insightBox}>
                        <Text style={st.insightText}>
                          No available funds or underperforming coins to swap from right now.
                        </Text>
                      </View>
                    )}

                    {/* Quick nav to asset if held */}
                    {heldAsset && (
                      <TouchableOpacity
                        style={st.viewAssetButton}
                        onPress={() => router.push(`/asset/${heldAsset.id}` as any)}
                      >
                        <Text style={st.viewAssetText}>📊 View {token.symbol} · Set thesis & targets →</Text>
                      </TouchableOpacity>
                    )}

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
                  </View>
                )}

                {/* Tap hint when collapsed */}
                {!isExpanded && (
                  <Text style={st.tapHint}>Tap for options</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
        <KingMeFooter />
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
              {filteredPopular.map((token) => {
                const logo = lookupToken(token.symbol)?.logoURI;
                return (
                <TouchableOpacity
                  key={token.mint}
                  style={st.searchItem}
                  onPress={() => handleAddCoin(token.mint, token.symbol, token.name)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {logo ? (
                      <Image source={{ uri: logo }} style={st.coinLogo} />
                    ) : (
                      <View style={st.coinLogoPlaceholder}>
                        <Text style={st.coinLogoText}>{token.symbol[0]}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={st.searchSymbol}>{token.symbol}</Text>
                      <Text style={st.searchName}>{token.name}</Text>
                    </View>
                  </View>
                  <Text style={st.searchAdd}>+ Add</Text>
                </TouchableOpacity>
                );
              })}

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

      {/* ── Inline Swap Modal ── */}
      <Modal visible={!!swapModal} animationType="fade" transparent onRequestClose={closeSwapModal}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>
                Buy {swapModal?.targetSymbol} with {swapModal?.sourceSymbol}
              </Text>
              <TouchableOpacity onPress={closeSwapModal}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Balance */}
            {swapBalance !== null && (
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                Available: {swapBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {swapModal?.sourceSymbol}
              </Text>
            )}

            {/* Amount input */}
            <TextInput
              style={st.searchInput}
              placeholder={`Amount in ${swapModal?.sourceSymbol || ''}...`}
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={swapAmount}
              onChangeText={setSwapAmount}
              autoFocus
            />

            {/* Percentage buttons */}
            {swapBalance !== null && swapBalance > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }}>
                {SWAP_PCTS.map(pct => (
                  <TouchableOpacity
                    key={pct}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 8,
                      backgroundColor: '#1a1f2e', alignItems: 'center',
                    }}
                    onPress={() => {
                      const factor = pct === 100 ? 0.999 : pct / 100;
                      setSwapAmount((swapBalance * factor).toString());
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#60a5fa' }}>
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quote output */}
            {swapQuoting && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <ActivityIndicator size="small" color="#60a5fa" />
                <Text style={{ color: '#888', fontSize: 13 }}>Getting quote...</Text>
              </View>
            )}
            {swapQuote && (
              <View style={{ backgroundColor: '#4ade8015', borderRadius: 10, padding: 12, marginTop: 8 }}>
                <Text style={{ color: '#4ade80', fontSize: 16, fontWeight: '700' }}>
                  You receive: {swapQuote}
                </Text>
              </View>
            )}
            {swapError && (
              <View style={{ backgroundColor: '#f8717115', borderRadius: 10, padding: 12, marginTop: 8 }}>
                <Text style={{ color: '#f87171', fontSize: 13 }}>{swapError}</Text>
              </View>
            )}

            {/* Wallet warning */}
            {!connected && (
              <Text style={{ color: '#f4c430', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
                Connect wallet to swap
              </Text>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' }}
                onPress={closeSwapModal}
                disabled={swapLoading}
              >
                <Text style={{ color: '#888', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                  backgroundColor: '#60a5fa',
                  opacity: (!connected || swapLoading || !(parseNumber(swapAmount) > 0)) ? 0.4 : 1,
                }}
                onPress={handleSwapExecute}
                disabled={!connected || swapLoading || !(parseNumber(swapAmount) > 0)}
              >
                {swapLoading ? (
                  <ActivityIndicator size="small" color="#0a0e1a" />
                ) : (
                  <Text style={{ color: '#0a0e1a', fontSize: 15, fontWeight: '800' }}>
                    Swap
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 8 }}>
              Powered by Jupiter · 1% slippage
            </Text>
          </View>
        </View>
      </Modal>

      <ToastComponent />
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
          maxAllocationPct: parseNumber(alloc) || 5,
          takeProfitPct: parseNumber(tp) || 100,
          stopLossPct: -(parseNumber(sl) || 25),
          notes,
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
  signalBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  signalText: { fontSize: 12, fontWeight: '700' },

  // Held badge
  heldBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#4ade8015', borderWidth: 1, borderColor: '#4ade8030', marginBottom: 8 },
  heldBadgeText: { fontSize: 11, fontWeight: '600', color: '#4ade80' },

  // Card main row
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  coinLogo: { width: 32, height: 32, borderRadius: 16 },
  coinLogoPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2f3e', justifyContent: 'center', alignItems: 'center' },
  coinLogoText: { fontSize: 14, fontWeight: 'bold', color: '#60a5fa' },
  cardSymbol: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  cardPrice: { fontSize: 16, color: '#b0b0b8', fontWeight: '600' },
  changesCol: { alignItems: 'flex-end', gap: 2 },
  changeText: { fontSize: 12, fontWeight: '600' },

  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: '#888' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#b0b0b8' },

  // Tap hint
  tapHint: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8 },

  // Funding section
  fundingSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a305040' },
  fundingTitle: { fontSize: 15, fontWeight: '700', color: '#f4c430', marginBottom: 10 },
  fundingGroup: { marginBottom: 12 },
  fundingGroupLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fundingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c102080', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#2a305040' },
  fundingSymbol: { fontSize: 14, fontWeight: '700', color: '#fff' },
  fundingValue: { fontSize: 12, color: '#b0b0b8', marginTop: 2 },
  fundingAction: { fontSize: 13, fontWeight: '700', color: '#f4c430' },
  fundingTotal: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 8 },

  // Insight box
  insightBox: { backgroundColor: '#f4c43010', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f4c43020' },
  insightText: { fontSize: 12, color: '#b0b0b8', lineHeight: 18 },

  // View asset button
  viewAssetButton: { backgroundColor: '#4ade8020', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#4ade8030' },
  viewAssetText: { fontSize: 14, fontWeight: '700', color: '#4ade80' },

  // Notes
  notesBox: { backgroundColor: '#f4c43010', borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 8 },
  notesText: { fontSize: 12, color: '#b0b0b8', fontStyle: 'italic' },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
