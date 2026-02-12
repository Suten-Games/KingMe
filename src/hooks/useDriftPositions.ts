// hooks/useDriftPositions.ts
// Stub version - Drift SDK is not compatible with React Native
// Users can manually add Drift positions as crypto assets

interface DriftPosition {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  category: 'defi';
  protocol: 'Drift';
  apy?: number;
}

interface DriftPositionsResult {
  positions: DriftPosition[];
  totalValue: number;
  isLoading: boolean;
  error: string | null;
}

export function useDriftPositions(walletAddress: string | null): DriftPositionsResult {
  // Drift SDK uses Node.js modules not available in React Native
  // Users should manually add Drift positions via "Add Asset" button
  
  console.log('[DRIFT] Auto-sync not available - add Drift manually as crypto asset');
  
  return {
    positions: [],
    totalValue: 0,
    isLoading: false,
    error: null,
  };
}
