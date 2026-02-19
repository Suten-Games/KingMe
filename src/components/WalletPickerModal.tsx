// src/components/WalletPickerModal.tsx
// Shows wallet options: external wallets (Phantom, Solflare) + social login (Google/Apple)
import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import { T } from '../theme';

export type WalletOption = 'phantom' | 'jupiter' | 'solflare' | 'backpack' | 'google' | 'apple';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: WalletOption) => void;
  connecting: boolean;
  connectingWallet: WalletOption | null;
  externalWalletsAvailable?: boolean;
}

const EXTERNAL_WALLETS: { id: WalletOption; name: string; icon: string; color: string; storeUrl: string }[] = [
  { id: 'phantom', name: 'Phantom', icon: '👻', color: '#AB9FF2', storeUrl: 'https://phantom.app/download' },
  { id: 'jupiter', name: 'Jupiter', icon: '🪐', color: '#C7F284', storeUrl: 'https://jup.ag/download' },
  { id: 'solflare', name: 'Solflare', icon: '🔥', color: '#FC8E1A', storeUrl: 'https://solflare.com/download' },
];

const SOCIAL_LOGINS: { id: WalletOption; name: string; icon: string; subtitle: string }[] = [
  { id: 'google', name: 'Continue with Google', icon: '🔵', subtitle: 'We\'ll create a wallet for you' },
  { id: 'apple', name: 'Continue with Apple', icon: '🍎', subtitle: 'We\'ll create a wallet for you' },
];

export default function WalletPickerModal({ visible, onClose, onSelect, connecting, connectingWallet, externalWalletsAvailable = false }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Connect Wallet</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Social Login — primary for mobile */}
          <Text style={s.sectionLabel}>Get Started</Text>
          <Text style={s.sectionSubtext}>
            Sign in to create a secure wallet instantly — no apps to install, no seed phrases.
          </Text>
          <View style={s.socialList}>
            {SOCIAL_LOGINS.map((login) => {
              const isConnecting = connecting && connectingWallet === login.id;
              return (
                <TouchableOpacity
                  key={login.id}
                  style={[s.socialRow, isConnecting && s.walletRowActive]}
                  activeOpacity={0.7}
                  onPress={() => onSelect(login.id)}
                  disabled={connecting}
                >
                  <Text style={s.socialIcon}>{login.icon}</Text>
                  <View style={s.socialText}>
                    <Text style={s.socialName}>{login.name}</Text>
                    <Text style={s.socialSub}>{login.subtitle}</Text>
                  </View>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color={T.gold} />
                  ) : (
                    <Text style={s.walletArrow}>→</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>already have a wallet?</Text>
            <View style={s.dividerLine} />
          </View>

          {/* External Wallets */}
          <View style={s.walletList}>
            {EXTERNAL_WALLETS.map((wallet) => {
              const isConnecting = connecting && connectingWallet === wallet.id;
              const disabled = !externalWalletsAvailable || connecting;

              return (
                <TouchableOpacity
                  key={wallet.id}
                  style={[s.walletRow, disabled && !isConnecting && s.walletRowDisabled]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (externalWalletsAvailable) {
                      onSelect(wallet.id);
                    } else {
                      // Open wallet download page
                      Linking.openURL(wallet.storeUrl);
                    }
                  }}
                  disabled={connecting}
                >
                  <View style={[s.walletIcon, { backgroundColor: wallet.color + '22', borderColor: wallet.color + '44' }]}>
                    <Text style={s.walletEmoji}>{wallet.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.walletName, disabled && s.walletNameDisabled]}>{wallet.name}</Text>
                    {!externalWalletsAvailable && (
                      <Text style={s.comingSoonText}>Deep link — coming soon</Text>
                    )}
                  </View>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color={T.gold} />
                  ) : (
                    <Text style={[s.walletArrow, { color: disabled ? T.textDim : wallet.color }]}>→</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <Text style={s.footer}>
            Your keys, your crypto. KingMe never has access to your funds.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    color: T.gold,
    fontFamily: T.fontExtraBold,
  },
  closeButton: {
    fontSize: 20,
    color: T.textMuted,
    padding: 4,
  },

  sectionLabel: {
    fontSize: 14,
    color: T.textSecondary,
    fontFamily: T.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionSubtext: {
    fontSize: 13,
    color: T.textMuted,
    fontFamily: T.fontRegular,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },

  walletList: {
    gap: 8,
    marginBottom: 20,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: T.border,
  },
  walletRowActive: {
    borderColor: T.gold + '80',
    backgroundColor: T.gold + '08',
  },
  walletRowDisabled: {
    opacity: 0.6,
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  walletEmoji: {
    fontSize: 22,
  },
  walletName: {
    fontSize: 17,
    color: T.textPrimary,
    fontFamily: T.fontSemiBold,
  },
  walletNameDisabled: {
    color: T.textSecondary,
  },
  comingSoonText: {
    fontSize: 11,
    color: T.textDim,
    fontFamily: T.fontRegular,
    marginTop: 2,
  },
  walletArrow: {
    fontSize: 20,
    color: T.textMuted,
    fontFamily: T.fontBold,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: T.border,
  },
  dividerText: {
    fontSize: 12,
    color: T.textDim,
    fontFamily: T.fontMedium,
    marginHorizontal: 16,
  },

  socialList: {
    gap: 8,
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: T.border,
  },
  socialIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  socialText: {
    flex: 1,
  },
  socialName: {
    fontSize: 16,
    color: T.textPrimary,
    fontFamily: T.fontSemiBold,
    marginBottom: 2,
  },
  socialSub: {
    fontSize: 12,
    color: T.textMuted,
    fontFamily: T.fontRegular,
  },

  footer: {
    fontSize: 12,
    color: T.textDim,
    textAlign: 'center',
    fontFamily: T.fontRegular,
    lineHeight: 16,
  },
});
