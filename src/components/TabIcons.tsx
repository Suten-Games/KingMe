// src/components/TabIcons.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Custom SVG tab bar icons — royalty/chess themed, stroke-based, dark-bg optimized
// Each icon accepts color (active=#f4c430, inactive=#555) and size (default 24)
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Svg, { Path, Circle, Rect, G, Line, Polygon } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

const SW = 1.6; // stroke width — consistent across all icons

// ── Home — Castle keep with battlements ─────────────────────────────────────
export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Battlements — 3 merlons */}
      <Rect x="4" y="3" width="3" height="3.5" rx="0.5" fill={color} />
      <Rect x="10.5" y="3" width="3" height="3.5" rx="0.5" fill={color} />
      <Rect x="17" y="3" width="3" height="3.5" rx="0.5" fill={color} />
      {/* Left wall connecting battlements */}
      <Path d="M4 5.5 L4 13" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Right wall */}
      <Path d="M20 5.5 L20 13" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Top connecting bar */}
      <Path d="M4 6.5 L7 6.5 M10.5 6.5 L13.5 6.5 M17 6.5 L20 6.5" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Main tower body */}
      <Path d="M4 13 L4 21 L20 21 L20 13 Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" fill="none" />
      {/* Arch gate */}
      <Path d="M10 21 L10 16.5 Q12 14 14 16.5 L14 21" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Arrow slit windows */}
      <Line x1="8" y1="15" x2="8" y2="18" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      <Line x1="16" y1="15" x2="16" y2="18" stroke={color} strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

// ── Income — Rising staircase of coins with upward arrow ─────────────────────
export function IncomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Three ascending coin stacks */}
      <Rect x="2" y="17" width="5" height="4" rx="1" stroke={color} strokeWidth={SW} />
      <Rect x="9.5" y="13" width="5" height="8" rx="1" stroke={color} strokeWidth={SW} />
      <Rect x="17" y="9" width="5" height="12" rx="1" stroke={color} strokeWidth={SW} />
      {/* Upward arrow */}
      <Path d="M19.5 6 L19.5 2 M17.5 4 L19.5 2 L21.5 4" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Assets — Diamond / gem (treasure) ───────────────────────────────────────
export function AssetsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Diamond outline */}
      <Path
        d="M12 2 L22 9 L12 22 L2 9 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Upper facet line */}
      <Path d="M2 9 L8 9 L12 2 L16 9 L22 9" stroke={color} strokeWidth={SW} strokeLinejoin="round" />
      {/* Center facets */}
      <Path d="M8 9 L12 22 L16 9" stroke={color} strokeWidth={SW} strokeLinejoin="round" />
    </Svg>
  );
}

// ── Obligations — Scroll / contract with seal ────────────────────────────────
export function ObligationsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Scroll body */}
      <Rect x="5" y="4" width="14" height="16" rx="2" stroke={color} strokeWidth={SW} fill="none" />
      {/* Scroll curl top */}
      <Path d="M5 6 Q3 6 3 8 Q3 10 5 10" stroke={color} strokeWidth={SW} strokeLinecap="round" fill="none" />
      {/* Scroll curl bottom */}
      <Path d="M19 18 Q21 18 21 16 Q21 14 19 14" stroke={color} strokeWidth={SW} strokeLinecap="round" fill="none" />
      {/* Text lines */}
      <Line x1="8" y1="9" x2="16" y2="9" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Checkmark on bottom line */}
      <Path d="M8 15.5 L10 17.5 L14 14" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Debts — Anchor (weight, obligation pulling you down) ─────────────────────
export function DebtsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Ring at top */}
      <Circle cx="12" cy="5" r="2" stroke={color} strokeWidth={SW} fill="none" />
      {/* Vertical shaft */}
      <Line x1="12" y1="7" x2="12" y2="19" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Crossbar */}
      <Line x1="7" y1="10" x2="17" y2="10" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Left arc */}
      <Path d="M7 10 Q3 14 7 19" stroke={color} strokeWidth={SW} strokeLinecap="round" fill="none" />
      {/* Right arc */}
      <Path d="M17 10 Q21 14 17 19" stroke={color} strokeWidth={SW} strokeLinecap="round" fill="none" />
      {/* Flukes — left */}
      <Path d="M7 19 L5 17 M7 19 L9 17" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      {/* Flukes — right */}
      <Path d="M17 19 L15 17 M17 19 L19 17" stroke={color} strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

// ── Crown — used as section icon for accumulation plans ──────────────────────
export function CrownIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Base band */}
      <Path d="M4 17 L20 17 L20 20 Q12 22 4 20 Z" fill={color} opacity={0.9} />
      {/* Crown body — 5 points */}
      <Path
        d="M4 17 L4 10 L8 14 L12 6 L16 14 L20 10 L20 17 Z"
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      {/* Gems — three dots on the points */}
      <Circle cx="12" cy="6.5" r="1.2" fill={color} opacity={0.6} />
      <Circle cx="4.2" cy="10.5" r="1" fill={color} opacity={0.5} />
      <Circle cx="19.8" cy="10.5" r="1" fill={color} opacity={0.5} />
    </Svg>
  );
}

// ── Desires — 8-pointed compass star (aspiration, direction) ─────────────────
export function DesiresIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cardinal points — 4 long spikes */}
      <Path d="M12 2 L13.5 10.5 L12 12 L10.5 10.5 Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" fill={color} fillOpacity="0.25" />
      <Path d="M22 12 L13.5 13.5 L12 12 L13.5 10.5 Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" fill={color} fillOpacity="0.25" />
      <Path d="M12 22 L10.5 13.5 L12 12 L13.5 13.5 Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" fill={color} fillOpacity="0.25" />
      <Path d="M2 12 L10.5 10.5 L12 12 L10.5 13.5 Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" fill={color} fillOpacity="0.25" />
      {/* Intercardinal points — 4 shorter spikes */}
      <Path d="M19.5 4.5 L13.8 10.5 L13.5 10.5 L13.5 13.5 L19.5 19.5" stroke={color} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <Path d="M4.5 4.5 L10.5 10.5 L10.5 13.5 L4.5 19.5" stroke={color} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      {/* Center dot */}
      <Circle cx="12" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}
