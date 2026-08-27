package com.magarin.myforward;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/**
 * ホーム画面ウィジェット（支出を追加）。
 *
 * 押すと支出の入力画面へ直行するだけのボタン。数字を持たないので
 * アプリからの更新は要らず、置いた瞬間から古くならない。
 */
public class AddWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_add);
        views.setOnClickPendingIntent(R.id.widget_root,
            WidgetCommon.open(context, "myforward://add", 30));
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, views);
        }
    }
}
