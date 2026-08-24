import type { CapacitorConfig } from '@capacitor/cli';

// Wisdom & Word — Amazon Appstore edition.
// This config wraps the CRA production build (`yarn build` → /app/frontend/build)
// as a native Android APK. RevenueCat's Amazon SDK is bridged via
// @revenuecat/purchases-capacitor.
const config: CapacitorConfig = {
  appId: 'com.wisdomandword.app',
  appName: 'Wisdom & Word',
  webDir: 'build',
  android: {
    allowMixedContent: false,
  },
};

export default config;
