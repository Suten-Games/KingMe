// app/onboarding/assets.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import AddAssetModal from '../../src/components/assets/AddAssetModal';
import type { Asset, AssetType } from '../../src/types';

export default function AssetsScreen() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const addAsset = useStore((state) => state.addAsset);
  const removeAsset = useStore((state) => state.removeAsset);

  const [showAddModal, setShowAddModal] = useState(false);

  const handleDeleteAsset = (id: string) => removeAsset(id);

  const calculateTotalAssetIncome = () =>
    assets.reduce((sum, asset) => sum + asset.annualIncome, 0);

  const handleContinue = () => router.push('/onboarding/debts');
  const handleSkip = () => router.push('/onboarding/debts');

  const getTypeLabel = (type: AssetType) => {
    const labels: Record<AssetType, string> = {
      crypto: '₿ Crypto', defi: '🔗 DeFi', stocks: '📈 Stocks',
      brokerage: '📊 Brokerage', real_estate: '🏠 Real Estate',
      bank_account: '🏦 Bank', retirement: '🏦 Retirement',
      business: '💼 Business', other: '💰 Other',
    };
    return labels[type] || type;
  };

  const getAssetDisplayInfo = (asset: Asset) => {
    const meta = asset.metadata as any;
    return {
      logoURI: meta?.logoURI || null,
      symbol: meta?.symbol || meta?.ticker || null,
      quantity: meta?.quantity || meta?.balance || meta?.shares || null,
      priceUSD: meta?.priceUSD || meta?.currentPrice || null,
      apy: meta?.apy || meta?.dividendYield || null,
      protocol: meta?.protocol || null,
    };
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Step 2 of 4</Text>
        <Text style={styles.title}>Your Assets</Text>
        <Text style={styles.subtitle}>What generates income for you?</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Add ALL your assets here - even if they don't generate income yet (like SOL, memecoins, etc.). Only income-generating assets count toward your freedom score, but tracking everything helps you see your full portfolio.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income-Generating Assets</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No assets yet</Text>
              <Text style={styles.emptySubtext}>
                Add crypto with yield, dividend stocks, rental properties, or business income
              </Text>
            </View>
          ) : (
            assets.map((asset) => {
              const info = getAssetDisplayInfo(asset);
              return (
                <View key={asset.id} style={styles.assetCard}>
                  <View style={styles.assetHeader}>
                    <View style={styles.assetHeaderLeft}>
                      {info.logoURI ? (
                        <Image source={{ uri: info.logoURI }} style={styles.assetIcon} resizeMode="contain" />
                      ) : (
                        <View style={styles.assetIconPlaceholder}>
                          <Text style={styles.assetIconText}>
                            {(info.symbol || asset.name[0] || '?').charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assetName}>{asset.name}</Text>
                        <View style={styles.assetSubRow}>
                          <Text style={styles.assetType}>{getTypeLabel(asset.type)}</Text>
                          {info.protocol && <Text style={styles.assetProtocol}>· {info.protocol}</Text>}
                        </View>
                        {info.quantity && info.symbol && (
                          <Text style={styles.assetQuantity}>
                            {info.quantity.toLocaleString()} {info.symbol}
                            {info.priceUSD ? ` @ $${info.priceUSD.toLocaleString()}` : ''}
                          </Text>
                        )}
                        {asset.annualIncome === 0 && (
                          <Text style={styles.warningBadge}>⚠️ Not generating income</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteAsset(asset.id)}>
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.assetDetails}>
                    <View style={styles.assetDetail}>
                      <Text style={styles.assetDetailLabel}>Value</Text>
                      <Text style={styles.assetDetailValue}>${asset.value.toLocaleString()}</Text>
                    </View>
                    {info.apy ? (
                      <View style={styles.assetDetail}>
                        <Text style={styles.assetDetailLabel}>APY</Text>
                        <Text style={styles.assetDetailValue}>{info.apy.toFixed(2)}%</Text>
                      </View>
                    ) : null}
                    <View style={styles.assetDetail}>
                      <Text style={styles.assetDetailLabel}>Annual Income</Text>
                      <Text style={[styles.assetIncome, asset.annualIncome === 0 && styles.assetIncomeZero]}>
                        ${asset.annualIncome.toLocaleString()}/yr
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {assets.length > 0 && (
          <>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Annual Asset Income</Text>
              <Text style={styles.totalAmount}>${calculateTotalAssetIncome().toLocaleString()}/year</Text>
              <Text style={styles.totalMonthly}>${(calculateTotalAssetIncome() / 12).toLocaleString()}/month</Text>
            </View>
            {assets.some((a) => a.annualIncome === 0) && (
              <View style={styles.opportunityBox}>
                <Text style={styles.opportunityTitle}>⚠️ Opportunity Cost</Text>
                <Text style={styles.opportunityText}>
                  You have {assets.filter((a) => a.annualIncome === 0).length} asset(s) not generating income.
                  Consider staking, providing liquidity, or deploying into yield to increase your freedom score.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.connectBox}>
          <Text style={styles.connectText}>
            🔗 Later you can connect your Solana wallet to automatically track crypto assets and DeFi positions.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        {assets.length === 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, assets.length === 0 && styles.buttonSecondary]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <AddAssetModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddAsset={(asset) => addAsset(asset)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scrollView: { flex: 1, padding: 20 },
  progress: {
    fontSize: 14, color: '#666', marginBottom: 20,
    // marginTop: 40
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#f4c430', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#a0a0a0', marginBottom: 20 },
  infoBox: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#f4c430' },
  infoText: { fontSize: 14, color: '#a0a0a0', lineHeight: 20 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  addButton: { backgroundColor: '#f4c430', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#444', textAlign: 'center' },
  assetCard: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#4ade80' },
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  assetHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  assetIcon: { width: 36, height: 36, borderRadius: 18, marginTop: 2 },
  assetIconPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2f3e', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  assetIconText: { fontSize: 16, fontWeight: 'bold', color: '#4ade80' },
  assetName: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  assetSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assetType: { fontSize: 14, color: '#a0a0a0' },
  assetProtocol: { fontSize: 14, color: '#60a5fa' },
  assetQuantity: { fontSize: 13, color: '#666', marginTop: 2 },
  warningBadge: { fontSize: 11, color: '#ff9800', marginTop: 4, fontWeight: '600' },
  deleteButton: { fontSize: 20, color: '#ff4444', padding: 4 },
  assetDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  assetDetail: { flex: 1 },
  assetDetailLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  assetDetailValue: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  assetIncome: { fontSize: 14, color: '#4ade80', fontWeight: 'bold' },
  assetIncomeZero: { color: '#666' },
  totalBox: { backgroundColor: '#1a1f2e', padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 2, borderColor: '#4ade80' },
  totalLabel: { fontSize: 16, color: '#a0a0a0', marginBottom: 8 },
  totalAmount: { fontSize: 28, fontWeight: 'bold', color: '#4ade80' },
  totalMonthly: { fontSize: 14, color: '#a0a0a0', marginTop: 4 },
  opportunityBox: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#ff9800' },
  opportunityTitle: { fontSize: 16, fontWeight: 'bold', color: '#ff9800', marginBottom: 8 },
  opportunityText: { fontSize: 14, color: '#a0a0a0', lineHeight: 20 },
  connectBox: { backgroundColor: '#1a1f2e', padding: 16, borderRadius: 12, marginBottom: 20 },
  connectText: { fontSize: 14, color: '#a0a0a0', lineHeight: 20 },
  buttonContainer: { padding: 20, backgroundColor: '#0a0e1a', borderTopWidth: 1, borderTopColor: '#1a1f2e', flexDirection: 'row', gap: 12 },
  skipButton: { flex: 1, padding: 18, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  skipButtonText: { fontSize: 16, color: '#a0a0a0' },
  button: { flex: 1, backgroundColor: '#f4c430', padding: 18, borderRadius: 12, alignItems: 'center' },
  buttonSecondary: { flex: 2 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#0a0e1a' },
});
