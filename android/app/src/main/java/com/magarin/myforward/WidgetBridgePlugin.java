package com.magarin.myforward;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ホーム画面ウィジェットに出す数字を渡す。
 *
 * ウィジェットは別プロセスから描かれるため WebView の localStorage を読めない。
 * 計算はアプリ側（JS）で済ませ、その結果だけをここで SharedPreferences に写す。
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateLiving(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor editor = context
            .getSharedPreferences(LivingWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit();

        editor.putInt(LivingWidgetProvider.KEY_USED, call.getInt("used", 0));
        editor.putInt(LivingWidgetProvider.KEY_BUDGET, call.getInt("budget", 0));
        editor.putInt(LivingWidgetProvider.KEY_REMAIN, call.getInt("remain", 0));
        editor.putInt(LivingWidgetProvider.KEY_PCT, call.getInt("pct", 0));
        editor.putString(LivingWidgetProvider.KEY_WEEK_FROM, call.getString("from", ""));
        editor.putString(LivingWidgetProvider.KEY_WEEK_TO, call.getString("to", ""));
        editor.apply();

        LivingWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
