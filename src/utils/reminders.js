import { addMonth, fmt, getCCTotal } from './finance'
import { CARD_LIST, getBillingYmForDate } from './ccStorage'
import { cycleDatesForYm, daysUntil, fmtCycleDate } from './billingCycle'

/**
 * 締め日・支払日のリマインダー。
 *
 * どちらも日付が先に決まっていて、金額も締め日の時点で確定するので、
 * 前もって組んでおく通知に向いている。逆に週予算のような後から動く数字は、
 * 通知にすると古い値が届くのでここでは扱わない（ホーム画面ウィジェットの役目）。
 *
 * 予定はアプリを開くたびに組み直す。手で入れた支出で金額が変わるため、
 * 一度組んだきりにすると古い金額が届く。
 */

export const REMINDERS_KEY = 'cc_reminders_enabled'

// 通知 ID はカードと月から決める。組み直すたびに同じ ID を上書きするので、
// 消し忘れた予定が二重に残らない
const ID_BASE = 7100
const MONTHS_AHEAD = 3     // 何ヶ月先まで組むか
const ID_RANGE = 1000      // このリマインダーが使う ID の幅

const CUTOFF_HOUR = 9      // 締め日当日の朝
const PAY_EVE_HOUR = 20    // 支払日の前日の夜（残高を用意する時間を取る）

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function loadRemindersEnabled() {
  try {
    return localStorage.getItem(REMINDERS_KEY) === '1'
  } catch {
    return false
  }
}

export function saveRemindersEnabled(on) {
  try {
    localStorage.setItem(REMINDERS_KEY, on ? '1' : '0')
  } catch {
    // 保存できなくても、その場の設定は効いているので黙って続ける
  }
}

/** このリマインダーが登録した通知か。他の用途の予定を消さないために使う */
export function isReminderId(id) {
  return Number.isInteger(id) && id >= ID_BASE && id < ID_BASE + ID_RANGE
}

const at = (date, hour) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0)

const dayBefore = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)

/**
 * これから届く予定を組み立てる。通知を出さずに一覧を作れるので、
 * 設定画面のプレビューとテストの両方から同じものを使える。
 *
 * @param {Date} now 基準時刻
 * @returns {{ id: number, at: Date, title: string, body: string }[]} 早い順
 */
export function buildSchedule(now = new Date()) {
  const out = []

  CARD_LIST.forEach((card, cardIndex) => {
    // 現金など請求サイクルを持たないものに締め日・支払日は無い
    if (card.noBilling) return
    // 前月ぶんの支払いがまだ残っていることがあるので 1 ヶ月前から見る
    const startYm = addMonth(getBillingYmForDate(ymd(now), card.cutoffDay), -1)

    for (let i = 0; i <= MONTHS_AHEAD; i++) {
      const ym = addMonth(startYm, i)
      const { cutoffDate, payDate } = cycleDatesForYm(card, ym)
      const total = getCCTotal(card.id, ym).total
      const slot = ID_BASE + (cardIndex * (MONTHS_AHEAD + 1) + i) * 2

      if (daysUntil(cutoffDate, now) >= 0) {
        out.push({
          id: slot,
          at: at(cutoffDate, CUTOFF_HOUR),
          title: `${card.shortName} 今日が締め日`,
          body: `ここまでの利用 ¥${fmt(total)}。今日を過ぎた分は翌月の請求になります。`,
        })
      }

      const eve = dayBefore(payDate)
      if (daysUntil(eve, now) >= 0) {
        out.push({
          id: slot + 1,
          at: at(eve, PAY_EVE_HOUR),
          title: `${card.shortName} 明日が引き落とし`,
          body: `¥${fmt(total)}（${fmtCycleDate(payDate)}）`,
        })
      }
    }
  })

  // 時刻まで見ると過ぎているものは届かないので落とす
  return out
    .filter((n) => n.at.getTime() > now.getTime())
    .sort((a, b) => a.at - b.at)
}
