// KingMe - Constants

import type { AvatarType, FreedomState } from '../types';

// Freedom state thresholds (in days)
export const FREEDOM_THRESHOLDS = {
  DROWNING: 30,      // 0-30 days
  STRUGGLING: 180,   // 30-180 days (1-6 months)
  BREAKING: 730,     // 180-730 days (6 months - 2 years)
  RISING: 3650,      // 730-3650 days (2-10 years)
  ENTHRONED: Infinity, // 3650+ days or infinite
} as const;

// Avatar image mappings
export const AVATAR_IMAGES: Record<AvatarType, Record<FreedomState, any>> = {
  'male-medium': {
    drowning: require('../../assets/images/freedom-0-20-male-medium.png'),
    struggling: require('../../assets/images/freedom-20-40-male-medium.png'),
    breaking: require('../../assets/images/freedom-40-60-male-medium.png'),
    rising: require('../../assets/images/freedom-60-80-male-medium.png'),
    enthroned: require('../../assets/images/freedom-80-100-male-medium.png'),
  },
  'female-medium': {
    drowning: require('../../assets/images/freedom-0-20-female-medium.png'),
    struggling: require('../../assets/images/freedom-20-40-female-medium.png'),
    breaking: require('../../assets/images/freedom-40-60-female-medium.png'),
    rising: require('../../assets/images/freedom-60-80-female-medium.png'),
    enthroned: require('../../assets/images/freedom-80-100-female-medium.png'),
  },
  'male-dark': {
    drowning: require('../../assets/images/freedom-0-20-male-dark.png'),
    struggling: require('../../assets/images/freedom-20-40-male-dark.png'),
    breaking: require('../../assets/images/freedom-40-60-male-dark.png'),
    rising: require('../../assets/images/freedom-60-80-male-dark.png'),
    enthroned: require('../../assets/images/freedom-80-100-male-dark.png'),
  },
};

// Avatar VIDEO mappings (animated avatars via expo-av)
// Only map videos that exist. Uncomment as you generate them with Grok.
// Naming convention: assets/video/{avatar}-freedom-{bracket}.mp4
export const AVATAR_VIDEOS: Partial<Record<AvatarType, Partial<Record<FreedomState, any>>>> = {
  'male-medium': {
    drowning: require('../../assets/video/male-freedom-0-20.mp4'),
    struggling: require('../../assets/video/male-freedom-20-40.mp4'),
    breaking: require('../../assets/video/male-freedom-40-60.mp4'),
    rising: require('../../assets/video/male-freedom-60-80.mp4'),
    enthroned: require('../../assets/video/male-freedom-80-100.mp4'),
  },
  'female-medium': {
    drowning: require('../../assets/video/male-freedom-0-20.mp4'),
    struggling: require('../../assets/video/male-freedom-0-20.mp4'),
    breaking: require('../../assets/video/male-freedom-0-20.mp4'),
    rising: require('../../assets/video/male-freedom-0-20.mp4'),
    // enthroned:  require('../../assets/video/female-medium-freedom-80-100.mp4'),
  },
  'male-dark': {
    drowning: require('../../assets/video/male-freedom-0-20.mp4'),
    struggling: require('../../assets/video/male-freedom-20-40.mp4'),
    breaking: require('../../assets/video/male-freedom-40-60.mp4'),
    rising: require('../../assets/video/male-freedom-60-80.mp4'),
    enthroned: require('../../assets/video/male-freedom-80-100.mp4'),
  },
};

// Avatar preview images (for selection)
export const AVATAR_PREVIEWS: Record<AvatarType, any> = {
  'male-medium': require('../../assets/images/freedom-40-60-male-medium.png'),
  'female-medium': require('../../assets/images/freedom-40-60-female-medium.png'),
  'male-dark': require('../../assets/images/freedom-40-60-male-dark.png'),
};

// API endpoints
export const API_ENDPOINTS = {
  HELIUS_RPC: process.env.EXPO_PUBLIC_HELIUS_RPC || 'https://mainnet.helius-rpc.com',
  HELIUS_ORB: process.env.EXPO_PUBLIC_HELIUS_ORB || 'https://api.helius.xyz/v0',
  CLAUDE_API: 'https://api.anthropic.com/v1/messages',
} as const;

// API Keys (will be set via environment variables)
export const API_KEYS = {
  HELIUS: process.env.EXPO_PUBLIC_HELIUS_API_KEY || '',
  CLAUDE: process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '',
} as const;

// Default values for new user
export const DEFAULT_USER_PROFILE = {
  wallets: [],
  income: {
    salary: 0,
    otherIncome: 0,
    assetIncome: 0,
  },
  assets: [],
  obligations: [],
  desires: [],
  debts: [],
  freedomHistory: [],
  settings: {
    avatarType: 'male-medium' as AvatarType,
    animatedAvatar: false,
    notificationsEnabled: true,
    syncFrequency: 'hourly' as const,
    darkMode: true,
  },
  onboardingComplete: false,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_PROFILE: '@kingme:user_profile',
  ENCRYPTION_KEY: '@kingme:encryption_key',
  LAST_SYNC: '@kingme:last_sync',
} as const;

// Obligation categories with display names
export const OBLIGATION_CATEGORIES = {
  housing: 'Housing',
  utilities: 'Utilities',
  insurance: 'Insurance',
  debt_service: 'Debt Service',
  daily_living: 'Daily Living',
  other: 'Other',
} as const;

// Drift trading: minimum USDC collateral to keep in account
export const DRIFT_MIN_COLLATERAL_USD = 500;

// Default APYs for opportunity cost calculations
export const DEFAULT_APYS = {
  STABLECOIN: 0.08, // 8% for stablecoin yields
  STAKING_SOL: 0.07, // 7% for SOL staking
} as const;

// Colors (you can expand this based on your design)
export const COLORS = {
  // Freedom states
  drowning: '#1a3a52',
  struggling: '#2d5f7a',
  breaking: '#4a8ba8',
  rising: '#7bb8d4',
  enthroned: '#f4c430', // Gold for throne

  // UI colors
  primary: '#f4c430',
  background: '#0a0e1a',
  surface: '#1a1f2e',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
} as const;

// Notification messages
export const NOTIFICATIONS = {
  FREEDOM_INCREASED: '🎉 Your freedom increased!',
  MILESTONE_REACHED: '👑 You reached a new milestone!',
  IDLE_ASSETS: '💡 You have idle assets. Deploy them to increase freedom.',
  DESIRE_AFFORDABLE: '✅ You can now afford your desire!',
  LOW_FREEDOM: '⚠️ Your freedom is low. Review your obligations.',
} as const;

// Celebration milestones (in days)
export const MILESTONES = [
  30,   // 1 month
  90,   // 3 months
  180,  // 6 months
  365,  // 1 year
  730,  // 2 years
  1825, // 5 years
  3650, // 10 years
] as const;
