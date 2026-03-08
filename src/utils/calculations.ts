// KingMe - Freedom Calculation Logic

import type {
  UserProfile,
  Asset,
  CryptoAsset,
  RealEstateAsset,
  StockAsset,
  BusinessAsset,
  FreedomResult,
  FreedomState,
  HeliusWalletData,
} from '../types';
import { obligationMonthlyAmount } from '../types';

/**
 * Calculate total annual income from assets
 */
export function calculateAssetIncome(assets: Asset[]): number {
  return assets.reduce((total, asset) => {
    switch (asset.type) {
      case 'crypto':
      case 'defi': {
        // For crypto, use APY if staked/in DeFi, otherwise 0
        const cryptoMetadata = asset.metadata as CryptoAsset;
        const apy = cryptoMetadata?.apy || 0; // ✅ FIXED: Safe access with fallback
        return total + (apy > 0 ? asset.value * (apy / 100) : 0);
      }

      case 'real_estate': {
        const reMetadata = asset.metadata as RealEstateAsset;
        const monthlyNet =
          (reMetadata.monthlyRentalIncome || 0) - (reMetadata.monthlyExpenses || 0);
        return total + monthlyNet * 12;
      }

      case 'stocks': {
        const stockMetadata = asset.metadata as StockAsset;
        return (
          total + (stockMetadata.dividendYield ? asset.value * (stockMetadata.dividendYield / 100) : 0)
        );
      }

      case 'business': {
        const bizMetadata = asset.metadata as BusinessAsset;
        return total + (bizMetadata.annualDistributions || 0);
      }

      default:
        return total + (asset.annualIncome || 0); // ✅ FIXED: Safe fallback
    }
  }, 0);
}

/**
 * Calculate total annual obligations
 */
export function calculateAnnualObligations(profile: UserProfile): number {
  return profile.obligations.reduce((total, obligation) => {
    return total + obligationMonthlyAmount(obligation) * 12;
  }, 0);
}

/**
 * Calculate total annual desires (annualized)
 * NOTE: Desires do NOT affect freedom score unless they're actually purchased!
 * This is just for tracking and planning purposes.
 */
export function calculateAnnualDesires(profile: UserProfile): number {
  // Desires should NOT be counted toward obligations
  // They're wish list items, not actual expenses
  // Only count them if they have a "purchasedAt" date
  return profile.desires.reduce((total, desire) => {
    // Only count if actually purchased
    if (desire.purchasedAt && !desire.completedAt) {
      return total + desire.estimatedCost;
    }
    return total;
  }, 0);
}

/**
 * Calculate total annual debt service
 */
export function calculateAnnualDebtService(profile: UserProfile): number {
  return profile.debts.reduce((total, debt) => {
    return total + debt.monthlyPayment * 12;
  }, 0);
}

/**
 * Calculate total liquid assets (what you can sell for cash)
 * Includes retirement accounts with early-withdrawal penalty applied.
 */
export function calculateLiquidAssets(assets: Asset[], bankBalance: number = 0): number {
  const assetLiquid = assets.reduce((total, asset) => {
    if (asset.type === 'crypto' || asset.type === 'defi' || asset.type === 'stocks') {
      return total + asset.value;
    }
    // Retirement: include at reduced value (10% penalty + ~25% tax = 35% hit for traditional, 10% for Roth)
    if (asset.type === 'retirement' || (asset.metadata as any)?.type === 'retirement') {
      const acctType = (asset.metadata as any)?.accountType || '';
      const isRoth = acctType.startsWith('roth');
      const penalty = isRoth ? 0.10 : 0.35; // Roth: 10% on earnings; Traditional: 10% penalty + ~25% tax
      return total + asset.value * (1 - penalty);
    }
    // Exclude illiquid assets (cars, collectibles, real estate)
    return total;
  }, 0);
  return assetLiquid + bankBalance;
}

/**
 * Format freedom days into human-readable string
 */
