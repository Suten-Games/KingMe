// src/providers/PrivyWrapper.tsx
// Web: no-op passthrough — Privy Expo SDK is mobile-only
import React, { ReactNode } from 'react';

export function PrivyWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
