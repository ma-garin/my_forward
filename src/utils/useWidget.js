import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getDataVersion } from './ccStorage'
import { weeklyLivingSummary } from './livingSummary'

/**
 * ホーム画面ウィジェットに今週の生活費を渡す。
 *
 * ウィジェットは別プロセスから描かれるので localStorage を読めない。
 * 計算はここ（アプリ側）で済ませ、結果だけを渡す。
 *
 * 渡すのはデータが変わったときだけ。毎回書くと、ウィジェットの貼り直しが
 * そのぶん走る。
 */

const WidgetBridge = registerPlugin('WidgetBridge')

const isAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WidgetBridge')

export async function pushWidget() {
  if (!isAvailable()) return
  const { used, budget, remain, pct, from, to } = weeklyLivingSummary()
  try {
    await WidgetBridge.updateLiving({
      used: Math.round(used),
      budget: Math.round(budget),
      remain: Math.round(remain),
      pct: Math.round(pct),
      from,
      to,
    })
  } catch {
    // ウィジェットが置かれていないときなど。家計簿としては動くので黙って続ける
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
