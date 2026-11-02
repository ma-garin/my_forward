package com.magarin.myforward;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
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
 *
 * **届いた瞬間だけに頼らない。** 端末の省電力でリスナーが切られると、その間の
 * 通知は onNotificationPosted に来ない（VISA の利用通知が通知欄にあるのに
 * 記録に無かった）。アプリを開いたとき（＝記録を読むとき）に、通知欄に
 * 残っている通知を拾い直す。同じ通知は送り主と時刻で見分けて二重に足さない。
 */
public class NotificationCaptureService extends NotificationListenerService {

    private static final String TAG = "NotificationCapture";

    /** つながっているリスナー。切れているあいだは null */
    private static volatile NotificationCaptureService connected;

    @Override
    public void onListenerConnected() {
        connected = this;
        recordActive();
    }

    @Override
    public void onListenerDisconnected() {
        connected = null;
        // 切れたままだと次に許可を入れ直すまで何も届かない。つなぎ直しを頼む
        requestRebind(new ComponentName(this, NotificationCaptureService.class));
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        record(sbn);
    }

    /**
     * 通知欄に今ある通知を記録に足す（記録を読む直前に呼ぶ）。
     * リスナーが切れていれば、つなぎ直しを頼む（つながった時点で拾い直す）。
     */
    static void syncActive(Context context) {
        NotificationCaptureService service = connected;
        if (service != null) {
            service.recordActive();
            return;
        }
        try {
            requestRebind(new ComponentName(context, NotificationCaptureService.class));
        } catch (Exception e) {
            Log.w(TAG, "リスナーのつなぎ直しに失敗しました", e);
        }
    }

    private void recordActive() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active == null) return;
            for (StatusBarNotification sbn : active) record(sbn);
        } catch (Exception e) {
            Log.w(TAG, "通知欄の読み直しに失敗しました", e);
        }
    }

    private void record(StatusBarNotification sbn) {
        try {
            if (sbn == null || sbn.getNotification() == null) return;

            Notification notification = sbn.getNotification();

            // 常駐通知（音楽再生・ダウンロード中など）は中身がないので捨てる。
            // グループの見出しは捨てない。1 件だけの通知を見出しとして出すアプリがあり、
            // 捨てると中身ごと消える。金額の無い見出し（「2件の新着メール」）は
            // 読む側（parseCardNotification）が落とし、同じ買い物は受信箱で 1 件にまとまる
            if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

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
