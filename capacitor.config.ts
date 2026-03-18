import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tmginstall.staff",
  appName: "TMG Staff",
  webDir: "dist/public",
  server: {
    url: "https://tmginstall.com/staff/login",
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
      // Don't request permissions at startup — ask only when staff check in
      requestPermissions: false,
      stale: false,
      distanceFilter: 20,
    },
  },
};

export default config;
