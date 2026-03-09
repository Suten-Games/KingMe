// src/utils/paymentCalendar.ts - Payment tracking logic
import type { Obligation, Debt, BankAccount } from '../types';

export interface PaymentEvent {
  id: string;
  type: 'obligation' | 'debt';
  name: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  category?: string;
  accountName: string;
  isOverdue: boolean;
}

export interface MonthlyPaymentStatus {
  month: string;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  obligationsPaid: number;
  obligationsTotal: number;
  debtsPaid: number;
  debtsTotal: number;
  overdue: PaymentEvent[];
  dueThisWeek: PaymentEvent[];
  paid: PaymentEvent[];
  upcoming: PaymentEvent[];
}

/**
 * Get payment events for a specific month
 */
export function getPaymentEventsForMonth(
  obligations: Obligation[],
  debts: Debt[],
  bankAccounts: BankAccount[],
  year: number,
  month: number // 0-11 (JavaScript month)
): PaymentEvent[] {
  const events: PaymentEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to get account name
  const getAccountName = (accountId: string) => {
    const account = bankAccounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  // Add obligations
  obligations.forEach(obl => {
    if (!obl.dueDate || !obl.isRecurring) return;
    
    // Create date for this month
    const dueDate = new Date(year, month, obl.dueDate);
    
    events.push({
      id: `obl_${obl.id}`,
      type: 'obligation',
      name: obl.name,
      amount: obl.amount,
      dueDate,
      isPaid: obl.isPaidThisMonth || false,
      category: obl.category,
      accountName: getAccountName(obl.bankAccountId || ''),
      isOverdue: !obl.isPaidThisMonth && dueDate < today,
    });
  });

  // Add debts
  debts.forEach(debt => {
    if (!debt.dueDate) return;
    
    const dueDate = new Date(year, month, debt.dueDate);
    
    events.push({
      id: `debt_${debt.id}`,
      type: 'debt',
      name: debt.name,
      amount: debt.monthlyPayment,
      dueDate,
      isPaid: debt.isPaidThisMonth || false,
      category: (debt as any).type,
      accountName: getAccountName(debt.bankAccountId || ''),
      isOverdue: !debt.isPaidThisMonth && dueDate < today,
    });
  });

  // Sort by due date
  events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return events;
}

/**
 * Get monthly payment status summary
 */
export function getMonthlyPaymentStatus(
  obligations: Obligation[],
  debts: Debt[],
  bankAccounts: BankAccount[],
  year: number,
  month: number
): MonthlyPaymentStatus {
  const events = getPaymentEventsForMonth(obligations, debts, bankAccounts, year, month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Categorize events
  const overdue = events.filter(e => e.isOverdue);
  const paid = events.filter(e => e.isPaid && !e.isOverdue);
  const dueThisWeek = events.filter(e => !e.isPaid && !e.isOverdue && e.dueDate <= weekFromNow);
  const upcoming = events.filter(e => !e.isPaid && !e.isOverdue && e.dueDate > weekFromNow);

  // Calculate totals
  const totalDue = events.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = paid.reduce((sum, e) => sum + e.amount, 0);
  const totalRemaining = totalDue - totalPaid;

  const obligationEvents = events.filter(e => e.type === 'obligation');
  const debtEvents = events.filter(e => e.type === 'debt');

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    totalDue,
    totalPaid,
    totalRemaining,
    obligationsPaid: obligationEvents.filter(e => e.isPaid).length,
    obligationsTotal: obligationEvents.length,
    debtsPaid: debtEvents.filter(e => e.isPaid).length,
    debtsTotal: debtEvents.length,
    overdue,
    dueThisWeek,
    paid,
    upcoming,
  };
}

/**
 * Check if we need to reset isPaid flags (call this on app startup)
 */
export function shouldResetPaymentStatus(lastResetDate?: string): boolean {
  if (!lastResetDate) return true;
  
  const lastReset = new Date(lastResetDate);
  const now = new Date();
  
  // Reset if we're in a different month
  return lastReset.getMonth() !== now.getMonth() || 
         lastReset.getFullYear() !== now.getFullYear();
}

/**
 * Reset all payment statuses (call at start of new month)
 */
export function resetMonthlyPaymentStatuses(
  obligations: Obligation[],
  debts: Debt[]
): { obligations: Obligation[]; debts: Debt[] } {
  return {
    obligations: obligations.map(o => ({ ...o, isPaidThisMonth: false })),
    debts: debts.map(d => ({ ...d, isPaidThisMonth: false })),
  };
}
