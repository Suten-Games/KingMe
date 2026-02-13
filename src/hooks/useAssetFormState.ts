// src/hooks/useAssetFormState.ts
import { useState } from 'react';
import type { Asset } from '../types';

export function useAssetFormState() {
  // Generic asset form state
  const [name, setName] = useState('');
  const [type, setType] = useState<Asset['type']>('crypto');
  const [value, setValue] = useState('');
  const [apy, setApy] = useState('');
  const [quantity, setQuantity] = useState('');
  const [hasUnvestedShares, setHasUnvestedShares] = useState(false);
  const [vestedShares, setVestedShares] = useState('');
  const [unvestedShares, setUnvestedShares] = useState('');
  const [sharesPerVest, setSharesPerVest] = useState('');
  const [vestingFrequency, setVestingFrequency] = useState<'yearly' | 'quarterly' | 'monthly'>('yearly');
  const [nextVestDate, setNextVestDate] = useState('');
  const [isPrimaryResidence, setIsPrimaryResidence] = useState(false);

  // Retirement-specific form state
  const [retAccountType, setRetAccountType] = useState<'401k' | 'roth_401k' | 'ira' | 'roth_ira'>('401k');
  const [retInstitution, setRetInstitution] = useState('');
  const [retBalance, setRetBalance] = useState('');
  const [retContribution, setRetContribution] = useState('');
  const [retFrequency, setRetFrequency] = useState<'weekly' | 'biweekly' | 'twice_monthly' | 'monthly'>('biweekly');
  const [retMatchPercent, setRetMatchPercent] = useState('');

  const resetForm = () => {
    setName('');
    setType('crypto');
    setValue('');
    setApy('');
    setQuantity('');
    setRetAccountType('401k');
    setRetInstitution('');
    setRetBalance('');
    setRetContribution('');
    setRetFrequency('biweekly');
    setRetMatchPercent('');
    setIsPrimaryResidence(false);
    setHasUnvestedShares(false);
    setVestedShares('');
    setUnvestedShares('');
    setSharesPerVest('');
    setVestingFrequency('yearly');
    setNextVestDate('');
  };

  return {
    // Generic fields
    name,
    setName,
    type,
    setType,
    value,
    setValue,
    apy,
    setApy,
    quantity,
    setQuantity,
    isPrimaryResidence,
    setIsPrimaryResidence,

    // Retirement fields
    retAccountType,
    setRetAccountType,
    retInstitution,
    setRetInstitution,
    retBalance,
    setRetBalance,
    retContribution,
    setRetContribution,
    retFrequency,
    setRetFrequency,
    retMatchPercent,
    setRetMatchPercent,

    // Stock vesting fields
    hasUnvestedShares,
    setHasUnvestedShares,
    vestedShares,
    setVestedShares,
    unvestedShares,
    setUnvestedShares,
    sharesPerVest,
    setSharesPerVest,
    vestingFrequency,
    setVestingFrequency,
    nextVestDate,
    setNextVestDate,

    // Helper
    resetForm,
  };
}
