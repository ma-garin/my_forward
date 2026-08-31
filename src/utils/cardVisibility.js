import { bumpDataVersion } from './ccStorage'

/**
 * 画面のカード（収支サマリー・家計診断など）の表示 / 非表示。
 *
 * カードが増えてきて、人によっては使わないものが場所を取る。
 * 消すのではなく隠す——設定でいつでも戻せる。
 *
 * 保存するのは「隠しているカードの id」だけ。表示が既定なので、
 * カードを増やしても保存データを触らなくてよい（新しいカードは必ず出る）。
 */

const KEY = 'cc_hidden_cards'

/** 隠せるカードの一覧（設定画面がこれを並べる）。本体機能の表は隠せない */
export const HIDEABLE_CARDS = [
  {
    tab: 'クレカ',
    items: [
      { id: 'cc.statement',   label: '明細と突合' },
      { id: 'cc.budget',      label: '予算内訳' },
      { id: 'cc.daily',       label: '日別支出グラフ' },
      { id: 'cc.spendType',   label: '消費分類' },
      { id: 'cc.categoryChart', label: 'カテゴリ別グラフ' },
      { id: 'cc.categoryBreakdown', label: 'カテゴリ別集計' },
      { id: 'cc.yearly',      label: '年間サマリー' },
    ],
  },
  {
    tab: '家計',
    items: [
      { id: 'kk.income',      label: '収支サマリー' },
      { id: 'kk.diagnosis',   label: '家計診断' },
      { id: 'kk.combined',    label: '支出合計（2枚合計）' },
      { id: 'kk.networth',    label: '資産（純資産）' },
      { id: 'kk.living',      label: '生活費' },
      { id: 'kk.trend',       label: '支出トレンド' },
      { id: 'kk.yearlyReview', label: '年次の振り返り' },
      { id: 'kk.inventory',   label: '固定費の棚卸し' },
      { id: 'kk.spendType',   label: '消費分類' },
      { id: 'kk.categoryChart', label: 'カテゴリ別グラフ' },
      { id: 'kk.categoryBreakdown', label: 'カテゴリ別集計' },
    ],
  },
]

export function loadHiddenCards() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isCardVisible(id) {
  return !loadHiddenCards().includes(id)
}

export function setCardVisible(id, visible) {
  try {
    const set = new Set(loadHiddenCards())
    if (visible) set.delete(id)
    else set.add(id)
    localStorage.setItem(KEY, JSON.stringify([...set]))
    bumpDataVersion()
  } catch (e) {
    console.warn('setCardVisible failed', e)
  }
}
