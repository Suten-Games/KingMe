// src/components/business/BusinessModals.tsx
// All modals for the Business Dashboard, extracted for maintainability

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseCSVTransactions } from '../../utils/csvBankImport';
import { useStore } from '../../store/useStore';
import { parseNumber } from '../../utils/parseNumber';
import type { BankTransaction } from '../../types/bankTransactionTypes';
import {
  type BusinessData, type BusinessInfo, type EntityType,
  ENTITY_LABELS, EXPENSE_CATEGORIES, DEFAULT_INFO,
} from '../../types/businessTypes';

// ─── Shared modal styles ────────────────────────────────────────────────────

export const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  content: { backgroundColor: '#1a1f2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 12, color: '#888', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#141825', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#2a2f3e', marginBottom: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#141825', borderWidth: 1, borderColor: '#2a2f3e' },
  pillActive: { backgroundColor: '#f4c43020', borderColor: '#f4c430' },
  pillText: { fontSize: 12, color: '#888', fontWeight: '600' },
  pillTextActive: { color: '#f4c430' },
  goldBtn: { backgroundColor: '#f4c430', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2f3e', alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#888', fontWeight: '700' },
  save: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f4c430', alignItems: 'center' },
  saveText: { fontSize: 15, color: '#0a0e1a', fontWeight: '800' },
  card: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  descText: { fontSize: 13, color: '#a0a0a0', lineHeight: 20 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1f2e', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#2a2f3e' },
  expName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  expMeta: { fontSize: 11, color: '#888', marginTop: 1 },
  expAmt: { fontSize: 14, fontWeight: '700', color: '#fbbf24' },
  muted: { fontSize: 13, color: '#666' },
});


// ─── Setup / Edit Business ──────────────────────────────────────────────────

