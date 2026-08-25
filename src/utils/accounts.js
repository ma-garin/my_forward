import { bumpDataVersion } from './ccStorage'

/**
 * 口座残高の記録。
 *
 * 完全オフラインなので銀行とはつながらない。残高は自分で入れて、
 * アプリは「口座残高の合計 − カードの未払い」を純資産として見せる。
 * 口座ごとの残高は今の値だけを持つ（履歴は持たない。まず全体が
 * 見えることが先で、推移は必要になってから考える）。
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
