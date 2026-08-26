import { cutoffDateForYm, daysUntil, startOfDay } from './billingCycle'

/**
 * 請求サイクルの途中で「このペースだと月末いくらになるか」を出す。
 *
 * 残り予算だけ見ていても、月の頭に使いすぎているのか、
 * ならして使えているのかが分からない。経過日数で割って延長する。
 *
 * 固定費は日割りしない（その月に必ず出ていく額として分かっている）。
 * 延長するのは変動費だけ。
 */

// 数日ぶんの実績で月末を当てても外れるだけなので、それまでは出さない
const MIN_DAYS = 3

/**
 * 請求月の期間（締め日まで）。締め日を持たない支払い元（現金・PayPay）は暦月。
 */
export function cycleRange(card, ym) {
  const [y, m] = ym.split('-').map(Number)
  const end = cutoffDateForYm(card, ym)
  const start = card.cutoffDay === 0
    ? new Date(y, m - 1, 1)
    : new Date(y, m - 1, card.cutoffDay + 1)
  return { start, end }
}

/**
 * @param {object} p
 * @param {object} p.card    CARDS の 1 件
 * @param {string} p.ym      請求月（YYYY-MM）
 * @param {number} p.varTotal   変動費の実績
 * @param {number} p.fixedTotal 固定費（日割りしない）
 * @param {number} [p.limit]    月間上限。0 なら超過の判定をしない
 * @param {Date}   [p.now]
 * @returns {null | {
 *   start: Date, end: Date, totalDays: number, elapsedDays: number, remainingDays: number,
 *   pacePerDay: number, forecast: number, overBy: number, safePerDay: number,
 * }}
 */
export function forecastCycle({ card, ym, varTotal = 0, fixedTotal = 0, limit = 0, now = new Date() }) {
  const { start, end } = cycleRange(card, ym)
  const today = startOfDay(now)

  // 表示中の月が今のサイクルでなければ予測しない
  // （終わった月は実績が確定、これからの月は割る材料がない）
  if (today < start || today > end) return null

  const totalDays = daysUntil(end, start) + 1
  const elapsedDays = Math.min(daysUntil(today, start) + 1, totalDays)
  if (elapsedDays < MIN_DAYS) return null

  const pacePerDay = varTotal / elapsedDays
  const forecast = Math.round(fixedTotal + pacePerDay * totalDays)
  const remainingDays = totalDays - elapsedDays
  const overBy = limit > 0 ? Math.max(0, forecast - limit) : 0

  // 残り日数で上限に収めるには 1 日いくらまでか。使い切っていれば 0
  const safePerDay = limit > 0 && remainingDays > 0
    ? Math.max(0, Math.round((limit - fixedTotal - varTotal) / remainingDays))
    : 0

  return { start, end, totalDays, elapsedDays, remainingDays, pacePerDay, forecast, overBy, safePerDay }
}
