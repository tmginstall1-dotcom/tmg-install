package com.tmginstall.staff;

import android.app.AlertDialog;
import android.os.Bundle;
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 1. Read any crash from the PREVIOUS launch before we install a new handler
        pendingCrashReport = readAndDeleteCrashFile();

        // 2. Install uncaught-exception reporter BEFORE super.onCreate() so any
        //    crash inside Capacitor bridge init is captured.
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            StringWriter sw = new StringWriter();
            throwable.printStackTrace(new PrintWriter(sw));
            String report = "Thread: " + thread.getName() + "\n" + sw;
            Log.e(TAG, "UNCAUGHT: " + report);
            writeCrashFile(report);
            sendCrashToServer(report);
            android.os.Process.killProcess(android.os.Process.myPid());
        });

        // 3. No custom plugins registered — testing bare Capacitor
        // registerPlugin(TMGLocationPlugin.class);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Show the crash from the previous launch NOW — Activity is fully ready
        if (pendingCrashReport != null && !pendingCrashReport.isEmpty()) {
            String msg = pendingCrashReport;
            pendingCrashReport = null;
            new AlertDialog.Builder(this)
                .setTitle("Crash Report — send to developer")
                .setMessage(msg.length() > 2000 ? msg.substring(0, 2000) + "\n…" : msg)
                .setPositiveButton("OK", null)
                .show();
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
        // Fire-and-forget on the crashing thread (last resort — ignore failures)
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
