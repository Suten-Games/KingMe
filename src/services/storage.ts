// KingMe - Encrypted Storage Service
// This handles saving/loading user profile data with encryption

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import type { UserProfile } from '../types';
import { STORAGE_KEYS, DEFAULT_USER_PROFILE } from '../utils/constants';
import { log, warn, error as logError } from '../utils/logger';

/**
 * Derive encryption key from wallet signature
 * In production, this would use the actual wallet signature
 * For now, we'll use a placeholder
 */
export async function deriveEncryptionKey(walletAddress: string): Promise<string> {
  // TODO: Implement actual wallet signature-based key derivation
  // For now, use a simple hash of the wallet address
  return CryptoJS.SHA256(walletAddress).toString();
}

/**
 * Encrypt data using AES
 */
function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypt data using AES
 */
function decrypt(encryptedData: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Save user profile to encrypted storage
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    // Get encryption key
    const primaryWallet = profile.wallets[0];
    if (!primaryWallet) {
      throw new Error('No wallet connected');
    }

    const encryptionKey = await deriveEncryptionKey(primaryWallet);

    // Serialize and encrypt
    const profileJson = JSON.stringify(profile);
    const encryptedProfile = encrypt(profileJson, encryptionKey);

    // Save to AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, encryptedProfile);
    
    // Update last sync timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    
    log('User profile saved successfully');
  } catch (error) {
    logError('Failed to save user profile:', error);
    throw error;
  }
}

/**
 * Load user profile from encrypted storage
 */
export async function loadUserProfile(walletAddress: string): Promise<UserProfile | null> {
  try {
    // Get encrypted data
    const encryptedProfile = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    
    if (!encryptedProfile) {
      log('No saved profile found');
      return null;
    }

    // Get encryption key
    const encryptionKey = await deriveEncryptionKey(walletAddress);

    // Decrypt and parse
    const profileJson = decrypt(encryptedProfile, encryptionKey);
    const profile: UserProfile = JSON.parse(profileJson);

    log('User profile loaded successfully');
    return profile;
  } catch (error) {
    logError('Failed to load user profile:', error);
    return null;
  }
}

/**
 * Create a new user profile with default values
 */
export async function createNewProfile(walletAddress: string): Promise<UserProfile> {
  const newProfile: UserProfile = {
    ...DEFAULT_USER_PROFILE as any,
    wallets: [walletAddress],
    lastSynced: new Date().toISOString(),
  };

  await saveUserProfile(newProfile);
  return newProfile;
}

/**
 * Clear all stored data (for logout/reset)
 */
export async function clearStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.ENCRYPTION_KEY,
      STORAGE_KEYS.LAST_SYNC,
    ]);
    log('Storage cleared successfully');
  } catch (error) {
    logError('Failed to clear storage:', error);
    throw error;
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastSync(): Promise<Date | null> {
  try {
    const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  } catch (error) {
    logError('Failed to get last sync:', error);
    return null;
  }
}

/**
 * Export user data as JSON (for backup)
 */
export async function exportUserData(profile: UserProfile): Promise<string> {
  return JSON.stringify(profile, null, 2);
}

/**
 * Import user data from JSON (for restore)
 */
export async function importUserData(jsonData: string): Promise<UserProfile> {
  try {
    const profile: UserProfile = JSON.parse(jsonData);
    await saveUserProfile(profile);
    return profile;
  } catch (error) {
    logError('Failed to import user data:', error);
    throw new Error('Invalid backup data');
  }
}
