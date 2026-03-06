// app/_layout.tsx
import '../src/polyfills';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Stack } from 'expo-router';
import { WalletProvider } from '@/providers/wallet-provider';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { PrivyWrapper } from '@/providers/PrivyWrapper';
import { useBadgeChecker } from '../src/hooks/useBadgeChecker';
import { useAutoBackup } from '../src/hooks/useAutoBackup';
import BadgeToast from '../src/components/BadgeToast';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import { inject } from '@vercel/analytics';
import { useStore } from '../src/store/useStore';

/** Runs hooks that depend on WalletProvider context. */
function WalletHooks() {
  useAutoBackup();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Hydrate store from AsyncStorage on any route (not just index)
  const isLoaded = useStore((s) => s._isLoaded);
  const loadProfile = useStore((s) => s.loadProfile);
  const [hydrating, setHydrating] = useState(false);
  useEffect(() => {
    if (!isLoaded && !hydrating) {
      setHydrating(true);
      loadProfile('temp').finally(() => setHydrating(false));
    }
  }, [isLoaded]);

  useBadgeChecker();

  // Inject Vercel Analytics on web
  useEffect(() => { inject(); }, []);

  // Show splash while fonts or store load
  if (!fontsLoaded || !isLoaded) {
    return (
      <View style={splash.container}>
        <Image
          source={require('../src/assets/images/kingmelogo.jpg')}
          style={splash.logo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <PrivyWrapper>
      <BadgeToast />
      <WalletProvider>
        <WalletHooks />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0e1a' },
            headerTintColor: '#f4c430',
            headerTitleStyle: {
              fontFamily: 'Inter_700Bold',
              fontSize: 18,
              color: '#e8e0d0',
            },
            headerShadowVisible: false,
            headerBackTitleVisible: false,
            headerRight: () => <WalletHeaderButton />,
            contentStyle: { backgroundColor: '#0a0e1a' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="asset/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="bank/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="debt/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="trading" options={{ headerShown: false }} />
          <Stack.Screen name="expenses" options={{ title: 'Daily Expenses' }} />
          <Stack.Screen name="business" options={{ headerShown: false }} />
          <Stack.Screen name="divorce-simulator" options={{ headerShown: false }} />
          <Stack.Screen name="companionship" options={{ headerShown: false }} />
          <Stack.Screen name="bank-consolidation" options={{ headerShown: false }} />
          <Stack.Screen name="badges" options={{ title: 'Badges' }} />
          <Stack.Screen name="watchlist" options={{ title: 'Watchlist', headerStyle: { backgroundColor: '#080c18' }, headerTintColor: '#f4c430' }} />
          <Stack.Screen name="goals" options={{ headerShown: false }} />
          <Stack.Screen name="categorize" options={{ headerShown: false }} />
          <Stack.Screen name="spending" options={{ headerShown: false }} />
          <Stack.Screen name="protocol/[name]" options={{ headerShown: false }} />
        </Stack>
      </WalletProvider>
    </PrivyWrapper>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 20,
  },
});
