package com.tmginstall.staff;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "TMGMainActivity";
    private static final String CRASH_FILE = "tmg_last_crash.txt";
    private static final String API_BASE = "https://tmg-install-project--tmginstall.replit.app";

    private String pendingCrashReport = null;
    private boolean batteryPromptShown = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        pendingCrashReport = readAndDeleteCrashFile();

        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            StringWriter sw = new StringWriter();
            throwable.printStackTrace(new PrintWriter(sw));
            String report = "Thread: " + thread.getName() + "\n" + sw;
            Log.e(TAG, "UNCAUGHT: " + report);
            writeCrashFile(report);
            sendCrashToServer(report);
            android.os.Process.killProcess(android.os.Process.myPid());
        });

        registerPlugin(TMGLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();

        // Show crash dialog from previous launch
        if (pendingCrashReport != null && !pendingCrashReport.isEmpty()) {
            String msg = pendingCrashReport;
            pendingCrashReport = null;
            new AlertDialog.Builder(this)
                .setTitle("Crash Report — send to developer")
                .setMessage(msg.length() > 2000 ? msg.substring(0, 2000) + "\n…" : msg)
                .setPositiveButton("OK", null)
                .show();
            return; // don't stack dialogs
        }

        // Ask to disable battery optimisation (only once per session, only if not already granted)
        if (!batteryPromptShown) {
            requestBatteryOptimisationExemption();
            batteryPromptShown = true;
        }
    }

    /**
     * Checks whether this app is already exempt from battery optimisation.
     * If not, fires the system dialog — one tap "Allow" and done. No Settings navigation needed.
     */
    private void requestBatteryOptimisationExemption() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            String pkg = getPackageName();
            if (pm.isIgnoringBatteryOptimizations(pkg)) {
                Log.d(TAG, "Battery optimisation already disabled — GPS will stay active");
                return;
            }
            // Fire the system popup: "Allow TMG Install to always run in the background?"
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + pkg));
            startActivity(intent);
            Log.d(TAG, "Battery optimisation exemption dialog shown");
        } catch (Exception e) {
            Log.w(TAG, "Could not request battery exemption: " + e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String readAndDeleteCrashFile() {
        try {
            File f = new File(getFilesDir(), CRASH_FILE);
            if (!f.exists()) return null;
            StringBuilder sb = new StringBuilder();
            try (FileReader fr = new FileReader(f)) {
                char[] buf = new char[8192];
                int n;
                while ((n = fr.read(buf)) != -1) sb.append(buf, 0, n);
            }
            f.delete();
            return sb.toString().trim();
        } catch (Exception e) {
            Log.w(TAG, "readCrashFile: " + e.getMessage());
            return null;
        }
    }

    private void writeCrashFile(String report) {
        try {
            File f = new File(getFilesDir(), CRASH_FILE);
            try (FileWriter fw = new FileWriter(f, false)) {
                fw.write(report);
            }
        } catch (Exception e) {
            Log.w(TAG, "writeCrashFile: " + e.getMessage());
        }
    }

    private void sendCrashToServer(String report) {
        try {
            String body = "{\"crash\":" + jsonString(report) + "}";
            URL url = new URL(API_BASE + "/api/crash-report");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
            conn.getResponseCode();
            conn.disconnect();
        } catch (Exception ignored) {}
    }

    private static String jsonString(String s) {
        return "\"" + s.replace("\\", "\\\\")
                       .replace("\"", "\\\"")
                       .replace("\n", "\\n")
                       .replace("\r", "\\r") + "\"";
    }
}
