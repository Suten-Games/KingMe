// src/providers/wallet-provider.native.tsx
// iOS + Android only — Metro loads this instead of wallet-provider.tsx on native
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as Linking from 'expo-linking';
import { usePrivy, useEmbeddedSolanaWallet, useLoginWithOAuth } from '@privy-io/expo';
import * as PhantomDeepLink from '../services/phantomDeepLink';
import * as MWA from '../services/mwaWallet';
import WalletPickerModal from '../components/WalletPickerModal';
import type { WalletOption } from '../components/WalletPickerModal';
import { log, warn, error as logError } from '../utils/logger';
import { useStore } from '../store/useStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
  signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
  walletType: 'privy-embedded' | 'privy-external' | 'phantom-extension' | 'mwa' | null;
  isPrivyReady?: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const { isReady, user, logout: privyLogout } = usePrivy();
  const embeddedWallet = useEmbeddedSolanaWallet();
  const { start: startOAuth } = useLoginWithOAuth();

  // Phantom deep link state
  const [phantomConnected, setPhantomConnected] = useState(false);
  const [phantomPubKey, setPhantomPubKey] = useState<PublicKey | null>(null);

  // MWA state
  const [mwaConnected, setMwaConnected] = useState(false);
  const [mwaPubKey, setMwaPubKey] = useState<PublicKey | null>(null);

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletOption | null>(null);

  // Listen for Phantom deep link callbacks
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('phantom-connect') || url.includes('phantom-sign')) {
        const handled = PhantomDeepLink.handlePhantomDeepLink(url);
        if (handled && url.includes('phantom-connect') && PhantomDeepLink.isConnected()) {
          setPhantomConnected(true);
          setPhantomPubKey(PhantomDeepLink.getPublicKey());
        }
      }
    });

    // Check initial URL (app opened from deep link)
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('phantom-connect') || url.includes('phantom-sign'))) {
        PhantomDeepLink.handlePhantomDeepLink(url);
        if (PhantomDeepLink.isConnected()) {
          setPhantomConnected(true);
          setPhantomPubKey(PhantomDeepLink.getPublicKey());
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // Wallet type
  const walletType = useMemo((): WalletContextType['walletType'] => {
    if (mwaConnected) return 'mwa';
    if (phantomConnected) return 'privy-external';
    if (embeddedWallet?.status === 'connected') return 'privy-embedded';
    return null;
  }, [mwaConnected, phantomConnected, embeddedWallet?.status]);

  // Public key
  const publicKey = useMemo(() => {
    if (mwaConnected && mwaPubKey) return mwaPubKey;
    if (phantomConnected && phantomPubKey) return phantomPubKey;
    if (embeddedWallet?.status === 'connected' && embeddedWallet?.publicKey) {
      return new PublicKey(embeddedWallet.publicKey);
    }
    return null;
  }, [mwaConnected, mwaPubKey, phantomConnected, phantomPubKey, embeddedWallet?.status, embeddedWallet?.publicKey]);

  const connected = !!publicKey;

  // Derive display name
  const walletName = walletType === 'mwa' ? 'Mobile Wallet'
    : walletType === 'privy-embedded' ? 'Privy Wallet'
    : phantomConnected ? 'Phantom' : null;

  // Open picker
  const connect = useCallback(async () => {
    if (connected) return;
    setShowPicker(true);
  }, [connected]);

  // Handle picker selection
  const handlePickerSelect = useCallback(async (option: WalletOption) => {
    setConnecting(true);
    setConnectingWallet(option);

    let connectedPubKey: PublicKey | null = null;

    try {
      switch (option) {
        case 'mwa': {
          const result = await MWA.connect();
          setMwaConnected(true);
          setMwaPubKey(result.publicKey);
          connectedPubKey = result.publicKey;
          break;
        }
        case 'phantom':
        case 'jupiter': {
          // Jupiter and Phantom both support Phantom's deep link protocol
          const result = await PhantomDeepLink.connect();
          setPhantomConnected(true);
          setPhantomPubKey(result.publicKey);
          connectedPubKey = result.publicKey;
          break;
        }
        case 'solflare':
          throw new Error('Solflare deep link coming soon');
        case 'google':
          await startOAuth({ provider: 'google' });
          break;
        case 'apple':
          await startOAuth({ provider: 'apple' });
          break;
        default:
          throw new Error(`${option} not supported yet`);
      }
      setShowPicker(false);

      // Save wallet address to zustand store so the rest of the app knows it's connected
      if (connectedPubKey) {
        const address = connectedPubKey.toBase58();
        const currentWallets = useStore.getState().wallets;
        if (!currentWallets.includes(address)) {
          useStore.setState({ wallets: [...currentWallets, address] });
          await useStore.getState().saveProfile();
        }
        // Auto-sync wallet assets
        useStore.getState().syncWalletAssets(address).catch((e: any) =>
          logError('[Wallet] Auto-sync failed:', e)
        );
      }
    } catch (error: any) {
      logError(`🔴 ${option} connect failed:`, error);
    } finally {
      setConnecting(false);
      setConnectingWallet(null);
    }
  }, [startOAuth]);

  const disconnect = useCallback(() => {
    if (mwaConnected) {
      MWA.disconnect();
      setMwaConnected(false);
      setMwaPubKey(null);
    }
    if (phantomConnected) {
      PhantomDeepLink.disconnect();
      setPhantomConnected(false);
      setPhantomPubKey(null);
    }
    if (user && embeddedWallet?.status === 'connected') {
      privyLogout();
    }
  }, [mwaConnected, phantomConnected, user, embeddedWallet?.status, privyLogout]);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!connected) throw new Error('Wallet not connected');

    // MWA
    if (mwaConnected) {
      return await MWA.signMessage(message);
    }

    // Phantom deep link
    if (phantomConnected) {
      return await PhantomDeepLink.signMessage(message);
    }

    // Privy embedded wallet
    if (embeddedWallet?.status === 'connected') {
      const provider = await embeddedWallet.getProvider();
      const msgBase64 = Buffer.from(message).toString('base64');
      const result = await provider.request({
        method: 'signMessage',
        params: { message: msgBase64 },
      });
      return Uint8Array.from(Buffer.from(result.signature, 'base64'));
    }

    throw new Error('No wallet available for signing');
  }, [connected, mwaConnected, phantomConnected, embeddedWallet]);

  const signTransaction = useCallback(async (transaction: any): Promise<any> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');

    // MWA
    if (mwaConnected) {
      return await MWA.signTransaction(transaction);
    }

    // Phantom deep link
    if (phantomConnected) {
      const serialized = transaction.serialize({ requireAllSignatures: false });
      return await PhantomDeepLink.signTransaction(serialized);
    }

    // Privy embedded wallet
    if (embeddedWallet?.status === 'connected') {
      const provider = await embeddedWallet.getProvider();
      const serialized = transaction.serialize({ requireAllSignatures: false });
      const msgBase64 = Buffer.from(serialized).toString('base64');

      const result = await provider.request({
        method: 'signMessage',
        params: { message: msgBase64 },
      });

      transaction.addSignature(publicKey, Buffer.from(result.signature, 'base64'));
      return transaction;
    }

    throw new Error('No wallet available for signing');
  }, [connected, publicKey, mwaConnected, phantomConnected, embeddedWallet]);

  const signAndSendTransaction = useCallback(async (transaction: any): Promise<{ signature: string }> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');

    // MWA
    if (mwaConnected) {
      const sig = await MWA.signAndSendTransaction(transaction);
      return { signature: sig };
    }

    // Phantom deep link
    if (phantomConnected) {
      const serialized = transaction.serialize({ requireAllSignatures: false });
      const sig = await PhantomDeepLink.signAndSendTransaction(serialized);
      return { signature: typeof sig === 'string' ? sig : sig?.toString?.() || '' };
    }

    // Privy embedded — sign only, no send support
    throw new Error('signAndSendTransaction not supported for this wallet type');
  }, [connected, publicKey, mwaConnected, phantomConnected]);

  return (
    <WalletContext.Provider value={{
      connected,
      connecting,
      publicKey,
      walletName,
      connect,
      disconnect,
      signMessage,
      signTransaction,
      signAndSendTransaction,
      walletType,
      isPrivyReady: isReady,
    }}>
      {children}
      <WalletPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handlePickerSelect}
        connecting={connecting}
        connectingWallet={connectingWallet}
        externalWalletsAvailable={true}
      />
    </WalletContext.Provider>
  );
}
