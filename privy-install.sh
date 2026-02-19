#!/bin/bash
# KingMe - Privy Integration Install Script
# Run from project root: bash privy-install.sh

echo "📦 Installing Privy Expo SDK + peer deps..."
npx expo install \
  @privy-io/expo \
  @privy-io/expo-native-extensions \
  expo-application \
  expo-constants \
  expo-web-browser \
  expo-linking \
  expo-secure-store \
  expo-crypto \
  react-native-webview \
  react-native-passkeys

echo "📦 Installing polyfills..."
npm i --save fast-text-encoding @ethersproject/shims

echo "📦 Installing babel plugins (required by Privy upstream deps)..."
npm i --save-dev \
  @babel/plugin-transform-class-properties \
  @babel/plugin-transform-private-methods \
  @babel/plugin-transform-flow-strip-types

echo ""
echo "✅ Privy deps installed!"
echo ""
echo "⚠️  Next steps:"
echo "  1. Update babel.config.js (add plugins)"
echo "  2. Update src/polyfills.ts (add fast-text-encoding + @ethersproject/shims)"
echo "  3. Update app/_layout.tsx (wrap with PrivyProvider on mobile)"
echo "  4. Replace src/providers/wallet-provider.tsx"
echo "  5. Delete ios/ and android/ folders: rm -rf ios android"
echo "  6. Rebuild: npx expo prebuild && npx expo run:ios"
