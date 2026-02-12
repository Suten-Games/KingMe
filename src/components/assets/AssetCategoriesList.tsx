// src/components/assets/AssetCategoriesList.tsx
import AssetSection from '../AssetSection';
import { getCategoryIcon, getCategoryLabel, calculateCategoryTotal, calculateCategoryIncome } from '../../utils/assetCalculations';
import type { CategorizedAssets } from '../../utils/assetCalculations';
import type { Asset } from '../../types';

interface AssetCategoriesListProps {
  categorized: CategorizedAssets;
  onAssetPress: (asset: Asset) => void;
  onAssetDelete: (asset: Asset) => void;
  onBankAccountPress?: (accountId: string) => void;
}

export default function AssetCategoriesList({
  categorized,
  onAssetPress,
  onAssetDelete,
  onBankAccountPress,
}: AssetCategoriesListProps) {
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

      <AssetSection
        title={getCategoryLabel('crypto')}
        icon={getCategoryIcon('crypto')}
        assets={categorized.crypto}
        totalValue={calculateCategoryTotal(categorized.crypto)}
        totalIncome={calculateCategoryIncome(categorized.crypto)}
        onAssetPress={onAssetPress}
        onAssetDelete={onAssetDelete}
      />

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
