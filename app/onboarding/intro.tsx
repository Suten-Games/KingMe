// app/onboarding/intro.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Onboarding Intro — explains the app's value proposition before data entry.
// Swipeable pages: Why → How it works → Levels → Features → Security → Demo
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Platform, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { isSeeker } from '../../src/utils/device';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useWallet } from '../../src/providers/wallet-provider';
import { loadBackup } from '../../src/services/encryptedBackup';
import { restoreAsyncData } from '../../src/services/fullBackup';
import { useStore } from '../../src/store/useStore';
import WalletPickerModal from '../../src/components/WalletPickerModal';
import { T } from '../../src/theme';
import { log, warn, error as logError } from '@/utils/logger';
import { DEMO_PERSONAS, seedDemoWatchlist, type DemoPersona } from '../../src/utils/demoPersonas';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 480) : SCREEN_WIDTH;

const PAGES = ['hook', 'concept', 'levels', 'features', 'security', 'demo'] as const;

export default function OnboardingIntro() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const { signMessage, publicKey, connected, connect } = useWallet();
  const importBackup = useStore(s => s.importBackup);
  const exportBackup = useStore(s => s.exportBackup);

  // Clean URL on web so visitors see kingme.money instead of /onboarding/intro
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleTryPersona = async (persona: DemoPersona) => {
    try {
      // Preserve wallet that was connected on page 1
      const currentWallets = useStore.getState().wallets;

      // Save current (empty) state so exit demo can restore
      const backup = exportBackup();
      await AsyncStorage.setItem('_demo_saved_profile', backup);
      await AsyncStorage.setItem('_demo_active', 'true');
      await AsyncStorage.setItem('_demo_persona_id', persona.id);

      // Reset store fully before loading persona to prevent stale data
      const resetStore = useStore.getState().resetStore;
      resetStore();
      useStore.setState({ _isLoaded: true });

      // Load persona data, keeping the user's connected wallet
      importBackup(JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        profile: {
          ...persona.profile,
          onboardingComplete: true,
          wallets: currentWallets.length > 0 ? currentWallets : persona.profile.wallets,
        },
      }));

      // Seed watchlist data if persona has one
      await seedDemoWatchlist(persona);

      router.replace('/(tabs)');
    } catch (err: any) {
      logError('Failed to load demo persona:', err);
    }
  };

  const handleRestore = async () => {
    if (!connected || !publicKey) return;
    setRestoreError('');
    setRestoring(true);
    await attemptRestore(publicKey.toBase58());
  };

  const attemptRestore = async (walletAddress: string) => {
    try {
      const rawBackup = await loadBackup(walletAddress, signMessage);

      // Handle v1 (flat store) and v2 (store + asyncStorage) formats
      const isV2 = rawBackup?.version >= 2 && rawBackup?.store;
      const profileData = isV2 ? rawBackup.store : rawBackup;
      const asyncData = isV2 ? rawBackup.asyncStorage : {};

      useStore.setState({
        bankAccounts: profileData.bankAccounts || [],
        income: profileData.income || { salary: 0, otherIncome: 0, sources: [] },
        obligations: profileData.obligations || [],
        debts: profileData.debts || [],
        assets: profileData.assets || [],
        desires: profileData.desires || [],
        wallets: profileData.wallets || [walletAddress],
        paycheckDeductions: profileData.paycheckDeductions || [],
        preTaxDeductions: profileData.preTaxDeductions || [],
        taxes: profileData.taxes || [],
        postTaxDeductions: profileData.postTaxDeductions || [],
        bankTransactions: profileData.bankTransactions || [],
        driftTrades: profileData.driftTrades || [],
        dailyExpenses: profileData.dailyExpenses || [],
        investmentTheses: profileData.investmentTheses || [],
        thesisAlerts: profileData.thesisAlerts || [],
        whatIfScenarios: profileData.whatIfScenarios || [],
        cryptoCardBalance: profileData.cryptoCardBalance || { currentBalance: 0, lastUpdated: new Date().toISOString() },
        expenseTrackingMode: profileData.expenseTrackingMode || 'estimate',
        freedomHistory: profileData.freedomHistory || [],
        settings: { ...useStore.getState().settings, ...(profileData.settings || {}) },
        onboardingComplete: true,
        // Badge system
        earnedBadges: profileData.earnedBadges || [],
        trimCount: profileData.trimCount ?? 0,
        importWeeks: profileData.importWeeks ?? [],
        appOpenDays: profileData.appOpenDays ?? [],
      });
      await useStore.getState().saveProfile();

      // Restore AsyncStorage satellite data (goals, plans, snapshots, etc.)
      if (asyncData && Object.keys(asyncData).length > 0) {
        await restoreAsyncData(asyncData);
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      logError('Restore failed:', err);
      setRestoreError(err.message || 'No backup found for this wallet');
      setRestoring(false);
    }
  };

  const goNext = () => {
    if (currentPage < PAGES.length - 1) {
      scrollRef.current?.scrollTo({ x: PAGE_WIDTH * (currentPage + 1), animated: true });
      setCurrentPage(currentPage + 1);
    } else {
      router.push('/onboarding/welcome');
    }
  };

  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({ x: PAGE_WIDTH * index, animated: true });
    setCurrentPage(index);
  };

  const handleScroll = (e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (page !== currentPage && page >= 0 && page < PAGES.length) setCurrentPage(page);
  };

  const skip = () => router.push('/onboarding/welcome');

  return (
    <View style={st.container}>
     <View style={st.webWrapper}>
      <TouchableOpacity style={st.skipBtn} onPress={skip}>
        <Text style={st.skipText}>Skip →</Text>
      </TouchableOpacity>

      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll} style={{ flex: 1 }}
        contentContainerStyle={{ width: PAGE_WIDTH * PAGES.length }}>

        {/* ── Page 1: Hook ─────────────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <View style={st.pageInner}>
            <Image source={require('../../src/assets/images/kingmelogo.jpg')} style={st.heroLogo} resizeMode="contain" />
            <Text style={st.heroTitle}>What if you never{'\n'}had to work again?</Text>
            <Text style={st.heroSub}>
              Not someday. Not when you're old.{'\n'}What if you knew exactly how close you are{'\n'}to real financial freedom — right now?
            </Text>
            <View style={st.heroAccent}>
              <Text style={st.heroAccentText}>KingMe tells you.</Text>
            </View>

            <View style={st.restoreSection}>
              <View style={st.restoreDivider}>
                <View style={st.restoreLine} />
                <Text style={st.restoreOrText}>returning user?</Text>
                <View style={st.restoreLine} />
              </View>

              {!connected ? (
                <>
                  <TouchableOpacity
                    style={[st.restoreBtn, restoring && { opacity: 0.5 }]}
                    onPress={async () => {
                      setRestoreError(''); setRestoring(true);
                      try {
                        await connect();
                        setRestoring(false); // unlock restore button
                      } catch (e: any) {
                        const msg = e.message || 'Failed to connect';
                        if (/not found|not installed|no provider|No Solana/i.test(msg)) {
                          setRestoreError(isSeeker
                            ? 'No wallet found. Open your Seed Vault wallet and try again.'
                            : 'No Solana wallet found. Install Phantom, Solflare, or another Solana wallet.');
                        } else { setRestoreError(msg); }
                        setRestoring(false);
                      }
                    }}
                    disabled={restoring}
                  >
                    {restoring ? <ActivityIndicator size="small" color={T.blue} /> :
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Svg width={16} height={16} viewBox="0 0 128 128">
                          <Defs>
                            <SvgGradient id="sol" x1="0" y1="0" x2="1" y2="1">
                              <Stop offset="0" stopColor="#9945FF" />
                              <Stop offset="1" stopColor="#14F195" />
                            </SvgGradient>
                          </Defs>
                          <Path
                            d="M25.5 100.5a4.3 4.3 0 0 1 3-1.3h91.2c1.9 0 2.9 2.3 1.5 3.7l-18 18a4.3 4.3 0 0 1-3 1.3H9.1c-1.9 0-2.9-2.3-1.5-3.7l17.9-18Zm0-72.7a4.3 4.3 0 0 1 3-1.3h91.2c1.9 0 2.9 2.3 1.5 3.7l-18 18a4.3 4.3 0 0 1-3 1.3H9.1c-1.9 0-2.9-2.3-1.5-3.7l17.9-18Zm95.7 35.1a4.3 4.3 0 0 0-3-1.3H27c-1.9 0-2.9 2.3-1.5 3.7l18 18a4.3 4.3 0 0 0 3 1.3h91.2c1.9 0 2.9-2.3 1.5-3.7l-18-18Z"
                            fill="url(#sol)"
                          />
                        </Svg>
                        <Text style={st.restoreBtnText}>Connect Wallet</Text>
                      </View>}
                  </TouchableOpacity>
                  <Text style={st.restoreHint}>
                    {Platform.OS === 'web'
                      ? 'Connect your Solana wallet to restore'
                      : 'Opens your wallet app to sign and decrypt your backup'}
                  </Text>
                </>
              ) : (
                <>
                  <View style={st.walletConnected}>
                    <Text style={st.walletConnectedText}>
                      🟢 {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[st.restoreBtn, st.restoreBtnActive, restoring && { opacity: 0.5 }]}
                    onPress={handleRestore} disabled={restoring}>
                    {restoring ? <ActivityIndicator size="small" color={T.gold} /> :
                      <Text style={[st.restoreBtnText, { color: T.gold }]}>🔑 Restore from Cloud Backup</Text>}
                  </TouchableOpacity>
                  <Text style={st.restoreHint}>Decrypt and restore all your data — skip setup entirely</Text>
                </>
              )}
              {restoreError !== '' && <Text style={st.restoreError}>{restoreError}</Text>}
            </View>
          </View>
        </View>

        {/* ── Page 2: The Concept ──────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <View style={st.pageInner}>
            <Text style={st.pageTitle}>Your Freedom Score</Text>
            <Text style={st.pageSub}>One number that answers the most important financial question:</Text>
            <LinearGradient colors={T.gradients.gold} style={st.conceptCard}>
              <Text style={st.conceptQuestion}>"How long could I survive without working?"</Text>
            </LinearGradient>
            <View style={st.conceptRow}>
              <ConceptItem emoji="💰" title="Passive Income" sub="Staking, dividends, yields, rent" />
              <ConceptItem emoji="📦" title="Liquid Assets" sub="Cash, crypto, investments" />
            </View>
            <Text style={st.conceptDivider}>÷</Text>
            <View style={st.conceptRow}>
              <ConceptItem emoji="📋" title="Monthly Bills" sub="Rent, insurance, utilities, debt" />
            </View>
            <Text style={st.conceptEquals}>=</Text>
            <LinearGradient colors={[T.gradients.gold[0], T.gradients.gold[1]]} style={st.conceptResult}>
              <Text style={st.conceptResultText}>Your Freedom Score</Text>
              <Text style={st.conceptResultExample}>e.g. "5 months of freedom"</Text>
            </LinearGradient>
          </View>
        </View>

        {/* ── Page 3: The Levels ───────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <View style={st.pageInner}>
            <Text style={st.pageTitle}>Your Avatar Evolves</Text>
            <Text style={st.pageSub}>
              As your freedom grows, your avatar transforms — reflecting your journey from survival to sovereignty.
            </Text>
            <View style={st.levelsContainer}>
              <LevelRow emoji="🌊" name="Drowning" range="0 – 30 days" color={T.red} desc="Living paycheck to paycheck" />
              <View style={st.levelConnector} />
              <LevelRow emoji="🏊" name="Struggling" range="1 – 6 months" color={T.orange} desc="Building a small buffer" />
              <View style={st.levelConnector} />
              <LevelRow emoji="🔓" name="Breaking Free" range="6 months – 2 years" color={T.blue} desc="Real breathing room" />
              <View style={st.levelConnector} />
              <LevelRow emoji="🚀" name="Rising" range="2 – 10 years" color={T.purple} desc="Wealth compounding" />
              <View style={st.levelConnector} />
              <LevelRow emoji="👑" name="Enthroned" range="10+ years / ∞" color={T.gold} desc="Passive income covers everything" isGold />
            </View>
          </View>
        </View>

        {/* ── Page 4: Features ─────────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <View style={st.pageInner}>
            <Text style={st.pageTitle}>Everything You Need</Text>
            <Text style={st.pageSub}>Built for people serious about freedom</Text>
            <View style={st.featuresGrid}>
              <FeatureCard emoji="📊" title="Smart Dashboard" desc="Freedom score, runway, cash flow health — all at a glance" />
              <FeatureCard emoji="🔗" title="Solana Wallet Sync" desc="Connect your wallet. Crypto assets auto-track in real-time." />
              <FeatureCard emoji="🎯" title="What-If Scenarios" desc="'What if I paid off this debt?' See the freedom impact instantly." />
              <FeatureCard emoji="⚡" title="Position Alerts" desc="Get notified when positions pump, dump, or drift off thesis." />
              <FeatureCard emoji="🤖" title="AI-Powered Desires" desc="Ask Claude what you can afford and how to get there." />
              <FeatureCard emoji="🏆" title="Badges & Streaks" desc="Earn achievements as you build healthier financial habits." />
            </View>
          </View>
        </View>

        {/* ── Page 5: Security ───────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <View style={st.pageInner}>
            <Text style={st.heroEmoji}>🔒</Text>
            <Text style={st.pageTitle}>Your Data. Your Keys.</Text>
            <Text style={st.pageSub}>
              KingMe was built with a zero-trust security model.{'\n'}Your financial data never leaves your control.
            </Text>
            <View style={st.securityList}>
              <SecurityItem emoji="📱" title="Device-First Storage" desc="All data lives on your device by default. Nothing is sent to any server unless you choose to back up." />
              <SecurityItem emoji="🔑" title="Wallet-Encrypted Backups" desc="Cloud backups are encrypted with your Solana wallet signature. Only your private key can decrypt them — not us, not anyone." />
              <SecurityItem emoji="🛡️" title="Breach-Proof" desc="Even if our servers were compromised, your data is meaningless without your wallet. There are no passwords to steal." />
              <SecurityItem emoji="🚫" title="No Tracking. No Ads." desc="We don't sell your data, show ads, or track your behavior. KingMe exists to serve you, not advertisers." />
            </View>
            <View style={st.securityBadge}>
              <Text style={st.securityBadgeText}>Only you can read your data. Period.</Text>
            </View>
          </View>
        </View>

        {/* ── Page 6: Try It + CTA ──────────────────────────── */}
        <View style={[st.page, { width: PAGE_WIDTH }]}>
          <ScrollView contentContainerStyle={[st.pageInner, { justifyContent: 'flex-start', paddingTop: 60 }]} showsVerticalScrollIndicator={false}>
            <Text style={st.pageTitle}>See It In Action</Text>
            <Text style={st.pageSub}>
              Pick a persona to explore the app with real-looking data.{'\n'}No commitment — you can start your own setup anytime.
            </Text>

            <View style={{ width: '100%', gap: 10, marginBottom: 20 }}>
              {DEMO_PERSONAS.map(persona => (
                <TouchableOpacity
                  key={persona.id}
                  style={[st.personaCard, { borderColor: persona.color + '50', borderLeftColor: persona.color, borderLeftWidth: 3 }]}
                  onPress={() => handleTryPersona(persona)}
                  activeOpacity={0.7}
                >
                  <Text style={st.personaEmoji}>{persona.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.personaName, { color: persona.color }]}>{persona.name}</Text>
                    <Text style={st.personaDesc}>{persona.description}</Text>
                  </View>
                  <View style={[st.personaTryBtn, { backgroundColor: persona.color + '20', borderColor: persona.color + '40' }]}>
                    <Text style={[st.personaTryText, { color: persona.color }]}>Try →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.ctaDivider}>
              <View style={st.ctaDividerLine} />
              <Text style={st.ctaDividerText}>or</Text>
              <View style={st.ctaDividerLine} />
            </View>

            <Text style={st.ctaText}>
              Ready to set up your real profile?{'\n'}It takes about 5 minutes.
            </Text>
          </ScrollView>
        </View>
      </ScrollView>

      {/* ── Bottom: Dots + Button ─────────────────────────── */}
      <View style={st.bottomBar}>
        <View style={st.dots}>
          {PAGES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToPage(i)}>
              <View style={[st.dot, i === currentPage && st.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={st.nextBtn} onPress={goNext}>
          <Text style={st.nextBtnText}>
            {currentPage === PAGES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      <WalletPickerModal />
     </View>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function ConceptItem({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <View style={st.conceptItem}>
      <Text style={st.conceptItemEmoji}>{emoji}</Text>
      <Text style={st.conceptItemTitle}>{title}</Text>
      <Text style={st.conceptItemSub}>{sub}</Text>
    </View>
  );
}

function LevelRow({ emoji, name, range, color, desc, isGold }: {
  emoji: string; name: string; range: string; color: string; desc: string; isGold?: boolean;
}) {
  return (
    <View style={[st.levelRow, isGold && st.levelRowGold]}>
      <Text style={st.levelEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.levelName, { color }]}>{name}</Text>
        <Text style={st.levelDesc}>{desc}</Text>
      </View>
      <Text style={st.levelRange}>{range}</Text>
    </View>
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={st.featureCard}>
      <Text style={st.featureEmoji}>{emoji}</Text>
      <Text style={st.featureTitle}>{title}</Text>
      <Text style={st.featureDesc}>{desc}</Text>
    </View>
  );
}

function SecurityItem({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={st.securityItem}>
      <Text style={st.securityItemEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={st.securityItemTitle}>{title}</Text>
        <Text style={st.securityItemDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, alignItems: 'center' },
  webWrapper: {
    flex: 1,
    width: Platform.OS === 'web' ? PAGE_WIDTH : '100%',
    maxWidth: Platform.OS === 'web' ? PAGE_WIDTH : undefined,
    overflow: 'hidden',
  } as any,

  skipBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: `${T.textPrimary}10`,
  },
  skipText: { fontSize: 14, color: T.textMuted, fontWeight: '600' },

  page: { flex: 1 },
  pageInner: {
    flex: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 100,
    alignItems: 'center', justifyContent: 'center',
  },

  // Page 1: Hook
  heroEmoji: { fontSize: 64, marginBottom: 16 },
  heroLogo: { width: 80, height: 80, borderRadius: 16, marginBottom: 16 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: T.textPrimary, textAlign: 'center', lineHeight: 40, marginBottom: 16 },
  heroSub: { fontSize: 16, color: T.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  heroAccent: {
    backgroundColor: `${T.gold}15`, borderRadius: T.radius.md, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: `${T.gold}40`,
  },
  heroAccentText: { fontSize: 20, fontWeight: '800', color: T.gold },

  // Restore section
  restoreSection: { marginTop: 28, width: '100%', alignItems: 'center' },
  restoreDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, width: '100%' },
  restoreLine: { flex: 1, height: 1, backgroundColor: T.border },
  restoreOrText: { fontSize: 12, color: T.textDim, fontWeight: '600' },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${T.blue}12`, borderRadius: T.radius.md,
    paddingVertical: 14, paddingHorizontal: 24,
    borderWidth: 1, borderColor: `${T.blue}30`, width: '100%', justifyContent: 'center',
  },
  restoreBtnActive: { backgroundColor: `${T.gold}12`, borderColor: `${T.gold}40` },
  restoreBtnText: { fontSize: 15, fontWeight: '700', color: T.blue },
  restoreHint: { fontSize: 11, color: T.textDim, marginTop: 8, textAlign: 'center' },
  restoreError: { fontSize: 12, color: T.red, marginTop: 8, textAlign: 'center' },
  walletConnected: {
    backgroundColor: `${T.green}10`, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: `${T.green}30`, marginBottom: 10,
  },
  walletConnectedText: { fontSize: 13, color: T.green, fontWeight: '700', textAlign: 'center' },

  // Page 2: Concept
  pageTitle: { fontSize: 26, fontWeight: '900', color: T.textPrimary, textAlign: 'center', marginBottom: 8 },
  pageSub: { fontSize: 14, color: T.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  conceptCard: {
    borderRadius: T.radius.md, padding: 20, marginBottom: 20, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: `${T.gold}30`,
  },
  conceptQuestion: { fontSize: 17, fontWeight: '700', color: T.gold, textAlign: 'center', fontStyle: 'italic' },
  conceptRow: { flexDirection: 'row', gap: 10, marginBottom: 6, width: '100%' },
  conceptItem: {
    flex: 1, backgroundColor: T.bgCard, borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: T.border,
  },
  conceptItemEmoji: { fontSize: 24, marginBottom: 4 },
  conceptItemTitle: { fontSize: 13, fontWeight: '800', color: T.textSecondary, marginBottom: 2 },
  conceptItemSub: { fontSize: 10, color: T.textMuted, textAlign: 'center' },
  conceptDivider: { fontSize: 24, color: T.textDim, marginVertical: 4, fontWeight: '800' },
  conceptEquals: { fontSize: 24, color: T.gold, marginVertical: 4, fontWeight: '800' },
  conceptResult: {
    borderRadius: T.radius.md, padding: 16, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: `${T.gold}40`,
  },
  conceptResultText: { fontSize: 18, fontWeight: '800', color: T.gold },
  conceptResultExample: { fontSize: 12, color: T.textMuted, marginTop: 4 },

  // Page 3: Levels
  levelsContainer: { width: '100%', marginTop: 8 },
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.bgCard, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.border,
  },
  levelRowGold: { backgroundColor: `${T.gold}10`, borderColor: `${T.gold}40` },
  levelEmoji: { fontSize: 24 },
  levelName: { fontSize: 15, fontWeight: '800' },
  levelDesc: { fontSize: 11, color: T.textMuted, marginTop: 1 },
  levelRange: { fontSize: 11, color: T.textDim, fontWeight: '600' },
  levelConnector: { width: 2, height: 12, backgroundColor: T.border, alignSelf: 'center' },

  // Page 4: Features
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', justifyContent: 'center' },
  featureCard: {
    width: '47%', backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14,
    borderWidth: 1, borderColor: T.border,
  },
  featureEmoji: { fontSize: 24, marginBottom: 6 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: T.textSecondary, marginBottom: 4 },
  featureDesc: { fontSize: 11, color: T.textMuted, lineHeight: 15 },

  // Page 5: Security
  securityList: { width: '100%', gap: 10, marginBottom: 20 },
  securityItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14,
    borderWidth: 1, borderColor: T.border,
  },
  securityItemEmoji: { fontSize: 24, marginTop: 2 },
  securityItemTitle: { fontSize: 14, fontWeight: '800', color: T.textSecondary, marginBottom: 3 },
  securityItemDesc: { fontSize: 12, color: T.textMuted, lineHeight: 17 },
  securityBadge: {
    backgroundColor: `${T.green}12`, borderRadius: T.radius.md, paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: `${T.green}30`,
  },
  securityBadgeText: { fontSize: 14, fontWeight: '800', color: T.green, textAlign: 'center' },

  // (Page 6 styles moved to personaCard etc. above)

  // Persona picker
  personaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 14,
    borderWidth: 1,
  },
  personaEmoji: { fontSize: 28 },
  personaName: { fontSize: 15, fontWeight: '800' },
  personaDesc: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  personaTryBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1,
  },
  personaTryText: { fontSize: 12, fontWeight: '800' },

  ctaDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginBottom: 16 },
  ctaDividerLine: { flex: 1, height: 1, backgroundColor: T.border },
  ctaDividerText: { fontSize: 12, color: T.textDim, fontWeight: '600' },

  ctaText: { fontSize: 15, color: T.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 28, paddingBottom: Platform.OS === 'web' ? 20 : 40,
    paddingTop: 12, backgroundColor: T.bg,
    borderTopWidth: 1, borderTopColor: T.borderSubtle,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  dotActive: { backgroundColor: T.gold, width: 24 },
  nextBtn: { backgroundColor: T.gold, borderRadius: T.radius.md, padding: 16, alignItems: 'center' },
  nextBtnText: { fontSize: 17, fontWeight: '800', color: T.bg },
});
