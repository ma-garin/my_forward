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

describe('給与シミュレーションの月またぎ', () => {
  beforeEach(() => localStorage.clear())

  it('保存していない月は、いちばん近い過去の保存月を読むだけで書き込まない', async () => {
    const { loadSalaryMonth, saveSalaryMonth, SALARY_MONTHLY_KEY } = await import('./finance')
    saveSalaryMonth('2026-09', { fixed: { shokunokyuu: 300000 }, customUnit: '2500', overtime: 10 })
    const nov = loadSalaryMonth('2026-11')
    expect(nov.customUnit).toBe('2500')
    expect(nov.fixed.shokunokyuu).toBe(300000)
    expect(Object.keys(JSON.parse(localStorage.getItem(SALARY_MONTHLY_KEY)).months)).toEqual(['2026-09'])
  })

  it('9 月で直した単価・固定項目は、同じ値のままの後の月にも届く', async () => {
    const { loadSalaryMonth, saveSalaryMonth } = await import('./finance')
    saveSalaryMonth('2026-09', { fixed: { shokunokyuu: 300000 }, customUnit: '2500', overtime: 10 })
    // 10 月は残業時間だけ変えて保存（単価・固定項目は 9 月と同じ）
    saveSalaryMonth('2026-10', { ...loadSalaryMonth('2026-10'), overtime: 30 })
    // 11 月は基本給を自分で変えている
    saveSalaryMonth('2026-11', { ...loadSalaryMonth('2026-11'), fixed: { shokunokyuu: 320000 } })

    saveSalaryMonth('2026-09', { fixed: { shokunokyuu: 310000 }, customUnit: '2600', overtime: 10 })

    const oct = loadSalaryMonth('2026-10')
    expect(oct.fixed.shokunokyuu).toBe(310000)
    expect(oct.customUnit).toBe('2600')
    expect(oct.overtime).toBe(30)
    const nov = loadSalaryMonth('2026-11')
    expect(nov.fixed.shokunokyuu).toBe(320000)   // 自分で変えた月は触らない
    expect(nov.customUnit).toBe('2600')
  })
})
