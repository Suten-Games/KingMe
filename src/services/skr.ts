// src/services/skr.ts - Fixed DAS API call

export interface SKRHolding {
  totalBalance: number;
  stakedBalance: number;
  liquidBalance: number;
  priceUsd: number;
  apy?: number;
}

export interface SKRIncomeSnapshot {
  totalValueUsd: number;
  monthlyYieldUsd: number;
  annualYieldUsd: number;
  monthlyYieldSkr: number;
  apyUsed: number;
}

const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
const SKR_PRICE = 0.0178; // $0.0178 per SKR
const SKR_APY = 0.209; // 20.9% APY from Guardian staking

/**
 * Fetch ALL SKR balances including staked positions via Helius DAS API
 */
export async function fetchSKRHolding(walletAddress: string): Promise<SKRHolding | null> {
  try {
    const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

    console.log('═══════════════════════════════════════════════');
    console.log('🔍 FETCHING SKR VIA HELIUS DAS API');
    console.log('Wallet:', walletAddress);
    console.log('═══════════════════════════════════════════════');

    // Use getAssetsByOwner to get all fungible tokens
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'skr-search',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showNativeBalance: false,
            showZeroBalance: false,
          },
        },
      }),
    });

    const data = await response.json();
    
    console.log('📦 RAW HELIUS RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════');
    
    if (data.error) {
      console.log('❌ API Error:', data.error.message);
      console.log('Falling back to getTokenAccountsByOwner...');
      return await fetchSKRFallback(walletAddress);
    }
    
    if (!data.result?.items) {
      console.log('❌ No assets found in response');
      return await fetchSKRFallback(walletAddress);
    }

    console.log(`📊 Total assets returned: ${data.result.items.length}`);
    
    // Find SKR in the results
    const skrAssets = data.result.items.filter((item: any) => {
      const isSkr = item.id === SKR_MINT || 
                    item.content?.metadata?.symbol === 'SKR' ||
                    item.content?.metadata?.name?.includes('SKR') ||
                    item.token_info?.symbol === 'SKR';
      
      if (isSkr) {
        console.log('✓ Found SKR asset:', {
          id: item.id,
          symbol: item.content?.metadata?.symbol || item.token_info?.symbol,
          name: item.content?.metadata?.name,
        });
      }
      
      return isSkr;
    });

    console.log(`🎯 SKR assets found: ${skrAssets.length}`);

    if (skrAssets.length === 0) {
      console.log('❌ No SKR found in DAS response');
      console.log('Falling back to getTokenAccountsByOwner...');
      return await fetchSKRFallback(walletAddress);
    }

    let totalBalance = 0;
    let stakedBalance = 0;
    let liquidBalance = 0;

    skrAssets.forEach((asset: any, idx: number) => {
      console.log(`\n📍 SKR Asset #${idx + 1}:`);
      console.log('  Full asset data:', JSON.stringify(asset, null, 2));
      
      const balance = asset.token_info?.balance || 0;
      const decimals = asset.token_info?.decimals || 9;
      const actualBalance = balance / Math.pow(10, decimals);
      
      const isDelegated = asset.ownership?.delegated || false;
      const delegate = asset.ownership?.delegate;
      const owner = asset.ownership?.owner;
      
      console.log('  Parsed values:');
      console.log('    Balance (raw):', balance);
      console.log('    Decimals:', decimals);
      console.log('    Balance (actual):', actualBalance);
      console.log('    Owner:', owner);
      console.log('    Delegated:', isDelegated);
      console.log('    Delegate:', delegate);

      totalBalance += actualBalance;
      
      if (isDelegated) {
        console.log('    ✓ COUNTED AS STAKED');
        stakedBalance += actualBalance;
      } else {
        console.log('    ✓ COUNTED AS LIQUID');
        liquidBalance += actualBalance;
      }
    });

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 FINAL TOTALS:');
    console.log('  Total:', totalBalance.toFixed(2), 'SKR');
    console.log('  Staked:', stakedBalance.toFixed(2), 'SKR');
    console.log('  Liquid:', liquidBalance.toFixed(2), 'SKR');
    console.log('═══════════════════════════════════════════════\n');

    if (totalBalance === 0) {
      return null;
    }

    return {
      totalBalance,
      stakedBalance,
      liquidBalance,
      priceUsd: SKR_PRICE,
      apy: stakedBalance > 0 ? SKR_APY : 0,
    };
  } catch (error) {
    console.error('💥 ERROR in fetchSKRHolding:', error);
    console.log('Falling back to getTokenAccountsByOwner...');
    return await fetchSKRFallback(walletAddress);
  }
}

/**
 * Fallback method using getTokenAccountsByOwner
 */
async function fetchSKRFallback(walletAddress: string): Promise<SKRHolding | null> {
  try {
    const FALLBACK_RPC = process.env.EXPO_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

    console.log('\n═══════════════════════════════════════════════');
    console.log('🔄 FALLBACK: getTokenAccountsByOwner');
    console.log('═══════════════════════════════════════════════');

    const response = await fetch(FALLBACK_RPC, {
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
    
    console.log('📦 FALLBACK RAW RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════');
    
    if (!data.result?.value || data.result.value.length === 0) {
      console.log('❌ No token accounts found');
      return null;
    }

    console.log(`📊 Token accounts found: ${data.result.value.length}`);

    let totalBalance = 0;
    let stakedBalance = 0;
    let liquidBalance = 0;
    
    data.result.value.forEach((account: any, idx: number) => {
      console.log(`\n📍 Account #${idx + 1}:`);
      console.log('  Full account:', JSON.stringify(account, null, 2));
      
      const info = account.account?.data?.parsed?.info;
      const balance = info?.tokenAmount?.uiAmount || 0;
      const delegate = info?.delegate;
      const owner = info?.owner;
      const state = info?.state;
      
      console.log('  Parsed:');
      console.log('    Balance:', balance);
      console.log('    Owner:', owner);
      console.log('    Delegate:', delegate);
      console.log('    State:', state);
      
      totalBalance += balance;
      
      if (delegate) {
        console.log('    ✓ COUNTED AS STAKED (has delegate)');
        stakedBalance += balance;
      } else {
        console.log('    ✓ COUNTED AS LIQUID (no delegate)');
        liquidBalance += balance;
      }
    });

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 FALLBACK TOTALS:');
    console.log('  Total:', totalBalance.toFixed(2), 'SKR');
    console.log('  Staked:', stakedBalance.toFixed(2), 'SKR');
    console.log('  Liquid:', liquidBalance.toFixed(2), 'SKR');
    console.log('═══════════════════════════════════════════════\n');

    if (totalBalance === 0) return null;

    return {
      totalBalance,
      stakedBalance,
      liquidBalance,
      priceUsd: SKR_PRICE,
      apy: stakedBalance > 0 ? SKR_APY : 0,
    };
  } catch (error) {
    console.error('💥 FALLBACK ERROR:', error);
    return null;
  }
}

/**
 * Calculate income from SKR holding
 */
export function calcSKRIncome(holding: SKRHolding): SKRIncomeSnapshot {
  const totalValueUsd = holding.totalBalance * holding.priceUsd;
  const annualYieldUsd = holding.stakedBalance * holding.priceUsd * (holding.apy || 0);
  const monthlyYieldUsd = annualYieldUsd / 12;
  const monthlyYieldSkr = (holding.stakedBalance * (holding.apy || 0)) / 12;

  return {
    totalValueUsd,
    monthlyYieldUsd,
    annualYieldUsd,
    monthlyYieldSkr,
    apyUsed: holding.apy || 0,
  };
}
