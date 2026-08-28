import { bumpDataVersion, CARDS } from './ccStorage'
import { getCCTotal } from './finance'
import { cutoffDateForYm, startOfDay } from './billingCycle'

/**
 * カード明細との突合。
 *
 * 自分の記録が実際の請求額と合っているかは、どこにも出ていなかった。
 * 合っていなければ、取りこぼし（入力漏れ）か二重計上がある。家計簿として
 * 数字を信用できるかはここで決まる。
 *
 * 実際の請求額は自分で入れる（銀行ともカード会社ともつながらないため）。
 */

const key = (cardId, ym) => `cc_statement_${cardId}_${ym}`

/** 入力済みの請求額。未入力は null（0 円の請求と区別する） */
export function loadStatement(cardId, ym) {
  try {
    const raw = localStorage.getItem(key(cardId, ym))
    if (raw === null || raw === '') return null
    const v = Number(raw)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

export function saveStatement(cardId, ym, amount) {
  try {
    if (amount === null || amount === '') localStorage.removeItem(key(cardId, ym))
    else localStorage.setItem(key(cardId, ym), String(Math.round(Number(amount) || 0)))
    bumpDataVersion()
  } catch (e) {
    console.warn('saveStatement failed', e)
  }
}

/**
 * 締めが終わっているか。締め日前は記録が増える途中なので、
 * 合わないのが当たり前。突合の対象にしない。
 */
export function isClosed(cardId, ym, now = new Date()) {
  const card = CARDS[cardId]
  if (!card || card.noBilling) return false
  return startOfDay(now) > startOfDay(cutoffDateForYm(card, ym))
}

/**
 * 記録と請求額の差。
 *
 * diff は「請求額 − 記録」。プラスなら記録が足りない（入力漏れ）、
 * マイナスなら記録が多い（二重計上か、請求に載っていない支払い）。
 *
 * 記録額は引数で受ける。画面には既に使用額が出ているので、ここで数え直すと
 * 同じ事実が 2 箇所になり、片方だけ変わったときに画面と差が食い違う。
 */
export function compare(recorded, statement) {
  if (statement === null || statement === undefined) return { diff: null, matched: null }
  const diff = statement - recorded
  return { diff, matched: diff === 0 }
}

/**
 * 記録と請求額を突き合わせる（記録は保存から数え直す）。
 *
 * @returns {{
 *   closed: boolean, recorded: number, statement: number|null,
 *   diff: number|null, matched: boolean|null,
 * }}
 */
export function reconcile(cardId, ym, now = new Date()) {
  const recorded = getCCTotal(cardId, ym).total
  const statement = loadStatement(cardId, ym)
  return { closed: isClosed(cardId, ym, now), recorded, statement, ...compare(recorded, statement) }
}

/** 差の向きを言葉にする（画面ごとに書き分けない） */
export function diffLabel(diff) {
  if (diff === null) return ''
  if (diff === 0) return '一致'
  return diff > 0 ? '記録が不足' : '記録が過多'
}
