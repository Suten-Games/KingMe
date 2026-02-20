// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WalletHeaderButton from '../../src/components/WalletHeaderButton';

function TabBarHeader() {
  return (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerInner}>
        <Image
          source={require('../../src/assets/images/kingmelogo.jpg')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>KingMe</Text>
        <View style={{ flex: 1 }} />
        <WalletHeaderButton />
      </View>
      <LinearGradient
        colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerAccent}
      />
    </LinearGradient>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={styles.tabIconWrapper}>
      {focused && <View style={styles.tabIconGlow} />}
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{emoji}</Text>
      {focused && <View style={styles.tabActiveBar} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <TabBarHeader />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#f4c430',
          tabBarInactiveTintColor: '#555',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
        <Tabs.Screen name="income" options={{ title: 'Income', tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} /> }} />
        <Tabs.Screen name="assets" options={{ title: 'Assets', tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} /> }} />
        <Tabs.Screen name="obligations" options={{ title: 'Obligations', tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
        <Tabs.Screen name="debts" options={{ title: 'Debts', tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} /> }} />
        <Tabs.Screen name="desires" options={{ title: 'Desires', tabBarIcon: ({ focused }) => <TabIcon emoji="✨" focused={focused} /> }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: '#f4c430',
    letterSpacing: 0.5,
  },
  headerAccent: {
    height: 1.5,
    marginTop: 14,
    borderRadius: 1,
  },

  // Tab bar
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

  // Tab icon with glow
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 44,
    height: 36,
  },
  tabIconText: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconTextActive: {
    opacity: 1,
    fontSize: 24,
  },
  tabIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4c43018',
    top: -2,
  },
  tabActiveBar: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#f4c430',
  },
});
