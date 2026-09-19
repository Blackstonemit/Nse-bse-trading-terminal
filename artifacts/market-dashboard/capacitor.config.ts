import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nsebse.tradingterminal',
  appName: 'NSE/BSE Trading Terminal',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
