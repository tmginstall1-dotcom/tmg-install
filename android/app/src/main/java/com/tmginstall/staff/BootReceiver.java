package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * Receives BOOT_COMPLETED to restart the location service if tracking was
 * active when the device was shut down.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "TMGBootReceiver";
    private static final String PREFS = "tmg_location_prefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) &&
            !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean wasTracking = prefs.getBoolean("tracking_active", false);
        int staffId = prefs.getInt("staff_id", -1);

        Log.d(TAG, "Boot completed. wasTracking=" + wasTracking + " staffId=" + staffId);

        if (wasTracking && staffId >= 0) {
            Log.d(TAG, "Restarting location service for staffId=" + staffId);
            Intent serviceIntent = new Intent(context, TMGLocationService.class);
            serviceIntent.putExtra("staff_id", staffId);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
