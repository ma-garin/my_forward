/**
 * 振替（お金の置き換え）かどうか。
 *
 * 交通系 IC や電子マネーへのチャージは、家計の外にお金が出ていない。
 * 財布からカードへ移しただけで、使われるのはその後。
 *
 * チャージをカードで払うと、カード側に支出として記録される。そこへ Suica の
 * 利用履歴も取り込むと、同じお金を 2 回数える。だからチャージ側を振替として
 * 合計から外す。
 *
 * 現金でチャージした場合はどこにも記録が無いので、Suica の利用がそのまま
 * 家計の支出になる（こちらは二重にならない）。
 */

// チャージ先として書かれる名前。カードを増やしても文面は変わらないので
// ここに足すだけでよい
const TRANSFER_PATTERNS = [
  /モバイルsuica/i,
  /suica/i,
  /pasmo/i,
  /icoca/i,
  /オートチャージ/,
  /チャージ/,
  /楽天edy|nanaco|waon/i,
]

/**
 * 支払先・品名から振替らしさを見る。
 * 当てにいくのは「チャージ」と分かる文面だけ。外したときは画面で直せる。
 */
export function looksLikeTransfer(...texts) {
  const text = texts.filter(Boolean).join(' ')
  if (!text) return false
  return TRANSFER_PATTERNS.some((re) => re.test(text))
}
