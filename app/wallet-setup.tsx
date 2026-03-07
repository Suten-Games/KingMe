// app/wallet-setup.tsx
// Guide page for connecting or creating a Solana wallet

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useWallet } from '@/providers/wallet-provider';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import KingMeFooter from '../src/components/KingMeFooter';
import { isSeeker } from '@/utils/device';

const isWeb = Platform.OS === 'web';

interface WalletGuide {
  name: string;
  emoji: string;
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
    emoji: '\u{1F511}',
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
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connect, connected } = useWallet();

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
      <LinearGradient
        colors={['#10162a', '#0c1020', '#080c18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: Math.max(insets.top, 14) }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={s.backBtn}>
            <Text style={s.backText}>{'\u2190'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.brand} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Image source={require('../src/assets/images/kingmelogo.jpg')} style={s.logo} resizeMode="cover" />
            <MaskedView maskElement={<Text style={[s.brandTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }]}>KingMe</Text>}>
              <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={[s.brandTitle, fontsLoaded && { fontFamily: 'Cinzel_700Bold' }, { opacity: 0 }]}>KingMe</Text>
              </LinearGradient>
            </MaskedView>
          </TouchableOpacity>
          <View style={{ marginLeft: 'auto' }}>
            <WalletHeaderButton />
          </View>
        </View>
        <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accent} />
      </LinearGradient>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>{'\u{1F451}'}</Text>
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
            <Text style={s.walletEmoji}>{guide.emoji}</Text>
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
          <TouchableOpacity style={s.connectBtn} onPress={() => connect()} activeOpacity={0.7}>
            <Text style={s.connectBtnText}>I already have a wallet — Connect now</Text>
          </TouchableOpacity>
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

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 8, marginRight: 2 },
  backText: { fontSize: 20, color: '#60a5fa', fontWeight: '600' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28 },
  accent: { height: 1.5, marginTop: 10, borderRadius: 1 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
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

  // Help note
  helpNote: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a3050',
  },
  helpNoteTitle: { fontSize: 14, fontWeight: '700', color: '#e8e0d0', marginBottom: 8 },
  helpNoteText: { fontSize: 13, color: '#888', lineHeight: 22 },
});
