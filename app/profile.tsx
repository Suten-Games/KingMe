// app/(tabs)/profile.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Platform, Switch, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WalletHeaderButton from '../src/components/WalletHeaderButton';
import { useStore, useFreedomScore } from '../src/store/useStore';
import { useWallet } from '../src/providers/wallet-provider';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { loadBackup, saveBackup } from '@/services/encryptedBackup';
import { buildFullBackup, restoreAsyncData, deserializeBackup, serializeBackup } from '@/services/fullBackup';
import AsyncStorage from '@react-native-async-storage/async-storage';
//import { encryptProfileWithWallet, decryptProfileWithWallet } from './walletStorage';
const BACKUP_API = process.env.EXPO_PUBLIC_BACKUP_API_URL || 'http://localhost:3000/api/backup';
import AssetSectionSettings from '../src/components/AssetSectionSettings';
import PaidAddOns from '../src/components/PaidAddOns';
import KingMeFooter from '../src/components/KingMeFooter';
import { DEMO_PERSONAS, type DemoPersona } from '../src/utils/demoPersonas';

/** Cross-platform confirm — Alert.alert button callbacks don't fire on web */
function crossConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function ProfileScreen() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallets         = useStore((state) => state.wallets);
  const income            = useStore((state) => state.income);
  const avatarType        = useStore((state) => state.settings.avatarType);
  const animatedAvatar    = useStore((state) => state.settings.animatedAvatar ?? false);
  const assets            = useStore((state) => state.assets);
  const obligations       = useStore((state) => state.obligations);
  const bankAccounts      = useStore((state) => state.bankAccounts);
  const exportBackup      = useStore((state) => state.exportBackup);
  const importBackup      = useStore((state) => state.importBackup);
  const resetStore        = useStore((state) => state.resetStore);

  const freedom = useFreedomScore();
  
  // Wallet provider
  const { signMessage, publicKey, connected } = useWallet();

  // ── Add-account modal state ──────────────────────────────────────────────
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [backupJson, setBackupJson]       = useState('');
  const [importJson, setImportJson]       = useState('');
  
  // Arweave sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Styled alert modal (replaces window.alert / Alert.alert)
  const [alertModal, setAlertModal] = useState<{ title: string; message?: string } | null>(null);
  const crossAlert = (title: string, message?: string) => setAlertModal({ title, message });

  // ── Demo / Sandbox mode ─────────────────────────────────────────────────
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [savedRealProfile, setSavedRealProfile] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const handleLoadPersona = async (persona: DemoPersona) => {
    // Save real profile first (only on first demo load)
    if (!savedRealProfile) {
      const backup = exportBackup();
      setSavedRealProfile(backup);
      // Also stash goals & accumulation plans so they don't bleed into demo
      try {
        const [goals, plans] = await Promise.all([
          AsyncStorage.getItem('kingme_goals'),
          AsyncStorage.getItem('accumulation_plans'),
        ]);
        await AsyncStorage.setItem('_demo_saved_goals', goals || '[]');
        await AsyncStorage.setItem('_demo_saved_plans', plans || '{}');
      } catch {}
    }
    // Clear goals & plans for demo persona
    await Promise.all([
      AsyncStorage.setItem('kingme_goals', '[]'),
      AsyncStorage.setItem('accumulation_plans', '{}'),
    ]);
    importBackup(JSON.stringify({ version: '1.0.0', exportedAt: new Date().toISOString(), profile: { ...persona.profile, onboardingComplete: true } }));
    setActivePersona(persona.id);
    setIsDemoMode(true);
    setShowDemoModal(false);
  };

  const handleExitDemo = async () => {
    if (savedRealProfile) {
      importBackup(savedRealProfile);
      setSavedRealProfile(null);
      // Restore saved goals & accumulation plans
      try {
        const [goals, plans] = await Promise.all([
          AsyncStorage.getItem('_demo_saved_goals'),
          AsyncStorage.getItem('_demo_saved_plans'),
        ]);
        await Promise.all([
          AsyncStorage.setItem('kingme_goals', goals || '[]'),
          AsyncStorage.setItem('accumulation_plans', plans || '{}'),
          AsyncStorage.removeItem('_demo_saved_goals'),
          AsyncStorage.removeItem('_demo_saved_plans'),
        ]);
      } catch {}
    }
    setIsDemoMode(false);
    setActivePersona(null);
  };

  // ── Confirmation state (for delete) ──────────────────────────────────────
  const totalBalance = bankAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const handleResetOnboarding = () => {
    crossConfirm(
      'Reset All Data?',
      'This will clear all your data and restart onboarding. Are you sure?',
      async () => {
        try {
          // 1. Clear all AsyncStorage keys (profile, snapshots, watchlist, etc.)
          await AsyncStorage.clear();
          console.log('[RESET] AsyncStorage cleared');

          // 2. Reset zustand store to initial state
          resetStore();
          console.log('[RESET] Store reset');

          // 3. Navigate to onboarding after a brief delay so state settles
          setTimeout(() => {
            router.replace('/onboarding/intro');
          }, 300);
        } catch (err) {
          console.error('[RESET] Error during reset:', err);
          // Even if something fails, try to navigate
          resetStore();
          setTimeout(() => router.replace('/onboarding/intro'), 300);
        }
      }
    );
  };

  const handleExportBackup = async () => {
    try {
      const storeJson = exportBackup();
      const storeData = JSON.parse(storeJson);
      const fullBackup = await buildFullBackup(storeData);
      setBackupJson(JSON.stringify(fullBackup));
      setShowBackupModal(true);
    } catch (error) {
      crossAlert('Error', 'Failed to create backup: ' + (error as Error).message);
    }
  };

  const handleImportBackup = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const isV2 = parsed?.version >= 2 && parsed?.store;
      const storeJson = isV2 ? JSON.stringify(parsed.store) : importJson;
      importBackup(storeJson);

      // Restore AsyncStorage satellite data if v2
      if (isV2 && parsed.asyncStorage) {
        const count = await restoreAsyncData(parsed.asyncStorage);
        crossAlert('Success', `Backup imported! + ${count} feature stores restored.`);
      } else {
        crossAlert('Success', 'Backup imported successfully!');
      }
      setImportJson('');
      setShowImportModal(false);
    } catch (error) {
      crossAlert('Error', 'Failed to import backup: ' + (error as Error).message);
    }
  };

  const handleCopyBackup = async () => {
    try {
      await Clipboard.setStringAsync(backupJson);
      crossAlert('Copied!', 'Backup copied to clipboard!');
    } catch (error) {
      crossAlert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: create download link (with type guards)
        if (typeof window !== 'undefined' && 'document' in window) {
          const blob = new Blob([backupJson], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          a.download = `kingme-backup-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        // Mobile: save to file and share
        const fileUri = `${FileSystem.documentDirectory}kingme-backup-${new Date().toISOString().split('T')[0]}.json`;
        await FileSystem.writeAsStringAsync(fileUri, backupJson);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          crossAlert('Saved', `Backup saved to ${fileUri}`);
        }
      }
    } catch (error) {
      crossAlert('Error', 'Failed to download backup');
    }
  };
  
  // Arweave backup/restore
  const handleArweaveBackup = async () => {
    if (!connected || !publicKey) {
      crossAlert('No Wallet Connected', 'Please connect a wallet first to enable encrypted backup.');
      return;
    }

    setIsSyncing(true);
    
    try {
      const storeData = {
        bankAccounts,
        income,
        obligations: useStore.getState().obligations,
        debts: useStore.getState().debts,
        assets,
        desires: useStore.getState().desires,
        wallets: useStore.getState().wallets,
        paycheckDeductions: useStore.getState().paycheckDeductions,
        preTaxDeductions: useStore.getState().preTaxDeductions,
        taxes: useStore.getState().taxes,
        postTaxDeductions: useStore.getState().postTaxDeductions,
        bankTransactions: useStore.getState().bankTransactions || [],
        driftTrades: useStore.getState().driftTrades || [],
        dailyExpenses: useStore.getState().dailyExpenses || [],
        investmentTheses: useStore.getState().investmentTheses || [],
        thesisAlerts: useStore.getState().thesisAlerts || [],
        whatIfScenarios: useStore.getState().whatIfScenarios || [],
        cryptoCardBalance: useStore.getState().cryptoCardBalance,
        expenseTrackingMode: useStore.getState().expenseTrackingMode,
        freedomHistory: useStore.getState().freedomHistory || [],
        settings: useStore.getState().settings,
        onboardingComplete: useStore.getState().onboardingComplete,
        // Badge system
        earnedBadges: useStore.getState().earnedBadges || [],
        trimCount: useStore.getState().trimCount ?? 0,
        importWeeks: useStore.getState().importWeeks ?? [],
        appOpenDays: useStore.getState().appOpenDays ?? [],
      };

      // Build full backup: store + ALL AsyncStorage satellite data
      // (goals, accumulation plans, watchlist, portfolio snapshots, business data, etc.)
      const fullBackup = await buildFullBackup(storeData);
      
      const txId = await saveBackup(fullBackup, signMessage, publicKey.toBase58());
      
      setLastSyncTime(new Date().toISOString());
      
      crossAlert(
        'Backup Complete! 🌐',
        `Profile encrypted and backed up.\n\nTransaction: ${txId.slice(0, 12)}...\n\nIncludes: store data + ${Object.keys(fullBackup.asyncStorage).length} feature stores (goals, plans, snapshots, etc.)\n\nYou can restore on any device with this wallet.`
      );
    } catch (error: any) {
      console.error('Backup failed:', error);
      crossAlert('Backup Failed', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArweaveRestore = async () => {
    if (!connected || !publicKey) {
      crossAlert('No Wallet Connected', 'Please connect a wallet first to restore your backup.');
      return;
    }

    crossConfirm(
      'Restore from Cloud Backup?',
      'This will replace all current data with your backed-up profile. Continue?',
      async () => {
        setIsSyncing(true);
        
        try {
          const rawBackup = await loadBackup(publicKey.toBase58(), signMessage);

          // Handle both v1 (flat store) and v2 (store + asyncStorage) formats
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
            wallets: profileData.wallets || [publicKey.toBase58()],
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
            onboardingComplete: profileData.onboardingComplete ?? true,
            // Badge system
            earnedBadges: profileData.earnedBadges || [],
            trimCount: profileData.trimCount ?? 0,
            importWeeks: profileData.importWeeks ?? [],
            appOpenDays: profileData.appOpenDays ?? [],
          });
          
          await useStore.getState().saveProfile();

          // Restore AsyncStorage satellite data (goals, plans, snapshots, etc.)
          let asyncCount = 0;
          if (asyncData && Object.keys(asyncData).length > 0) {
            asyncCount = await restoreAsyncData(asyncData);
          }
          
          const backupTime = isV2 ? rawBackup.timestamp : profileData.timestamp;
          setLastSyncTime(backupTime);
          
          crossAlert(
            'Restore Complete! ✅',
            `Profile restored from backup.${asyncCount > 0 ? `\n\n+ ${asyncCount} feature stores restored (goals, plans, snapshots, etc.)` : ''}\n\nLast backup: ${backupTime ? new Date(backupTime).toLocaleString() : 'Unknown'}`
          );
        } catch (error: any) {
          console.error('Restore failed:', error);
          crossAlert('Restore Failed', error.message || 'No backup found for this wallet');
        } finally {
          setIsSyncing(false);
        }
      }
    );
  };



  return (
    <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      {/* KingMe branded header */}
      <LinearGradient
        colors={['#10162a', '#0c1020', '#080c18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: Math.max(insets.top, 14) }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ padding: 8, marginRight: 2 }}>
            <Text style={{ fontSize: 20, color: '#60a5fa', fontWeight: '600' }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Image source={require('../src/assets/images/kingmelogo.jpg')} style={{ width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' }} resizeMode="cover" />
            <MaskedView maskElement={<Text style={{ fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>}>
              <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#f4c430', letterSpacing: 1.2, lineHeight: 28, opacity: 0, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>
              </LinearGradient>
            </MaskedView>
          </TouchableOpacity>
          <View style={{ marginLeft: 'auto' }}><WalletHeaderButton /></View>
        </View>
        <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, marginTop: 10, borderRadius: 1 }} />
      </LinearGradient>

      <ScrollView style={styles.container}>
        <View style={styles.content}>

        {/* ── Wallets (connect/disconnect via header button) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solana Wallets</Text>
          <View style={styles.card}>
            {wallets.length === 0 ? (
              <>
                <Text style={styles.emptyText}>No wallets connected</Text>
                <Text style={styles.emptySubtext}>Tap the wallet button in the top right to connect</Text>
              </>
            ) : (
              <>
                {wallets.map((addr, i) => (
                  <View key={addr} style={[styles.row, i > 0 && { marginTop: 8 }]}>
                    <Text style={styles.label}>{addr.slice(0, 4)}...{addr.slice(-4)}</Text>
                    <Text style={[styles.value, { color: connected && publicKey?.toBase58() === addr ? '#4ade80' : '#888' }]}>
                      {connected && publicKey?.toBase58() === addr ? '🟢 Active' : '🔴 Session expired'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* ── Bank Accounts (managed in Assets tab) ─────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {bankAccounts.length > 0
                ? `${bankAccounts.length} account${bankAccounts.length > 1 ? 's' : ''} · $${totalBalance.toLocaleString()} total`
                : 'No accounts added yet'}
            </Text>
            <Text style={styles.emptySubtext}>Manage bank accounts in the Assets tab</Text>
          </View>
        </View>

        {/* ── Income ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Annual Salary</Text>
              <Text style={styles.value}>${income.salary.toLocaleString()}</Text>
            </View>
            {income.otherIncome > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Other Income</Text>
                <Text style={styles.value}>${income.otherIncome.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Asset Income (Annual)</Text>
              <Text style={styles.valueGreen}>${(freedom.dailyAssetIncome * 365).toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.labelBold}>Total Annual Income</Text>
              <Text style={styles.valueBold}>
                ${(income.salary + income.otherIncome + (freedom.dailyAssetIncome * 365)).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Freedom Stats ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Freedom Stats</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Freedom Days</Text>
              <Text style={styles.valueBold}>{freedom.formatted}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Current State</Text>
              <Text style={styles.value}>{freedom.state}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total Assets</Text>
              <Text style={styles.value}>{assets.length}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total Obligations</Text>
              <Text style={styles.value}>{obligations.length}</Text>
            </View>
          </View>
        </View>

        {/* ── Business ── */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/business' as any)} style={styles.businessLink}>
            <LinearGradient colors={['#1a2a40', '#101828', '#0a0e1a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.businessLinkInner}>
              <Text style={styles.businessEmoji}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.businessTitle}>Suten LLC</Text>
                <Text style={styles.businessSub}>Business dashboard, revenue & expenses</Text>
              </View>
              <Text style={styles.businessArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Premium Tools ── */}
        <View style={styles.section}>
          <PaidAddOns />
        </View>

        {/* ── Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Avatar</Text>
              <Text style={styles.value}>
                {avatarType === 'male-medium' ? 'Male' : avatarType === 'female-medium' ? 'Female' : 'Male (Dark)'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Animated Avatar</Text>
                <Text style={[styles.label, { fontSize: 11, color: '#555', marginTop: 2 }]}>
                  Play video instead of static image (where available)
                </Text>
              </View>
              <Switch
                value={animatedAvatar}
                onValueChange={(val) => {
                  useStore.setState((s) => ({
                    settings: { ...s.settings, animatedAvatar: val },
                  }));
                }}
                trackColor={{ false: '#2a2f3e', true: '#f4c43060' }}
                thumbColor={animatedAvatar ? '#f4c430' : '#666'}
              />
            </View>
          </View>
          <AssetSectionSettings />
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.backupButton, { backgroundColor: '#1a2a3a' }]}
            onPress={() => router.push('/onboarding/intro')}
          >
            <Text style={[styles.backupButtonText, { color: '#60a5fa' }]}>🎬 Replay Intro</Text>
          </TouchableOpacity>
        </View>

        {/* ── Backup & Restore ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup & Restore</Text>
          <Text style={styles.sectionSubtext}>
            Export your data to keep it safe. You can reimport it anytime.
          </Text>
          
          <TouchableOpacity style={styles.backupButton} onPress={handleExportBackup}>
            <Text style={styles.backupButtonText}>📥 Export Backup</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.restoreButton} onPress={() => setShowImportModal(true)}>
            <Text style={styles.restoreButtonText}>📤 Import Backup</Text>
          </TouchableOpacity>
        </View>

        {/* ── Encrypted Sync ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Encrypted Cloud Backup</Text>
          <Text style={styles.sectionSubtext}>
            Backup your profile permanently to encrypted cloud storage. Only you can decrypt it with your wallet.
          </Text>
          
          {lastSyncTime && (
            <Text style={styles.lastSyncText}>
              Last backup: {new Date(lastSyncTime).toLocaleString()}
            </Text>
          )}
          
          <View style={styles.syncButtons}>
            <TouchableOpacity
              style={[styles.syncButton, styles.backupButton]}
              onPress={handleArweaveBackup}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.backupButtonText}>📤 Backup to Cloud (encrypted)</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.syncButton, styles.restoreButton]}
              onPress={handleArweaveRestore}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.restoreButtonText}>📥 Restore</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {!connected && wallets.length > 0 && (
            <Text style={styles.warningText}>💡 Tap "Connect Wallet" above to unlock backup & restore for this session</Text>
          )}
          {!connected && wallets.length === 0 && (
            <Text style={styles.warningText}>⚠️ Connect a wallet above to enable encrypted cloud backup</Text>
          )}
        </View>

        {/* ── Demo Mode ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demo Mode</Text>
          {isDemoMode ? (
            <View>
              <View style={styles.demoBanner}>
                <Text style={styles.demoBannerEmoji}>
                  {DEMO_PERSONAS.find(p => p.id === activePersona)?.emoji || '\u{1F3AD}'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoBannerTitle}>
                    Sandbox: {DEMO_PERSONAS.find(p => p.id === activePersona)?.name}
                  </Text>
                  <Text style={styles.demoBannerSub}>Your real profile is saved and will restore when you exit</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.demoSwitchBtn} onPress={() => setShowDemoModal(true)}>
                  <Text style={styles.demoSwitchBtnText}>Switch Persona</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoExitBtn} onPress={handleExitDemo}>
                  <Text style={styles.demoExitBtnText}>Exit Demo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.demoEnterBtn} onPress={() => setShowDemoModal(true)}>
              <Text style={styles.demoEnterEmoji}>{'\u{1F3AD}'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoEnterTitle}>Enter Sandbox Mode</Text>
                <Text style={styles.demoEnterSub}>Load preset financial profiles to demo different situations</Text>
              </View>
              <Text style={styles.demoEnterArrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Danger Zone ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleResetOnboarding}>
            <Text style={styles.dangerButtonText}>Reset All Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KingMeFooter />

      {/* Bank account modals removed — accounts managed in Assets tab */}

      {/* ═══════════════ BACKUP MODAL ═══════════════ */}
      <Modal visible={showBackupModal} animationType="slide" transparent={true} onRequestClose={() => setShowBackupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Export Backup</Text>
              <Text style={styles.modalSubtext}>
                Your complete profile data. Keep this safe!
              </Text>

              <TextInput
                style={[styles.modalInput, { height: 200, fontFamily: 'monospace', fontSize: 11 }]}
                multiline
                value={backupJson}
                editable={false}
                selectTextOnFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={handleCopyBackup}>
                  <Text style={styles.modalButtonText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleDownloadBackup}>
                  <Text style={styles.modalButtonText}>💾 Download</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBackupModal(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ IMPORT MODAL ═══════════════ */}
      <Modal visible={showImportModal} animationType="slide" transparent={true} onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Import Backup</Text>
              <Text style={styles.modalSubtext}>
                Paste your backup JSON here. This will replace all current data!
              </Text>

              <TextInput
                style={[styles.modalInput, { height: 200, fontFamily: 'monospace', fontSize: 11 }]}
                multiline
                placeholder="Paste backup JSON..."
                placeholderTextColor="#666"
                value={importJson}
                onChangeText={setImportJson}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setImportJson(''); setShowImportModal(false); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, !importJson && styles.modalButtonDisabled]} 
                  onPress={handleImportBackup}
                  disabled={!importJson}
                >
                  <Text style={styles.modalButtonText}>Import</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ═══════════════ STYLED ALERT MODAL ═══════════════ */}
      <Modal visible={alertModal !== null} transparent animationType="fade" onRequestClose={() => setAlertModal(null)}>
        <View style={styles.alertOverlay}>
          <LinearGradient
            colors={['#1a2240', '#121830', '#0c1020']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.alertBox}
          >
            <Text style={styles.alertTitle}>{alertModal?.title}</Text>
            {alertModal?.message ? (
              <Text style={styles.alertMessage}>{alertModal.message}</Text>
            ) : null}
            <TouchableOpacity style={styles.alertButton} onPress={() => setAlertModal(null)}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
      {/* ═══════════════ DEMO PERSONA PICKER ═══════════════ */}
      <Modal visible={showDemoModal} transparent animationType="slide" onRequestClose={() => setShowDemoModal(false)}>
        <View style={styles.alertOverlay}>
          <LinearGradient
            colors={['#1a2240', '#121830', '#0c1020']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.demoModalBox}
          >
            <Text style={styles.alertTitle}>Choose a Persona</Text>
            <Text style={[styles.alertMessage, { marginBottom: 16 }]}>
              Your real profile will be saved and restored when you exit demo mode.
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {DEMO_PERSONAS.map(persona => (
                <TouchableOpacity
                  key={persona.id}
                  style={[
                    styles.demoPersonaCard,
                    activePersona === persona.id && { borderColor: persona.color, backgroundColor: persona.color + '15' },
                  ]}
                  onPress={() => handleLoadPersona(persona)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoPersonaEmoji}>{persona.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.demoPersonaName, { color: persona.color }]}>{persona.name}</Text>
                    <Text style={styles.demoPersonaDesc}>{persona.description}</Text>
                  </View>
                  {activePersona === persona.id && (
                    <Text style={{ color: persona.color, fontWeight: '800', fontSize: 16 }}>{'\u2713'}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.alertButton, { marginTop: 16 }]} onPress={() => setShowDemoModal(false)}>
              <Text style={styles.alertButtonText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#f4c430', marginBottom: 30 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  addButton: { backgroundColor: '#4ade80', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },
  card: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { fontSize: 16, color: '#a0a0a0' },
  labelBold: { fontSize: 16, color: '#ffffff', fontWeight: 'bold' },
  value: { fontSize: 16, color: '#ffffff' },
  valueGreen: { fontSize: 16, color: '#4ade80', fontWeight: '600' },
  valueBold: { fontSize: 16, color: '#f4c430', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#2a2f3e', marginVertical: 8 },
  accountCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIcon: { fontSize: 24 },
  accountName: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  accountInstitution: { fontSize: 13, color: '#666', marginTop: 2 },
  accountRight: { alignItems: 'flex-end', gap: 4 },
  accountBalance: { fontSize: 18, fontWeight: 'bold', color: '#4ade80' },
  deleteButton: { fontSize: 18, color: '#ff4444', paddingHorizontal: 4 },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a2f3e' },
  primaryDot: { fontSize: 14, color: '#666' },
  primaryDotActive: { color: '#4ade80' },
  primaryLabel: { fontSize: 13, color: '#666' },
  primaryLabelActive: { color: '#4ade80', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2f3e' },
  totalLabel: { fontSize: 14, color: '#a0a0a0' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#4ade80' },
  emptyText: { fontSize: 15, color: '#666', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#444' },
  sectionSubtext: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  backupButton: { backgroundColor: '#4ade80', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  backupButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 16 },
  restoreButton: { backgroundColor: '#60a5fa', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  restoreButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 16 },
  dangerButton: { backgroundColor: '#ff4444', padding: 16, borderRadius: 12, alignItems: 'center' },
  dangerButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  // Arweave sync styles
  lastSyncText: { fontSize: 12, color: '#4ade80', marginBottom: 12 },
  syncButtons: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  syncButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  warningText: { fontSize: 12, color: '#ff9f43', textAlign: 'center', marginTop: 8 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#4ade80', marginBottom: 20 },
  modalLabel: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, marginTop: 14 },
  modalInput: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#ffffff', borderWidth: 2, borderColor: '#2a2f3e',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 2, borderColor: '#2a2f3e',
  },
  currencySymbol: { fontSize: 20, color: '#4ade80', marginRight: 8 },
  inputRowField: { flex: 1, fontSize: 20, color: '#ffffff', paddingVertical: 16 },
  typeButtons: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  typeButtonActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  typeButtonText: { fontSize: 14, color: '#666' },
  typeButtonTextActive: { color: '#4ade80', fontWeight: 'bold' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#2a2f3e', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  checkmark: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 14, color: '#a0a0a0' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  modalCancelText: { color: '#a0a0a0', fontSize: 16 },
  modalAddButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
  modalSubtext: { fontSize: 14, color: '#a0a0a0', marginBottom: 16, lineHeight: 20 },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
  modalCloseButton: { padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center', marginTop: 12 },
  modalCloseText: { color: '#a0a0a0', fontSize: 16 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  confirmBox: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 24, width: '100%' },
  confirmTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 10 },
  confirmBody: { fontSize: 14, color: '#a0a0a0', lineHeight: 20, marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmCancel: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  confirmCancelText: { color: '#a0a0a0', fontSize: 16 },
  confirmDelete: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#ff4444', alignItems: 'center' },
  confirmDeleteText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // Business link
  businessLink: { marginBottom: 0 },
  businessLinkInner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e', gap: 12 },
  businessEmoji: { fontSize: 28 },
  businessTitle: { fontSize: 16, fontWeight: '700', color: '#f4c430' },
  businessSub: { fontSize: 12, color: '#888', marginTop: 2 },
  businessArrow: { fontSize: 18, color: '#555', fontWeight: '700' },

  // Alert modal
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertBox: { borderRadius: 16, borderWidth: 1.5, borderColor: '#f4c43040', padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  alertTitle: { fontSize: 20, fontWeight: '800', color: '#f4c430', textAlign: 'center', marginBottom: 12 },
  alertMessage: { fontSize: 14, color: '#c0b890', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  alertButton: { backgroundColor: '#f4c430', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10 },
  alertButtonText: { fontSize: 16, fontWeight: '800', color: '#0a0e1a' },

  // Demo mode
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f4c43015', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#f4c43040',
  },
  demoBannerEmoji: { fontSize: 28 },
  demoBannerTitle: { fontSize: 15, fontWeight: '700', color: '#f4c430' },
  demoBannerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  demoSwitchBtn: {
    flex: 1, backgroundColor: '#1a1f2e', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#f4c43040',
  },
  demoSwitchBtnText: { fontSize: 14, fontWeight: '700', color: '#f4c430' },
  demoExitBtn: {
    flex: 1, backgroundColor: '#f8717115', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#f8717140',
  },
  demoExitBtnText: { fontSize: 14, fontWeight: '700', color: '#f87171' },
  demoEnterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#2a3050',
  },
  demoEnterEmoji: { fontSize: 24 },
  demoEnterTitle: { fontSize: 15, fontWeight: '700', color: '#e8e0d0' },
  demoEnterSub: { fontSize: 12, color: '#888', marginTop: 2 },
  demoEnterArrow: { fontSize: 22, fontWeight: '300', color: '#f4c430' },
  demoModalBox: {
    borderRadius: 20, padding: 24, borderWidth: 2, borderColor: '#f4c43030',
    width: '90%', maxWidth: 420,
  },
  demoPersonaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0c1020', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#2a3050',
  },
  demoPersonaEmoji: { fontSize: 28 },
  demoPersonaName: { fontSize: 15, fontWeight: '700' },
  demoPersonaDesc: { fontSize: 12, color: '#888', marginTop: 2 },
});
