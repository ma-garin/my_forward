package com.magarin.myforward;

import android.os.Bundle;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 通知が持っている文字を、キーを決め打ちせずに全部拾う。
 *
 * 以前は EXTRA_TITLE / EXTRA_TEXT など 6 個のキーだけを読んでいた。
 * その結果、別の入れ物を使うアプリ（InboxStyle の複数行、MessagingStyle の
 * メッセージ配列など）の通知は「時刻だけあって中身が空」の行として記録され、
 * 何が届いたのか分からなかった（MyJCB の利用通知が実際にそうなった）。
 *
 * 拾う場所を数え上げる限り、数え漏れたアプリで同じことが起きる。
 * extras の中身を歩いて、文字であるものを全部集める。
 */
final class NotificationText {

    // 通知 1 件から取る文字数の上限。長い本文で保存領域を食い潰さない
    private static final int MAX_LENGTH = 2000;

    // Bundle の入れ子をたどる深さ。MessagingStyle は Bundle の配列で 1 段深い
    private static final int MAX_DEPTH = 3;

    // 中身ではなく組み立て情報が入っている欄。拾っても解析の役に立たない
    private static final String[] SKIP_SUFFIX = { "template", "appInfo", "Icon", "icon" };

    private NotificationText() {}

    /** extras の中の文字を、重複を除いて改行でつないで返す */
    static String collect(Bundle extras) {
        Set<String> found = new LinkedHashSet<>();
        walk(extras, found, 0);

        StringBuilder sb = new StringBuilder();
        for (String s : found) {
            if (sb.length() + s.length() + 1 > MAX_LENGTH) break;
            if (sb.length() > 0) sb.append('\n');
            sb.append(s);
        }
        return sb.toString();
    }

    private static void walk(Bundle bundle, Set<String> found, int depth) {
        if (bundle == null || depth > MAX_DEPTH) return;
        for (String key : bundle.keySet()) {
            if (skip(key)) continue;
            Object value;
            try {
                value = bundle.get(key);
            } catch (Exception e) {
                continue; // 読めない欄は飛ばす（1 件のために取り込み全体を落とさない）
            }
            add(value, found, depth);
        }
    }

    private static void add(Object value, Set<String> found, int depth) {
        if (value == null || depth > MAX_DEPTH) return;

        if (value instanceof CharSequence) {
            String s = value.toString().trim();
            if (!s.isEmpty()) found.add(s);
            return;
        }
        if (value instanceof Bundle) {
            walk((Bundle) value, found, depth + 1);
            return;
        }
        if (value instanceof Object[]) {
            for (Object v : (Object[]) value) add(v, found, depth + 1);
        }
    }

    private static boolean skip(String key) {
        if (key == null) return true;
        for (String suffix : SKIP_SUFFIX) {
            if (key.endsWith(suffix)) return true;
        }
        return false;
    }
}
