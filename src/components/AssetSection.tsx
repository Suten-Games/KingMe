// app/components/AssetSection.tsx - WITH TOKEN LOGOS
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Asset, RealEstateAsset } from '../../src/types';

interface AssetSectionProps {
  title: string;
  icon: string;
  assets: Asset[];
  totalValue: number;
  totalIncome: number;
  onAssetPress: (asset: Asset) => void;
  onAssetDelete: (asset: Asset) => void;
  onBankAccountPress?: (accountId: string) => void;
}

// Helper: Format large numbers (1.5K, 2.3M, etc.)
function formatQuantity(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  if (num >= 1) return num.toFixed(2);
  return num.toFixed(6); // For small crypto amounts
}

// Helper: Format prices with appropriate decimals
function formatPrice(price: number): string {
  if (price >= 1000) return '$' + price.toLocaleString();
  if (price >= 1) return '$' + price.toFixed(2);
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

export default function AssetSection({
  title,
  icon,
  assets,
  totalValue,
  totalIncome,
  onAssetPress,
  onAssetDelete,
  onBankAccountPress,
}: AssetSectionProps) {
  const defaultExpanded = useStore((s) => s.settings?.defaultExpandAssetSections ?? false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const getTypeLabel = (type: Asset['type']) => {
    const labels: Record<string, string> = {
      crypto: '₿ Crypto',
      stocks: '📈 Stocks',
      real_estate: '🏠 Real Estate',
      business: '💼 Business',
      bank_account: '🏦 Bank Account',
      retirement: '🏛️ Retirement',
      defi: '⛓ DeFi',
      other: '💰 Other',
    };
    return labels[type] || '💰 Other';
  };

  if (assets.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>{icon}</Text>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalValue}>${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Income summary if any */}
          {totalIncome > 0 && (
            <View style={styles.incomeRow}>
              <Text style={styles.incomeLabel}>Annual Income</Text>
              <Text style={styles.incomeValue}>${totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</Text>
            </View>
          )}

          {/* Asset cards */}
          {assets.map((asset) => {
            const isBankAsset = asset.id.startsWith('bank_');
            
            // Extract quantity/balance and price info
            const metadata = asset.metadata as any;
            const quantity = metadata?.balance || metadata?.quantity || metadata?.shares;
            const pricePerUnit = metadata?.priceUSD || metadata?.currentPrice;
            const symbol = metadata?.symbol || metadata?.ticker;
            const logoURI = metadata?.logoURI;
            
            return (
              <TouchableOpacity
                key={asset.id}
                style={styles.assetCard}
                onPress={() => {
                  if (isBankAsset && onBankAccountPress) {
                    const bankAccountId = asset.id.replace('bank_', '');
                    onBankAccountPress(bankAccountId);
                  } else if (!isBankAsset) {
                    onAssetPress(asset);
                  }
                }}
                disabled={isBankAsset && !onBankAccountPress}
                activeOpacity={0.7}
              >
                <View style={styles.assetHeader}>
                  <View style={styles.assetLeftSection}>
                    
                    {/* Token Logo or Emoji */}
                    {logoURI ? (
                      <Image
                        source={{ uri: logoURI }}
                        style={styles.assetLogo}
                      />
                    ) : !isBankAsset ? (
                      <View style={styles.assetLogoPlaceholder}>
                        <Text style={styles.assetLogoEmoji}>
                          {asset.type === 'crypto' ? '₿' : 
                           asset.type === 'stocks' ? '📈' : 
                           asset.type === 'real_estate' ? '🏠' : 
                           asset.type === 'business' ? '💼' : 
                           asset.type === 'retirement' ? '🏛️' : '💰'}
                        </Text>
                      </View>
                    ) : null}
                    
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      
                      {/* Token/Share Count */}
                      {quantity && (
                        <Text style={styles.assetQuantity}>
                          {formatQuantity(quantity)}
                          {symbol ? ` ${symbol}` : asset.type === 'stocks' ? ' shares' : ''}
                        </Text>
                      )}
                      
                      <Text style={styles.assetType}>{getTypeLabel(asset.type)}</Text>
                      
                      {/* Auto-sync badge */}
                      {asset.isAutoSynced && (
                        <Text style={styles.autoSyncBadge}>🔄 Auto-synced</Text>
                      )}
                      
                      {isBankAsset && metadata?.type === 'bank_account' && (
                        <Text style={styles.bankBadge}>
                          {metadata?.apy}% APY
                        </Text>
                      )}
                      
                      {isBankAsset && (
                        <Text style={styles.tapHint}>Tap to update balance</Text>
                      )}
                      
                      {asset.type === 'retirement' && metadata?.type === 'retirement' && (
                        <Text style={styles.retirementBadge}>
                          {metadata?.contributionAmount > 0
                            ? `+$${metadata?.contributionAmount.toLocaleString()}/${metadata?.contributionFrequency === 'monthly' ? 'mo' : metadata?.contributionFrequency === 'biweekly' ? 'biweekly' : metadata?.contributionFrequency === 'weekly' ? 'wk' : '2x/mo'}`
                            : 'No contribution set'}
                          {metadata?.employerMatchDollars ? ` · match +$${metadata?.employerMatchDollars.toFixed(0)}/mo` : ''}
                        </Text>
                      )}
                      
                      {/* {asset.annualIncome === 0 && !isBankAsset && asset.type !== 'retirement' && (
                        <Text style={styles.warningBadge}>⚠️ Not generating income</Text>
                      )} */}
                      {asset.type === 'real_estate' && (asset.metadata as RealEstateAsset)?.isPrimaryResidence ? (
                        <Text style={styles.primaryResidenceBadge}>
                          🏠 Primary Residence
                        </Text>
                      ) : asset.annualIncome === 0 && !isBankAsset && asset.type !== 'retirement' ? (
                        <Text style={styles.warningBadge}>⚠️ Not generating income</Text>
                      ) : null}
                    </View>
                  </View>
                  
                  {!isBankAsset && (
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        onAssetDelete(asset);
                      }}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.assetDetails}>
                  <View style={styles.assetDetail}>
                    <Text style={styles.assetDetailLabel}>Value</Text>
                    <Text style={styles.assetDetailValue}>${asset.value.toLocaleString()}</Text>
                    {pricePerUnit && (
                      <Text style={styles.assetPrice}>
                        @ {formatPrice(pricePerUnit)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.assetDetail}>
                    <Text style={styles.assetDetailLabel}>Annual Income</Text>
                    <Text style={[styles.assetIncome, asset.annualIncome === 0 && styles.assetIncomeZero]}>
                      ${asset.annualIncome.toLocaleString()}/yr
                    </Text>
                    {metadata?.apy > 0 && !isBankAsset && (
                      <Text style={styles.apyBadge}>
                        {metadata.apy.toFixed(2)}% APY
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    backgroundColor: '#141825',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    paddingTop: 12,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  incomeLabel: {
    fontSize: 13,
    color: '#666',
  },
  incomeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  assetCard: {
    backgroundColor: '#1a1f2e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  // ✅ NEW: Logo section
  assetLeftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  assetLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2f3e',
  },
  assetLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2f3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetLogoEmoji: {
    fontSize: 20,
  },
  assetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  assetQuantity: {
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 4,
    fontWeight: '600',
  },
  assetType: {
    fontSize: 13,
    color: '#a0a0a0',
  },
  autoSyncBadge: {
    fontSize: 11,
    color: '#60a5fa',
    marginTop: 4,
  },
  bankBadge: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
    marginTop: 2,
  },
  tapHint: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  retirementBadge: {
    fontSize: 12,
    color: '#c084fc',
    fontWeight: '600',
    marginTop: 2,
  },
  warningBadge: {
    fontSize: 11,
    color: '#ff9800',
    marginTop: 4,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    fontSize: 18,
    color: '#ff4444',
  },
  assetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assetDetail: {
    flex: 1,
  },
  assetDetailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  assetDetailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  assetPrice: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  assetIncome: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: 'bold',
  },
  assetIncomeZero: {
    color: '#666',
  },
  apyBadge: {
    fontSize: 11,
    color: '#4ade80',
    marginTop: 2,
  },
  primaryResidenceBadge: {
    fontSize: 11,
    color: '#60a5fa',
    marginTop: 4,
    fontWeight: '600',
  },
});
