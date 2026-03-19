package com.tmginstall.staff;

import android.app.AlertDialog;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "TMGMainActivity";
    private static final String CRASH_FILE = "tmg_last_crash.txt";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Show any crash from the previous launch BEFORE setting a new handler
        showPreviousCrashIfAny();

        // Install crash reporter — writes crash to file so next launch can show it
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            StringWriter sw = new StringWriter();
            throwable.printStackTrace(new PrintWriter(sw));
            String msg = "Thread: " + thread.getName() + "\n" + sw;
            Log.e(TAG, "UNCAUGHT EXCEPTION: " + msg);
            try {
                File f = new File(getFilesDir(), CRASH_FILE);
                try (FileWriter fw = new FileWriter(f, false)) {
                    fw.write(msg);
                }
            } catch (Exception ignored) {}
            // Let the default handler terminate the process
            android.os.Process.killProcess(android.os.Process.myPid());
        });

        registerPlugin(TMGLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    private void showPreviousCrashIfAny() {
        try {
            File f = new File(getFilesDir(), CRASH_FILE);
            if (!f.exists()) return;
            StringBuilder sb = new StringBuilder();
            try (FileReader fr = new FileReader(f)) {
                char[] buf = new char[4096];
                int n;
                while ((n = fr.read(buf)) != -1) sb.append(buf, 0, n);
            }
            f.delete();
            String text = sb.toString();
            if (text.isEmpty()) return;
            // Show in a dialog (must be after Activity is ready enough for dialogs)
            runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("Crash Report (send to dev)")
                .setMessage(text.length() > 2000 ? text.substring(0, 2000) + "…" : text)
                .setPositiveButton("OK", null)
                .show());
        } catch (Exception e) {
            Log.w(TAG, "Could not read crash file: " + e.getMessage());
        }
    }
}
