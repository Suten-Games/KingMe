// src/components/PaidAddOns.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Premium features section for the Profile screen.
// Shows available paid tools with lock/unlock state.
// Tapping a locked tool opens a USDC payment confirmation.
// Long-press any tool to hide it. Hidden tools collapse under a toggle.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useWallet } from '../providers/wallet-provider';
import { payForAddOn, parsePriceToUsdc, getUnlockedAddOns } from '../services/addOnPayment';

const HIDDEN_KEY = 'paid_addons_hidden';

export interface AddOn {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: string;
  route: string;
  comingSoon?: boolean;
  hideable?: boolean;
}

const ADD_ONS: AddOn[] = [
  {
    id: 'business_dashboard',
    name: 'Business Dashboard',
    emoji: '\u{1F3E2}',
    description: 'Track your business \u2014 revenue, expenses, P&L, distributions',
    price: '$4.99',
    route: '/business',
    hideable: true,
  },
  {
    id: 'divorce_simulator',
    name: 'Divorce Simulator',
    emoji: '\u{1F494}',
    description: 'Calculate the financial impact of divorce \u2014 alimony, child support, asset division by state',
    price: '$4.99',
    route: '/divorce-simulator',
    hideable: true,
  },
  {
    id: 'companionship_tracker',
    name: 'Companionship',
    emoji: '\u{1F49C}',
    description: 'Track and optimize spending for a special someone \u2014 budgets, insights, and privacy',
    price: '$4.99',
    route: '/companionship',
    hideable: true,
  },
  {
    id: 'bank_consolidation',
    name: 'Bank Consolidation',
    emoji: '\u{1F3E6}',
    description: 'Analyze whether consolidating accounts saves money \u2014 fees, activity, complexity',
    price: '$2.99',
    route: '/bank-consolidation',
    hideable: true,
  },
  {
    id: 'tax_optimizer',
    name: 'Tax Loss Harvesting',
    emoji: '\u{1F9FE}',
    description: 'Identify crypto tax loss harvesting opportunities across your portfolio',
    price: '$2.99',
    route: '/tax-optimizer',
    comingSoon: true,
  },
  {
    id: 'estate_planner',
    name: 'Estate Planner',
    emoji: '\u{1F4DC}',
    description: 'Model inheritance, beneficiary splits, and estate tax implications',
    price: '$4.99',
    route: '/estate-planner',
    comingSoon: true,
  },
];

