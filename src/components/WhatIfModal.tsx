// src/components/WhatIfModal.tsx
import { WhatIfScenario } from '@/types';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { isOnChainScenario, formatSwapAmount, MINTS } from '@/services/jupiterSwap';
import type { SwapScenarioState } from '@/hooks/useSwapScenario';
import { useStore } from '../store/useStore';
import ProGate from './ProGate';

interface WhatIfModalProps {
  visible: boolean;
  scenario: WhatIfScenario | null;
  onClose: () => void;
  onApply: (scenario: WhatIfScenario) => void;
  /** Pass swapState from useSwapScenario hook */
  swapState?: SwapScenarioState;
}

export default function WhatIfModal({
  visible,
  scenario,
  onClose,
  onApply,
  swapState,
}: WhatIfModalProps) {
  const isPro = useStore(s => s.isPro);

  if (!scenario) return null;

  const { impact, emoji, title, description, reasoning = '', risks = [], steps = [] } = scenario;
  const onChain = isOnChainScenario(scenario.type);

  const freedomGainMonths = impact.freedomDelta;
  const freedomGainYears = freedomGainMonths / 12;

  // Determine if the apply button should be disabled
  const isProcessing = swapState?.state === 'signing' ||
    swapState?.state === 'submitting' ||
    swapState?.state === 'quoting';

  const isComplete = swapState?.state === 'success';

  // Button label based on state
  const getButtonLabel = (): string => {
    if (!onChain) return 'Apply This Scenario';
    if (!swapState) return '⚡ Execute On-Chain';

    switch (swapState.state) {
      case 'quoting': return 'Getting best price...';
      case 'confirming': return '⚡ Execute On-Chain';
      case 'signing': return '🔐 Approve in Wallet...';
      case 'submitting': return '⏳ Confirming on Solana...';
      case 'success': return '✅ Complete!';
      case 'error': return '⚡ Retry';
      default: return '⚡ Execute On-Chain';
    }
  };

  // Button style based on state
  const getButtonStyle = () => {
    if (isComplete) return [styles.applyButton, styles.applyButtonSuccess];
    if (isProcessing) return [styles.applyButton, styles.applyButtonProcessing];
    if (onChain) return [styles.applyButton, styles.applyButtonOnChain];
    return [styles.applyButton];
  };

  const getButtonTextStyle = () => {
    if (onChain && !isComplete) return [styles.applyButtonText, styles.applyButtonTextOnChain];
    return [styles.applyButtonText];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {onChain ? '⚡ On-Chain Scenario' : 'What-If Scenario'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <ProGate featureName="Full Scenario Details" lockMessage="See the complete action plan and steps to gain more freedom days.">
          {/* ── Swap Status Section ─────────────────────────────── */}
          {onChain && swapState && (
            <SwapStatusSection swapState={swapState} />
          )}

          {/* ── Before → After ──────────────────────────────────── */}
          <View style={styles.beforeAfter}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Before</Text>
              <View style={styles.columnCard}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Freedom</Text>
                  <Text style={styles.metricValue}>
                    {impact.freedomBefore >= 12
                      ? `${(impact.freedomBefore / 12).toFixed(1)}y`
                      : `${impact.freedomBefore.toFixed(1)}mo`}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={styles.metricValue}>
                    ${Math.round(impact.monthlyIncomeBefore)}/mo
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.arrow}>→</Text>

            <View style={styles.column}>
              <Text style={styles.columnLabel}>After</Text>
              <View style={[styles.columnCard, styles.columnCardAfter]}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Freedom</Text>
                  <Text style={[styles.metricValue, styles.metricValueGreen]}>
                    {impact.freedomAfter >= 12
                      ? `${(impact.freedomAfter / 12).toFixed(1)}y`
                      : `${impact.freedomAfter.toFixed(1)}mo`}
                  </Text>
                  <Text style={styles.metricDelta}>
                    +{freedomGainYears >= 1
                      ? `${freedomGainYears.toFixed(1)}y`
                      : `${freedomGainMonths.toFixed(1)}mo`}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={[styles.metricValue, styles.metricValueGreen]}>
                    ${Math.round(impact.monthlyIncomeAfter)}/mo
                  </Text>
                  <Text style={styles.metricDelta}>
                    +${Math.round(impact.monthlyIncomeDelta)}/mo
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Why This Works ──────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 Why This Works</Text>
            <Text style={styles.sectionText}>{reasoning}</Text>
          </View>

          {/* ── Investment Required ─────────────────────────────── */}
          {impact.investmentRequired > 0 && (
            <View style={styles.investmentBox}>
              <Text style={styles.investmentLabel}>Investment Required</Text>
              <Text style={styles.investmentAmount}>
                ${impact.investmentRequired.toLocaleString()}
              </Text>
              {impact.roi && (
                <Text style={styles.investmentROI}>
                  {impact.roi.toFixed(1)}% annual return
                </Text>
              )}
            </View>
          )}

          {impact.investmentRequired === 0 && (
            <View style={[styles.investmentBox, styles.freeBox]}>
              <Text style={styles.freeLabel}>💰 No Investment Required</Text>
              <Text style={styles.freeText}>
                This just repositions your existing assets!
              </Text>
            </View>
          )}

          {/* ── Steps ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {onChain ? '⚡ What Happens' : '📋 How to Do This'}
            </Text>
            {onChain && (
              <View style={styles.onChainStepsInfo}>
                <Text style={styles.onChainStepsInfoText}>
                  Tap "Execute" below and your wallet will prompt you to approve the transaction. Everything happens on Solana — no sign-ups or transfers needed.
                </Text>
              </View>
            )}
            {steps.map((step, index) => (
              <View key={index} style={styles.step}>
                <View style={[styles.stepNumber, onChain && styles.stepNumberOnChain]}>
                  <Text style={[styles.stepNumberText, onChain && styles.stepNumberTextOnChain]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* ── Risks ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Things to Consider</Text>
            {risks.map((risk, index) => (
              <View key={index} style={styles.risk}>
                <Text style={styles.riskBullet}>•</Text>
                <Text style={styles.riskText}>{risk}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
          </ProGate>
        </ScrollView>

        {/* ── Footer / Apply Button ────────────────────────────── */}
        {isPro && (
          <View style={styles.footer}>
            {isComplete ? (
              <TouchableOpacity
                style={[styles.applyButton, styles.applyButtonSuccess]}
                onPress={onClose}
              >
                <Text style={styles.applyButtonText}>✅ Done — Close</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={getButtonStyle()}
                onPress={() => onApply(scenario)}
                disabled={isProcessing}
              >
                {isProcessing && (
                  <ActivityIndicator
                    color={onChain ? '#f4c430' : '#0a0e1a'}
                    size="small"
                    style={styles.buttonSpinner}
                  />
                )}
                <Text style={getButtonTextStyle()}>
                  {getButtonLabel()}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}


// ═══════════════════════════════════════════════════════════════
// Mint lookup helpers
// ═══════════════════════════════════════════════════════════════

const MINT_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(MINTS).map(([symbol, mint]) => [mint, symbol])
);

const MINT_TO_DECIMALS: Record<string, number> = {
  [MINTS.SOL]: 9,
  [MINTS.USDC]: 6,
  [MINTS.USDT]: 6,
  [MINTS.PYUSD]: 6,
  [MINTS['USD*']]: 6,
};

function mintSymbol(mint: string): string {
  return MINT_TO_SYMBOL[mint] || mint.slice(0, 6) + '...';
}

function mintDecimals(mint: string): number {
  return MINT_TO_DECIMALS[mint] || 6;
}


// ═══════════════════════════════════════════════════════════════
// Swap Status Sub-component
// ═══════════════════════════════════════════════════════════════

function SwapStatusSection({ swapState }: { swapState: SwapScenarioState }) {
  // Don't render anything if idle
  if (swapState.state === 'idle' && !swapState.quote) return null;

  return (
    <View style={styles.swapSection}>
      {/* Quote Loading */}
      {swapState.state === 'quoting' && (
        <View style={styles.swapStatusRow}>
          <ActivityIndicator color="#f4c430" size="small" />
          <Text style={styles.swapStatusText}>Finding best swap route...</Text>
        </View>
      )}

      {/* Quote Preview */}
      {swapState.quote && swapState.state !== 'success' && (
        <View style={styles.swapQuoteCard}>
          <View style={styles.swapQuoteHeader}>
            <Text style={styles.swapQuoteTitle}>⚡ Swap Preview</Text>
            <Text style={styles.swapQuotePowered}>via Jupiter</Text>
          </View>

          <View style={styles.swapQuoteBody}>
            <View style={styles.swapQuoteAmounts}>
              <Text style={styles.swapQuoteFrom}>
                {formatSwapAmount(
                  swapState.quote.inAmount,
                  mintDecimals(swapState.quote.inputMint),
                  mintSymbol(swapState.quote.inputMint),
                )}
              </Text>
              <Text style={styles.swapQuoteArrow}>→</Text>
              <Text style={styles.swapQuoteTo}>
                {formatSwapAmount(
                  swapState.quote.outAmount,
                  mintDecimals(swapState.quote.outputMint),
                  mintSymbol(swapState.quote.outputMint),
                )}
              </Text>
            </View>

            {swapState.quote.priceImpactPct && (
              <Text style={[
                styles.swapPriceImpact,
                parseFloat(swapState.quote.priceImpactPct) > 1 && styles.swapPriceImpactHigh,
              ]}>
                Price impact: {parseFloat(swapState.quote.priceImpactPct).toFixed(3)}%
              </Text>
            )}

            {swapState.quote.platformFee && (
              <Text style={styles.swapFeeText}>
                Fee: {swapState.quote.platformFee.pct}%
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Signing */}
      {swapState.state === 'signing' && (
        <View style={styles.swapStatusRow}>
          <ActivityIndicator color="#60a5fa" size="small" />
          <Text style={styles.swapStatusText}>Approve in your wallet...</Text>
        </View>
      )}

      {/* Confirming on-chain */}
      {swapState.state === 'submitting' && (
        <View style={styles.swapStatusRow}>
          <ActivityIndicator color="#4ade80" size="small" />
          <Text style={styles.swapStatusText}>Confirming on Solana...</Text>
        </View>
      )}

      {/* Success */}
      {swapState.state === 'success' && swapState.result?.signature && (
        <View style={styles.swapSuccessCard}>
          <Text style={styles.swapSuccessEmoji}>🎉</Text>
          <Text style={styles.swapSuccessTitle}>Transaction Confirmed!</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(
              `https://solscan.io/tx/${swapState.result!.signature}`
            )}
          >
            <Text style={styles.swapSignatureLink}>
              {swapState.result.signature.slice(0, 12)}...{swapState.result.signature.slice(-12)}
            </Text>
          </TouchableOpacity>
          <Text style={styles.swapSuccessSubtext}>
            Your wallet has been synced with the new balances.
          </Text>
        </View>
      )}

      {/* Error */}
      {swapState.state === 'error' && swapState.error && (
        <View style={styles.swapErrorCard}>
          <Text style={styles.swapErrorText}>❌ {swapState.error}</Text>
        </View>
      )}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },

  // ── Before/After ───────────────────────────────────────────
  beforeAfter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  columnCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
  },
  columnCardAfter: {
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  metric: {
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricValueGreen: {
    color: '#4ade80',
  },
  metricDelta: {
    fontSize: 13,
    color: '#4ade80',
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    color: '#666',
  },

  // ── Sections ───────────────────────────────────────────────
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#a0a0a0',
    lineHeight: 24,
  },

  // ── Investment ─────────────────────────────────────────────
  investmentBox: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
  },
  investmentLabel: {
    fontSize: 13,
    color: '#fbbf24',
    marginBottom: 8,
  },
  investmentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  investmentROI: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  freeBox: {
    borderColor: '#4ade80',
  },
  freeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 8,
  },
  freeText: {
    fontSize: 14,
    color: '#a0a0a0',
  },

  // ── Steps ──────────────────────────────────────────────────
  onChainStepsInfo: {
    backgroundColor: '#f4c43010',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f4c43030',
  },
  onChainStepsInfoText: {
    fontSize: 14,
    color: '#f4c430',
    lineHeight: 21,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2f3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberOnChain: {
    backgroundColor: '#f4c43020',
    borderWidth: 1,
    borderColor: '#f4c43040',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60a5fa',
  },
  stepNumberTextOnChain: {
    color: '#f4c430',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#a0a0a0',
    lineHeight: 22,
  },

  // ── Risks ──────────────────────────────────────────────────
  risk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  riskBullet: {
    fontSize: 18,
    color: '#f87171',
    marginRight: 8,
    marginTop: -2,
  },
  riskText: {
    flex: 1,
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 22,
  },

  // ── Swap Status ────────────────────────────────────────────
  swapSection: {
    marginBottom: 24,
  },
  swapStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#141825',
    borderRadius: 12,
    marginBottom: 12,
  },
  swapStatusText: {
    fontSize: 15,
    color: '#b0b0b8',
    fontWeight: '500',
  },

  // ── Swap Quote Card ────────────────────────────────────────
  swapQuoteCard: {
    backgroundColor: '#141825',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f4c43040',
    overflow: 'hidden',
    marginBottom: 12,
  },
  swapQuoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f4c43010',
    borderBottomWidth: 1,
    borderBottomColor: '#f4c43020',
  },
  swapQuoteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4c430',
  },
  swapQuotePowered: {
    fontSize: 11,
    color: '#666',
  },
  swapQuoteBody: {
    padding: 16,
    alignItems: 'center',
  },
  swapQuoteAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  swapQuoteFrom: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  swapQuoteArrow: {
    fontSize: 18,
    color: '#f4c430',
  },
  swapQuoteTo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
  },
  swapPriceImpact: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  swapPriceImpactHigh: {
    color: '#f87171',
  },
  swapFeeText: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },

  // ── Swap Success ───────────────────────────────────────────
  swapSuccessCard: {
    backgroundColor: '#4ade8010',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#4ade8040',
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  swapSuccessEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  swapSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
    marginBottom: 8,
  },
  swapSignatureLink: {
    fontSize: 13,
    color: '#60a5fa',
    textDecorationLine: 'underline',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  swapSuccessSubtext: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },

  // ── Swap Error ─────────────────────────────────────────────
  swapErrorCard: {
    backgroundColor: '#f8717110',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f8717140',
    padding: 14,
    marginBottom: 12,
  },
  swapErrorText: {
    fontSize: 14,
    color: '#f87171',
    textAlign: 'center',
  },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  applyButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  applyButtonOnChain: {
    backgroundColor: '#f4c430',
  },
  applyButtonProcessing: {
    backgroundColor: '#2a2f3e',
    borderWidth: 1.5,
    borderColor: '#f4c43050',
  },
  applyButtonSuccess: {
    backgroundColor: '#4ade8020',
    borderWidth: 1.5,
    borderColor: '#4ade8060',
  },
  buttonSpinner: {
    marginRight: 10,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
  applyButtonTextOnChain: {
    color: '#0a0e1a',
  },
});
