// app/divorce-simulator.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore, useFreedomScore } from '../src/store/useStore';

const STATE_RULES: Record<string, { alimonyPct: number; childBasePct: number; childAddPct: number; community: boolean; durMult: number }> = {
  AZ: { alimonyPct: 0.20, childBasePct: 0.20, childAddPct: 0.05, community: true, durMult: 0.33 },
  CA: { alimonyPct: 0.25, childBasePct: 0.25, childAddPct: 0.05, community: true, durMult: 0.50 },
  TX: { alimonyPct: 0.20, childBasePct: 0.20, childAddPct: 0.05, community: true, durMult: 0.25 },
  NY: { alimonyPct: 0.30, childBasePct: 0.17, childAddPct: 0.06, community: false, durMult: 0.40 },
  FL: { alimonyPct: 0.22, childBasePct: 0.20, childAddPct: 0.05, community: false, durMult: 0.33 },
  IL: { alimonyPct: 0.30, childBasePct: 0.20, childAddPct: 0.05, community: false, durMult: 0.33 },
  NV: { alimonyPct: 0.20, childBasePct: 0.18, childAddPct: 0.05, community: true, durMult: 0.33 },
  WA: { alimonyPct: 0.22, childBasePct: 0.20, childAddPct: 0.05, community: true, durMult: 0.33 },
  DEFAULT: { alimonyPct: 0.22, childBasePct: 0.20, childAddPct: 0.05, community: false, durMult: 0.33 },
};

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

