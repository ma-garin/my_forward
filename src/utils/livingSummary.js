import {
  CARD_LIST, getBillingMonthsForRange, getThisWeekRange, loadVar, loadWeeklyBudget, sumLiving,
} from './ccStorage'

/**
 * 今週の生活費のまとめ。
 *
 * 生活費カードとホーム画面ウィジェットの両方が同じ数字を出す必要があるので、
 * ここに一本化している。週の範囲はカードごとの締め日で請求月が変わるため、
 * 該当する請求月をすべて読んでから日付で絞る。
 */
export function weeklyLivingSummary() {
  const { weekStartStr, weekEndStr, label } = getThisWeekRange()

  const list = CARD_LIST.flatMap((card) =>
    getBillingMonthsForRange(weekStartStr, weekEndStr, card.cutoffDay)
      .flatMap((ym) => loadVar(card.id, ym)))

  const used = sumLiving(list, weekStartStr, weekEndStr)
  const budget = loadWeeklyBudget()

  return {
    label,
    from: weekStartStr,
    to: weekEndStr,
    list,
    used,
    budget,
    remain: budget - used,
    pct: budget > 0 ? (used / budget) * 100 : 0,
  }
}
