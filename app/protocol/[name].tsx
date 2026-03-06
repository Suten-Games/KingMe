// app/protocol/[name].tsx
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, Linking, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useStore } from '../../src/store/useStore';
import AddAssetModal from '../../src/components/assets/AddAssetModal';
import KingMeFooter from '../../src/components/KingMeFooter';
import type { Asset } from '../../src/types';

// ── Protocol info map ────────────────────────────────────────
const PROTOCOL_INFO: Record<string, { emoji: string; logoURI?: string; description: string; url: string }> = {
  'Drift':     { emoji: '🟡', logoURI: 'https://drift-public.s3.eu-central-1.amazonaws.com/drift.png', description: 'Decentralized perpetual futures and spot exchange on Solana. Supports leveraged trading, lending, and borrowing.', url: 'https://drift.trade' },
  'Kamino':    { emoji: '🔵', description: 'Automated liquidity and lending protocol on Solana. Offers leveraged yield strategies and concentrated liquidity vaults.', url: 'https://kamino.finance' },
  'MarginFi':  { emoji: '🟣', description: 'Decentralized lending and borrowing protocol on Solana with risk-adjusted interest rates.', url: 'https://marginfi.com' },
  'Marinade':  { emoji: '🔴', description: 'Liquid staking protocol for SOL. Stake SOL and receive mSOL to use across DeFi while earning staking rewards.', url: 'https://marinade.finance' },
  'Jito':      { emoji: '🟢', description: 'MEV-powered liquid staking on Solana. Earn staking rewards plus MEV tips via JitoSOL.', url: 'https://jito.network' },
  'Sanctum':   { emoji: '🟠', description: 'Liquid staking aggregator and infinity pool on Solana. Unifies LST liquidity.', url: 'https://sanctum.so' },
  'Raydium':   { emoji: '💜', description: 'AMM and liquidity provider on Solana with concentrated liquidity pools.', url: 'https://raydium.io' },
  'Orca':      { emoji: '🐋', description: 'DEX and concentrated liquidity AMM on Solana. Simple swaps and LP positions.', url: 'https://orca.so' },
  'Meteora':   { emoji: '☄️', description: 'Dynamic liquidity protocol on Solana with DLMM pools and yield optimization.', url: 'https://meteora.ag' },
  'DiversiFi': { emoji: '🔷', description: 'Cross-chain yield aggregation and DeFi strategy platform.', url: 'https://diversifi.io' },
  'Perena':    { emoji: '💛', description: 'Stablecoin infrastructure and yield protocol on Solana.', url: 'https://perena.org' },
  'Jupiter':   { emoji: '🪐', description: 'Leading swap aggregator on Solana. Routes trades across all DEXs for best price.', url: 'https://jup.ag' },
};

// ── Helpers ──────────────────────────────────────────────────
function fmtQty(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(6);
}

