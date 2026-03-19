# TMG Staff — Google Play Store Listing

## App Details

| Field | Value |
|---|---|
| Package name | `com.tmginstall.staff` |
| App name | TMG Staff |
| Category | Business |
| Content rating | Everyone |
| Target audience | Company-internal (staff only) |
| Price | Free (internal distribution) |

---

## Short Description (80 characters max)

> The Moving Guy job management app — GPS, photos, jobs in one place.

---

## Full Description (4 000 characters max)

**TMG Staff** is the official field operations app for **The Moving Guy Pte Ltd** installation teams in Singapore.

Built for furniture installation crews, the app keeps every technician connected to their jobs, their team leader, and the operations centre — even in underground car parks with no signal.

---

### What you can do with TMG Staff

**📋 Your Jobs at a Glance**
See every job assigned to you today and this week. Each job card shows the customer address, service type, appointment time, and current status — so you always know exactly what's next.

**📍 GPS Check-in & Check-out**
When you arrive on site, tap Arrived. When the job is done, tap Completed. The app captures your GPS location and lets you attach before/after photos — giving ops real-time visibility and a photo record for every installation.

**🔔 Push Notifications**
Get notified the moment a new job is assigned to you, rescheduled, or updated — even when the app is closed.

**📡 Always-On Location Tracking**
Once a job is in progress, the app continues sharing your location in the background — even if you switch apps or the screen turns off. Your position automatically resumes after a phone reboot so no job tracking is ever lost.

**📶 Works Offline**
Lost signal in an HDB lift lobby or underground car park? No problem. Your job list is cached locally and stays readable offline. Changes sync automatically when you're back online.

**🔗 Deep-Link Job Navigation**
Tap a push notification or a WhatsApp link and land directly on the right job detail screen — no manual searching.

---

### Privacy & Security

TMG Staff is an **internal company app** available only to verified employees of The Moving Guy Pte Ltd. All data is encrypted in transit. Location data is used only for active job tracking and is never shared with third parties.

Location permission is required for GPS check-in/checkout and background tracking. You can stop location tracking at any time from within the app.

Camera permission is required only for attaching job photos at check-in and check-out.

---

### Requirements

- Android 8.0 (Oreo) or later
- Internet connection (Wi-Fi or mobile data) for live updates
- Location permission (foreground + background) for GPS tracking
- Camera permission for job photos
- Push notification permission for job alerts

---

## App Icon Description (for review team)

Black circular background with a white geometric mountain-peak / shield mark centred, and **TMG** in bold white uppercase beneath the mark. The icon represents The Moving Guy's brand identity.

---

## Screenshots to Prepare

1. **Job List** — Dashboard showing today's assigned jobs with status badges
2. **Job Detail** — Job card with Arrived / Completed action buttons
3. **Photo Upload** — Camera capture flow at check-in
4. **GPS Tracking** — "GPS On" indicator pill with live tracking active
5. **Push Notification** — New job assigned notification on lock screen
6. **Offline Banner** — "Offline — showing cached data" banner

_(Take on a Pixel or Samsung Galaxy device at 1080×1920 resolution for best Play Store appearance)_

---

## Privacy Policy URL

> https://tmginstall.com/privacy  
> _(Create this page before submitting — can be a simple HTML page hosted on the domain)_

---

## GitHub Actions Secrets to Set

Before the CI pipeline can produce a signed release APK and AAB, add these three secrets to the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `KEYSTORE_BASE64` | Contents of `android/app/tmg-staff-release.keystore.b64` |
| `KEYSTORE_PASSWORD` | `TMGInstall2024!` |
| `KEY_ALIAS` | `tmg-staff` |

To get the base64 value:
```bash
cat android/app/tmg-staff-release.keystore.b64
```
Copy the entire output and paste it as the `KEYSTORE_BASE64` secret value.

---

## Firebase Setup Checklist (for Push Notifications)

- [ ] Create project at https://console.firebase.google.com
- [ ] Add Android app with package name `com.tmginstall.staff`
- [ ] Download `google-services.json` → place in `android/app/`
- [ ] In `android/build.gradle` → add `classpath 'com.google.firebase:firebase-bom:33.0.0'`
- [ ] In `android/app/build.gradle` → already has auto-apply for Google Services
- [ ] Get **Server Key** from Firebase Console → Project Settings → Cloud Messaging
- [ ] Add as environment variable `FIREBASE_SERVER_KEY` in Replit Secrets
- [ ] Re-run `bash build-android.sh` (or push to GitHub to trigger CI)

---

## Google Play Console Submission Steps

1. Go to https://play.google.com/console → Create app
2. Fill in app name (**TMG Staff**), default language (English), app / game (App), free / paid (Free)
3. Upload **AAB** (`app-release.aab`) from GitHub Actions artifact
4. Fill in store listing with text above
5. Upload screenshots (minimum 2 required per form factor)
6. Upload feature graphic (`attached_assets/play-store-feature-graphic-1024x500.png`)
7. Upload hi-res icon (`attached_assets/play-store-icon-512x512.png`)
8. Set content rating (complete questionnaire → Everyone)
9. Add privacy policy URL
10. Choose distribution: **Countries** → Singapore; **Availability**: All devices meeting requirements
11. Submit for review (internal testing → closed testing → production, or skip to production for internal apps)
