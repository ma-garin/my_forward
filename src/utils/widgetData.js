import { CARDS, CARD_LIST, loadVar } from './ccStorage'
import { currentBillingYm, signedAmount } from './finance'
import { forecastCycle, cycleRange } from './forecast'
import { loadInbox } from './inbox'
import { weeklyLivingSummary } from './livingSummary'

/**
 * ホーム画面ウィジェットに渡す数字を作る。
 *
 * ウィジェットは別プロセスから描かれるので localStorage を読めない。計算は
 * すべてここ（アプリ側）で済ませ、ネイティブには結果だけ渡す。だから
 * 「何を出すか」の判断はこのファイルにしか無く、テストもここで書ける。
 */

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 今の請求月の変動費（全カード合計）と、締め日の着地見込み。
 *
 * 「今月」はアプリの既定表示と同じ JCB の締め日基準。validTo（サイクルの
 * 終わり）も一緒に渡す。ウィジェット側はそれを過ぎていたら数字を出さない
 * （前のサイクルの数字を「今月」として見せないため）。
 */
export function spendWidgetData(now = new Date()) {
  const card = CARDS.jcb
  const ym = currentBillingYm(card?.cutoffDay ?? 15)

  const varTotal = CARD_LIST.reduce(
    (sum, c) => sum + loadVar(c.id, ym).reduce((s, x) => s + signedAmount(x), 0),
    0,
  )

  const fc = forecastCycle({ card, ym, varTotal, now })
  const { end } = cycleRange(card, ym)

  return {
    ym,
    used: Math.round(varTotal),
    // 予測が出せない時期（サイクルの頭・終わった月）は 0。表示側で出し分ける
    forecast: fc ? Math.round(fc.forecast) : 0,
    remainDays: fc ? fc.remainingDays : 0,
    validTo: toDateStr(end),
  }
}

/** 通知から作った未確定の支出の件数と合計 */
export function inboxWidgetData() {
  const drafts = loadInbox()
  return {
    count: drafts.length,
    total: Math.round(drafts.reduce((s, d) => s + (Number(d.amount) || 0), 0)),
  }
}

/** 今週の生活費（既存のウィジェット） */
export function livingWidgetData() {
  const { used, budget, remain, pct, from, to } = weeklyLivingSummary()
  return {
    used: Math.round(used),
    budget: Math.round(budget),
    remain: Math.round(remain),
    pct: Math.round(pct),
    from,
    to,
  }
}
