import { CARD_LIST } from './ccStorage'

/**
 * カード利用通知の文面から支出の下書きを作る。
 *
 * 対応している文面（実機で届いたもの）:
 *
 *   Vpass（三井住友カード）… 日時・利用先・金額が全部そろっている
 *     ◇ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ） ◇日時：2026/08/14 12:12
 *     ◇利用先：ユニクロ／ＮＦＣ ◇金額：2,990円
 *
 *   MyJCB … 同じ中身を【】で囲んだ項目名で送ってくる
 *     【カード名称】【ＯＳ】ＪＣＢゴールド ＮＬ 【利用日時】2026/09/22 18:44
 *     【利用金額】1,840円 【利用先】カイテンズシミサキ タカダノババ
 *
 *   Google ウォレット … 金額とカードだけ（利用先は入らない）
 *     JCB GOLD(ORIGINAL SERIES) ••1004 で ¥740
 *
 * 同じ買い物で LINE やメールの通知も届くが、それらは「お知らせが来た」だけで
 * 金額を持たないので対象外。拾えない文面は null を返し、受信箱に載せない。
 */

/**
 * 全角の英数字・記号が混ざる（ＶＩＳＡ／：）。NFKC で半角へ寄せてから読む。
 *
 * **改行は残す。** 通知は 1 行 1 項目で書かれており、行末が値の自然な終わり。
 * 以前はここで改行も空白に潰しており、項目の値が次の行まで伸びていた
 * （空欄の【利用先】が、次の行のカード名を飲み込んでいた）。
 */
// カタカナの長音を全角マイナスで送ってくる（Vpass の「グロ－バルワ－ク」）。
// NFKC で「-」になるので、カナに挟まれていれば長音に戻す。ン・ッのあとは
// 長音にならないので語の区切りとして残す（セブン-イレブン）
const DASH_AS_CHOON = /(?<=\p{Script=Katakana})(?<![ンッ])[-‐−](?=\p{Script=Katakana})/gu

export function normalizeText(s) {
  return (s ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\u3000\s]+/g, ' ').replace(DASH_AS_CHOON, 'ー').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * 人が読む文ではない行。ネイティブ側は extras を全部歩いて文字を集めるので、
 * 通知の組み立て情報（androidx.core.app.NotificationCompat$InboxStyle）や
 * 送り主のパッケージ名（jp.co.jcb.my）まで混ざる。
 *
 * どのキーから来たかでは判定しない（キーは数え切れない）。値の形で見る。
 * 店名と取り違えないよう、クラス名（$ を含む識別子）と送り主の名前そのものに限る
 * （「Amazon.co.jp」のような店名は落とさない）。
 */
const isNoiseLine = (line, pkg) =>
  line === pkg || /^[\w.]+\.\w+\$[\w$]+$/.test(line)

/** 1 件の通知から、文字が入っている欄をつなげる（行の区切りは保つ） */
function joinFields(record) {
  const pkg = record?.packageName
  return [record?.title, record?.text, record?.bigText, record?.subText,
    record?.infoText, record?.ticker, record?.allText]
    .map((v) => normalizeText(v).split('\n').filter((l) => !isNoiseLine(l, pkg)).join('\n'))
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join('\n')
}

// カード名を語に分ける（英数字・漢字・カタカナ・ひらがなの切れ目で切る）。
// 1 文字の語（VISA-NL-G の G）はどこにでも出てくるので使わない
const WORD = /[A-Z0-9]+|\p{Script=Han}+|[\p{Script=Katakana}ー]+|\p{Script=Hiragana}+/gu
const wordsOf = (s) =>
  [...new Set((normalizeText(s).toUpperCase().match(WORD) ?? []).filter((w) => w.length >= 2))]

/**
 * 文面に出てくるカード名から支払い元を決める。
 * CARDS の shortName・name で引くので、カードを増やしてもここは触らなくてよい。
 *
 * 短縮名は利用者が自由に付ける（実機では「VISA-NL-G」）。通知のカード名
 * 「三井住友ゴールドＶＩＳＡ（ＮＬ）」に短縮名がそのまま入っているとは限らず、
 * 丸ごと一致だけで見ていたときは支払い元が決まらず、VISA の通知を全部捨てていた。
 * 丸ごと一致しなければ、短縮名と正式名の語（VISA / NL / 三井住友 …）がいくつ
 * 文面に出てくるかで決める。2 語以上で、ほかのカードと同点でないときだけ採る
 * （「ゴールド」1 語は JCBゴールド にも三井住友ゴールド にも出てくる）。
 */
