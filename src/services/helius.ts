// src/services/helius.ts - With SKR staking detection
import type { Asset, CryptoAsset } from '../types';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY || 'YOUR_HELIUS_API_KEY_HERE';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
const SKR_STAKING_APY = 0.18; // 18% APY

// Token prices
// const KNOWN_PRICES: Record<string, { symbol: string; price: number }> = {
//   'So11111111111111111111111111111111111111112': { symbol: 'SOL', price: 92.99 },
//   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', price: 0.99 },
//   'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', price: 1.00 },
//   'a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump': { symbol: 'WHALE', price: 0.115 },
//   'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB': { symbol: 'USD*', price: 1.04 },
//   'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3': { symbol: 'SKR', price: 0.0178 },
//   'GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A': { symbol: 'GOLD', price: 4974.41 },
//   'DXBYAw9aQheMdujaLZYnVSpKSK4n8jMS7HfLbiv5RWnS': { symbol: 'WETH', price: 2169.42 },
//   'zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg': { symbol: 'zBTC', price: 73207.47 },
//   'AS7fyy4keaxirUYTbX67Wzak9WvYCaxhWgw4tH44jVFT': { symbol: 'SLVr', price: 0.0767 },
// };
const KNOWN_PRICES: Record<string, { symbol: string; price: number }> = {};

export async function fetchWalletData(walletAddress: string) {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ],
      }),
    });

    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Helius API error: ${data.error.message}`);

    return { address: walletAddress, tokenAccounts: data.result?.value || [] };
  } catch (error) {
    console.error('Failed to fetch wallet data:', error);
    throw error;
  }
}

export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`Failed to get SOL balance: ${data.error.message}`);
    return (data.result?.value || 0) / 1_000_000_000;
  } catch (error) {
    console.error('Failed to get SOL balance:', error);
    return 0;
  }
}

// NEW: Get staked SKR specifically
export async function getStakedSKR(walletAddress: string): Promise<Asset | null> {
  try {
    console.log('🔍 Checking for staked SKR...');

    // Get SKR token accounts
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: SKR_MINT },
          { encoding: 'jsonParsed' }
        ],
      }),
    });

    const data = await response.json();

    if (!data.result?.value || data.result.value.length === 0) {
      console.log('No SKR token accounts found');
      return null;
    }

    // Sum up all SKR balances (could be multiple accounts)
    let totalStaked = 0;

    data.result.value.forEach((account: any) => {
      const info = account.account?.data?.parsed?.info;
      const balance = info?.tokenAmount?.uiAmount || 0;
      totalStaked += balance;

      console.log(`Found SKR account: ${balance} SKR`);
    });

    if (totalStaked === 0) return null;

    const skrPrice = KNOWN_PRICES[SKR_MINT].price;
    const value = totalStaked * skrPrice;
    const annualIncome = value * SKR_STAKING_APY;

    console.log(`✓ Total staked SKR: ${totalStaked.toFixed(2)} SKR = $${value.toFixed(2)} (${SKR_STAKING_APY * 100}% APY = $${annualIncome.toFixed(2)}/yr)`);

    return {
      id: `${walletAddress}-SKR-staking`,
      type: 'crypto' as const,
      name: '$SKR Staking',
      value,
      annualIncome,
      metadata: {
        type: 'crypto' as const,
        tokenMint: SKR_MINT,
        quantity: totalStaked,
        isStaked: true,
        walletAddress,
        symbol: '$SKR',
        decimals: 9,
      } as CryptoAsset,
    };
  } catch (error) {
    console.error('Failed to get staked SKR:', error);
    return null;
  }
}

export async function convertToAssets(heliusData: any): Promise<Asset[]> {
  const assets: Asset[] = [];
  const { address, tokenAccounts } = heliusData;

  if (!tokenAccounts || tokenAccounts.length === 0) {
    return assets;
  }

  console.log(`Processing ${tokenAccounts.length} token accounts...`);

  for (const account of tokenAccounts) {
    try {
      const parsedInfo = account.account?.data?.parsed?.info;
      if (!parsedInfo) continue;

      const mint = parsedInfo.mint;

      // Skip SKR - we handle it separately as staking
      if (mint === SKR_MINT) continue;

      const decimals = parsedInfo.tokenAmount?.decimals || 0;
      const balance = parsedInfo.tokenAmount?.amount || '0';
      const actualBalance = parseInt(balance) / Math.pow(10, decimals);

      if (actualBalance === 0) continue;

      const knownToken = KNOWN_PRICES[mint];
      if (!knownToken) continue;

      const symbol = knownToken.symbol;
      const price = knownToken.price;
      const value = actualBalance * price;

      if (value < 1.0) continue;

      console.log(`✓ ${symbol}: ${actualBalance.toFixed(4)} tokens × $${price.toFixed(2)} = $${value.toFixed(2)}`);

      assets.push({
        id: `${address}-${mint}`,
        type: 'crypto' as const,
        name: symbol,
        value,
        annualIncome: 0,
        metadata: {
          type: 'crypto' as const,
          tokenMint: mint,
          quantity: actualBalance,
          isStaked: false,
          walletAddress: address,
          symbol,
          decimals,
        } as CryptoAsset,
      });
    } catch (error) {
      console.error('Error processing token account:', error);
    }
  }

  console.log(`Converted ${assets.length} token assets`);
  return assets;
}

export async function getSolPrice(): Promise<number> {
  return 92.99;
}

export async function getDeFiProtocols() {
  return [
    { name: 'Kamino USDC', protocol: 'kamino', apy: 5.8, type: 'Lending', tvl: 450_000_000 },
    { name: 'Drift USDC', protocol: 'drift', apy: 8.1, type: 'Lending', tvl: 140_000_000 },
  ];
}

export function isHeliusConfigured(): boolean {
  return HELIUS_API_KEY !== 'YOUR_HELIUS_API_KEY_HERE' && HELIUS_API_KEY.length > 0;
}

export async function syncAllWallets(walletAddresses: string[]): Promise<Asset[]> {
  try {
    console.log(`\n🔄 Syncing ${walletAddresses.length} wallet(s)...`);

    const walletDataPromises = walletAddresses.map(async (address) => {
      console.log(`\n→ Wallet: ${address.slice(0, 4)}...${address.slice(-4)}`);

      const data = await fetchWalletData(address);
      const solBalance = await getSolBalance(address);
      const solPrice = await getSolPrice();
      const solValue = solBalance * solPrice;

      console.log(`  SOL: ${solBalance.toFixed(4)} = $${solValue.toFixed(2)}`);

      const tokenAssets = await convertToAssets(data);

      // Check for staked SKR
      const stakedSKR = await getStakedSKR(address);
      if (stakedSKR) {
        tokenAssets.push(stakedSKR);
      }

      // Add SOL
      if (solBalance > 0.01) {
        tokenAssets.unshift({
          id: `${address}-SOL`,
          type: 'crypto' as const,
          name: 'SOL',
          value: solValue,
          annualIncome: 0,
          metadata: {
            type: 'crypto' as const,
            tokenMint: 'So11111111111111111111111111111111111111112',
            quantity: solBalance,
            isStaked: false,
            walletAddress: address,
            symbol: 'SOL',
            decimals: 9,
          } as CryptoAsset,
        });
      }

      return tokenAssets;
    });

    const allWalletsAssets = await Promise.all(walletDataPromises);
    const allAssets = allWalletsAssets.flat();

    console.log(`\n✓ Sync complete: ${allAssets.length} total assets`);
    return allAssets;
  } catch (error) {
    console.error('\n✗ Sync failed:', error);
    throw error;
  }
}
