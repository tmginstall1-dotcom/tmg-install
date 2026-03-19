#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TMG Staff App — Android Build Script
#
# Requirements:
#   - Java 17+ (e.g. JDK 17 or 21)  ← brew install openjdk@21
#   - Android Studio (provides Android SDK)  OR  android-commandlinetools
#   - ANDROID_HOME must point to your Android SDK root
#
# Typical Android Studio SDK path:
#   macOS: ~/Library/Android/sdk
#   Linux: ~/Android/Sdk
#   Windows: %LOCALAPPDATA%\Android\Sdk
#
# Usage:
#   # Debug APK (no signing needed):
#   bash build-android.sh
#
#   # Signed release APK:
#   RELEASE=1 bash build-android.sh
#
#   # Release requires these env vars:
#   #   KEYSTORE_PASSWORD=TMGInstall2024!
#   #   KEY_ALIAS=tmg-staff
#   #   (keystore file: android/app/tmg-staff-release.keystore)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/android"
BUILD_TYPE="${RELEASE:+Release}"
BUILD_TYPE="${BUILD_TYPE:-Debug}"
BUILD_TYPE_LOWER="${BUILD_TYPE,,}"

if [ "${BUILD_TYPE}" = "Release" ]; then
  TASK="assembleRelease"
  APK_OUT="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
  AAB_OUT="${ANDROID_DIR}/app/build/outputs/bundle/release/app-release.aab"
else
  TASK="assembleDebug"
  APK_OUT="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
fi

# ── Pre-flight checks ────────────────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "❌  ANDROID_HOME is not set."
  echo "    export ANDROID_HOME=~/Library/Android/sdk"
  exit 1
fi

if ! command -v java &>/dev/null; then
  echo "❌  Java not found. Install JDK 17 or 21."
  exit 1
fi

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [ "${JAVA_VER:-0}" -lt 17 ]; then
  echo "❌  Java ${JAVA_VER} is too old. Install JDK 17 or 21."
  exit 1
fi

if [ "${BUILD_TYPE}" = "Release" ] && [ ! -f "${ANDROID_DIR}/app/tmg-staff-release.keystore" ]; then
  echo "❌  Release keystore not found at android/app/tmg-staff-release.keystore"
  echo "    See the keystore setup instructions in the project README."
  exit 1
fi

echo "🔧  Building: ${BUILD_TYPE} APK"

# ── Build web bundle ──────────────────────────────────────────────────────────
echo "📦  Building web bundle (Vite)..."
VITE_API_BASE=https://tmginstall.com npx vite build

# ── Sync Capacitor (copies web assets + plugin configs) ─────────────────────
echo "🔄  Syncing Capacitor…"
npx cap sync android

# ── Build APK ────────────────────────────────────────────────────────────────
echo "🔨  Running Gradle ${TASK}…"
cd "$ANDROID_DIR"
chmod +x gradlew

if [ "${BUILD_TYPE}" = "Release" ]; then
  KEYSTORE_PATH="${ANDROID_DIR}/app/tmg-staff-release.keystore" \
  KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-TMGInstall2024!}" \
  KEY_ALIAS="${KEY_ALIAS:-tmg-staff}" \
    ./gradlew "${TASK}" bundleRelease --no-daemon --stacktrace
else
  ./gradlew "${TASK}" --no-daemon --stacktrace
fi

# ── Result ───────────────────────────────────────────────────────────────────
if [ -f "$APK_OUT" ]; then
  SIZE=$(du -h "$APK_OUT" | cut -f1)
  echo ""
  echo "✅  Build successful!"
  echo "    APK:  $APK_OUT  (${SIZE})"
  if [ "${BUILD_TYPE}" = "Release" ] && [ -f "${AAB_OUT:-}" ]; then
    AAB_SIZE=$(du -h "$AAB_OUT" | cut -f1)
    echo "    AAB:  $AAB_OUT  (${AAB_SIZE})  ← upload this to Google Play"
  fi
  echo ""
  echo "📱  Install via ADB (device must have USB Debugging enabled):"
  echo "    adb install -r \"$APK_OUT\""
  echo ""
  echo "📲  Or copy the APK to your phone and open it to install manually."
else
  echo "❌  Build failed — APK not found at expected path."
  exit 1
fi
