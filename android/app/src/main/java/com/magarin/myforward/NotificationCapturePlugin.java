package com.magarin.myforward;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

/**
 * 通知の取得状況を WebView 側から読むためのブリッジ。
 *
 * 通知そのものの受け取りは NotificationCaptureService が行い、ここは
 * 「許可されているか」「何が取れたか」を渡すだけ。
 */
@CapacitorPlugin(name = "NotificationCapture")
public class NotificationCapturePlugin extends Plugin {

    /**
     * 「通知へのアクセス」が許可されているか。
     *
     * この権限は実行時ダイアログでは取れないので、requestPermissions ではなく
     * 設定に書かれた一覧に自分がいるかで判定する。
     */
    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasNotificationAccess(getContext()));
        call.resolve(result);
    }

    /** 「通知へのアクセス」の設定画面を開く（ユーザー自身に許可してもらう） */
    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** 記録済みの通知を新しい順で返す */
    @PluginMethod
    public void getRecords(PluginCall call) {
        JSObject result = new JSObject();
        result.put("records", NotificationStore.getRecords(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void clearRecords(PluginCall call) {
        NotificationStore.clearRecords(getContext());
        call.resolve();
    }

    /** 記録対象のパッケージ名（空配列＝すべて記録） */
    @PluginMethod
    public void getAllowedPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("packages", NotificationStore.getAllowedPackages(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void setAllowedPackages(PluginCall call) {
        JSONArray packages = call.getArray("packages", new JSONArray());
        NotificationStore.setAllowedPackages(getContext(), packages == null ? new JSONArray() : packages);
        call.resolve();
    }

    private boolean hasNotificationAccess(Context context) {
        String enabled = Settings.Secure.getString(
                context.getContentResolver(), "enabled_notification_listeners");
        if (enabled == null || enabled.isEmpty()) return false;

        ComponentName self = new ComponentName(context, NotificationCaptureService.class);
        for (String entry : enabled.split(":")) {
            ComponentName component = ComponentName.unflattenFromString(entry);
            if (component != null && component.equals(self)) return true;
        }
        return false;
    }
}
