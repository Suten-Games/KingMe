// src/providers/PrivyWrapper.native.tsx
// iOS + Android: wraps children with PrivyProvider
import React, { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/expo';

const PRIVY_APP_ID = 'cmls1opux04ua0cjpsnwbi4pf';
const PRIVY_CLIENT_ID = 'client-WY6W3bnWRiaW4eyKZgoPnijFLLc6WBR9M98zZtm54g9PM';

export function PrivyWrapper({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      {children}
    </PrivyProvider>
  );
}
