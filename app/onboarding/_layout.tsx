// app/onboarding/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { T } from '../../src/theme';
import WalletHeaderButton from '../../src/components/WalletHeaderButton';

function OnboardingHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  return (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      style={[s.kmHeader, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={s.kmHeaderRow}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={s.kmBackButton}
        >
          <Text style={s.kmBackText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.kmBrand} activeOpacity={0.7} onPress={() => router.replace('/')}>
          <Image
            source={require('../../src/assets/images/kingmelogo.jpg')}
            style={s.kmLogo}
            resizeMode="cover"
          />
          <MaskedView
            maskElement={
              <Text style={[s.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>
                KingMe
              </Text>
            }
          >
            <LinearGradient
              colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text
                style={[s.kmTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}
              >
                KingMe
              </Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>
        <View style={{ marginLeft: 'auto' }}>
          <WalletHeaderButton />
        </View>
      </View>
      <LinearGradient
        colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.kmAccent}
      />
    </LinearGradient>
  );
}

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <OnboardingHeader />,
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

const s = StyleSheet.create({
  kmHeader: {
    paddingBottom: 0,
  },
  kmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  kmBackButton: {
    paddingRight: 4,
    paddingVertical: 4,
  },
  kmBackText: {
    color: '#f4c430',
    fontSize: 22,
    fontWeight: '600',
  },
  kmBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kmLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  kmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f4c430',
    letterSpacing: 1,
  },
  kmAccent: {
    height: 1.5,
    borderRadius: 1,
  },
});
