// app/index.tsx
import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();
  const [isLoading, setIsLoading] = useState(true);
  const onboardingComplete = useStore((state) => state.onboardingComplete);
  const loadProfile = useStore((state) => state.loadProfile);
  
  useEffect(() => {
    // Load profile on app start
    const initApp = async () => {
      await loadProfile('temp'); // Doesn't need wallet for now
      
      // Check if we need to reset monthly payments
      const lastReset = await AsyncStorage.getItem('lastPaymentReset');
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
      
      if (lastReset !== currentMonth) {
        useStore.getState().resetMonthlyPayments();
        await AsyncStorage.setItem('lastPaymentReset', currentMonth);
      }

      // Auto-match obligations/debts with bank transactions
      useStore.getState().reconcilePayments();

      setIsLoading(false);
    };
    
    initApp().catch((err) => {
      console.error('[Init] Failed to load app:', err);
      setIsLoading(false); // Let routing proceed even on error
    });
  }, []);
  
  useEffect(() => {
    // Only redirect if we're done loading and at the root
    if (!isLoading && segments.length === 0) {
      if (!onboardingComplete) {
        router.replace('/onboarding/intro');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isLoading, onboardingComplete, segments]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#f4c430" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#f4c430" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
