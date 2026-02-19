// app/onboarding/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, Platform } from 'react-native';

export default function OnboardingLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#0a0e1a' },
        headerTintColor: '#f4c430',
        headerTitleStyle: { color: '#0a0e1a', fontSize: 0 }, // hide title
        headerShadowVisible: false,
        headerTitle: '',
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingVertical: 8, paddingRight: 16 }}
            >
              <Text style={{ color: '#f4c430', fontSize: 16, fontWeight: '600' }}>
                ‹ Back
              </Text>
            </TouchableOpacity>
          ) : null,
        contentStyle: { backgroundColor: '#0a0e1a' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
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
