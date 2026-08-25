/**
 * アプリの外から「支出を追加」を開くための受け渡し。
 *
 * 開く場所はクレカタブの中（AddExpenseScreen）なので、App からは直接触れない。
 * ホーム画面のショートカットや共有シートは App 側で受けるため、ここを経由する。
 *
 * 要求は一旦ここに置く。起動直後は購読より先に要求が届くことがあるため、
 * 受け取る側はマウント時にも取りに来る。
 */

let pending = null
const listeners = new Set()

/** 支出追加を開くよう要求する。prefill は分かっている範囲だけでよい */
export function requestQuickAdd(prefill = {}) {
  pending = prefill
  listeners.forEach((fn) => fn())
}

/** 溜まっている要求を 1 回だけ取り出す。無ければ null */
export function takePendingQuickAdd() {
  const p = pending
  pending = null
  return p
}

export function onQuickAdd(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
