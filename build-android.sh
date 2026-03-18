#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TMG Staff App — Android Build Script
# Builds a debug APK that loads the live tmginstall.com site.
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
# Quick start:
#   export ANDROID_HOME=~/Library/Android/sdk  # adjust for your OS
#   bash build-android.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

# ── Pre-flight checks ────────────────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "❌  ANDROID_HOME is not set."
  echo "    Set it to your Android SDK root and re-run:"
  echo "    export ANDROID_HOME=~/Library/Android/sdk"
  exit 1
fi

if ! command -v java &>/dev/null; then
  echo "❌  Java not found. Install JDK 17 or 21 and add it to PATH."
  exit 1
fi

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [ "${JAVA_VER:-0}" -lt 17 ]; then
  echo "❌  Java ${JAVA_VER} is too old. Install JDK 17 or 21."
  exit 1
fi

# ── Sync Capacitor (copies web assets + plugin configs) ─────────────────────
echo "🔄  Syncing Capacitor…"
npx cap sync android

# ── Build APK ────────────────────────────────────────────────────────────────
echo "🔨  Building debug APK…"
cd "$ANDROID_DIR"
chmod +x gradlew
./gradlew assembleDebug --no-daemon --stacktrace

# ── Result ───────────────────────────────────────────────────────────────────
if [ -f "$APK_OUT" ]; then
  SIZE=$(du -h "$APK_OUT" | cut -f1)
  echo ""
  echo "✅  Build successful!"
  echo "    APK: $APK_OUT"
  echo "    Size: $SIZE"
  echo ""
  echo "📱  Install via ADB (device must have USB Debugging enabled):"
  echo "    adb install -r \"$APK_OUT\""
  echo ""
  echo "📲  Or copy the APK to your phone and open it to install manually."
else
  echo "❌  Build failed — APK not found at expected path."
  exit 1
fi
