package com.tmginstall.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins before super.onCreate() initialises the bridge
        registerPlugin(TMGLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
