package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TMGLocation")
public class TMGLocationPlugin extends Plugin {

    public static final String LOCATION_BROADCAST = "com.tmginstall.staff.LOCATION_UPDATE";

    private BroadcastReceiver locationReceiver;

    @Override
    public void load() {
        // Only registers a broadcast receiver — no service binding, completely safe on all devices
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(locationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(locationReceiver, filter);
        }
    }

    @PluginMethod
    public void startWatching(PluginCall call) {
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
        if (locationReceiver != null) {
            try {
                getContext().unregisterReceiver(locationReceiver);
            } catch (Exception ignored) {}
        }
        Intent serviceIntent = new Intent(getContext(), TMGLocationService.class);
        getContext().stopService(serviceIntent);
    }
}
