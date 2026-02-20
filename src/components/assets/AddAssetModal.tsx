// src/components/assets/AddAssetModal.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { lookupToken, searchTokens, type TokenInfo } from '../../utils/tokenRegistry';
import StockVestingFields from './StockVestingFields';
import type {
  Asset, AssetType,
  CryptoAsset, StockAsset, RealEstateAsset, BusinessAsset, RetirementAsset, OtherAsset,
} from '../../types';

// ── Helpers ────────────────────────────────────────────────
const isCryptoLike = (t: AssetType) => t === 'crypto' || t === 'defi';
const isStockLike = (t: AssetType) => t === 'stocks' || t === 'brokerage';

const ASSET_TYPES: { key: AssetType; label: string }[] = [
  { key: 'crypto', label: '₿ Crypto' },
  { key: 'defi', label: '🔗 DeFi' },
  { key: 'stocks', label: '📈 Stocks' },
  { key: 'real_estate', label: '🏠 Real Estate' },
  { key: 'retirement', label: '🏦 Retirement' },
  { key: 'business', label: '💼 Business' },
  { key: 'other', label: '💰 Other' },
];

const RETIREMENT_TYPES = [
  { key: '401k' as const, label: '401(k)' },
  { key: 'roth_401k' as const, label: 'Roth 401(k)' },
  { key: 'ira' as const, label: 'IRA' },
  { key: 'roth_ira' as const, label: 'Roth IRA' },
];

const FREQUENCIES = [
  { key: 'weekly' as const, label: 'Weekly' },
  { key: 'biweekly' as const, label: 'Biweekly' },
  { key: 'twice_monthly' as const, label: '2x/mo' },
  { key: 'monthly' as const, label: 'Monthly' },
];

function getFrequencyMultiplier(freq: string): number {
  switch (freq) {
    case 'weekly': return 52 / 12;
    case 'biweekly': return 26 / 12;
    case 'twice_monthly': return 2;
    case 'monthly': return 1;
    default: return 1;
  }
}

// ── Props ──────────────────────────────────────────────────
interface AddAssetModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => void;
  editingAsset?: Asset | null;
}

