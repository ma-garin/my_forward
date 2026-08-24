import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android の戻るキーを履歴に繋ぐ。
 *
 * Capacitor 8 の Android には戻るキーの処理が入っていない。何もしないと
 * アクティビティがそのまま終了するので、支出追加や設定を開いていても
 * アプリごと閉じてしまう（history.pushState はブラウザでしか効かない）。
 *
 * 画面を開くときに履歴を積んであるので、戻れるうちは履歴を辿り、
 * 積みがなくなった＝一番上の画面まで戻ったらアプリを閉じる。
 * ブラウザではブラウザ自身が戻るを扱うため、何も登録しない。
 */
export function useAndroidBack() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let handle
    let cancelled = false
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else App.exitApp()
    }).then((h) => {
      if (cancelled) h.remove()
      else handle = h
    })

    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [])
}
