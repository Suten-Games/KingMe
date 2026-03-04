// src/services/encryptedBackup.ts
// Cloud backup via authenticated backup API.
// All API calls require a valid wallet signature.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  encryptProfileWithWallet,
  decryptProfileWithWallet,
  getAuthParams,
} from './walletStorage';

import { getApiBase } from './apiBase';

const BACKUP_API = `${getApiBase()}/api/backup`;

export async function saveBackup(
  profileData: any,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string
): Promise<string> {
  try {
    const encrypted = await encryptProfileWithWallet(profileData, signMessage, walletAddress);

    // Sign a fresh auth challenge for the upload request
    const authParams = await getAuthParams(signMessage, walletAddress);

    const response = await fetch(`${BACKUP_API}?${authParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: encrypted }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Upload failed: ${err.error || response.status}`);
    }

    const backupId = `cloud_${Date.now()}`;
    await AsyncStorage.setItem(`backup_latest_${walletAddress}`, backupId);

    return backupId;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

export async function loadBackup(
  walletAddress: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<any> {
  try {
    // Sign a fresh auth challenge for the download request
    const authParams = await getAuthParams(signMessage, walletAddress);

    const response = await fetch(`${BACKUP_API}?${authParams}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch backup: ${err.error || response.status}`);
    }

    const { data: encrypted } = await response.json();

    if (!encrypted) {
      throw new Error('No backup found for this wallet');
    }

    const cleanEncrypted = typeof encrypted === 'string'
      ? encrypted.replace(/^"|"$/g, '')
      : encrypted;

    const profileData = await decryptProfileWithWallet(cleanEncrypted, signMessage, walletAddress);

    return profileData;
  } catch (error) {
    console.error('Load backup failed:', error);
    throw error;
  }
}
