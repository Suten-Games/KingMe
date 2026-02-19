// src/services/walletStorage.ts
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

const ENCRYPTION_MESSAGE = 'Sign this message to prove you own this wallet';

// Polyfill for TextEncoder/TextDecoder
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

export async function getEncryptionKeyFromWallet(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<Uint8Array> {
  try {
    const message = encodeText(ENCRYPTION_MESSAGE);
    await signMessage(message);

    console.log('Using public key for encryption:', publicKey);

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      publicKey
    );

    console.log('Encryption key hash:', hash);

    const keyArray = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      keyArray[i] = parseInt(hash.substr(i * 2, 2), 16);
    }

    return keyArray;
  } catch (error) {
    console.error('Failed to get encryption key:', error);
    throw error;
  }
}

export async function encryptProfileWithWallet(
  profileData: any,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<string> {
  try {
    console.log('🔐 Encrypting with wallet signature...');
    const key = await getEncryptionKeyFromWallet(signMessage, publicKey);

    const jsonString = JSON.stringify(profileData);
    const message = encodeText(jsonString);

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(message, nonce, key);

    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    // Use base64 instead of bs58 — bs58 is O(n²) and freezes Hermes on large data
    // Prefix with "b64:" so we know the encoding on decrypt
    const base64String = 'b64:' + Buffer.from(combined).toString('base64');

    console.log('✅ Encrypted with wallet:', base64String.length, 'chars (base64)');
    return base64String;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

export async function decryptProfileWithWallet(
  encryptedData: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<any> {
  try {
    console.log('🔓 Decrypting with wallet signature...');
    const key = await getEncryptionKeyFromWallet(signMessage, publicKey);

    console.log('🔓 Decoding encrypted data:', encryptedData.length, 'chars');
    const startDecode = Date.now();

    let combined: Uint8Array;
    if (encryptedData.startsWith('b64:')) {
      // New format: base64 (fast)
      combined = new Uint8Array(Buffer.from(encryptedData.slice(4), 'base64'));
    } else {
      // Legacy format: bs58 (slow but needed for old backups)
      console.log('⚠️ Legacy bs58 backup detected — decoding may take a while...');
      combined = new Uint8Array(bs58.decode(encryptedData));
    }

    console.log('🔓 Decoded in', Date.now() - startDecode, 'ms →', combined.length, 'bytes');

    const nonce = combined.slice(0, 24);
    const encrypted = combined.slice(24);

    console.log('🔓 Decrypting', encrypted.length, 'bytes...');
    const decrypted = nacl.secretbox.open(encrypted, nonce, key);

    if (!decrypted) {
      throw new Error('Decryption failed - wrong wallet or corrupted data');
    }

    const jsonString = decodeText(decrypted);
    const profileData = JSON.parse(jsonString);

    console.log('✅ Decrypted successfully');
    return profileData;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}
