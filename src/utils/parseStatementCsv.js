/**
 * 明細 CSV を読んで支出の下書きにする。
 *
 * PayPay（QR決済）は個人向けの API を出していない。マネーフォワードや Zaim
 * でも自動連携できず、どこもアプリが出す取引履歴 CSV を読む形で対応している。
 * カード会社の「ご利用明細 CSV」も同じ形なので、PayPay 専用にはしない。
 *
 * 列の名前は出どころごとに違う（PayPay は英語、カード会社は日本語）。
 * 決め打ちにすると出どころが増えるたびに分岐が増えるので、見出しから
 * 当てて、外れたら画面で選び直せるようにする。
 */

// ─── CSV を配列にする ──────────────────────────────────────

/**
 * RFC4180 相当。引用符の中の改行・カンマ・二重引用符を落とさない。
 * split(',') で済ませると「利用先: 〇〇店, 渋谷」で列がずれる。
 */
export function splitCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  // BOM は先頭の列名に紛れ込んで見出し判定を外すので落とす
  const src = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  row.push(field)
  rows.push(row)

  // 空行は落とす（末尾の改行で 1 行増える）
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/**
 * 文字コードを決めてから読む。
 * 日本のカード会社の CSV は Shift_JIS がまだ多く、UTF-8 として読むと
 * 見出しも利用先も化ける（化けたまま取り込むと直す手間が増える）。
 */
export function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buffer)
    } catch {
      return new TextDecoder('utf-8').decode(buffer)
    }
  }
}

// ─── 列を当てる ────────────────────────────────────────────

const norm = (s) => String(s ?? '').normalize('NFKC').replace(/[\s_-]/g, '').toLowerCase()

// 見出しの候補。上にあるものほど優先する
const PATTERNS = {
  date:   [/取引日/, /利用日/, /ご利用日/, /日時/, /取引日時/, /^日付$/, /transactiondate/, /^date$/, /datetime/, /createdat/],
  amount: [/取引金額/, /利用金額/, /支払金額/, /ご利用金額/, /^金額$/, /出金/, /^amount$/, /transactionamount/, /price/],
  payee:  [/利用先/, /ご利用先/, /利用店名/, /店舗名/, /^店舗$/, /取引先/, /加盟店/, /内容/, /摘要/, /^merchant/, /storename/, /^store$/, /^shop/, /description/, /counterparty/],
  kind:   [/取引内容/, /取引種別/, /^種別$/, /^区分$/, /支払方法/, /支払い方法/, /transactiontype/, /paymentmethod/, /^type$/, /^status$/],
}

/** 見出しの行から、どの列が何かを当てる。当てられない列は null */
export function detectColumns(headers) {
  const cols = headers.map(norm)
  const used = new Set()
  const result = { date: null, amount: null, payee: null, kind: null }

  for (const [key, patterns] of Object.entries(PATTERNS)) {
    for (const re of patterns) {
      const i = cols.findIndex((h, idx) => !used.has(idx) && re.test(h))
      if (i >= 0) { result[key] = i; used.add(i); break }
    }
  }
  return result
}

// ─── 値を読む ──────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')

/**
 * 日付。2026/8/20・2026-08-20・2026年8月20日・20260820 と、
 * 後ろに時刻が付いた形（2026/08/20 12:34）に対応する。
 */
export function parseDate(value) {
  const s = String(value ?? '').normalize('NFKC').trim()
  if (!s) return null

  let m = /(\d{4})\s*[/年.-]\s*(\d{1,2})\s*[/月.-]\s*(\d{1,2})/.exec(s)
  if (!m) {
    const digits = /^(\d{4})(\d{2})(\d{2})$/.exec(s.replace(/\D/g, ''))
    if (!digits) return null
    m = digits
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${pad(mo)}-${pad(d)}`
}

/**
 * 金額。¥1,200 / 1,200円 / -1200 / △1,200 / ▲1,200 / (1,200) を読む。
 * 符号は書かれたまま返す（どちらを支出とみなすかは呼び出し側が決める）。
 */
export function parseAmount(value) {
  const s = String(value ?? '').normalize('NFKC').trim()
  if (!s) return null
  const negative = /^[-−△▲]/.test(s) || /^\(.*\)$/.test(s)
  const n = Number(s.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n === 0) return null
  return negative ? -Math.round(n) : Math.round(n)
}

// ─── 取り込み ──────────────────────────────────────────────

/**
 * CSV の本文から下書きを作る。
 *
 * @param {string} text CSV 本文
 * @param {object} [options]
 * @param {object} [options.columns] 列の指定（画面で選び直したとき）
 * @param {boolean} [options.expenseIsNegative] マイナスを支出として扱うか。
 *   省略時は中身から決める（マイナスが 1 件でもあれば「マイナス＝支出」）
 * @returns {{
 *   headers: string[], columns: object, expenseIsNegative: boolean,
 *   rows: object[], skipped: { noDate: number, noAmount: number, notExpense: number },
 * }}
 */
export function parseStatementCsv(text, options = {}) {
  const table = splitCsv(text)
  if (table.length === 0) {
    return { headers: [], columns: { date: null, amount: null, payee: null, kind: null },
      expenseIsNegative: true, rows: [], skipped: { noDate: 0, noAmount: 0, notExpense: 0 } }
  }

  const headers = table[0].map((h) => h.trim())
  const columns = { ...detectColumns(headers), ...(options.columns ?? {}) }
  const body = table.slice(1)

  // 金額の書き方は出どころで違う。支払いをマイナスで書く CSV と、
  // プラスで書いて種別で区別する CSV がある。中身を見て決める
  const amounts = columns.amount == null ? []
    : body.map((r) => parseAmount(r[columns.amount])).filter((v) => v != null)
  const expenseIsNegative = options.expenseIsNegative
    ?? amounts.some((v) => v < 0)

  const rows = []
  const skipped = { noDate: 0, noAmount: 0, notExpense: 0 }

  for (const r of body) {
    const date = columns.date == null ? null : parseDate(r[columns.date])
    const amount = columns.amount == null ? null : parseAmount(r[columns.amount])
    if (amount == null) { skipped.noAmount++; continue }
    if (!date) { skipped.noDate++; continue }

    // 支出でない行（チャージ・送金の受け取り・ポイント付与）は落とす。
    // 家計に入れると、使ってもいない額が支出として積まれる
    const isExpense = expenseIsNegative ? amount < 0 : amount > 0
    if (!isExpense) { skipped.notExpense++; continue }

    rows.push({
      date,
      amount: Math.abs(amount),
      payee: columns.payee == null ? '' : String(r[columns.payee] ?? '').trim(),
      kind:  columns.kind  == null ? '' : String(r[columns.kind]  ?? '').trim(),
    })
  }

  return { headers, columns, expenseIsNegative, rows, skipped }
}

/**
 * 下書きを受信箱の形にそろえる。
 *
 * CSV には時刻が無いことが多い。受信箱の重複判定は時刻の近さを見るので、
 * その日の正午を入れて、同じ日の同額を同じ買い物として潰せるようにする。
 */
export function toDrafts(rows, cardId) {
  return rows.map((r) => {
    const [y, m, d] = r.date.split('-').map(Number)
    return {
      source: 'csv',
      cardId,
      amount: r.amount,
      at: new Date(y, m - 1, d, 12, 0, 0).getTime(),
      date: r.date,
      payee: r.payee,
    }
  })
}
