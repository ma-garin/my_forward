/**
 * 固定費の金額が変わった記録。
 *
 * 固定費は金額を書き換えると前の値が残らないので、変わった時点でここに控える。
 * 棚卸しの「値上げ」はこの記録だけが頼り。
 *
 * ccStorage から呼ばれるため、ここは ccStorage に依存しない
 * （相互に import すると読み込み順で壊れる）。保存の版数は呼び出し元の
 * saveFixed が上げる。
 */

const KEY = 'cc_fixed_price_log'
const MAX_LOG = 200

export function loadPriceLog() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/**
 * 金額が変わったときだけ記録する。金額以外の編集では何も残さない。
 * @returns {boolean} 記録したか
 */
export function recordPriceChange({ before, after, at = new Date() }) {
  if (!before || !after) return false
  if (before.id !== after.id) return false
  if (before.amount === after.amount) return false

  const entry = {
    id: after.id,
    name: after.name,
    from: before.amount,
    to: after.amount,
    ym: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadPriceLog()].slice(0, MAX_LOG)))
  } catch (e) {
    console.warn('recordPriceChange failed', e)
    return false
  }
  return true
}
