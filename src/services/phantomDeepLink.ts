// src/services/phantomDeepLink.ts
// Direct Phantom wallet connection via iOS/Android deep links
// No SDK needed — uses Phantom's universal link protocol
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as Linking from 'expo-linking';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

const PHANTOM_CONNECT = 'https://phantom.app/ul/v1/connect';
const PHANTOM_SIGN_TX = 'https://phantom.app/ul/v1/signTransaction';
const PHANTOM_SIGN_MSG = 'https://phantom.app/ul/v1/signMessage';
const PHANTOM_SIGN_SEND = 'https://phantom.app/ul/v1/signAndSendTransaction';

const APP_URL = 'https://kingme.app';

// ─── Session State ───────────────────────────────────────────────────────────

let dappKeyPair: nacl.BoxKeyPair | null = null;
let sharedSecret: Uint8Array | null = null;
let phantomWalletPublicKey: PublicKey | null = null;
let session: string | null = null;

// Pending request resolution
let pendingResolve: ((value: any) => void) | null = null;
let pendingReject: ((reason?: any) => void) | null = null;
let pendingAction: 'connect' | 'signTransaction' | 'signMessage' | 'signAndSendTransaction' | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreateKeyPair(): nacl.BoxKeyPair {
  if (!dappKeyPair) {
    dappKeyPair = nacl.box.keyPair();
  }
  return dappKeyPair;
}

function encryptPayload(payload: object, nonce: Uint8Array): Uint8Array {
  if (!sharedSecret) throw new Error('No shared secret — connect first');
  const jsonStr = JSON.stringify(payload);
  // Must be Uint8Array for tweetnacl, not Buffer
  const message = new Uint8Array(Buffer.from(jsonStr));
  console.log('🔐 Encrypting payload:', jsonStr.length, 'chars');
  const encrypted = nacl.box.after(message, nonce, sharedSecret);
  if (!encrypted) throw new Error('nacl.box.after returned null — encryption failed');
  console.log('🔐 Encrypted:', encrypted.length, 'bytes');
  return encrypted;
}

function decryptPayload(data: string, nonce: string): any {
  if (!sharedSecret) throw new Error('No shared secret');
  const decrypted = nacl.box.open.after(
    new Uint8Array(bs58.decode(data)),
    new Uint8Array(bs58.decode(nonce)),
    sharedSecret
  );
  if (!decrypted) throw new Error('Failed to decrypt Phantom response');
  return JSON.parse(Buffer.from(decrypted).toString('utf8'));
}

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

// ─── Deep Link Handler ───────────────────────────────────────────────────────
// Call this from your app's deep link listener

export function handlePhantomDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    // Error response
    if (params.get('errorCode')) {
      const errorMessage = params.get('errorMessage') || 'Phantom rejected the request';
      console.error('🔴 Phantom error:', errorMessage);
      if (pendingReject) {
        pendingReject(new Error(errorMessage));
        pendingResolve = null;
        pendingReject = null;
        pendingAction = null;
      }
      return true;
    }

    // Connect response
    if (pendingAction === 'connect') {
      const phantomEncryptionPubKey = params.get('phantom_encryption_public_key');
      const nonce = params.get('nonce');
      const data = params.get('data');

      if (!phantomEncryptionPubKey || !nonce || !data) {
        throw new Error('Missing connect response params');
      }

      // Derive shared secret
      const phantomPubKeyBytes = new Uint8Array(bs58.decode(phantomEncryptionPubKey));
      sharedSecret = nacl.box.before(
        phantomPubKeyBytes,
        getOrCreateKeyPair().secretKey
      );

      console.log('🔑 Shared secret derived:', sharedSecret.length, 'bytes');

      // Decrypt payload to get wallet public key and session
      const decrypted = decryptPayload(data, nonce);
      phantomWalletPublicKey = new PublicKey(decrypted.public_key);
      session = decrypted.session;

      console.log('✅ Phantom connected:', phantomWalletPublicKey.toBase58());

      if (pendingResolve) {
        pendingResolve({
          publicKey: phantomWalletPublicKey,
          session,
        });
      }
    }

    // Sign transaction response
    if (pendingAction === 'signTransaction') {
      const nonce = params.get('nonce');
      const data = params.get('data');

      if (!nonce || !data) throw new Error('Missing sign response params');

      const decrypted = decryptPayload(data, nonce);
      const signedTx = Buffer.from(decrypted.transaction, 'base64');

      console.log('✅ Phantom signed transaction');

      if (pendingResolve) {
        pendingResolve(signedTx);
      }
    }

    // Sign message response
    if (pendingAction === 'signMessage') {
      const nonce = params.get('nonce');
      const data = params.get('data');

      if (!nonce || !data) throw new Error('Missing sign response params');

      const decrypted = decryptPayload(data, nonce);
      const signature = bs58.decode(decrypted.signature);

      console.log('✅ Phantom signed message');

      if (pendingResolve) {
        pendingResolve(signature);
      }
    }

    // Sign and send response
    if (pendingAction === 'signAndSendTransaction') {
      const nonce = params.get('nonce');
      const data = params.get('data');

      if (!nonce || !data) throw new Error('Missing sign+send response params');

      const decrypted = decryptPayload(data, nonce);

      console.log('✅ Phantom signed & sent:', decrypted.signature);

      if (pendingResolve) {
        pendingResolve(decrypted.signature);
      }
    }

    pendingResolve = null;
    pendingReject = null;
    pendingAction = null;
    return true;
  } catch (error) {
    console.error('🔴 Failed to handle Phantom deep link:', error);
    if (pendingReject) {
      pendingReject(error);
      pendingResolve = null;
      pendingReject = null;
      pendingAction = null;
    }
    return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function connect(): Promise<{ publicKey: PublicKey; session: string }> {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    pendingAction = 'connect';

    const kp = getOrCreateKeyPair();
    const redirectUrl = Linking.createURL('phantom-connect');

    const url = buildUrl(PHANTOM_CONNECT, {
      dapp_encryption_public_key: bs58.encode(kp.publicKey),
      cluster: 'mainnet-beta',
      app_url: APP_URL,
      redirect_link: redirectUrl,
    });

    console.log('🔗 Opening Phantom connect...');
    Linking.openURL(url).catch(reject);
  });
}

