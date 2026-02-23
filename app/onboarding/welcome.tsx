// app/onboarding/welcome.tsx
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { AvatarType } from '../../src/types';
import { AVATAR_IMAGES } from '../../src/utils/constants';
import { useStore } from '../../src/store/useStore';
import { T } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const avatarType = useStore((state) => state.settings.avatarType);
  const setAvatarType = useStore((state) => state.setAvatarType);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>(avatarType);

  const handleContinue = () => {
    setAvatarType(selectedAvatar);
    router.push('/onboarding/bank-accounts');
  };

  return (
    <View style={st.container}>
      {/* Logo + Title */}
      <View style={st.header}>
        <Image
          source={require('../../src/assets/images/kingmelogo.jpg')}
          style={st.logo}
          resizeMode="contain"
        />
        <Text style={st.title}>Choose Your Avatar</Text>
        <Text style={st.subtitle}>
          This is your future self — fully kinged.{'\n'}
          Your avatar evolves as your freedom grows.
        </Text>
      </View>

      {/* Avatar Cards */}
      <View style={st.avatarRow}>
        {/* Male */}
        <TouchableOpacity
          style={[st.avatarCard, selectedAvatar === 'male-medium' && st.avatarCardSelected]}
          onPress={() => setSelectedAvatar('male-medium')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={selectedAvatar === 'male-medium' ? T.gradients.gold : T.gradients.card}
            style={st.avatarGradient}
          >
            <Image
              source={AVATAR_IMAGES['male-medium'].enthroned}
              style={st.avatarImage}
              resizeMode="cover"
            />
            {selectedAvatar === 'male-medium' && (
              <View style={st.selectedBadge}>
                <Text style={st.selectedBadgeText}>👑</Text>
              </View>
            )}
          </LinearGradient>
          <View style={st.avatarLabelBox}>
            <Text style={[st.avatarLabel, selectedAvatar === 'male-medium' && st.avatarLabelActive]}>
              Male
            </Text>
          </View>
        </TouchableOpacity>

        {/* Female */}
        <TouchableOpacity
          style={[st.avatarCard, selectedAvatar === 'female-medium' && st.avatarCardSelected]}
          onPress={() => setSelectedAvatar('female-medium')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={selectedAvatar === 'female-medium' ? T.gradients.gold : T.gradients.card}
            style={st.avatarGradient}
          >
            <Image
              source={AVATAR_IMAGES['female-medium'].enthroned}
              style={st.avatarImage}
              resizeMode="cover"
            />
            {selectedAvatar === 'female-medium' && (
              <View style={st.selectedBadge}>
                <Text style={st.selectedBadgeText}>👑</Text>
              </View>
            )}
          </LinearGradient>
          <View style={st.avatarLabelBox}>
            <Text style={[st.avatarLabel, selectedAvatar === 'female-medium' && st.avatarLabelActive]}>
              Female
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={st.hint}>You can change this anytime in Settings</Text>

      {/* Continue */}
      <View style={st.bottomArea}>
        <TouchableOpacity style={st.button} onPress={handleContinue}>
          <Text style={st.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CARD_WIDTH = 160;
const IMAGE_HEIGHT = 220;

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${T.gold}40`,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: T.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },

  // Avatar card
  avatarCard: {
    width: CARD_WIDTH,
    borderRadius: T.radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: T.border,
  },
  avatarCardSelected: {
    borderColor: T.gold,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarGradient: {
    position: 'relative',
  },
  avatarImage: {
    width: CARD_WIDTH - 4,
    height: IMAGE_HEIGHT,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${T.bg}cc`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${T.gold}60`,
  },
  selectedBadgeText: {
    fontSize: 14,
  },
  avatarLabelBox: {
    backgroundColor: T.bgCard,
    paddingVertical: 10,
    alignItems: 'center',
  },
  avatarLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: T.textSecondary,
  },
  avatarLabelActive: {
    color: T.gold,
  },

  hint: {
    fontSize: 12,
    color: T.textDim,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Bottom
  bottomArea: {
    paddingBottom: 20,
  },
  button: {
    backgroundColor: T.gold,
    padding: 18,
    borderRadius: T.radius.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: T.bg,
  },
});
