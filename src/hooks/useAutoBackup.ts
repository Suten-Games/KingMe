// src/hooks/useAutoBackup.ts
// Silently backs up to the cloud every hour when a wallet session is active.

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import { buildFullBackup } from '../services/fullBackup';
import { saveBackup } from '../services/encryptedBackup';

const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 60 * 1000;        // Check every 60 seconds
const ASYNC_KEY = 'lastAutoBackup';

export function useAutoBackup() {
  const isLoaded = useStore(s => s._isLoaded);
  const { connected, publicKey, signMessage } = useWallet();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !connected || !publicKey) return;

    const walletAddress = publicKey.toBase58();

    const check = async () => {
      // Prevent overlapping runs
      if (runningRef.current) return;

      try {
        const raw = await AsyncStorage.getItem(ASYNC_KEY);
        const lastBackup = raw ? parseInt(raw, 10) : 0;

        if (Date.now() - lastBackup < BACKUP_INTERVAL_MS) return;

        runningRef.current = true;
        console.log('[AUTO-BACKUP] Starting hourly backup...');

        const storeData = useStore.getState();
        const fullBackup = await buildFullBackup(storeData);
        await saveBackup(fullBackup, signMessage, walletAddress);

        await AsyncStorage.setItem(ASYNC_KEY, Date.now().toString());
        console.log('[AUTO-BACKUP] Backup complete');
      } catch (e: any) {
        console.warn('[AUTO-BACKUP] Failed (will retry next cycle):', e.message);
      } finally {
        runningRef.current = false;
      }
    };

    // Check immediately on mount, then every 60 seconds
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoaded, connected, publicKey, signMessage]);
}
