/**
 * クレカ利用通知の本文から、支出の下書き（金額・支払先・日付）を取り出す。
 *
 * カード会社ごとの文面はまだ集まっていないため、ここでは特定の会社に
 * 寄せず、日本語のクレカ通知に共通して現れる書き方だけを見る。
 * 取り出せなかった項目は空にして返し、確認ダイアログで人が埋める。
 */

// 「1,234」「1234」。小数は通知に出ないので整数だけを見る。
const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d+)'

// 金額の書き方。前から順に試し、最初に当たったものを採る。
// ラベル付き（ご利用金額: ¥1,234）を先に置く。金額以外の数字（カード下4桁・
// ポイント残高）を拾わないよう、ラベルのあるものを優先する。
const AMOUNT_PATTERNS = [
  new RegExp(`(?:ご?利用金額|お?支払[い]?金額|金額)[^\\d¥￥]{0,8}[¥￥]?\\s*${NUM}`),
  new RegExp(`[¥￥]\\s*${NUM}`),
  new RegExp(`${NUM}\\s*円`),
]

// 支払先の書き方。ラベルの後ろを行末まで取る。
const PAYEE_PATTERNS = [
  /(?:ご?利用先|ご?利用店舗|加盟店名?|店舗名?|ご?利用先店舗)\s*[:：]?\s*(.+)/,
]

const DATE_PATTERNS = [
  /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  /(\d{1,2})月(\d{1,2})日/,
  // 年なしの「12/28」。上の完全な日付が当たらなかったときだけ効く。
  // 後読み（?<=）は古い Safari で構文エラーになり読み込みごと落ちるため使わない。
  /(\d{1,2})\/(\d{1,2})/,
]

const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** 通知の1件を、本文として見る文字列の配列にする */
export const notificationLines = (r) =>
  [r?.title, r?.text, r?.bigText, r?.subText, r?.infoText, r?.ticker]
    .map((v) => (v ?? '').trim())
    .filter((v, i, a) => v && a.indexOf(v) === i)

const parseAmountFrom = (body) => {
  for (const re of AMOUNT_PATTERNS) {
    const m = body.match(re)
    if (!m) continue
    const n = parseInt(m[1].replace(/,/g, ''), 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 0
}

const parsePayeeFrom = (lines, fallbackTitle) => {
  for (const line of lines) {
    for (const re of PAYEE_PATTERNS) {
      const m = line.match(re)
      // ラベルだけで中身が次の行にある通知もあるため、空一致は採らない
      if (m && m[1].trim()) return m[1].trim()
    }
  }
  return (fallbackTitle ?? '').trim()
}

/**
 * 通知の受信時刻を基準に、書かれている日付を YYYY-MM-DD にする。
 * 「12/28」のように年が無い通知を1月に受け取ると翌年扱いになってしまうため、
 * 受信月より6ヶ月以上先になる場合は前年とみなす。
 */
const parseDateFrom = (body, postTime) => {
  const base = new Date(postTime || Date.now())
  for (const re of DATE_PATTERNS) {
    const m = body.match(re)
    if (!m) continue
    if (m.length === 4) return ymd(m[1], m[2], m[3])
    const month = parseInt(m[1], 10)
    const day = parseInt(m[2], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    const ahead = month - (base.getMonth() + 1)
    const year = base.getFullYear() - (ahead > 6 ? 1 : 0)
    return ymd(year, month, day)
  }
  return ymd(base.getFullYear(), base.getMonth() + 1, base.getDate())
}

/**
 * 通知1件から支出の下書きを作る。保存はしない。
 * 戻り値: { amount, payee, date, hasAmount }
 */
export function parseCardNotification(record) {
  const lines = notificationLines(record)
  const body = lines.join('\n')
  const amount = parseAmountFrom(body)
  return {
    amount,
    payee: parsePayeeFrom(lines, record?.title),
    date: parseDateFrom(body, record?.postTime),
    hasAmount: amount > 0,
  }
}

/** 通知を一意に指すキー。登録済みかどうかの判定に使う。 */
export const notificationKey = (r) => `${r?.packageName ?? ''}|${r?.postTime ?? ''}`
