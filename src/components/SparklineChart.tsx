// src/components/SparklineChart.tsx
// SVG sparkline chart for crypto asset detail page.
// Uses react-native-svg for smooth bezier paths with gradient fill.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

interface DataPoint {
  price: number;
  timestamp: number;
}

interface Props {
  data: DataPoint[];
  width: number;
  height: number;
  showCurrentDot?: boolean;
}

export default function SparklineChart({ data, width, height, showCurrentDot = true }: Props) {
  if (data.length < 2) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Text style={styles.placeholderText}>Not enough data for chart</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const prices = sorted.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#4ade80' : '#ef4444';
  const gradientId = isUp ? 'sparkGradGreen' : 'sparkGradRed';

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Map data to x,y coordinates
  const points = sorted.map((d, i) => ({
    x: padding + (i / (sorted.length - 1)) * chartWidth,
    y: padding + (1 - (d.price - minPrice) / priceRange) * chartHeight,
  }));

  // Build smooth quadratic bezier path
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    linePath += ` Q ${cpX} ${prev.y}, ${curr.x} ${curr.y}`;
  }

  // Closed area path for gradient fill
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.3" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#${gradientId})`} />
        <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
        {showCurrentDot && (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill={lineColor}
            stroke="#0a0e1a"
            strokeWidth={2}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
  },
  placeholderText: {
    fontSize: 12,
    color: '#555',
  },
});
