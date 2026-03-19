package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TMGLocation")
public class TMGLocationPlugin extends Plugin {

    public static final String LOCATION_BROADCAST = "com.tmginstall.staff.LOCATION_UPDATE";

    private BroadcastReceiver locationReceiver;
    private boolean receiverRegistered = false;

    @Override
    public void load() {
        // Intentionally empty — receiver is registered lazily in startWatching()
        // to avoid SecurityException on Android 12+ during app startup.
    }

    private void registerLocationReceiver() {
        if (receiverRegistered) return;

        locationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("lat", intent.getDoubleExtra("lat", 0));
                data.put("lng", intent.getDoubleExtra("lng", 0));
                data.put("accuracy", (double) intent.getFloatExtra("accuracy", 0));
                data.put("speed", (double) intent.getFloatExtra("speed", 0));
                data.put("time", intent.getLongExtra("time", System.currentTimeMillis()));
                notifyListeners("location", data, true);
            }
        };

        IntentFilter filter = new IntentFilter(LOCATION_BROADCAST);
        // ContextCompat.registerReceiver handles the RECEIVER_NOT_EXPORTED flag
        // correctly on all Android versions (including Android 12 / API 31+).
        ContextCompat.registerReceiver(
            getContext(),
            locationReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
        receiverRegistered = true;
    }

    @PluginMethod
    public void startWatching(PluginCall call) {
        // Register receiver here (lazily) to avoid startup crash on Android 12+
        registerLocationReceiver();

        Intent serviceIntent = new Intent(getContext(), TMGLocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), TMGLocationService.class);
        getContext().stopService(serviceIntent);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (receiverRegistered && locationReceiver != null) {
            try {
                getContext().unregisterReceiver(locationReceiver);
            } catch (Exception ignored) {}
            receiverRegistered = false;
        }
        Intent serviceIntent = new Intent(getContext(), TMGLocationService.class);
        getContext().stopService(serviceIntent);
    }
}
