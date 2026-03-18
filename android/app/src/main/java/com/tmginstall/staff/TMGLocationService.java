package com.tmginstall.staff;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

public class TMGLocationService extends Service {

    private static final String CHANNEL_ID = "tmg_location";
    private static final int NOTIFICATION_ID = 9001;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    @Override
    public void onCreate() {
        super.onCreate();

        // Must call startForeground() quickly (within 10 s on Android 8+)
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                for (Location loc : result.getLocations()) {
                    Intent broadcast = new Intent(TMGLocationPlugin.LOCATION_BROADCAST);
                    broadcast.setPackage(getPackageName());
                    broadcast.putExtra("lat", loc.getLatitude());
                    broadcast.putExtra("lng", loc.getLongitude());
                    broadcast.putExtra("accuracy", loc.getAccuracy());
                    broadcast.putExtra("speed", loc.hasSpeed() ? loc.getSpeed() : 0f);
                    broadcast.putExtra("time", loc.getTime());
                    sendBroadcast(broadcast);
                }
            }
        };

        startLocationUpdates();
    }

    private void startLocationUpdates() {
        try {
            // Request high-accuracy updates every 15 s, minimum 15 m movement
            LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 15_000L
            )
            .setMinUpdateDistanceMeters(15f)
            .setMaxUpdateDelayMillis(30_000L)
            .build();

            fusedLocationClient.requestLocationUpdates(
                request, locationCallback, Looper.getMainLooper()
            );
        } catch (SecurityException ignored) {
            // Permission not granted — service will stop itself on next command
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // START_STICKY restarts the service if the OS kills it
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "TMG Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Active location tracking during your job");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("TMG Install \u2014 Location Active")
                .setContentText("Tracking your location for the active job")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .build();
        } else {
            return new Notification.Builder(this)
                .setContentTitle("TMG Install \u2014 Location Active")
                .setContentText("Tracking your location for the active job")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW)
                .build();
        }
    }
}
