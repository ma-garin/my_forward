package com.magarin.myforward;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * ダウンロード済みの APK をインストーラに渡す。
 *
 * ストア配布ではないので自動更新が来ない。ダウンロードは @capacitor/filesystem の
 * downloadFile（ネイティブで書き込むので 13MB でもブリッジを通らない）が行い、
 * ここは受け取ったファイルをインストーラに渡すだけにしている。
 *
 * Android 8 以降、「提供元不明のアプリ」の許可はアプリごと。許可が無いと
 * インストーラは何も出さずに戻ってしまうため、渡す前に確認できるようにしておく。
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String APK_MIME = "application/vnd.android.package-archive";

    /** このアプリから APK をインストールしてよいか */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canRequestInstalls());
        call.resolve(result);
    }

    /** 「提供元不明のアプリ」の許可画面を開く（ユーザー自身に許可してもらう） */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * APK をインストーラに渡す。
     * path は downloadFile が返す絶対パス。file:// を付けて渡すと Android 7 以降は
     * FileUriExposedException になるので、FileProvider の content:// に変換する。
     */
    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("インストールするファイルがありません");
            return;
        }

        // file:///... で渡ってきても拾えるようにしておく
        Uri parsed = Uri.parse(path);
        File apk = new File("file".equals(parsed.getScheme()) ? parsed.getPath() : path);
        if (!apk.exists() || apk.length() == 0) {
            call.reject("ダウンロードしたファイルが見つかりません");
            return;
        }

        if (!canRequestInstalls()) {
            call.reject("提供元不明のアプリのインストールが許可されていません");
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_MIME);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("インストーラを開けませんでした: " + e.getLocalizedMessage(), e);
        }
    }

    /** Android 7 以前はアプリ単位の許可が無く、端末全体の設定に従う */
    private boolean canRequestInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }
}
