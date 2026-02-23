// src/components/CryptoOpportunityCard.tsx
// ══════════════════════════════════════════════════════════════════
// Smart card shown on Assets tab when user has no crypto.
// Detects user's existing accounts (CashApp, Coinbase, bank, etc.)
// and guides them through the easiest path to fund a Solana wallet.
//
// Key pitch: Perena USD* at 9%+ APY — something they can't get
// from traditional banks or even most high-yield savings.
// ══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Linking, Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';

// ── Account Detection ────────────────────────────────────────────

type UserPath = 'cashapp' | 'fintech' | 'crypto_exchange' | 'bank' | 'none';

function detectPath(bankAccounts: any[], assets: any[]): { path: UserPath; detail: string } {
  const allNames = [
    ...bankAccounts.map(a => `${a.name ?? ''} ${a.institution ?? ''}`.toLowerCase()),
    ...assets.map(a => `${a.name ?? ''} ${a.institution ?? ''}`.toLowerCase()),
  ];

  // Already has crypto exchange
  const cryptoExchanges = [
    { pattern: /coinbase/i, name: 'Coinbase' },
    { pattern: /binance/i, name: 'Binance' },
    { pattern: /crypto\.?com/i, name: 'Crypto.com' },
    { pattern: /kraken/i, name: 'Kraken' },
    { pattern: /gemini/i, name: 'Gemini' },
    { pattern: /robinhood/i, name: 'Robinhood' },
  ];
  for (const ex of cryptoExchanges) {
    if (allNames.some(n => ex.pattern.test(n))) {
      return { path: 'crypto_exchange', detail: ex.name };
    }
  }

  // CashApp user
  if (allNames.some(n => /cash\s?app|cashapp/i.test(n))) {
    return { path: 'cashapp', detail: 'Cash App' };
  }

  // Other fintech
  const fintechApps = [
    { pattern: /venmo/i, name: 'Venmo' },
    { pattern: /paypal/i, name: 'PayPal' },
    { pattern: /chime/i, name: 'Chime' },
    { pattern: /current/i, name: 'Current' },
    { pattern: /dave/i, name: 'Dave' },
  ];
  for (const ft of fintechApps) {
    if (allNames.some(n => ft.pattern.test(n))) {
      return { path: 'fintech', detail: ft.name };
    }
  }

  // Traditional bank
  if (bankAccounts.length > 0) {
    return { path: 'bank', detail: bankAccounts[0]?.institution || 'your bank' };
  }

  return { path: 'none', detail: '' };
}

// ── Guide Content ────────────────────────────────────────────────

interface GuideStep {
  step: number;
  title: string;
  detail: string;
  emoji: string;
}

function getGuideSteps(path: UserPath, detail: string): GuideStep[] {
  const connectStep: GuideStep = {
    step: 0, emoji: '🔗',
    title: 'Connect to KingMe',
    detail: 'Tap the wallet button (top right) to link your Phantom wallet to KingMe. We\'ll track your balances and help you earn yield.',
  };

  const perenaStep: GuideStep = {
    step: 0, emoji: '🌿',
    title: 'Start earning 9%+ APY',
    detail: 'Once you have USDC in your wallet, KingMe will help you deposit into Perena USD* — a stablecoin savings protocol. Your dollars earn yield 24/7 with no lockup.',
  };

  switch (path) {
    case 'cashapp':
      return [
        { step: 1, emoji: '📲', title: 'Download Phantom wallet',
          detail: 'Free app on iOS and Android. Takes 30 seconds — no ID required, no sign-up forms. Just set a password and save your recovery phrase somewhere safe.' },
        { step: 2, emoji: '💳', title: 'Buy SOL with your Cash Card',
          detail: 'In Phantom, tap "Buy" → choose SOL → use your Cash Card as payment through MoonPay. Start with as little as $10 to try it out.' },
        { step: 3, emoji: '🔄', title: 'Swap SOL → USDC',
          detail: 'In Phantom, tap "Swap" and convert your SOL to USDC (a dollar-pegged stablecoin). USDC stays at $1 so there\'s no price risk.' },
        { ...connectStep, step: 4 },
        { ...perenaStep, step: 5 },
      ];

    case 'fintech':
      return [
        { step: 1, emoji: '📲', title: 'Download Phantom wallet',
          detail: `Free app on iOS and Android. No ID needed — just a password and recovery phrase.` },
        { step: 2, emoji: '💳', title: `Buy SOL using your ${detail} debit card`,
          detail: `In Phantom, tap "Buy" → choose SOL → use your ${detail} debit card through MoonPay. Start small — even $10 works.` },
        { step: 3, emoji: '🔄', title: 'Swap SOL → USDC',
          detail: 'Tap "Swap" in Phantom to convert SOL to USDC. USDC is pegged to $1 — your balance won\'t fluctuate.' },
        { ...connectStep, step: 4 },
        { ...perenaStep, step: 5 },
      ];

    case 'crypto_exchange':
      return [
        { step: 1, emoji: '📲', title: 'Download Phantom wallet',
          detail: 'If you don\'t have it already. Free on iOS and Android.' },
        { step: 2, emoji: '📤', title: `Send SOL or USDC from ${detail}`,
          detail: `Open ${detail}, buy SOL or USDC if needed, then withdraw to your Phantom wallet address. Copy it from Phantom → "Receive" → "Solana".` },
        { ...connectStep, step: 3 },
        { ...perenaStep, step: 4 },
      ];

    case 'bank':
      return [
        { step: 1, emoji: '📲', title: 'Download Phantom wallet',
          detail: 'Free app on iOS and Android. Takes 30 seconds — just a password and recovery phrase. No ID upload needed.' },
        { step: 2, emoji: '💳', title: `Buy SOL with your ${detail} debit card`,
          detail: `In Phantom, tap "Buy" → choose SOL → use your debit card from ${detail} through MoonPay. Minimum ~$10.` },
        { step: 3, emoji: '🔄', title: 'Swap SOL → USDC',
          detail: 'In Phantom, tap "Swap" and convert SOL to USDC. USDC = $1 always, no price swings.' },
        { ...connectStep, step: 4 },
        { ...perenaStep, step: 5 },
      ];

    case 'none':
    default:
      return [
        { step: 1, emoji: '📲', title: 'Download Phantom wallet',
          detail: 'Free app on iOS and Android. No ID, no sign-up forms. Just a password and a recovery phrase (write it down!).' },
        { step: 2, emoji: '💳', title: 'Buy SOL with any debit card',
          detail: 'In Phantom, tap "Buy" → choose SOL → pay with any debit card (including CashApp Cash Card, Chime, etc.) through MoonPay.' },
        { step: 3, emoji: '🔄', title: 'Swap SOL → USDC',
          detail: 'Tap "Swap" in Phantom. Convert SOL to USDC — a stablecoin worth exactly $1. No price risk.' },
        { ...connectStep, step: 4 },
        { ...perenaStep, step: 5 },
      ];
  }
}

