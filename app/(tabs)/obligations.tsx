// app/(tabs)/obligations.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Animated } from 'react-native';
import { useState, useMemo, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useFreedomScore } from '../../src/store/useStore';
import type { Obligation } from '../../src/types';
import { BankTransactionCategory, TRANSACTION_CATEGORY_META, TRANSACTION_GROUP_META, CATEGORY_OPTIONS } from '../../src/types/bankTransactionTypes';
import PaymentStatusBanner from '../../src/components/PaymentStatusBanner';
import PaymentCalendar from '../../src/components/PaymentCalendar';
import DayPaymentsList from '../../src/components/DayPaymentsList';
import { getPaymentEventsForMonth, getMonthlyPaymentStatus } from '../../src/utils/paymentCalendar';
import { T } from '../../src/theme';
import EmptyStateCard from '../../src/components/EmptyStateCard';

// ─── Audit helpers ──────────────────────────────────────────────────────────
type NecessityLevel = 'essential' | 'important' | 'nice_to_have' | 'cuttable' | 'unreviewed';

const NECESSITY_META: Record<NecessityLevel, { label: string; emoji: string; color: string; description: string }> = {
  essential:    { label: 'Essential',     emoji: '🔒', color: '#ef4444', description: 'Cannot function without this' },
  important:    { label: 'Important',     emoji: '⚡', color: '#f97316', description: 'Significantly impacts quality of life' },
  nice_to_have: { label: 'Nice to Have',  emoji: '✨', color: '#eab308', description: 'Enjoyable but could live without' },
  cuttable:     { label: 'Cut This',      emoji: '✂️', color: '#22c55e', description: 'Not worth the cost — cut it' },
  unreviewed:   { label: 'Not Reviewed',  emoji: '❓', color: '#6b7280', description: 'Tap to evaluate' },
};

const CHALLENGE_QUESTIONS: Record<string, string[]> = {
  housing:       ['Is this the most cost-effective option?', 'Could you negotiate a lower rate?', 'Would a roommate offset this?'],
  utilities:     ['Are you on the cheapest plan?', 'Have you compared providers recently?', 'Can you reduce usage?'],
  insurance:     ['When did you last shop around?', 'Are you over-insured?', 'Could you raise deductibles?'],
  subscription:  ['When did you last use this?', 'Does anyone in your household actually use this?', 'Is there a free alternative?'],
  food:          ['How often do you cook at home?', 'Could meal prepping replace some of this?', 'Is delivery worth the markup?'],
  transport:     ['Is there a cheaper route or mode?', 'Could you bike, walk, or carpool?', 'Are you overpaying for insurance?'],
  entertainment: ['How often do you actually use this?', 'Could you share with someone?', 'Is there a cheaper tier?'],
  debt:          ['Can you refinance for a lower rate?', 'Would extra payments save more in interest?', 'Is consolidation an option?'],
  other:         ['What exactly is this for?', 'Would you sign up for this again today?', 'What happens if you stop paying?'],
};

