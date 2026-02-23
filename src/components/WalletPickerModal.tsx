// src/components/WalletPickerModal.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Modal that shows all detected Solana wallets for the user to choose from.
// Web: lists browser extensions. Mobile: shows a note about MWA.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Linking } from 'react-native';
import { useWallet, DetectedWallet } from '../providers/wallet-provider';

// Export type for cross-platform compatibility with native provider
export type WalletOption = 'phantom' | 'solflare' | 'backpack' | 'magiceden' | 'jupiter' | 'google' | 'apple' | 'coinbase' | 'exodus' | 'brave';

export default function WalletPickerModal() {
  const { detectedWallets, showPicker, setShowPicker, connect, connecting } = useWallet();

  const handleSelect = async (wallet: DetectedWallet) => {
    try {
      await connect(wallet.id);
    } catch (e: any) {
      console.error('[WalletPicker] connect failed:', e);
    }
  };

  // Don't render on mobile — MWA handles wallet selection natively
  if (Platform.OS !== 'web') return null;

  return (
    <Modal
      visible={showPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPicker(false)}
    >
      <TouchableOpacity
        style={s.overlay}
        activeOpacity={1}
        onPress={() => setShowPicker(false)}
      >
        <View style={s.modal} onStartShouldSetResponder={() => true}>
          <Text style={s.title}>Connect Wallet</Text>
          <Text style={s.subtitle}>Choose a wallet to connect</Text>

          <View style={s.walletList}>
            {detectedWallets.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={s.walletRow}
                onPress={() => handleSelect(wallet)}
                disabled={connecting}
              >
                <Text style={s.walletIcon}>{wallet.icon}</Text>
                <Text style={s.walletName}>{wallet.name}</Text>
                <Text style={s.walletArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

          {detectedWallets.length === 0 && (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>No Solana wallets detected</Text>
              <Text style={s.emptySubtext}>
                Install a browser extension to get started:
              </Text>
              <View style={s.installLinks}>
                <InstallLink name="Phantom" url="https://phantom.app" icon="👻" />
                <InstallLink name="Solflare" url="https://solflare.com" icon="🔆" />
                <InstallLink name="Backpack" url="https://backpack.app" icon="🎒" />
              </View>
            </View>
          )}

          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPicker(false)}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function InstallLink({ name, url, icon }: { name: string; url: string; icon: string }) {
  return (
    <TouchableOpacity style={s.installRow} onPress={() => Linking.openURL(url)}>
      <Text style={s.installIcon}>{icon}</Text>
      <Text style={s.installName}>{name}</Text>
      <Text style={s.installAction}>Install →</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#0d1220',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  walletList: { gap: 6 },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1f2e',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  walletIcon: { fontSize: 26 },
  walletName: { fontSize: 16, fontWeight: '700', color: '#e8e0d0', flex: 1 },
  walletArrow: { fontSize: 16, color: '#555' },
  emptyState: { alignItems: 'center', paddingVertical: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#888', marginBottom: 6 },
  emptySubtext: { fontSize: 12, color: '#555', marginBottom: 14 },
  installLinks: { gap: 6, width: '100%' },
  installRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141825',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2438',
  },
  installIcon: { fontSize: 20 },
  installName: { fontSize: 14, fontWeight: '600', color: '#e8e0d0', flex: 1 },
  installAction: { fontSize: 12, color: '#60a5fa', fontWeight: '600' },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2f3e',
  },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
