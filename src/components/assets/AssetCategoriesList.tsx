// src/components/assets/AssetCategoriesList.tsx
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useState, useMemo } from 'react';
import AssetSection from '../AssetSection';
import { getCategoryIcon, getCategoryLabel, calculateCategoryTotal, calculateCategoryIncome } from '../../utils/assetCalculations';
import { lookupToken } from '../../utils/tokenRegistry';
import type { CategorizedAssets } from '../../utils/assetCalculations';
import type { Asset } from '../../types';

// ── Protocol grouping helper ─────────────────────────────────
interface ProtocolGroup {
  protocol: string;
  label: string;
  icon: string;
  logoURI?: string;
  assets: Asset[];
  totalValue: number;
  totalIncome: number;
}

const PROTOCOL_LOGOS: Record<string, string> = {
  'kamino': 'https://pbs.twimg.com/profile_images/1999411256155938818/lAOSJHuf.jpg',
  'drift': 'https://drift-public.s3.eu-central-1.amazonaws.com/drift.png',
  'crypto.com': 'https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png',
  'diversifi': 'https://s2.coinmarketcap.com/static/img/coins/64x64/28658.png',
  'marginfi': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  'marinade': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png',
  'jito': 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png',
  'sanctum': 'https://s2.coinmarketcap.com/static/img/coins/64x64/28476.png',
  'raydium': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  'orca': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  'jupiter': 'https://static.jup.ag/jup/icon.png',
  'perena': 'https://s2.coinmarketcap.com/static/img/coins/64x64/33498.png',
};

const PROTOCOL_FALLBACK_ICONS: Record<string, string> = {
  'kamino': '🔵',
  'drift': '🟡',
  'crypto.com': '💎',
  'diversifi': '🔷',
  'marginfi': '🟣',
  'marinade': '🔴',
  'jito': '🟢',
  'sanctum': '🟠',
  'raydium': '💜',
  'orca': '🐋',
  'meteora': '☄️',
  'perena': '💛',
  'solend': '🔵',
  'jupiter': '🪐',
};

function getProtocolLogo(protocol: string): string | undefined {
  return PROTOCOL_LOGOS[protocol.toLowerCase()];
}

function getProtocolIcon(protocol: string): string {
  return PROTOCOL_FALLBACK_ICONS[protocol.toLowerCase()] || '🔗';
}

function groupByProtocol(assets: Asset[]): ProtocolGroup[] {
  const groups: Record<string, Asset[]> = {};

  for (const asset of assets) {
    const meta = asset.metadata as any;
    const protocol = meta?.protocol || '';
    const key = protocol || '__tokens__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(asset);
  }

  const result: ProtocolGroup[] = [];

  // Protocol groups first (sorted by total value desc)
  const protocolKeys = Object.keys(groups)
    .filter(k => k !== '__tokens__')
    .sort((a, b) => {
      const totalA = groups[a].reduce((s, x) => s + x.value, 0);
      const totalB = groups[b].reduce((s, x) => s + x.value, 0);
      return totalB - totalA;
    });

  for (const key of protocolKeys) {
    const groupAssets = groups[key];
    result.push({
      protocol: key,
      label: key,
      icon: getProtocolIcon(key),
      logoURI: getProtocolLogo(key),
      assets: groupAssets,
      totalValue: groupAssets.reduce((s, a) => s + a.value, 0),
      totalIncome: groupAssets.reduce((s, a) => s + a.annualIncome, 0),
    });
  }

  // Ungrouped tokens last
  if (groups['__tokens__']?.length > 0) {
    const tokens = groups['__tokens__'];
    result.push({
      protocol: '__tokens__',
      label: 'Tokens',
      icon: '🪙',
      assets: tokens,
      totalValue: tokens.reduce((s, a) => s + a.value, 0),
      totalIncome: tokens.reduce((s, a) => s + a.annualIncome, 0),
    });
  }

  return result;
}

