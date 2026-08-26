import { describe, it, expect, beforeEach } from 'vitest'
import { searchExpenses, monthlyTotals, matches } from './searchExpenses'

beforeEach(() => localStorage.clear())

const putVar = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))
const putFixed = (cardId, list) =>
  localStorage.setItem(`cc_fixed_${cardId}`, JSON.stringify(list))

const v = (id, name, amount, date, extra = {}) =>
  ({ id, name, amount, category: '食費', spendType: '消費', date, ...extra })

describe('横断検索', () => {
  it('カードをまたいで拾う', () => {
    putVar('jcb', '2026-08', [v('a', 'ユニクロ', 2990, '2026-08-20')])
    putVar('smbc', '2026-08', [v('b', 'ユニクロ 銀座', 5000, '2026-08-21')])
    const { count, total } = searchExpenses('ユニクロ', { toYm: '2026-08', months: 1 })
    expect(count).toBe(2)
    expect(total).toBe(7990)
  })

  it('月をまたいで遡る', () => {
    putVar('jcb', '2026-06', [v('a', 'ユニクロ', 1000, '2026-06-01')])
    putVar('jcb', '2026-08', [v('b', 'ユニクロ', 2000, '2026-08-01')])
    expect(searchExpenses('ユニクロ', { toYm: '2026-08', months: 3 }).count).toBe(2)
    // 遡る範囲の外は拾わない
    expect(searchExpenses('ユニクロ', { toYm: '2026-08', months: 2 }).count).toBe(1)
  })

  it('固定費も対象にする', () => {
    putFixed('jcb', [{ id: 'f1', name: 'Netflix', amount: 1590, category: '遊興費', day: 10 }])
    const { hits } = searchExpenses('netflix', { toYm: '2026-08', months: 2 })
    expect(hits).toHaveLength(2)          // 2 ヶ月ぶん、毎月かかる
    expect(hits[0]._type).toBe('fixed')
  })

  it('その月に効いていない固定費は拾わない', () => {
    putFixed('jcb', [{ id: 'f1', name: 'Netflix', amount: 1590, recurrence: 'once', targetYm: '2026-07' }])
    expect(searchExpenses('netflix', { toYm: '2026-08', months: 1 }).count).toBe(0)
    expect(searchExpenses('netflix', { toYm: '2026-07', months: 1 }).count).toBe(1)
  })

  it('支払先・分類でも引ける', () => {
    putVar('jcb', '2026-08', [v('a', 'ランチ', 900, '2026-08-20', { payee: 'スシロー' })])
    expect(searchExpenses('スシロー', { toYm: '2026-08', months: 1 }).count).toBe(1)
    expect(searchExpenses('食費', { toYm: '2026-08', months: 1 }).count).toBe(1)
  })

  it('空白区切りは AND', () => {
    putVar('jcb', '2026-08', [
      v('a', 'ユニクロ 銀座', 5000, '2026-08-20'),
      v('b', 'ユニクロ 新宿', 3000, '2026-08-21'),
    ])
    expect(searchExpenses('ユニクロ 銀座', { toYm: '2026-08', months: 1 }).count).toBe(1)
  })

  it('返金は差し引く', () => {
    putVar('jcb', '2026-08', [
      v('a', 'ユニクロ', 5000, '2026-08-20'),
      v('b', 'ユニクロ 返品', 2000, '2026-08-21', { sign: 1 }),
    ])
    expect(searchExpenses('ユニクロ', { toYm: '2026-08', months: 1 }).total).toBe(3000)
  })

  it('新しい順に並ぶ', () => {
    putVar('jcb', '2026-07', [v('a', 'ユニクロ', 1000, '2026-07-01')])
    putVar('jcb', '2026-08', [v('b', 'ユニクロ', 2000, '2026-08-01')])
    expect(searchExpenses('ユニクロ', { toYm: '2026-08', months: 2 }).hits.map((h) => h.id))
      .toEqual(['b', 'a'])
  })

  it('支払い元で絞れる', () => {
    putVar('jcb', '2026-08', [v('a', 'ユニクロ', 1000, '2026-08-20')])
    putVar('smbc', '2026-08', [v('b', 'ユニクロ', 2000, '2026-08-21')])
    expect(searchExpenses('ユニクロ', { toYm: '2026-08', months: 1, cardId: 'smbc' }).count).toBe(1)
  })

  it('空の検索語では何も返さない', () => {
    putVar('jcb', '2026-08', [v('a', 'ユニクロ', 1000, '2026-08-20')])
    expect(searchExpenses('', { toYm: '2026-08', months: 1 }).count).toBe(0)
    expect(searchExpenses('   ', { toYm: '2026-08', months: 1 }).count).toBe(0)
  })

  it('全角・大文字小文字の違いを吸収する', () => {
    putVar('jcb', '2026-08', [v('a', 'Amazon', 1000, '2026-08-20')])
    expect(searchExpenses('ａｍａｚｏｎ', { toYm: '2026-08', months: 1 }).count).toBe(1)
    expect(searchExpenses('AMAZON', { toYm: '2026-08', months: 1 }).count).toBe(1)
  })
})

describe('月ごとの合計', () => {
  it('古い順に月別で束ねる', () => {
    putVar('jcb', '2026-07', [v('a', 'ユニクロ', 1000, '2026-07-01')])
    putVar('jcb', '2026-08', [
      v('b', 'ユニクロ', 2000, '2026-08-01'),
      v('c', 'ユニクロ', 500, '2026-08-05'),
    ])
    const { hits } = searchExpenses('ユニクロ', { toYm: '2026-08', months: 2 })
    expect(monthlyTotals(hits)).toEqual([
      { ym: '2026-07', total: 1000 },
      { ym: '2026-08', total: 2500 },
    ])
  })
})

describe('一致の判定', () => {
  it('語がすべて含まれるときだけ一致', () => {
    const item = { name: 'ユニクロ 銀座', category: '衣類' }
    expect(matches(item, ['ユニクロ'])).toBe(true)
    expect(matches(item, ['ユニクロ', '衣類'])).toBe(true)
    expect(matches(item, ['ユニクロ', '新宿'])).toBe(false)
  })
})
