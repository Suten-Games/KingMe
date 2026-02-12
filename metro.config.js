const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfill resolvers
config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
  process: require.resolve('process/browser'),
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
};

config.resolver.sourceExts.push('cjs');

module.exports = config;