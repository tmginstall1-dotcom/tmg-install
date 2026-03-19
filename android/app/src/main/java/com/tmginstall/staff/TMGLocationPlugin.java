package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
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
    static final String PREFS = "tmg_location_prefs";

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
        // Persist tracking state so BootReceiver and service can survive app kill
        int staffId = call.getInt("staffId", -1);
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("tracking_active", true)
            .putInt("staff_id", staffId)
            .apply();

        registerLocationReceiver();

        Intent serviceIntent = new Intent(getContext(), TMGLocationService.class);
        serviceIntent.putExtra("staff_id", staffId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        // Clear persisted tracking state
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("tracking_active", false)
            .putInt("staff_id", -1)
            .apply();

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
        // NOTE: do NOT stop the service here — it should keep running in background
        // when the app is backgrounded. Only stopWatching() clears it.
    }
}
