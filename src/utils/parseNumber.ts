// src/utils/parseNumber.ts
// Safely parse user-entered numbers that may contain commas (e.g. "74,000" → 74000)

export function parseNumber(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
