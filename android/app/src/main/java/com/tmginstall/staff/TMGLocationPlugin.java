package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.CookieManager;

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

    // Key used to store the WebView session cookie so the background service
    // can authenticate its direct HTTP calls to the production server.
    static final String PREF_SESSION_COOKIE = "session_cookie";

    private BroadcastReceiver locationReceiver;
    private boolean receiverRegistered = false;

    @Override
    public void load() {
        // Intentionally empty — receiver registered lazily in startWatching()
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
        int staffId = call.getInt("staffId", -1);

        // Capture the WebView's session cookie so the background service can
        // authenticate its direct HttpURLConnection calls.  CookieManager holds
        // the same cookies that the Capacitor WebView just used to log in.
        String sessionCookie = "";
        try {
            CookieManager cm = CookieManager.getInstance();
            String cookies = cm.getCookie("https://tmg-install-project--tmginstall.replit.app");
            if (cookies != null) sessionCookie = cookies;
        } catch (Exception ignored) {}

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("tracking_active", true)
            .putInt("staff_id", staffId)
            .putString(PREF_SESSION_COOKIE, sessionCookie)
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
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("tracking_active", false)
            .putInt("staff_id", -1)
            .putString(PREF_SESSION_COOKIE, "")
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
        // Do NOT stop the service here — it keeps running when the app is backgrounded.
    }
}
