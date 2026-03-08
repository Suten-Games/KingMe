// src/components/WalletPickerModal.native.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Native wallet picker — rendered by wallet-provider.native.tsx with props.
// Shows external wallet apps (Phantom, Jupiter, Solflare) + social login (Google, Apple).
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { isSeeker } from '../utils/device';

function GoogleLogo({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleLogo({ size = 26, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.33 8.72 9.07c1.28.07 2.17.74 2.92.8.95-.19 1.86-.88 2.91-.8 1.23.1 2.15.59 2.75 1.49-2.5 1.5-1.9 4.83.4 5.77-.46 1.16-.97 2.31-1.71 3.28l.06.67zM12.03 9c-.13-2.22 1.66-4.14 3.74-4.3.28 2.39-2.14 4.5-3.74 4.3z" fill={color} />
    </Svg>
  );
}

export type WalletOption = 'phantom' | 'solflare' | 'backpack' | 'magiceden' | 'jupiter' | 'google' | 'apple' | 'coinbase' | 'exodus' | 'brave' | 'mwa';

interface Props {
  visible?: boolean;
  onClose?: () => void;
  onSelect?: (option: WalletOption) => void;
  connecting?: boolean;
  connectingWallet?: WalletOption | null;
  externalWalletsAvailable?: boolean;
}

function WalletIcon({ icon, size = 26 }: { icon: string | React.ReactNode; size?: number }) {
  if (React.isValidElement(icon)) return <>{icon}</>;
  if (typeof icon === 'string' && (icon.startsWith('data:') || icon.startsWith('http'))) {
    return <Image source={{ uri: icon }} style={{ width: size, height: size, borderRadius: 6 }} resizeMode="contain" />;
  }
  return <Text style={{ fontSize: size }}>{icon as string}</Text>;
}

const WALLET_OPTIONS: { id: WalletOption; name: string; icon: string | React.ReactNode; section: 'wallet' | 'social' | 'mwa' }[] = [
  { id: 'mwa',       name: 'Mobile Wallet',  icon: 'https://solanamobile.com/favicon.ico', section: 'mwa' },
  { id: 'phantom',   name: 'Phantom',   icon: 'https://phantom.app/img/logo_v2.svg', section: 'wallet' },
  { id: 'jupiter',   name: 'Jupiter',   icon: 'https://jup.ag/favicon.ico', section: 'wallet' },
  { id: 'solflare',  name: 'Solflare',  icon: 'https://solflare.com/favicon.ico', section: 'wallet' },
  { id: 'google',    name: 'Continue with Google', icon: <GoogleLogo />, section: 'social' },
  { id: 'apple',     name: 'Continue with Apple',  icon: <AppleLogo />, section: 'social' },
];

export default function WalletPickerModal({
  visible = false,
  onClose = () => {},
  onSelect = () => {},
  connecting = false,
  connectingWallet = null,
  externalWalletsAvailable = true,
}: Props) {
  const mwaOptions = WALLET_OPTIONS.filter(o => o.section === 'mwa');
  const walletApps = WALLET_OPTIONS.filter(o => o.section === 'wallet');
  const socialLogins = WALLET_OPTIONS.filter(o => o.section === 'social');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.modal} onStartShouldSetResponder={() => true}>
          <Text style={s.title}>Connect Wallet</Text>
          <Text style={s.subtitle}>Choose how to connect</Text>

          {/* MWA — Solana Mobile standard */}
          <Text style={s.sectionLabel}>{isSeeker ? 'SEEKER WALLET' : 'SOLANA MOBILE'}</Text>
          <View style={s.walletList}>
            {mwaOptions.map((option) => {
              const isConnecting = connecting && connectingWallet === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[s.walletRow, { borderColor: '#9945FF' }]}
                  onPress={() => onSelect(option.id)}
                  disabled={connecting}
                >
                  <WalletIcon icon={option.icon} />
                  <Text style={s.walletName}>{option.name}</Text>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#9945FF" />
                  ) : (
                    <Text style={s.walletArrow}>→</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* External wallet apps — hide on Seeker since it has built-in wallet */}
          {externalWalletsAvailable && !isSeeker && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 16 }]}>DEEP LINK</Text>
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
                      <WalletIcon icon={option.icon} />
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
                  <WalletIcon icon={option.icon} />
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
