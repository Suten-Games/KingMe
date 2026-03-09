// src/polyfills.ts - COMPREHENSIVE POLYFILLS FOR WEB

import { Platform } from 'react-native';
import { log, warn, error } from '../utils/logger';

if (Platform.OS === 'web') {
  // Buffer polyfill
  const { Buffer } = require('buffer');
  global.Buffer = global.Buffer || Buffer;

  // Process polyfill (needed by some crypto packages)
  if (typeof global.process === 'undefined') {
    global.process = require('process/browser');
  }

  // Crypto polyfill (needed by Solana packages)
  if (typeof global.crypto === 'undefined') {
    const crypto = require('crypto-browserify');
    global.crypto = crypto;
  }

  // Stream polyfill
  if (typeof (global as any).stream === 'undefined') {
    (global as any).stream = require('stream-browserify');
  }

  log('[POLYFILLS] Web polyfills loaded successfully');
}

export {};
