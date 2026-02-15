// src/theme.ts — shared design tokens for KingMe
// Import this in any screen: import { T } from '@/theme' or '../../src/theme'

export const T = {
  // ── Base backgrounds ─────────────────────────────────────
  bg: '#080c18',
  bgCard: '#0c1020',
  bgCardAlt: '#10162a',

  // ── Borders ──────────────────────────────────────────────
  border: '#2a3050',
  borderSubtle: '#1a2040',

  // ── Accent colors ────────────────────────────────────────
  gold: '#f4c430',
  green: '#4ade80',
  red: '#f87171',
  redBright: '#ff6b6b',
  blue: '#60a5fa',
  purple: '#a78bfa',
  orange: '#fb923c',

  // ── Text ─────────────────────────────────────────────────
  textPrimary: '#ffffff',
  textSecondary: '#b0b0b8',
  textMuted: '#888',
  textDim: '#555',

  // ── Font families ────────────────────────────────────────
  fontRegular: 'Inter_400Regular',
  fontMedium: 'Inter_500Medium',
  fontSemiBold: 'Inter_600SemiBold',
  fontBold: 'Inter_700Bold',
  fontExtraBold: 'Inter_800ExtraBold',

  // ── Gradient presets (3-stop for depth) ──────────────────
  gradients: {
    card:      ['#1e2640', '#161c34', '#0e1224'] as [string, string, string],
    gold:      ['#504010', '#2a2008', '#151005'] as [string, string, string],
    green:     ['#184830', '#0e2818', '#08180c'] as [string, string, string],
    greenDark: ['#103828', '#081c14', '#040e08'] as [string, string, string],
    blue:      ['#142848', '#0c1830', '#081020'] as [string, string, string],
    red:       ['#581818', '#300c0c', '#1a0606'] as [string, string, string],
    purple:    ['#2a1a50', '#1a1030', '#100820'] as [string, string, string],
    orange:    ['#502a10', '#301808', '#1a0c04'] as [string, string, string],
  },

  // ── Border radius ────────────────────────────────────────
  radius: {
    sm: 8,
    md: 14,
    lg: 16,
    xl: 20,
  },

  // ── Common card style base (use with spread) ─────────────
  cardBase: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  } as const,
} as const;
