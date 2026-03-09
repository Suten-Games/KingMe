// app/wallet-setup.tsx
// Guide page for connecting or creating a Solana wallet

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWallet } from '@/providers/wallet-provider';
import SubpageHeader from '../src/components/SubpageHeader';
import KingMeFooter from '../src/components/KingMeFooter';
import { isSeeker } from '@/utils/device';
import { useStore } from '@/store/useStore';
import Svg, { Path, Rect } from 'react-native-svg';

const isWeb = Platform.OS === 'web';

function GoogleLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleLogo({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.33 8.72 9.07c1.28.07 2.17.74 2.92.8.95-.19 1.86-.88 2.91-.8 1.23.1 2.15.59 2.75 1.49-2.5 1.5-1.9 4.83.4 5.77-.46 1.16-.97 2.31-1.71 3.28l.06.67zM12.03 9c-.13-2.22 1.66-4.14 3.74-4.3.28 2.39-2.14 4.5-3.74 4.3z" fill={color} />
    </Svg>
  );
}

interface WalletGuide {
  name: string;
  emoji: string;
  icon?: React.ReactNode;
  description: string;
  platforms: string;
  url: string;
  color: string;
  recommended?: boolean;
}

const WALLET_GUIDES: WalletGuide[] = isWeb ? [
  {
    name: 'Jupiter',
    emoji: '\u{1FA90}',
    description: 'The leading Solana DEX aggregator — now with a built-in wallet extension. Swap, DCA, and limit orders baked in.',
    platforms: 'Chrome, Brave, Edge',
    url: 'https://www.jup.ag/download-extension',
    color: '#c7f284',
    recommended: true,
  },
  {
    name: 'Phantom',
    emoji: '\u{1F47B}',
    description: 'The most popular Solana wallet. Install the browser extension to connect instantly.',
    platforms: 'Chrome, Brave, Firefox, Edge',
    url: 'https://phantom.app/download',
    color: '#ab9ff2',
  },
  {
    name: 'Solflare',
    emoji: '\u{1F506}',
    description: 'Feature-rich Solana wallet with built-in staking and DeFi support.',
    platforms: 'Chrome, Brave, Firefox',
    url: 'https://solflare.com/download',
    color: '#fc8c03',
  },
  {
    name: 'Backpack',
    emoji: '\u{1F392}',
    description: 'Multi-chain wallet by the Coral team. Clean interface, xNFT support.',
    platforms: 'Chrome, Brave',
    url: 'https://backpack.app/downloads',
    color: '#e33e3f',
  },
] : isSeeker ? [
  {
    name: 'Seed Vault Wallet',
    emoji: '\u{1F331}',
    description: 'Your Seeker has a built-in Solana wallet. Connect with one tap — no downloads needed.',
    platforms: 'Seeker',
    url: '',
    color: '#9945FF',
    recommended: true,
  },
  {
    name: 'Sign in with Google/Apple',
    emoji: '',
    icon: <View style={{ flexDirection: 'row', gap: 4 }}><GoogleLogo size={14} /><AppleLogo size={14} /></View>,
    description: 'Or create a separate wallet using Privy. Just sign in.',
    platforms: 'In-app',
    url: '',
    color: '#4ade80',
  },
] : [
  {
    name: 'Phantom',
    emoji: '\u{1F47B}',
    description: 'The most popular Solana wallet. Create a wallet in seconds with Google or Apple sign-in.',
    platforms: 'iOS, Android',
    url: 'https://phantom.app/download',
    color: '#ab9ff2',
    recommended: true,
  },
  {
    name: 'Solflare',
    emoji: '\u{1F506}',
    description: 'Full-featured Solana wallet with staking and DeFi built in.',
    platforms: 'iOS, Android',
    url: 'https://solflare.com/download',
    color: '#fc8c03',
  },
  {
    name: 'Sign in with Google/Apple',
    emoji: '\u{1F511}',
    description: 'No extension needed. KingMe creates a secure wallet for you using Privy. Just sign in.',
    platforms: 'In-app',
    url: '',
    color: '#4ade80',
    recommended: true,
  },
];

