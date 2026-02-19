// app/+not-found.tsx
// Catches unmatched routes including Phantom deep link callbacks
// The actual deep link processing happens in the Linking listener in wallet-provider.native.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter, usePathname, Stack } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isPhantomCallback = pathname?.includes('phantom-');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }, isPhantomCallback ? 500 : 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.container}>
        {isPhantomCallback ? (
          <ActivityIndicator size="large" color="#f4c430" />
        ) : (
          <>
            <Text style={s.text}>Page not found</Text>
            <Text style={s.sub}>Redirecting...</Text>
          </>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#e8e0d0',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  sub: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