export function cardIdFromText(text) {
  const upper = normalizeText(text).toUpperCase()
  // 長い名前から順に見る（短い名前が別カードの一部に含まれることがある）
  const candidates = CARD_LIST
    .filter((c) => c.id !== 'cash')
    .sort((a, b) => b.shortName.length - a.shortName.length)
  for (const c of candidates) {
    if (upper.includes(normalizeText(c.shortName).toUpperCase())) return c.id
  }

  let best = null
  let bestScore = 0
  let tie = false
  for (const c of candidates) {
    const score = wordsOf(`${c.shortName} ${c.name ?? ''}`).filter((w) => upper.includes(w)).length
    if (score > bestScore) [best, bestScore, tie] = [c.id, score, false]
    else if (score > 0 && score === bestScore) tie = true
  }
  return bestScore >= 2 && !tie ? best : null
}

/**
 * 通知の送り主（アプリのパッケージ名）から支払い元を決める。
 * 文面にカード名が入らないアプリ（PayPay）はこれで決まる。
 */
export function cardIdFromPackage(pkg) {
  if (!pkg) return null
  const found = CARD_LIST.find((c) => c.androidPackage && c.androidPackage === pkg)
  return found?.id ?? null
}

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const toAmount = (s) => {
  const n = parseInt(String(s).replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ─── 項目名の付いた文面 ────────────────────────────────────
//
// カード会社の利用通知はどれも「項目名＋値」の並びで、違うのは飾りだけ。
//
//   Vpass  … ◇日時：2026/08/14 12:12 ◇利用先：ユニクロ ◇金額：2,990円
//   MyJCB  … 【利用日時】2026/09/22 18:44 【利用金額】1,840円 【利用先】…
//
// 会社ごとに読み方を書くと、書いていない会社からは金額しか取れない
// （MyJCB の日時と利用先を実際に取りこぼしていた）。飾り（◇【】：）は
// 区切りとして読み飛ばし、**項目名だけ**で拾う。

const LABELS = {
  date:   ['ご利用日時', '利用日時', 'ご利用日', '利用日', '日時'],
  payee:  ['ご利用先', '利用先', '利用店名', '加盟店名', '加盟店'],
  amount: ['ご利用金額', '利用金額', '金額'],
  card:   ['ご利用カード', 'カード名称', '利用カード'],
}

const ALL_LABELS = Object.values(LABELS).flat()

// 行内の空白だけ（\s は改行も含むため、項目の値が次の行へ伸びてしまう）
const SP = '[^\\S\\n]'

// 項目名で始まる位置（前に飾りが付いていてもよい）
const LABEL_AHEAD = `${SP}*[◇【\\[]?${SP}*(?:${ALL_LABELS.join('|')})`

// 値の終わりは「次の項目名」か「行末」。
// 飾りで切ると値の中の【】で切れる（MyJCB のカード名称は【ＯＳ】ＪＣＢゴールド ＮＬ）
// ので飾りでは切らず、1 行 1 項目という通知の形をそのまま終わりに使う。
const UNTIL_NEXT_LABEL = `(?=${LABEL_AHEAD}|\\n|$)`

/**
 * 項目名で 1 項目ぶんの値を取り出す（見つからなければ空文字）。
 *
 * 値はふつう項目名と同じ行にある。項目名だけの行なら、次の行が値
 * （InboxStyle は 1 要素 1 行で届くので、【利用先】と店名が別の行に分かれる）。
 * 次の行も項目名で始まるなら、この欄は空。
 */
export function field(text, labels) {
  const re = new RegExp(`(?:${labels.join('|')})${SP}*[】\\]:：]?${SP}*(?:\\n(?!${LABEL_AHEAD}))?(.+?)${SP}*${UNTIL_NEXT_LABEL}`)
  const v = (re.exec(text)?.[1] ?? '').trim()
  // 欄が空の項目（【利用先】のあとに何も書かれていない）は、飾りだけが残る。
  // 中身が無いものは空として返す
  return /[^\s◇【】[\]:：]/.test(v) ? v : ''
}

// 2026/09/22 18:44 ／ 2026年9月22日 18:44 ／ 2026-09-22 18:44
const DATE_TIME = /(\d{4})[/年-](\d{1,2})[/月-](\d{1,2})日?(?:\s*(\d{1,2})[:時](\d{2}))?/

function parseLabeled(text, postTime) {
  const amount = toAmount(field(text, LABELS.amount))
  if (!amount) return null

  const m = DATE_TIME.exec(field(text, LABELS.date))
  // 日時が読めなければ通知が届いた時刻で代用する（当日中なら実用上ずれない）
  const at = m
    ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)).getTime()
    : postTime

  const cardId = cardIdFromText(field(text, LABELS.card)) ?? cardIdFromText(text)
  const payee = field(text, LABELS.payee)

  return {
    // カード名称の欄が無い通知もあるので、無ければ文面全体から探す
    cardId,
    amount,
    at,
    date: toDateStr(new Date(at)),
    // 利用先の欄が空の通知では、そのうしろに続くカード名を拾ってしまう
    // （「JCBクレジットカード ••1004」が支払先に入っていた）。
    // 支払い元それ自身の名前は店名ではないので捨てる。別のカード名
    // （JCB 払いでモバイルSuica にチャージ）は利用先として正しいので残す
    payee: cardIdFromText(payee) === cardId ? '' : payee,
    // 取引の時刻を文面から読めたか。読めた下書きの日付を、届いた時刻しか
    // 知らない通知（Google ウォレット）で上書きさせないために持つ
    ...(m ? { atFromText: true } : {}),
  }
}

