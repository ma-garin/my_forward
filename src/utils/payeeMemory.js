import { CARD_LIST, loadVar, getDataVersion } from './ccStorage'
import { currentBillingYm, addMonth } from './finance'

/**
 * 過去に登録した支出から、支払先・項目名・分類を思い出す。
 *
 * 出どころは登録済みの変動費そのもの（cc_var_*）。以前は入力のたびに
 * cc_payee_meta へ「前回選んだ分類」を書き写していたが、同じ事実が実データと
 * 控えの2箇所にあり、片方（手動入力の画面）でしか読んでいなかった。
 * 通知から登録する画面には何も引き継がれず、毎回入れ直しになっていた。
 *
 * 突き合わせは表記を均してから行う。通知の利用先は半角カナや全角英数で
 * 届くので（ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ / ＡＭＡＺＯＮ）、手で入れた表記とそのままでは当たらない。
 */

// 見にいく範囲。年1回しか出てこない支払先まで拾える長さにする
const MONTHS = 12

/**
 * 突き合わせ用のキー。NFKC で半角カナ・全角英数を均し、大小文字と
 * 区切り記号の違いを落とす。長音（ー）は語の一部なので残す。
 */
export function payeeKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/[-_/\\.,'"`|+*#:;!?()[\]{}<>~^&@¥$%、。「」『』【】〔〕]/g, '')
}

let cache = null
let cacheVersion = -1

function index() {
  if (cache && cacheVersion === getDataVersion()) return cache

  const map = new Map()
  let ym = currentBillingYm()
  for (let i = 0; i < MONTHS; i++) {
    for (const card of CARD_LIST) {
      for (const item of loadVar(card.id, ym)) {
        const key = payeeKey(item.payee)
        if (!key) continue
        // 同じ支払先が何度も出てくるので、いちばん新しい1件を残す
        const prev = map.get(key)
        if (prev && (prev.date ?? '') >= (item.date ?? '')) continue
        map.set(key, {
          payee: item.payee,
          name: item.name ?? '',
          category: item.category ?? '',
          spendType: item.spendType ?? '',
          date: item.date ?? '',
        })
      }
    }
    ym = addMonth(ym, -1)
  }

  cache = map
  cacheVersion = getDataVersion()
  return map
}

/**
 * 支払先から、前に同じ相手で登録した内容を返す。無ければ null。
 *
 * 完全一致（表記を均したうえで）が無いときは、片方がもう片方を含む
 * いちばん長いものを採る。店舗名が付く場合に当てるため
 * （「ローソン渋谷店」→「ローソン」）。2文字以下では見にいかない
 * （短い語はどこにでも含まれてしまう）。
 */
export function suggestFromPayee(raw) {
  const key = payeeKey(raw)
  if (!key) return null

  const map = index()
  const hit = map.get(key)
  if (hit) return hit

  if (key.length <= 2) return null
  let best = null
  let bestLen = 0
  for (const [k, v] of map) {
    if (k.length <= 2) continue
    if (!k.includes(key) && !key.includes(k)) continue
    if (k.length > bestLen) { best = v; bestLen = k.length }
  }
  return best
}
