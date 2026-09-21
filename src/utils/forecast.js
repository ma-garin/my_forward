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
 * 残り予算を締め日までの残り日数で割った「1 日あたりあといくら使えるか」。
 *
 * forecastCycle と違って過去の実績を延ばさない単なる割り算なので、
 * 数日ぶんの実績が無いサイクル初日から出せる。予測側の safePerDay も
 * ここを通す（同じ数字を 2 箇所で計算しない）。
 *
 * 残り日数は締め日までで今日を数えない。カードに出ている
 * 「締め日まで あと N 日」（billingCycle の cycleLabel）と同じ数え方。
 *
 * @param {object} p
 * @param {object} p.card    CARDS の 1 件
 * @param {string} p.ym      請求月（YYYY-MM）
 * @param {number} p.varTotal   変動費の実績
 * @param {number} p.fixedTotal 固定費
 * @param {number} [p.limit]    月間上限。未設定（0）なら出さない
 * @param {Date}   [p.now]
 * @returns {null | { remaining: number, remainingDays: number, perDay: number, over: boolean }}
 */
export function dailyAllowance({ card, ym, varTotal = 0, fixedTotal = 0, limit = 0, now = new Date() }) {
  if (!(limit > 0)) return null

  const { start, end } = cycleRange(card, ym)
  const today = startOfDay(now)
  // 今のサイクルでなければ「あと使える額」は意味を持たない
  if (today < start || today > end) return null

  const totalDays = daysUntil(end, start) + 1
  const elapsedDays = Math.min(daysUntil(today, start) + 1, totalDays)
  const remainingDays = totalDays - elapsedDays
  const remaining = limit - fixedTotal - varTotal

  // 締め日当日は割る日数が無い。使い切っていればマイナスを出さず 0
  const perDay = remainingDays > 0 ? Math.max(0, Math.round(remaining / remainingDays)) : 0

  return { remaining, remainingDays, perDay, over: remaining < 0 }
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

  // 残り日数で上限に収めるには 1 日いくらまでか。持ち主は dailyAllowance 1 つ
  const safePerDay = dailyAllowance({ card, ym, varTotal, fixedTotal, limit, now })?.perDay ?? 0

  return { start, end, totalDays, elapsedDays, remainingDays, pacePerDay, forecast, overBy, safePerDay }
}
