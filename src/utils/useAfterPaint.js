import { useState, useEffect } from 'react'

/**
 * 重い集計を「最初の描画のあと」に回すためのフック。
 *
 * 年間サマリー（12 ヶ月）や支出トレンド（6 ヶ月）は localStorage を
 * 何十回も読んで JSON.parse する。これをレンダー中に同期実行すると、
 * タブを開いた瞬間の描画がその分まるごと遅れる（＝タブ切替がもたつく）。
 * 画面を先に出してから計算し、終わり次第差し替える。
 *
 * 返り値は計算前は null。呼び出し側でプレースホルダを出すこと。
 */
export function useAfterPaint(compute, deps) {
  const [value, setValue] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = () => { if (!cancelled) setValue(compute()) }
    // requestIdleCallback があれば空き時間に、なければ次のタスクで
    const ric = typeof requestIdleCallback === 'function'
    const id = ric ? requestIdleCallback(run, { timeout: 300 }) : setTimeout(run, 0)
    return () => {
      cancelled = true
      if (ric) cancelIdleCallback(id)
      else clearTimeout(id)
    }
    // compute は毎レンダー再生成されるため deps から外す（呼び出し側が deps を指定する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}
