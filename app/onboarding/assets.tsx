// app/onboarding/assets.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import AddAssetModal from '../../src/components/assets/AddAssetModal';
import type { Asset, AssetType } from '../../src/types';
import { S, T } from '../../src/styles/onboarding';
import KingMeFooter from '../../src/components/KingMeFooter';

export default function AssetsScreen() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const addAsset = useStore((state) => state.addAsset);
  const removeAsset = useStore((state) => state.removeAsset);
  const [showAddModal, setShowAddModal] = useState(false);

  const calculateTotalAssetIncome = () => assets.reduce((sum, a) => sum + a.annualIncome, 0);
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
    <View style={S.container}>
      <ScrollView style={S.scrollView} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={S.progress}>Step 2 of 4</Text>
        <Text style={S.title}>Your Assets</Text>
        <Text style={S.subtitle}>What generates income for you?</Text>

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            💡 Add ALL your assets here - even if they don't generate income yet (like SOL, memecoins, etc.). Only income-generating assets count toward your freedom score, but tracking everything helps you see your full portfolio.
          </Text>
        </View>

        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Income-Generating Assets</Text>
            <TouchableOpacity style={S.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={S.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {assets.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No assets yet</Text>
              <Text style={S.emptySubtext}>
                Add crypto with yield, dividend stocks, rental properties, or business income
              </Text>
            </View>
          ) : (
            assets.map((asset) => {
              const info = getAssetDisplayInfo(asset);
              return (
                <View key={asset.id} style={S.cardGreen}>
                  <View style={st.assetHeader}>
                    <View style={st.assetHeaderLeft}>
                      {info.logoURI ? (
                        <Image source={{ uri: info.logoURI }} style={st.assetIcon} resizeMode="contain" />
                      ) : (
                        <View style={st.assetIconPlaceholder}>
                          <Text style={st.assetIconText}>
                            {(info.symbol || asset.name[0] || '?').charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={st.assetName}>{asset.name}</Text>
                        <View style={st.assetSubRow}>
                          <Text style={st.assetType}>{getTypeLabel(asset.type)}</Text>
                          {info.protocol && <Text style={st.assetProtocol}>· {info.protocol}</Text>}
                        </View>
                        {info.quantity && info.symbol && (
                          <Text style={st.assetQuantity}>
                            {info.quantity.toLocaleString()} {info.symbol}
                            {info.priceUSD ? ` @ $${info.priceUSD.toLocaleString()}` : ''}
                          </Text>
                        )}
                        {asset.annualIncome === 0 && (
                          <Text style={st.warningBadge}>⚠️ Not generating income</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeAsset(asset.id)}>
                      <Text style={S.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={st.assetDetails}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.detailLabel}>Value</Text>
                      <Text style={st.detailValue}>${asset.value.toLocaleString()}</Text>
                    </View>
                    {info.apy ? (
                      <View style={{ flex: 1 }}>
                        <Text style={st.detailLabel}>APY</Text>
                        <Text style={st.detailValue}>{info.apy.toFixed(2)}%</Text>
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={st.detailLabel}>Annual Income</Text>
                      <Text style={[st.assetIncome, asset.annualIncome === 0 && { color: T.textMuted }]}>
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
            <View style={S.totalBoxGreen}>
              <Text style={S.totalLabel}>Total Annual Asset Income</Text>
              <Text style={S.totalAmountGreen}>${calculateTotalAssetIncome().toLocaleString()}/year</Text>
              <Text style={S.totalMonthly}>${(calculateTotalAssetIncome() / 12).toLocaleString()}/month</Text>
            </View>
            {assets.some((a) => a.annualIncome === 0) && (
              <View style={st.opportunityBox}>
                <Text style={st.opportunityTitle}>⚠️ Opportunity Cost</Text>
                <Text style={st.opportunityText}>
                  You have {assets.filter((a) => a.annualIncome === 0).length} asset(s) not generating income.
                  Consider staking, providing liquidity, or deploying into yield to increase your freedom score.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={S.card}>
          <Text style={S.infoText}>
            🔗 Later you can connect your Solana wallet to automatically track crypto assets and DeFi positions.
          </Text>
        </View>

        <KingMeFooter />
      </ScrollView>

      <View style={S.buttonContainer}>
        <TouchableOpacity style={S.skipButton} onPress={handleSkip}>
          <Text style={S.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.button} onPress={handleContinue}>
          <Text style={S.buttonText}>Continue</Text>
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

const st = StyleSheet.create({
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  assetHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  assetIcon: { width: 36, height: 36, borderRadius: 18, marginTop: 2 },
  assetIconPlaceholder: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: T.bgCardAlt,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  assetIconText: { fontSize: 16, fontWeight: 'bold', color: T.green },
  assetName: { fontSize: 18, fontWeight: 'bold', color: T.textPrimary, marginBottom: 4 },
  assetSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assetType: { fontSize: 14, color: T.textSecondary },
  assetProtocol: { fontSize: 14, color: T.blue },
  assetQuantity: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  warningBadge: { fontSize: 11, color: T.orange, marginTop: 4, fontWeight: '600' },
  assetDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: T.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 14, color: T.textPrimary, fontWeight: '600' },
  assetIncome: { fontSize: 14, color: T.green, fontWeight: 'bold' },
  opportunityBox: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: T.orange,
  },
  opportunityTitle: { fontSize: 16, fontWeight: 'bold', color: T.orange, marginBottom: 8 },
  opportunityText: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },
});