export function signTransaction(serializedTx: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (!session || !sharedSecret) {
      return reject(new Error('Not connected to Phantom'));
    }

    pendingResolve = resolve;
    pendingReject = reject;
    pendingAction = 'signTransaction';

    const nonce = nacl.randomBytes(24);
    const payload = {
      transaction: bs58.encode(Buffer.from(serializedTx)),
      session,
    };

    const encryptedPayload = encryptPayload(payload, nonce);
    const redirectUrl = Linking.createURL('phantom-sign-tx');

    const url = buildUrl(PHANTOM_SIGN_TX, {
      dapp_encryption_public_key: bs58.encode(getOrCreateKeyPair().publicKey),
      nonce: bs58.encode(Buffer.from(nonce)),
      payload: bs58.encode(Buffer.from(encryptedPayload)),
      redirect_link: redirectUrl,
    });

    console.log('🔗 Opening Phantom for tx signing...');
    Linking.openURL(url).catch(reject);
  });
}

export function signMessage(message: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (!session || !sharedSecret) {
      return reject(new Error('Not connected to Phantom'));
    }

    pendingResolve = resolve;
    pendingReject = reject;
    pendingAction = 'signMessage';

    console.log('🔗 Signing message:', message.length, 'bytes, session:', session?.slice(0, 12) + '...');

    const nonce = nacl.randomBytes(24);
    const payload = {
      message: bs58.encode(Buffer.from(message)),
      session,
    };

    console.log('📦 Payload message (bs58):', payload.message.slice(0, 20) + '...');

    const encryptedPayload = encryptPayload(payload, nonce);
    const redirectUrl = Linking.createURL('phantom-sign-msg');

    const url = buildUrl(PHANTOM_SIGN_MSG, {
      dapp_encryption_public_key: bs58.encode(getOrCreateKeyPair().publicKey),
      nonce: bs58.encode(Buffer.from(nonce)),
      payload: bs58.encode(Buffer.from(encryptedPayload)),
      redirect_link: redirectUrl,
    });

    console.log('🔗 Sign URL length:', url.length);
    console.log('🔗 Opening Phantom for message signing...');
    Linking.openURL(url).catch(reject);
  });
}

export function signAndSendTransaction(serializedTx: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!session || !sharedSecret) {
      return reject(new Error('Not connected to Phantom'));
    }

    pendingResolve = resolve;
    pendingReject = reject;
    pendingAction = 'signAndSendTransaction';

    const nonce = nacl.randomBytes(24);
    const payload = {
      transaction: bs58.encode(Buffer.from(serializedTx)),
      session,
    };

    const encryptedPayload = encryptPayload(payload, nonce);
    const redirectUrl = Linking.createURL('phantom-sign-send');

    const url = buildUrl(PHANTOM_SIGN_SEND, {
      dapp_encryption_public_key: bs58.encode(getOrCreateKeyPair().publicKey),
      nonce: bs58.encode(Buffer.from(nonce)),
      payload: bs58.encode(Buffer.from(encryptedPayload)),
      redirect_link: redirectUrl,
    });

    console.log('🔗 Opening Phantom for sign+send...');
    Linking.openURL(url).catch(reject);
  });
}

export function disconnect() {
  dappKeyPair = null;
  sharedSecret = null;
  phantomWalletPublicKey = null;
  session = null;
  pendingResolve = null;
  pendingReject = null;
  pendingAction = null;
  console.log('🔌 Phantom disconnected');
}

export function isConnected(): boolean {
  return !!phantomWalletPublicKey && !!session;
}

export function getPublicKey(): PublicKey | null {
  return phantomWalletPublicKey;
}
