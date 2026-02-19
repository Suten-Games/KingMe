// src/polyfills.ts
// These MUST be imported before any other code runs.
// Order matters: random values → text encoding → ethers shims → buffer → URL

import 'react-native-get-random-values';
import 'fast-text-encoding';          // Privy requires TextEncoder/TextDecoder
import '@ethersproject/shims';          // Privy requires ethers shims
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'react-native-url-polyfill/auto';
