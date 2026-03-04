// src/providers/wallet-provider.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Multi-wallet provider for Solana.
// Web: Detects installed browser extensions (Phantom, Solflare, Backpack, etc.)
// Mobile: Uses MWA which natively supports any compatible wallet app.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { PublicKey } from '@solana/web3.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectedWallet {
  id: string;
  name: string;
  icon: string;       // emoji or image URL
  installed: boolean;
  adapter: any;       // the window.xxx object
}

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletName: string | null;        // which wallet is active
  detectedWallets: DetectedWallet[];
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}

// ─── Web Wallet Detection ────────────────────────────────────────────────────
// Each Solana wallet extension injects at a known window property.
// They all implement a similar API: connect(), signMessage(), signTransaction(), etc.

const WALLET_REGISTRY = [
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    detect: () => (globalThis as any)?.phantom?.solana || (globalThis as any)?.solana,
    isPhantom: (adapter: any) => adapter?.isPhantom === true,
  },
  {
    id: 'solflare',
    name: 'Solflare',
    icon: '🔆',
    detect: () => (globalThis as any)?.solflare,
    isPhantom: () => false,
  },
  {
    id: 'backpack',
    name: 'Backpack',
    icon: '🎒',
    detect: () => (globalThis as any)?.backpack || (globalThis as any)?.xnft?.solana,
    isPhantom: () => false,
  },
  {
    id: 'magiceden',
    name: 'Magic Eden',
    icon: '🪄',
    detect: () => (globalThis as any)?.magicEden?.solana,
    isPhantom: () => false,
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    icon: '🔵',
    detect: () => (globalThis as any)?.coinbaseSolana,
    isPhantom: () => false,
  },
  {
    id: 'exodus',
    name: 'Exodus',
    icon: '🟣',
    detect: () => (globalThis as any)?.exodus?.solana,
    isPhantom: () => false,
  },
  {
    id: 'brave',
    name: 'Brave Wallet',
    icon: '🦁',
    detect: () => {
      const sol = (globalThis as any)?.solana;
      return sol?.isBraveWallet ? sol : null;
    },
    isPhantom: () => false,
  },
];

function detectWebWallets(): DetectedWallet[] {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return [];

  const detected: DetectedWallet[] = [];
  const seen = new Set<string>();

  for (const entry of WALLET_REGISTRY) {
    try {
      const adapter = entry.detect();
      if (adapter && !seen.has(entry.id)) {
        // Phantom also injects as window.solana — deduplicate
        // If the adapter is Phantom but we're checking a non-Phantom entry, skip
        if (entry.id !== 'phantom' && adapter.isPhantom) continue;
        // If it's the generic brave check and it's actually Phantom
        if (entry.id === 'brave' && adapter.isPhantom) continue;

        seen.add(entry.id);
        detected.push({
          id: entry.id,
          name: entry.name,
          icon: adapter.icon || entry.icon,
          installed: true,
          adapter,
        });
      }
    } catch {}
  }

  return detected;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [activeAdapter, setActiveAdapter] = useState<any>(null);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Detect wallets on mount (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Wallets inject asynchronously — check after a short delay
    const detect = () => {
      const wallets = detectWebWallets();
      setDetectedWallets(wallets);

      // Auto-reconnect if a wallet is already connected
      for (const w of wallets) {
        if (w.adapter?.isConnected && w.adapter?.publicKey) {
          setConnected(true);
          setPublicKey(new PublicKey(w.adapter.publicKey.toString()));
          setActiveAdapter(w.adapter);
          setWalletName(w.name);
          break;
        }
      }
    };

    // Detect immediately, then again after extensions have had time to inject
    detect();
    const t = setTimeout(detect, 500);
    return () => clearTimeout(t);
  }, []);

  // Listen for connect/disconnect events on active adapter (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !activeAdapter) return;

    const onConnect = (pk: any) => {
      console.log(`[Wallet] ${walletName} connected:`, pk?.toString());
      setConnected(true);
      if (pk) setPublicKey(new PublicKey(pk.toString()));
    };

    const onDisconnect = () => {
      console.log(`[Wallet] ${walletName} disconnected`);
      setConnected(false);
      setPublicKey(null);
      setActiveAdapter(null);
      setWalletName(null);
    };

    try {
      activeAdapter.on?.('connect', onConnect);
      activeAdapter.on?.('disconnect', onDisconnect);
    } catch {}

    return () => {
      try {
        activeAdapter.removeListener?.('connect', onConnect);
        activeAdapter.removeListener?.('disconnect', onDisconnect);
      } catch {}
    };
  }, [activeAdapter, walletName]);

  // ── Connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async (walletId?: string) => {
    if (connected || connecting) return;
    setConnecting(true);

    try {
      if (Platform.OS === 'web') {
        // Find the requested wallet, or show picker if multiple available
        let wallet: DetectedWallet | undefined;
        const current = detectedWallets.length > 0 ? detectedWallets : detectWebWallets();

        if (walletId) {
          wallet = current.find(w => w.id === walletId);
        } else if (current.length === 1) {
          // Only one wallet — just use it
          wallet = current[0];
        } else if (current.length > 1) {
          // Multiple wallets — show picker
          setDetectedWallets(current);
          setShowPicker(true);
          setConnecting(false);
          return;
        }

        if (!wallet) {
          throw new Error(
            current.length === 0
              ? 'No Solana wallet found. Install Phantom, Solflare, or another Solana wallet.'
              : `Wallet "${walletId}" not found`
          );
        }

        const resp = await wallet.adapter.connect();
        const pk = resp?.publicKey || wallet.adapter.publicKey;
        setConnected(true);
        setPublicKey(new PublicKey(pk.toString()));
        setActiveAdapter(wallet.adapter);
        setWalletName(wallet.name);
        setShowPicker(false);

        console.log(`[Wallet] Connected to ${wallet.name}:`, pk.toString());
      }
    } catch (error: any) {
      console.error('[Wallet] Connection failed:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [connected, connecting, detectedWallets]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (activeAdapter) {
      try { activeAdapter.disconnect(); } catch {}
    }
    setConnected(false);
    setPublicKey(null);
    setActiveAdapter(null);
    setWalletName(null);
    console.log('[Wallet] Disconnected');
  }, [activeAdapter]);

  // ── Sign Message ───────────────────────────────────────────────────────────

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');
    if (!activeAdapter) throw new Error('No active wallet adapter');

    try {
      const result = await activeAdapter.signMessage(message, 'utf8');
      return result.signature || result;
    } catch (error: any) {
      console.error('[Wallet] Signing failed:', error);
      throw error;
    }
  }, [connected, publicKey, activeAdapter]);

  // ── Sign Transaction ───────────────────────────────────────────────────────

  const signTransaction = useCallback(async (transaction: any): Promise<any> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');
    if (!activeAdapter) throw new Error('No active wallet adapter');

    try {
      return await activeAdapter.signTransaction(transaction);
    } catch (error: any) {
      console.error('[Wallet] Transaction signing failed:', error);
      throw error;
    }
  }, [connected, publicKey, activeAdapter]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        publicKey,
        walletName,
        detectedWallets,
        showPicker,
        setShowPicker,
        connect,
        disconnect,
        signMessage,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
