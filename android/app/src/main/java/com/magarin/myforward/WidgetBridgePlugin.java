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

    @PluginMethod
    public void updateSpend(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(SpendWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(SpendWidgetProvider.KEY_USED, call.getInt("used", 0))
            .putInt(SpendWidgetProvider.KEY_FORECAST, call.getInt("forecast", 0))
            .putInt(SpendWidgetProvider.KEY_REMAIN_DAYS, call.getInt("remainDays", 0))
            .putString(SpendWidgetProvider.KEY_VALID_TO, call.getString("validTo", ""))
            .apply();

        SpendWidgetProvider.refreshAll(context);
        call.resolve();
    }

    @PluginMethod
    public void updateInbox(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(InboxWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(InboxWidgetProvider.KEY_COUNT, call.getInt("count", 0))
            .putInt(InboxWidgetProvider.KEY_TOTAL, call.getInt("total", 0))
            .apply();

        InboxWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
