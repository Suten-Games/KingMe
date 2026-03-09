// api/referral/claim.ts — Build claim + transfer transactions for Jupiter referral fees
// =======================================================================================
// Node.js runtime (needs @solana/web3.js + @jup-ag/referral-sdk).
// Returns serialized VersionedTransactions for the client to sign.
// No private keys needed server-side — the user's connected wallet signs everything.

import {
  Connection, PublicKey, VersionedTransaction, TransactionMessage,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { ReferralProvider } from '@jup-ag/referral-sdk';

export const config = { runtime: 'nodejs' };

const RPC_URL = process.env.SOLANA_RPC_URL || process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT || '';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

// Well-known mints for labeling
const KNOWN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo': 'PYUSD',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: 'JTO',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'JUP',
  DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7: 'DRIFT',
};

export default async function handler(request: Request) {
  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { userPublicKey, businessWallet, action = 'preview' } = body;

    if (!userPublicKey) {
      return jsonResponse({ error: 'Missing userPublicKey (partner wallet)' }, 400);
    }
    if (!REFERRAL_ACCOUNT) {
      return jsonResponse({ error: 'JUPITER_REFERRAL_ACCOUNT not configured on server' }, 500);
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const provider = new ReferralProvider(connection);
    const referralPubKey = new PublicKey(REFERRAL_ACCOUNT);
    const partnerPubKey = new PublicKey(userPublicKey);

    console.log(`[REFERRAL] ${action}: partner=${userPublicKey}, business=${businessWallet || 'none'}, referral=${REFERRAL_ACCOUNT}`);

    // ── Get claimable token accounts ──────────────────────────
    const referralTokens = await provider.getReferralTokenAccountsWithStrategy(
      REFERRAL_ACCOUNT,
      { type: 'token-list' },
    );

    const allAccounts = [
      ...(referralTokens.tokenAccounts || []),
      ...(referralTokens.token2022Accounts || []),
    ];

    // Filter to accounts with balance > 0
    const claimableAccounts = allAccounts.filter((a: any) => {
      const amount = (a.account?.data as any)?.parsed?.info?.tokenAmount;
      return amount && BigInt(amount.amount) > 0n;
    });

    if (claimableAccounts.length === 0) {
      return jsonResponse({
        claims: [],
        totalValueUSD: 0,
        message: 'No referral fees to claim',
      });
    }

    // ── Build claims metadata ─────────────────────────────────
    const claims: Array<{
      mint: string;
      symbol: string;
      amount: string;
      decimals: number;
      uiAmount: number;
      valueUSD: number;
    }> = [];

    const mintAddresses: string[] = [];

    for (const account of claimableAccounts) {
      const info = ((account as any).account?.data as any)?.parsed?.info;
      const mint = info?.mint;
      const tokenAmount = info?.tokenAmount;
      if (!mint || !tokenAmount) continue;

      mintAddresses.push(mint);
      claims.push({
        mint,
        symbol: KNOWN_SYMBOLS[mint] || mint.slice(0, 6) + '...',
        amount: tokenAmount.amount,
        decimals: tokenAmount.decimals,
        uiAmount: parseFloat(tokenAmount.uiAmountString || '0'),
        valueUSD: 0, // filled in below
      });
    }

    // ── Fetch USD prices ──────────────────────────────────────
    if (mintAddresses.length > 0) {
      try {
        const priceRes = await fetch(
          `${JUPITER_PRICE_API}?ids=${mintAddresses.join(',')}`,
        );
        const priceData = await priceRes.json();
        for (const claim of claims) {
          const price = priceData?.data?.[claim.mint]?.price;
          if (price) {
            claim.valueUSD = claim.uiAmount * parseFloat(price);
          }
        }
      } catch (err) {
        console.warn('[REFERRAL] Price fetch failed:', err);
      }
    }

    const totalValueUSD = claims.reduce((sum, c) => sum + c.valueUSD, 0);

    // ── Preview only — return claimable amounts ───────────────
    if (action === 'preview') {
      return jsonResponse({ claims, totalValueUSD });
    }

    // ── Build claim transactions ──────────────────────────────
    if (action !== 'claim') {
      return jsonResponse({ error: 'Invalid action. Use "preview" or "claim".' }, 400);
    }
    if (!businessWallet) {
      return jsonResponse({ error: 'Missing businessWallet for claim action' }, 400);
    }

    const businessPubKey = new PublicKey(businessWallet);

    // Use claimPartially to control which accounts we claim
    const claimableAddresses = claimableAccounts.map(a => a.pubkey);
    const claimTxs = await provider.claimPartially({
      withdrawalableTokenAddress: claimableAddresses,
      payerPubKey: partnerPubKey,
      referralAccountPubKey: referralPubKey,
    });

    console.log(`[REFERRAL] Built ${claimTxs.length} claim transactions for ${claims.length} tokens`);

    // ── Build transfer transactions (partner ATAs → business wallet ATAs) ──
    // These must be sent AFTER claim txs confirm.
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const transferInstructions: any[] = [];

    for (const claim of claims) {
      const mintPubKey = new PublicKey(claim.mint);

      // Source: partner's ATA (where claim deposits)
      const sourceATA = getAssociatedTokenAddressSync(mintPubKey, partnerPubKey);

      // Destination: business wallet's ATA
      const destATA = getAssociatedTokenAddressSync(mintPubKey, businessPubKey);

      // Check if destination ATA exists
      const destAccount = await connection.getAccountInfo(destATA);
      if (!destAccount) {
        // Create the ATA first
        transferInstructions.push(
          createAssociatedTokenAccountInstruction(
            partnerPubKey, // payer
            destATA,
            businessPubKey,
            mintPubKey,
          ),
        );
      }

      // Transfer the claimed amount
      transferInstructions.push(
        createTransferInstruction(
          sourceATA,
          destATA,
          partnerPubKey, // authority (signer)
          BigInt(claim.amount),
        ),
      );
    }

    // Package transfer instructions into versioned transactions (max ~5 per tx)
    const transferTxs: VersionedTransaction[] = [];
    const INSTRUCTIONS_PER_TX = 5;

    for (let i = 0; i < transferInstructions.length; i += INSTRUCTIONS_PER_TX) {
      const batch = transferInstructions.slice(i, i + INSTRUCTIONS_PER_TX);
      const message = new TransactionMessage({
        payerKey: partnerPubKey,
        recentBlockhash: blockhash,
        instructions: batch,
      }).compileToV0Message();

      transferTxs.push(new VersionedTransaction(message));
    }

    console.log(`[REFERRAL] Built ${transferTxs.length} transfer transactions`);

    // ── Serialize all transactions ────────────────────────────
    const serializedClaimTxs = claimTxs.map(tx =>
      Buffer.from(tx.serialize()).toString('base64'),
    );
    const serializedTransferTxs = transferTxs.map(tx =>
      Buffer.from(tx.serialize()).toString('base64'),
    );

    return jsonResponse({
      claims,
      totalValueUSD,
      claimTransactions: serializedClaimTxs,
      transferTransactions: serializedTransferTxs,
      lastValidBlockHeight,
    });

  } catch (error: any) {
    console.error('[REFERRAL] Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