// ─── 項目名を持たない通知 ──────────────────────────────────
//
// Google ウォレットのように項目名が付かない通知はここで拾う。送信元を
// 数え上げて分岐すると、数え漏れたアプリの通知が丸ごと落ちる。
// 「金額」と「どのカードか」が読めれば下書きにする。

const ANY_AMOUNT = /[¥￥]\s*([\d,]+)|([\d,]+)\s*円/

function parseGeneric(text, postTime) {
  const m = ANY_AMOUNT.exec(text)
  const amount = toAmount(m?.[1] ?? m?.[2] ?? '')
  if (!amount) return null
  return {
    cardId: cardIdFromText(text),
    amount,
    at: postTime,
    date: toDateStr(new Date(postTime)),
    payee: '',
  }
}

// ─── 入口 ─────────────────────────────────────────────────

// どこから来たかは記録用のラベル。解析の分岐には使わない
function sourceOf(text, pkg) {
  if (/vpass|smbc/i.test(pkg ?? '') || /ご利用カード/.test(text)) return 'vpass'
  if (/google\s*pay|ウォレット/i.test(text) || /walletnfcrel|google.android.apps.wallet/i.test(pkg ?? '')) {
    return 'googlepay'
  }
  return 'card'
}

/**
 * 通知 1 件を読んだ結果。下書きになるか、ならないならその理由。
 * 設定 → 通知の取り込み が各記録の下に出す（取り込まれない理由を端末で見られる）。
 *
 * @returns {{ draft: object } | { reason: string }}
 */
export function explainCardNotification(record) {
  const text = joinFields(record)
  if (!text) return { reason: '文字が無い' }
  const postTime = Number(record?.postTime) || Date.now()
  const pkg = record?.packageName

  // 項目名が付いていれば日時・利用先・カードまで読む。無ければ金額だけ拾う
  const draft = parseLabeled(text, postTime) ?? parseGeneric(text, postTime)
  if (!draft) return { reason: '金額が無い' }

  // 文面でカードが決まらなければ送り主で決める（PayPay は文面に名前を書かない）
  const cardId = draft.cardId ?? cardIdFromPackage(pkg)
  // 支払い元が分からない下書きは、どのカードに足すか決められないので出さない
  if (!cardId) return { reason: '支払い元が決まらない（文面のカード名がカード設定のどれとも合わない）' }

  return { draft: { ...draft, cardId, source: sourceOf(text, pkg) } }
}

/**
 * @param {{ packageName?: string, postTime?: number, title?: string, text?: string,
 *           bigText?: string, subText?: string, infoText?: string, ticker?: string,
 *           allText?: string }} record
 * @returns {null | { source: string, cardId: string, amount: number, at: number,
 *                    date: string, payee: string, atFromText?: boolean }}
 */
export function parseCardNotification(record) {
  return explainCardNotification(record).draft ?? null
}
