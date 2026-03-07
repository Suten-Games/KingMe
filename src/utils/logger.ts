// src/utils/logger.ts
// Silent in production builds, normal logging in dev.
// Uses React Native/Expo built-in __DEV__ flag.

export const log = (...args: any[]) => __DEV__ && console.log(...args);
export const warn = (...args: any[]) => __DEV__ && console.warn(...args);
export const error = (...args: any[]) => __DEV__ && console.error(...args);