function fmtDollar(n: number): string {
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const EDITABLE_FIELDS = [
  { key: 'value', label: 'Value', prefix: '$', isTopLevel: true },
  { key: 'supplied', label: 'Supplied', prefix: '$' },
  { key: 'borrowed', label: 'Borrowed', prefix: '$' },
  { key: 'leverage', label: 'Leverage', suffix: 'x' },
  { key: 'healthFactor', label: 'Health', suffix: '%' },
  { key: 'apy', label: 'APY', suffix: '%' },
] as const;

// ── Component ────────────────────────────────────────────────
export default function ProtocolDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();

  const assets = useStore((s) => s.assets);
  const updateAsset = useStore((s) => s.updateAsset);
  const removeAsset = useStore((s) => s.removeAsset);

  // Inline edit state
  const [editingField, setEditingField] = useState<{ assetId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // AddAssetModal state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const protocolName = decodeURIComponent(name || '');
  const info = PROTOCOL_INFO[protocolName] || { emoji: '🔗', description: 'DeFi protocol on Solana.', url: '' };

  // Filter assets belonging to this protocol
  const protocolAssets = useMemo(() =>
    assets.filter(a => {
      const isCryptoLike = a.type === 'crypto' || a.type === 'defi';
      if (!isCryptoLike) return false;
      const meta = a.metadata as any;
      return meta?.protocol === protocolName;
    }),
    [assets, protocolName]
  );

  const totalValue = useMemo(() => protocolAssets.reduce((s, a) => s + a.value, 0), [protocolAssets]);
  const totalIncome = useMemo(() => protocolAssets.reduce((s, a) => s + a.annualIncome, 0), [protocolAssets]);

  // ── Inline edit handlers ───────────────────────────────────
  const startEdit = (assetId: string, field: string, currentValue: number | undefined) => {
    setEditingField({ assetId, field });
    setEditValue(currentValue != null ? String(currentValue) : '');
  };

  const saveEdit = () => {
    if (!editingField) return;
    const { assetId, field } = editingField;
    const numVal = parseFloat(editValue.replace(/,/g, ''));

    if (isNaN(numVal)) {
      setEditingField(null);
      return;
    }

    const asset = protocolAssets.find(a => a.id === assetId);
    if (!asset) { setEditingField(null); return; }

    if (field === 'value') {
      updateAsset(assetId, { value: numVal });
    } else {
      const existingMeta = (asset.metadata as any) || {};
      updateAsset(assetId, { metadata: { ...existingMeta, [field]: numVal } });
    }

    setEditingField(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
  };

  // ── Delete handler ─────────────────────────────────────────
  const handleDelete = (asset: Asset) => {
    const msg = `Delete "${asset.name}"? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) removeAsset(asset.id);
    } else {
      Alert.alert('Delete Position', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeAsset(asset.id) },
      ]);
    }
  };

  // ── Edit modal handlers ────────────────────────────────────
  const handleFullEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setShowEditModal(true);
  };

  const handleUpdateAsset = (assetId: string, updates: Partial<Asset>) => {
    updateAsset(assetId, updates);
  };

  if (!protocolName) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Protocol not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* ── Header bar ─────────────────────────────────────── */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            {info.logoURI ? (
              <Image source={{ uri: info.logoURI }} style={styles.headerLogo} />
            ) : (
              <Text style={styles.headerEmoji}>{info.emoji}</Text>
            )}
            <Text style={styles.headerTitle}>{protocolName}</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>

        {/* ── Protocol info card ─────────────────────────────── */}
        <View style={styles.infoCard}>
          {info.logoURI ? (
            <Image source={{ uri: info.logoURI }} style={styles.infoLogo} />
          ) : (
            <Text style={styles.infoEmoji}>{info.emoji}</Text>
          )}
          <Text style={styles.infoName}>{protocolName}</Text>
          <Text style={styles.infoDesc}>{info.description}</Text>
          {info.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(info.url)}>
              <Text style={styles.infoLink}>{info.url.replace('https://', '')} →</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Summary row ────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={styles.summaryValue}>{fmtDollar(totalValue)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Annual Income</Text>
            <Text style={styles.summaryIncomeValue}>
              {totalIncome > 0 ? `${fmtDollar(totalIncome)}/yr` : '—'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Positions</Text>
            <Text style={styles.summaryValue}>{protocolAssets.length}</Text>
          </View>
        </View>

        {/* ── Position list ──────────────────────────────────── */}
        {protocolAssets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No positions in {protocolName}</Text>
          </View>
        ) : (
          protocolAssets.map(asset => {
            const meta = (asset.metadata as any) || {};
            const logoURI = meta.logoURI;
            const symbol = meta.symbol || '';
            const quantity = meta.balance || meta.quantity;
            const positionType = meta.positionType;

            return (
              <View key={asset.id} style={styles.posCard}>
                {/* Top: Logo + name + quantity */}
                <View style={styles.posHeader}>
                  <View style={styles.posLeft}>
                    {logoURI ? (
                      <Image source={{ uri: logoURI }} style={styles.logo} />
                    ) : (
                      <View style={styles.logoFallback}>
                        <Text style={styles.logoFallbackText}>{symbol?.[0] || '?'}</Text>
                      </View>
                    )}
                    <View style={styles.posInfo}>
                      <Text style={styles.posName} numberOfLines={1}>{asset.name}</Text>
                      {quantity != null && symbol && (
                        <Text style={styles.posQuantity}>{fmtQty(quantity)} {symbol}</Text>
                      )}
                    </View>
                  </View>
                  {positionType && positionType !== 'token' && (
                    <View style={styles.posTypeBadge}>
                      <Text style={styles.posTypeText}>{positionType}</Text>
                    </View>
                  )}
                </View>

                {/* Editable fields */}
                <View style={styles.fieldsContainer}>
                  {EDITABLE_FIELDS.map(({ key, label, prefix, suffix, isTopLevel }) => {
                    const rawValue = isTopLevel ? asset.value : meta[key];
                    if (rawValue == null && !isTopLevel) return null;

                    const isEditing = editingField?.assetId === asset.id && editingField?.field === key;

                    return (
                      <View key={key} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        {isEditing ? (
                          <View style={styles.fieldEditRow}>
                            <TextInput
                              style={styles.fieldInput}
                              value={editValue}
                              onChangeText={setEditValue}
                              keyboardType="numeric"
                              autoFocus
                              selectTextOnFocus
                              onBlur={cancelEdit}
                              onSubmitEditing={saveEdit}
                            />
                            <TouchableOpacity onPress={saveEdit} style={styles.fieldSaveBtn}>
                              <Text style={styles.fieldSaveText}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => startEdit(asset.id, key, rawValue)}>
                            <Text style={[
                              styles.fieldValue,
                              key === 'value' && styles.fieldValuePrimary,
                            ]}>
                              {prefix || ''}{typeof rawValue === 'number'
                                ? (key === 'leverage'
                                    ? rawValue.toFixed(1)
                                    : key === 'apy' || key === 'healthFactor'
                                      ? rawValue.toFixed(2)
                                      : rawValue.toLocaleString(undefined, { maximumFractionDigits: 0 }))
                                : rawValue}{suffix || ''}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Auto-sync badge */}
                {asset.isAutoSynced && (
                  <Text style={styles.syncBadge}>🔄 Auto-synced</Text>
                )}

                {/* Action buttons */}
                <View style={styles.posActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleFullEdit(asset)}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => router.push(`/asset/${asset.id}`)}
                  >
                    <Text style={styles.detailBtnText}>Detail →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(asset)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <KingMeFooter />
      </ScrollView>

      {/* AddAssetModal for full edit */}
      <AddAssetModal
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingAsset(null); }}
        onAddAsset={() => {}}
        onUpdateAsset={handleUpdateAsset}
        editingAsset={editingAsset}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c18' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  errorText: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', marginTop: 60 },

  // Header bar
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingTop: 8,
  },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#4ade80', fontSize: 15, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28, borderRadius: 14 },
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Info card
  infoCard: {
    backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a3050',
  },
  infoLogo: { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  infoEmoji: { fontSize: 40, marginBottom: 8 },
  infoName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  infoDesc: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  infoLink: { fontSize: 14, color: '#60a5fa', fontWeight: '600' },

  // Summary row
  summaryRow: {
    flexDirection: 'row', backgroundColor: '#1a1f2e', borderRadius: 12,
    padding: 16, marginBottom: 16, justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#2a3050',
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  summaryIncomeValue: { fontSize: 18, fontWeight: '800', color: '#4ade80' },

  // Empty state
  emptyCard: {
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 24, alignItems: 'center',
  },
  emptyText: { color: '#666', fontSize: 14 },

  // Position card
  posCard: {
    backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#2a3050',
  },
  posHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  posLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a3050' },
  logoFallback: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a3050',
    justifyContent: 'center', alignItems: 'center',
  },
  logoFallbackText: { fontSize: 16, fontWeight: '800', color: '#888' },
  posInfo: { flex: 1 },
  posName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  posQuantity: { fontSize: 12, color: '#888', marginTop: 2 },

  posTypeBadge: {
    backgroundColor: '#60a5fa20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  posTypeText: { fontSize: 11, fontWeight: '700', color: '#60a5fa', textTransform: 'capitalize' },

  // Editable fields
  fieldsContainer: {
    backgroundColor: '#141825', borderRadius: 10, padding: 12, marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1a1f2e',
  },
  fieldLabel: { fontSize: 13, color: '#888' },
  fieldValue: {
    fontSize: 15, fontWeight: '600', color: '#e0e0e0',
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 6, borderWidth: 1, borderColor: 'transparent',
  },
  fieldValuePrimary: { color: '#fff', fontWeight: '800', fontSize: 17 },
  fieldEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldInput: {
    backgroundColor: '#0c1020', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10,
    color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 80,
    borderWidth: 1, borderColor: '#4ade80',
  },
  fieldSaveBtn: {
    backgroundColor: '#4ade80', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10,
  },
  fieldSaveText: { color: '#080c18', fontSize: 13, fontWeight: '700' },

  // Sync badge
  syncBadge: { fontSize: 11, color: '#60a5fa', marginBottom: 8 },

  // Action buttons
  posActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editBtn: {
    flex: 1, backgroundColor: '#4ade8020', borderRadius: 8, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#4ade8040',
  },
  editBtnText: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  detailBtn: {
    flex: 1, backgroundColor: '#60a5fa20', borderRadius: 8, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#60a5fa40',
  },
  detailBtnText: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: '#ff6b6b15', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#ff6b6b30',
  },
  deleteBtnText: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
});