export default function DivorceSimulator() {
  const router = useRouter();
  const assets = useStore(s => s.assets);
  const debts = useStore(s => s.debts);
  const bankAccounts = useStore(s => s.bankAccounts);

  const [st8, setSt8] = useState('AZ');
  const [myAge, setMyAge] = useState('');
  const [spouseAge, setSpouseAge] = useState('');
  const [married, setMarried] = useState('');
  const [numKids, setNumKids] = useState('0');
  const [kidAges, setKidAges] = useState('');
  const [myIncome, setMyIncome] = useState('');
  const [spouseIncome, setSpouseIncome] = useState('');
  const [totalAst, setTotalAst] = useState('');
  const [totalDbt, setTotalDbt] = useState('');
  const [retAccts, setRetAccts] = useState('');
  const [homeEq, setHomeEq] = useState('');
  const [showResults, setShowResults] = useState(false);

  const prefill = () => {
    const a = assets.reduce((s, x) => s + x.value, 0) + bankAccounts.reduce((s, b) => s + (b.currentBalance || 0), 0);
    const d = debts.reduce((s, x) => s + (x.balance || x.principal || 0), 0);
    const r = assets.filter(x => x.type === 'retirement').reduce((s, x) => s + x.value, 0);
    // Home equity = property value - mortgage balance (from asset metadata or matching debts)
    const realEstate = assets.filter(x => x.type === 'real_estate');
    const homeValue = realEstate.reduce((s, x) => s + x.value, 0);
    const mortgageFromAssets = realEstate.reduce((s, x) => s + ((x.metadata as any)?.mortgageBalance || 0), 0);
    const mortgageFromDebts = debts
      .filter(x => /mortgage|home.?loan/i.test(x.name))
      .reduce((s, x) => s + (x.balance || x.principal || 0), 0);
    const mortgage = mortgageFromAssets || mortgageFromDebts; // prefer asset metadata, fallback to debts
    const h = Math.max(0, homeValue - mortgage);
    setTotalAst(a.toFixed(0)); setTotalDbt(d.toFixed(0)); setRetAccts(r.toFixed(0)); setHomeEq(h.toFixed(0));
  };

  const results = useMemo(() => {
    if (!showResults) return null;
    const rules = STATE_RULES[st8] || STATE_RULES.DEFAULT;
    const mi = parseFloat(myIncome) || 0;
    const si = parseFloat(spouseIncome) || 0;
    const yrs = parseFloat(married) || 0;
    const kids = Math.min(parseInt(numKids) || 0, 5);
    const ast = parseFloat(totalAst) || 0;
    const dbt = parseFloat(totalDbt) || 0;
    const ret = parseFloat(retAccts) || 0;
    const home = parseFloat(homeEq) || 0;

    const gap = Math.abs(mi - si);
    const iHigher = mi >= si;

    // Alimony
    let alimonyAnnual = 0, alimonyDur = 0;
    if (gap > 20000 && yrs >= 3) {
      alimonyAnnual = Math.min(gap * rules.alimonyPct, Math.max(mi, si) * 0.40);
      alimonyDur = Math.max(1, Math.round(yrs * rules.durMult));
      if (yrs >= 20) alimonyDur = Math.max(alimonyDur, 10);
    }
    const alimonyMo = alimonyAnnual / 12;

    // Child support — only for minor children (under 18)
    let childMo = 0, childYrs = 0;
    if (kids > 0) {
      const ages = kidAges.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a) && a >= 0);
      const minorAges = ages.filter(a => a < 18);
      const minorCount = ages.length > 0 ? minorAges.length : kids; // if no ages entered, assume all are minors
      if (minorCount > 0) {
        const combined = mi + si;
        const pct = rules.childBasePct + (minorCount - 1) * rules.childAddPct;
        const total = combined * pct;
        childMo = combined > 0 ? (total * (mi / combined)) / 12 : 0;
        const youngest = minorAges.length > 0 ? Math.min(...minorAges) : 5;
        childYrs = Math.max(0, 18 - youngest);
      }
    }

    const net = ast - dbt;
    const assetLoss = net * 0.5;
    const retLoss = ret * 0.5;
    const homeLoss = home * 0.5;
    const legal = kids > 0 ? 25000 : 15000;

    const monthlyHit = (iHigher ? alimonyMo : 0) + childMo;
    const lifetime = (iHigher ? alimonyAnnual * alimonyDur : 0) + childMo * 12 * childYrs + assetLoss + legal;

    return {
      alimonyMo, alimonyAnnual, alimonyDur, iHigher, childMo, childYrs, kids,
      minorKids: kids > 0 ? (kidAges ? kidAges.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a) && a >= 0 && a < 18).length || kids : kids) : 0,
      assetLoss, retLoss, homeLoss, legal, monthlyHit, lifetime,
      community: rules.community,
      postIncome: (mi / 12) - monthlyHit,
      postAssets: ast * 0.5,
      pctToEx: mi > 0 ? (monthlyHit * 12 / mi) * 100 : 0,
    };
  }, [showResults, st8, myIncome, spouseIncome, married, numKids, kidAges, totalAst, totalDbt, retAccts, homeEq]);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <ScrollView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Divorce Simulator</Text>
        <Text style={s.sub}>Estimate the financial impact of separation</Text>

        <View style={s.disc}><Text style={s.discText}>⚠️ Rough estimates only. State laws vary. Judges have discretion. Consult a family law attorney for real numbers.</Text></View>

        <View style={s.sec}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.secTitle}>Your Situation</Text>
            <TouchableOpacity style={s.prefill} onPress={prefill}><Text style={s.prefillT}>📋 Fill from KingMe</Text></TouchableOpacity>
          </View>

          <Text style={s.lbl}>State</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
            {US_STATES.map(x => (
              <TouchableOpacity key={x} style={[s.chip, st8 === x && s.chipA]} onPress={() => setSt8(x)}>
                <Text style={[s.chipT, st8 === x && s.chipTA]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>
          {(STATE_RULES[st8] || STATE_RULES.DEFAULT).community && <Text style={s.note}>📌 {st8} is a community property state (50/50 split)</Text>}

          <View style={s.row}>
            <View style={s.half}><Text style={s.lbl}>Your Age</Text><TextInput style={s.inp} placeholder="42" placeholderTextColor="#666" keyboardType="numeric" value={myAge} onChangeText={setMyAge}/></View>
            <View style={s.half}><Text style={s.lbl}>Spouse Age</Text><TextInput style={s.inp} placeholder="39" placeholderTextColor="#666" keyboardType="numeric" value={spouseAge} onChangeText={setSpouseAge}/></View>
          </View>

          <Text style={s.lbl}>Years Married</Text>
          <TextInput style={s.inp} placeholder="15" placeholderTextColor="#666" keyboardType="numeric" value={married} onChangeText={setMarried}/>

          <View style={s.row}>
            <View style={s.half}><Text style={s.lbl}>Your Annual Income</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={myIncome} onChangeText={setMyIncome}/></View>
            <View style={s.half}><Text style={s.lbl}>Spouse Annual Income</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={spouseIncome} onChangeText={setSpouseIncome}/></View>
          </View>

          <Text style={s.lbl}>Number of Kids</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['0','1','2','3','4','5'].map(n => (
              <TouchableOpacity key={n} style={[s.kidC, numKids === n && s.kidCA]} onPress={() => setNumKids(n)}>
                <Text style={[s.kidT, numKids === n && s.kidTA]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {parseInt(numKids) > 0 && <>
            <Text style={s.lbl}>Kid Ages (comma separated)</Text>
            <TextInput style={s.inp} placeholder="4, 7, 12" placeholderTextColor="#666" value={kidAges} onChangeText={setKidAges}/>
          </>}
        </View>

        <View style={s.sec}>
          <Text style={s.secTitle}>Marital Assets & Debts</Text>
          <View style={s.row}>
            <View style={s.half}><Text style={s.lbl}>Total Assets</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={totalAst} onChangeText={setTotalAst}/></View>
            <View style={s.half}><Text style={s.lbl}>Total Debts</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={totalDbt} onChangeText={setTotalDbt}/></View>
          </View>
          <View style={s.row}>
            <View style={s.half}><Text style={s.lbl}>Retirement (401k/IRA)</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={retAccts} onChangeText={setRetAccts}/></View>
            <View style={s.half}><Text style={s.lbl}>Home Equity (value − mortgage)</Text><TextInput style={s.inp} placeholder="$0" placeholderTextColor="#666" keyboardType="numeric" value={homeEq} onChangeText={setHomeEq}/></View>
          </View>
        </View>

        <TouchableOpacity onPress={() => setShowResults(true)} disabled={!myIncome || !married} style={[!myIncome || !married ? { opacity: 0.4 } : {}]}>
          <LinearGradient colors={['#f87171', '#dc2626']} style={s.calcBtn}><Text style={s.calcT}>💔 Calculate Damage</Text></LinearGradient>
        </TouchableOpacity>

        {results && showResults && (
          <View style={{ gap: 16, marginTop: 16 }}>
            <LinearGradient colors={['#3a1010','#1a0808','#0e0404']} style={s.rCard}>
              <Text style={s.rTitle}>💸 Monthly Financial Hit</Text>
              <Text style={s.bigNum}>-{fmt(results.monthlyHit)}/mo</Text>
              {results.alimonyMo > 0 && <View style={s.rRow}><Text style={s.rLbl}>Alimony ({results.iHigher ? 'you pay' : 'you receive'})</Text><Text style={s.rVal}>{results.iHigher ? '-' : '+'}{fmt(results.alimonyMo)}/mo</Text></View>}
              {results.childMo > 0 && <View style={s.rRow}><Text style={s.rLbl}>Child support ({results.minorKids} minor{results.minorKids !== 1 ? 's' : ''})</Text><Text style={s.rVal}>-{fmt(results.childMo)}/mo</Text></View>}
            </LinearGradient>

            <LinearGradient colors={['#1a2040','#0e1020','#080810']} style={s.rCard}>
              <Text style={s.rTitle}>⏳ Duration & Totals</Text>
              {results.alimonyDur > 0 && <View style={s.rRow}><Text style={s.rLbl}>Alimony: {results.alimonyDur}yr</Text><Text style={s.rVal}>{fmt(results.alimonyAnnual * results.alimonyDur)}</Text></View>}
              {results.childYrs > 0 && <View style={s.rRow}><Text style={s.rLbl}>Child support: {results.childYrs}yr</Text><Text style={s.rVal}>{fmt(results.childMo * 12 * results.childYrs)}</Text></View>}
            </LinearGradient>

            <LinearGradient colors={['#2a1a10','#1a1008','#0e0804']} style={s.rCard}>
              <Text style={s.rTitle}>⚖️ Asset Division{results.community ? ' (Community Property)' : ''}</Text>
              <View style={s.rRow}><Text style={s.rLbl}>Net assets lost</Text><Text style={[s.rVal,{color:'#f87171'}]}>-{fmt(results.assetLoss)}</Text></View>
              {results.retLoss > 0 && <View style={s.rRow}><Text style={s.rLbl}>Retirement split (QDRO)</Text><Text style={[s.rVal,{color:'#f87171'}]}>-{fmt(results.retLoss)}</Text></View>}
              {results.homeLoss > 0 && <View style={s.rRow}><Text style={s.rLbl}>Home equity split</Text><Text style={[s.rVal,{color:'#f87171'}]}>-{fmt(results.homeLoss)}</Text></View>}
              <View style={s.rRow}><Text style={s.rLbl}>Estimated legal costs</Text><Text style={[s.rVal,{color:'#f87171'}]}>-{fmt(results.legal)}</Text></View>
            </LinearGradient>

            <LinearGradient colors={['#4a0a0a','#2a0808','#180404']} style={s.totalCard}>
              <Text style={s.totalLbl}>TOTAL ESTIMATED LIFETIME COST</Text>
              <Text style={s.totalVal}>{fmt(results.lifetime)}</Text>
              <Text style={s.totalSub}>{fmt(results.lifetime / 12)}/mo averaged over payment period</Text>
            </LinearGradient>

            <LinearGradient colors={['#0a1a2a','#081018','#040810']} style={s.rCard}>
              <Text style={s.rTitle}>🔮 Post-Divorce Picture</Text>
              <View style={s.rRow}><Text style={s.rLbl}>Take-home after payments</Text><Text style={s.rVal}>{fmt(results.postIncome)}/mo</Text></View>
              <View style={s.rRow}><Text style={s.rLbl}>Your share of assets</Text><Text style={s.rVal}>{fmt(results.postAssets)}</Text></View>
              <View style={s.rRow}><Text style={s.rLbl}>% of income to ex</Text><Text style={[s.rVal,{color:'#f87171'}]}>{results.pctToEx.toFixed(1)}%</Text></View>
            </LinearGradient>

            <TouchableOpacity style={s.recalc} onPress={() => setShowResults(false)}><Text style={s.recalcT}>✏️ Adjust Inputs</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  back: { color: '#f4c430', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#f87171', fontFamily: 'Inter_800ExtraBold' },
  sub: { fontSize: 14, color: '#888', marginBottom: 12 },
  disc: { backgroundColor: '#2a1a1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f8717130', marginBottom: 20 },
  discText: { color: '#f0a0a0', fontSize: 12, lineHeight: 18 },
  sec: { marginBottom: 24 },
  secTitle: { fontSize: 18, fontWeight: '700', color: '#e8e0d0', marginBottom: 10 },
  prefill: { backgroundColor: '#60a5fa20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#60a5fa40' },
  prefillT: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  lbl: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 4, marginTop: 12 },
  inp: { backgroundColor: '#141825', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2f3e' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#141825', borderWidth: 1, borderColor: '#2a2f3e' },
  chipA: { backgroundColor: '#f4c43020', borderColor: '#f4c43080' },
  chipT: { fontSize: 12, color: '#666', fontWeight: '700' },
  chipTA: { color: '#f4c430' },
  note: { fontSize: 11, color: '#f4c430', marginTop: 4 },
  kidC: { width: 44, height: 36, borderRadius: 8, backgroundColor: '#141825', borderWidth: 1, borderColor: '#2a2f3e', alignItems: 'center', justifyContent: 'center' },
  kidCA: { backgroundColor: '#f4c43020', borderColor: '#f4c43080' },
  kidT: { fontSize: 14, color: '#666', fontWeight: '700' },
  kidTA: { color: '#f4c430' },
  calcBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  calcT: { fontSize: 18, fontWeight: '800', color: '#fff' },
  rCard: { borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f3e' },
  rTitle: { fontSize: 16, fontWeight: '700', color: '#e8e0d0', marginBottom: 10 },
  bigNum: { fontSize: 32, fontWeight: '800', color: '#f87171', marginBottom: 12 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rLbl: { fontSize: 13, color: '#888', flex: 1 },
  rVal: { fontSize: 14, fontWeight: '700', color: '#e8e0d0' },
  totalCard: { borderRadius: 14, padding: 20, borderWidth: 2, borderColor: '#f8717140', alignItems: 'center' },
  totalLbl: { fontSize: 11, color: '#f87171', fontWeight: '800', letterSpacing: 1 },
  totalVal: { fontSize: 36, fontWeight: '800', color: '#f87171', marginVertical: 8 },
  totalSub: { fontSize: 12, color: '#888', textAlign: 'center' },
  recalc: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2f3e' },
  recalcT: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
});
