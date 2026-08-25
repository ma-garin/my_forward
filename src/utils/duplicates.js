/**
 * 支出の重複らしさの判定。
 *
 * 同じ支出が二重に入る経路は今後増える（手入力 + 共有シート + 通知の
 * 自動取り込み）。判定を画面ごとに書くと基準が食い違うので、ここに一本化する。
 *
 * 「同じ日・同じ金額・同じ向き（支出/返金）」を重複らしいとみなす。
 * カテゴリは見ない。取り込み経路によって付くカテゴリが違うため、
 * カテゴリまで一致を求めると二重登録を素通しする。
 */

/**
 * @param {object} item 保存しようとしている支出
 * @param {object[]} list 保存先の変動費リスト
 * @param {string} [excludeId] 編集中の自分自身を除く
 * @returns {object|null} 重複らしい既存アイテム。無ければ null
 */
export function findDuplicate(item, list, excludeId) {
  const sign = item.sign === 1 ? 1 : 0
  return (
    list.find(
      (x) =>
        x.id !== excludeId &&
        x.date === item.date &&
        x.amount === item.amount &&
        (x.sign === 1 ? 1 : 0) === sign,
    ) ?? null
  )
}

/** 重複警告の文言。何と重なっているかが分かるように既存側の名前を出す */
export function duplicateMessage(dup) {
  const label = dup.payee || dup.name || dup.category || '支出'
  return `同じ日に同額の記録があります（${label} ¥${Number(dup.amount).toLocaleString('ja-JP')}）。二重登録でないか確認してください`
}
