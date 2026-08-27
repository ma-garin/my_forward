import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getDataVersion } from './ccStorage'
import { livingWidgetData, spendWidgetData, inboxWidgetData } from './widgetData'

/**
 * ホーム画面ウィジェットに数字を渡す。
 *
 * ウィジェットは別プロセスから描かれるので localStorage を読めない。
 * 計算は widgetData.js（アプリ側）で済ませ、ここは渡すだけにする。
 *
 * 渡すのはデータが変わったときだけ。毎回書くと、ウィジェットの貼り直しが
 * そのぶん走る。
 */

const WidgetBridge = registerPlugin('WidgetBridge')

const isAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WidgetBridge')

export async function pushWidget() {
  if (!isAvailable()) return
  try {
    // 1 つ失敗しても他は渡す。ウィジェットが置かれていないものは
    // ネイティブ側が何もしないで返す
    await Promise.all([
      WidgetBridge.updateLiving(livingWidgetData()),
      WidgetBridge.updateSpend(spendWidgetData()),
      WidgetBridge.updateInbox(inboxWidgetData()),
    ])
  } catch {
    // 家計簿としては動くので黙って続ける
  }
}

export function useWidgetSync() {
  useEffect(() => {
    if (!isAvailable()) return
    let seen = -1
    const tick = () => {
      const version = getDataVersion()
      if (version === seen) return
      seen = version
      pushWidget()
    }
    tick()
    const timer = setInterval(tick, 10_000)
    return () => clearInterval(timer)
  }, [])
}
