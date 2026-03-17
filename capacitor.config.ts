import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tmginstall.staff",
  appName: "TMG Staff",
  webDir: "dist/public",
  server: {
    // Loads the live production site — staff always get the latest version
    // without reinstalling the APK. Remove this block only if you want a
    // fully-offline bundled build.
    url: "https://tmginstall.com/staff/login",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#111111",
  },
  plugins: {
    BackgroundGeolocation: {
      // Android foreground-service notification shown while tracking
      backgroundMessage: "TMG Install is tracking your location for the active job.",
      backgroundTitle: "TMG Install — Location Active",
      requestPermissions: true,
    },
  },
};

export default config;
