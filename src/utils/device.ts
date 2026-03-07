// src/utils/device.ts
// Detect Solana Mobile Seeker device via Platform constants
import { Platform } from 'react-native';

export const isSeeker = Platform.OS === 'android' && (Platform.constants as any).Model === 'Seeker';
