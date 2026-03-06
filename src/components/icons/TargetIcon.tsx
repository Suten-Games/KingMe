// src/components/icons/TargetIcon.tsx
// Custom crosshair/target icon — replaces generic emoji

import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface TargetIconProps {
  size?: number;
  color?: string;
}

export default function TargetIcon({ size = 20, color = '#4ade80' }: TargetIconProps) {
  const sw = size > 16 ? 2 : 1.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer ring */}
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
      {/* Inner ring */}
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={sw} />
      {/* Center dot */}
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      {/* Crosshair lines */}
      <Line x1="12" y1="0.5" x2="12" y2="4" stroke={color} strokeWidth={sw} />
      <Line x1="12" y1="20" x2="12" y2="23.5" stroke={color} strokeWidth={sw} />
      <Line x1="0.5" y1="12" x2="4" y2="12" stroke={color} strokeWidth={sw} />
      <Line x1="20" y1="12" x2="23.5" y2="12" stroke={color} strokeWidth={sw} />
    </Svg>
  );
}
