// src/services/walletStorage.ts
// Wallet-based encryption/decryption using NaCl secretbox.
// All API calls are authenticated with ed25519 signatures.

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

import { getApiBase } from './apiBase';
import { log, warn, error as logError } from '../utils/logger';

const BACKUP_API_BASE = getApiBase();

function encodeText(str: string): Uint8Array {
  const utf8 = unescape(encodeURIComponent(str));
  const result = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    result[i] = utf8.charCodeAt(i);
  }
  return result;
}

function decodeText(arr: Uint8Array): string {
  let str = '';
  for (let i = 0; i < arr.length; i++) {
    str += String.fromCharCode(arr[i]);
  }
  return decodeURIComponent(escape(str));
}

// Cache signed auth params to avoid multiple wallet popups per operation.
// Valid for 2 minutes (server allows up to 5).
let _authCache: { params: string; walletAddress: string; expiresAt: number } | null = null;

/**
 * Signs an auth challenge and returns query params for authenticated API calls.
 * The server verifies the ed25519 signature to prove wallet ownership.
 * Cached for 2 minutes so a save/load operation only triggers one wallet popup.
 */
export async function getAuthParams(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string
): Promise<string> {
  // Return cached params if still fresh
  if (_authCache && _authCache.walletAddress === walletAddress && Date.now() < _authCache.expiresAt) {
    return _authCache.params;
  }

  const timestamp = Date.now().toString();
  const message = `kingme:${walletAddress}:${timestamp}`;
  const messageBytes = encodeText(message);
  const signatureBytes = await signMessage(messageBytes);
  const signature = bs58.encode(signatureBytes);
  const params = `wallet=${walletAddress}&signature=${encodeURIComponent(signature)}&timestamp=${timestamp}`;

  _authCache = { params, walletAddress, expiresAt: Date.now() + 2 * 60 * 1000 };
  return params;
}

/**
 * Fetches the per-wallet server-side salt (authenticated).
 * The salt is generated once on the server and stored in Redis.
 */
async function fetchWalletSalt(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<string> {
  const authParams = await getAuthParams(signMessage, publicKey);
  const response = await fetch(`${BACKUP_API_BASE}/api/salt?${authParams}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch salt: ${err.error || response.status}`);
  }
  const { salt } = await response.json();
  if (!salt) {
    throw new Error('No salt returned from server');
  }
  return salt;
}

/** Derive a 32-byte key from a hex SHA256 hash string. */
function keyFromHash(hash: string): Uint8Array {
  const keyArray = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyArray[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  return keyArray;
}

/**
 * Derive the salted encryption key (current scheme).
 * key = SHA256(publicKey + ':' + serverSalt)
 */
export async function getEncryptionKeyFromWallet(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<Uint8Array> {
  const salt = await fetchWalletSalt(signMessage, publicKey);
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    publicKey + ':' + salt
  );
  return keyFromHash(hash);
}

/**
 * Derive the legacy encryption key (pre-salt scheme).
 * key = SHA256(publicKey)
 */
async function getLegacyEncryptionKey(publicKey: string): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    publicKey
  );
  return keyFromHash(hash);
}

export async function encryptProfileWithWallet(
  profileData: any,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<string> {
  try {
    const key = await getEncryptionKeyFromWallet(signMessage, publicKey);

    const jsonString = JSON.stringify(profileData);
    const message = encodeText(jsonString);

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(message, nonce, key);

    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    // Use base64 — bs58 is O(n^2) and freezes Hermes on large data
    const base64String = 'b64:' + Buffer.from(combined).toString('base64');

    return base64String;
  } catch (error) {
    logError('Encryption failed:', error);
    throw error;
  }
}

/** Try to decrypt raw bytes with a given key. Returns null on failure. */
function tryDecrypt(combined: Uint8Array, key: Uint8Array): Uint8Array | null {
  const nonce = combined.slice(0, 24);
  const encrypted = combined.slice(24);
  return nacl.secretbox.open(encrypted, nonce, key);
}

export async function decryptProfileWithWallet(
  encryptedData: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<any> {
  try {
    let combined: Uint8Array;
    if (encryptedData.startsWith('b64:')) {
      combined = new Uint8Array(Buffer.from(encryptedData.slice(4), 'base64'));
    } else {
      // Legacy bs58 format fallback
      combined = new Uint8Array(bs58.decode(encryptedData));
    }

    // Try current salted key first
    const saltedKey = await getEncryptionKeyFromWallet(signMessage, publicKey);
    let decrypted = tryDecrypt(combined, saltedKey);

    // Fall back to legacy key (pre-salt: SHA256(publicKey) only)
    if (!decrypted) {
      log('[DECRYPT] Salted key failed, trying legacy key...');
      const legacyKey = await getLegacyEncryptionKey(publicKey);
      decrypted = tryDecrypt(combined, legacyKey);
    }

    if (!decrypted) {
      throw new Error('Decryption failed - wrong wallet or corrupted data');
    }

    const jsonString = decodeText(decrypted);
    return JSON.parse(jsonString);
  } catch (error) {
    logError('Decryption failed:', error);
    throw error;
  }
}
