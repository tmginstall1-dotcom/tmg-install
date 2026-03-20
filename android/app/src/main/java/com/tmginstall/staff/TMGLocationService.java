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

    private static final String TAG             = "TMGLocationService";
    private static final String CHANNEL_ID      = "tmg_location";
    private static final int    NOTIFICATION_ID = 9001;
    private static final String API_BASE        = "https://tmg-install-project--tmginstall.replit.app";

    // GPS fires every 30 s. Send to server at most once per 30 s.
    private static final long GPS_INTERVAL_MS  = 30_000L;
    private static final long SEND_INTERVAL_MS = 30_000L;

    // Watchdog: re-register location updates every 2 minutes in case the
    // FusedLocationProvider silently drops the callback (common on Samsung/Xiaomi)
    private static final long WATCHDOG_MS = 120_000L;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback            locationCallback;
    private HandlerThread               locationThread;
    private Handler                     watchdogHandler;
    private ExecutorService             networkExecutor;
    private PowerManager.WakeLock       wakeLock;

    private int    staffId       = -1;
    private long   lastSentAt    = 0;
    private long   lastCallbackAt = 0;   // when we last got ANY location callback
    private String sessionCookie = "";

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();

        networkExecutor = Executors.newSingleThreadExecutor();

        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        staffId       = prefs.getInt("staff_id", -1);
        sessionCookie = prefs.getString(TMGLocationPlugin.PREF_SESSION_COOKIE, "");

        // PARTIAL_WAKE_LOCK keeps the CPU alive through Doze / screen-off
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "TMGInstall:LocationWakeLock"
            );
            wakeLock.acquire();
        }

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                lastCallbackAt = System.currentTimeMillis();
                for (Location loc : result.getLocations()) {
                    onNewLocation(loc);
                }
            }
        };

        // Dedicated thread so the main looper throttling on screen-off never blocks us
        locationThread = new HandlerThread("TMGLocationThread");
        locationThread.start();

        registerLocationUpdates();

        // Watchdog: every 2 minutes, check if callbacks have stopped and re-register
        watchdogHandler = new Handler(locationThread.getLooper());
        scheduleWatchdog();

        Log.d(TAG, "Service started — staffId=" + staffId);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int newId = intent.getIntExtra("staff_id", -1);
            if (newId >= 0) {
                staffId = newId;
                getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE)
                    .edit().putInt("staff_id", staffId).apply();
            }
        }
        // START_STICKY: OS will restart the service with a null intent if killed
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (watchdogHandler != null) watchdogHandler.removeCallbacksAndMessages(null);
        if (networkExecutor != null) networkExecutor.shutdownNow();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (locationThread != null) locationThread.quitSafely();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        Log.d(TAG, "Service destroyed");
    }

    @Nullable @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Location registration ─────────────────────────────────────────────────

    private void registerLocationUpdates() {
        try {
            LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, GPS_INTERVAL_MS
            )
            // NO setMinUpdateDistanceMeters — that filter blocks stationary updates.
            // We want a fix every 30 s regardless of whether the device moved.
            .setMaxUpdateDelayMillis(GPS_INTERVAL_MS * 2)
            .setWaitForAccurateLocation(false)
            .build();

            fusedLocationClient.removeLocationUpdates(locationCallback);
            fusedLocationClient.requestLocationUpdates(request, locationCallback,
                locationThread.getLooper());

            Log.d(TAG, "Location updates registered — interval=" + GPS_INTERVAL_MS + "ms");
        } catch (SecurityException e) {
            Log.w(TAG, "Location permission denied: " + e.getMessage());
            stopSelf();
        }
    }

    // ── Watchdog ──────────────────────────────────────────────────────────────

    private void scheduleWatchdog() {
        watchdogHandler.postDelayed(this::runWatchdog, WATCHDOG_MS);
    }

    private void runWatchdog() {
        long silentMs = System.currentTimeMillis() - lastCallbackAt;
        Log.d(TAG, "Watchdog — silent for " + silentMs / 1000 + "s");

        // If no callback in the last 2 watchdog cycles, re-register location updates
        if (lastCallbackAt == 0 || silentMs > WATCHDOG_MS) {
            Log.w(TAG, "Watchdog: no callbacks — re-registering location updates");
            registerLocationUpdates();
        }

        scheduleWatchdog(); // chain next watchdog
    }

    // ── Location event ────────────────────────────────────────────────────────

    private void onNewLocation(Location loc) {
        // Broadcast to JS layer while app is in foreground
        Intent broadcast = new Intent(TMGLocationPlugin.LOCATION_BROADCAST);
        broadcast.setPackage(getPackageName());
        broadcast.putExtra("lat",  loc.getLatitude());
        broadcast.putExtra("lng",  loc.getLongitude());
        broadcast.putExtra("accuracy", loc.getAccuracy());
        broadcast.putExtra("speed", loc.hasSpeed() ? loc.getSpeed() : 0f);
        broadcast.putExtra("time", loc.getTime());
        sendBroadcast(broadcast);

        if (staffId < 0) return;

        // Time-only throttle: send at most once per SEND_INTERVAL_MS
        // Do NOT gate on distance — staff may be stationary all day inside a flat
        long now = System.currentTimeMillis();
        if (now - lastSentAt < SEND_INTERVAL_MS) return;
        lastSentAt = now;

        final int   sid = staffId;
        final float lat = (float) loc.getLatitude();
        final float lng = (float) loc.getLongitude();
        final float acc = loc.getAccuracy();
        final float spd = loc.hasSpeed() ? loc.getSpeed() : 0f;
        final String cookie = sessionCookie;

        networkExecutor.submit(() -> postGpsPoint(sid, lat, lng, acc, spd, cookie));
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private void postGpsPoint(int sid, float lat, float lng, float acc, float spd, String cookie) {
        try {
            String body = String.format(
                "{\"staffId\":%d,\"lat\":\"%s\",\"lng\":\"%s\",\"accuracy\":%s,\"speed\":%s,\"heading\":null}",
                sid,
                String.valueOf(lat),
                String.valueOf(lng),
                String.valueOf(acc),
                String.valueOf(spd)
            );

            URL url = new URL(API_BASE + "/api/staff/gps-track");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "TMGStaffApp");
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
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
                CHANNEL_ID, "TMG Location Tracking", NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("Keeps location active during your shift");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TMG Install — Shift Active")
            .setContentText("Location tracking is on during your shift")
            .setSmallIcon(R.drawable.ic_stat_tmg)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .build();
    }
}
