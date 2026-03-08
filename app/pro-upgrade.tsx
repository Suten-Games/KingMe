// app/pro-upgrade.tsx — KingMe Pro purchase screen
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../src/providers/wallet-provider';
import { useStore } from '../src/store/useStore';
import { payForAddOn, payForAddOnWithSKR, usdToSkr, SKR_PRICE_USD } from '../src/services/addOnPayment';
import { T } from '../src/theme';

const PRO_PRICE = 19.99;
const PRO_ID = 'pro_bundle';

const PRO_FEATURES = [
  { emoji: '🤖', title: 'AI Desires Planner', desc: 'Personalized action plans powered by Claude AI' },
  { emoji: '🔮', title: 'Full What-If Scenarios', desc: 'Detailed impact analysis on every financial move' },
  { emoji: '🧰', title: 'All Add-Ons Included', desc: 'Business dashboard, divorce sim, companionship & more — current and future' },
  { emoji: '♾️', title: 'Unlimited Accounts', desc: 'Unlimited bank accounts, wallets, and income sources' },
];

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connected, publicKey, signTransaction, signMessage, signAndSendTransaction } = useWallet();
  const activatePro = useStore((s) => s.activatePro);

  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [payWithSKR, setPayWithSKR] = useState(false);

  const isAndroid = Platform.OS === 'android';
  const skrAmount = usdToSkr(PRO_PRICE);

  const handlePayment = async () => {
    if (!publicKey) return;

    setPaying(true);
    setPaymentError(null);

    const payFn = payWithSKR ? payForAddOnWithSKR : payForAddOn;
    const result = await payFn(
      PRO_ID,
      PRO_PRICE,
      publicKey.toBase58(),
      signTransaction,
      signMessage,
      signAndSendTransaction,
    );

    setPaying(false);

    if (result.success) {
      await activatePro();
      router.back();
    } else {
      setPaymentError(result.error || 'Payment failed');
    }
  };

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 14) }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>KingMe Pro</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={T.gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Image
            source={require('../src/assets/images/kingmelogo.jpg')}
            style={s.heroLogo}
            resizeMode="cover"
          />
          <Text style={s.heroTitle}>Upgrade to Pro</Text>
          <Text style={s.heroSub}>Unlock the full power of KingMe</Text>
        </LinearGradient>

        {/* Features */}
        <Text style={s.featuresHeading}>What's included</Text>
        {PRO_FEATURES.map((f) => (
          <View key={f.title} style={s.featureRow}>
            <Text style={s.featureEmoji}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}

        {/* Token toggle */}
        {isAndroid && (
          <View style={s.tokenToggle}>
            <TouchableOpacity
              style={[s.tokenOption, !payWithSKR && s.tokenOptionActive]}
              onPress={() => setPayWithSKR(false)}
            >
              <Text style={[s.tokenOptionText, !payWithSKR && s.tokenOptionTextActive]}>USDC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tokenOption, payWithSKR && s.tokenOptionActiveSKR]}
              onPress={() => setPayWithSKR(true)}
            >
              <Text style={[s.tokenOptionText, payWithSKR && s.tokenOptionTextActive]}>SKR</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Price box */}
        <View style={[s.priceBox, payWithSKR && s.priceBoxSKR]}>
          <Text style={s.priceLabel}>One-time purchase</Text>
          {payWithSKR ? (
            <>
              <Text style={s.priceValueSKR}>{skrAmount.toLocaleString()} SKR</Text>
              <Text style={s.priceSubtext}>≈ ${PRO_PRICE} USD @ ${SKR_PRICE_USD}/SKR</Text>
            </>
          ) : (
            <Text style={s.priceValue}>${PRO_PRICE} USDC</Text>
          )}
        </View>

        {/* Wallet warning */}
        {!connected && (
          <View style={s.walletWarning}>
            <Text style={s.walletWarningText}>
              Connect a Solana wallet to purchase with {payWithSKR ? 'SKR' : 'USDC'}
            </Text>
          </View>
        )}

        {/* Error */}
        {paymentError && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{paymentError}</Text>
          </View>
        )}

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payButton, payWithSKR && s.payButtonSKR, (!connected || paying) && s.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!connected || paying}
          activeOpacity={0.8}
        >
          {paying ? (
            <ActivityIndicator color="#0a0e1a" size="small" />
          ) : (
            <Text style={s.payButtonText}>
              {payWithSKR ? `Pay ${skrAmount.toLocaleString()} SKR` : `Pay $${PRO_PRICE} USDC`}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Payment is sent directly on Solana. No refunds.
        </Text>

        {/* Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backButton: { padding: 8 },
  backText: { fontSize: 20, color: T.blue, fontFamily: T.fontSemiBold },
  headerTitle: { fontSize: 20, color: T.gold, fontFamily: T.fontExtraBold, letterSpacing: 0.8 },
  scroll: { flex: 1, paddingHorizontal: 20 },

  // Hero
  hero: {
    ...T.cardBase,
    borderColor: T.gold + '60',
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  heroLogo: { width: 72, height: 72, borderRadius: 16, borderWidth: 1.5, borderColor: T.gold + '60', marginBottom: 12 },
  heroTitle: { fontSize: 26, color: T.gold, fontFamily: T.fontExtraBold, marginBottom: 6 },
  heroSub: { fontSize: 14, color: T.textSecondary, fontFamily: T.fontRegular },

  // Features
  featuresHeading: {
    fontSize: 13, color: T.textMuted, fontFamily: T.fontBold,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: 16,
  },
  featureEmoji: { fontSize: 24, marginTop: 2 },
  featureTitle: { fontSize: 15, color: T.textPrimary, fontFamily: T.fontBold, marginBottom: 2 },
  featureDesc: { fontSize: 13, color: T.textMuted, fontFamily: T.fontRegular, lineHeight: 18 },

  // Token toggle
  tokenToggle: {
    flexDirection: 'row', marginTop: 8, marginBottom: 16,
    backgroundColor: '#1a1f2e', borderRadius: 10, padding: 3,
  },
  tokenOption: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tokenOptionActive: { backgroundColor: T.gold },
  tokenOptionActiveSKR: { backgroundColor: '#9945FF' },
  tokenOptionText: { fontSize: 14, fontFamily: T.fontBold, color: T.textDim },
  tokenOptionTextActive: { color: T.bg },

  // Price box
  priceBox: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: T.gold + '40',
  },
  priceBoxSKR: { borderColor: '#9945FF40' },
  priceLabel: { fontSize: 12, color: T.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, fontFamily: T.fontBold },
  priceValue: { fontSize: 32, color: T.gold, fontFamily: T.fontExtraBold },
  priceValueSKR: { fontSize: 32, color: '#9945FF', fontFamily: T.fontExtraBold },
  priceSubtext: { fontSize: 11, color: T.textDim, marginTop: 4, fontFamily: T.fontRegular },

  // Wallet warning
  walletWarning: {
    backgroundColor: T.gold + '15', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: T.gold + '30',
  },
  walletWarningText: { fontSize: 13, color: T.gold, textAlign: 'center', fontFamily: T.fontMedium },

  // Error
  errorBox: {
    backgroundColor: '#ff444415', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#ff444430',
  },
  errorText: { fontSize: 13, color: T.redBright, textAlign: 'center', fontFamily: T.fontMedium },

  // Pay button
  payButton: {
    padding: 16, borderRadius: 12,
    backgroundColor: T.gold, alignItems: 'center',
    marginBottom: 12,
  },
  payButtonSKR: { backgroundColor: '#9945FF' },
  payButtonDisabled: { opacity: 0.4 },
  payButtonText: { color: T.bg, fontSize: 17, fontFamily: T.fontExtraBold },

  disclaimer: { fontSize: 10, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },
});
