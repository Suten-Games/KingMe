import 'fast-text-encoding';

// Patch TextDecoder to accept { fatal: true } option (Hermes + Privy compat)
const OriginalTextDecoder = globalThis.TextDecoder;
globalThis.TextDecoder = class extends OriginalTextDecoder {
  constructor(encoding, options) {
    super(encoding);
  }
};

import './src/polyfills';
import 'expo-router/entry';