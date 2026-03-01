// src/providers/useAuthToken.ts
// Unified JWT token helper — works on web and native.
// Both platforms now use @privy-io/expo so this is straightforward.

import { useCallback } from 'react';
import { useWallet } from './wallet-provider';

export function useAuthToken(): () => Promise<string | null> {
  const { getAccessToken } = useWallet();
  return useCallback(async () => {
    try {
      return await getAccessToken();
    } catch {
      return null;
    }
  }, [getAccessToken]);
}

export async function withAuth(
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<RequestInit> {
  const token = await getToken();
  if (!token) return options;
  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };
}
