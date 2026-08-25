package com.magarin.myforward;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * ホーム画面ウィジェット（今週の生活費）。
 *
 * ウィジェットは別プロセスから描かれるので WebView の localStorage は読めない。
 * アプリ側が計算した結果を SharedPreferences に写しておき、ここはそれを
 * 貼るだけにしている（書き込みは WidgetBridgePlugin）。
 *
 * 中身はアプリが最後に書いた時点の値。週が変わると「今週」の意味がずれるため、
 * 保存した週の範囲に今日が入っていなければ数字を出さず、開いて更新するよう促す。
 */
public class LivingWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "widget_living";
    static final String KEY_USED = "used";
    static final String KEY_BUDGET = "budget";
    static final String KEY_REMAIN = "remain";
    static final String KEY_PCT = "pct";
    static final String KEY_WEEK_FROM = "weekFrom";
    static final String KEY_WEEK_TO = "weekTo";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    /** アプリ側から数字が変わったときに呼ぶ */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, LivingWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids.length == 0) return;
        manager.updateAppWidget(ids, buildViews(context));
    }

    private static RemoteViews buildViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_living);

        boolean fresh = isCurrentWeek(prefs);
        boolean hasData = prefs.contains(KEY_USED);

        if (hasData && fresh) {
            int budget = prefs.getInt(KEY_BUDGET, 0);
            views.setTextViewText(R.id.widget_value, budget > 0
                ? "残り " + yen(prefs.getInt(KEY_REMAIN, 0))
                : yen(prefs.getInt(KEY_USED, 0)));
            views.setTextViewText(R.id.widget_sub, budget > 0
                ? yen(prefs.getInt(KEY_USED, 0)) + " / " + yen(budget)
                : "予算未設定");
            views.setProgressBar(R.id.widget_bar, 100, clamp(prefs.getInt(KEY_PCT, 0)), false);
            views.setViewVisibility(R.id.widget_bar, budget > 0 ? View.VISIBLE : View.GONE);
        } else {
            // 週が変わったあとは、前の週の数字を「今週」として出さない
            views.setTextViewText(R.id.widget_value, "—");
            views.setTextViewText(R.id.widget_sub, hasData ? "開いて更新" : "アプリを開いてください");
            views.setViewVisibility(R.id.widget_bar, View.GONE);
        }

        views.setOnClickPendingIntent(R.id.widget_root, openIntent(context, null));
        views.setOnClickPendingIntent(R.id.widget_add, openIntent(context, "myforward://add"));
        return views;
    }

    /** 保存した週の範囲に今日が入っているか */
    private static boolean isCurrentWeek(SharedPreferences prefs) {
        String from = prefs.getString(KEY_WEEK_FROM, null);
        String to = prefs.getString(KEY_WEEK_TO, null);
        if (from == null || to == null) return false;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return from.compareTo(today) <= 0 && today.compareTo(to) <= 0;
    }

    private static PendingIntent openIntent(Context context, String data) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (data != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(data));
        }
        // 行き先ごとに requestCode を分ける。同じだと後から作ったほうに置き換わる
        int requestCode = data == null ? 0 : 1;
        return PendingIntent.getActivity(
            context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int clamp(int pct) {
        return Math.max(0, Math.min(100, pct));
    }

    private static String yen(int amount) {
        return "¥" + String.format(Locale.JAPAN, "%,d", amount);
    }
}
