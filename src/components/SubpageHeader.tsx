// src/components/SubpageHeader.tsx
// Shared header for all subpages — matches the tab header style
// with a back button added. Keeps KingMe branding consistent.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import WalletHeaderButton from './WalletHeaderButton';

interface SubpageHeaderProps {
  /** Hide the wallet button (e.g., on the wallet-setup page itself) */
  hideWallet?: boolean;
}

export default function SubpageHeader({ hideWallet }: SubpageHeaderProps) {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#10162a', '#0c1020', '#080c18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}
    >
      <View style={styles.headerInner}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>

        {/* Logo + logotype */}
        <TouchableOpacity
          style={styles.headerBrand}
          activeOpacity={0.7}
          onPress={() => router.replace('/')}
        >
          <Image
            source={require('../assets/images/kingmelogo.jpg')}
            style={styles.headerLogo}
            contentFit="cover"
          />

          <MaskedView
            maskElement={
              <Text style={[
                styles.headerTitle,
                fontsLoaded && { fontFamily: 'Cinzel_700Bold' },
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
                { opacity: 0 },
              ]}>
                KingMe
              </Text>
            </LinearGradient>
          </MaskedView>
        </TouchableOpacity>

        {!hideWallet && <WalletHeaderButton />}
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
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: '#f4c430',
    fontWeight: '300',
    marginTop: -2,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
    color: '#f4c430',
    letterSpacing: 1.5,
    lineHeight: 30,
    fontWeight: '800',
  },
  headerAccent: {
    height: 1.5,
    marginTop: 12,
    borderRadius: 1,
  },
});
