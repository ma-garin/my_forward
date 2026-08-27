import { describe, it, expect, beforeEach } from 'vitest'
import { spendWidgetData, inboxWidgetData } from './widgetData'

beforeEach(() => localStorage.clear())

const putVar = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))

const v = (id, amount, date, extra = {}) =>
  ({ id, name: '買い物', amount, category: '食費', spendType: '消費', date, ...extra })

// JCB は 15 日締め。8/26 時点の請求月は 2026-08（サイクルは 8/16〜9/15）
const NOW = new Date(2026, 7, 26, 12, 0, 0)

describe('今月の支出ウィジェット', () => {
  it('全カードの変動費を合計する', () => {
    putVar('jcb', '2026-08', [v('a', 12000, '2026-08-20')])
    putVar('smbc', '2026-08', [v('b', 8000, '2026-08-21')])
    putVar('cash', '2026-08', [v('c', 1000, '2026-08-22')])
    expect(spendWidgetData(NOW).used).toBe(21000)
  })

  it('返金は差し引く', () => {
    putVar('jcb', '2026-08', [
      v('a', 12000, '2026-08-20'),
      v('b', 2000, '2026-08-21', { sign: 1 }),
    ])
    expect(spendWidgetData(NOW).used).toBe(10000)
  })

  it('固定費は入れない（変動費だけ）', () => {
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([
      { id: 'f1', name: 'Netflix', amount: 1590, category: '遊興費' },
    ]))
    putVar('jcb', '2026-08', [v('a', 5000, '2026-08-20')])
    expect(spendWidgetData(NOW).used).toBe(5000)
  })

  it('締め日を validTo に渡す（サイクルの終わり）', () => {
    // 2026-08 請求の JCB は 9/15 締め
    expect(spendWidgetData(NOW).validTo).toBe('2026-09-15')
  })

  it('着地見込みを出す', () => {
    // サイクルは 8/16 開始。8/26 は 11 日経過、全 31 日
    putVar('jcb', '2026-08', [v('a', 11000, '2026-08-20')])
    const d = spendWidgetData(NOW)
    expect(d.forecast).toBe(31000)
    expect(d.remainDays).toBe(20)
  })

  it('実績が数日ぶんのうちは見込みを出さない', () => {
    putVar('jcb', '2026-08', [v('a', 5000, '2026-08-17')])
    // 8/17 はサイクル 2 日目
    expect(spendWidgetData(new Date(2026, 7, 17, 12)).forecast).toBe(0)
  })

  it('データが無くても落ちない', () => {
    const d = spendWidgetData(NOW)
    expect(d.used).toBe(0)
    expect(d.ym).toBe('2026-08')
  })
})

describe('未確定の支出ウィジェット', () => {
  it('件数と合計を出す', () => {
    localStorage.setItem('cc_inbox', JSON.stringify([
      { id: 'd1', cardId: 'jcb', amount: 1320, at: 1, date: '2026-08-26', payee: 'スシロー' },
      { id: 'd2', cardId: 'smbc', amount: 680, at: 2, date: '2026-08-26', payee: '' },
    ]))
    expect(inboxWidgetData()).toEqual({ count: 2, total: 2000 })
  })

  it('空なら 0 件', () => {
    expect(inboxWidgetData()).toEqual({ count: 0, total: 0 })
  })

  it('壊れた保存データでも落ちない', () => {
    localStorage.setItem('cc_inbox', '{壊れている')
    expect(inboxWidgetData()).toEqual({ count: 0, total: 0 })
  })
})