// ── Formatting helpers ───────────────────────────────────────
function fmtQty(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(6);
}

// ── Protocol sub-section component ───────────────────────────
function ProtocolSubSection({
  group,
  onAssetPress,
  onAssetDelete,
  onSetTarget,
  onProtocolPress,
}: {
  group: ProtocolGroup;
  onAssetPress: (asset: Asset) => void;
  onAssetDelete: (asset: Asset) => void;
  onSetTarget?: (asset: Asset) => void;
  onProtocolPress?: (protocolName: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const canNavigate = onProtocolPress && group.protocol !== '__tokens__';

  return (
    <View style={ps.container}>
      <TouchableOpacity style={ps.header} onPress={() => setExpanded(!expanded)}>
        <View style={ps.headerLeft}>
          {group.logoURI ? (
            <Image source={{ uri: group.logoURI }} style={ps.headerLogo} />
          ) : (
            <Text style={ps.icon}>{group.icon}</Text>
          )}
          <Text style={ps.label}>{group.label}</Text>
          <View style={ps.countBubble}>
            <Text style={ps.countText}>{group.assets.length}</Text>
          </View>
        </View>
        <View style={ps.headerRight}>
          <Text style={ps.value}>${group.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          {canNavigate ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onProtocolPress(group.protocol); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={ps.navBtn}
            >
              <Text style={ps.navChevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={ps.chevron}>{expanded ? '▲' : '▼'}</Text>
          )}
        </View>
      </TouchableOpacity>

      {expanded && group.assets.map(asset => {
        const meta = asset.metadata as any;
        const logoURI = meta?.logoURI || lookupToken(meta?.symbol)?.logoURI;
        const symbol = meta?.symbol;
        const quantity = meta?.balance || meta?.quantity;
        const apy = meta?.apy;
        const supplied = meta?.supplied;
        const borrowed = meta?.borrowed;
        const leverage = meta?.leverage;
        const healthFactor = meta?.healthFactor;
        const positionType = meta?.positionType;
        const isLeverage = !!(supplied || borrowed || leverage);

        return (
          <TouchableOpacity
            key={asset.id}
            style={ps.assetRow}
            onPress={() => onAssetPress(asset)}
            activeOpacity={0.7}
          >
            <View style={ps.assetLeft}>
              {logoURI ? (
                <Image source={{ uri: logoURI }} style={ps.logo} />
              ) : (
                <View style={ps.logoWrap}>
                  <Text style={ps.logoFallback}>{symbol?.[0] || '?'}</Text>
                </View>
              )}
              <View style={ps.assetInfo}>
                <Text style={ps.assetName} numberOfLines={1}>{asset.name}</Text>
                {quantity != null && symbol && (
                  <Text style={ps.assetQuantity}>
                    {fmtQty(quantity)} {symbol}
                  </Text>
                )}
                {/* Leverage position tags */}
                {isLeverage && (
                  <View style={ps.leverageRow}>
                    {leverage != null && <Text style={ps.leverageTag}>{leverage}x</Text>}
                    {positionType && positionType !== 'token' && (
                      <Text style={ps.posTypeTag}>{positionType}</Text>
                    )}
                    {healthFactor != null && (
                      <Text style={[
                        ps.healthTag,
                        healthFactor < 15 ? ps.healthDanger :
                        healthFactor < 30 ? ps.healthWarning :
                        ps.healthOk
                      ]}>
                        Health {healthFactor}%
                      </Text>
                    )}
                  </View>
                )}
                {/* Supplied/Borrowed breakdown */}
                {isLeverage && supplied != null && borrowed != null && (
                  <Text style={ps.leverageDetail}>
                    Supplied ${supplied.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Borrowed ${borrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                )}
                {asset.isAutoSynced && <Text style={ps.syncBadge}>🔄 Auto-synced</Text>}
              </View>
            </View>

            <View style={ps.assetRight}>
              <Text style={ps.assetValue}>${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              {apy > 0 && (
                <Text style={ps.apyText}>{apy.toFixed(2)}% APY</Text>
              )}
              {asset.annualIncome > 0 && (
                <Text style={ps.incomeText}>${(asset.annualIncome / 12).toFixed(0)}/mo</Text>
              )}
              <View style={ps.actionRow}>
                {onSetTarget && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); onSetTarget(asset); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={ps.targetTouchable}
                  >
                    <Text style={ps.targetBtn}>🎯</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); onAssetDelete(asset); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={ps.deleteTouchable}
                >
                  <Text style={ps.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main component ───────────────────────────────────────────

interface AssetCategoriesListProps {
  categorized: CategorizedAssets;
  onAssetPress: (asset: Asset) => void;
  onAssetDelete: (asset: Asset) => void;
  onBankAccountPress?: (accountId: string) => void;
  onSetTarget?: (asset: Asset) => void;
  onProtocolPress?: (protocolName: string) => void;
}

export default function AssetCategoriesList({
  categorized,
  onAssetPress,
  onAssetDelete,
  onBankAccountPress,
  onSetTarget,
  onProtocolPress,
}: AssetCategoriesListProps) {
  const protocolGroups = useMemo(
    () => groupByProtocol(categorized.crypto),
    [categorized.crypto]
  );

  const cryptoTotalValue = calculateCategoryTotal(categorized.crypto);
  const cryptoTotalIncome = calculateCategoryIncome(categorized.crypto);
  const [cryptoExpanded, setCryptoExpanded] = useState(true);

  return (
    <>
      <AssetSection
        title={getCategoryLabel('brokerage')}
        icon={getCategoryIcon('brokerage')}
        assets={categorized.brokerage}
        totalValue={calculateCategoryTotal(categorized.brokerage)}
        totalIncome={calculateCategoryIncome(categorized.brokerage)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
      />

      <AssetSection
        title={getCategoryLabel('cash')}
        icon={getCategoryIcon('cash')}
        assets={categorized.cash}
        totalValue={calculateCategoryTotal(categorized.cash)}
        totalIncome={calculateCategoryIncome(categorized.cash)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
        onBankAccountPress={onBankAccountPress}
      />

      <AssetSection
        title={getCategoryLabel('realEstate')}
        icon={getCategoryIcon('realEstate')}
        assets={categorized.realEstate}
        totalValue={calculateCategoryTotal(categorized.realEstate)}
        totalIncome={calculateCategoryIncome(categorized.realEstate)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
      />

      <AssetSection
        title={getCategoryLabel('commodities')}
        icon={getCategoryIcon('commodities')}
        assets={categorized.commodities}
        totalValue={calculateCategoryTotal(categorized.commodities)}
        totalIncome={calculateCategoryIncome(categorized.commodities)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
      />

      {/* ── Crypto: Protocol-grouped ────────────────────────── */}
      {categorized.crypto.length > 0 && (
        <View style={cx.container}>
          <TouchableOpacity
            style={cx.header}
            onPress={() => setCryptoExpanded(!cryptoExpanded)}
          >
            <View style={cx.headerLeft}>
              <Text style={cx.icon}>₿</Text>
              <View>
                <Text style={cx.title}>Crypto</Text>
                <Text style={cx.subtitle}>
                  {categorized.crypto.length} {categorized.crypto.length === 1 ? 'asset' : 'assets'}
                  {protocolGroups.filter(g => g.protocol !== '__tokens__').length > 0
                    ? ` · ${protocolGroups.filter(g => g.protocol !== '__tokens__').length} protocol${protocolGroups.filter(g => g.protocol !== '__tokens__').length > 1 ? 's' : ''}`
                    : ''}
                </Text>
              </View>
            </View>
            <View style={cx.headerRight}>
              <Text style={cx.totalValue}>
                ${cryptoTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={cx.chevron}>{cryptoExpanded ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {cryptoExpanded && (
            <View style={cx.content}>
              {cryptoTotalIncome > 0 && (
                <View style={cx.incomeRow}>
                  <Text style={cx.incomeLabel}>Annual Income</Text>
                  <Text style={cx.incomeValue}>
                    ${cryptoTotalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                  </Text>
                </View>
              )}

              {protocolGroups.map(group => (
                <ProtocolSubSection
                  key={group.protocol}
                  group={group}
                  onAssetPress={onAssetPress}
                  onAssetDelete={onAssetDelete}
                  onSetTarget={onSetTarget}
                  onProtocolPress={onProtocolPress}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <AssetSection
        title={getCategoryLabel('retirement')}
        icon={getCategoryIcon('retirement')}
        assets={categorized.retirement}
        totalValue={calculateCategoryTotal(categorized.retirement)}
        totalIncome={calculateCategoryIncome(categorized.retirement)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
      />
    </>
  );
}

// ── Crypto section header styles (matches AssetSection look) ─
const cx = StyleSheet.create({
  container: { marginBottom: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, marginBottom: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#4ade80' },
  chevron: { fontSize: 12, color: '#666' },
  content: {
    backgroundColor: '#141825', borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12, padding: 12, paddingTop: 8,
  },
  incomeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1f2e', borderRadius: 8, padding: 12, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: '#4ade80',
  },
  incomeLabel: { fontSize: 13, color: '#666' },
  incomeValue: { fontSize: 16, fontWeight: 'bold', color: '#4ade80' },
});

// ── Protocol sub-section styles ──────────────────────────────
const ps = StyleSheet.create({
  container: { marginBottom: 6 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1f2e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  headerLogo: { width: 22, height: 22, borderRadius: 11 },
  label: { fontSize: 15, fontWeight: '700', color: '#e0e0e0' },
  countBubble: {
    backgroundColor: '#0a0e18', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  countText: { fontSize: 11, color: '#666', fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  chevron: { fontSize: 10, color: '#666' },
  navBtn: {
    backgroundColor: '#4ade8020', borderRadius: 10, width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  navChevron: { fontSize: 16, fontWeight: '800', color: '#4ade80', marginTop: -1 },

  // Asset row
  assetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 4, marginLeft: 8,
    borderLeftWidth: 2, borderLeftColor: '#2a3050',
  },
  assetLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  logo: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a3050',
  },
  logoWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a3050',
    justifyContent: 'center', alignItems: 'center',
  },
  logoFallback: { fontSize: 16, fontWeight: '800', color: '#888' },
  assetInfo: { flex: 1 },
  assetName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  assetQuantity: { fontSize: 12, color: '#888', marginBottom: 2 },
  syncBadge: { fontSize: 10, color: '#60a5fa', marginTop: 2 },

  // Leverage tags
  leverageRow: { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  leverageTag: {
    fontSize: 10, fontWeight: '800', color: '#ff9f43',
    backgroundColor: '#ff9f4320', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
  },
  posTypeTag: {
    fontSize: 10, fontWeight: '700', color: '#60a5fa',
    backgroundColor: '#60a5fa20', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
    textTransform: 'capitalize',
  },
  healthTag: {
    fontSize: 10, fontWeight: '700', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
  },
  healthDanger: { color: '#ff6b6b', backgroundColor: '#ff6b6b20' },
  healthWarning: { color: '#ff9f43', backgroundColor: '#ff9f4320' },
  healthOk: { color: '#4ade80', backgroundColor: '#4ade8020' },
  leverageDetail: { fontSize: 10, color: '#666', marginTop: 2 },

  // Right side
  assetRight: { alignItems: 'flex-end', gap: 2 },
  assetValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
  apyText: { fontSize: 11, fontWeight: '600', color: '#4ade80' },
  incomeText: { fontSize: 10, color: '#4ade8080' },
  deleteTouchable: { marginTop: 4 },
  deleteBtn: { fontSize: 14, color: '#ff444480' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  targetTouchable: { },
  targetBtn: { fontSize: 14 },
});
