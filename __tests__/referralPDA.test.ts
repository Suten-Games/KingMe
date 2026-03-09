// __tests__/referralPDA.test.ts
// Verify edge-compatible PDA derivation matches @solana/web3.js results.
// These are the exact functions from api/swap/quote.ts (edge runtime).

import { PublicKey } from '@solana/web3.js';

// ── Base58 codec (same as quote.ts) ──────────────────────────
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(str: string): Uint8Array {
  let num = BigInt(0);
  for (const char of str) {
    const idx = B58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base58 char: ' + char);
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const char of str) {
    if (char === '1') bytes.unshift(0);
    else break;
  }
  while (bytes.length < 32) bytes.unshift(0);
  return new Uint8Array(bytes);
}

function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) num = num * 256n + BigInt(byte);
  let str = '';
  while (num > 0n) {
    str = B58_ALPHABET[Number(num % 58n)] + str;
    num /= 58n;
  }
  for (const byte of bytes) {
    if (byte === 0) str = '1' + str;
    else break;
  }
  return str;
}

// ── PDA derivation (same as quote.ts, but uses @solana/web3.js sha256 for testing) ──
// We import the noble libs the same way the edge function does
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

const REFERRAL_PROGRAM_ID = decodeBase58('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

function isOnCurve(point: Uint8Array): boolean {
  try {
    ed25519.ExtendedPoint.fromHex(point);
    return true;
  } catch {
    return false;
  }
}

function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): [Uint8Array, number] {
  const pda = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const parts: Uint8Array[] = [...seeds, new Uint8Array([bump]), programId, pda];
    let totalLen = 0;
    for (const p of parts) totalLen += p.length;
    const buf = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) { buf.set(p, offset); offset += p.length; }
    const hash = sha256(buf);
    if (!isOnCurve(hash)) return [hash, bump];
  }
  throw new Error('Could not find PDA');
}

function deriveFeeAccount(referralAccount: string, outputMint: string): string {
  const seeds = [
    new TextEncoder().encode('referral_ata'),
    decodeBase58(referralAccount),
    decodeBase58(outputMint),
  ];
  const [pda] = findProgramAddress(seeds, REFERRAL_PROGRAM_ID);
  return encodeBase58(pda);
}

// ── Derive using @solana/web3.js for ground truth ────────────
function deriveFeeAccountSolana(referralAccount: string, outputMint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('referral_ata'),
      new PublicKey(referralAccount).toBuffer(),
      new PublicKey(outputMint).toBuffer(),
    ],
    new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3'),
  );
  return pda.toBase58();
}

// ── Test cases ───────────────────────────────────────────────
// Use a known referral account (dummy or real)
const REFERRAL_ACCOUNT = 'AAxz5EBAsYA2bX9WEMyi4eRpPBJnswSZaFaR2sPpKwAC';

const TEST_MINTS: Record<string, string> = {
  SOL:   'So11111111111111111111111111111111111111112',
  USDC:  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT:  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP:   'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  PYUSD: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  JTO:   'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  BONK:  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  DRIFT: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
};

describe('Referral PDA derivation (edge-compatible)', () => {
  it('base58 roundtrip encodes correctly', () => {
    for (const mint of Object.values(TEST_MINTS)) {
      const decoded = decodeBase58(mint);
      const reencoded = encodeBase58(decoded);
      expect(reencoded).toBe(mint);
    }
  });

  it('base58 decode matches @solana/web3.js PublicKey', () => {
    for (const mint of Object.values(TEST_MINTS)) {
      const ours = decodeBase58(mint);
      const theirs = new PublicKey(mint).toBytes();
      expect(Buffer.from(ours).toString('hex')).toBe(Buffer.from(theirs).toString('hex'));
    }
  });

  for (const [symbol, mint] of Object.entries(TEST_MINTS)) {
    it(`derives correct fee account PDA for ${symbol} (${mint.slice(0, 8)}...)`, () => {
      const edge = deriveFeeAccount(REFERRAL_ACCOUNT, mint);
      const solana = deriveFeeAccountSolana(REFERRAL_ACCOUNT, mint);
      expect(edge).toBe(solana);
    });
  }

  it('PDA is never on the ed25519 curve', () => {
    for (const mint of Object.values(TEST_MINTS)) {
      const seeds = [
        new TextEncoder().encode('referral_ata'),
        decodeBase58(REFERRAL_ACCOUNT),
        decodeBase58(mint),
      ];
      const [pda] = findProgramAddress(seeds, REFERRAL_PROGRAM_ID);
      expect(isOnCurve(pda)).toBe(false);
    }
  });
});
