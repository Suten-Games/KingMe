// app/expenses.tsx
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../src/store/useStore';
import { DailyExpenseTracker } from '../src/components/DailyExpenseTracker';
import WalletHeaderButton from '../src/components/WalletHeaderButton';

export default function ExpensesScreen() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const obligations = useStore((state) => state.obligations);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#10162a', '#0c1020', '#080c18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: Math.max(insets.top, 14) }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ padding: 8, marginRight: 2 }}>
            <Text style={{ fontSize: 20, color: '#60a5fa', fontWeight: '600' }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Image source={require('../src/assets/images/kingmelogo.jpg')} style={{ width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: '#f4c43040' }} resizeMode="cover" />
            <MaskedView maskElement={<Text style={{ fontSize: 18, fontWeight: '800', color: '#f4c430', letterSpacing: 1, lineHeight: 24, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>}>
              <LinearGradient colors={['#ffe57a', '#f4c430', '#c8860a', '#f4c430', '#ffe57a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#f4c430', letterSpacing: 1, lineHeight: 24, opacity: 0, ...(fontsLoaded && { fontFamily: 'Cinzel_700Bold' }) }}>KingMe</Text>
              </LinearGradient>
            </MaskedView>
          </TouchableOpacity>
          <View style={{ marginLeft: 'auto' }}><WalletHeaderButton /></View>
        </View>
        <LinearGradient colors={['transparent', '#f4c43060', '#f4c430', '#f4c43060', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, marginTop: 10, borderRadius: 1 }} />
      </LinearGradient>
      <DailyExpenseTracker obligations={obligations} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
});
