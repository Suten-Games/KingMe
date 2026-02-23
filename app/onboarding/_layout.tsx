// app/onboarding/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, Platform } from 'react-native';
import { T } from '../../src/theme';

export default function OnboardingLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: T.bg },
        headerTintColor: T.gold,
        headerTitleStyle: { color: T.bg, fontSize: 0 },
        headerShadowVisible: false,
        headerTitle: '',
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingVertical: 8, paddingRight: 16 }}
            >
              <Text style={{ color: T.gold, fontSize: 16, fontWeight: '600' }}>
                ‹ Back
              </Text>
            </TouchableOpacity>
          ) : null,
        contentStyle: { backgroundColor: T.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="intro" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="bank-accounts" />
      <Stack.Screen name="income-sources" />
      <Stack.Screen name="obligations" />
      <Stack.Screen name="cashflow-check" />
      <Stack.Screen name="income" />
      <Stack.Screen name="assets" />
      <Stack.Screen name="debts" />
      <Stack.Screen name="reveal" options={{ headerShown: false }} />
    </Stack>
  );
}
