// components/FreedomScore.tsx
import React from 'react';
import { View, Image, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import type { AvatarType, FreedomState } from '../types';
import { AVATAR_IMAGES, AVATAR_VIDEOS } from '../utils/constants';
import { useStore } from '../store/useStore';

// Conditionally import expo-av for native only
let NativeVideo: any = null;
if (Platform.OS !== 'web') {
  try {
    const av = require('expo-av');
    NativeVideo = av.Video;
  } catch {}
}

interface FreedomScoreProps {
  days: number;
  formatted: string;
  state: FreedomState;
  avatarType: AvatarType;
  isKinged: boolean;
  layout?: 'hero' | 'sidebar';
  children?: React.ReactNode;
}

const { width, height } = Dimensions.get('window');

function defaultLayout(): 'hero' | 'sidebar' {
  if (Platform.OS !== 'web') return 'hero';
  // Use hero layout on narrow screens (mobile web) so content is scrollable
  return width >= 768 ? 'sidebar' : 'hero';
}

// ── Web Video Component ───────────────────────────────────────────────────────
// Uses native HTML5 <video> which is far more reliable on web than expo-av
function WebVideo({ source }: { source: any }) {
  const [uri, setUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const asset = Asset.fromModule(source);
      if (asset.uri) {
        setUri(asset.uri);
      } else {
        asset.downloadAsync().then(() => {
          setUri(asset.localUri || asset.uri);
        });
      }
    } catch (e) {
      console.warn('[WebVideo] Asset resolution failed:', e);
    }
  }, [source]);

  const videoRef = React.useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    el.muted = true;
    el.playsInline = true;
    el.play().catch((e) => console.log('[WebVideo] play() blocked:', e));
  }, []);

  if (!uri) return null;

  return React.createElement('video', {
    ref: videoRef,
    src: uri,
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      position: 'absolute',
      top: 0,
      left: 0,
    },
  });
}

export function FreedomScore({ days, formatted, state, avatarType, isKinged, layout, children }: FreedomScoreProps) {
  const avatarImage = AVATAR_IMAGES[avatarType][state];
  const animatedAvatar = useStore(s => s.settings.animatedAvatar ?? false);
  const mode = layout ?? defaultLayout();

  // Check if a video exists for this avatar type + freedom state
  const videoSource = AVATAR_VIDEOS?.[avatarType]?.[state] ?? null;
  const canPlayVideo = animatedAvatar && videoSource;

  if (Platform.OS === 'web') {
    console.log('[FreedomScore] animated:', animatedAvatar, 'videoSource:', !!videoSource, 'canPlay:', canPlayVideo, 'state:', state);
  }

  // ── shared score circle ─────────────────────────────────────────────────
  const scoreCircle = (
    <View style={mode === 'sidebar' ? styles.scoreCircleSidebar : styles.scoreCircle}>
      <Text style={mode === 'sidebar' ? styles.scoreNumberSidebar : styles.scoreNumber}>
        {days === Infinity ? '∞' : formatted}
      </Text>
      {!isKinged && <Text style={styles.scoreLabel}>of freedom</Text>}
      {isKinged  && <Text style={styles.kingedLabel}>👑 KINGED</Text>}
    </View>
  );

  // ── Avatar media renderer ───────────────────────────────────────────────
  const renderAvatar = (imageStyle: any) => {
    if (canPlayVideo) {
      if (Platform.OS === 'web') {
        // Web: HTML5 video replaces the image entirely
        // The parent container (heroContainer / sidebarImagePanel) provides the bounds
        return (
          <>
            <Image source={avatarImage} style={imageStyle} resizeMode="cover" />
            <WebVideo source={videoSource} />
          </>
        );
      } else if (NativeVideo) {
        // Mobile: expo-av Video
        return (
          <NativeVideo
            source={videoSource}
            style={imageStyle}
            resizeMode="cover"
            shouldPlay
            isLooping
            isMuted
            posterSource={avatarImage}
            usePoster
            posterStyle={imageStyle}
          />
        );
      }
    }
    return <Image source={avatarImage} style={imageStyle} resizeMode="cover" />;
  };

  // ── HERO layout (mobile) ────────────────────────────────────────────────
  if (mode === 'hero') {
    return (
      <View style={styles.heroContainer}>
        {renderAvatar(styles.heroImage)}
        <View style={styles.heroOverlay}>
          {scoreCircle}
        </View>
      </View>
    );
  }

  // ── SIDEBAR layout (web) ─────────────────────────────────────────────────
  return (
    <View style={styles.sidebarRow}>
      <View style={styles.sidebarImagePanel}>
        {renderAvatar(styles.sidebarImage)}
        <View style={styles.sidebarOverlay}>
          {scoreCircle}
        </View>
      </View>
      <View style={styles.sidebarContent}>
        {children}
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 420;

const styles = StyleSheet.create({
  heroContainer: {
    width: width,
    height: height * 0.6,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 20,
    paddingRight: 20,
  },
  scoreCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    borderWidth: 3,
    borderColor: '#f4c430',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f4c430',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4c430',
    textAlign: 'center',
  },
  sidebarRow: {
    flexDirection: 'row',
    flex: 1,
  },
  sidebarImagePanel: {
    width: SIDEBAR_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  sidebarImage: {
    width: '100%',
    height: '100%',
  },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleSidebar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    borderWidth: 3,
    borderColor: '#f4c430',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f4c430',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  scoreNumberSidebar: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#f4c430',
    textAlign: 'center',
  },
  sidebarContent: {
    flex: 1,
    overflow: 'scroll',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 4,
  },
  kingedLabel: {
    fontSize: 14,
    color: '#f4c430',
    marginTop: 4,
    fontWeight: 'bold',
  },
});
