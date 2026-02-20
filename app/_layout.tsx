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
import BadgeToast from '../src/components/BadgeToast';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useBadgeChecker();

  // Show splash while fonts load
  if (!fontsLoaded) {
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
            contentStyle: { backgroundColor: '#0a0e1a' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="asset/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="bank/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="debt/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="trading" options={{ title: 'Trading' }} />
          <Stack.Screen name="expenses" options={{ title: 'Daily Expenses' }} />
          <Stack.Screen name="business" options={{ headerShown: false }} />
          <Stack.Screen name="divorce-simulator" options={{ headerShown: false }} />
          <Stack.Screen name="badges" options={{ title: 'Badges' }} />
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
