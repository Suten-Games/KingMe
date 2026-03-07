// src/services/fullBackup.ts
// ══════════════════════════════════════════════════════════════════════
// Comprehensive backup/restore — captures EVERYTHING:
//   1. Zustand store (profile, assets, debts, trades, etc.)
//   2. AsyncStorage satellites (goals, accumulation plans, watchlist, 
//      portfolio snapshots, price data, business data, preferences)
// ══════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, warn, error } from '../utils/logger';

// ── All known AsyncStorage keys used by the app ─────────────────────
const ASYNC_KEYS = [
  // Core features
  'accumulation_plans',
  'kingme_goals',
  'kingme_goals_auto_populated',
  'portfolio_snapshots',
  'price_snapshots',
  'price_watchlist',
  'watchlist_extended',
  'business_dashboard_data',
  'companionship_tracker_data',

  // Preferences & dismissals
  'paid_addons_hidden',
  'paid_addons_unlocked',
  'dismissed_position_alerts',
  'obligations_audit_dismissed',
  'surplus_plan_dismissed',
  'trading_warning_dismissed',
] as const;

export interface FullBackup {
  version: number;                          // schema version for future migrations
  timestamp: string;                        // ISO date of backup
  store: Record<string, any>;               // Zustand store snapshot
  asyncStorage: Record<string, string>;     // All AsyncStorage key-value pairs
}

/**
 * Collect all AsyncStorage satellite data into a plain object.
 * Returns { key: rawJsonString } for each key that has data.
 */
export async function collectAsyncData(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // Multi-get is more efficient than individual gets
  const pairs = await AsyncStorage.multiGet([...ASYNC_KEYS]);

  for (const [key, value] of pairs) {
    if (value != null) {
      result[key] = value;
    }
  }

  log(`[BACKUP] Collected ${Object.keys(result).length} AsyncStorage keys`);
  return result;
}

/**
 * Build a full backup bundle from store state + AsyncStorage.
 * The storeData param should be the raw Zustand state object 
 * (everything you'd pass to saveBackup / exportBackup).
 */
export async function buildFullBackup(storeData: Record<string, any>): Promise<FullBackup> {
  const asyncData = await collectAsyncData();

  return {
    version: 2,
    timestamp: new Date().toISOString(),
    store: storeData,
    asyncStorage: asyncData,
  };
}

/**
 * Restore all AsyncStorage satellite data from a backup bundle.
 * Call this AFTER restoring the Zustand store.
 */
export async function restoreAsyncData(asyncStorage: Record<string, string>): Promise<number> {
  if (!asyncStorage || typeof asyncStorage !== 'object') return 0;

  const entries = Object.entries(asyncStorage);
  if (entries.length === 0) return 0;

  // Multi-set is more efficient
  await AsyncStorage.multiSet(entries);

  log(`[BACKUP] Restored ${entries.length} AsyncStorage keys:`,
    entries.map(([k]) => k).join(', '));
  return entries.length;
}

/**
 * Given a backup object (could be v1 store-only or v2 full), extract the store data.
 * Handles both old format (flat store fields) and new format (wrapped in .store).
 */
export function extractStoreData(backup: any): Record<string, any> {
  // v2 format: { version, store, asyncStorage }
  if (backup?.version >= 2 && backup.store) {
    return backup.store;
  }
  // v1 / legacy format: the entire object IS the store data
  return backup;
}

/**
 * Extract AsyncStorage data from a backup (returns empty object for v1 backups).
 */
export function extractAsyncData(backup: any): Record<string, string> {
  if (backup?.version >= 2 && backup.asyncStorage) {
    return backup.asyncStorage;
  }
  return {};
}

/**
 * Serialize a full backup to JSON string for export/encryption.
 */
export function serializeBackup(backup: FullBackup): string {
  return JSON.stringify(backup);
}

/**
 * Deserialize a backup from JSON string.
 * Handles both v1 (store-only) and v2 (full) formats.
 */
export function deserializeBackup(json: string): { store: Record<string, any>; asyncStorage: Record<string, string> } {
  const parsed = JSON.parse(json);
  return {
    store: extractStoreData(parsed),
    asyncStorage: extractAsyncData(parsed),
  };
}
