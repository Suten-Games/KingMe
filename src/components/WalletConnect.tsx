// src/components/WalletConnect.tsx - Multi-wallet support
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useWallet } from '../providers/wallet-provider';
import WalletPickerModal from './WalletPickerModal';
import SuccessModal from './SuccessModal';
import { log, warn, error as logError } from '../utils/logger';

export function WalletConnect() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectAddress, setDisconnectAddress] = useState('');
  const [popup, setPopup] = useState<{ emoji: string; title: string; message: string } | null>(null);
  
  const wallets = useStore((state) => state.wallets);
  const saveProfile = useStore((state) => state.saveProfile);
  
  const {
    connect, connecting, connected, publicKey, walletName,
    disconnect: walletDisconnect,
  } = useWallet();

  // Connect wallet (works on both web and mobile)
  const handleConnect = async () => {
    try {
      // connect() with no args: if multiple wallets detected, opens picker
      // On mobile, MWA opens the OS wallet picker natively
      await connect();
      
      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const currentPubKey = publicKey;
      
      if (!currentPubKey) {
        // Picker may have opened — connect will be called again with a walletId
        return;
      }
      
      const address = currentPubKey.toBase58();
      
      const currentWallets = useStore.getState().wallets;
      if (currentWallets.includes(address)) {
        setPopup({ emoji: '🔗', title: 'Already Connected', message: 'This wallet is already connected.' });
        return;
      }
      
      useStore.setState({
        wallets: [...currentWallets, address],
      });
      
      await handleSync(address);
      await saveProfile();
      
      setPopup({
        emoji: '📱',
        title: 'Wallet Connected!',
        message: `Connected to ${walletName || 'wallet'}: ${address.slice(0, 4)}...${address.slice(-4)}`,
      });
    } catch (error: any) {
      logError('Connection error:', error);
      if (!error.message?.includes('User rejected')) {
        setPopup({ emoji: '❌', title: 'Connection Failed', message: error.message || 'Failed to connect wallet' });
      }
    }
  };
  

  const syncWalletAssets = useStore((state) => state.syncWalletAssets);

  const handleSync = async (walletAddress?: string) => {
    setIsSyncing(true);

    try {
      const walletsToSync = walletAddress ? [walletAddress] : wallets;

      if (walletsToSync.length === 0) {
        setPopup({ emoji: '🔗', title: 'No Wallets', message: 'Please connect a wallet first.' });
        setIsSyncing(false);
        return;
      }

      log(`Starting sync for ${walletsToSync.length} wallet(s)...`);

      // Use the store's server-side sync (Helius wallet API) for each wallet
      for (const addr of walletsToSync) {
        await syncWalletAssets(addr);
      }

      await saveProfile();

      setPopup({
        emoji: '✅',
        title: 'Sync Complete!',
        message: `Synced ${walletsToSync.length} wallet(s) via Helius`,
      });
    } catch (error: any) {
      logError('Sync error:', error);
      setPopup({ emoji: '⚠️', title: 'Sync Failed', message: error.message || 'Failed to sync wallets' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectClick = (address: string) => {
    setDisconnectAddress(address);
    setShowDisconnectModal(true);
  };

  const confirmDisconnect = async () => {
    try {
      const currentWallets = useStore.getState().wallets;
      const currentAssets = useStore.getState().assets;
      
      const newWallets = currentWallets.filter(w => w !== disconnectAddress);
      
      const filteredAssets = currentAssets.filter(asset => {
        if (asset.type !== 'crypto' && asset.type !== 'defi') return true;
        const metadata = asset.metadata as any;
        return !metadata?.walletAddress || metadata.walletAddress !== disconnectAddress;
      });
      
      useStore.setState({ 
        wallets: newWallets,
        assets: filteredAssets,
      });
      
      // Disconnect from wallet adapter if this is the active wallet
      if (connected && publicKey && publicKey.toBase58() === disconnectAddress) {
        walletDisconnect();
      }
      
      await saveProfile();
      setShowDisconnectModal(false);
      setDisconnectAddress('');
      
      setPopup({ emoji: '👋', title: 'Disconnected', message: 'Wallet disconnected successfully' });
    } catch (error: any) {
      logError('Disconnect error:', error);
      setPopup({ emoji: '❌', title: 'Error', message: error.message || 'Failed to disconnect wallet' });
    }
  };

  const isActiveWallet = (address: string): boolean => {
    return connected && publicKey?.toBase58() === address;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Solana Wallets</Text>
        {wallets.length > 0 && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={() => handleSync()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#4ade80" />
            ) : (
              <Text style={styles.syncButtonText}>🔄 Sync All</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {wallets.length === 0 && !connected ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No wallets connected</Text>
          <Text style={styles.emptySubtext}>
            Connect your Solana wallet to automatically track your crypto assets
          </Text>
        </View>
      ) : (
        <View style={styles.walletsList}>
          {/* Show wallet from provider if connected but not in store yet */}
          {connected && publicKey && !wallets.includes(publicKey.toBase58()) && (
            <View style={styles.walletCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletAddress}>
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </Text>
                <View style={styles.walletLabels}>
                  <Text style={styles.walletLabel}>Syncing...</Text>
                  {walletName && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>{walletName}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
          
          {/* Show wallets from store */}
          {wallets.map((address) => (
            <View key={address} style={styles.walletCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletAddress}>
                  {address.slice(0, 4)}...{address.slice(-4)}
                </Text>
                <View style={styles.walletLabels}>
                  <Text style={styles.walletLabel}>Connected</Text>
                  {isActiveWallet(address) && walletName && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>{walletName} · Active</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => handleDisconnectClick(address)}
                style={styles.disconnectButtonContainer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.disconnectButton}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}  

      <TouchableOpacity
        style={styles.connectButton}
        onPress={handleConnect}
        disabled={connecting}
      >
        {connecting ? (
          <ActivityIndicator size="small" color="#0a0e1a" />
        ) : (
          <Text style={styles.connectButtonText}>
            {wallets.length > 0 ? '+ Add Another Wallet' : '🔗 Connect Wallet'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Wallet picker modal (web only — shown when multiple wallets detected) */}
      <WalletPickerModal />

      {/* Success / error popup */}
      <SuccessModal
        visible={!!popup}
        emoji={popup?.emoji}
        title={popup?.title || ''}
        message={popup?.message || ''}
        onClose={() => setPopup(null)}
      />

      {/* Disconnect confirmation */}
      <Modal visible={showDisconnectModal} animationType="fade" transparent={true} onRequestClose={() => setShowDisconnectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Disconnect Wallet?</Text>
            
            <Text style={styles.disconnectWarning}>
              Are you sure you want to disconnect{'\n'}
              <Text style={styles.disconnectAddress}>
                {disconnectAddress.slice(0, 4)}...{disconnectAddress.slice(-4)}
              </Text>
            </Text>
            
            <Text style={styles.disconnectSubtext}>
              This will remove all synced crypto assets from this wallet.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowDisconnectModal(false);
                  setDisconnectAddress('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={confirmDisconnect}
              >
                <Text style={styles.dangerButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  syncButton: { backgroundColor: '#1a1f2e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#4ade80' },
  syncButtonText: { color: '#4ade80', fontSize: 14, fontWeight: '600' },
  emptyState: { padding: 30, alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#444', textAlign: 'center' },
  walletsList: { marginBottom: 12 },
  walletCard: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#4ade80' },
  walletAddress: { fontSize: 16, color: '#ffffff', fontWeight: '600', marginBottom: 4 },
  walletLabels: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletLabel: { fontSize: 12, color: '#4ade80' },
  activeBadge: { backgroundColor: '#4ade8022', borderWidth: 1, borderColor: '#4ade80', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeText: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  disconnectButtonContainer: { padding: 8 },
  disconnectButton: { fontSize: 14, color: '#ff6b6b', fontWeight: '600' },
  connectButton: { backgroundColor: '#4ade80', padding: 16, borderRadius: 12, alignItems: 'center' },
  connectButtonText: { fontSize: 16, fontWeight: 'bold', color: '#0a0e1a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0a0e1a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#4ade80', marginBottom: 20 },
  disconnectWarning: { fontSize: 16, color: '#fff', marginBottom: 12, textAlign: 'center', lineHeight: 24 },
  disconnectAddress: { color: '#4ade80', fontWeight: '600' },
  disconnectSubtext: { fontSize: 13, color: '#888', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  cancelButtonText: { color: '#a0a0a0', fontSize: 16 },
  dangerButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#ff6b6b', alignItems: 'center' },
  dangerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
