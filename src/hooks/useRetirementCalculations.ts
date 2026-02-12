// src/hooks/useRetirementCalculations.ts
import type { IncomeSource } from '../types';

export function useRetirementCalculations(
  retContribution: string,
  retFrequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly',
  retMatchPercent: string,
  incomeSources: IncomeSource[]
) {
  // Calculate monthly contribution
  const monthlyContribution = (() => {
    const amt = parseFloat(retContribution) || 0;
    if (retFrequency === 'weekly') return amt * 4.33;
    if (retFrequency === 'biweekly') return amt * 2.17;
    if (retFrequency === 'twice_monthly') return amt * 2;
    return amt;
  })();

  // Calculate total monthly salary
  const totalMonthlySalary = incomeSources.reduce((sum, s) => {
    if (s.frequency === 'biweekly') return sum + s.amount * 2.17;
    if (s.frequency === 'weekly') return sum + s.amount * 4.33;
    if (s.frequency === 'twice_monthly') return sum + s.amount * 2;
    return sum + s.amount;
  }, 0);

  // Calculate employer match
  const matchPercent = parseFloat(retMatchPercent) || 0;
  const employerMatchDollars = matchPercent > 0 
    ? totalMonthlySalary * (matchPercent / 100) 
    : 0;

  return {
    monthlyContribution,
    totalMonthlySalary,
    matchPercent,
    employerMatchDollars,
  };
}
