import { describe, it, expect, beforeEach } from 'vitest'
import { diagnose } from './diagnosis'

beforeEach(() => localStorage.clear())

const YM = '2026-07'
const SUMMARY_FIXED = 82330 + 13262 + 3000 // 家計タブ固定費内訳の既定値

const putSalary = (map) => {
  localStorage.setItem('cc_salary_override_by_ym', JSON.stringify(map))
  localStorage.setItem('cc_salary_override_migrated_v1', '1')
}
const putVar = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))
const buy = (id, amount, spendType = '消費', extra = {}) =>
  ({ id, name: '買い物', amount, category: 'その他', spendType, date: `${YM}-20`, ...extra })
const get = (r, key) => r.items.find((x) => x.key === key)

describe('家計診断', () => {
  it('収入が無ければ収入系は判定しない', () => {
    const r = diagnose(YM)
    expect(get(r, 'saving').status).toBe('na')
    expect(get(r, 'fixedRatio').status).toBe('na')
    expect(get(r, 'streak').status).toBe('na')
  })

  it('全部 na なら点数を出さない（値上げなしの good だけでは採点しない）', () => {
    localStorage.setItem('cc_living_unit', '0')
    const r = diagnose(YM)
    // 値上げだけは常に判定できるので、点数は出る（100点）
    expect(r.score).toBe(100)
    expect(get(r, 'priceUp').status).toBe('good')
  })

  it('貯蓄率 2 割で good', () => {
    localStorage.setItem('cc_living_unit', '0')
    localStorage.setItem('cc_summary_fixed', JSON.stringify([{ id: 's1', label: '家賃', amount: 80000 }]))
    putSalary({ [YM]: '300000' })
    putVar('jcb', YM, [buy('a', 100000)])
    // 収支: 300000 − (100000 + 80000) = 120000 → 40%
    const r = diagnose(YM)
    expect(get(r, 'saving').status).toBe('good')
    expect(get(r, 'saving').value).toBe('40%')
  })

  it('赤字なら bad', () => {
    localStorage.setItem('cc_living_unit', '0')
    putSalary({ [YM]: '100000' })
    putVar('jcb', YM, [buy('a', 50000)])
    // 支出 = 50000 + 既定の固定費内訳 98592 > 収入
    const r = diagnose(YM)
    expect(get(r, 'saving').status).toBe('bad')
  })

  it('固定費比率はカードの固定費も足す', () => {
    localStorage.setItem('cc_living_unit', '0')
    localStorage.setItem('cc_summary_fixed', JSON.stringify([{ id: 's1', label: '家賃', amount: 60000 }]))
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([{ id: 'f1', name: 'Netflix', amount: 30000 }]))
    putSalary({ [YM]: '300000' })
    // (60000 + 30000) / 300000 = 30% → good
    const r = diagnose(YM)
    expect(get(r, 'fixedRatio').status).toBe('good')
    expect(get(r, 'fixedRatio').value).toBe('手取りの30%')
  })

  it('固定費が手取りの6割超なら bad', () => {
    localStorage.setItem('cc_living_unit', '0')
    localStorage.setItem('cc_summary_fixed', JSON.stringify([{ id: 's1', label: '家賃', amount: 190000 }]))
    putSalary({ [YM]: '300000' })
    expect(get(diagnose(YM), 'fixedRatio').status).toBe('bad')
  })

  it('浪費 5% 以下で good・返金と振替は分母に入れない', () => {
    putVar('jcb', YM, [
      buy('a', 95000, '消費'),
      buy('b', 5000, '浪費'),
      buy('c', 10000, '消費', { sign: 1 }),          // 返金
      buy('d', 50000, '浪費', { transfer: true }),   // 振替
    ])
    const r = diagnose(YM)
    expect(get(r, 'waste').status).toBe('good')
    expect(get(r, 'waste').value).toBe('変動費の5%')
  })

  it('浪費が 4 分の 1 を超えたら bad', () => {
    putVar('jcb', YM, [buy('a', 70000, '消費'), buy('b', 30000, '浪費')])
    expect(get(diagnose(YM), 'waste').status).toBe('bad')
  })

  it('3ヶ月黒字なら good・収入の無い月は数えない', () => {
    localStorage.setItem('cc_living_unit', '0')
    localStorage.setItem('cc_summary_fixed', JSON.stringify([]))
    putSalary({ '2026-07': '300000', '2026-06': '300000' }) // 2026-05 は未記録
    const r = diagnose(YM)
    expect(get(r, 'streak').status).toBe('good')
    expect(get(r, 'streak').value).toBe('2ヶ月中 2ヶ月')
  })

  it('直近3ヶ月の値上げを数える（値下げと古い記録は数えない）', () => {
    localStorage.setItem('cc_fixed_price_log', JSON.stringify([
      { id: 'a', name: 'Netflix', from: 1590, to: 1890, ym: '2026-07' },
      { id: 'b', name: 'ジム',    from: 8000, to: 7000, ym: '2026-07' }, // 値下げ
      { id: 'c', name: '保険',    from: 3000, to: 3500, ym: '2026-01' }, // 古い
    ]))
    const r = diagnose(YM)
    expect(get(r, 'priceUp').status).toBe('ok')
    expect(get(r, 'priceUp').advice).toContain('Netflix')
  })

  it('点数は判定できた観点だけで 100 点に換算する', () => {
    localStorage.setItem('cc_living_unit', '0')
    localStorage.setItem('cc_summary_fixed', JSON.stringify([{ id: 's1', label: '家賃', amount: 60000 }]))
    putSalary({ [YM]: '300000' })
    // saving good(40%超→good) / fixedRatio good(20%) / waste na / streak good / priceUp good
    const r = diagnose(YM)
    expect(get(r, 'waste').status).toBe('na')
    expect(r.score).toBe(100)
    expect(r.grade).toBe('A')
  })
})
