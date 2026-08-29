import { describe, it, expect, beforeEach } from 'vitest'
import { signedAmount, countsAsSpending, getCCTotal } from './finance'

describe('振替は支出に数えない', () => {
  beforeEach(() => localStorage.clear())

  const put = (list) => localStorage.setItem('cc_var_jcb_2026-08', JSON.stringify(list))
  const row = (id, amount, extra = {}) =>
    ({ id, name: '買い物', amount, category: 'その他', spendType: '消費', date: '2026-08-20', ...extra })

  it('signedAmount は振替を 0 にする', () => {
    expect(signedAmount(row('a', 3000, { transfer: true }))).toBe(0)
    expect(signedAmount(row('b', 3000))).toBe(3000)
    expect(signedAmount(row('c', 3000, { sign: 1 }))).toBe(-3000)
  })

  it('返金と振替が同時なら振替が勝つ（どちらも支出ではない）', () => {
    expect(signedAmount(row('a', 3000, { transfer: true, sign: 1 }))).toBe(0)
  })

  it('カード合計から外れる', () => {
    put([row('a', 2990), row('b', 3000, { transfer: true })])
    expect(getCCTotal('jcb', '2026-08').total).toBe(2990)
  })

  it('固定費は振替を持たない（合計はそのまま）', () => {
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([{ id: 'f1', name: 'Netflix', amount: 1590 }]))
    put([row('a', 3000, { transfer: true })])
    expect(getCCTotal('jcb', '2026-08')).toMatchObject({ fixed: 1590, variable: 0, total: 1590 })
  })

  it('countsAsSpending で分析からも外れる', () => {
    expect(countsAsSpending(row('a', 100))).toBe(true)
    expect(countsAsSpending(row('b', 100, { transfer: true }))).toBe(false)
  })
})
