package com.magarin.myforward;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 取得した通知の保存先。
 *
 * 通知はアプリが閉じている間に届くので、WebView 側の localStorage には置けない。
 * ネイティブ側の SharedPreferences に即書きし、アプリを開いたときに読み出す。
 *
 * 解析用の下調べが目的なので DB は使わず、JSON 配列を 1 キーに入れるだけにする。
 * 無制限に貯めると SharedPreferences が肥大するため、新しい順に MAX_RECORDS 件で打ち切る。
 */
final class NotificationStore {

    private static final String PREFS = "notification_capture";
    private static final String KEY_RECORDS = "records";
    private static final String KEY_ALLOWED = "allowed_packages";
    private static final int MAX_RECORDS = 300;

    private NotificationStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** 記録を新しい順で返す */
    static JSONArray getRecords(Context context) {
        String raw = prefs(context).getString(KEY_RECORDS, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** 先頭（＝最新）に 1 件足して、上限を超えた古い分を捨てる */
    static synchronized void addRecord(Context context, JSONObject record) {
        JSONArray current = getRecords(context);
        JSONArray next = new JSONArray();
        next.put(record);
        for (int i = 0; i < current.length() && next.length() < MAX_RECORDS; i++) {
            next.put(current.opt(i));
        }
        prefs(context).edit().putString(KEY_RECORDS, next.toString()).apply();
    }

    static void clearRecords(Context context) {
        prefs(context).edit().remove(KEY_RECORDS).apply();
    }

    /**
     * 記録するパッケージ名。空なら全部記録する。
     * 最初はどのアプリがどんな文面で通知するか分からないので、既定は「全部」。
     * 送信元が分かったら絞り込んで、無関係な通知を貯めないようにする。
     */
    static JSONArray getAllowedPackages(Context context) {
        String raw = prefs(context).getString(KEY_ALLOWED, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void setAllowedPackages(Context context, JSONArray packages) {
        prefs(context).edit().putString(KEY_ALLOWED, packages.toString()).apply();
    }

    static boolean isAllowed(Context context, String packageName) {
        JSONArray allowed = getAllowedPackages(context);
        if (allowed.length() == 0) return true;
        for (int i = 0; i < allowed.length(); i++) {
            if (packageName.equals(allowed.optString(i))) return true;
        }
        return false;
    }
}
