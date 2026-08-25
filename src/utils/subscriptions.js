import { addMonth } from './finance'
import { bumpDataVersion, loadFixed, loadVar } from './ccStorage'

/**
 * サブスクらしい変動費の検出。
 *
 * 毎月同じ相手に同じ金額を払っているなら、それは固定費として扱うほうが
 * 集計も入力も楽になる。直近の請求月を遡って「毎月・同じ相手・同額」の
 * 変動費を見つけ、固定費化を提案する。
 *
 * 提案するだけで勝手に変換はしない。断られたものは記録して二度と出さない。
 */

// 直近何ヶ月そろっていたら提案するか。2 だと偶然の一致（同じ店で同額）を拾いすぎる
const REQUIRED_MONTHS = 3

const DISMISSED_KEY = 'cc_subs_dismissed'

/** 同じ支払いかどうかの識別子。支払先（無ければ項目名）と金額で決める */
export function subscriptionKey(item) {
  return `${(item.payee || item.name || '').trim()}|${item.amount}`
}

export function loadDismissed() {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function dismissSubscription(key) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...loadDismissed(), key])]))
    bumpDataVersion()
  } catch {
    // 記録できなくても提案が再表示されるだけなので続ける
  }
}

/**
 * 固定費化の候補を返す。
 *
 * @param {string} cardId
 * @param {string} ym 表示中の請求月。ここから REQUIRED_MONTHS ヶ月遡って見る
 * @returns {{ key, name, payee, amount, category, day, months }[]}
 */
export function detectSubscriptions(cardId, ym) {
  const months = Array.from({ length: REQUIRED_MONTHS }, (_, i) => addMonth(ym, -i))

  // 月ごとに「この識別子が現れたか」を数える。同月の複数回は 1 回と数える
  // （毎週のスーパーはサブスクではない。月をまたいで同額が続くものだけ拾う）
  const seen = new Map() // key -> { item, monthCount, monthsHit: Set }
  months.forEach((m) => {
    const perMonth = new Map()
    loadVar(cardId, m).forEach((item) => {
      if (item.sign === 1) return          // 返金は対象外
      if (!(item.payee || item.name)) return
      perMonth.set(subscriptionKey(item), item)
    })
    perMonth.forEach((item, key) => {
      const entry = seen.get(key) ?? { item, monthsHit: 0 }
      entry.monthsHit += 1
      entry.item = item                    // 最新の月の情報を残す
      seen.set(key, entry)
    })
  })

  const dismissed = new Set(loadDismissed())
  const fixedKeys = new Set(loadFixed(cardId).flatMap((f) => [
    subscriptionKey(f),
    `${(f.name || '').trim()}|${f.amount}`,
  ]))

  const out = []
  seen.forEach(({ item, monthsHit }, key) => {
    if (monthsHit < REQUIRED_MONTHS) return
    if (dismissed.has(key)) return
    if (fixedKeys.has(key)) return         // すでに固定費として持っている
    out.push({
      key,
      name: item.name,
      payee: item.payee ?? '',
      amount: item.amount,
      category: item.category,
      day: item.date ? parseInt(item.date.slice(8), 10) : undefined,
      months: monthsHit,
    })
  })
  return out.sort((a, b) => b.amount - a.amount)
}
