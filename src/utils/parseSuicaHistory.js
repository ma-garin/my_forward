/**
 * モバイルSuica の利用履歴（画面の読み取り結果）を支出の行にする。
 *
 * JR 東日本は個人向けの利用履歴 API を出しておらず、モバイルSuica 自体に
 * CSV 書き出しも無い。会員サイトを読みに行く方法は ID・パスワードと画像認証が
 * 要り、「外と通信しない」という前提を壊す。残る手が、アプリの利用履歴画面を
 * そのまま読むこと。
 *
 * 画面に出るのは **月日・種別・利用場所・残額** の 4 つで、**使った額は
 * 出ていない**。だから残額の差から出す。
 *
 *   使った額 = ひとつ前（＝1 行下・古い方）の残額 − その行の残額
 *
 * 履歴は新しい順に並ぶので、下の行ほど古い。いちばん下の行は「ひとつ前」が
 * 無いので額を出せない（取り込まずに数える）。
 */

// ─── 文字をそろえる ────────────────────────────────────────

/** OCR は ¥ を Y や ￥ に、カンマを . に読み違える。読む前にそろえる */
export function normalizeLine(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[¥￥\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const DATE = /(?:(\d{4})[/.年-])?(\d{1,2})[/.月-](\d{1,2})/
// 残額は 3 桁区切りか 3 桁以上の数字。1〜2 桁の数字（駅ナンバリング等）は拾わない
const NUMBER = /-?\d{1,3}(?:,\d{3})+|-?\d{3,}/g

const pad = (n) => String(n).padStart(2, '0')

/**
 * 月日だけの表示に年を足す。
 * 履歴は過去のものなので、今日より先になったら前の年とみなす
 * （1 月に 12 月の履歴を読むとき）。
 */
export function resolveDate(match, today = new Date()) {
  const [, y, mo, d] = match
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (y) return `${Number(y)}-${pad(month)}-${pad(day)}`

  const year = today.getFullYear()
  const candidate = new Date(year, month - 1, day)
  // 3 日ぶんは余裕を見る（端末の日付が少し進んでいても前年に飛ばさない）
  const slack = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)
  const resolved = candidate > slack ? year - 1 : year
  return `${resolved}-${pad(month)}-${pad(day)}`
}

/** 行から残額（いちばん右の数字）と、種別・場所の文字を取り出す */
export function readLine(text) {
  const line = normalizeLine(text)
  if (!line) return null

  // 日付を先に取り除く。残さないと 2026/08/20 の「2026」を残額として読む。
  // 「2026年8月」のような見出しも同じなので、年月日が付いた数字も落とす
  const dateMatch = DATE.exec(line)
  const rest = (dateMatch ? line.replace(dateMatch[0], ' ') : line)
    .replace(/\d+\s*[年月日]/g, ' ')
  const numbers = rest.match(NUMBER)

  // 数字を取り除いた残りが種別・利用場所
  let label = rest
  if (numbers) for (const n of numbers) label = label.replace(n, ' ')
  label = label.replace(/残額|残高/g, ' ').replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim()

  return {
    line,
    date: dateMatch,
    // 残額は右端に出る
    balance: numbers ? Number(numbers[numbers.length - 1].replace(/,/g, '')) : null,
    label,
  }
}

// ─── 取り込み ──────────────────────────────────────────────

/**
 * 読み取った行（上から下の順）から支出の行を作る。
 *
 * @param {string[]|{text:string}[]} lines 画面の行（新しい順に並んでいる前提）
 * @param {object} [options]
 * @param {Date} [options.today] 年を決めるための基準日
 * @returns {{
 *   rows: { date: string, amount: number, payee: string, balance: number }[],
 *   charges: number, noChange: number, lastRow: number, read: number,
 * }}
 */
export function parseSuicaHistory(lines, options = {}) {
  const today = options.today ?? new Date()

  // 月日が別の行に出る作りもあるので、直前に見た日付を引き継ぐ
  const entries = []
  let currentDate = null

  for (const raw of lines) {
    const parsed = readLine(typeof raw === 'string' ? raw : raw?.text)
    if (!parsed) continue
    if (parsed.date) {
      const resolved = resolveDate(parsed.date, today)
      if (resolved) currentDate = resolved
    }
    if (parsed.balance == null || !currentDate) continue
    entries.push({ date: currentDate, balance: parsed.balance, label: parsed.label })
  }

  const rows = []
  let charges = 0
  let noChange = 0

  // 1 行下（古い方）の残額との差が、その行で動いた額
  for (let i = 0; i < entries.length - 1; i++) {
    const cur = entries[i]
    const older = entries[i + 1]
    const diff = older.balance - cur.balance

    if (diff === 0) { noChange++; continue }
    if (diff < 0) {
      // 残額が増えている＝チャージ。家計から出たのはチャージ元（カード・現金）
      // の側なので、ここで支出にすると二重に数える
      charges++
      continue
    }
    rows.push({ date: cur.date, amount: diff, payee: cur.label, balance: cur.balance })
  }

  return {
    rows,
    charges,
    noChange,
    // いちばん古い行は「ひとつ前の残額」が無いので額を出せない
    lastRow: entries.length > 0 ? 1 : 0,
    read: entries.length,
  }
}
