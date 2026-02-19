// src/providers/wallet-provider.tsx
// Web only — Metro loads wallet-provider.native.tsx on iOS/Android
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
  walletType: 'privy-embedded' | 'privy-external' | 'phantom-extension' | null;
  isPrivyReady?: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}

declare const window: any;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'solana' in window) {
      const phantom = window.solana;

      if (phantom.isConnected && phantom.publicKey) {
        setConnected(true);
        setPublicKey(new PublicKey(phantom.publicKey.toString()));
      }

      phantom.on('connect', (pk: any) => {
        setConnected(true);
        setPublicKey(new PublicKey(pk.toString()));
      });

      phantom.on('disconnect', () => {
        setConnected(false);
        setPublicKey(null);
      });

      return () => phantom.removeAllListeners();
    }
  }, []);

  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true);
    try {
      if (typeof window !== 'undefined' && 'solana' in window) {
        const resp = await window.solana.connect();
        setConnected(true);
        setPublicKey(new PublicKey(resp.publicKey.toString()));
      } else {
        throw new Error('Phantom extension not found. Install Phantom to connect.');
      }
    } finally {
      setConnecting(false);
    }
  }, [connected, connecting]);

  const disconnect = useCallback(() => {
    if (typeof window !== 'undefined' && 'solana' in window) {
      window.solana.disconnect();
    }
    setConnected(false);
    setPublicKey(null);
  }, []);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!connected) throw new Error('Wallet not connected');
    if (typeof window !== 'undefined' && 'solana' in window) {
      const signed = await window.solana.signMessage(message, 'utf8');
      return signed.signature;
    }
    throw new Error('Phantom not found');
  }, [connected]);

  const signTransaction = useCallback(async (transaction: any): Promise<any> => {
    if (!connected) throw new Error('Wallet not connected');
    if (typeof window !== 'undefined' && 'solana' in window) {
      return await window.solana.signTransaction(transaction);
    }
    throw new Error('Phantom not found');
  }, [connected]);

  return (
    <WalletContext.Provider value={{
      connected, connecting, publicKey, connect, disconnect,
      signMessage, signTransaction,
      walletType: connected ? 'phantom-extension' : null,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
