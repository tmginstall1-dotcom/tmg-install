package com.tmginstall.staff;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * Receives the 5-minute AlarmManager keepalive intent.
 * If tracking_active is true it (re)starts TMGLocationService.
 * This fires even in Doze mode via setExactAndAllowWhileIdle, so it acts
 * as a belt-and-suspenders restart when Android kills the service.
 */
public class TMGAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "TMGAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(
            TMGLocationPlugin.PREFS, Context.MODE_PRIVATE);
        boolean active = prefs.getBoolean("tracking_active", false);
        int staffId    = prefs.getInt("staff_id", -1);

        Log.d(TAG, "Alarm fired — tracking_active=" + active + " staffId=" + staffId);

        if (!active || staffId < 0) return;

        Intent svcIntent = new Intent(context, TMGLocationService.class);
        svcIntent.putExtra("staff_id", staffId);
        svcIntent.putExtra("from_alarm", true);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svcIntent);
            } else {
                context.startService(svcIntent);
            }
            Log.d(TAG, "Service (re)started from alarm");
        } catch (Exception e) {
            Log.w(TAG, "Could not start service: " + e.getMessage());
        }
    }
}
