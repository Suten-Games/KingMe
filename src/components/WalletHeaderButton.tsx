// src/components/WalletHeaderButton.tsx
// Compact wallet button for the navigation header bar.
// Shows connection state + wallet name, tap to connect/disconnect/manage.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform, ActivityIndicator } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import { useRouter } from 'expo-router';
import WalletPickerModal from './WalletPickerModal';

function SolanaLogo({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
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
  );
}

export default function WalletHeaderButton() {
  const wallets = useStore(s => s.wallets);
  const saveProfile = useStore(s => s.saveProfile);
  const {
    connect, connecting, connected, publicKey, walletName,
    disconnect: walletDisconnect,
  } = useWallet();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected = wallets.length > 0;
  const activeAddress = publicKey?.toBase58();
  const displayAddress = activeAddress
    ? `${activeAddress.slice(0, 4)}...${activeAddress.slice(-4)}`
    : wallets[0]
    ? `${wallets[0].slice(0, 4)}...${wallets[0].slice(-4)}`
    : null;

  const handleConnect = async () => {
    setShowMenu(false);
    try {
      await connect();
      await new Promise(resolve => setTimeout(resolve, 200));
      const currentPubKey = useStore.getState().wallets.length > 0 ? null : publicKey;
      if (currentPubKey) {
        const address = currentPubKey.toBase58();
        const currentWallets = useStore.getState().wallets;
        if (!currentWallets.includes(address)) {
          useStore.setState({ wallets: [...currentWallets, address] });
          await saveProfile();
        }
      }
    } catch (error: any) {
      if (!error.message?.includes('User rejected')) {
        Alert.alert('Connection Failed', error.message || 'Failed to connect wallet');
      }
    }
  };

  const doDisconnect = async () => {
    try {
      const addr = activeAddress || wallets[0];
      const currentAssets = useStore.getState().assets;
      const filteredAssets = currentAssets.filter(asset => {
        if (asset.type !== 'crypto' && asset.type !== 'defi') return true;
        const meta = asset.metadata as any;
        return !meta?.walletAddress || meta.walletAddress !== addr;
      });
      useStore.setState({
        wallets: useStore.getState().wallets.filter(w => w !== addr),
        assets: filteredAssets,
      });
      if (connected && publicKey && publicKey.toBase58() === addr) {
        walletDisconnect();
      }
      await saveProfile();
    } catch (err: any) {
      console.error('Disconnect error:', err);
    } finally {
      setConfirmDisconnect(false);
      setShowMenu(false);
    }
  };

  if (!isConnected) {
    return (
      <>
        <TouchableOpacity style={s.btnDisconnected} onPress={handleConnect} disabled={connecting}>
          {connecting ? (
            <ActivityIndicator size="small" color="#f4c430" />
          ) : (
            <>
              <SolanaLogo size={14} />
              <Text style={s.connectText}>Connect</Text>
            </>
          )}
        </TouchableOpacity>
        <WalletPickerModal />
      </>
    );
  }

  const sessionActive = connected && !!publicKey;

  return (
    <>
      <TouchableOpacity style={[s.btnConnected, !sessionActive && s.btnExpired]} onPress={() => setShowMenu(true)}>
        <View style={[s.dot, !sessionActive && s.dotExpired]} />
        <Text style={[s.addressText, !sessionActive && s.addressTextExpired]}>{displayAddress}</Text>
      </TouchableOpacity>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => { setShowMenu(false); setConfirmDisconnect(false); }}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => { setShowMenu(false); setConfirmDisconnect(false); }}>
          <View style={s.menu} onStartShouldSetResponder={() => true}>
            <Text style={s.menuTitle}>{displayAddress}</Text>
            <Text style={s.menuSub}>
              {connected
                ? `🟢 ${walletName || 'Wallet'} · Active session`
                : '🔴 Session expired — reconnect to sign'}
            </Text>

            {wallets.length > 1 && (
              <Text style={s.menuWalletCount}>{wallets.length} wallets connected</Text>
            )}

            {!connected && (
              <TouchableOpacity style={s.menuBtn} onPress={handleConnect}>
                <Text style={s.menuBtnText}>🔗 Reconnect Session</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.menuBtn} onPress={() => { setShowMenu(false); router.push('/profile'); }}>
              <Text style={s.menuBtnText}>⚙️ Wallet Settings</Text>
            </TouchableOpacity>

            {!confirmDisconnect ? (
              <TouchableOpacity style={[s.menuBtn, s.menuBtnDanger]} onPress={() => setConfirmDisconnect(true)}>
                <Text style={[s.menuBtnText, { color: '#f87171' }]}>✕ Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.confirmRow}>
                <Text style={s.confirmText}>Remove wallet and assets?</Text>
                <View style={s.confirmButtons}>
                  <TouchableOpacity style={s.confirmCancel} onPress={() => setConfirmDisconnect(false)}>
                    <Text style={s.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.confirmYes} onPress={doDisconnect}>
                    <Text style={s.confirmYesText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <WalletPickerModal />
    </>
  );
}

const s = StyleSheet.create({
  btnDisconnected: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f4c43020', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#f4c43060', gap: 5, marginRight: 8,
  },
  connectText: { fontSize: 13, fontWeight: '700', color: '#f4c430' },
  btnConnected: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4ade8015', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#4ade8040', gap: 6, marginRight: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  dotExpired: { backgroundColor: '#f87171' },
  addressText: { fontSize: 12, fontWeight: '700', color: '#4ade80', fontFamily: 'Inter_600SemiBold' },
  addressTextExpired: { color: '#f87171' },
  btnExpired: { backgroundColor: '#f8717115', borderColor: '#f8717140' },
  overlay: {
    flex: 1, backgroundColor: '#00000080',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 90, paddingRight: 16,
  },
  menu: {
    backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16,
    minWidth: 220, borderWidth: 1, borderColor: '#2a2f3e',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  menuTitle: { fontSize: 15, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold' },
  menuSub: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 12 },
  menuWalletCount: { fontSize: 11, color: '#60a5fa', marginBottom: 10 },
  menuBtn: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2a2f3e' },
  menuBtnText: { fontSize: 14, color: '#e8e0d0', fontWeight: '600' },
  menuBtnDanger: {},
  confirmRow: { borderTopWidth: 1, borderTopColor: '#2a2f3e', paddingTop: 10 },
  confirmText: { fontSize: 13, color: '#f87171', fontWeight: '600', marginBottom: 10 },
  confirmButtons: { flexDirection: 'row', gap: 8 },
  confirmCancel: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#2a2f3e', alignItems: 'center',
  },
  confirmCancelText: { fontSize: 13, color: '#888', fontWeight: '600' },
  confirmYes: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f8717130', alignItems: 'center',
  },
  confirmYesText: { fontSize: 13, color: '#f87171', fontWeight: '700' },
});