export default function AddAssetModal({
  visible,
  onClose,
  onAddAsset,
  onUpdateAsset,
  editingAsset,
}: AddAssetModalProps) {
  // ── Core fields ──────────────────────────────────────────
  const [type, setType] = useState<AssetType>('crypto');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');

  // ── Token / quantity / icon fields ───────────────────────
  const [symbol, setSymbol] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenPrice, setTokenPrice] = useState('');
  const [logoUri, setLogoUri] = useState('');
  const [protocol, setProtocol] = useState('');
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [mintAddress, setMintAddress] = useState('');

  // ── DeFi leverage fields ───────────────────────────────────
  const [positionType, setPositionType] = useState<'token' | 'staking' | 'lending' | 'loop' | 'lp' | 'vault'>('token');
  const [supplied, setSupplied] = useState('');
  const [borrowed, setBorrowed] = useState('');
  const [leverage, setLeverage] = useState('');
  const [healthFactor, setHealthFactor] = useState('');

  // ── Stock vesting fields ─────────────────────────────────
  const [hasUnvestedShares, setHasUnvestedShares] = useState(false);
  const [vestedShares, setVestedShares] = useState('');
  const [unvestedShares, setUnvestedShares] = useState('');
  const [sharesPerVest, setSharesPerVest] = useState('');
  const [vestingFrequency, setVestingFrequency] = useState<'yearly' | 'quarterly' | 'monthly'>('quarterly');
  const [nextVestDate, setNextVestDate] = useState('');

  // ── Real estate ──────────────────────────────────────────
  const [isPrimaryResidence, setIsPrimaryResidence] = useState(false);

  // ── Retirement fields ────────────────────────────────────
  const [retAccountType, setRetAccountType] = useState<'401k' | 'roth_401k' | 'ira' | 'roth_ira'>('401k');
  const [retInstitution, setRetInstitution] = useState('');
  const [retBalance, setRetBalance] = useState('');
  const [retContribution, setRetContribution] = useState('');
  const [retFrequency, setRetFrequency] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');
  const [retMatchPercent, setRetMatchPercent] = useState('');
  const [retGrowthRate, setRetGrowthRate] = useState(''); // Historical APY e.g. 20%

  // ── Computed ─────────────────────────────────────────────
  const retMonthlyContribution = (parseFloat(retContribution) || 0) * getFrequencyMultiplier(retFrequency);
  const retMatchPct = parseFloat(retMatchPercent) || 0;

  // ── Auto-calculate value from amount × price ─────────────
  useEffect(() => {
    if (tokenAmount && tokenPrice) {
      const amt = parseFloat(tokenAmount);
      const prc = parseFloat(tokenPrice);
      if (!isNaN(amt) && !isNaN(prc)) {
        setValue((amt * prc).toFixed(2));
      }
    }
  }, [tokenAmount, tokenPrice]);

  // ── Load editing asset into form ─────────────────────────
  useEffect(() => {
    if (!editingAsset) return;
    const a = editingAsset;
    setType(a.type);

    if (a.type === 'retirement' && a.metadata?.type === 'retirement') {
      const m = a.metadata as RetirementAsset;
      setRetAccountType(m.accountType || '401k');
      setRetInstitution(m.institution || '');
      setRetBalance(a.value.toString());
      setRetContribution(m.contributionAmount?.toString() || '0');
      setRetFrequency(m.contributionFrequency || 'biweekly');
      setRetMatchPercent(m.employerMatchPercent?.toString() || '0');
      setRetGrowthRate(m.apy?.toString() || '');
    } else {
      setName(a.name);
      setValue(a.value.toString());

      const meta = a.metadata as any;
      setApy(meta?.apy?.toString() || meta?.dividendYield?.toString() || '');
      setSymbol(meta?.symbol || meta?.ticker || '');
      setLogoUri(meta?.logoURI || '');
      setProtocol(meta?.protocol || '');
      setMintAddress(meta?.mint || '');
      // DeFi leverage fields
      setPositionType(meta?.positionType || 'token');
      setSupplied(meta?.supplied?.toString() || '');
      setBorrowed(meta?.borrowed?.toString() || '');
      setLeverage(meta?.leverage?.toString() || '');
      setHealthFactor(meta?.healthFactor?.toString() || '');

      const qty = meta?.quantity || meta?.balance || meta?.shares;
      setTokenAmount(qty?.toString() || '');
      const price = meta?.priceUSD || meta?.currentPrice;
      setTokenPrice(price?.toString() || '');

      if (a.type === 'real_estate') {
        setIsPrimaryResidence((meta as RealEstateAsset)?.isPrimaryResidence || false);
      }

      if (isStockLike(a.type) && meta?.type === 'stocks') {
        const sm = meta as StockAsset;
        const hasVesting = !!(sm.vestedShares || sm.unvestedShares);
        setHasUnvestedShares(hasVesting);
        setVestedShares(sm.vestedShares?.toString() || '');
        setUnvestedShares(sm.unvestedShares?.toString() || '');
        if (sm.vestingSchedule) {
          setSharesPerVest(sm.vestingSchedule.sharesPerVest?.toString() || '');
          setVestingFrequency(sm.vestingSchedule.frequency || 'quarterly');
          setNextVestDate(sm.vestingSchedule.nextVestDate || '');
        }
      }

      if (meta?.symbol) {
        const token = lookupToken(meta.symbol);
        if (token) setSelectedToken(token);
      }
    }
  }, [editingAsset]);

  // ── Symbol search ────────────────────────────────────────
  const handleSymbolChange = useCallback((text: string) => {
    setSymbol(text);
    setSelectedToken(null);
    setLogoUri('');
    if (text.trim().length >= 1) {
      const results = searchTokens(text).slice(0, 6);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, []);

  const handleSelectToken = useCallback((token: TokenInfo) => {
    setSelectedToken(token);
    setSymbol(token.symbol);
    setLogoUri(token.logoURI);
    setMintAddress(token.mint || '');
    setShowSearchResults(false);
    if (!name) setName(token.name);
  }, [name]);

  const handleFindIcon = useCallback(() => {
    if (!symbol.trim()) return;
    const token = lookupToken(symbol);
    if (token) handleSelectToken(token);
    else {
      setLogoUri('');
      setSelectedToken(null);
      setShowSearchResults(false);
    }
  }, [symbol, handleSelectToken]);

  // ── Build typed metadata ─────────────────────────────────
  const buildMetadata = (): Asset['metadata'] => {
    const qty = parseFloat(tokenAmount) || undefined;
    const price = parseFloat(tokenPrice) || undefined;
    const apyNum = parseFloat(apy) || undefined;
    const sym = symbol.trim().toUpperCase() || undefined;
    const logo = logoUri || undefined;
    const mint = selectedToken?.mint || mintAddress.trim() || undefined;
    const proto = protocol.trim() || undefined;

    switch (type) {
      case 'crypto':
      case 'defi': {
        const meta: CryptoAsset = {
          type: 'crypto',
          quantity: qty, balance: qty, priceUSD: price,
          symbol: sym, logoURI: logo, mint,
          protocol: type === 'defi' ? (proto || 'Unknown') : proto,
          apy: apyNum,
          isStaked: type === 'defi' || (apyNum !== undefined && apyNum > 0),
          description: name,
          // DeFi leverage fields (only for defi)
          ...(type === 'defi' ? {
            positionType: positionType || 'token',
            supplied: parseFloat(supplied) || undefined,
            borrowed: parseFloat(borrowed) || undefined,
            leverage: parseFloat(leverage) || undefined,
            healthFactor: parseFloat(healthFactor) || undefined,
          } : {}),
        };
        return meta;
      }
      case 'stocks':
      case 'brokerage': {
        const meta: StockAsset = {
          type: 'stocks',
          ticker: sym, shares: qty, quantity: qty,
          currentPrice: price, priceUSD: price,
          dividendYield: apyNum, apy: apyNum,
          description: name, mint,
          ...(hasUnvestedShares ? {
            vestedShares: parseFloat(vestedShares) || 0,
            unvestedShares: parseFloat(unvestedShares) || 0,
            vestingSchedule: {
              sharesPerVest: parseFloat(sharesPerVest) || 0,
              frequency: vestingFrequency,
              nextVestDate: nextVestDate || undefined,
            },
          } : {}),
        };
        return meta;
      }
      case 'real_estate': {
        const meta: RealEstateAsset = {
          type: 'real_estate',
          currentValue: parseFloat(value) || undefined,
          isPrimaryResidence,
          description: name,
          apy: apyNum,
        };
        return meta;
      }
      case 'business': {
        const meta: BusinessAsset = {
          type: 'business',
          annualDistributions: parseFloat(annualIncome) || undefined,
          description: name, apy: apyNum,
        };
        return meta;
      }
      case 'retirement': {
        const contribAmount = parseFloat(retContribution) || 0;
        const matchPct = parseFloat(retMatchPercent) || 0;
        const matchDollars = matchPct > 0 && contribAmount > 0
          ? (contribAmount * matchPct / 100) : 0;
        const meta: RetirementAsset = {
          type: 'retirement',
          accountType: retAccountType,
          institution: retInstitution,
          contributionAmount: contribAmount,
          contributionFrequency: retFrequency,
          employerMatchPercent: matchPct || undefined,
          employerMatchDollars: matchDollars || undefined,
          apy: parseFloat(retGrowthRate) || undefined,
        };
        return meta;
      }
      default: {
        const meta: OtherAsset = {
          type: 'other', description: name,
          quantity: qty, balance: qty, priceUSD: price,
          symbol: sym, logoURI: logo, apy: apyNum, mint,
        };
        return meta;
      }
    }
  };

  // ── Submit: Add ──────────────────────────────────────────
  const handleAdd = () => {
    if (type === 'retirement') {
      if (!retInstitution || !retBalance) return;
      const retLabel = retAccountType === '401k' ? '401(k)'
        : retAccountType === 'roth_401k' ? 'Roth 401(k)'
        : retAccountType === 'ira' ? 'IRA' : 'Roth IRA';
      const balance = parseFloat(retBalance);
      const growthRate = parseFloat(retGrowthRate) || 0;
      // Annual income = expected growth on current balance
      const growthIncome = growthRate > 0 ? (balance * growthRate / 100) : 0;
      const newAsset: Asset = {
        id: 'ret_' + Date.now().toString(),
        type: 'retirement',
        name: `${retLabel} — ${retInstitution}`,
        value: balance,
        annualIncome: growthIncome,
        metadata: buildMetadata(),
      };
      onAddAsset(newAsset);
      resetAndClose();
      return;
    }

    if (!name || !value) return;
    let calculatedIncome = parseFloat(annualIncome) || 0;
    if (apy && !annualIncome) {
      calculatedIncome = parseFloat(value) * (parseFloat(apy) / 100);
    }
    const newAsset: Asset = {
      id: Date.now().toString(),
      name, type,
      value: parseFloat(value),
      annualIncome: calculatedIncome,
      isLiquid: isCryptoLike(type),
      metadata: buildMetadata(),
    };
    onAddAsset(newAsset);
    resetAndClose();
  };

  // ── Submit: Edit ─────────────────────────────────────────
  const handleSaveEdit = () => {
    if (!editingAsset || !onUpdateAsset) return;
    if (type === 'retirement') {
      if (!retInstitution || !retBalance) return;
      const balance = parseFloat(retBalance);
      const growthRate = parseFloat(retGrowthRate) || 0;
      const growthIncome = growthRate > 0 ? (balance * growthRate / 100) : 0;
      onUpdateAsset(editingAsset.id, {
        value: balance,
        annualIncome: growthIncome,
        metadata: buildMetadata(),
      });
    } else {
      if (!name || !value) return;
      const assetValue = parseFloat(value);
      const assetApy = parseFloat(apy) || 0;
      let calculatedIncome = parseFloat(annualIncome) || 0;
      if (apy && !annualIncome) {
        calculatedIncome = assetValue * (assetApy / 100);
      }
      onUpdateAsset(editingAsset.id, {
        name, type,
        value: assetValue,
        annualIncome: calculatedIncome,
        isLiquid: isCryptoLike(type),
        metadata: buildMetadata(),
      });
    }
    resetAndClose();
  };

  // ── Reset ────────────────────────────────────────────────
  const resetAndClose = () => {
    setType('crypto'); setName(''); setValue(''); setApy(''); setAnnualIncome('');
    setSymbol(''); setTokenAmount(''); setTokenPrice(''); setLogoUri(''); setProtocol('');
    setSearchResults([]); setShowSearchResults(false); setSelectedToken(null); setMintAddress('');
    setPositionType('token'); setSupplied(''); setBorrowed(''); setLeverage(''); setHealthFactor('');
    setHasUnvestedShares(false); setVestedShares(''); setUnvestedShares('');
    setSharesPerVest(''); setVestingFrequency('quarterly'); setNextVestDate('');
    setIsPrimaryResidence(false);
    setRetAccountType('401k'); setRetInstitution(''); setRetBalance('');
    setRetContribution(''); setRetFrequency('biweekly'); setRetMatchPercent(''); setRetGrowthRate('');
    onClose();
  };

  // ── Conditionals ─────────────────────────────────────────
  const isEditing = !!editingAsset;
  const showTokenFields = isCryptoLike(type) || isStockLike(type) || type === 'other';
  const showProtocolField = isCryptoLike(type);
  const showVestingFields = isStockLike(type);
  const isRetirement = type === 'retirement';
  const isRealEstate = type === 'real_estate';
  const canSubmit = isRetirement ? !!(retInstitution && retBalance) : !!(name && value);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>
              {isEditing
                ? (isRetirement ? 'Edit Retirement Account' : 'Edit Asset')
                : (isRetirement ? 'Add Retirement Account' : 'Add Asset')
              }
            </Text>

            {/* ─── Type Picker ────────────────────────── */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeContainer}>
              {ASSET_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
                  onPress={() => setType(t.key)}
                >
                  <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ═══════════════════════════════════════════ */}
            {/* RETIREMENT PATH                             */}
            {/* ═══════════════════════════════════════════ */}
            {isRetirement ? (
              <>
                <Text style={styles.label}>Account Type</Text>
                <View style={styles.typeContainer}>
                  {RETIREMENT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeBtn, retAccountType === t.key && styles.typeBtnActive]}
                      onPress={() => setRetAccountType(t.key)}
                    >
                      <Text style={[styles.typeBtnText, retAccountType === t.key && styles.typeBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Institution</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Fidelity, Vanguard, Schwab"
                  placeholderTextColor="#666"
                  value={retInstitution}
                  onChangeText={setRetInstitution}
                />

                <Text style={styles.label}>Current Balance</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={retBalance} onChangeText={setRetBalance} />
                </View>

                <Text style={styles.label}>Contribution Per Pay Period</Text>
                <Text style={styles.helper}>How much you put in each time you're paid.</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={retContribution} onChangeText={setRetContribution} />
                </View>

                <Text style={styles.label}>Pay Frequency</Text>
                <View style={styles.typeContainer}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.typeBtn, retFrequency === f.key && styles.typeBtnActive]}
                      onPress={() => setRetFrequency(f.key)}
                    >
                      <Text style={[styles.typeBtnText, retFrequency === f.key && styles.typeBtnTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {parseFloat(retContribution) > 0 && (
                  <Text style={styles.retPreview}>= ${retMonthlyContribution.toFixed(0)}/mo pre-tax</Text>
                )}

                <Text style={styles.label}>Employer Match (%)</Text>
                <Text style={styles.helper}>E.g. "4" means they match up to 4% of salary</Text>
                <View style={styles.inputRow}>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={retMatchPercent} onChangeText={setRetMatchPercent} />
                  <Text style={styles.suffix}>%</Text>
                </View>

                <Text style={styles.label}>Historical Growth Rate / APY</Text>
                <Text style={styles.helper}>Last year's return — e.g. "20" for 20%. Used to estimate annual growth income.</Text>
                <View style={styles.inputRow}>
                  <TextInput style={styles.inputInRow} placeholder="e.g. 10" placeholderTextColor="#666"
                    keyboardType="numeric" value={retGrowthRate} onChangeText={setRetGrowthRate} />
                  <Text style={styles.suffix}>%</Text>
                </View>

                {(parseFloat(retBalance) > 0 && parseFloat(retGrowthRate) > 0) && (
                  <View style={[styles.helperBox, { borderLeftColor: '#4ade80' }]}>
                    <Text style={[styles.helperBoxText, { color: '#4ade80' }]}>
                      Estimated growth: ${((parseFloat(retBalance) * parseFloat(retGrowthRate)) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                      {parseFloat(retContribution) > 0 && ` · Contributions: $${(retMonthlyContribution * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr`}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* ═══════════════════════════════════════ */}
                {/* GENERIC ASSET PATH                      */}
                {/* ═══════════════════════════════════════ */}

                {/* Symbol + Icon */}
                {showTokenFields && (
                  <>
                    <Text style={styles.label}>
                      {isCryptoLike(type) ? 'Token Symbol' : isStockLike(type) ? 'Ticker Symbol' : 'Symbol (optional)'}
                    </Text>
                    <Text style={styles.helper}>
                      {isCryptoLike(type)
                        ? 'e.g. dSOL, USDC, JitoSOL — auto-finds icon'
                        : isStockLike(type) ? 'e.g. VOO, AAPL, NVDA' : 'Enter a symbol to find an icon'}
                    </Text>
                    <View style={styles.symbolRow}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1 }]}
                        placeholder="e.g. dSOL"
                        placeholderTextColor="#666"
                        value={symbol}
                        onChangeText={handleSymbolChange}
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity
                        style={[styles.findBtn, !symbol.trim() && styles.findBtnDisabled]}
                        onPress={handleFindIcon}
                        disabled={!symbol.trim()}
                      >
                        <Text style={styles.findBtnText}>Find Icon</Text>
                      </TouchableOpacity>
                    </View>

                    {showSearchResults && (
                      <View style={styles.searchResults}>
                        {searchResults.map((token) => (
                          <TouchableOpacity key={token.symbol} style={styles.searchResultItem}
                            onPress={() => handleSelectToken(token)}>
                            {token.logoURI ? (
                              <Image source={{ uri: token.logoURI }} style={styles.searchResultIcon} resizeMode="contain" />
                            ) : (
                              <View style={[styles.searchResultIcon, styles.searchResultIconPlaceholder]} />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.searchResultSymbol}>{token.symbol}</Text>
                              <Text style={styles.searchResultName}>{token.name}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {logoUri ? (
                      <View style={styles.iconPreview}>
                        <Image source={{ uri: logoUri }} style={styles.iconImage} resizeMode="contain"
                          onError={() => setLogoUri('')} />
                        <Text style={styles.iconPreviewLabel}>{selectedToken?.name || symbol.toUpperCase()}</Text>
                      </View>
                    ) : null}

                    <Text style={styles.label}>Manual Icon URL (optional)</Text>
                    <TextInput style={styles.modalInput} placeholder="https://example.com/icon.png"
                      placeholderTextColor="#666" value={logoUri} onChangeText={setLogoUri} />
                  </>
                )}

                {/* Protocol */}
                {showProtocolField && (
                  <>
                    <Text style={styles.label}>Protocol (optional)</Text>
                    <Text style={styles.helper}>e.g. Drift, Kamino, Marinade, MarginFi</Text>
                    <TextInput style={styles.modalInput} placeholder="e.g. Drift"
                      placeholderTextColor="#666" value={protocol} onChangeText={setProtocol} />
                  </>
                )}

                {/* DeFi Position Type + Leverage Fields */}
                {type === 'defi' && (
                  <>
                    <Text style={styles.label}>Position Type</Text>
                    <View style={styles.typeContainer}>
                      {([
                        { key: 'staking', label: '📌 Staking' },
                        { key: 'lending', label: '🏦 Lending' },
                        { key: 'loop', label: '🔄 Loop/Multiply' },
                        { key: 'lp', label: '💧 LP' },
                        { key: 'vault', label: '🏰 Vault' },
                      ] as const).map((t) => (
                        <TouchableOpacity
                          key={t.key}
                          style={[styles.typeBtn, positionType === t.key && styles.typeBtnActive]}
                          onPress={() => setPositionType(t.key)}
                        >
                          <Text style={[styles.typeBtnText, positionType === t.key && styles.typeBtnTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Leverage details — shown for loop/lending/vault */}
                    {(positionType === 'loop' || positionType === 'lending' || positionType === 'vault') && (
                      <>
                        <View style={styles.helperBox}>
                          <Text style={styles.helperBoxText}>
                            💡 Enter supplied & borrowed values. Net equity (value used for freedom score) = Supplied - Borrowed.
                          </Text>
                        </View>

                        <Text style={styles.label}>Supplied (Collateral)</Text>
                        <Text style={styles.helper}>Total value of assets you deposited as collateral</Text>
                        <View style={styles.inputRow}>
                          <Text style={styles.dollar}>$</Text>
                          <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                            keyboardType="numeric" value={supplied}
                            onChangeText={(t) => {
                              setSupplied(t);
                              const s = parseFloat(t) || 0;
                              const b = parseFloat(borrowed) || 0;
                              if (s > 0) setValue(Math.max(0, s - b).toFixed(2));
                            }} />
                        </View>

                        <Text style={styles.label}>Borrowed</Text>
                        <Text style={styles.helper}>Total value of your debt/borrow</Text>
                        <View style={styles.inputRow}>
                          <Text style={styles.dollar}>$</Text>
                          <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                            keyboardType="numeric" value={borrowed}
                            onChangeText={(t) => {
                              setBorrowed(t);
                              const s = parseFloat(supplied) || 0;
                              const b = parseFloat(t) || 0;
                              if (s > 0) setValue(Math.max(0, s - b).toFixed(2));
                              if (s > 0 && b > 0) setLeverage((s / (s - b)).toFixed(1));
                            }} />
                        </View>

                        {parseFloat(supplied) > 0 && parseFloat(borrowed) > 0 && (
                          <View style={[styles.helperBox, { borderLeftColor: '#ff9f43' }]}>
                            <Text style={[styles.helperBoxText, { color: '#ff9f43' }]}>
                              Net Equity: ${(parseFloat(supplied) - parseFloat(borrowed)).toFixed(2)} · Leverage: {(parseFloat(supplied) / (parseFloat(supplied) - parseFloat(borrowed))).toFixed(1)}x
                            </Text>
                          </View>
                        )}

                        <Text style={styles.label}>Leverage (auto-calculated or manual)</Text>
                        <View style={styles.inputRow}>
                          <TextInput style={styles.inputInRow} placeholder="e.g. 3.9" placeholderTextColor="#666"
                            keyboardType="numeric" value={leverage} onChangeText={setLeverage} />
                          <Text style={styles.suffix}>x</Text>
                        </View>

                        <Text style={styles.label}>Health Factor (%)</Text>
                        <Text style={styles.helper}>From the protocol dashboard (e.g. 22 means 22%)</Text>
                        <View style={styles.inputRow}>
                          <TextInput style={styles.inputInRow} placeholder="e.g. 22" placeholderTextColor="#666"
                            keyboardType="numeric" value={healthFactor} onChangeText={setHealthFactor} />
                          <Text style={styles.suffix}>%</Text>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* Mint Address — for price sync */}
                {showTokenFields && (
                  <>
                    <Text style={styles.label}>Token Mint Address</Text>
                    <Text style={styles.helper}>
                      Solana token address — enables auto price updates on wallet sync.{' '}
                      {selectedToken?.mint ? 'Auto-filled from token search.' : 'Paste from Solscan or Birdeye.'}
                    </Text>
                    <TextInput
                      style={[styles.modalInput, { fontSize: 12, fontFamily: 'monospace' }]}
                      placeholder="e.g. J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"
                      placeholderTextColor="#444"
                      value={mintAddress}
                      onChangeText={setMintAddress}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                )}

                {/* Name */}
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={
                    type === 'crypto' ? 'e.g., SOL holdings' :
                    type === 'defi' ? (
                      positionType === 'loop' ? 'e.g., INF/wSOL Multiply 3.9x' :
                      positionType === 'lp' ? 'e.g., SOL-USDC LP' :
                      positionType === 'vault' ? 'e.g., JLP Vault' :
                      'e.g., dSOL on Drift'
                    ) :
                    type === 'stocks' ? 'e.g., VOO ETF' :
                    type === 'real_estate' ? 'e.g., Rental Property' :
                    type === 'business' ? 'e.g., LLC Distributions' :
                    'e.g., Investment'
                  }
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                />

                {/* Token Amount + Price */}
                {showTokenFields && (
                  <>
                    <Text style={styles.label}>
                      {isStockLike(type) ? 'Number of Shares' : 'Token Amount (quantity held)'}
                    </Text>
                    <TextInput style={styles.modalInput} placeholder="e.g. 42.5" placeholderTextColor="#666"
                      keyboardType="numeric" value={tokenAmount} onChangeText={setTokenAmount} />

                    <Text style={styles.label}>
                      {isStockLike(type) ? 'Current Price per Share (USD)' : 'Current Price per Token (USD)'}
                    </Text>
                    <View style={styles.inputRow}>
                      <Text style={styles.dollar}>$</Text>
                      <TextInput style={styles.inputInRow} placeholder="e.g. 145.20" placeholderTextColor="#666"
                        keyboardType="numeric" value={tokenPrice} onChangeText={setTokenPrice} />
                    </View>
                  </>
                )}

                {/* Total Value */}
                <Text style={styles.label}>Total Current Value</Text>
                {tokenAmount && tokenPrice ? (
                  <Text style={styles.helper}>Auto-calculated: {tokenAmount} × ${tokenPrice} = ${value}</Text>
                ) : null}
                <View style={styles.inputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={value} onChangeText={setValue} />
                </View>

                {/* Stock Vesting */}
                {showVestingFields && (
                  <StockVestingFields
                    hasUnvestedShares={hasUnvestedShares} setHasUnvestedShares={setHasUnvestedShares}
                    vestedShares={vestedShares} setVestedShares={setVestedShares}
                    unvestedShares={unvestedShares} setUnvestedShares={setUnvestedShares}
                    sharesPerVest={sharesPerVest} setSharesPerVest={setSharesPerVest}
                    vestingFrequency={vestingFrequency} setVestingFrequency={setVestingFrequency}
                    nextVestDate={nextVestDate} setNextVestDate={setNextVestDate}
                  />
                )}

                {/* Primary Residence */}
                {isRealEstate && (
                  <>
                    <Text style={styles.label}>Property Type</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity style={[styles.toggleBtn, !isPrimaryResidence && styles.toggleBtnActive]}
                        onPress={() => setIsPrimaryResidence(false)}>
                        <Text style={[styles.toggleBtnText, !isPrimaryResidence && styles.toggleBtnTextActive]}>
                          Investment Property
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.toggleBtn, isPrimaryResidence && styles.toggleBtnActive]}
                        onPress={() => setIsPrimaryResidence(true)}>
                        <Text style={[styles.toggleBtnText, isPrimaryResidence && styles.toggleBtnTextActive]}>
                          Primary Residence
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isPrimaryResidence && (
                      <View style={styles.helperBox}>
                        <Text style={styles.helperBoxText}>
                          💡 Your primary residence won't prompt for investment thesis and won't appear in "rent out property" scenarios.
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* APY */}
                <Text style={styles.label}>APY (optional)</Text>
                <Text style={styles.helper}>
                  {isCryptoLike(type) && 'If staked or in DeFi. Leave blank for tokens you just hold.'}
                  {isStockLike(type) && 'Dividend yield — we\'ll calculate annual income from this.'}
                  {isRealEstate && 'Cap rate or rental yield.'}
                  {type === 'business' && 'If applicable.'}
                  {type === 'other' && 'If applicable — we\'ll calculate income from this.'}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={apy} onChangeText={setApy} />
                  <Text style={styles.suffix}>%</Text>
                </View>

                {/* Annual Income */}
                <Text style={styles.label}>OR Annual Income</Text>
                <Text style={styles.helper}>
                  {isCryptoLike(type) && 'Leave both blank if this is just a holding (memecoin, SOL, etc.)'}
                  {isRealEstate && 'Net rental income after expenses'}
                  {type === 'business' && 'Annual distributions or profit share'}
                  {isStockLike(type) && 'Annual dividends'}
                  {type === 'other' && 'How much this generates per year'}
                </Text>
                <View style={styles.inputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.inputInRow} placeholder="0" placeholderTextColor="#666"
                    keyboardType="numeric" value={annualIncome} onChangeText={setAnnualIncome} />
                  <Text style={styles.suffix}>/year</Text>
                </View>
              </>
            )}

            {/* ─── Actions ────────────────────────────── */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, !canSubmit && styles.addBtnDisabled]}
                onPress={isEditing ? handleSaveEdit : handleAdd}
                disabled={!canSubmit}
              >
                <Text style={styles.addText}>{isEditing ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#0a0e1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#4ade80', marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, marginTop: 12 },
  helper: { fontSize: 13, color: '#666', marginBottom: 8 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: '#2a2f3e' },
  typeBtnActive: { borderColor: '#4ade80', backgroundColor: '#4ade8020' },
  typeBtnText: { color: '#a0a0a0', fontSize: 13 },
  typeBtnTextActive: { color: '#4ade80', fontWeight: 'bold' },
  modalInput: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 16, fontSize: 16, color: '#ffffff', borderWidth: 2, borderColor: '#2a2f3e' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: '#2a2f3e' },
  inputInRow: { flex: 1, fontSize: 20, color: '#ffffff', paddingVertical: 16 },
  dollar: { fontSize: 20, color: '#4ade80', marginRight: 8 },
  suffix: { fontSize: 14, color: '#666', marginLeft: 8 },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  findBtn: { backgroundColor: '#4ade80', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 8 },
  findBtnDisabled: { opacity: 0.4, backgroundColor: '#2a2f3e' },
  findBtnText: { color: '#0a0e1a', fontWeight: 'bold', fontSize: 14 },
  searchResults: { backgroundColor: '#1a1f2e', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#4ade80', overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#2a2f3e' },
  searchResultIcon: { width: 28, height: 28, borderRadius: 14 },
  searchResultIconPlaceholder: { backgroundColor: '#2a2f3e' },
  searchResultSymbol: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },
  searchResultName: { fontSize: 12, color: '#666' },
  iconPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 4, padding: 12, backgroundColor: '#1a1f2e', borderRadius: 12, borderWidth: 1, borderColor: '#4ade80' },
  iconImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2f3e' },
  iconPreviewLabel: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center', backgroundColor: '#1a1f2e' },
  toggleBtnActive: { borderColor: '#4ade80', backgroundColor: '#1a2f1e' },
  toggleBtnText: { fontSize: 14, color: '#666' },
  toggleBtnTextActive: { color: '#4ade80', fontWeight: 'bold' },
  helperBox: { backgroundColor: '#1a2a3a', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#60a5fa' },
  helperBoxText: { fontSize: 13, color: '#60a5fa', lineHeight: 18 },
  retPreview: { fontSize: 14, color: '#c084fc', marginTop: 8, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#2a2f3e', alignItems: 'center' },
  cancelText: { color: '#a0a0a0', fontSize: 16 },
  addBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  addBtnDisabled: { opacity: 0.5 },
  addText: { color: '#0a0e1a', fontSize: 16, fontWeight: 'bold' },
});
