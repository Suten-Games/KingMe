// api/wallet/sync.ts - UPDATED WITH HELIUS WALLET API
// ==============================================================

export const config = {
  runtime: 'edge',
};

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;

interface WalletAsset {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  category: 'crypto' | 'stocks' | 'commodities' | 'real_estate' | 'defi';
  logoURI?: string;
  apy?: number;
}

export default async function handler(request: Request) {
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
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return jsonResponse({ error: 'walletAddress required' }, 400);
    }

    console.log(`[SYNC] Starting for ${walletAddress}`);
    
    // 1. Get wallet data from Helius Wallet API (one call!)
    const walletData = await fetchHeliusWalletAPI(walletAddress);
    console.log(`[HELIUS] SOL: ${walletData.nativeBalance.lamports / 1e9}, Tokens: ${walletData.tokens.length}`);
    
    const assets: WalletAsset[] = [];
    
    // 2. Add SOL (native balance)
    if (walletData.nativeBalance.lamports > 0) {
      const solBalance = walletData.nativeBalance.lamports / 1e9;
      const solPrice = walletData.nativeBalance.price || 0;
      const solValue = solBalance * solPrice;
      
      if (solBalance > 0.0001) {
        assets.push({
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          balance: solBalance,
          priceUSD: solPrice,
          valueUSD: solValue,
          category: 'crypto',
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        });
        
        console.log(`[SOL] ${solBalance.toFixed(4)} @ $${solPrice.toFixed(2)} = $${solValue.toFixed(2)}`);
      }
    }
    
    // 3. Add SPL tokens
    for (const token of walletData.tokens) {
      const balance = token.balance / Math.pow(10, token.decimals);
      
      // Skip zero balance
      if (balance === 0 || balance < 0.000001) continue;
      
      const price = token.price || 0;
      const value = balance * price;
      
      // Skip dust if priced (but keep unpriced tokens so you can see them)
      if (price > 0 && value < 0.01) {
        console.log(`[SKIP-DUST] ${token.symbol}: $${value.toFixed(4)}`);
        continue;
      }
      
      // Use Helius data
      let symbol = token.symbol || 'UNKNOWN';
      let name = token.name || 'Unknown Token';
      let logoURI = token.logoURI;
      
      // If still unknown, format nicely
      if (symbol === 'UNKNOWN' || !token.name) {
        const balanceStr = balance >= 1000 
          ? `${(balance / 1000).toFixed(1)}K`
          : balance >= 1
          ? balance.toFixed(2)
          : balance.toFixed(6);
        const mintShort = `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`;
        symbol = token.mint.slice(0, 6);
        name = `${balanceStr} ${mintShort}`;
      }
      
      const category = categorizeToken(token.mint, symbol, name);
      
      console.log(`[TOKEN] ${symbol}: ${balance.toFixed(4)} @ $${price.toFixed(4)} = $${value.toFixed(2)}`);
      
      assets.push({
        mint: token.mint,
        symbol,
        name,
        balance,
        priceUSD: price,
        valueUSD: value,
        category,
        logoURI,
      });
    }
    
    // 4. Try to get Drift positions (best effort)
    try {
      const driftPositions = await fetchDriftPositions(walletAddress);
      
      if (driftPositions.length > 0) {
        console.log(`[DRIFT] Found ${driftPositions.length} positions`);
        
        for (const position of driftPositions) {
          assets.push({
            mint: position.mint || 'drift',
            symbol: position.symbol,
            name: position.name,
            balance: position.balance,
            priceUSD: position.priceUSD,
            valueUSD: position.valueUSD,
            category: 'defi',
            apy: position.apy,
          });
        }
      }
    } catch (error: any) {
      console.error('[DRIFT] Failed:', error.message);
      // Don't fail the whole sync if Drift fails
    }
    
    // 5. Sort by value
    assets.sort((a, b) => b.valueUSD - a.valueUSD);
    
    const totalValue = assets.reduce((sum, a) => sum + a.valueUSD, 0);
    const knownTokens = assets.filter(a => a.symbol !== 'UNKNOWN' && !a.name.includes('...')).length;
    
    console.log(`[SYNC] Complete: ${assets.length} assets, ${knownTokens} known, $${totalValue.toFixed(2)}`);
    
    return jsonResponse({
      assets,
      totalValue,
      syncedAt: new Date().toISOString(),
      debug: {
        assetsReturned: assets.length,
        knownTokens,
        unknownTokens: assets.length - knownTokens,
        source: 'helius-wallet-api',
      }
    });
    
  } catch (error: any) {
    console.error('[ERROR]', error);
    return jsonResponse({ 
      error: error.message,
      stack: error.stack 
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// Helius Wallet API (New endpoint - cleaner than RPC)
// ═══════════════════════════════════════════════════════════════

async function fetchHeliusWalletAPI(address: string) {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${HELIUS_API_KEY}`,
      { 
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`[HELIUS-API] Got ${data.tokens?.length || 0} tokens, SOL: ${data.nativeBalance?.lamports || 0}`);
    
    return data;
    
  } catch (error: any) {
    console.error('[HELIUS-API] Error:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// Drift Positions (Using Drift Data API - simpler than SDK)
// ═══════════════════════════════════════════════════════════════

async function fetchDriftPositions(walletAddress: string): Promise<any[]> {
  const positions: any[] = [];
  
  try {
    // Try Drift v2 user endpoint - check both subaccount 0 and 1
    for (let subaccountId = 0; subaccountId < 3; subaccountId++) {
      try {
        const response = await fetch(
          `https://mainnet-beta.api.drift.trade/users?authority=${walletAddress}&subAccountId=${subaccountId}`,
          { 
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json' }
          }
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          const userAccount = data[0];
          
          console.log(`[DRIFT] Found subaccount ${subaccountId}:`, JSON.stringify(userAccount).slice(0, 200));
          
          // Get net collateral value
          const netValue = userAccount.netUsdValue 
            ? parseFloat(userAccount.netUsdValue) / 1e6
            : userAccount.totalCollateral 
            ? parseFloat(userAccount.totalCollateral) / 1e6
            : 0;
          
          if (netValue > 1) {
            positions.push({
              mint: `drift-sub${subaccountId}`,
              symbol: 'DRIFT',
              name: subaccountId === 0 ? 'USDC in Drift' : `Drift Account ${subaccountId}`,
              balance: netValue,
              priceUSD: 1,
              valueUSD: netValue,
              category: 'defi',
              apy: 1.35, // Drift USDC APY - could be fetched from API
            });
          }
        }
      } catch (err: any) {
        console.log(`[DRIFT] Sub ${subaccountId} error:`, err.message);
      }
    }
    
  } catch (error: any) {
    console.log('[DRIFT] Error:', error.message);
  }
  
  return positions;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function categorizeToken(mint: string, symbol: string, name: string): WalletAsset['category'] {
  const nameLower = name.toLowerCase();
  const symbolUpper = symbol.toUpperCase();
  
  // Stocks (tokenized equities)
  if (/^[bm][A-Z]{2,5}$/i.test(symbol)) return 'stocks';
  if (nameLower.includes('stock') || nameLower.includes('equity')) return 'stocks';
  
  // Commodities
  if (['PAXG', 'PAXS', 'XAUT'].includes(symbolUpper)) return 'commodities';
  if (nameLower.includes('gold') || nameLower.includes('silver')) return 'commodities';
  
  // Real estate
  if (nameLower.includes('real estate') || nameLower.includes('property')) return 'real_estate';
  
  // DeFi
  if (symbolUpper.includes('SOL') && symbol !== 'SOL') return 'defi';
  if (symbol.includes('-') || symbol.includes('_')) return 'defi';
  const defiTokens = ['SKR', 'mSOL', 'jitoSOL', 'bSOL', 'stSOL', 'INF', 'ethSOL'];
  if (defiTokens.some(t => symbolUpper.includes(t.toUpperCase()))) return 'defi';
  
  return 'crypto';
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
