import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android の戻るキーの扱い。
 *
 * Capacitor 8 の Android には戻るキーの処理が入っていない。何もしないと
 * アクティビティがそのまま終了するので、支出追加や設定を開いていても
 * アプリごと閉じてしまう（history.pushState はブラウザでしか効かない）。
 *
 * 横取りするのは「自分で閉じる画面が開いているとき」だけにする。
 * 何も開いていなければシステムに任せる。Android 12 以降、ルートでの戻るは
 * アプリを終了せずタスクを背面に送るのが標準で、Android 16 では予測型戻るの
 * アニメーションも付く。ここで finish すると状態が消え、その動きも出ない。
 */

const isNative = () => Capacitor.isNativePlatform()

// 積んだ画面があるか。初期表示の履歴には state が無いので、それで判別できる。
const hasScreen = () => !!window.history.state

function syncBackHandler() {
  if (!isNative()) return
  App.toggleBackButtonHandler({ enabled: hasScreen() }).catch(() => {
    // 戻るの制御に失敗しても画面操作は続けられるので握りつぶす
  })
}

/**
 * 閉じられる画面を開くときは必ずこれを通す。
 * 履歴とシステム側の戻るの扱いを一致させるため、pushState を直接呼ばない。
 */
export function pushScreen(state) {
  window.history.pushState(state, '')
  syncBackHandler()
}

export function useAndroidBack() {
  useEffect(() => {
    if (!isNative()) return

    let handle
    let cancelled = false
    // 有効にしているのは画面が開いているときだけなので、戻れる前提でよい
    App.addListener('backButton', () => window.history.back()).then((h) => {
      if (cancelled) h.remove()
      else handle = h
    })

    const onPop = () => syncBackHandler()
    window.addEventListener('popstate', onPop)
    syncBackHandler()

    return () => {
      cancelled = true
      handle?.remove()
      window.removeEventListener('popstate', onPop)
    }
  }, [])
}
