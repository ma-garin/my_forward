import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { requestQuickAdd } from './quickAdd'
import { parseExpenseText } from './parseExpenseText'

/**
 * アプリの外からの起動を受ける。
 *
 * - ホーム画面のアイコン長押し → 「支出を追加」（myforward://add で入ってくる）
 * - 他アプリの共有シート → 文面から金額を拾って下書きにする
 *
 * 共有シートの文面は Capacitor が扱わない（Intent の EXTRA_TEXT を読む口が
 * 無い）ため、SharedText プラグインをネイティブ側に置いて取りに行く。
 *
 * Web（PWA）にも同じ入り口がある。マニフェストのショートカットが ?add=1 で
 * 開くので、そちらはクエリで受ける。共有シートは Web には無い。
 */

const SharedText = registerPlugin('SharedText')

const isNative = () => Capacitor.isNativePlatform()

const isAddUrl = (url) => typeof url === 'string' && url.startsWith('myforward://add')

/** PWA ショートカットから来たか。URL に残しておくと再読み込みで再び開くので消す */
function takeAddQuery() {
  const url = new URL(window.location.href)
  if (url.searchParams.get('add') !== '1') return false
  url.searchParams.delete('add')
  window.history.replaceState(window.history.state, '', url)
  return true
}

/**
 * @param onBeforeOpen クレカタブへ切り替えるなど、開く前にやること
 */
export function useLaunchIntent(onBeforeOpen) {
  useEffect(() => {
    let cancelled = false
    const handles = []

    const open = (prefill) => {
      if (cancelled) return
      onBeforeOpen?.()
      requestQuickAdd(prefill)
    }

    const openFromText = (text) => {
      if (!text) return
      const { amount, name } = parseExpenseText(text)
      open({ amount: amount > 0 ? String(amount) : '', name })
    }

    if (takeAddQuery()) open({})
    if (!isNative()) return

    // 起動時（コールドスタート）。すでに立ち上がっている場合は下のリスナーが拾う
    App.getLaunchUrl()
      .then((r) => { if (isAddUrl(r?.url)) open({}) })
      .catch(() => { /* 起動 URL が無いだけなので握りつぶす */ })

    SharedText.consume()
      .then((r) => openFromText(r?.text))
      .catch(() => { /* プラグインが無い版でも動くようにする */ })

    const add = (plugin, name, fn) => {
      plugin.addListener(name, fn).then((h) => (cancelled ? h.remove() : handles.push(h)))
    }

    add(App, 'appUrlOpen', ({ url }) => { if (isAddUrl(url)) open({}) })
    add(SharedText, 'sharedText', ({ text }) => openFromText(text))

    return () => {
      cancelled = true
      handles.forEach((h) => h.remove())
    }
  }, [onBeforeOpen])
}
