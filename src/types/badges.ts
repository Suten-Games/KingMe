// src/types/badges.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Badge System — Checkers advancement + Ocean survival theme
// "King Me" is checkers. Drowning → Swimming → Surfing is your financial journey.
// ═══════════════════════════════════════════════════════════════════════════════

export type BadgeCategory = 'setup' | 'trading' | 'safety' | 'streak' | 'milestone';
export type BadgeTier = 'pawn' | 'jump' | 'kinged'; // Checkers progression

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;   // How to earn it
  emoji: string;
  category: BadgeCategory;
  tier: BadgeTier;
  celebration: string;   // Toast message when earned
  freedomBoost?: string; // How it helps freedom score
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: number;      // timestamp
  seen: boolean;         // user has seen the toast
}

// ─── All Badge Definitions ───────────────────────────────────────────────────

export const BADGES: BadgeDefinition[] = [
  // ── SETUP: Getting on the Board ──────────────────────────────────────────
  {
    id: 'first_move',
    name: 'First Move',
    description: 'Connect your first Solana wallet',
    emoji: '♟️',
    category: 'setup',
    tier: 'pawn',
    celebration: 'You\'re on the board! Wallet connected.',
    freedomBoost: 'Wallet sync tracks your crypto assets automatically',
  },
  {
    id: 'chart_the_waters',
    name: 'Chart the Waters',
    description: 'Import your first bank statement',
    emoji: '🗺️',
    category: 'setup',
    tier: 'pawn',
    celebration: 'Waters charted! Now KingMe can see your cash flow.',
    freedomBoost: 'Transaction data enables bill tracking and balance alerts',
  },
  {
    id: 'income_tide',
    name: 'Income Tide',
    description: 'Set up your first income source',
    emoji: '🌊',
    category: 'setup',
    tier: 'pawn',
    celebration: 'The tide is rising! Income source locked in.',
    freedomBoost: 'Income tracking is the foundation of your freedom score',
  },
  {
    id: 'know_thy_enemy',
    name: 'Know Thy Enemy',
    description: 'Add your first obligation or debt',
    emoji: '⚔️',
    category: 'setup',
    tier: 'pawn',
    celebration: 'Know thy enemy. You can\'t fight what you can\'t see.',
    freedomBoost: 'Obligation tracking reveals your true monthly burn rate',
  },
  {
    id: 'full_board',
    name: 'Full Board',
    description: 'Complete setup: wallet + bank account + income + obligations',
    emoji: '♔',
    category: 'setup',
    tier: 'kinged',
    celebration: 'Board is set! You have full visibility into your finances.',
    freedomBoost: 'Complete data means accurate freedom score and smart alerts',
  },

  // ── TRADING: Smart Moves ─────────────────────────────────────────────────
  {
    id: 'smart_trim',
    name: 'Smart Trim',
    description: 'Trim a crypto position from an alert',
    emoji: '✂️',
    category: 'trading',
    tier: 'pawn',
    celebration: 'Smart trim! Pigs get fed, hogs get slaughtered.',
    freedomBoost: 'Taking profit protects your gains from volatility',
  },
  {
    id: 'catch_of_the_day',
    name: 'Catch of the Day',
    description: 'Take profit on a position up 30%+',
    emoji: '🐟',
    category: 'trading',
    tier: 'jump',
    celebration: 'Nice catch! Locked in that profit.',
    freedomBoost: 'Realized gains can be deployed to yield or buffer',
  },
  {
    id: 'balanced_board',
    name: 'Balanced Board',
    description: 'No single position is more than 25% of your portfolio',
    emoji: '⚖️',
    category: 'trading',
    tier: 'jump',
    celebration: 'Balanced board! Diversification is your lifeline.',
    freedomBoost: 'Concentration risk is the #1 portfolio killer',
  },
  {
    id: 'cut_bait',
    name: 'Cut Bait',
    description: 'Sell a losing position to prevent bigger losses',
    emoji: '🔪',
    category: 'trading',
    tier: 'pawn',
    celebration: 'Cut bait. Live to fish another day.',
    freedomBoost: 'Cutting losses preserves capital for better opportunities',
  },
  {
    id: 'five_trims',
    name: 'Seasoned Trader',
    description: 'Execute 5 trims or profit-takes',
    emoji: '🎯',
    category: 'trading',
    tier: 'kinged',
    celebration: 'Seasoned trader! You\'re disciplined with your exits.',
    freedomBoost: 'Consistent profit-taking compounds over time',
  },

  // ── SAFETY: Building Your Raft ───────────────────────────────────────────
  {
    id: 'treading_water',
    name: 'Treading Water',
    description: 'First $1,000 in USD* buffer',
    emoji: '🏊',
    category: 'safety',
    tier: 'pawn',
    celebration: 'Head above water! $1K in your safety net.',
    freedomBoost: 'USD* earns 9.34% APY while protecting you',
  },
  {
    id: 'life_vest',
    name: 'Life Vest',
    description: 'Reach 25% of your USD* buffer target',
    emoji: '🦺',
    category: 'safety',
    tier: 'pawn',
    celebration: 'Life vest on! Quarter of your buffer built.',
    freedomBoost: 'Every dollar in the buffer is a day you can weather a storm',
  },
  {
    id: 'strong_swimmer',
    name: 'Strong Swimmer',
    description: 'Reach 50% of your USD* buffer target',
    emoji: '🏄',
    category: 'safety',
    tier: 'jump',
    celebration: 'You\'re surfing now! Halfway to full buffer.',
    freedomBoost: 'Halfway there — your safety net is getting serious',
  },
  {
    id: 'safe_harbor',
    name: 'Safe Harbor',
    description: 'Complete your 3-month USD* buffer',
    emoji: '🏝️',
    category: 'safety',
    tier: 'kinged',
    celebration: 'Safe harbor reached! Full 3-month buffer in USD*.',
    freedomBoost: '3 months of obligations covered — you can survive any storm',
  },
  {
    id: 'debt_slayer',
    name: 'Debt Slayer',
    description: 'Pay off a debt completely',
    emoji: '💀',
    category: 'safety',
    tier: 'jump',
    celebration: 'Debt slayed! One less anchor dragging you down.',
    freedomBoost: 'Eliminating debt directly increases your freedom score',
  },
  {
    id: 'lighter_load',
    name: 'Lighter Load',
    description: 'Remove or reduce an obligation',
    emoji: '🎈',
    category: 'safety',
    tier: 'pawn',
    celebration: 'Lighter load! Less weight means you float higher.',
    freedomBoost: 'Lower obligations = more months of freedom per dollar saved',
  },

  // ── STREAKS: Consistency ─────────────────────────────────────────────────
  {
    id: 'captains_log',
    name: 'Captain\'s Log',
    description: 'Import bank statements 2 weeks in a row',
    emoji: '📓',
    category: 'streak',
    tier: 'pawn',
    celebration: 'Captain\'s log started! Consistency is king.',
    freedomBoost: 'Fresh data keeps your alerts accurate and balance warnings timely',
  },
  {
    id: 'weekly_watch',
    name: 'Weekly Watch',
    description: 'Import bank statements 4 weeks in a row',
    emoji: '🔭',
    category: 'streak',
    tier: 'jump',
    celebration: 'A month of discipline! The watch continues.',
    freedomBoost: 'Monthly consistency means no bills sneak up on you',
  },
  {
    id: 'steady_current',
    name: 'Steady Current',
    description: 'Import bank statements 8 weeks in a row',
    emoji: '🌀',
    category: 'streak',
    tier: 'jump',
    celebration: 'Two months steady! You\'re in the flow now.',
    freedomBoost: 'Sustained tracking builds financial awareness that compounds',
  },
  {
    id: 'crowned',
    name: 'Crowned',
    description: 'Maintain a 12-week import streak',
    emoji: '👑',
    category: 'streak',
    tier: 'kinged',
    celebration: 'CROWNED! 3 months of consistency. You\'ve been kinged.',
    freedomBoost: 'You\'re in the top 1% of people who actually track their money',
  },
  {
    id: 'daily_tide',
    name: 'Daily Tide',
    description: 'Open the app 7 days in a row',
    emoji: '📱',
    category: 'streak',
    tier: 'pawn',
    celebration: 'Daily tide check! Awareness is the first step.',
    freedomBoost: 'Daily check-ins catch problems before they become crises',
  },

  // ── MILESTONES: Freedom Score ────────────────────────────────────────────
  {
    id: 'head_above_water',
    name: 'Head Above Water',
    description: 'Reach 1 month of freedom',
    emoji: '😮‍💨',
    category: 'milestone',
    tier: 'pawn',
    celebration: 'Head above water! You can survive 1 month without income.',
    freedomBoost: '1 month is the minimum safety net — keep building',
  },
  {
    id: 'learning_to_swim',
    name: 'Learning to Swim',
    description: 'Reach 3 months of freedom',
    emoji: '🏊‍♂️',
    category: 'milestone',
    tier: 'jump',
    celebration: 'Learning to swim! 3 months of runway.',
    freedomBoost: '3 months covers most job transitions and emergencies',
  },
  {
    id: 'smooth_sailing',
    name: 'Smooth Sailing',
    description: 'Reach 6 months of freedom',
    emoji: '⛵',
    category: 'milestone',
    tier: 'jump',
    celebration: 'Smooth sailing! Half a year of freedom.',
    freedomBoost: '6 months gives you the power to say no to bad opportunities',
  },
  {
    id: 'island_time',
    name: 'Island Time',
    description: 'Reach 1 year of freedom',
    emoji: '🏝️',
    category: 'milestone',
    tier: 'kinged',
    celebration: 'Island time! A full year of freedom.',
    freedomBoost: '12 months means you can take a year off and not blink',
  },
  {
    id: 'king_of_the_sea',
    name: 'King of the Sea',
    description: 'Reach infinite freedom (asset income ≥ obligations)',
    emoji: '🔱',
    category: 'milestone',
    tier: 'kinged',
    celebration: 'KING OF THE SEA! Your assets cover your life. You\'re free.',
    freedomBoost: 'You did it. Passive income exceeds obligations. Game over. You won.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

export const TIER_COLORS: Record<BadgeTier, { bg: string; border: string; text: string }> = {
  pawn:   { bg: '#1a2040', border: '#60a5fa40', text: '#80b0ff' },
  jump:   { bg: '#2a2010', border: '#f4c43060', text: '#f4c430' },
  kinged: { bg: '#2a1a30', border: '#c084fc60', text: '#c084fc' },
};

export const CATEGORY_LABELS: Record<BadgeCategory, { label: string; emoji: string }> = {
  setup:     { label: 'Getting on the Board', emoji: '♟️' },
  trading:   { label: 'Smart Moves', emoji: '✂️' },
  safety:    { label: 'Building Your Raft', emoji: '🛟' },
  streak:    { label: 'Consistency', emoji: '🔥' },
  milestone: { label: 'Freedom Milestones', emoji: '🏆' },
};