// ─── Category Picker (modal-based) ────────────────────────────────────────────
function ObligationCategoryPicker({ value, onChange }: { value: BankTransactionCategory | ''; onChange: (cat: BankTransactionCategory | '') => void }) {
  const [open, setOpen] = useState(false);
  const meta = value ? TRANSACTION_CATEGORY_META[value] : null;

  return (
    <>
      <Text style={s.label}>Spending Category</Text>
      <TouchableOpacity style={s.catPickerField} onPress={() => setOpen(true)}>
        <Text style={meta ? s.catPickerValue : s.catPickerPlaceholder}>
          {meta ? `${meta.emoji} ${meta.label}` : 'Tap to select category'}
        </Text>
        <Text style={s.catPickerArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.catModalOverlay}>
          <View style={s.catModalContent}>
            <View style={s.catModalHeader}>
              <Text style={s.catModalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.catModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.catOption, !value && s.catOptionActive]}
                onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={[s.catOptionText, !value && s.catOptionTextActive]}>None</Text>
              </TouchableOpacity>

              {CATEGORY_OPTIONS.map(({ group, categories }) => {
                const gMeta = TRANSACTION_GROUP_META[group];
                return (
                  <View key={group}>
                    <Text style={[s.catGroupHeader, { color: gMeta?.color || T.textMuted }]}>
                      {gMeta?.emoji} {gMeta?.label}
                    </Text>
                    {categories.map(({ value: cat, label }) => {
                      const catMeta = TRANSACTION_CATEGORY_META[cat];
                      const isActive = value === cat;
                      return (
                        <TouchableOpacity key={cat}
                          style={[s.catOption, isActive && { ...s.catOptionActive, borderColor: gMeta?.color || T.gold }]}
                          onPress={() => { onChange(cat); setOpen(false); }}>
                          <Text style={[s.catOptionText, isActive && s.catOptionTextActive]}>
                            {catMeta?.emoji || ''} {label}
                          </Text>
                          {isActive && <Text style={[s.catOptionCheck, { color: gMeta?.color || T.gold }]}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function ObligationsScreen() {
  const obligations = useStore((state) => state.obligations);
  const bankAccounts = useStore((state) => state.bankAccounts);
  const debts = useStore((state) => state.debts);
  const addObligation = useStore((state) => state.addObligation);
  const removeObligation = useStore((state) => state.removeObligation);
  const updateObligation = useStore((state) => state.updateObligation);
  const toggleObligationPaid = useStore((state) => state.toggleObligationPaid);
  const toggleDebtPaid = useStore((state) => state.toggleDebtPaid);
  const reconcilePayments = useStore((state) => state.reconcilePayments);

  // Auto-match on page load
  useEffect(() => { reconcilePayments(); }, []);

  // ── Kudos when obligations are reduced ──
  const [kudos, setKudos] = useState<{ saved: number; newTotal: number } | null>(null);
  const prevTotalRef = useRef<number | null>(null);
  const totalObligations = useMemo(() => obligations.reduce((s, o) => s + o.amount, 0), [obligations]);
  const totalDebts = useMemo(() => debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0), [debts]);
  useEffect(() => {
    if (prevTotalRef.current !== null && totalObligations < prevTotalRef.current) {
      const saved = prevTotalRef.current - totalObligations;
      setKudos({ saved, newTotal: totalObligations + totalDebts });
    }
    prevTotalRef.current = totalObligations;
  }, [totalObligations]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [transactionCategory, setTransactionCategory] = useState<BankTransactionCategory | ''>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // ── Audit mode ──
  const [auditMode, setAuditMode] = useState(false);
  const [auditRatings, setAuditRatings] = useState<Record<string, NecessityLevel>>({});
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // ── Freedom score ──
  const freedom = useFreedomScore();

  // ── Per-obligation freedom impact ──
  const obligationImpacts = useMemo(() => {
    const totalMonthlyObs = obligations.reduce((s, o) => s + o.amount, 0);
    const totalMonthlyDebts = debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0);
    const totalMonthlyNeeds = totalMonthlyObs + totalMonthlyDebts;
    const dailyNeeds = totalMonthlyNeeds / 30;

    // Estimate daily passive income from freedom score
    // freedom.days = dailyPassiveIncome / dailyNeeds (approximately)
    // So dailyPassiveIncome ≈ freedom.days * dailyNeeds (if days < infinity)
    const freedomDays = freedom.days || 0;
    const dailyPassive = dailyNeeds > 0 && freedomDays > 0 ? freedomDays * dailyNeeds : 0;

    const impacts: Record<string, { freedomDelta: number; newFreedomDays: number; yearlyAmount: number; percentOfNeeds: number }> = {};

    for (const ob of obligations) {
      const newDailyNeeds = dailyNeeds - (ob.amount / 30);
      const newFreedomDays = newDailyNeeds > 0 && dailyPassive > 0 ? dailyPassive / newDailyNeeds : 0;
      const delta = newFreedomDays - freedomDays;

      impacts[ob.id] = {
        freedomDelta: delta,
        newFreedomDays: newFreedomDays,
        yearlyAmount: ob.amount * 12,
        percentOfNeeds: totalMonthlyNeeds > 0 ? (ob.amount / totalMonthlyNeeds) * 100 : 0,
      };
    }

    return impacts;
  }, [obligations, debts, freedom]);

  // ── Audit summary ──
  const auditSummary = useMemo(() => {
    const cuttable = obligations.filter(o => auditRatings[o.id] === 'cuttable');
    const niceToHave = obligations.filter(o => auditRatings[o.id] === 'nice_to_have');
    const unreviewed = obligations.filter(o => !auditRatings[o.id] || auditRatings[o.id] === 'unreviewed');
    const reviewed = obligations.filter(o => auditRatings[o.id] && auditRatings[o.id] !== 'unreviewed');

    const cuttableTotal = cuttable.reduce((s, o) => s + o.amount, 0);
    const niceToHaveTotal = niceToHave.reduce((s, o) => s + o.amount, 0);
    const cuttableFreedomGain = cuttable.reduce((s, o) => s + (obligationImpacts[o.id]?.freedomDelta || 0), 0);

    return { cuttable, niceToHave, unreviewed, reviewed, cuttableTotal, niceToHaveTotal, cuttableFreedomGain };
  }, [obligations, auditRatings, obligationImpacts]);

  const setRating = (obId: string, level: NecessityLevel) => {
    setAuditRatings(prev => ({ ...prev, [obId]: level }));
  };

  const handleCutAll = () => {
    auditSummary.cuttable.forEach(o => removeObligation(o.id));
    setAuditRatings(prev => {
      const next = { ...prev };
      auditSummary.cuttable.forEach(o => delete next[o.id]);
      return next;
    });
  };

  const paymentStatus = useMemo(() =>
    getMonthlyPaymentStatus(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );
  const paymentEvents = useMemo(() =>
    getPaymentEventsForMonth(obligations, debts, bankAccounts, currentYear, currentMonth),
    [obligations, debts, bankAccounts, currentYear, currentMonth]
  );

  const handleTogglePaid = (eventId: string, isPaid: boolean) => {
    if (eventId.startsWith('obl_')) toggleObligationPaid(eventId.replace('obl_', ''));
    else if (eventId.startsWith('debt_')) toggleDebtPaid(eventId.replace('debt_', ''));
  };

  const handleAddObligation = () => {
    if (!name || !amount) return;
    addObligation({
      id: Date.now().toString(), name, payee: payee || 'Various',
      amount: parseFloat(amount), category: 'other', isRecurring: true,
      dueDate: dueDate ? parseInt(dueDate) : 1,
      bankAccountId: accountId || undefined,
      ...(transactionCategory && { transactionCategory }),
    });
    setName(''); setPayee(''); setAmount(''); setAccountId(''); setDueDate('');
    setTransactionCategory('');
    setShowAddModal(false);
  };

  const handleEditObligation = (obligation: Obligation) => {
    setEditingObligation(obligation);
    setName(obligation.name); setPayee(obligation.payee);
    setAmount(obligation.amount.toString());
    setAccountId(obligation.bankAccountId || '');
    setDueDate(obligation.dueDate?.toString() || '');
    setTransactionCategory(obligation.transactionCategory || '');
    setShowAddModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingObligation || !name || !amount) return;
    updateObligation(editingObligation.id, {
      name, payee: payee || 'Various', amount: parseFloat(amount),
      bankAccountId: accountId || undefined,
      dueDate: dueDate ? parseInt(dueDate) : undefined,
      transactionCategory: transactionCategory || undefined,
    });
    setEditingObligation(null); setName(''); setPayee(''); setAmount('');
    setAccountId(''); setDueDate(''); setTransactionCategory(''); setShowAddModal(false);
  };

  const handleCloseModal = () => {
    setEditingObligation(null); setName(''); setPayee(''); setAmount('');
    setAccountId(''); setDueDate(''); setTransactionCategory(''); setShowAddModal(false);
  };

  const monthlyTotal = obligations.reduce((sum, o) => sum + o.amount, 0);

  return (
    <View style={s.container}>
      <ScrollView style={s.scrollView}>
        <PaymentStatusBanner status={paymentStatus} onShowCalendar={() => setShowCalendar(true)} />

        {/* Summary */}
        <LinearGradient colors={T.gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryBox, { borderColor: T.gold + '80' }]}>
          <Text style={s.summaryLabel}>Total Monthly Obligations</Text>
          <Text style={s.summaryValue}>${monthlyTotal.toLocaleString()}</Text>
          <Text style={s.summaryYearly}>${(monthlyTotal * 12).toLocaleString()}/year</Text>
        </LinearGradient>

        {/* List */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your Obligations</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.auditToggle, auditMode && s.auditToggleActive]}
                onPress={() => { setAuditMode(!auditMode); setExpandedAuditId(null); }}>
                <Text style={[s.auditToggleText, auditMode && s.auditToggleTextActive]}>
                  {auditMode ? '✓ Auditing' : '🔍 Audit'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addButton} onPress={() => setShowAddModal(true)}>
                <Text style={s.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Audit Summary Banner ── */}
          {auditMode && auditSummary.reviewed.length > 0 && (
            <LinearGradient colors={['#1a2a1a', '#0e1e0e', '#0a0e1a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.auditBanner}>
              <Text style={s.auditBannerTitle}>📋 Audit Progress</Text>
              <View style={s.auditProgressRow}>
                <View style={s.auditProgressBarBg}>
                  <View style={[s.auditProgressBarFill, { width: `${(auditSummary.reviewed.length / obligations.length) * 100}%` }]} />
                </View>
                <Text style={s.auditProgressText}>{auditSummary.reviewed.length}/{obligations.length}</Text>
              </View>

              <View style={s.auditStatsRow}>
                <View style={s.auditStat}>
                  <Text style={[s.auditStatValue, { color: '#22c55e' }]}>{auditSummary.cuttable.length}</Text>
                  <Text style={s.auditStatLabel}>Can Cut</Text>
                </View>
                <View style={s.auditStat}>
                  <Text style={[s.auditStatValue, { color: '#eab308' }]}>{auditSummary.niceToHave.length}</Text>
                  <Text style={s.auditStatLabel}>Nice to Have</Text>
                </View>
                <View style={s.auditStat}>
                  <Text style={[s.auditStatValue, { color: '#6b7280' }]}>{auditSummary.unreviewed.length}</Text>
                  <Text style={s.auditStatLabel}>Unreviewed</Text>
                </View>
              </View>

              {auditSummary.cuttableTotal > 0 && (
                <View style={s.auditSavings}>
                  <View>
                    <Text style={s.auditSavingsLabel}>If you cut everything marked "Cut This":</Text>
                    <Text style={s.auditSavingsValue}>
                      Save ${auditSummary.cuttableTotal.toFixed(0)}/mo · ${(auditSummary.cuttableTotal * 12).toLocaleString()}/yr
                    </Text>
                    <Text style={s.auditSavingsFreedom}>
                      +{auditSummary.cuttableFreedomGain.toFixed(1)} days of freedom
                    </Text>
                  </View>
                  <TouchableOpacity style={s.cutAllBtn} onPress={handleCutAll}>
                    <Text style={s.cutAllBtnText}>✂️ Cut All</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          )}

          {obligations.length === 0 ? (
            <EmptyStateCard category="obligations" onAction={() => setShowAddModal(true)} />
          ) : (
            obligations.slice().sort((a, b) => {
              // In audit mode, sort unreviewed first
              if (auditMode) {
                const aRating = auditRatings[a.id] || 'unreviewed';
                const bRating = auditRatings[b.id] || 'unreviewed';
                if (aRating === 'unreviewed' && bRating !== 'unreviewed') return -1;
                if (aRating !== 'unreviewed' && bRating === 'unreviewed') return 1;
              }
              return (a.dueDate ?? 999) - (b.dueDate ?? 999);
            }).map((ob) => {
              const rating = auditRatings[ob.id] || 'unreviewed';
              const ratingMeta = NECESSITY_META[rating];
              const impact = obligationImpacts[ob.id];
              const isExpanded = expandedAuditId === ob.id;
              const category = ob.category || 'other';
              const questions = CHALLENGE_QUESTIONS[category] || CHALLENGE_QUESTIONS.other;

              return (
              <TouchableOpacity key={ob.id} onPress={() => auditMode ? setExpandedAuditId(isExpanded ? null : ob.id) : handleEditObligation(ob)}>
                <LinearGradient colors={T.gradients.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[
                    s.obligationCard,
                    { borderColor: auditMode ? ratingMeta.color + '60' : T.gold + '40' },
                    auditMode && rating === 'cuttable' && s.obligationCardCuttable,
                  ]}>
                  <View style={s.obligationHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.obligationName}>{ob.name}</Text>
                        {auditMode && (
                          <View style={[s.ratingBadge, { backgroundColor: ratingMeta.color + '20', borderColor: ratingMeta.color + '60' }]}>
                            <Text style={[s.ratingBadgeText, { color: ratingMeta.color }]}>{ratingMeta.emoji} {ratingMeta.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.obligationPayee}>Paid to: {ob.payee}</Text>
                      {ob.bankAccountId ? (
                        <Text style={s.obligationAccount}>
                          💳 {bankAccounts.find(a => a.id === ob.bankAccountId)?.name || 'Unknown'}
                        </Text>
                      ) : (
                        <Text style={s.obligationWarning}>⚠️ No account assigned</Text>
                      )}
                      {ob.dueDate && (
                        <Text style={s.obligationDueDate}>
                          📅 Due on the {ob.dueDate}{getDaySuffix(ob.dueDate)} of each month
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeObligation(ob.id); }} style={{ padding: 4 }}>
                      <Text style={s.deleteButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.obligationAmount}>${ob.amount.toFixed(2)}/month</Text>
                    {auditMode && impact && (
                      <Text style={s.freedomChip}>
                        +{impact.freedomDelta.toFixed(1)}d freedom if cut
                      </Text>
                    )}
                  </View>

                  {/* ── Audit Expanded Section ── */}
                  {auditMode && isExpanded && (
                    <View style={s.auditExpanded}>
                      {/* Freedom impact */}
                      <View style={s.auditImpactBox}>
                        <Text style={s.auditImpactTitle}>💡 What cutting this means</Text>
                        <View style={s.auditImpactRow}>
                          <View style={s.auditImpactStat}>
                            <Text style={s.auditImpactValue}>${ob.amount.toFixed(0)}/mo</Text>
                            <Text style={s.auditImpactLabel}>Saved Monthly</Text>
                          </View>
                          <View style={s.auditImpactStat}>
                            <Text style={s.auditImpactValue}>${(ob.amount * 12).toLocaleString()}/yr</Text>
                            <Text style={s.auditImpactLabel}>Saved Yearly</Text>
                          </View>
                          <View style={s.auditImpactStat}>
                            <Text style={[s.auditImpactValue, { color: '#22c55e' }]}>+{impact?.freedomDelta.toFixed(1)}d</Text>
                            <Text style={s.auditImpactLabel}>More Freedom</Text>
                          </View>
                        </View>
                        <Text style={s.auditImpactPercent}>
                          This is {impact?.percentOfNeeds.toFixed(1)}% of your total monthly needs
                        </Text>
                      </View>

                      {/* Challenge questions */}
                      <View style={s.auditQuestions}>
                        <Text style={s.auditQuestionsTitle}>🤔 Ask yourself...</Text>
                        {questions.map((q, i) => (
                          <View key={i} style={s.auditQuestionRow}>
                            <Text style={s.auditQuestionBullet}>•</Text>
                            <Text style={s.auditQuestionText}>{q}</Text>
                          </View>
                        ))}
                        <Text style={s.auditQuestionPrompt}>
                          If you wouldn't sign up for this again today at ${ob.amount.toFixed(0)}/mo, it might be time to cut it.
                        </Text>
                      </View>

                      {/* Rating buttons */}
                      <Text style={s.auditRateTitle}>Rate this obligation:</Text>
                      <View style={s.auditRateGrid}>
                        {(['essential', 'important', 'nice_to_have', 'cuttable'] as NecessityLevel[]).map(level => {
                          const meta = NECESSITY_META[level];
                          const isSelected = rating === level;
                          return (
                            <TouchableOpacity key={level}
                              style={[s.auditRateBtn, isSelected && { borderColor: meta.color, backgroundColor: meta.color + '15' }]}
                              onPress={() => setRating(ob.id, level)}>
                              <Text style={s.auditRateEmoji}>{meta.emoji}</Text>
                              <Text style={[s.auditRateBtnLabel, isSelected && { color: meta.color, fontFamily: T.fontBold }]}>{meta.label}</Text>
                              <Text style={s.auditRateBtnDesc}>{meta.description}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Quick actions */}
                      {rating === 'cuttable' && (
                        <TouchableOpacity style={s.cutBtn} onPress={() => { removeObligation(ob.id); setExpandedAuditId(null); }}>
                          <Text style={s.cutBtnText}>✂️ Cut this — save ${ob.amount.toFixed(0)}/month</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Tap hint in audit mode */}
                  {auditMode && !isExpanded && (
                    <Text style={s.auditTapHint}>{rating === 'unreviewed' ? 'Tap to review →' : 'Tap to change rating →'}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
            })
          )}

          {/* Calendar Modal */}
          <Modal visible={showCalendar} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <PaymentCalendar year={currentYear} month={currentMonth} events={paymentEvents}
                  onDayPress={(day) => { setSelectedDay(day); setShowCalendar(false); }} />
                <TouchableOpacity onPress={() => setShowCalendar(false)}><Text style={{ color: T.gold, fontFamily: T.fontSemiBold, textAlign: 'center', padding: 16 }}>Close</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Day Detail Modal */}
          <Modal visible={selectedDay !== null} animationType="slide" transparent>
            <View style={s.modalOverlay}>
              {selectedDay !== null && (
                <DayPaymentsList day={selectedDay} month={currentMonth} year={currentYear}
                  events={paymentEvents.filter(e => e.dueDate.getDate() === selectedDay)}
                  onTogglePaid={handleTogglePaid} onClose={() => setSelectedDay(null)} />
              )}
            </View>
          </Modal>
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>{editingObligation ? 'Edit Obligation' : 'Add Obligation'}</Text>

              <Text style={s.label}>Name</Text>
              <TextInput style={s.modalInput} placeholder="e.g., Rent, Netflix, Car Payment" placeholderTextColor="#555" value={name} onChangeText={setName} />

              <Text style={s.label}>Who are you paying?</Text>
              <TextInput style={s.modalInput} placeholder="e.g., XYZ Financial, Landlord" placeholderTextColor="#555" value={payee} onChangeText={setPayee} />

              <Text style={s.label}>Monthly Amount</Text>
              <View style={s.inputContainer}>
                <Text style={s.currencySymbol}>$</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                <Text style={s.period}>/month</Text>
              </View>

              <Text style={s.label}>Due Day of Month (Optional)</Text>
              <TextInput style={s.modalInput} placeholder="e.g., 1, 15" placeholderTextColor="#555" keyboardType="numeric" value={dueDate} onChangeText={setDueDate} />

              <ObligationCategoryPicker value={transactionCategory} onChange={setTransactionCategory} />

              <Text style={s.label}>Paid From (Optional)</Text>
              {bankAccounts.length === 0 ? (
                <Text style={s.noAccountsWarning}>⚠️ No bank accounts added yet</Text>
              ) : (
                <View style={s.accountList}>
                  {bankAccounts.map((acct) => (
                    <TouchableOpacity key={acct.id}
                      style={[s.accountOption, accountId === acct.id && s.accountOptionActive]}
                      onPress={() => setAccountId(acct.id)}>
                      <View>
                        <Text style={[s.accountOptionName, accountId === acct.id && s.accountOptionNameActive]}>{acct.name}</Text>
                        <Text style={s.accountOptionSub}>{acct.institution} · ${(acct.currentBalance ?? 0).toLocaleString()}</Text>
                      </View>
                      {accountId === acct.id && <Text style={s.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={s.modalButtons}>
                <TouchableOpacity style={s.modalCancelButton} onPress={handleCloseModal}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalAddButton, (!name || !amount) && s.modalAddButtonDisabled]}
                  onPress={editingObligation ? handleSaveEdit : handleAddObligation}
                  disabled={!name || !amount}>
                  <Text style={s.modalAddText}>{editingObligation ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Kudos Modal ── */}
      <Modal visible={!!kudos} transparent animationType="fade" onRequestClose={() => setKudos(null)}>
        <View style={s.kudosOverlay}>
          <LinearGradient colors={['#0f1322', '#1a1f2e']} style={s.kudosCard}>
            <Text style={s.kudosEmoji}>🎉</Text>
            <Text style={s.kudosTitle}>Nice Cut!</Text>
            <Text style={s.kudosSaved}>
              -${kudos?.saved.toFixed(0)}/mo
            </Text>
            <Text style={s.kudosBody}>
              You just freed up ${kudos?.saved.toFixed(0)} per month.{'\n'}
              That's ${((kudos?.saved || 0) * 12).toLocaleString()}/year back in your pocket.
            </Text>
            <Text style={s.kudosNewTotal}>
              New monthly obligations: ${kudos?.newTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <TouchableOpacity style={s.kudosBtn} onPress={() => setKudos(null)}>
              <Text style={s.kudosBtnText}>Keep Going</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },

  summaryBox: { ...T.cardBase, borderWidth: 1.5, padding: 20 },
  summaryLabel: { fontSize: 12, color: T.gold + 'cc', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: T.fontBold },
  summaryValue: { fontSize: 34, color: T.gold, fontFamily: T.fontExtraBold },
  summaryYearly: { fontSize: 14, color: T.textMuted, marginTop: 6, fontFamily: T.fontRegular },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  addButton: { backgroundColor: T.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm },
  addButtonText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMedium },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center', fontFamily: T.fontRegular },

  obligationCard: { ...T.cardBase, borderLeftWidth: 4, borderLeftColor: T.gold },
  obligationCardCuttable: { borderLeftColor: '#22c55e', opacity: 0.85 },
  obligationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  obligationName: { fontSize: 18, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontBold },
  obligationPayee: { fontSize: 14, color: T.textSecondary, fontFamily: T.fontRegular },
  obligationAccount: { fontSize: 12, color: T.green, marginTop: 4, fontFamily: T.fontMedium },
  obligationWarning: { fontSize: 12, color: T.orange, marginTop: 4, fontFamily: T.fontMedium },
  obligationDueDate: { fontSize: 12, color: T.blue, marginTop: 4, fontFamily: T.fontMedium },
  obligationAmount: { fontSize: 18, color: T.gold, fontFamily: T.fontExtraBold },
  deleteButton: { fontSize: 20, color: T.redBright, padding: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 24, color: T.gold, marginBottom: 20, fontFamily: T.fontExtraBold },
  label: { fontSize: 15, color: T.textPrimary, marginBottom: 8, marginTop: 14, fontFamily: T.fontBold },
  modalInput: { backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border, fontFamily: T.fontRegular },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: T.border },
  currencySymbol: { fontSize: 20, color: T.gold, marginRight: 8, fontFamily: T.fontBold },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16, fontFamily: T.fontSemiBold },
  period: { fontSize: 14, color: T.textMuted, marginLeft: 8, fontFamily: T.fontRegular },
  helperText: { fontSize: 13, color: T.textMuted, marginBottom: 8, marginTop: -4, fontFamily: T.fontRegular },

  noAccountsWarning: { fontSize: 14, color: T.orange, padding: 12, backgroundColor: '#2a1a1e', borderRadius: T.radius.sm, marginTop: 4, fontFamily: T.fontMedium },
  accountList: { gap: 8, marginBottom: 8 },
  accountOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  accountOptionActive: { borderColor: T.gold, backgroundColor: '#2a2620' },
  accountOptionName: { fontSize: 15, color: T.textPrimary, marginBottom: 2, fontFamily: T.fontMedium },
  accountOptionNameActive: { color: T.gold, fontFamily: T.fontBold },
  accountOptionSub: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular },
  checkMark: { fontSize: 18, color: T.gold, fontFamily: T.fontBold },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancelButton: { flex: 1, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, alignItems: 'center' },
  modalCancelText: { color: T.textSecondary, fontSize: 16, fontFamily: T.fontMedium },
  modalAddButton: { flex: 1, padding: 16, borderRadius: T.radius.md, backgroundColor: T.gold, alignItems: 'center' },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: T.bg, fontSize: 16, fontFamily: T.fontBold },

  // ── Audit Mode ──
  auditToggle: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.sm, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  auditToggleActive: { borderColor: '#22c55e', backgroundColor: '#22c55e20' },
  auditToggleText: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium },
  auditToggleTextActive: { color: '#22c55e', fontFamily: T.fontBold },

  // Rating badge
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  ratingBadgeText: { fontSize: 10, fontFamily: T.fontSemiBold },

  // Freedom chip
  freedomChip: { fontSize: 12, color: '#22c55e', fontFamily: T.fontSemiBold, backgroundColor: '#22c55e15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  // Audit banner
  auditBanner: { ...T.cardBase, borderWidth: 1.5, borderColor: '#22c55e40', padding: 18, marginBottom: 16 },
  auditBannerTitle: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontExtraBold, marginBottom: 12 },
  auditProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  auditProgressBarBg: { flex: 1, height: 8, backgroundColor: T.border, borderRadius: 4 },
  auditProgressBarFill: { height: 8, backgroundColor: '#22c55e', borderRadius: 4 },
  auditProgressText: { fontSize: 13, color: T.textMuted, fontFamily: T.fontSemiBold },
  auditStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  auditStat: { alignItems: 'center' },
  auditStatValue: { fontSize: 22, fontFamily: T.fontExtraBold },
  auditStatLabel: { fontSize: 11, color: T.textMuted, fontFamily: T.fontMedium, marginTop: 2 },
  auditSavings: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#22c55e10', borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: '#22c55e30' },
  auditSavingsLabel: { fontSize: 12, color: T.textMuted, fontFamily: T.fontRegular, marginBottom: 4 },
  auditSavingsValue: { fontSize: 16, color: '#22c55e', fontFamily: T.fontBold },
  auditSavingsFreedom: { fontSize: 13, color: '#22c55e', fontFamily: T.fontSemiBold, marginTop: 2 },
  cutAllBtn: { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: T.radius.sm },
  cutAllBtnText: { color: T.bg, fontFamily: T.fontBold, fontSize: 14 },

  // Audit expanded
  auditExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },

  // Impact box
  auditImpactBox: { backgroundColor: '#1a2a3a', borderRadius: T.radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#60a5fa30' },
  auditImpactTitle: { fontSize: 14, color: '#60a5fa', fontFamily: T.fontBold, marginBottom: 10 },
  auditImpactRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  auditImpactStat: { alignItems: 'center' },
  auditImpactValue: { fontSize: 18, color: T.textPrimary, fontFamily: T.fontExtraBold },
  auditImpactLabel: { fontSize: 10, color: T.textMuted, fontFamily: T.fontMedium, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  auditImpactPercent: { fontSize: 12, color: T.textMuted, textAlign: 'center', fontFamily: T.fontRegular },

  // Questions
  auditQuestions: { backgroundColor: '#2a1a2a', borderRadius: T.radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#c084fc30' },
  auditQuestionsTitle: { fontSize: 14, color: '#c084fc', fontFamily: T.fontBold, marginBottom: 10 },
  auditQuestionRow: { flexDirection: 'row', marginBottom: 8, paddingLeft: 4 },
  auditQuestionBullet: { fontSize: 14, color: '#c084fc', marginRight: 8, fontFamily: T.fontBold },
  auditQuestionText: { fontSize: 14, color: T.textSecondary, fontFamily: T.fontRegular, flex: 1, lineHeight: 20 },
  auditQuestionPrompt: { fontSize: 13, color: T.gold, fontFamily: T.fontMedium, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },

  // Rating grid
  auditRateTitle: { fontSize: 14, color: T.textPrimary, fontFamily: T.fontBold, marginBottom: 10 },
  auditRateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  auditRateBtn: { width: '47%' as any, padding: 12, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bgCard },
  auditRateEmoji: { fontSize: 20, marginBottom: 4 },
  auditRateBtnLabel: { fontSize: 13, color: T.textPrimary, fontFamily: T.fontMedium, marginBottom: 2 },
  auditRateBtnDesc: { fontSize: 10, color: T.textMuted, fontFamily: T.fontRegular, lineHeight: 14 },

  // Cut button
  cutBtn: { backgroundColor: '#22c55e', borderRadius: T.radius.md, padding: 14, alignItems: 'center' },
  cutBtnText: { color: T.bg, fontSize: 15, fontFamily: T.fontBold },

  // Tap hint
  auditTapHint: { fontSize: 11, color: T.textDim, marginTop: 8, fontFamily: T.fontRegular, textAlign: 'right' },

  // Category picker
  catPickerField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16, borderWidth: 1.5, borderColor: T.border },
  catPickerValue: { fontSize: 16, color: T.textPrimary, fontFamily: T.fontMedium },
  catPickerPlaceholder: { fontSize: 16, color: '#555', fontFamily: T.fontRegular },
  catPickerArrow: { fontSize: 12, color: T.textMuted },
  catModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  catModalContent: { backgroundColor: T.bg, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: 20, maxHeight: '70%' },
  catModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catModalTitle: { fontSize: 20, color: T.textPrimary, fontFamily: T.fontExtraBold },
  catModalClose: { fontSize: 22, color: T.textMuted, padding: 4 },
  catGroupHeader: { fontSize: 13, fontFamily: T.fontBold, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  catOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 4 },
  catOptionActive: { borderColor: T.gold, backgroundColor: T.gold + '15' },
  catOptionText: { fontSize: 15, color: T.textSecondary, fontFamily: T.fontMedium },
  catOptionTextActive: { color: T.textPrimary, fontFamily: T.fontBold },
  catOptionCheck: { fontSize: 16, fontFamily: T.fontBold },

  // Kudos modal
  kudosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  kudosCard: { borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#f4c43040', width: '100%', maxWidth: 360 },
  kudosEmoji: { fontSize: 48, marginBottom: 8 },
  kudosTitle: { fontSize: 26, fontFamily: T.fontExtraBold, color: '#f4c430', marginBottom: 4 },
  kudosSaved: { fontSize: 32, fontFamily: T.fontExtraBold, color: '#22c55e', marginBottom: 12 },
  kudosBody: { fontSize: 15, color: T.textSecondary, fontFamily: T.fontRegular, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  kudosNewTotal: { fontSize: 13, color: T.textMuted, fontFamily: T.fontMedium, marginBottom: 20 },
  kudosBtn: { backgroundColor: '#f4c430', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  kudosBtnText: { fontSize: 16, fontFamily: T.fontBold, color: '#0a0e1a' },
});