export default function PaidAddOns() {
  const router = useRouter();
  const { connected, publicKey, signTransaction, signAndSendTransaction } = useWallet();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  // Payment modal state
  const [paymentAddon, setPaymentAddon] = useState<AddOn | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    getUnlockedAddOns().then(setUnlocked);
    AsyncStorage.getItem(HIDDEN_KEY).then(raw => {
      if (raw) setHidden(new Set(JSON.parse(raw)));
    });
  }, []);

  const saveHidden = useCallback(async (newHidden: Set<string>) => {
    setHidden(newHidden);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...newHidden]));
  }, []);

  const handlePress = (addon: AddOn) => {
    if (addon.comingSoon) return;

    if (unlocked.has(addon.id)) {
      // Already unlocked — go to the tool
      router.push(addon.route as any);
      return;
    }

    // Show payment modal
    setPaymentAddon(addon);
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const handlePayment = async () => {
    if (!paymentAddon || !publicKey) return;

    setPaying(true);
    setPaymentError(null);

    const priceUsd = parsePriceToUsdc(paymentAddon.price);
    const result = await payForAddOn(
      paymentAddon.id,
      priceUsd,
      publicKey.toBase58(),
      signTransaction,
      signAndSendTransaction,
    );

    setPaying(false);

    if (result.success) {
      setPaymentSuccess(result.signature || 'confirmed');
      // Refresh unlocked set
      const updated = await getUnlockedAddOns();
      setUnlocked(updated);
    } else {
      setPaymentError(result.error || 'Payment failed');
    }
  };

  const closePaymentModal = () => {
    if (paymentSuccess && paymentAddon) {
      // Navigate to the tool after closing success modal
      const route = paymentAddon.route;
      setPaymentAddon(null);
      setPaymentSuccess(null);
      setPaymentError(null);
      router.push(route as any);
    } else {
      setPaymentAddon(null);
      setPaymentSuccess(null);
      setPaymentError(null);
    }
  };

  const handleLongPress = (addon: AddOn) => {
    if (!addon.hideable) return;

    const isHidden = hidden.has(addon.id);

    if (isHidden) {
      const next = new Set(hidden);
      next.delete(addon.id);
      saveHidden(next);
    } else {
      if (Platform.OS === 'web') {
        const next = new Set(hidden);
        next.add(addon.id);
        saveHidden(next);
      } else {
        Alert.alert(
          `Hide ${addon.name}?`,
          'You can restore it from the hidden tools section below.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Hide', style: 'destructive', onPress: () => {
              const next = new Set(hidden);
              next.add(addon.id);
              saveHidden(next);
            }},
          ]
        );
      }
    }
  };

  const visibleAddOns = ADD_ONS.filter(a => !hidden.has(a.id));
  const hiddenAddOns = ADD_ONS.filter(a => hidden.has(a.id));

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>Premium Tools</Text>
      <Text style={s.sectionSub}>Advanced financial planning tools · long-press to hide</Text>

      {visibleAddOns.map(addon => (
        <AddOnCard
          key={addon.id}
          addon={addon}
          isUnlocked={unlocked.has(addon.id)}
          onPress={() => handlePress(addon)}
          onLongPress={() => handleLongPress(addon)}
        />
      ))}

      {/* Hidden tools toggle */}
      {hiddenAddOns.length > 0 && (
        <>
          <TouchableOpacity style={s.hiddenToggle} onPress={() => setShowHidden(!showHidden)}>
            <Text style={s.hiddenToggleText}>
              {showHidden ? '\u25BE' : '\u25B8'} {hiddenAddOns.length} hidden tool{hiddenAddOns.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          {showHidden && hiddenAddOns.map(addon => (
            <AddOnCard
              key={addon.id}
              addon={addon}
              isUnlocked={unlocked.has(addon.id)}
              isHidden
              onPress={() => handlePress(addon)}
              onLongPress={() => handleLongPress(addon)}
            />
          ))}
        </>
      )}

      {/* Payment confirmation modal */}
      <Modal
        visible={!!paymentAddon}
        animationType="fade"
        transparent
        onRequestClose={closePaymentModal}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {paymentSuccess ? (
              // ── Success state ──
              <>
                <Text style={s.successEmoji}>{'\u2705'}</Text>
                <Text style={s.modalTitle}>Unlocked!</Text>
                <Text style={s.successText}>
                  {paymentAddon?.name} is now available.
                </Text>
                <Text style={s.txLink}>
                  TX: {paymentSuccess.slice(0, 20)}...
                </Text>
                <TouchableOpacity style={s.successButton} onPress={closePaymentModal}>
                  <Text style={s.successButtonText}>Open {paymentAddon?.name}</Text>
                </TouchableOpacity>
              </>
            ) : (
              // ── Confirm / Error state ──
              <>
                <Text style={s.modalEmoji}>{paymentAddon?.emoji}</Text>
                <Text style={s.modalTitle}>Unlock {paymentAddon?.name}</Text>
                <Text style={s.modalDesc}>{paymentAddon?.description}</Text>

                <View style={s.priceBox}>
                  <Text style={s.priceLabel}>One-time purchase</Text>
                  <Text style={s.priceValue}>{paymentAddon?.price} USDC</Text>
                </View>

                {!connected && (
                  <View style={s.walletWarning}>
                    <Text style={s.walletWarningText}>
                      Connect a Solana wallet to purchase with USDC
                    </Text>
                  </View>
                )}

                {paymentError && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{paymentError}</Text>
                  </View>
                )}

                <View style={s.modalButtons}>
                  <TouchableOpacity
                    style={s.cancelButton}
                    onPress={closePaymentModal}
                    disabled={paying}
                  >
                    <Text style={s.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.payButton, (!connected || paying) && s.payButtonDisabled]}
                    onPress={handlePayment}
                    disabled={!connected || paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#0a0e1a" size="small" />
                    ) : (
                      <Text style={s.payButtonText}>
                        Pay {paymentAddon?.price} USDC
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={s.disclaimer}>
                  Payment is sent directly on Solana. No refunds.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

function AddOnCard({ addon, isUnlocked, isHidden, onPress, onLongPress }: {
  addon: AddOn;
  isUnlocked: boolean;
  isHidden?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.card, addon.comingSoon && s.cardDisabled, isHidden && s.cardHidden]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={addon.comingSoon ? 1 : 0.7}
    >
      <View style={s.cardHeader}>
        <Text style={s.cardEmoji}>{addon.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{addon.name}</Text>
          <Text style={s.cardDesc}>{addon.description}</Text>
        </View>
        {isHidden ? (
          <View style={s.hiddenBadge}>
            <Text style={s.hiddenBadgeText}>Hidden</Text>
          </View>
        ) : addon.comingSoon ? (
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonText}>Soon</Text>
          </View>
        ) : isUnlocked ? (
          <View style={s.unlockedBadge}>
            <Text style={s.unlockedText}>{'\u2713'}</Text>
          </View>
        ) : (
          <View style={s.priceBadge}>
            <Text style={s.priceText}>{addon.price}</Text>
          </View>
        )}
      </View>
      {isHidden && (
        <Text style={s.unhideHint}>Long-press to restore</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#e8e0d0', marginBottom: 2 },
  sectionSub: { fontSize: 12, color: '#666', marginBottom: 12 },

  card: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2a2f3e',
  },
  cardDisabled: { opacity: 0.5 },
  cardHidden: { opacity: 0.4, borderStyle: 'dashed' as any },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardDesc: { fontSize: 12, color: '#888', marginTop: 2, lineHeight: 16 },

  priceBadge: {
    backgroundColor: '#f4c43020', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#f4c43060',
  },
  priceText: { fontSize: 13, fontWeight: '800', color: '#f4c430' },

  unlockedBadge: {
    backgroundColor: '#4ade8020', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4ade8060',
  },
  unlockedText: { fontSize: 13, fontWeight: '800', color: '#4ade80' },

  comingSoonBadge: {
    backgroundColor: '#a855f720', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#a855f760',
  },
  comingSoonText: { fontSize: 11, fontWeight: '700', color: '#a855f7' },

  hiddenBadge: {
    backgroundColor: '#66666620', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#66666640',
  },
  hiddenBadgeText: { fontSize: 11, fontWeight: '700', color: '#666' },

  hiddenToggle: { paddingVertical: 10, alignItems: 'center' },
  hiddenToggleText: { fontSize: 13, color: '#555', fontWeight: '600' },

  unhideHint: { fontSize: 10, color: '#555', marginTop: 6, textAlign: 'center' },

  // ── Payment Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#0f1320', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  modalEmoji: { fontSize: 48, marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  priceBox: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16,
    width: '100%', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#f4c43040',
  },
  priceLabel: { fontSize: 12, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  priceValue: { fontSize: 28, fontWeight: '800', color: '#f4c430' },

  walletWarning: {
    backgroundColor: '#f4c43015', borderRadius: 10, padding: 12,
    width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: '#f4c43030',
  },
  walletWarningText: { fontSize: 13, color: '#f4c430', textAlign: 'center' },

  errorBox: {
    backgroundColor: '#ff444415', borderRadius: 10, padding: 12,
    width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: '#ff444430',
  },
  errorText: { fontSize: 13, color: '#ff6b6b', textAlign: 'center' },

  modalButtons: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
  cancelButton: {
    flex: 1, padding: 16, borderRadius: 12,
    borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center',
  },
  cancelButtonText: { color: '#888', fontSize: 16, fontWeight: '600' },
  payButton: {
    flex: 1, padding: 16, borderRadius: 12,
    backgroundColor: '#f4c430', alignItems: 'center',
  },
  payButtonDisabled: { opacity: 0.4 },
  payButtonText: { color: '#0a0e1a', fontSize: 16, fontWeight: '800' },

  disclaimer: { fontSize: 10, color: '#444', textAlign: 'center' },

  // ── Success state ──
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successText: { fontSize: 16, color: '#4ade80', textAlign: 'center', marginBottom: 8 },
  txLink: { fontSize: 11, color: '#555', marginBottom: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  successButton: {
    backgroundColor: '#4ade80', borderRadius: 12, padding: 16,
    width: '100%', alignItems: 'center',
  },
  successButtonText: { color: '#0a0e1a', fontSize: 16, fontWeight: '800' },
});
