package com.magarin.myforward;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * ホーム画面ウィジェット（未確定の支出）。
 *
 * カード利用通知から作った下書きが何件たまっているかを出す。放置すると
 * 家計に入らないままなので、ホーム画面で気づけるようにする。
 *
 * 件数は増えるだけ古くなることはない（アプリが取り込んだ時点の値で、
 * 実際にはもっと増えている可能性がある）。少なく出る方向にしか外れないので、
 * 生活費や今月の支出のような「期限切れ」の扱いは要らない。
 */
public class InboxWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "widget_inbox";
    static final String KEY_COUNT = "count";
    static final String KEY_TOTAL = "total";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    static void refreshAll(Context context) {
        WidgetCommon.refresh(context, InboxWidgetProvider.class, buildViews(context));
    }

    private static RemoteViews buildViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_inbox);

        if (!prefs.contains(KEY_COUNT)) {
            views.setTextViewText(R.id.widget_value, "—");
            views.setTextViewText(R.id.widget_sub, "アプリを開いてください");
        } else {
            int count = prefs.getInt(KEY_COUNT, 0);
            views.setTextViewText(R.id.widget_value, count == 0 ? "なし" : count + "件");
            views.setTextViewText(R.id.widget_sub, count == 0
                ? "取り込み待ちはありません"
                : "合計 " + WidgetCommon.yen(prefs.getInt(KEY_TOTAL, 0)));
        }

        views.setOnClickPendingIntent(R.id.widget_root, WidgetCommon.open(context, null, 20));
        return views;
    }
}
