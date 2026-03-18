import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tmginstall.staff",
  appName: "TMG Staff",
  webDir: "dist/public",
  server: {
    // Points to the deployed Replit app — staff always get the latest version
    // without reinstalling the APK.
    // TODO: Replace with https://tmginstall.com once the domain is live.
    url: "https://e8e39fa3-8d04-4454-8036-b60ebe21852f-00-2u43djm9l6hk.janeway.replit.dev/staff/login",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#111111",
    appendUserAgent: "TMGStaffApp",
  },
  plugins: {
    BackgroundGeolocation: {
      backgroundMessage: "TMG Install is tracking your location for the active job.",
      backgroundTitle: "TMG Install — Location Active",
      requestPermissions: true,
    },
  },
};

export default config;
