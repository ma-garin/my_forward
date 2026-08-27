package com.magarin.myforward;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * ウィジェット同士で共通の処理。
 *
 * 金額の書き方やタップの行き先をウィジェットごとに書くと、片方だけ直して
 * 見た目や飛び先が食い違う。ここに 1 つだけ置く。
 */
final class WidgetCommon {

    private WidgetCommon() {}

    static String yen(int amount) {
        return "¥" + String.format(Locale.JAPAN, "%,d", amount);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /**
     * アプリを開く。data に myforward:// を渡すとその画面へ直行する。
     * requestCode は行き先ごとに変える（同じだと後から作ったほうに置き換わる）。
     */
    static PendingIntent open(Context context, String data, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (data != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(data));
        }
        return PendingIntent.getActivity(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 置かれているぶんだけ貼り直す。置かれていなければ何もしない */
    static void refresh(Context context, Class<? extends AppWidgetProvider> provider, RemoteViews views) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        if (ids.length == 0) return;
        manager.updateAppWidget(ids, views);
    }
}
