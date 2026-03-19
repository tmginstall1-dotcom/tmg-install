import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tmginstall.staff",
  appName: "TMG Staff",
  webDir: "dist/public",
  // No server.url — app loads from local bundle inside the APK.
  // API calls use absolute URLs (https://tmginstall.com/api/...) set via VITE_API_BASE.
  android: {
    allowMixedContent: false,
    backgroundColor: "#000000",
    appendUserAgent: "TMGStaffApp",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
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
