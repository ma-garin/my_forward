import { nextBusinessDay } from './ccStorage'

/**
 * 請求月（ym）から締め日・支払日を求める。
 *
 * 画面の表示とリマインダーの両方で使うので、ここに一本化している。
 * 画面ごとに書くと、片方だけ直して食い違う（実際に日付が 1 ヶ月ずれるバグが
 * 混入したことがある）。
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntil(date, from = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(from)) / MS_PER_DAY)
}

/**
 * ym の締め日。ym の締めは「ym の月 + 1」に落ちる
 * （例: cutoffDay=15 なら ym=2026-08 の締めは 9/15）。
 * ym の月をそのまま使うと 1 ヶ月早い日付になる（実際に混入したバグ）。
 * cutoffDay=0 は月末締め。
 */
export function cutoffDateForYm(card, ym) {
  const [y, m] = ym.split('-').map(Number)
  return card.cutoffDay === 0 ? new Date(y, m, 0) : new Date(y, m, card.cutoffDay)
}

/** 締め日の翌月 paymentDay。休日なら翌営業日にずれる */
export function payDateForCutoff(card, cutoffDate) {
  return nextBusinessDay(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, card.paymentDay))
}

export function cycleDatesForYm(card, ym) {
  const cutoffDate = cutoffDateForYm(card, ym)
  return { cutoffDate, payDate: payDateForCutoff(card, cutoffDate) }
}

export function fmtCycleDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function cutoffLabel(card) {
  return card.cutoffDay === 0 ? '月末締め' : `${card.cutoffDay}日締め`
}

export function paymentLabel(card) {
  return `翌月${card.paymentDay}日払い`
}

/**
 * 締め日・支払日は「まだ来ていなければ残り日数、過ぎていれば日付だけ」を出す。
 * 表示中の月が今の請求サイクルかどうかで分けると、前月ぶんの支払いがまだ
 * 残っていても残り日数が消えてしまう（実際にそうなっていた）。
 */
export function cycleLabel(prefix, date, from = new Date()) {
  const days = daysUntil(date, from)
  if (days > 0)   return `${prefix}まで あと${days}日（${fmtCycleDate(date)}）`
  if (days === 0) return `${prefix} 今日（${fmtCycleDate(date)}）`
  return `${prefix} ${fmtCycleDate(date)}`
}
