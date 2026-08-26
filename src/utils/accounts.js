import { bumpDataVersion } from './ccStorage'

/**
 * 口座残高の記録と、純資産の推移。
 *
 * 完全オフラインなので銀行とはつながらない。残高は自分で入れて、
 * アプリは「口座残高の合計 − カードの未払い」を純資産として見せる。
 *
 * 口座ごとの残高は今の値だけを持つ。増えたか減ったかを見るために、
 * 月に 1 度だけ純資産の値を snapshot として別に残す（口座単位では
 * 残さない。口座の増減より、合計がどう動いたかが知りたいため）。
 */

const KEY = 'cc_accounts'

/** @returns {{ id: string, name: string, balance: number }[]} */
export function loadAccounts() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveAccounts(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    bumpDataVersion()
  } catch (e) {
    console.warn('saveAccounts failed', e)
  }
}

export function totalBalance(list = loadAccounts()) {
  return list.reduce((s, a) => s + (Number(a.balance) || 0), 0)
}

// ─── 純資産の推移 ────────────────────────────────────────

const SNAPSHOT_KEY = 'cc_networth_history'

// 5 年ぶん。これ以上は折れ線に載せても読めない
const MAX_SNAPSHOTS = 60

/** @returns {{ ym: string, value: number }[]} 古い順 */
export function loadNetWorthHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function saveNetWorthHistory(list) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list.slice(-MAX_SNAPSHOTS)))
    bumpDataVersion()
  } catch (e) {
    console.warn('saveNetWorthHistory failed', e)
  }
}

/**
 * その月の純資産を記録する。同じ月に何度呼んでも最後の値で上書きするだけで、
 * 点が増えることはない（残高を直すたびに折れ線が階段にならない）。
 *
 * @param {number} value 純資産
 * @param {string} ym    記録する月（YYYY-MM）
 * @returns {{ ym: string, value: number }[]} 更新後の履歴（古い順）
 */
export function recordNetWorth(value, ym) {
  if (!ym || !Number.isFinite(value)) return loadNetWorthHistory()
  const rest = loadNetWorthHistory().filter((s) => s.ym !== ym)
  const next = [...rest, { ym, value: Math.round(value) }].sort((a, b) => (a.ym < b.ym ? -1 : 1))
  saveNetWorthHistory(next)
  return next
}

/** 直近の変化額（1 つ前の記録との差）。比べる相手がなければ null */
export function netWorthChange(history = loadNetWorthHistory()) {
  if (history.length < 2) return null
  return history[history.length - 1].value - history[history.length - 2].value
}
