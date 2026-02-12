// app/(tabs)/obligations.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { useStore } from '../../src/store/useStore';
import type { Obligation } from '../../src/types';
import PaymentStatusBanner from '../../src/components/PaymentStatusBanner';
import PaymentCalendar from '../../src/components/PaymentCalendar';
import DayPaymentsList from '../../src/components/DayPaymentsList';
import { getPaymentEventsForMonth, getMonthlyPaymentStatus } from '../../src/utils/paymentCalendar';

export default function ObligationsScreen() {
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const debts = useStore((state) => state.debts);
  const addObligation = useStore((state) => state.addObligation);
  const removeObligation = useStore((state) => state.removeObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const toggleObligationPaid = useStore((state) => state.toggleObligationPaid);
  const toggleDebtPaid = useStore((state) => state.toggleDebtPaid);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Get payment data
  const paymentStatus = useMemo(() => 
    getMonthlyPaymentStatus(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );

  const paymentEvents = useMemo(() => 
    getPaymentEventsForMonth(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );

  const handleTogglePaid = (eventId: string, isPaid: boolean) => {
    if (eventId.startsWith('obl_')) {
      const id = eventId.replace('obl_', '');
      toggleObligationPaid(id);
    } else if (eventId.startsWith('debt_')) {
      const id = eventId.replace('debt_', '');
      toggleDebtPaid(id);
    }
  };

  const handleAddObligation = () => {
    if (!name || !amount) return;
    
    const newObligation: Obligation = {
      id: Date.now().toString(),
      name,
      payee: payee || 'Various',
      amount: parseFloat(amount),
      category: 'other',
      isRecurring: true,
      dueDate: dueDate ? parseInt(dueDate): 1,
      bankAccountId: accountId || undefined,
    };
    
    addObligation(newObligation);
    
    // Reset form
    setName('');
    setPayee('');
    setAmount('');
    setAccountId('');
    setDueDate('');
    setShowAddModal(false);
  };

  const handleEditObligation = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setName(obligation.name);
    setPayee(obligation.payee);
    setAmount(obligation.amount.toString());
    setAccountId(obligation.bankAccountId || '');
    setShowAddModal(true);
    setDueDate(obligation.dueDate?.toString() || '');
  };

  const handleSaveEdit = () => {
    if (!editingObligation || !name || !amount) return;

    updateObligation(editingObligation.id, {
      name,
      payee: payee || 'Various',
      amount: parseFloat(amount),
      bankAccountId: accountId || undefined,
      dueDate: dueDate ? parseInt(dueDate) : undefined,
    });

    // Reset
    setEditingObligation(null);
    setName('');
    setPayee('');
    setAmount('');
    setAccountId('');
    setDueDate('');
    setShowAddModal(false);
  };

  const handleCloseModal = () => {
    setEditingObligation(null);
    setName('');
    setPayee('');
    setAmount('');
    setAccountId('');
    setDueDate('');
    setShowAddModal(false);
  };

  const calculateMonthlyTotal = () => {
    return obligations.reduce((sum, o) => sum + o.amount, 0);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Payment Status Banner */}
        <PaymentStatusBanner 
          status={paymentStatus} 
          onShowCalendar={() => setShowCalendar(true)}
        />

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Monthly Obligations</Text>
          <Text style={styles.summaryValue}>${calculateMonthlyTotal().toLocaleString()}</Text>
          <Text style={styles.summaryYearly}>${(calculateMonthlyTotal() * 12).toLocaleString()}/year</Text>
        </View>

        {/* Obligations List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Obligations</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {obligations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No obligations yet</Text>
              <Text style={styles.emptySubtext}>Tap "+ Add" to add your first obligation</Text>
            </View>
          ) : (
            obligations.slice()
            .sort((a, b) => {
              const dateA = a.dueDate ?? 999;
              const dateB = b.dueDate ?? 999;
              return dateA - dateB;
            }).map((obligation) => (
              <TouchableOpacity 
                key={obligation.id} 
                style={styles.obligationCard}
                onPress={() => handleEditObligation(obligation)}
              >
                <View style={styles.obligationHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.obligationName}>{obligation.name}</Text>
                    <Text style={styles.obligationPayee}>Paid to: {obligation.payee}</Text>
                    {obligation.bankAccountId && (
                      <Text style={styles.obligationAccount}>
                        💳 {bankAccounts.find(a => a.id === obligation.bankAccountId)?.name || 'Unknown Account'}
                      </Text>
                    )}
                    {!obligation.bankAccountId && (
                      <Text style={styles.obligationWarning}>⚠️ No account assigned</Text>
                    )}
                    {obligation.dueDate && (
                      <Text style={styles.obligationDueDate}>
                        📅 Due on the {obligation.dueDate}{getDaySuffix(obligation.dueDate)} of each month
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      removeObligation(obligation.id);
                    }}
                    style={styles.deleteButtonContainer}
                  >
                    <Text style={styles.deleteButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.obligationAmount}>${obligation.amount.toFixed(2)}/month</Text>
              </TouchableOpacity>
            ))
          )}
          {/* Calendar Modal */}
          <Modal visible={showCalendar} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <PaymentCalendar
                  year={currentYear}
                  month={currentMonth}
                  events={paymentEvents}
                  onDayPress={(day) => {
                    setSelectedDay(day);
                    setShowCalendar(false);
                  }}
                />
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <Text>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
          {/* Day Detail Modal */}
          <Modal visible={selectedDay !== null} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              {selectedDay !== null && (
                <DayPaymentsList
                  day={selectedDay}
                  month={currentMonth}
                  year={currentYear}
                  events={paymentEvents.filter(e => e.dueDate.getDate() === selectedDay)}
                  onTogglePaid={handleTogglePaid}
                  onClose={() => setSelectedDay(null)}
                />
              )}
            </View>
          </Modal>
        </View>
      </ScrollView>

      {/* Add/Edit Obligation Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingObligation ? 'Edit Obligation' : 'Add Obligation'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Rent, Netflix, Car Payment"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Who are you paying?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., XYZ Financial, Landlord"
              placeholderTextColor="#666"
              value={payee}
              onChangeText={setPayee}
            />

            <Text style={styles.label}>Monthly Amount</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Text style={styles.period}>/month</Text>
            </View>

            {/* Account Picker */}
            <Text style={styles.label}>Paid From (Optional)</Text>
            <Text style={styles.helperText}>Assign to a bank account to track in cashflow</Text>
            {bankAccounts.length === 0 ? (
              <Text style={styles.noAccountsWarning}>⚠️ No bank accounts yet. Add one in Profile first.</Text>
            ) : (
              <View style={styles.accountList}>
                <TouchableOpacity
                  style={[styles.accountOption, !accountId && styles.accountOptionActive]}
                  onPress={() => setAccountId('')}
                >
                  <Text style={[styles.accountOptionName, !accountId && styles.accountOptionNameActive]}>
                    None (Don't track in cashflow)
                  </Text>
                  {!accountId && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
                {bankAccounts.map((acct) => (
                  <TouchableOpacity
                    key={acct.id}
                    style={[styles.accountOption, accountId === acct.id && styles.accountOptionActive]}
                    onPress={() => setAccountId(acct.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountOptionName, accountId === acct.id && styles.accountOptionNameActive]}>
                        {acct.name}
                      </Text>
                      <Text style={styles.accountOptionSub}>
                        {acct.institution} · ${(acct.currentBalance ?? 0).toLocaleString()}
                      </Text>
                    </View>
                    {accountId === acct.id && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
              )}
              <Text style={styles.label}>Due Date (Day of Month)</Text>
              <Text style={styles.helperText}>
                Enter 1-31. Bill will be tracked as due on this day each month.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="15"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={dueDate}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  if (text === '' || (num >= 1 && num <= 31)) {
                    setDueDate(text);
                  }
                }}
                maxLength={2}
              />              

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalAddButton, (!name || !amount) && styles.modalAddButtonDisabled]}
                onPress={editingObligation ? handleSaveEdit : handleAddObligation}
                disabled={!name || !amount}
              >
                <Text style={styles.modalAddText}>{editingObligation ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

 function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
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
  summaryBox: {
    backgroundColor: '#1a1f2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f4c430',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4c430',
  },
  summaryYearly: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
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
  obligationCard: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  obligationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  obligationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  obligationPayee: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  deleteButton: {
    fontSize: 20,
    color: '#ff4444',
    padding: 4,
  },
  obligationAmount: {
    fontSize: 16,
    color: '#f4c430',
    fontWeight: 'bold',
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
    maxHeight: '90%',
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
    color: '#f4c430',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#ffffff',
    paddingVertical: 16,
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
    backgroundColor: '#f4c430',
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
  obligationAccount: {
    fontSize: 12,
    color: '#4ade80',
    marginTop: 4,
  },
  obligationWarning: {
    fontSize: 12,
    color: '#fb923c',
    marginTop: 4,
  },
  deleteButtonContainer: {
    padding: 4,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    marginTop: -4,
  },
  noAccountsWarning: {
    fontSize: 14,
    color: '#fb923c',
    padding: 12,
    backgroundColor: '#2a1a1e',
    borderRadius: 8,
    marginTop: 4,
  },
  accountList: {
    gap: 8,
    marginBottom: 8,
  },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    backgroundColor: '#1a1f2e',
  },
  accountOptionActive: {
    borderColor: '#f4c430',
    backgroundColor: '#2a2620',
  },
  accountOptionName: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 2,
  },
  accountOptionNameActive: {
    color: '#f4c430',
    fontWeight: 'bold',
  },
  accountOptionSub: {
    fontSize: 12,
    color: '#666',
  },
  checkMark: {
    fontSize: 18,
    color: '#f4c430',
    fontWeight: 'bold',
  },
  obligationDueDate: {
    fontSize: 12,
    color: '#60a5fa',
    marginTop: 4,
  },
});
