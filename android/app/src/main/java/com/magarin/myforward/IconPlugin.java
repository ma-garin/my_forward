package com.magarin.myforward;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ホーム画面のアイコンを切り替える。
 *
 * Android はインストール済みアプリのアイコンを差し替えられない。できるのは
 * 「アイコンだけ違う入口（activity-alias）を manifest に並べておき、有効な
 * ものを 1 つだけにする」こと。任意の画像は指定できず、用意した候補から選ぶ。
 *
 * 「今どのアイコンか」の出どころは、この有効・無効の状態そのもの（端末が
 * 覚えている）。アプリ側で別に控えると、入れ直しや復元で食い違う。
 */
@CapacitorPlugin(name = "AppIcon")
public class IconPlugin extends Plugin {

    // manifest の activity-alias と対応する。並びもここが基準
    private static final String[] ALIASES = {
        "IconDefault", "IconMidnight", "IconIndigo", "IconWine",
    };

    private ComponentName componentFor(String alias) {
        return new ComponentName(getContext().getPackageName(),
            getContext().getPackageName() + "." + alias);
    }

    private boolean isEnabled(PackageManager pm, String alias) {
        int state = pm.getComponentEnabledSetting(componentFor(alias));
        if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return true;
        // 一度も切り替えていなければ manifest の既定（IconDefault だけ有効）
        return state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
            && ALIASES[0].equals(alias);
    }

    /** 今ホーム画面に出ている入口を返す */
    @PluginMethod
    public void get(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String current = ALIASES[0];
        for (String alias : ALIASES) {
            if (isEnabled(pm, alias)) {
                current = alias;
                break;
            }
        }
        JSObject result = new JSObject();
        result.put("id", current);
        call.resolve(result);
    }

    /**
     * 指定した入口だけを有効にする。
     *
     * 先に目的のものを有効にしてから、他を無効にする。逆順にすると
     * 一瞬どれも有効でない状態ができ、ホーム画面からアイコンが消える。
     */
    @PluginMethod
    public void set(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id が指定されていません");
            return;
        }
        boolean known = false;
        for (String alias : ALIASES) {
            if (alias.equals(id)) known = true;
        }
        if (!known) {
            call.reject("知らないアイコンです: " + id);
            return;
        }

        PackageManager pm = getContext().getPackageManager();
        pm.setComponentEnabledSetting(componentFor(id),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP);

        for (String alias : ALIASES) {
            if (alias.equals(id)) continue;
            pm.setComponentEnabledSetting(componentFor(alias),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
        }

        JSObject result = new JSObject();
        result.put("id", id);
        call.resolve(result);
    }
}
