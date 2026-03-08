// src/services/mwaWallet.ts
// Mobile Wallet Adapter (MWA) — Solana Mobile's standard wallet protocol.
// Works with any MWA-compatible wallet on Android (Phantom, Solflare, etc.)
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { log, warn, error } from '../utils/logger';

const APP_IDENTITY = {
  name: 'KingMe',
  uri: 'https://kingme.money',
  icon: 'favicon.ico',
};

// ─── Session State ───────────────────────────────────────────────────────────

let authToken: string | null = null;
let walletPublicKey: PublicKey | null = null;
let walletAccount: { address: string; label?: string } | null = null;

// ─── Connect ────────────────────────────────────────────────────────────────

export async function connect(): Promise<{ publicKey: PublicKey }> {
  const result = await transact(async (wallet) => {
    const auth = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: 'solana:mainnet',
    });
    return auth;
  });

  authToken = result.auth_token;
  const account = result.accounts[0];
  if (!account) throw new Error('No accounts returned from MWA authorize');

  // MWA returns base64-encoded addresses
  const pubkeyBytes = Buffer.from(account.address, 'base64');
  walletPublicKey = new PublicKey(pubkeyBytes);
  walletAccount = { address: account.address, label: account.label };

  log('[MWA] Connected:', walletPublicKey.toBase58());
  return { publicKey: walletPublicKey };
}

// ─── Sign Transaction ───────────────────────────────────────────────────────

export async function signTransaction<T extends Transaction | VersionedTransaction>(
  transaction: T,
): Promise<T> {
  if (!authToken) throw new Error('Not connected via MWA');

  const [signed] = await transact(async (wallet) => {
    // Reauthorize with stored token
    await wallet.reauthorize({
      auth_token: authToken!,
      identity: APP_IDENTITY,
    });
    return await wallet.signTransactions({
      transactions: [transaction],
    });
  });

  return signed;
}

// ─── Sign and Send Transaction ──────────────────────────────────────────────

export async function signAndSendTransaction(
  transaction: Transaction | VersionedTransaction,
): Promise<string> {
  if (!authToken) throw new Error('Not connected via MWA');

  const [signature] = await transact(async (wallet) => {
    await wallet.reauthorize({
      auth_token: authToken!,
      identity: APP_IDENTITY,
    });
    return await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
  });

  log('[MWA] Signed & sent:', signature);
  return signature;
}

// ─── Sign Message ───────────────────────────────────────────────────────────

export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (!authToken || !walletAccount) throw new Error('Not connected via MWA');

  const [signedPayload] = await transact(async (wallet) => {
    await wallet.reauthorize({
      auth_token: authToken!,
      identity: APP_IDENTITY,
    });
    return await wallet.signMessages({
      addresses: [walletAccount!.address],
      payloads: [message],
    });
  });

  // MWA returns signed_payload = signature (64 bytes) + original message.
  // Extract just the 64-byte ed25519 detached signature.
  if (signedPayload.length > 64) {
    return signedPayload.slice(0, 64);
  }
  return signedPayload;
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export async function disconnect(): Promise<void> {
  if (authToken) {
    try {
      await transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken! });
      });
    } catch (e) {
      warn('[MWA] Deauthorize failed (non-blocking):', e);
    }
  }
  authToken = null;
  walletPublicKey = null;
  walletAccount = null;
  log('[MWA] Disconnected');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function isConnected(): boolean {
  return !!walletPublicKey && !!authToken;
}

export function getPublicKey(): PublicKey | null {
  return walletPublicKey;
}
