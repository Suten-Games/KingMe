import { Platform } from 'react-native';

/**
 * Returns the API base URL (no trailing slash, no /api path).
 * Prefers the env var so dev always hits the deployed Vercel API.
 * Falls back to window.location.origin on web (production builds),
 * then localhost for native dev.
 */
export function getApiBase(): string {
  const envUrl = process.env.EXPO_PUBLIC_BACKUP_API_URL;
  if (envUrl) return envUrl.replace(/\/api\/backup\/?$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  console.warn('[apiBase] EXPO_PUBLIC_BACKUP_API_URL not set — API calls will fail');
  return '';
}
