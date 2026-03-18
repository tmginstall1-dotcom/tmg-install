import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tmginstall.staff",
  appName: "TMG Staff",
  webDir: "dist/public",
  server: {
    // Point to the root so React Router handles /staff/login internally.
    // Pointing to a specific path like /staff/login causes WebView reload
    // conflicts when the keyboard or autofill interacts with the page.
    url: "https://tmginstall.com",
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
      requestPermissions: false,
      stale: false,
      distanceFilter: 20,
    },
  },
};

export default config;
