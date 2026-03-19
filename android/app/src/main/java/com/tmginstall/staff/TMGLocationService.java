package com.tmginstall.staff;

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
import android.os.IBinder;
import android.os.Looper;
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

    private static final String TAG              = "TMGLocationService";
    private static final String CHANNEL_ID       = "tmg_location";
    private static final int    NOTIFICATION_ID  = 9001;
    private static final String API_BASE         = "https://tmg-install-project--tmginstall.replit.app";

    // Throttle: send at most once per 20 s, or if moved >= 15 m
    private static final long  MIN_INTERVAL_MS = 20_000L;
    private static final float MIN_DISTANCE_M  = 15f;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback            locationCallback;
    private ExecutorService             networkExecutor;

    private int   staffId    = -1;
    private long  lastSentAt = 0;
    private float lastLat    = 0f;
    private float lastLng    = 0f;

    @Override
    public void onCreate() {
        super.onCreate();

        networkExecutor = Executors.newSingleThreadExecutor();

        // Read persisted staffId in case we were restarted by BootReceiver
        SharedPreferences prefs = getSharedPreferences(TMGLocationPlugin.PREFS, MODE_PRIVATE);
        staffId = prefs.getInt("staff_id", -1);

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                for (Location loc : result.getLocations()) {
                    onNewLocation(loc);
                }
            }
        };

        startLocationUpdates();
        Log.d(TAG, "Service started. staffId=" + staffId);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Update staffId if passed via intent (e.g., from fresh startForegroundService call)
        if (intent != null) {
            int newStaffId = intent.getIntExtra("staff_id", -1);
            if (newStaffId >= 0) {
                staffId = newStaffId;
                Log.d(TAG, "onStartCommand: staffId updated to " + staffId);
            }
        }
        // START_STICKY: OS restarts the service with a null intent if killed
        return START_STICKY;
    }

    private void onNewLocation(Location loc) {
        // Broadcast to plugin (for JS layer when app is in foreground)
        Intent broadcast = new Intent(TMGLocationPlugin.LOCATION_BROADCAST);
        broadcast.setPackage(getPackageName());
        broadcast.putExtra("lat", loc.getLatitude());
        broadcast.putExtra("lng", loc.getLongitude());
        broadcast.putExtra("accuracy", loc.getAccuracy());
        broadcast.putExtra("speed", loc.hasSpeed() ? loc.getSpeed() : 0f);
        broadcast.putExtra("time", loc.getTime());
        sendBroadcast(broadcast);

        // Also call API directly — so tracking works even when app is fully closed
        if (staffId < 0) return;

        long now = System.currentTimeMillis();
        float moved = distanceMetres(lastLat, lastLng, (float) loc.getLatitude(), (float) loc.getLongitude());
        if (now - lastSentAt < MIN_INTERVAL_MS && moved < MIN_DISTANCE_M) return;

        lastSentAt = now;
        lastLat    = (float) loc.getLatitude();
        lastLng    = (float) loc.getLongitude();

        final int   sid = staffId;
        final float lat = lastLat;
        final float lng = lastLng;
        final float acc = loc.getAccuracy();
        final float spd = loc.hasSpeed() ? loc.getSpeed() : 0f;

        networkExecutor.submit(() -> postGpsPoint(sid, lat, lng, acc, spd));
    }

    private void postGpsPoint(int sid, float lat, float lng, float acc, float spd) {
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
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            Log.d(TAG, "GPS posted: " + code + " lat=" + lat + " lng=" + lng);
            conn.disconnect();
        } catch (Exception e) {
            Log.w(TAG, "GPS post failed: " + e.getMessage());
        }
    }

    private void startLocationUpdates() {
        try {
            LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 15_000L
            )
            .setMinUpdateDistanceMeters(MIN_DISTANCE_M)
            .setMaxUpdateDelayMillis(30_000L)
            .build();

            fusedLocationClient.requestLocationUpdates(
                request, locationCallback, Looper.getMainLooper()
            );
        } catch (SecurityException e) {
            Log.w(TAG, "Location permission denied: " + e.getMessage());
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (networkExecutor != null) networkExecutor.shutdownNow();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        Log.d(TAG, "Service destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "TMG Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Active location tracking during your job");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager()
            .getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TMG Install — Location Active")
            .setContentText("Tracking your location for the active job")
            .setSmallIcon(R.drawable.ic_stat_tmg)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build();
    }

    // ── Haversine distance ────────────────────────────────────────────────────

    private static float distanceMetres(float lat1, float lng1, float lat2, float lng2) {
        if (lat1 == 0 && lng1 == 0) return Float.MAX_VALUE;
        double R    = 6_371_000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return (float) (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }
}
