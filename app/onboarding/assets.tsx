// app/onboarding/assets.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Asset } from '../../src/types';

export default function AssetsScreen() {
  const router = useRouter();
  const assets = useStore((state) => state.assets);
  const addAsset = useStore((state) => state.addAsset);
  const removeAsset = useStore((state) => state.removeAsset);
  
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<Asset['type']>('crypto');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');

  const handleAddAsset = () => {
    if (!name || !value) return;
    
    // Calculate annual income from APY if provided
    let calculatedIncome = parseFloat(annualIncome) || 0;
    if (apy && !annualIncome) {
      calculatedIncome = parseFloat(value) * (parseFloat(apy) / 100);
    }
    
    const newAsset: Asset = {
      id: Date.now().toString(),
      name,
      type,
      value: parseFloat(value),
      annualIncome: calculatedIncome,
      metadata: {
        type: 'other',
        description: name,
      },
    };
    
    addAsset(newAsset);
    
    // Reset form
    setName('');
    setType('crypto');
    setValue('');
    setApy('');
    setAnnualIncome('');
    setShowAddModal(false);
  };

  const handleDeleteAsset = (id: string) => {
    removeAsset(id);
  };

  const calculateTotalAssetIncome = () => {
    return assets.reduce((sum, asset) => sum + asset.annualIncome, 0);
  };

  const handleContinue = () => {
    router.push('/onboarding/debts');
  };

  const handleSkip = () => {
    router.push('/onboarding/debts');
  };

  const getTypeLabel = (type: Asset['type']) => {
    const labels = {
      crypto: '₿ Crypto',
      stocks: '📈 Stocks',
      real_estate: '🏠 Real Estate',
      business: '💼 Business',
      other: '💰 Other',
    };
    return labels[type];
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.progress}>Step 2 of 4</Text>
        
        <Text style={styles.title}>Your Assets</Text>
        <Text style={styles.subtitle}>What generates income for you?</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Add ALL your assets here - even if they don't generate income yet (like SOL, memecoins, etc.). Only income-generating assets count toward your freedom score, but tracking everything helps you see your full portfolio.
          </Text>
        </View>

        {/* Assets List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income-Generating Assets</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
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
            <>
              {assets.map((asset) => (
                <View key={asset.id} style={styles.assetCard}>
                  <View style={styles.assetHeader}>
                    <View>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetType}>{getTypeLabel(asset.type)}</Text>
                      {asset.annualIncome === 0 && (
                        <Text style={styles.warningBadge}>⚠️ Not generating income</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteAsset(asset.id)}
                    >
                      <Text style={styles.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.assetDetails}>
                    <View style={styles.assetDetail}>
                      <Text style={styles.assetDetailLabel}>Value</Text>
                      <Text style={styles.assetDetailValue}>${asset.value.toLocaleString()}</Text>
                    </View>
                    {asset.metadata && 'apy' in asset.metadata && asset.metadata?.apy && (
                      <View style={styles.assetDetail}>
                        <Text style={styles.assetDetailLabel}>APY</Text>
                        <Text style={styles.assetDetailValue}>{asset.metadata?.apy.toFixed(2)}%</Text>
                      </View>
                    )}
                    <View style={styles.assetDetail}>
                      <Text style={styles.assetDetailLabel}>Annual Income</Text>
                      <Text style={[
                        styles.assetIncome,
                        asset.annualIncome === 0 && styles.assetIncomeZero
                      ]}>
                        ${asset.annualIncome.toLocaleString()}/yr
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Total Summary */}
        {assets.length > 0 && (
          <>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Annual Asset Income</Text>
              <Text style={styles.totalAmount}>
                ${calculateTotalAssetIncome().toLocaleString()}/year
              </Text>
              <Text style={styles.totalMonthly}>
                ${(calculateTotalAssetIncome() / 12).toLocaleString()}/month
              </Text>
            </View>
            
            {assets.some(a => a.annualIncome === 0) && (
              <View style={styles.opportunityBox}>
                <Text style={styles.opportunityTitle}>⚠️ Opportunity Cost</Text>
                <Text style={styles.opportunityText}>
                  You have {assets.filter(a => a.annualIncome === 0).length} asset(s) not generating income. 
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

      {/* Add Asset Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Asset</Text>

              <Text style={styles.label}>Asset Type</Text>
              <View style={styles.typeContainer}>
                {(['crypto', 'stocks', 'real_estate', 'business', 'other'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeButton,
                      type === t && styles.typeButtonActive,
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        type === t && styles.typeButtonTextActive,
                      ]}
                    >
                      {getTypeLabel(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={
                  type === 'crypto' ? 'e.g., USDC in Kamino' :
                  type === 'stocks' ? 'e.g., VOO ETF' :
                  type === 'real_estate' ? 'e.g., Rental Property on Main St' :
                  type === 'business' ? 'e.g., LLC Distributions' :
                  'e.g., Investment'
                }
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Current Value</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={setValue}
                />
              </View>

              <Text style={styles.label}>APY (optional)</Text>
              <Text style={styles.helperText}>
                {type === 'crypto' && 'If staked or in DeFi. Leave blank for tokens you just hold.'}
                {type !== 'crypto' && 'If applicable - we\'ll calculate income from this'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={apy}
                  onChangeText={setApy}
                />
                <Text style={styles.percent}>%</Text>
              </View>

              <Text style={styles.label}>OR Annual Income</Text>
              <Text style={styles.helperText}>
                {type === 'crypto' && 'Leave both blank if this is just a holding (memecoin, SOL, etc.)'}
                {type === 'real_estate' && 'Net rental income after expenses'}
                {type === 'business' && 'Annual distributions or profit share'}
                {type === 'stocks' && 'Annual dividends'}
                {type === 'other' && 'How much this generates per year'}
              </Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={annualIncome}
                  onChangeText={setAnnualIncome}
                />
                <Text style={styles.period}>/year</Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setName('');
                    setType('crypto');
                    setValue('');
                    setApy('');
                    setAnnualIncome('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalAddButton, (!name || !value) && styles.modalAddButtonDisabled]}
                  onPress={handleAddAsset}
                  disabled={!name || !value}
                >
                  <Text style={styles.modalAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  progress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4c430',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#f4c430',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0a0e1a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  assetCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  assetName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  assetType: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  warningBadge: {
    fontSize: 11,
    color: '#ff9800',
    marginTop: 4,
    fontWeight: '600',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  assetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assetDetail: {
    flex: 1,
  },
  assetDetailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  assetDetailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  assetIncome: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: 'bold',
  },
  assetIncomeZero: {
    color: '#666',
  },
  totalBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  totalLabel: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  totalMonthly: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
  },
  opportunityBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 8,
  },
  opportunityText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  connectBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  connectText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#0a0e1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#a0a0a0',
  },
  button: {
    flex: 1,
    backgroundColor: '#f4c430',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    flex: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0e1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c430',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  typeButtonActive: {
    borderColor: '#4ade80',
    backgroundColor: '#4ade8020',
  },
  typeButtonText: {
    color: '#a0a0a0',
    fontSize: 13,
  },
  typeButtonTextActive: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  modalInput: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  currencySymbol: {
    fontSize: 20,
    color: '#4ade80',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#ffffff',
    paddingVertical: 16,
  },
  percent: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  period: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  modalAddButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#4ade80',
    alignItems: 'center',
  },
  modalAddButtonDisabled: {
    opacity: 0.5,
  },
  modalAddText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
