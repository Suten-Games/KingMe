// app/_layout.tsx - FIXED VERSION
import { Stack } from 'expo-router';
import { WalletProvider } from '@/providers/wallet-provider';

// ✅ CRITICAL: Import polyfills FIRST, before any other imports
import '../src/polyfills';

export default function RootLayout() {
  return (
    <WalletProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </WalletProvider>
  );
}
