import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hdinever.gkmixer',
  appName: 'GK-Mixer',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#020617',
    allowMixedContent: true
  }
};

export default config;