export function formatFreedomDays(days: number): string {
  if (days === Infinity || days > 36500) {
    // 100 years
    return 'Forever';
  }
  if (days >= 730) {
    // 2+ years
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  if (days >= 365) {
    return '1 year';
  }
  if (days >= 60) {
    // 2+ months
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }
  if (days >= 30) {
    return '1 month';
  }
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Determine which freedom state (avatar) to show based on days
 */
export function getFreedomState(days: number): FreedomState {
  if (days === Infinity || days > 3650) return 'enthroned'; // 10+ years or infinite
  if (days >= 730) return 'rising'; // 2-10 years
  if (days >= 180) return 'breaking'; // 6 months - 2 years
  if (days >= 30) return 'struggling'; // 1-6 months
  return 'drowning'; // 0-30 days
}

/**
 * Main freedom calculation function
 */
export function calculateFreedom(profile: UserProfile, bankBalance?: number): FreedomResult {
  const assetIncome = calculateAssetIncome(profile.assets);
  const totalObligations = calculateAnnualObligations(profile);
  const totalDesires = calculateAnnualDesires(profile);
  const debtService = calculateAnnualDebtService(profile);

  const totalAnnualNeeds = totalObligations + totalDesires + debtService;
  const dailyNeeds = totalAnnualNeeds / 365;
  const dailyAssetIncome = assetIncome / 365;

  let days: number;
  let isKinged = false;

  // Edge case: if everything is zero, you're not kinged, you're TBD
  if (dailyAssetIncome === 0 && dailyNeeds === 0) {
    days = 0;
    isKinged = false;
  }
  // Check if daily asset income covers daily needs
  else if (dailyAssetIncome >= dailyNeeds && dailyNeeds > 0) {
    // You're KINGED - assets cover everything indefinitely
    days = Infinity;
    isKinged = true;
  } else {
    // Calculate runway based on liquid assets (includes bank accounts)
    const liquidAssets = calculateLiquidAssets(profile.assets, bankBalance);
    const dailyBurn = dailyNeeds - dailyAssetIncome;

    if (dailyBurn <= 0 || liquidAssets <= 0) {
      days = 0;
    } else {
      days = Math.floor(liquidAssets / dailyBurn);
    }
  }

  return {
    days,
    formatted: formatFreedomDays(days),
    state: getFreedomState(days),
    dailyAssetIncome,
    dailyNeeds,
    isKinged,
  };
}

/**
 * Calculate opportunity cost of idle assets
 */
export function calculateOpportunityCost(assets: Asset[]): {
  idleValue: number;
  potentialIncome: number;
  freedomDaysImpact: number;
} {
  let idleValue = 0;
  
  // Find assets earning 0%
  assets.forEach((asset) => {
    if (asset.type === 'crypto') {
      const cryptoMetadata = asset.metadata as CryptoAsset;
      const apy = cryptoMetadata?.apy || 0; // ✅ FIXED: Safe access
      if (apy === 0) {
        idleValue += asset.value;
      }
    }
  });

  // Assume conservative 8% APY for stablecoins
  const potentialIncome = idleValue * 0.08;
  
  // Calculate how many additional days this would provide
  // This is simplified - would need full profile for accurate calculation
  const freedomDaysImpact = Math.floor((potentialIncome / 365));

  return {
    idleValue,
    potentialIncome,
    freedomDaysImpact,
  };
}

/**
 * Calculate impact of purchasing a desire
 */
export function calculateDesireImpact(
  currentFreedom: FreedomResult,
  desireCost: number,
  liquidAssets: number
): {
  newDays: number;
  daysDifference: number;
  newState: FreedomState;
} {
  if (currentFreedom.isKinged) {
    // If kinged, buying something doesn't impact days (as long as you stay kinged)
    // Would need to recalculate if it drops you below kinged status
    return {
      newDays: Infinity,
      daysDifference: 0,
      newState: 'enthroned',
    };
  }

  const newLiquidAssets = liquidAssets - desireCost;
  const dailyBurn = currentFreedom.dailyNeeds - currentFreedom.dailyAssetIncome;
  
  const newDays = dailyBurn > 0 ? Math.floor(newLiquidAssets / dailyBurn) : 0;
  const daysDifference = currentFreedom.days - newDays;

  return {
    newDays,
    daysDifference,
    newState: getFreedomState(newDays),
  };
}
