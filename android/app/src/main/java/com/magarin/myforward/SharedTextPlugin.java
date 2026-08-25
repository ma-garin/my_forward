package com.magarin.myforward;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 他アプリの共有シートから渡ってきた文面を WebView 側へ渡す。
 *
 * Capacitor は URL の起動（appUrlOpen）は扱うが、ACTION_SEND の EXTRA_TEXT を
 * 読む口を持っていない。そこだけをここで補う。文面の解析は JS 側で行う。
 *
 * 起動のされ方で経路が 2 つある。
 *  - アプリが止まっていた: 起動 Intent に入っているので load() で拾い、
 *    WebView の準備ができてから consume() で取りに来てもらう
 *  - すでに動いていた: handleOnNewIntent に届くので、その場で通知する
 */
@CapacitorPlugin(name = "SharedText")
public class SharedTextPlugin extends Plugin {

    private static final String EVENT_SHARED_TEXT = "sharedText";

    /** 起動時に受け取った文面。取りに来られたら手放す */
    private String pending;

    @Override
    public void load() {
        pending = extractText(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String text = extractText(intent);
        if (text == null) return;

        JSObject data = new JSObject();
        data.put("text", text);
        notifyListeners(EVENT_SHARED_TEXT, data);
    }

    /** 起動時の文面を 1 回だけ渡す。2 回目以降は null */
    @PluginMethod
    public void consume(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", pending);
        pending = null;
        call.resolve(result);
    }

    private static String extractText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null) return null;
        String value = text.toString().trim();
        return value.isEmpty() ? null : value;
    }
}
