// src/components/SuccessModal.tsx
// Styled success popup — replaces generic Alert.alert for celebration moments

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

interface SuccessModalProps {
  visible: boolean;
  emoji?: string;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
  /** Auto-dismiss after N ms (0 = no auto-dismiss) */
  autoDismissMs?: number;
}

export default function SuccessModal({
  visible,
  emoji = '🎉',
  title,
  message,
  buttonLabel = 'OK',
  onClose,
  autoDismissMs = 0,
}: SuccessModalProps) {
  useEffect(() => {
    if (visible && autoDismissMs > 0) {
      const timer = setTimeout(onClose, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismissMs, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.emoji}>{emoji}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <TouchableOpacity style={s.button} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: '#4ade8040',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#4ade80',
    alignItems: 'center',
  },
  buttonText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