export function SetupModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [entity, setEntity] = useState<EntityType>('llc');

  useEffect(() => {
    if (visible) { setName(data.businessName); setDesc(data.businessDescription || ''); setEntity(data.entityType); }
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ businessName: name.trim(), businessDescription: desc.trim(), entityType: entity });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (data.businessName) onClose(); }}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <Text style={ms.title}>{data.businessName ? 'Edit Business' : 'Set Up Your Business'}</Text>
          <Text style={ms.sub}>This information is only stored on your device</Text>
          <Text style={ms.label}>Business Name</Text>
          <TextInput style={ms.input} placeholder="e.g. Suten LLC, My Consulting" placeholderTextColor="#666" value={name} onChangeText={setName} />
          <Text style={ms.label}>Description</Text>
          <TextInput style={[ms.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What does your business do? (optional)" placeholderTextColor="#666" value={desc} onChangeText={setDesc} multiline numberOfLines={4} />
          <Text style={ms.label}>Entity Type</Text>
          <View style={ms.pillRow}>
            {(Object.entries(ENTITY_LABELS) as [EntityType, string][]).map(([key, label]) => (
              <TouchableOpacity key={key} style={[ms.pill, entity === key && ms.pillActive]} onPress={() => setEntity(key)}>
                <Text style={[ms.pillText, entity === key && ms.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={ms.btns}>
            {data.businessName ? <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[ms.save, { flex: data.businessName ? 1 : undefined }]} onPress={handleSave}><Text style={ms.saveText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Wallet ─────────────────────────────────────────────────────────────────

export function WalletModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [input, setInput] = useState('');
  useEffect(() => { if (visible) setInput(data.referralWallet || ''); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <Text style={ms.title}>Referral Wallet Address</Text>
          <Text style={ms.sub}>The wallet receiving swap referral fees</Text>
          <TextInput style={ms.input} placeholder="Solana wallet address" placeholderTextColor="#666" value={input} onChangeText={setInput} autoCapitalize="none" />
          <View style={ms.btns}>
            <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={ms.save} onPress={() => { if (input && input.length >= 30) { onSave({ referralWallet: input.trim() }); onClose(); } }}>
              <Text style={ms.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Bank Account ───────────────────────────────────────────────────────────

export function BankModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [name, setName] = useState('');
  const [inst, setInst] = useState('');
  const [bal, setBal] = useState('');
  useEffect(() => {
    if (visible && data.bankAccount) { setName(data.bankAccount.name); setInst(data.bankAccount.institution); setBal(data.bankAccount.balance.toString()); }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <Text style={ms.title}>Business Bank Account</Text>
          <TextInput style={ms.input} placeholder="Account name" placeholderTextColor="#666" value={name} onChangeText={setName} />
          <TextInput style={ms.input} placeholder="Institution (e.g. Mercury, Chase)" placeholderTextColor="#666" value={inst} onChangeText={setInst} />
          <TextInput style={ms.input} placeholder="Current balance" placeholderTextColor="#666" keyboardType="numeric" value={bal} onChangeText={setBal} />
          <View style={ms.btns}>
            <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={ms.save} onPress={() => {
              if (!name || !bal) return;
              onSave({ bankAccount: { name, institution: inst, balance: parseNumber(bal), lastUpdated: new Date().toISOString() } });
              onClose();
            }}><Text style={ms.saveText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Expense ────────────────────────────────────────────────────────────────

export function ExpenseModal({ visible, onClose, data, onSave, editId }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void; editId: string | null;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [freq, setFreq] = useState<'monthly' | 'annual' | 'one-time'>('monthly');
  const [cat, setCat] = useState('hosting');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && editId) {
      const e = data.expenses.find(x => x.id === editId);
      if (e) { setName(e.name); setAmount(e.amount.toString()); setFreq(e.frequency); setCat(e.category); setNotes(e.notes || ''); }
    } else if (visible) { setName(''); setAmount(''); setFreq('monthly'); setCat('hosting'); setNotes(''); }
  }, [visible, editId]);

  const handleSave = () => {
    if (!name || !amount) return;
    const expense = { id: editId || Date.now().toString(), name, amount: parseNumber(amount), frequency: freq, category: cat as any, notes: notes || undefined };
    const newExpenses = editId ? data.expenses.map(e => e.id === editId ? expense : e) : [...data.expenses, expense];
    onSave({ expenses: newExpenses });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <ScrollView>
            <Text style={ms.title}>{editId ? 'Edit Expense' : 'Add Expense'}</Text>
            <TextInput style={ms.input} placeholder="Expense name (e.g. Vercel Pro)" placeholderTextColor="#666" value={name} onChangeText={setName} />
            <TextInput style={ms.input} placeholder="Amount" placeholderTextColor="#666" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <Text style={ms.label}>Category</Text>
            <View style={ms.pillRow}>
              {Object.entries(EXPENSE_CATEGORIES).map(([key, { emoji, label }]) => (
                <TouchableOpacity key={key} style={[ms.pill, cat === key && ms.pillActive]} onPress={() => setCat(key)}>
                  <Text style={[ms.pillText, cat === key && ms.pillTextActive]}>{emoji} {label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={ms.label}>Frequency</Text>
            <View style={ms.pillRow}>
              {(['monthly', 'annual', 'one-time'] as const).map(f => (
                <TouchableOpacity key={f} style={[ms.pill, freq === f && ms.pillActive]} onPress={() => setFreq(f)}>
                  <Text style={[ms.pillText, freq === f && ms.pillTextActive]}>{f === 'one-time' ? 'One-time' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={ms.input} placeholder="Notes (optional)" placeholderTextColor="#666" value={notes} onChangeText={setNotes} />
            <View style={ms.btns}>
              <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={ms.save} onPress={handleSave}><Text style={ms.saveText}>{editId ? 'Save' : 'Add'}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// ─── Distribution ───────────────────────────────────────────────────────────

export function DistributionModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (visible) { setAmount(''); setNotes(''); } }, [visible]);

  const handleRecord = () => {
    const val = parseNumber(amount);
    if (!val || val <= 0) return;
    const dist = { id: Date.now().toString(), amount: val, date: new Date().toISOString(), notes: notes || undefined };
    onSave({ distributions: [...data.distributions, dist] });
    onClose();
    Alert.alert('Distribution Recorded', `$${val.toLocaleString()} distribution from ${data.businessName}.\n\nAdd to personal income?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => {
        const store = useStore.getState();
        useStore.setState({ income: { ...store.income, otherIncome: (store.income.otherIncome || 0) + val } });
      }},
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <Text style={ms.title}>Record Distribution</Text>
          <Text style={ms.sub}>A distribution is money transferred from {data.businessName || 'your business'} to your personal accounts</Text>
          <TextInput style={ms.input} placeholder="Amount" placeholderTextColor="#666" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={ms.input} placeholder="Notes (optional)" placeholderTextColor="#666" value={notes} onChangeText={setNotes} />
          <View style={ms.btns}>
            <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={ms.save} onPress={handleRecord}><Text style={ms.saveText}>Record</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Contribution ───────────────────────────────────────────────────────────

export function ContributionModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (visible) { setAmount(''); setNotes(''); } }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <Text style={ms.title}>Record Capital Contribution</Text>
          <Text style={ms.sub}>Money transferred from your personal accounts to fund {data.businessName || 'your business'}</Text>
          <TextInput style={ms.input} placeholder="Amount" placeholderTextColor="#666" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={ms.input} placeholder="Notes (optional, e.g. 'From Chase checking')" placeholderTextColor="#666" value={notes} onChangeText={setNotes} />
          <View style={ms.btns}>
            <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={ms.save} onPress={() => {
              const val = parseNumber(amount);
              if (!val || val <= 0) return;
              onSave({ contributions: [...(data.contributions || []), { id: Date.now().toString(), amount: val, date: new Date().toISOString(), notes: notes || undefined }] });
              onClose();
            }}><Text style={ms.saveText}>Record</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Business Info ──────────────────────────────────────────────────────────

export function InfoModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [form, setForm] = useState<BusinessInfo>(DEFAULT_INFO);
  useEffect(() => { if (visible) setForm(data.info || DEFAULT_INFO); }, [visible]);

  const fields: { key: keyof BusinessInfo; label: string; placeholder: string; kb?: 'numeric' }[] = [
    { key: 'ein', label: 'EIN', placeholder: 'XX-XXXXXXX', kb: 'numeric' },
    { key: 'stateOfFormation', label: 'State of Formation', placeholder: 'e.g. Delaware, Wyoming' },
    { key: 'formationDate', label: 'Formation Date', placeholder: 'e.g. January 2024' },
    { key: 'registeredAgent', label: 'Registered Agent', placeholder: 'e.g. Northwest Registered Agent' },
    { key: 'taxStatus', label: 'Tax Status', placeholder: 'e.g. S-Corp election, Single-member LLC' },
    { key: 'fiscalYearEnd', label: 'Fiscal Year End', placeholder: 'e.g. December' },
    { key: 'businessAddress', label: 'Business Address', placeholder: 'Principal office address' },
    { key: 'members', label: 'Members / Owners', placeholder: 'e.g. John Doe (100%)' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <ScrollView>
            <Text style={ms.title}>Business Information</Text>
            <Text style={ms.sub}>Stored locally on your device only</Text>
            {fields.map(f => (
              <React.Fragment key={f.key}>
                <Text style={ms.label}>{f.label}</Text>
                <TextInput style={ms.input} placeholder={f.placeholder} placeholderTextColor="#666"
                  value={form[f.key]} onChangeText={v => setForm({ ...form, [f.key]: v })}
                  keyboardType={f.kb as any} />
              </React.Fragment>
            ))}
            <View style={ms.btns}>
              <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={ms.save} onPress={() => { onSave({ info: form }); onClose(); }}><Text style={ms.saveText}>Save</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// ─── CSV Import ─────────────────────────────────────────────────────────────

export function ImportModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<{ transactions: BankTransaction[]; errors: string[]; summary: string } | null>(null);

  useEffect(() => { if (visible) { setCsvText(''); setPreview(null); } }, [visible]);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/csv', '*/*'] });
      if (result.canceled || !result.assets?.[0]) return;
      let text = '';
      if (Platform.OS === 'web') { text = await (await fetch(result.assets[0].uri)).text(); }
      else { text = await FileSystem.readAsStringAsync(result.assets[0].uri); }
      setCsvText(text);
      if (text.trim()) setPreview(parseCSVTransactions(text, `biz_${data.businessName}`));
    } catch { Alert.alert('Error', 'Failed to read file'); }
  };

  const handleParse = () => { if (csvText.trim()) setPreview(parseCSVTransactions(csvText, `biz_${data.businessName}`)); };

  const handleImport = () => {
    if (!preview) return;
    const existing = data.transactions || [];
    const keys = new Set(existing.map(t => `${t.date}|${t.description}|${t.amount}`));
    const newTxns = preview.transactions.filter(t => !keys.has(`${t.date}|${t.description}|${t.amount}`));
    onSave({ transactions: [...existing, ...newTxns] });
    Alert.alert('Imported', `${newTxns.length} new transactions added (${preview.transactions.length - newTxns.length} duplicates skipped)`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <ScrollView>
            <Text style={ms.title}>Import Business Transactions</Text>
            <Text style={ms.sub}>Upload a CSV from your business bank account. Supports Chase, BoA, Wells Fargo, Capital One, SoFi, and most standard CSVs.</Text>
            <TouchableOpacity style={ms.goldBtn} onPress={handlePick}><Text style={ms.saveText}>Choose CSV File</Text></TouchableOpacity>
            <Text style={ms.label}>Or paste CSV data</Text>
            <TextInput style={[ms.input, { height: 120, textAlignVertical: 'top' }]} placeholder="Paste CSV data here..." placeholderTextColor="#666" value={csvText} onChangeText={setCsvText} multiline />
            {csvText && !preview && <TouchableOpacity style={ms.save} onPress={handleParse}><Text style={ms.saveText}>Parse</Text></TouchableOpacity>}
            {preview && (
              <View style={{ marginTop: 12 }}>
                <Text style={[ms.expName, { marginBottom: 8 }]}>{preview.summary}</Text>
                {preview.errors.length > 0 && <Text style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{preview.errors.length} warning(s)</Text>}
              </View>
            )}
            <View style={ms.btns}>
              <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[ms.save, !preview && { opacity: 0.4 }]} onPress={handleImport} disabled={!preview}>
                <Text style={ms.saveText}>Import {preview ? preview.transactions.length : 0}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// ─── Reassign Personal Transactions ─────────────────────────────────────────

export function ReassignModal({ visible, onClose, data, onSave }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  onSave: (d: Partial<BusinessData>) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const bankAccounts = useStore(s => s.bankAccounts);
  const allTxns = useStore(s => s.bankTransactions || []);

  useEffect(() => { if (visible) setKeyword(''); }, [visible]);

  const matches = useMemo(() => {
    if (!keyword) return [];
    const kw = keyword.toLowerCase();
    return allTxns.filter(t => {
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      return cat.includes(kw) || desc.includes(kw) || notes.includes(kw);
    });
  }, [allTxns, keyword]);

  const handleReassign = () => {
    if (matches.length === 0) return;
    const existing = data.transactions || [];
    const keys = new Set(existing.map(t => `${t.date}|${t.description}|${t.amount}`));
    const newTxns = matches.filter(t => !keys.has(`${t.date}|${t.description}|${t.amount}`))
      .map(t => ({ ...t, bankAccountId: `biz_${data.businessName}`, importedFrom: 'reassigned' as const }));
    const total = newTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    onSave({ transactions: [...existing, ...newTxns] });
    Alert.alert(`${newTxns.length} Transactions Reassigned`,
      `$${total.toLocaleString()} in expenses moved to ${data.businessName}.\n\nConsider transferring this amount from your personal account to your business account to properly fund these expenses.`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.content}>
          <ScrollView>
            <Text style={ms.title}>Find Business Transactions</Text>
            <Text style={ms.sub}>Search your personal bank transactions by category or keyword to find business expenses you've been paying from personal accounts.</Text>
            <Text style={ms.label}>Category or keyword to search</Text>
            <TextInput style={ms.input} placeholder="e.g. suten biz, business, consulting" placeholderTextColor="#666" value={keyword} onChangeText={setKeyword} autoCapitalize="none" />
            <View style={[ms.card, { marginBottom: 12 }]}>
              <Text style={ms.descText}>{'\uD83D\uDCA1'} Tip: If you've been tagging business expenses with a custom category (e.g. "suten biz"), enter that here. If not, try keywords from the transaction descriptions.</Text>
            </View>
            {keyword.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={ms.expName}>Found {matches.length} matching transaction{matches.length !== 1 ? 's' : ''}</Text>
                {matches.length > 0 && (
                  <>
                    <Text style={[ms.expMeta, { marginTop: 4 }]}>
                      Total expenses: ${matches.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                    {matches.slice(0, 5).map(t => (
                      <View key={t.id} style={[ms.expRow, { marginTop: 6 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={ms.expName} numberOfLines={1}>{t.description}</Text>
                          <Text style={ms.expMeta}>{t.date} {'\u00B7'} {bankAccounts.find(a => a.id === t.bankAccountId)?.name || 'Unknown'}</Text>
                        </View>
                        <Text style={ms.expAmt}>${t.amount.toFixed(2)}</Text>
                      </View>
                    ))}
                    {matches.length > 5 && <Text style={[ms.muted, { marginTop: 6 }]}>+{matches.length - 5} more...</Text>}
                  </>
                )}
              </View>
            )}
            <View style={ms.btns}>
              <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[ms.save, matches.length === 0 && { opacity: 0.4 }]} onPress={handleReassign} disabled={matches.length === 0}>
                <Text style={ms.saveText}>Move {matches.length} to Business</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


// ─── AI Results ─────────────────────────────────────────────────────────────

export function AIModal({ visible, onClose, data, aiType, onGenerate, onExport }: {
  visible: boolean; onClose: () => void; data: BusinessData;
  aiType: 'business_plan' | 'tax_strategy' | 'expense_optimization';
  onGenerate: () => Promise<void>; onExport: (content: string, title: string) => void;
}) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible) { setResult(''); setLoading(false); } }, [visible]);

  const title = aiType === 'business_plan' ? 'Business Plan' : aiType === 'tax_strategy' ? 'Tax Strategy' : 'Expense Optimization';

  const handleGenerate = async () => {
    setLoading(true); setResult('');
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://kingme.money';
      // We need the financials - compute them from data
      const monthlyExp = data.expenses.reduce((sum, e) => {
        if (e.frequency === 'monthly') return sum + e.amount;
        if (e.frequency === 'annual') return sum + e.amount / 12;
        return sum;
      }, 0);
      const totalRev = data.referralBalance?.totalUSD || 0;
      const bankBal = data.bankAccount?.balance || 0;
      const totalDist = data.distributions.reduce((s, d) => s + d.amount, 0);
      const totalContrib = (data.contributions || []).reduce((s, c) => s + c.amount, 0);

      const input = {
        businessName: data.businessName,
        description: data.businessDescription,
        entityType: ENTITY_LABELS[data.entityType],
        ein: data.info?.ein,
        stateOfFormation: data.info?.stateOfFormation,
        members: data.info?.members,
        monthlyExpenses: monthlyExp,
        annualRevenue: totalRev * 12,
        bankBalance: bankBal,
        walletBalance: data.referralBalance?.totalUSD || 0,
        totalDistributions: totalDist,
        totalContributions: totalContrib,
        expenseBreakdown: data.expenses.map(e => ({ name: e.name, amount: e.amount, frequency: e.frequency })),
        transactionCount: (data.transactions || []).length,
      };
      const res = await fetch(`${API_BASE}/api/business/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, type: aiType }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setResult(json.content || 'No content returned');
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={[ms.content, { maxHeight: '90%' }]}>
          <ScrollView>
            <Text style={ms.title}>{title}</Text>
            <Text style={ms.sub}>
              {aiType === 'business_plan' ? 'AI-generated plan based on your financials'
                : aiType === 'tax_strategy' ? 'Tax insights for your business structure'
                : 'Ways to reduce costs and optimize spending'}
            </Text>
            {!result && !loading && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={ms.descText}>This will generate a {title.toLowerCase()} using your {data.businessName} financials and business info.</Text>
                {!data.businessDescription && <Text style={[ms.descText, { color: '#fbbf24', marginTop: 8 }]}>Add a business description first for better results.</Text>}
                <TouchableOpacity style={[ms.goldBtn, { marginTop: 16, width: '100%' }]} onPress={handleGenerate}><Text style={ms.saveText}>Generate</Text></TouchableOpacity>
              </View>
            )}
            {loading && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator color="#f4c430" size="large" />
                <Text style={[ms.muted, { marginTop: 12 }]}>Generating with Claude AI...</Text>
              </View>
            )}
            {result && !loading && (
              <>
                <View style={aiStyles.resultBox}><Text style={aiStyles.resultText}>{result}</Text></View>
                <TouchableOpacity style={[ms.goldBtn, { marginTop: 12 }]} onPress={() => onExport(result, title)}>
                  <Text style={ms.saveText}>Export PDF</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={ms.btns}>
              <TouchableOpacity style={ms.cancel} onPress={onClose}><Text style={ms.cancelText}>Close</Text></TouchableOpacity>
              {result && !loading && <TouchableOpacity style={ms.save} onPress={handleGenerate}><Text style={ms.saveText}>Regenerate</Text></TouchableOpacity>}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const aiStyles = StyleSheet.create({
  resultBox: { backgroundColor: '#141825', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#2a2f3e' },
  resultText: { fontSize: 13, color: '#d0d0d0', lineHeight: 20 },
});