// ── Main Component ───────────────────────────────────────────────

export default function CryptoOpportunityCard() {
  const bankAccounts = useStore(s => s.bankAccounts);
  const assets = useStore(s => s.assets);
  const wallets = useStore(s => s.wallets);
  const [showGuide, setShowGuide] = useState(false);

  const hasCrypto = assets.some(a => a.type === 'crypto');

  // Don't show if they already have crypto or a wallet
  if (hasCrypto || wallets.length > 0) return null;

  const { path, detail } = useMemo(
    () => detectPath(bankAccounts, assets),
    [bankAccounts, assets]
  );
  const steps = useMemo(() => getGuideSteps(path, detail), [path, detail]);

  // Context-aware subtitle
  const subtitle = path === 'cashapp'
    ? 'Your Cash Card can fund a Solana wallet in minutes — no ID upload needed.'
    : path === 'crypto_exchange'
    ? `You already use ${detail}. You're one transfer away from 9% yield.`
    : path === 'fintech'
    ? `Your ${detail} debit card can buy crypto directly — no exchange needed.`
    : path === 'bank'
    ? 'Your debit card can fund a Solana wallet in under 5 minutes.'
    : 'A Solana wallet lets you earn yield that banks will never offer.';

  return (
    <>
      <TouchableOpacity
        style={st.card}
        onPress={() => setShowGuide(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#4ade8018', '#4ade8008', 'transparent']}
          style={st.gradient}
        >
          {/* APY Badge */}
          <View style={st.apyBadge}>
            <Text style={st.apyText}>9.34% APY</Text>
          </View>

          {/* Comparison */}
          <View style={st.comparisonRow}>
            <View style={st.compareItem}>
              <Text style={st.compareRate}>0.01%</Text>
              <Text style={st.compareLabel}>Big banks</Text>
            </View>
            <View style={st.compareDivider} />
            <View style={st.compareItem}>
              <Text style={st.compareRate}>~4.5%</Text>
              <Text style={st.compareLabel}>CashApp / HYSA</Text>
            </View>
            <View style={st.compareDivider} />
            <View style={[st.compareItem, st.compareItemHighlight]}>
              <Text style={[st.compareRate, { color: '#4ade80' }]}>9.34%</Text>
              <Text style={st.compareLabel}>Perena USD*</Text>
            </View>
          </View>

          <Text style={st.title}>Earn more on your dollars</Text>
          <Text style={st.subtitle}>{subtitle}</Text>

          <View style={st.ctaRow}>
            <Text style={st.ctaText}>See how it works</Text>
            <Text style={st.ctaArrow}>→</Text>
          </View>

          {/* Also mention backup */}
          <View style={st.backupHint}>
            <Text style={st.backupHintText}>
              🔒  A wallet also unlocks encrypted cloud backup for your KingMe data
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Guide Modal ── */}
      <Modal visible={showGuide} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={st.guideHeader}>
                <Text style={st.guideEmoji}>🌿</Text>
                <Text style={st.guideTitle}>Start Earning 9%+ on Your Dollars</Text>
                <Text style={st.guideSubtitle}>
                  Perena USD* is a Solana stablecoin savings protocol. Your dollars earn yield 24/7 — withdraw anytime, no lockup.
                </Text>
              </View>

              {/* Personalized path indicator */}
              {path !== 'none' && (
                <View style={st.pathBadge}>
                  <Text style={st.pathBadgeText}>
                    {path === 'cashapp' ? '💚 Personalized for Cash App users' :
                     path === 'crypto_exchange' ? `⚡ Quick path — you already use ${detail}` :
                     path === 'fintech' ? `📱 Personalized for ${detail} users` :
                     `🏦 Using your ${detail} debit card`}
                  </Text>
                </View>
              )}

              {/* Steps */}
              {steps.map((step, i) => (
                <View key={i} style={st.stepRow}>
                  <View style={st.stepTimeline}>
                    <View style={st.stepDot}>
                      <Text style={st.stepDotText}>{step.step}</Text>
                    </View>
                    {i < steps.length - 1 && <View style={st.stepLine} />}
                  </View>
                  <View style={st.stepContent}>
                    <Text style={st.stepTitle}>{step.emoji} {step.title}</Text>
                    <Text style={st.stepDetail}>{step.detail}</Text>
                  </View>
                </View>
              ))}

              {/* Phantom download link */}
              <TouchableOpacity
                style={st.phantomButton}
                onPress={() => Linking.openURL('https://phantom.app/download')}
                activeOpacity={0.8}
              >
                <Text style={st.phantomButtonText}>👻 Download Phantom Wallet</Text>
              </TouchableOpacity>

              {/* Risk disclosure */}
              <View style={st.riskBox}>
                <Text style={st.riskTitle}>Honest disclaimer</Text>
                <Text style={st.riskText}>
                  Crypto yields are not FDIC insured. Smart contract risk exists — only deposit what you're comfortable with. USDC is a stablecoin pegged to $1 but is not a bank deposit. Start small and increase as you get comfortable.
                </Text>
              </View>

              {/* What about backup */}
              <View style={st.backupBox}>
                <Text style={st.backupBoxTitle}>🔐 Bonus: Encrypted Cloud Backup</Text>
                <Text style={st.backupBoxText}>
                  Once you connect a Solana wallet to KingMe, you unlock encrypted cloud backup. Your data gets encrypted with your wallet signature — only you can decrypt it. Without a wallet, your data only exists on this device.
                </Text>
              </View>

            </ScrollView>

            {/* Close */}
            <TouchableOpacity style={st.closeButton} onPress={() => setShowGuide(false)}>
              <Text style={st.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // Card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4ade8025',
    marginBottom: 16,
  },
  gradient: {
    padding: 20,
  },
  apyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4ade8020',
    borderWidth: 1,
    borderColor: '#4ade8040',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
  },
  apyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 0.3,
  },

  // Comparison
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#0c102080',
    borderRadius: 12,
  },
  compareItem: {
    flex: 1,
    alignItems: 'center',
  },
  compareItemHighlight: {
    backgroundColor: '#4ade8010',
    borderRadius: 8,
    paddingVertical: 6,
    marginVertical: -6,
  },
  compareRate: {
    fontSize: 18,
    fontWeight: '800',
    color: '#555',
  },
  compareLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  compareDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1a2040',
    marginHorizontal: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#b0b0b8',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4ade80',
  },
  ctaArrow: {
    fontSize: 16,
    color: '#4ade80',
  },
  backupHint: {
    borderTopWidth: 1,
    borderTopColor: '#1a204060',
    paddingTop: 12,
  },
  backupHintText: {
    fontSize: 12,
    color: '#888',
  },

  // Guide Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0c1020',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: '#2a305040',
    borderBottomWidth: 0,
  },

  // Guide header
  guideHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  guideEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4ade80',
    textAlign: 'center',
    marginBottom: 8,
  },
  guideSubtitle: {
    fontSize: 14,
    color: '#b0b0b8',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Path badge
  pathBadge: {
    backgroundColor: '#4ade8012',
    borderWidth: 1,
    borderColor: '#4ade8025',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  pathBadgeText: {
    fontSize: 13,
    color: '#4ade80',
    fontWeight: '600',
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  stepTimeline: {
    width: 36,
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a2040',
    borderWidth: 1,
    borderColor: '#4ade8040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ade80',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#1a2040',
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  stepDetail: {
    fontSize: 13,
    color: '#b0b0b8',
    lineHeight: 19,
  },

  // Phantom button
  phantomButton: {
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  phantomButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Risk disclosure
  riskBox: {
    backgroundColor: '#f8717110',
    borderWidth: 1,
    borderColor: '#f8717120',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  riskTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f87171',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  riskText: {
    fontSize: 12,
    color: '#b0b0b8',
    lineHeight: 17,
  },

  // Backup box
  backupBox: {
    backgroundColor: '#f4c43010',
    borderWidth: 1,
    borderColor: '#f4c43020',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  backupBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4c430',
    marginBottom: 6,
  },
  backupBoxText: {
    fontSize: 12,
    color: '#b0b0b8',
    lineHeight: 17,
  },

  // Close
  closeButton: {
    backgroundColor: '#1a2040',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2a305060',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
