/**
 * 受け取った文面から支出の下書きを作る。
 *
 * 共有シート（他アプリから「共有 → my_forward」）で渡ってくる文面が対象。
 * カード会社ごとの利用通知の解析は文面が集まってから別途書くので、ここは
 * どの文面でも効く最小限（金額と見出し）に留める。埋まらなかった欄は
 * ユーザーが入力画面でそのまま直せる。
 */

// ¥1,234 /￥1234 / 1,234円 / 1234 円。小数は扱わない（家計簿の入力は整数）
const YEN_PREFIX = /[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/
const YEN_SUFFIX = /(\d{1,3}(?:,\d{3})*|\d+)\s*円/

function findAmount(text) {
  const m = YEN_PREFIX.exec(text) ?? YEN_SUFFIX.exec(text)
  if (!m) return 0
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** 見出しに使う 1 行。金額だけの行は中身が無いので飛ばす */
function findName(text) {
  const line = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s && !/^[¥￥\s\d,円]+$/.test(s))
  if (!line) return ''
  return line.length > 30 ? `${line.slice(0, 30)}…` : line
}

/**
 * @param {string} text 共有された文面
 * @returns {{ amount: number, name: string }} 埋まらなかった欄は 0 / 空文字
 */
export function parseExpenseText(text) {
  if (typeof text !== 'string' || !text.trim()) return { amount: 0, name: '' }
  return { amount: findAmount(text), name: findName(text) }
}
