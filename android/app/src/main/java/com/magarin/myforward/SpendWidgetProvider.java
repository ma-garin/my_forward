package com.magarin.myforward;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

/**
 * ホーム画面ウィジェット（今月の支出）。
 *
 * 請求月の変動費の合計と、締め日の着地見込みを出す。数字を作れるのは
 * アプリだけなので、ここは SharedPreferences に書かれた結果を貼るだけ。
 *
 * 請求月が変わると「今月」の意味がずれる。アプリが渡したサイクルの終わり
 * （validTo）を過ぎていたら数字を出さず、開いて更新するよう促す。
 */
public class SpendWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "widget_spend";
    static final String KEY_USED = "used";
    static final String KEY_FORECAST = "forecast";
    static final String KEY_REMAIN_DAYS = "remainDays";
    static final String KEY_VALID_TO = "validTo";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    static void refreshAll(Context context) {
        WidgetCommon.refresh(context, SpendWidgetProvider.class, buildViews(context));
    }

    private static RemoteViews buildViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_spend);

        boolean hasData = prefs.contains(KEY_USED);
        String validTo = prefs.getString(KEY_VALID_TO, null);
        boolean fresh = validTo != null && WidgetCommon.today().compareTo(validTo) <= 0;

        if (hasData && fresh) {
            views.setTextViewText(R.id.widget_value, WidgetCommon.yen(prefs.getInt(KEY_USED, 0)));

            int forecast = prefs.getInt(KEY_FORECAST, 0);
            int remainDays = prefs.getInt(KEY_REMAIN_DAYS, 0);
            views.setTextViewText(R.id.widget_sub, forecast > 0
                ? "このペースで " + WidgetCommon.yen(forecast) + "・残り" + remainDays + "日"
                : "締め日まで残り" + remainDays + "日");
            views.setViewVisibility(R.id.widget_sub, View.VISIBLE);
        } else {
            // 前のサイクルの数字を「今月」として出さない
            views.setTextViewText(R.id.widget_value, "—");
            views.setTextViewText(R.id.widget_sub, hasData ? "開いて更新" : "アプリを開いてください");
            views.setViewVisibility(R.id.widget_sub, View.VISIBLE);
        }

        views.setOnClickPendingIntent(R.id.widget_root, WidgetCommon.open(context, null, 10));
        views.setOnClickPendingIntent(R.id.widget_add,
            WidgetCommon.open(context, "myforward://add", 11));
        return views;
    }
}
