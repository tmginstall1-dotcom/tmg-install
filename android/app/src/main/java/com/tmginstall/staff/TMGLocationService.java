package com.tmginstall.staff;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TMGLocationService extends Service {

    private static final String TAG          = "TMGLocationService";
    private static final String CHANNEL_ID   = "tmg_location";
    private static final int    NOTIF_ID     = 9001;
    private static final String API_BASE     = "https://tmg-install-project--tmginstall.replit.app";

    // GPS fires every 15 s. Server receives at most once per 30 s (time-only throttle).
    private static final long GPS_INTERVAL_MS  = 15_000L;
    private static final long SEND_INTERVAL_MS = 30_000L;

    // Watchdog: re-register FusedLocationProvider every 90 s regardless.
    private static final long WATCHDOG_MS = 90_000L;

    // AlarmManager heartbeat: if the service is killed, the alarm restarts it.
    private static final long KEEPALIVE_MS = 5 * 60_000L; // 5 minutes

    // WakeLock auto-renew interval (30 min) — prevents silent release on some devices.
    private static final long WAKELOCK_RENEW_MS = 30 * 60_000L;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback            locationCallback;
    private HandlerThread               locationThread;
    private Handler                     bgHandler;
    private ExecutorService             networkExecutor;
    private PowerManager.WakeLock       wakeLock;
    private AlarmManager                alarmManager;

    private int    staffId        = -1;
    private long   lastSentAt     = 0;
    private long   lastCallbackAt = 0;
    private String sessionCookie  = "";

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();

        networkExecutor  = Executors.newSingleThreadExecutor();
        alarmManager     = (AlarmManager) getSystemService(Context.ALARM_SERVICE);

        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        staffId       = prefs.getInt("staff_id", -1);
        sessionCookie = prefs.getString(TMGLocationPlugin.PREF_SESSION_COOKIE, "");

        // CPU WakeLock — keeps processing alive when screen is off.
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TMGInstall:LocationWakeLock");
            wakeLock.acquire();
        }

        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification("Shift active — tracking location"));

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                lastCallbackAt = System.currentTimeMillis();
                for (Location loc : result.getLocations()) onNewLocation(loc);
            }
        };

        // Dedicated background thread — never blocked by main looper throttling.
        locationThread = new HandlerThread("TMGLocationThread");
        locationThread.start();
        bgHandler = new Handler(locationThread.getLooper());

        registerLocationUpdates();
        scheduleKeepalive();
        bgHandler.postDelayed(this::runWatchdog, WATCHDOG_MS);
        bgHandler.postDelayed(this::renewWakeLock, WAKELOCK_RENEW_MS);

        Log.d(TAG, "Service started — staffId=" + staffId);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Called both on first start AND when alarm wakes us up.
        // Always refresh credentials and re-register location updates.
        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        int newId = (intent != null) ? intent.getIntExtra("staff_id", -1) : -1;
        if (newId >= 0) staffId = newId;
        if (staffId < 0) staffId = prefs.getInt("staff_id", -1);
        sessionCookie = prefs.getString(TMGLocationPlugin.PREF_SESSION_COOKIE, sessionCookie);

        boolean fromAlarm = (intent != null) && intent.getBooleanExtra("from_alarm", false);
        Log.d(TAG, "onStartCommand — staffId=" + staffId + " fromAlarm=" + fromAlarm);

        // Re-register location (safe to call repeatedly — removes old listener first).
        if (bgHandler != null) {
            bgHandler.post(this::registerLocationUpdates);
        }

        // Reschedule keepalive so the next alarm fires on time.
        scheduleKeepalive();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Service destroyed — scheduling immediate restart");

        // If we're supposed to be tracking, restart ourselves via alarm immediately.
        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        if (prefs.getBoolean("tracking_active", false)) {
            scheduleImmediateRestart();
        } else {
            cancelKeepalive();
        }

        if (bgHandler != null)         bgHandler.removeCallbacksAndMessages(null);
        if (networkExecutor != null)   networkExecutor.shutdownNow();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (locationThread != null) locationThread.quitSafely();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }

    /** Called when the user swipes the app out of the recent-tasks list. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "App removed from recents — scheduling immediate restart");

        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        if (prefs.getBoolean("tracking_active", false)) {
            scheduleImmediateRestart();
        }
    }

    @Nullable @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Location registration ─────────────────────────────────────────────────

    private void registerLocationUpdates() {
        try {
            LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, GPS_INTERVAL_MS
            )
            .setMinUpdateIntervalMillis(GPS_INTERVAL_MS / 2)
            .setMaxUpdateDelayMillis(GPS_INTERVAL_MS * 3)
            .setWaitForAccurateLocation(false)
            .build();

            fusedLocationClient.removeLocationUpdates(locationCallback);
            fusedLocationClient.requestLocationUpdates(
                request, locationCallback, locationThread.getLooper());

            Log.d(TAG, "Location updates registered — interval=" + GPS_INTERVAL_MS + "ms");
        } catch (SecurityException e) {
            Log.w(TAG, "Location permission denied: " + e.getMessage());
            stopSelf();
        } catch (Exception e) {
            Log.w(TAG, "registerLocationUpdates failed: " + e.getMessage());
        }
    }

    // ── Watchdog (always re-registers regardless) ─────────────────────────────

    private void runWatchdog() {
        long silentMs = System.currentTimeMillis() - lastCallbackAt;
        Log.d(TAG, "Watchdog — silent " + silentMs / 1000 + "s — re-registering");

        // Always re-register to prevent silent dropout
        registerLocationUpdates();

        // Update notification with a timestamp so Android sees activity
        updateNotification("Tracking · last fix " + (silentMs / 1000) + "s ago");

        bgHandler.postDelayed(this::runWatchdog, WATCHDOG_MS);
    }

    // ── WakeLock renewal ──────────────────────────────────────────────────────

    private void renewWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                    "TMGInstall:LocationWakeLock");
                wakeLock.acquire();
                Log.d(TAG, "WakeLock renewed");
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock renew failed: " + e.getMessage());
        }
        bgHandler.postDelayed(this::renewWakeLock, WAKELOCK_RENEW_MS);
    }

    // ── AlarmManager keepalive ────────────────────────────────────────────────

    private PendingIntent buildKeepalivePendingIntent() {
        Intent intent = new Intent(this, TMGAlarmReceiver.class);
        intent.setAction("com.tmginstall.staff.KEEPALIVE");
        return PendingIntent.getBroadcast(this, 1001, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void scheduleKeepalive() {
        if (alarmManager == null) return;
        PendingIntent pi = buildKeepalivePendingIntent();
        long triggerAt = SystemClock.elapsedRealtime() + KEEPALIVE_MS;
        try {
            // setExactAndAllowWhileIdle fires even in deep Doze
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            Log.d(TAG, "Keepalive alarm scheduled in " + KEEPALIVE_MS / 1000 + "s");
        } catch (Exception e) {
            Log.w(TAG, "scheduleKeepalive failed: " + e.getMessage());
        }
    }

    /** Fires in 2 seconds — used to restart after onDestroy or onTaskRemoved. */
    private void scheduleImmediateRestart() {
        if (alarmManager == null) return;
        PendingIntent pi = buildKeepalivePendingIntent();
        long triggerAt = SystemClock.elapsedRealtime() + 2_000L;
        try {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            Log.d(TAG, "Immediate restart alarm scheduled in 2s");
        } catch (Exception e) {
            Log.w(TAG, "scheduleImmediateRestart failed: " + e.getMessage());
        }
    }

    private void cancelKeepalive() {
        if (alarmManager == null) return;
        try {
            alarmManager.cancel(buildKeepalivePendingIntent());
        } catch (Exception ignored) {}
    }

    // ── Location event ────────────────────────────────────────────────────────

    private void onNewLocation(Location loc) {
        // Forward to JS (for foreground UI updates)
        Intent broadcast = new Intent(TMGLocationPlugin.LOCATION_BROADCAST);
        broadcast.setPackage(getPackageName());
        broadcast.putExtra("lat",      loc.getLatitude());
        broadcast.putExtra("lng",      loc.getLongitude());
        broadcast.putExtra("accuracy", loc.getAccuracy());
        broadcast.putExtra("speed",    loc.hasSpeed() ? loc.getSpeed() : 0f);
        broadcast.putExtra("time",     loc.getTime());
        sendBroadcast(broadcast);

        if (staffId < 0) return;

        // Time-only throttle — no distance gate; staff may be stationary all day
        long now = System.currentTimeMillis();
        if (now - lastSentAt < SEND_INTERVAL_MS) return;
        lastSentAt = now;

        final int    sid    = staffId;
        final double lat    = loc.getLatitude();
        final double lng    = loc.getLongitude();
        final float  acc    = loc.getAccuracy();
        final float  spd    = loc.hasSpeed() ? loc.getSpeed() : 0f;
        final String cookie = sessionCookie;

        networkExecutor.submit(() -> postGpsPoint(sid, lat, lng, acc, spd, cookie));
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private void postGpsPoint(int sid, double lat, double lng, float acc, float spd, String cookie) {
        try {
            String body = String.format(
                java.util.Locale.US,
                "{\"staffId\":%d,\"lat\":\"%.7f\",\"lng\":\"%.7f\",\"accuracy\":%.1f,\"speed\":%.2f,\"heading\":null}",
                sid, lat, lng, acc, spd
            );

            URL url = new URL(API_BASE + "/api/staff/gps-track");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "TMGStaffApp/1.0");
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }
            conn.setDoOutput(true);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(15_000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            Log.d(TAG, "GPS sent: HTTP " + code + "  lat=" + lat + " lng=" + lng);
            conn.disconnect();
        } catch (Exception e) {
            Log.w(TAG, "GPS post failed: " + e.getMessage());
        }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "TMG Location Tracking", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps location active during your shift");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TMG Install — Shift Active")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_tmg)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(pi)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(text));
    }
}
