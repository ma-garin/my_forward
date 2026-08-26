import { CARD_LIST, loadFixed, loadVar } from './ccStorage'
import { isActiveForYm, signedAmount, addMonth } from './finance'

/**
 * 全カード・全期間を横断して支出を探す。
 *
 * これまで検索はクレカタブの変動費リストの中だけで、「あの店に去年いくら
 * 使ったか」を調べる手段がなかった。固定費も含め、期間をさかのぼって拾う。
 *
 * 月ごとの localStorage を舐めるので、遡る月数は呼び出し側が決める。
 */

const norm = (s) => (s ?? '').toString().normalize('NFKC').toLowerCase()

/** 品名・支払先・分類のどれかに、空白区切りの語がすべて含まれるか */
export function matches(item, terms) {
  if (!terms.length) return false
  const hay = norm(`${item.name ?? ''} ${item.payee ?? ''} ${item.category ?? ''}`)
  return terms.every((t) => hay.includes(t))
}

export function parseQuery(query) {
  return norm(query).split(/\s+/).filter(Boolean)
}

/**
 * @param {string} query 検索語（空白区切りの AND）
 * @param {object} [opts]
 * @param {string} [opts.fromYm] さかのぼる起点の請求月（含む）
 * @param {string} [opts.toYm]   終点の請求月（含む）。既定は今月
 * @param {number} [opts.months] 遡る月数（fromYm 未指定のとき使う）
 * @param {string} [opts.cardId] 支払い元で絞る
 * @returns {{ hits: object[], total: number, count: number }}
 *   hits は新しい順。item に _cardId / _ym / _type（'fixed' | 'var'）を付ける
 */
export function searchExpenses(query, opts = {}) {
  const terms = parseQuery(query)
  if (!terms.length) return { hits: [], total: 0, count: 0 }

  const now = new Date()
  const toYm = opts.toYm ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const months = opts.months ?? 24
  const fromYm = opts.fromYm ?? addMonth(toYm, -(months - 1))

  const cards = opts.cardId ? CARD_LIST.filter((c) => c.id === opts.cardId) : CARD_LIST
  const hits = []

  for (const card of cards) {
    // 固定費はカードごとに 1 リスト。月ごとに読み直さない
    const fixed = loadFixed(card.id)
    for (let ym = fromYm; ym <= toYm; ym = addMonth(ym, 1)) {
      for (const item of loadVar(card.id, ym)) {
        if (matches(item, terms)) hits.push({ ...item, _cardId: card.id, _ym: ym, _type: 'var' })
      }
      for (const item of fixed) {
        if (isActiveForYm(item, ym) && matches(item, terms)) {
          hits.push({ ...item, _cardId: card.id, _ym: ym, _type: 'fixed' })
        }
      }
    }
  }

  // 変動費は日付、固定費は請求月しか持たないので、日付が無ければ月の頭に置く
  const sortKey = (x) => x.date ?? `${x._ym}-01`
  hits.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1))

  return {
    hits,
    count: hits.length,
    total: hits.reduce((s, x) => s + signedAmount(x), 0),
  }
}

/** 月ごとの合計（古い順）。同じ店の使い方が増えているかを見る */
export function monthlyTotals(hits) {
  const map = new Map()
  for (const h of hits) {
    map.set(h._ym, (map.get(h._ym) ?? 0) + signedAmount(h))
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ym, total]) => ({ ym, total }))
}
