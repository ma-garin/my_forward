import { describe, it, expect, beforeEach } from 'vitest'
import { fixedInventory, annualAmount, intervalLabel, priceIncreases } from './fixedInventory'
import { recordPriceChange, loadPriceLog } from './priceLog'
import { upsertFixedItem } from './ccStorage'

beforeEach(() => localStorage.clear())

const putFixed = (cardId, list) =>
  localStorage.setItem(`cc_fixed_${cardId}`, JSON.stringify(list))

describe('年額換算', () => {
  it('毎月は 12 倍', () => {
    expect(annualAmount({ amount: 1590 }, '2026-08')).toBe(19080)
  })

  it('2 ヶ月ごとは 6 回ぶん', () => {
    const item = { amount: 3000, recurrence: 'interval', intervalMonths: 2, baseYm: '2026-08' }
    expect(annualAmount(item, '2026-08')).toBe(18000)
  })

  it('1 回きりは、その月が 12 ヶ月に入っていれば 1 回ぶん', () => {
    const item = { amount: 12000, recurrence: 'once', targetYm: '2026-12' }
    expect(annualAmount(item, '2026-08')).toBe(12000)
    // 数え始めより前の月なら 0
    expect(annualAmount(item, '2027-01')).toBe(0)
  })

  it('開始月より前は数えない', () => {
    const item = { amount: 1000, recurrence: 'monthly', startYm: '2026-11' }
    // 2026-08 から 12 ヶ月（〜2027-07）のうち、11 月以降の 9 ヶ月ぶん
    expect(annualAmount(item, '2026-08')).toBe(9000)
  })
})

describe('間隔の表示', () => {
  it('繰り返しの種類ごとに読める形にする', () => {
    expect(intervalLabel({})).toBe('毎月')
    expect(intervalLabel({ recurrence: 'interval', intervalMonths: 3 })).toBe('3ヶ月ごと')
    expect(intervalLabel({ recurrence: 'once', targetYm: '2026-12' })).toBe('2026-12 のみ')
  })
})

describe('棚卸し', () => {
  it('年額の大きい順に並べ、合計と月平均を出す', () => {
    putFixed('jcb', [
      { id: 'a', name: 'Netflix', amount: 1590, category: '遊興費' },
      { id: 'b', name: 'サーバー', amount: 12000, recurrence: 'once', targetYm: '2026-10' },
    ])
    putFixed('smbc', [{ id: 'c', name: '保険', amount: 5000, category: 'その他' }])

    const { rows, annualTotal, monthlyAverage } = fixedInventory('2026-08')
    expect(rows.map((r) => r.name)).toEqual(['保険', 'Netflix', 'サーバー'])
    expect(rows[0]._annual).toBe(60000)
    expect(rows[0]._cardId).toBe('smbc')
    expect(annualTotal).toBe(60000 + 19080 + 12000)
    expect(monthlyAverage).toBe(Math.round(91080 / 12))
  })

  it('年額が 0 の項目は載せない（もう効いていない）', () => {
    putFixed('jcb', [{ id: 'a', name: '解約済み', amount: 500, recurrence: 'once', targetYm: '2020-01' }])
    expect(fixedInventory('2026-08').rows).toHaveLength(0)
  })
})

describe('値上げの記録', () => {
  const item = (amount) => ({ id: 'a', name: 'Netflix', amount, category: '遊興費' })

  it('金額が変わったときだけ残す', () => {
    expect(recordPriceChange({ before: item(1000), after: item(1590) })).toBe(true)
    expect(recordPriceChange({ before: item(1590), after: item(1590) })).toBe(false)
    expect(loadPriceLog()).toHaveLength(1)
    expect(loadPriceLog()[0]).toMatchObject({ id: 'a', from: 1000, to: 1590 })
  })

  it('固定費を保存し直すと自動で残る', () => {
    putFixed('jcb', [item(1000)])
    upsertFixedItem({ item: item(1590), fromCard: 'jcb' })
    expect(loadPriceLog()[0]).toMatchObject({ from: 1000, to: 1590 })
  })

  it('新規追加では残さない（前の金額が無い）', () => {
    upsertFixedItem({ item: item(1000), fromCard: 'jcb' })
    expect(loadPriceLog()).toHaveLength(0)
  })

  it('値下げは棚卸しに出さない', () => {
    recordPriceChange({ before: item(1590), after: item(1000) })
    expect(priceIncreases([item(1000)])).toHaveLength(0)
  })

  it('消した固定費の値上げは出さない', () => {
    recordPriceChange({ before: item(1000), after: item(1590) })
    expect(priceIncreases([])).toHaveLength(0)
  })

  it('棚卸しの結果に値上げが入る', () => {
    putFixed('jcb', [item(1590)])
    recordPriceChange({ before: item(1000), after: item(1590) })
    expect(fixedInventory('2026-08').increases).toHaveLength(1)
  })
})
