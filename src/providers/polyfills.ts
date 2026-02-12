// src/polyfills.ts - COMPREHENSIVE POLYFILLS FOR WEB

import { Platform } from 'react-native';

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
  if (typeof global.stream === 'undefined') {
    global.stream = require('stream-browserify');
  }

  console.log('[POLYFILLS] Web polyfills loaded successfully');
}

export {};
