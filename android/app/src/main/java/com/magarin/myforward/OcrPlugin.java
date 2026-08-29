package com.magarin.myforward;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 画像から文字を読む（端末内で完結する）。
 *
 * モバイルSuica の利用履歴は CSV に書き出せず、JR 東日本は個人向けの API も
 * 出していない。会員サイトを読みに行く方法は ID・パスワードと画像認証が要り、
 * このアプリの「外と通信しない」という前提を壊す。
 *
 * 残る手が、アプリの利用履歴画面をそのまま読むこと。ML Kit の日本語文字認識を
 * 使う。モデルは Google Play 開発者サービスが持っているので、通信も鍵も要らない。
 *
 * ここは「画像 → 行の並び」までを返す。何の行かの解釈は JS 側で行う。
 */
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    /** 端末で使えるか（Play 開発者サービスが無い端末では false） */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    /**
     * @param call image: data URL（data:image/...;base64,...）または裸の base64
     *             返り値 lines: [{ text, x, y, width, height }]（上から下の順）
     */
    @PluginMethod
    public void recognize(PluginCall call) {
        String image = call.getString("image");
        if (image == null || image.isEmpty()) {
            call.reject("画像がありません");
            return;
        }

        Bitmap bitmap = decode(image);
        if (bitmap == null) {
            call.reject("画像を読めませんでした");
            return;
        }

        TextRecognizer recognizer =
                TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());

        recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(text -> {
                    try {
                        call.resolve(toResult(text, bitmap.getWidth(), bitmap.getHeight()));
                    } catch (Exception e) {
                        call.reject("読み取り結果を組み立てられませんでした", e);
                    } finally {
                        recognizer.close();
                    }
                })
                .addOnFailureListener(e -> {
                    recognizer.close();
                    // モデルがまだ落ちてきていないときもここに来る。
                    // 画面側で「少し待ってもう一度」と出せるよう、理由をそのまま返す
                    call.reject(e.getMessage() == null ? "文字を読めませんでした" : e.getMessage(), e);
                });
    }

    private static Bitmap decode(String image) {
        try {
            int comma = image.indexOf(',');
            String base64 = image.startsWith("data:") && comma >= 0
                    ? image.substring(comma + 1)
                    : image;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
    }

    /** 行を上から下・左から右の順に並べて返す（画面の並びをそのまま渡す） */
    private static JSObject toResult(Text text, int width, int height) {
        List<Text.Line> lines = new ArrayList<>();
        for (Text.TextBlock block : text.getTextBlocks()) {
            lines.addAll(block.getLines());
        }
        Collections.sort(lines, (a, b) -> {
            Rect ra = a.getBoundingBox();
            Rect rb = b.getBoundingBox();
            if (ra == null || rb == null) return 0;
            // 同じ行に並ぶものは y がわずかにずれる。高さの半分までは同じ行とみなす
            int slack = Math.max(8, Math.min(ra.height(), rb.height()) / 2);
            if (Math.abs(ra.top - rb.top) > slack) return Integer.compare(ra.top, rb.top);
            return Integer.compare(ra.left, rb.left);
        });

        JSArray out = new JSArray();
        for (Text.Line line : lines) {
            Rect r = line.getBoundingBox();
            JSObject item = new JSObject();
            item.put("text", line.getText());
            item.put("x", r == null ? 0 : r.left);
            item.put("y", r == null ? 0 : r.top);
            item.put("width", r == null ? 0 : r.width());
            item.put("height", r == null ? 0 : r.height());
            out.put(item);
        }

        JSObject result = new JSObject();
        result.put("lines", out);
        result.put("imageWidth", width);
        result.put("imageHeight", height);
        return result;
    }
}
