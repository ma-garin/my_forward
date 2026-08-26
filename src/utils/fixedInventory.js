import { CARD_LIST, loadFixed } from './ccStorage'
import { isActiveForYm, addMonth } from './finance'
import { loadPriceLog } from './priceLog'

/**
 * 固定費の棚卸し。
 *
 * 月額で見ていると 500 円の積み重ねが軽く見えるが、年で見ると
 * 解約する / しないの判断ができる金額になる。年額に直して並べる。
 *
 * 値上げは固定費の定義そのものからは分からない（金額を書き換えると
 * 前の金額が残らない）ので、変わった時点の記録（priceLog）を使う。
 */

/**
 * 年額換算。「今後 12 ヶ月のうち、その項目が効いている月の合計」で出す。
 * 毎月・N ヶ月ごと・1 回きり を同じ数え方で扱える。
 */
export function annualAmount(item, fromYm) {
  let total = 0
  for (let i = 0; i < 12; i++) {
    if (isActiveForYm(item, addMonth(fromYm, i))) total += item.amount
  }
  return total
}

/** 支払いの間隔を人が読む形にする */
export function intervalLabel(item) {
  if (item.recurrence === 'once') return `${item.targetYm ?? ''} のみ`
  if (item.recurrence === 'interval') return `${item.intervalMonths ?? 2}ヶ月ごと`
  return '毎月'
}

/** 今も残っている固定費の値上げだけを、新しい順で返す */
export function priceIncreases(items) {
  const alive = new Set(items.map((x) => x.id))
  return loadPriceLog().filter((c) => c.to > c.from && alive.has(c.id))
}

/**
 * @param {string} fromYm 数え始める請求月（YYYY-MM）
 * @returns {{ rows: object[], annualTotal: number, monthlyAverage: number, increases: object[] }}
 *   rows は年額の大きい順。item に _cardId / _annual / _interval を付ける
 */
export function fixedInventory(fromYm) {
  const rows = []
  for (const card of CARD_LIST) {
    for (const item of loadFixed(card.id)) {
      const annual = annualAmount(item, fromYm)
      if (annual <= 0) continue
      rows.push({ ...item, _cardId: card.id, _annual: annual, _interval: intervalLabel(item) })
    }
  }
  rows.sort((a, b) => b._annual - a._annual)

  const annualTotal = rows.reduce((s, r) => s + r._annual, 0)
  return {
    rows,
    annualTotal,
    monthlyAverage: Math.round(annualTotal / 12),
    increases: priceIncreases(rows),
  }
}
