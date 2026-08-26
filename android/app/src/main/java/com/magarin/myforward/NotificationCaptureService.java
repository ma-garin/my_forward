package com.magarin.myforward;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONObject;

/**
 * 他アプリの通知を受け取って、そのまま記録するだけのサービス。
 *
 * 文面は決め打ちのキーだけでなく extras 全体から拾う（NotificationText）。
 * キーを数え上げると、数え漏れたアプリの通知が「時刻だけの空行」になる。
 *
 * このサービスは「通知へのアクセス」を端末の設定で許可しないと動かない。
 * 許可は実行時ダイアログではなく設定画面での操作が必要（Plugin 側から開く）。
 */
public class NotificationCaptureService extends NotificationListenerService {

    private static final String TAG = "NotificationCapture";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || sbn.getNotification() == null) return;

            Notification notification = sbn.getNotification();

            // 常駐通知（音楽再生・ダウンロード中など）とグループの見出しは中身がないので捨てる
            if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
            if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            String packageName = sbn.getPackageName();
            if (packageName == null) return;
            if (packageName.equals(getPackageName())) return; // 自分の通知は無視
            if (!NotificationStore.isAllowed(this, packageName)) return;

            Bundle extras = notification.extras;

            JSONObject record = new JSONObject();
            record.put("packageName", packageName);
            record.put("postTime", sbn.getPostTime());
            record.put("title", text(extras, Notification.EXTRA_TITLE));
            record.put("text", text(extras, Notification.EXTRA_TEXT));
            record.put("bigText", text(extras, Notification.EXTRA_BIG_TEXT));
            record.put("subText", text(extras, Notification.EXTRA_SUB_TEXT));
            record.put("infoText", text(extras, Notification.EXTRA_INFO_TEXT));
            record.put("ticker", notification.tickerText == null ? "" : notification.tickerText.toString());
            // 上の 6 個は決め打ちのキー。別の入れ物を使うアプリはそこに何も入れない
            // （MyJCB の利用通知が実際に空で記録された）。取りこぼさないよう、
            // extras に入っている文字を全部拾ったものも一緒に持つ。
            record.put("allText", NotificationText.collect(extras));

            NotificationStore.addRecord(this, record);
        } catch (Exception e) {
            // 通知の取りこぼしでアプリを落とさない。1 件失敗しても次を受け続ける。
            Log.w(TAG, "通知の記録に失敗しました", e);
        }
    }

    private static String text(Bundle extras, String key) {
        if (extras == null) return "";
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }
}
