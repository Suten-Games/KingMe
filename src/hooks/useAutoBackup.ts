// src/hooks/useAutoBackup.ts
// Silently backs up to the cloud every 24 hours when a wallet session is active.

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import { buildFullBackup } from '../services/fullBackup';
import { saveBackup } from '../services/encryptedBackup';
import { log, warn, error } from '../utils/logger';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 10 * 60 * 1000;        // Check every 10 minutes
const ASYNC_KEY = 'lastAutoBackup';

export function useAutoBackup() {
  const isLoaded = useStore(s => s._isLoaded);
  const onboardingComplete = useStore(s => s.onboardingComplete);
  const { connected, publicKey, signMessage, walletType } = useWallet();
  const runningRef = useRef(false);

  useEffect(() => {
    // MWA requires biometric approval for every signMessage — skip auto-backup
    // to avoid constant wallet popups. Users can still back up manually.
    if (walletType === 'mwa') return;
    if (!isLoaded || !onboardingComplete || !connected || !publicKey) return;

    const walletAddress = publicKey.toBase58();

    const check = async () => {
      // Prevent overlapping runs
      if (runningRef.current) return;

      // Never overwrite real cloud backup with demo persona data
      const demoActive = await AsyncStorage.getItem('_demo_active');
      if (demoActive === 'true') {
        log('[AUTO-BACKUP] Skipped — demo mode active');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(ASYNC_KEY);
        const lastBackup = raw ? parseInt(raw, 10) : 0;

        if (Date.now() - lastBackup < BACKUP_INTERVAL_MS) return;

        runningRef.current = true;

        const storeData = useStore.getState();

        // Don't overwrite a good backup with empty/fresh state
        const hasData = (storeData.assets?.length > 0)
          || (storeData.wallets?.length > 0 && storeData.obligations?.length > 0)
          || (storeData.income?.salary > 0);
        if (!hasData) {
          log('[AUTO-BACKUP] Skipped — store looks empty, not overwriting cloud backup');
          return;
        }

        log('[AUTO-BACKUP] Starting hourly backup...');
        const fullBackup = await buildFullBackup(storeData);
        await saveBackup(fullBackup, signMessage, walletAddress);

        await AsyncStorage.setItem(ASYNC_KEY, Date.now().toString());
        log('[AUTO-BACKUP] Backup complete');
      } catch (e: any) {
        warn('[AUTO-BACKUP] Failed (will retry next cycle):', e.message);
      } finally {
        runningRef.current = false;
      }
    };

    // Check immediately on mount, then every 60 seconds
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoaded, onboardingComplete, connected, publicKey, signMessage, walletType]);
}
