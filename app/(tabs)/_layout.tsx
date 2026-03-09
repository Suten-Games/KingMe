// app/(tabs)/_layout.tsx
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WalletHeaderButton from '../../src/components/WalletHeaderButton';
import {
  HomeIcon, IncomeIcon, AssetsIcon,
  ObligationsIcon, DebtsIcon, DesiresIcon,
} from '../../src/components/TabIcons';

// ── Header ───────────────────────────────────────────────────────────────────

function TabBarHeader() {
  const [fontsLoaded] = useFonts({
    Cinzel_700Bold,
  });
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={styles.headerInner}>
        {/* Logo + logotype — tap to go home */}
        <TouchableOpacity
          style={styles.headerBrand}
          activeOpacity={0.7}
          onPress={() => router.replace('/')}
        >
          <Image
            source={require('../../src/assets/images/kingmelogo.jpg')}
            style={styles.headerLogo}
            contentFit="cover"
          />

          <MaskedView
            maskElement={
              <Text style={[
                styles.headerTitle,
                fontsLoaded && { fontFamily: 'Cinzel_700Bold' }
              ]}>
                KingMe
              </Text>
            }
          >
            <LinearGradient
              colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[
                styles.headerTitle,
                fontsLoaded && { fontFamily: 'Cinzel_700Bold' },
                { opacity: 0 }
              ]}>
                KingMe
              </Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>

        <WalletHeaderButton />
      </View>

      {/* Gold accent line */}
      <LinearGradient
        colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerAccent}
      />
    </LinearGradient>
  );
}

// ── Tab icon wrapper ──────────────────────────────────────────────────────────

function TabIcon({
  Icon,
  focused,
}: {
  Icon: React.ComponentType<{ color: string; size?: number }>;
  focused: boolean;
}) {
  const color = focused ? '#f4c430' : '#4a4f60';
  return (
    <View style={styles.tabIconWrapper}>
      {focused && <View style={styles.tabIconGlow} />}
      <Icon color={color} size={focused ? 24 : 22} />
      {focused && <View style={styles.tabActiveBar} />}
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <>
      <TabBarHeader />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#f4c430',
          tabBarInactiveTintColor: '#4a4f60',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index"       options={{ title: 'Home',        tabBarIcon: ({ focused }) => <TabIcon Icon={HomeIcon}        focused={focused} /> }} />
        <Tabs.Screen name="income"      options={{ title: 'Income',      tabBarIcon: ({ focused }) => <TabIcon Icon={IncomeIcon}      focused={focused} /> }} />
        <Tabs.Screen name="assets"      options={{ title: 'Assets',      tabBarIcon: ({ focused }) => <TabIcon Icon={AssetsIcon}      focused={focused} /> }} />
        <Tabs.Screen name="obligations" options={{ title: 'Obligations', tabBarIcon: ({ focused }) => <TabIcon Icon={ObligationsIcon} focused={focused} /> }} />
        <Tabs.Screen name="debts"       options={{ title: 'Debts',       tabBarIcon: ({ focused }) => <TabIcon Icon={DebtsIcon}       focused={focused} /> }} />
        <Tabs.Screen name="desires"     options={{ title: 'Desires',     tabBarIcon: ({ focused }) => <TabIcon Icon={DesiresIcon}     focused={focused} /> }} />
      </Tabs>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold', // fallback until Playfair loads
    color: '#f4c430',                 // fallback color (masked out when font loads)
    letterSpacing: 1.5,
    lineHeight: 34,
  },
  headerAccent: {
    height: 1.5,
    marginTop: 12,
    borderRadius: 1,
  },

  // ── Tab bar ──
  tabBar: {
    backgroundColor: '#080c18',
    borderTopWidth: 1,
    borderTopColor: '#1a204080',
    height: 88,
    paddingBottom: 26,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // ── Tab icon ──
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 44,
    height: 36,
  },
  tabIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4c43015',
    top: -2,
  },
  tabActiveBar: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#f4c430',
  },
});