export default function WalletSetupPage() {
  const router = useRouter();
  const { connect, connected } = useWallet();
  const hasNavigated = useRef(false);

  // Auto-navigate home after wallet connects
  useEffect(() => {
    if (connected && !hasNavigated.current) {
      hasNavigated.current = true;
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [connected]);

  const handleWalletAction = async (guide: WalletGuide) => {
    if (guide.url === '') {
      // In-app Privy wallet creation — just trigger connect
      try {
        await connect();
      } catch {}
      return;
    }
    Linking.openURL(guide.url);
  };

  return (
    <View style={s.container}>
      <SubpageHeader />

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* Hero */}
        <View style={s.hero}>
          <Image source={require('../src/assets/images/kingmelogo.jpg')} style={s.heroLogo} resizeMode="contain" />
          <Text style={s.heroTitle}>Connect a Solana Wallet</Text>
          <Text style={s.heroSub}>
            A wallet lets KingMe auto-track your crypto, enable encrypted cloud backup, and access DeFi features like swaps and lending.
          </Text>
        </View>

        {connected && (
          <View style={s.connectedBanner}>
            <Text style={s.connectedEmoji}>{'\u2705'}</Text>
            <Text style={s.connectedText}>Wallet connected! You're all set.</Text>
          </View>
        )}

        {/* Why connect */}
        <View style={s.whySection}>
          <Text style={s.whyTitle}>Why connect a wallet?</Text>
          <View style={s.whyItem}>
            <Text style={s.whyEmoji}>{'\u{1F4CA}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.whyLabel}>Auto-track crypto</Text>
              <Text style={s.whyDesc}>Your SOL, tokens, and DeFi positions sync automatically</Text>
            </View>
          </View>
          <View style={s.whyItem}>
            <Text style={s.whyEmoji}>{'\u{1F512}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.whyLabel}>Encrypted cloud backup</Text>
              <Text style={s.whyDesc}>Your profile is encrypted with your wallet and stored securely</Text>
            </View>
          </View>
          <View style={s.whyItem}>
            <Text style={s.whyEmoji}>{'\u{1F4B1}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.whyLabel}>Swap & earn</Text>
              <Text style={s.whyDesc}>Access Jupiter swaps and Kamino lending directly in the app</Text>
            </View>
          </View>
        </View>

        {/* Wallet options */}
        <Text style={s.sectionTitle}>
          {isWeb ? 'Install a Browser Extension' : 'Get a Wallet'}
        </Text>

        {WALLET_GUIDES.map(guide => (
          <TouchableOpacity
            key={guide.name}
            style={[s.walletCard, guide.recommended && { borderColor: guide.color + '60' }]}
            onPress={() => handleWalletAction(guide)}
            activeOpacity={0.7}
          >
            {guide.icon ? <View style={s.walletIconWrap}>{guide.icon}</View> : <Text style={s.walletEmoji}>{guide.emoji}</Text>}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.walletName, { color: guide.color }]}>{guide.name}</Text>
                {guide.recommended && (
                  <View style={[s.recBadge, { backgroundColor: guide.color + '20', borderColor: guide.color + '40' }]}>
                    <Text style={[s.recBadgeText, { color: guide.color }]}>Recommended</Text>
                  </View>
                )}
              </View>
              <Text style={s.walletDesc}>{guide.description}</Text>
              <Text style={s.walletPlatforms}>{guide.platforms}</Text>
            </View>
            <Text style={[s.walletArrow, { color: guide.color }]}>{guide.url ? '\u203A' : '\u2192'}</Text>
          </TouchableOpacity>
        ))}

        {/* Already have one? */}
        {!connected && (
          <>
            <TouchableOpacity style={s.connectBtn} onPress={() => connect()} activeOpacity={0.7}>
              <Text style={s.connectBtnText}>I already have a wallet — Connect now</Text>
            </TouchableOpacity>

            {!isSeeker && (
              <TouchableOpacity
                style={s.declineBtn}
                onPress={() => {
                  useStore.setState((st) => ({
                    settings: { ...st.settings, walletDeclined: true },
                  }));
                  useStore.getState().saveProfile();
                  router.canGoBack() ? router.back() : router.replace('/(tabs)');
                }}
                activeOpacity={0.7}
              >
                <Text style={s.declineBtnText}>Skip — I don't need a wallet right now</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {isWeb && (
          <View style={s.helpNote}>
            <Text style={s.helpNoteTitle}>How it works</Text>
            <Text style={s.helpNoteText}>
              1. Install one of the browser extensions above{'\n'}
              2. Create a wallet (takes 30 seconds){'\n'}
              3. Come back to KingMe and click "Connect Wallet"{'\n'}
              4. Approve the connection in the extension popup
            </Text>
          </View>
        )}

        <KingMeFooter />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  heroLogo: { width: 56, height: 56, borderRadius: 12, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#e8e0d0', marginBottom: 8 },
  heroSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, maxWidth: 360 },

  // Connected
  connectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#4ade8015', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#4ade8040', marginBottom: 16,
  },
  connectedEmoji: { fontSize: 20 },
  connectedText: { fontSize: 15, fontWeight: '700', color: '#4ade80' },

  // Why section
  whySection: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 20 },
  whyTitle: { fontSize: 16, fontWeight: '700', color: '#e8e0d0', marginBottom: 14 },
  whyItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  whyEmoji: { fontSize: 20, marginTop: 2 },
  whyLabel: { fontSize: 14, fontWeight: '700', color: '#c0c0c0' },
  whyDesc: { fontSize: 12, color: '#888', marginTop: 2, lineHeight: 17 },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e8e0d0', marginBottom: 12 },

  // Wallet cards
  walletCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#2a3050',
  },
  walletEmoji: { fontSize: 28 },
  walletIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  walletName: { fontSize: 16, fontWeight: '700' },
  walletDesc: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 17 },
  walletPlatforms: { fontSize: 11, color: '#555', marginTop: 4 },
  walletArrow: { fontSize: 24, fontWeight: '300' },
  recBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  recBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Connect button
  connectBtn: {
    backgroundColor: '#f4c430', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 10, marginBottom: 20,
  },
  connectBtnText: { fontSize: 15, fontWeight: '700', color: '#0a0e1a' },
  declineBtn: {
    alignItems: 'center', paddingVertical: 14, marginBottom: 20,
  },
  declineBtnText: { fontSize: 13, color: '#666' },

  // Help note
  helpNote: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a3050',
  },
  helpNoteTitle: { fontSize: 14, fontWeight: '700', color: '#e8e0d0', marginBottom: 8 },
  helpNoteText: { fontSize: 13, color: '#888', lineHeight: 22 },
});
