import { bumpDataVersion, loadVar, saveVar, billingYmForCard } from './ccStorage'
import { newId } from './finance'
import { parseCardNotification } from './parseCardNotification'

/**
 * カード利用通知から作った「未確定の支出」の置き場。
 *
 * 通知は勝手に届くので、そのまま家計に入れると身に覚えのない行が増える。
 * いったんここに溜めて、承認したものだけ変動費へ移す。
 *
 * 同じ買い物で複数のアプリが通知する（Vpass と Google ウォレットが両方鳴る、
 * タッチ決済で二重に来る）ため、取り込みでは必ず重複を潰す。
 */

const KEY_PENDING = 'cc_inbox'
const KEY_HANDLED = 'cc_inbox_handled'

// 同じ支払い元・同じ金額で、この時間内に届いたものは同じ買い物とみなす。
// 通知アプリごとに数分ずれるので、分単位ではなく余裕を持たせる。
const NEAR_MS = 15 * 60 * 1000

// 承認・無視の記録。増え続けると重複判定が重くなるので上限を切る
const MAX_HANDLED = 400

const read = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const write = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.warn('inbox save failed', e)
  }
}

/** 同じ買い物か（支払い元・金額が同じで、時刻が近い） */
export const isSamePurchase = (a, b) =>
  a.cardId === b.cardId && a.amount === b.amount && Math.abs(a.at - b.at) <= NEAR_MS

export const loadInbox = () => read(KEY_PENDING)
const loadHandled = () => read(KEY_HANDLED)

const saveInbox = (list) => {
  write(KEY_PENDING, list)
  bumpDataVersion()
}

const remember = (draft) => {
  const next = [{ cardId: draft.cardId, amount: draft.amount, at: draft.at }, ...loadHandled()]
  write(KEY_HANDLED, next.slice(0, MAX_HANDLED))
}

/**
 * 通知の記録から下書きを作って受信箱に足す。
 * すでに受信箱にあるもの・一度さばいたものは足さない（開くたびに増えない）。
 *
 * @param {object[]} records ネイティブから読んだ通知（新しい順）
 * @returns {{ added: number, inbox: object[] }}
 */
export function ingestNotifications(records) {
  const inbox = loadInbox()
  const handled = loadHandled()
  const added = []

  // 古い順に見る。同じ買い物なら先に届いた通知（＝情報が多い Vpass）を残したいが、
  // 順序に依存しないよう、後から来た店名付きで補完する
  const drafts = [...records].reverse()
    .map(parseCardNotification)
    .filter(Boolean)

  for (const d of drafts) {
    if (handled.some((h) => isSamePurchase(h, d))) continue

    const dup = [...inbox, ...added].find((x) => isSamePurchase(x, d))
    if (dup) {
      // 片方にしか店名がないことがある（Google ウォレットは利用先を持たない）
      if (!dup.payee && d.payee) dup.payee = d.payee
      continue
    }
    added.push({ id: newId(), ...d })
  }

  if (added.length || drafts.length) saveInbox([...added, ...inbox])
  return { added: added.length, inbox: loadInbox() }
}

/**
 * CSV から作った下書きを受信箱に足す。
 *
 * 通知と違って CSV は同じ買い物を二度書かないので、ファイルの中では
 * 重複を潰さない（同じ日に同じ金額を 2 回払うことは普通にある）。
 * 潰すのは「前に取り込んだぶん」だけ。同じ日・同じ額が n 件あるとき、
 * すでに n 件さばいてあれば足さず、足りないぶんだけ足す。
 *
 * @param {object[]} drafts toDrafts が作った下書き
 * @returns {{ added: number, duplicate: number, inbox: object[] }}
 */
export function ingestDrafts(drafts) {
  const inbox = loadInbox()
  const key = (d) => `${d.cardId}|${d.amount}|${d.date}`

  // すでにある件数を数える。承認済み（handled）は date を持たないので
  // 時刻から日付に戻す
  const seen = new Map()
  const bump = (k) => seen.set(k, (seen.get(k) ?? 0) + 1)
  for (const x of inbox) bump(key(x))
  for (const h of loadHandled()) {
    const d = new Date(h.at)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    bump(`${h.cardId}|${h.amount}|${date}`)
  }

  const added = []
  let duplicate = 0
  for (const d of drafts) {
    const k = key(d)
    const remaining = seen.get(k) ?? 0
    if (remaining > 0) { seen.set(k, remaining - 1); duplicate++; continue }
    added.push({ id: newId(), ...d })
  }

  if (added.length) saveInbox([...added, ...inbox])
  return { added: added.length, duplicate, inbox: loadInbox() }
}

/** 受信箱から 1 件外す（承認・無視の共通処理） */
function take(id) {
  const inbox = loadInbox()
  const item = inbox.find((x) => x.id === id)
  if (!item) return null
  saveInbox(inbox.filter((x) => x.id !== id))
  remember(item)
  return item
}

/** 無視する。同じ通知が再び届いても復活しない */
export function dismissDraft(id) {
  take(id)
  return loadInbox()
}

/**
 * 下書きを変動費として登録する。
 * 請求月はカードの締め日から決めるので billingYmForCard を通す。
 *
 * @param {string} id 受信箱の下書き ID
 * @param {object} overrides 画面で直した内容（カテゴリ・品名など）
 */
export function acceptDraft(id, overrides = {}) {
  const draft = take(id)
  if (!draft) return null

  const item = {
    id: newId(),
    name: overrides.name ?? draft.payee ?? '',
    payee: overrides.payee ?? draft.payee ?? '',
    amount: overrides.amount ?? draft.amount,
    category: overrides.category ?? 'その他',
    spendType: overrides.spendType ?? '消費',
    date: overrides.date ?? draft.date,
  }
  const cardId = overrides.cardId ?? draft.cardId
  const ym = billingYmForCard(item.date, cardId)
  saveVar(cardId, ym, [...loadVar(cardId, ym), item])
  return { item, cardId, ym }
}
