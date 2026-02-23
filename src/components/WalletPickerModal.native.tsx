// src/components/WalletPickerModal.native.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Native wallet picker — rendered by wallet-provider.native.tsx with props.
// Shows external wallet apps (Phantom, Jupiter, Solflare) + social login (Google, Apple).
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';

export type WalletOption = 'phantom' | 'solflare' | 'backpack' | 'magiceden' | 'jupiter' | 'google' | 'apple' | 'coinbase' | 'exodus' | 'brave';

interface Props {
  visible?: boolean;
  onClose?: () => void;
  onSelect?: (option: WalletOption) => void;
  connecting?: boolean;
  connectingWallet?: WalletOption | null;
  externalWalletsAvailable?: boolean;
}

const WALLET_OPTIONS: { id: WalletOption; name: string; icon: string; section: 'wallet' | 'social' }[] = [
  { id: 'phantom',   name: 'Phantom',   icon: '👻', section: 'wallet' },
  { id: 'jupiter',   name: 'Jupiter',   icon: '🪐', section: 'wallet' },
  { id: 'solflare',  name: 'Solflare',  icon: '🔆', section: 'wallet' },
  { id: 'google',    name: 'Continue with Google', icon: '🔵', section: 'social' },
  { id: 'apple',     name: 'Continue with Apple',  icon: '🍎', section: 'social' },
];

export default function WalletPickerModal({
  visible = false,
  onClose = () => {},
  onSelect = () => {},
  connecting = false,
  connectingWallet = null,
  externalWalletsAvailable = true,
}: Props) {
  const walletApps = WALLET_OPTIONS.filter(o => o.section === 'wallet');
  const socialLogins = WALLET_OPTIONS.filter(o => o.section === 'social');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.modal} onStartShouldSetResponder={() => true}>
          <Text style={s.title}>Connect Wallet</Text>
          <Text style={s.subtitle}>Choose how to connect</Text>

          {/* External wallet apps */}
          {externalWalletsAvailable && (
            <>
              <Text style={s.sectionLabel}>WALLET APPS</Text>
              <View style={s.walletList}>
                {walletApps.map((option) => {
                  const isConnecting = connecting && connectingWallet === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={s.walletRow}
                      onPress={() => onSelect(option.id)}
                      disabled={connecting}
                    >
                      <Text style={s.walletIcon}>{option.icon}</Text>
                      <Text style={s.walletName}>{option.name}</Text>
                      {isConnecting ? (
                        <ActivityIndicator size="small" color="#f4c430" />
                      ) : (
                        <Text style={s.walletArrow}>→</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Social login via Privy */}
          <Text style={[s.sectionLabel, { marginTop: 16 }]}>NO WALLET? NO PROBLEM</Text>
          <View style={s.walletList}>
            {socialLogins.map((option) => {
              const isConnecting = connecting && connectingWallet === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[s.walletRow, s.socialRow]}
                  onPress={() => onSelect(option.id)}
                  disabled={connecting}
                >
                  <Text style={s.walletIcon}>{option.icon}</Text>
                  <Text style={s.walletName}>{option.name}</Text>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#60a5fa" />
                  ) : (
                    <Text style={s.walletArrow}>→</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.socialHint}>
            We'll create a secure Solana wallet for you automatically
          </Text>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modal: {
    backgroundColor: '#0d1220', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#2a2f3e',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#555', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
  walletList: { gap: 6 },
  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1a1f2e', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#2a2f3e',
  },
  socialRow: {
    backgroundColor: '#141825', borderColor: '#1e2438',
  },
  walletIcon: { fontSize: 26 },
  walletName: { fontSize: 16, fontWeight: '700', color: '#e8e0d0', flex: 1 },
  walletArrow: { fontSize: 16, color: '#555' },
  socialHint: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2f3e',
  },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
