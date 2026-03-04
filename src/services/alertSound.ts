// src/services/alertSound.ts
// Plays a short alert tone for urgent/high-priority position alerts.
// Uses the Web Audio API on web and expo-av on native.

import { Platform } from 'react-native';

let _lastPlayed = 0;
const COOLDOWN_MS = 10_000; // Don't spam — at most once per 10 seconds

/**
 * Play an alert chime. Two tones:
 *   urgent → higher pitch, double beep
 *   high   → single beep
 */
export async function playAlertSound(priority: 'urgent' | 'high') {
  const now = Date.now();
  if (now - _lastPlayed < COOLDOWN_MS) return;
  _lastPlayed = now;

  if (Platform.OS === 'web') {
    playWebAudio(priority);
  } else {
    await playNativeAudio(priority);
  }
}

// ── Web: synthesise a short tone via Web Audio API ──────────────────────────

function playWebAudio(priority: 'urgent' | 'high') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = ctx.currentTime;
    if (priority === 'urgent') {
      playTone(880, t, 0.15);        // A5
      playTone(1100, t + 0.18, 0.15); // ~C#6
    } else {
      playTone(660, t, 0.2);          // E5
    }

    // Clean up context after tones finish
    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    console.warn('[ALERT SOUND] Web Audio failed:', e);
  }
}

// ── Native: generate a wav in memory via expo-av ────────────────────────────

async function playNativeAudio(priority: 'urgent' | 'high') {
  try {
    const { Audio } = require('expo-av');
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

    // Generate a tiny WAV in a data URI
    const wav = generateToneWav(priority === 'urgent' ? 880 : 660, 0.2);
    const { sound } = await Audio.Sound.createAsync(
      { uri: wav },
      { shouldPlay: true, volume: 0.3 }
    );

    // If urgent, play a second higher tone after a short gap
    if (priority === 'urgent') {
      setTimeout(async () => {
        try {
          const { sound: s2 } = await Audio.Sound.createAsync(
            { uri: generateToneWav(1100, 0.15) },
            { shouldPlay: true, volume: 0.3 }
          );
          setTimeout(() => s2.unloadAsync(), 500);
        } catch {}
      }, 180);
    }

    setTimeout(() => sound.unloadAsync(), 500);
  } catch (e) {
    console.warn('[ALERT SOUND] Native audio failed:', e);
  }
}

/** Generate a minimal WAV file as a base64 data URI. */
function generateToneWav(freq: number, durationSec: number): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit samples
  const fileSize = 44 + dataSize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);       // fmt chunk size
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave with fade-out envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = 1 - (i / numSamples); // linear fade out
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  // Convert to base64 data URI
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}
