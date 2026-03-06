// src/components/KingMeFooter.tsx
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function KingMeFooter() {
  return (
    <View style={s.wrapper}>
      <LinearGradient
        colors={['transparent', '#f4c43015', '#f4c43030', '#f4c43015', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.divider}
      />

      <View style={s.container}>
        <View style={s.brandRow}>
          <Image
            source={require('../assets/images/kingmelogo.jpg')}
            style={s.logo}
            resizeMode="cover"
          />
          <View>
            <Text style={s.brandName}>KingMe</Text>
            <Text style={s.tagline}>Know your numbers. Own your freedom.</Text>
          </View>
        </View>

        <View style={s.linksRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://kingme.money')}>
            <Text style={s.link}>kingme.money</Text>
          </TouchableOpacity>
          <Text style={s.dot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://x.com/KingMeMoney')}>
            <Text style={s.link}>@KingMeMoney</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.legal}>
          Built on Solana · Not financial advice · Your data stays on your device
        </Text>

        <Text style={s.copyright}>
          © {new Date().getFullYear()} Suten Games
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginTop: 32,
    paddingBottom: 40,
  },
  divider: {
    height: 1,
    marginBottom: 24,
    marginHorizontal: 16,
    borderRadius: 1,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f4c43030',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f4c430',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
  },
  dot: {
    color: '#333',
    fontSize: 12,
  },
  legal: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
    lineHeight: 16,
  },
  copyright: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
  },
});
