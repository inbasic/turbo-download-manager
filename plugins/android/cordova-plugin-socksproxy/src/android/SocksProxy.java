package com.add0n.plugin;

import android.content.Context;
import android.content.Intent;
import android.net.Proxy;
import android.util.ArrayMap;

import java.lang.System;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class SocksProxy extends CordovaPlugin {
    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        if ("set".equals(action)) {
            set(args, callbackContext);
            return true;
        }
        else if ("clear".equals(action)) {
            clear(args, callbackContext);
            return true;
        }
        return false;
    }

    private void set(final CordovaArgs args, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                JSONObject details;
                try {
                    details = args.getJSONObject(0);
                }
                catch (JSONException e) {
                    callbackContext.error("Failed to parse details as JSON");
                    return;
                }

                try {
                    if (details.has("host") && details.has("port")) {
                        String host = details.getString("host");
                        String port = details.getString("port");

                        System.setProperty("socksProxyHost", host);
                        System.setProperty("socksProxyPort", port);
                        onSettingsChanged();
                    }
                    else {
                        callbackContext.error("Missing host or port");
                        return;
                    }
                }
                catch (JSONException e) {
                    callbackContext.error("Failed to parse host or port");
                    return;
                }
                callbackContext.success();
            }
        });
    }

    private void clear(final CordovaArgs args, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                System.clearProperty("socksProxyHost");
                System.clearProperty("socksProxyPort");
                onSettingsChanged();
                callbackContext.success();
            }
        });
    }

    private void onSettingsChanged() {
        Context appContext = this.cordova.getActivity().getApplicationContext();
        // See http://stackoverflow.com/questions/32245972/android-webview-non-fqdn-urls-not-routing-through-proxy-on-lollipop
        // and https://crbug.com/525945 for the source of this pattern.
        try {
            Class<?> applicationClass = Class.forName("android.app.Application");
            Field mLoadedApkField = applicationClass.getDeclaredField("mLoadedApk");
            mLoadedApkField.setAccessible(true);
            Object mloadedApk = mLoadedApkField.get(appContext);
            Class<?> loadedApkClass = Class.forName("android.app.LoadedApk");
            Field mReceiversField = loadedApkClass.getDeclaredField("mReceivers");
            mReceiversField.setAccessible(true);
            ArrayMap<?, ?> receivers = (ArrayMap<?, ?>) mReceiversField.get(mloadedApk);
            for (Object receiverMap : receivers.values()) {
                for (Object receiver : ((ArrayMap<?, ?>) receiverMap).keySet()) {
                    Class<?> clazz = receiver.getClass();
                    if (clazz.getName().contains("ProxyChangeListener")) {
                        Method onReceiveMethod = clazz.getDeclaredMethod("onReceive",
                                Context.class, Intent.class);
                        Intent intent = new Intent(Proxy.PROXY_CHANGE_ACTION);
                        onReceiveMethod.invoke(receiver, appContext, intent);
                    }
                }
            }
        } catch (Exception e) {
            // TODO
        }
    }

}
