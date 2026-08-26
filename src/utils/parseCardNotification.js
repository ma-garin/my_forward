import { CARD_LIST } from './ccStorage'

/**
 * カード利用通知の文面から支出の下書きを作る。
 *
 * 対応している文面（実機で届いたもの）:
 *
 *   Vpass（三井住友カード）… 日時・利用先・金額が全部そろっている
 *     ◇ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ）　◇日時：2026/08/14 12:12
 *     ◇利用先：ユニクロ／ＮＦＣ　◇金額：2,990円
 *
 *   Google ウォレット … 金額とカードだけ（利用先は入らない）
 *     JCB GOLD(ORIGINAL SERIES) ••1004 で ¥740
 *
 * 同じ買い物で LINE やメールの通知も届くが、それらは「お知らせが来た」だけで
 * 金額を持たないので対象外。拾えない文面は null を返し、受信箱に載せない。
 */

// 全角の英数字・記号が混ざる（ＶＩＳＡ／：）。NFKC で半角へ寄せてから読む。
export function normalizeText(s) {
  return (s ?? '')
    .normalize('NFKC')
    .replace(/[　\s]+/g, ' ')
    .trim()
}

/** 1 件の通知から、文字が入っている欄をつなげる */
function joinFields(record) {
  return [record?.title, record?.text, record?.bigText, record?.subText, record?.infoText, record?.ticker]
    .map(normalizeText)
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(' ')
}

/**
 * 文面に出てくるカード名から支払い元を決める。
 * CARDS の shortName で引くので、カードを増やしてもここは触らなくてよい。
 */
export function cardIdFromText(text) {
  const upper = text.toUpperCase()
  // 長い名前から順に見る（短い名前が別カードの一部に含まれることがある）
  const candidates = CARD_LIST
    .filter((c) => c.id !== 'cash')
    .sort((a, b) => b.shortName.length - a.shortName.length)
  for (const c of candidates) {
    if (upper.includes(c.shortName.toUpperCase())) return c.id
  }
  return null
}

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const toAmount = (s) => {
  const n = parseInt(String(s).replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ─── Vpass ────────────────────────────────────────────────

const VPASS_DATE = /日時[:：]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/
const VPASS_PAYEE = /利用先[:：]\s*(.+?)(?:\s*◇|\s*ご利用|$)/
const VPASS_AMOUNT = /金額[:：]\s*([\d,]+)\s*円/
const VPASS_CARD = /ご利用カード[:：]\s*(.+?)(?:\s*◇|$)/

function parseVpass(text, postTime) {
  const amountM = VPASS_AMOUNT.exec(text)
  if (!amountM) return null
  const amount = toAmount(amountM[1])
  if (!amount) return null

  const dateM = VPASS_DATE.exec(text)
  // 日時が読めなければ通知が届いた時刻で代用する（当日中なら実用上ずれない）
  const at = dateM
    ? new Date(+dateM[1], +dateM[2] - 1, +dateM[3], +(dateM[4] ?? 0), +(dateM[5] ?? 0)).getTime()
    : postTime
  const cardText = VPASS_CARD.exec(text)?.[1] ?? text

  return {
    source: 'vpass',
    cardId: cardIdFromText(cardText) ?? cardIdFromText(text),
    amount,
    at,
    date: toDateStr(new Date(at)),
    payee: (VPASS_PAYEE.exec(text)?.[1] ?? '').trim(),
  }
}

// ─── Google ウォレット ─────────────────────────────────────

const GPAY_AMOUNT = /[¥￥]\s*([\d,]+)/

function parseGooglePay(text, postTime) {
  const amount = toAmount(GPAY_AMOUNT.exec(text)?.[1] ?? '')
  if (!amount) return null
  const cardId = cardIdFromText(text)
  // カードが特定できない支払い（交通系のチャージ等）は当てずっぽうで
  // 登録しても直す手間が増えるだけなので落とす
  if (!cardId) return null
  return {
    source: 'googlepay',
    cardId,
    amount,
    at: postTime,
    date: toDateStr(new Date(postTime)),
    payee: '',
  }
}

// ─── 入口 ─────────────────────────────────────────────────

const isVpass = (text, pkg) =>
  /ご利用カード|利用先/.test(text) || /vpass|smbc/i.test(pkg ?? '')

const isGooglePay = (text, pkg) =>
  /google\s*pay|ウォレット/i.test(text) || /walletnfcrel|google.android.apps.wallet/i.test(pkg ?? '')

/**
 * @param {{ packageName?: string, postTime?: number, title?: string, text?: string,
 *           bigText?: string, subText?: string, infoText?: string, ticker?: string }} record
 * @returns {null | { source: string, cardId: string|null, amount: number,
 *                    at: number, date: string, payee: string }}
 */
export function parseCardNotification(record) {
  const text = joinFields(record)
  if (!text) return null
  const postTime = Number(record?.postTime) || Date.now()
  const pkg = record?.packageName

  const draft = isVpass(text, pkg)
    ? parseVpass(text, postTime)
    : isGooglePay(text, pkg)
      ? parseGooglePay(text, postTime)
      : null

  // 支払い元が分からない下書きは、どのカードに足すか決められないので出さない
  return draft?.cardId ? draft : null
}
