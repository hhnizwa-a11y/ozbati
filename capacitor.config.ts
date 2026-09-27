import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'om.ozbati.app',
  appName: 'عزبتي',
  webDir: 'dist',
  backgroundColor: '#10243A',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
