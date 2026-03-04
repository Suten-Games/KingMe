// src/utils/tokenRegistry.ts
// Hardcoded token registry for reliable icon + metadata lookup.
// Sources: Jupiter token list, Solana token list, protocol repos.
// Add more as needed — this avoids flaky API calls.

export interface TokenInfo {
  symbol: string;
  name: string;
  logoURI: string;
  mint?: string; // Solana mint address
  coingeckoId?: string;
}

export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  // ═══════════════════════════════════════════════════════════
  // MAJORS
  // ═══════════════════════════════════════════════════════════
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    mint: 'So11111111111111111111111111111111111111112',
    coingeckoId: 'solana',
  },
  SKR: {
    symbol: 'SKR',
    name: 'Seeker (Solana Mobile)',
    logoURI: 'https://assets.coingecko.com/coins/images/52383/small/SKR.png',
    mint: 'SKRy1C6Smucp4Wz2MPnKgvDRFgDHraoskMJH3a2fMec',
    coingeckoId: 'seeker-token',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
    coingeckoId: 'ethereum',
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png',
    coingeckoId: 'bitcoin',
  },
  BCH: {
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    logoURI: 'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',
    coingeckoId: 'bitcoin-cash',
  },
  XRP: {
    symbol: 'XRP',
    name: 'XRP',
    logoURI: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    coingeckoId: 'ripple',
  },
  CRO: {
    symbol: 'CRO',
    name: 'Cronos',
    logoURI: 'https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png',
    coingeckoId: 'crypto-com-chain',
  },

  // ═══════════════════════════════════════════════════════════
  // STABLECOINS
  // ═══════════════════════════════════════════════════════════
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    coingeckoId: 'usd-coin',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    coingeckoId: 'tether',
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    logoURI: 'https://raw.githubusercontent.com/nickelsh1ts/token-list/main/assets/mainnet/2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo/logo.png',
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  },

  // ═══════════════════════════════════════════════════════════
  // LIQUID STAKING TOKENS
  // ═══════════════════════════════════════════════════════════
  MSOL: {
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    coingeckoId: 'msol',
  },
  JITOSOL: {
    symbol: 'JitoSOL',
    name: 'Jito Staked SOL',
    logoURI: 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png',
    mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    coingeckoId: 'jito-staked-sol',
  },
  BSOL: {
    symbol: 'bSOL',
    name: 'BlazeStake Staked SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png',
    mint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  },
  DSOL: {
    symbol: 'dSOL',
    name: 'Drift Staked SOL',
    logoURI: 'https://drift-public.s3.eu-central-1.amazonaws.com/dSOL.svg',
    mint: 'Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ',
  },
  INF: {
    symbol: 'INF',
    name: 'Infinity (Sanctum)',
    logoURI: 'https://arweave.net/MpKl7nMkjS4m2WjLJOZbWF3_qc79o7jXMhAdm8sBvfU',
    mint: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
  },

  // ═══════════════════════════════════════════════════════════
  // DEFI PROTOCOL TOKENS
  // ═══════════════════════════════════════════════════════════
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    logoURI: 'https://static.jup.ag/jup/icon.png',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    coingeckoId: 'jupiter-exchange-solana',
  },
  DRIFT: {
    symbol: 'DRIFT',
    name: 'Drift Protocol',
    logoURI: 'https://drift-public.s3.eu-central-1.amazonaws.com/drift.png',
    mint: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
    coingeckoId: 'drift-protocol',
  },
  SYRUPUSDC: {
    symbol: 'syrupUSDC',
    name: 'Syrup USDC (Maple)',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    mint: 'AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj',
  },
  MNDE: {
    symbol: 'MNDE',
    name: 'Marinade',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png',
    mint: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
  },
  JTO: {
    symbol: 'JTO',
    name: 'Jito',
    logoURI: 'https://metadata.jito.network/token/jto/icon.png',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    coingeckoId: 'jito-governance-token',
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    coingeckoId: 'raydium',
  },
  ORCA: {
    symbol: 'ORCA',
    name: 'Orca',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    coingeckoId: 'orca',
  },
  BONK: {
    symbol: 'BONK',
    name: 'Bonk',
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    coingeckoId: 'bonk',
  },
  WIF: {
    symbol: 'WIF',
    name: 'dogwifhat',
    logoURI: 'https://bafkreibk3covs5ltyqxa272uodhber6ksmbua5efpjg5c77h4jnfzcea.ipfs.nftstorage.link',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    coingeckoId: 'dogwifcoin',
  },
  RENDER: {
    symbol: 'RENDER',
    name: 'Render Token',
    logoURI: 'https://raw.githubusercontent.com/nickelsh1ts/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png',
    mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    coingeckoId: 'render-token',
  },
  HNT: {
    symbol: 'HNT',
    name: 'Helium',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png',
    mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
    coingeckoId: 'helium',
  },
  W: {
    symbol: 'W',
    name: 'Wormhole',
    logoURI: 'https://wormhole.com/token.png',
    mint: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ',
    coingeckoId: 'wormhole',
  },

  // ═══════════════════════════════════════════════════════════
  // TRADITIONAL / NON-CRYPTO (for stocks, ETFs)
  // ═══════════════════════════════════════════════════════════
  VOO: {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    logoURI: 'https://logo.clearbit.com/vanguard.com',
  },
  VTI: {
    symbol: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    logoURI: 'https://logo.clearbit.com/vanguard.com',
  },
  QQQ: {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    logoURI: 'https://logo.clearbit.com/invesco.com',
  },
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    logoURI: 'https://logo.clearbit.com/apple.com',
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    logoURI: 'https://logo.clearbit.com/microsoft.com',
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    logoURI: 'https://logo.clearbit.com/nvidia.com',
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    logoURI: 'https://logo.clearbit.com/tesla.com',
  },
  GOOGL: {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    logoURI: 'https://logo.clearbit.com/google.com',
  },
  AMZN: {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    logoURI: 'https://logo.clearbit.com/amazon.com',
  },
  DFDV: {
    symbol: 'DFDV',
    name: 'DeFi Development Corp',
    logoURI: 'https://logo.clearbit.com/defidevcorp.com',
  }
};

/**
 * Look up a token by symbol (case-insensitive).
 * Returns the TokenInfo if found, or null.
 */
export function lookupToken(symbol: string): TokenInfo | null {
  const key = symbol.trim().toUpperCase();
  return TOKEN_REGISTRY[key] || null;
}

/**
 * Search tokens by partial symbol or name match.
 * Useful for autocomplete/search UI.
 */
export function searchTokens(query: string): TokenInfo[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return Object.values(TOKEN_REGISTRY).filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
  );
}

/**
 * Get all tokens as a flat array (for picker UI).
 */
export function getAllTokens(): TokenInfo[] {
  return Object.values(TOKEN_REGISTRY);
}
