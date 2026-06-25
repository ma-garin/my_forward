import { describe, it, expect } from 'vitest'
import {
  ymStr, addMonth, parseAmount, fmtInput, fmt,
  isActiveForYm, currentBillingYm, isBonusMonth, getBonusCycleInfo,
  salaryIncomeDeduction, basicDeduction, calcKoyouhoken, calcShotokuzei,
  overtimeUnitPrice, overtimeUnitPriceFloor, calcTotalPay,
} from './finance'
import { getBillingYmForDate, getBillingMonthsForRange } from './ccStorage'

// ─── 文字列・数値ユーティリティ ──────────────────────────────

describe('ymStr', () => {
  it('月をゼロ埋めする', () => {
    expect(ymStr(2026, 3)).toBe('2026-03')
    expect(ymStr(2026, 12)).toBe('2026-12')
  })
})

describe('addMonth', () => {
  it('年跨ぎを正しく処理する', () => {
    expect(addMonth('2026-12', 1)).toBe('2027-01')
    expect(addMonth('2026-01', -1)).toBe('2025-12')
    expect(addMonth('2026-06', 0)).toBe('2026-06')
    expect(addMonth('2026-01', -13)).toBe('2024-12')
  })
})

describe('parseAmount', () => {
  it('カンマ込みの金額を数値化し、不正値は0', () => {
    expect(parseAmount('1,234')).toBe(1234)
    expect(parseAmount('1000')).toBe(1000)
    expect(parseAmount('abc')).toBe(0)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount(null)).toBe(0)
    expect(parseAmount(undefined)).toBe(0)
  })
})

describe('fmtInput / fmt', () => {
  it('カンマ区切りに整形する', () => {
    expect(fmtInput('1234')).toBe('1,234')
    expect(fmtInput('')).toBe('')
    expect(fmtInput('abc')).toBe('')
    expect(fmt(1234567)).toBe('1,234,567')
    expect(fmt(0)).toBe('0')
  })
})

// ─── 固定費の有効月判定 ──────────────────────────────────────

describe('isActiveForYm', () => {
  it('monthly: startYm 未設定なら常に有効', () => {
    expect(isActiveForYm({}, '2026-01')).toBe(true)
    expect(isActiveForYm({ recurrence: 'monthly' }, '2030-12')).toBe(true)
  })

  it('monthly: startYm 以降のみ有効', () => {
    const item = { recurrence: 'monthly', startYm: '2026-03' }
    expect(isActiveForYm(item, '2026-02')).toBe(false)
    expect(isActiveForYm(item, '2026-03')).toBe(true)
    expect(isActiveForYm(item, '2026-04')).toBe(true)
  })

  it('once: targetYm のみ有効', () => {
    const item = { recurrence: 'once', targetYm: '2026-05' }
    expect(isActiveForYm(item, '2026-05')).toBe(true)
    expect(isActiveForYm(item, '2026-04')).toBe(false)
    expect(isActiveForYm(item, '2026-06')).toBe(false)
  })

  it('interval: baseYm から intervalMonths ごとに有効', () => {
    const item = { recurrence: 'interval', baseYm: '2026-01', intervalMonths: 3 }
    expect(isActiveForYm(item, '2026-01')).toBe(true)
    expect(isActiveForYm(item, '2026-04')).toBe(true)
    expect(isActiveForYm(item, '2026-07')).toBe(true)
    expect(isActiveForYm(item, '2026-02')).toBe(false)
    expect(isActiveForYm(item, '2025-12')).toBe(false) // baseYm より前
  })

  it('interval: 必須フィールド欠落時は無効', () => {
    expect(isActiveForYm({ recurrence: 'interval' }, '2026-01')).toBe(false)
    expect(isActiveForYm({ recurrence: 'interval', baseYm: '2026-01' }, '2026-01')).toBe(false)
  })
})

// ─── 請求月変換（締め日基準）──────────────────────────────────

describe('getBillingYmForDate', () => {
  it('15日締め: 締め日以前は前月請求', () => {
    expect(getBillingYmForDate('2026-05-04', 15)).toBe('2026-04')
    expect(getBillingYmForDate('2026-05-15', 15)).toBe('2026-04')
    expect(getBillingYmForDate('2026-05-16', 15)).toBe('2026-05')
    expect(getBillingYmForDate('2026-05-31', 15)).toBe('2026-05')
  })

  it('15日締め: 1月の前月は前年12月', () => {
    expect(getBillingYmForDate('2026-01-10', 15)).toBe('2025-12')
  })

  it('月末締め(0): 常に当月請求', () => {
    expect(getBillingYmForDate('2026-05-01', 0)).toBe('2026-05')
    expect(getBillingYmForDate('2026-05-31', 0)).toBe('2026-05')
  })
})

describe('getBillingMonthsForRange', () => {
  it('期間が請求月をまたぐ場合は両方を返す', () => {
    const months = getBillingMonthsForRange('2026-05-10', '2026-05-20', 15)
    expect(months).toContain('2026-04')
    expect(months).toContain('2026-05')
    expect(months).toHaveLength(2)
  })

  it('同一請求月内なら1つだけ返す', () => {
    expect(getBillingMonthsForRange('2026-05-16', '2026-05-20', 15)).toEqual(['2026-05'])
  })
})

// ─── 給与計算ロジック ────────────────────────────────────────

describe('salaryIncomeDeduction', () => {
  it('各区分の境界を計算する', () => {
    expect(salaryIncomeDeduction(100000)).toBe(54167)        // <=158333 定額
    expect(salaryIncomeDeduction(200000)).toBe(Math.ceil(200000 * 0.30 + 6667))
    expect(salaryIncomeDeduction(400000)).toBe(Math.ceil(400000 * 0.20 + 36667))
    expect(salaryIncomeDeduction(600000)).toBe(Math.ceil(600000 * 0.10 + 91667))
    expect(salaryIncomeDeduction(800000)).toBe(162500)        // 上限
  })
})

describe('basicDeduction', () => {
  it('所得に応じて段階的に減額する', () => {
    expect(basicDeduction(2000000)).toBe(48334)
    expect(basicDeduction(2150000)).toBe(40000)
    expect(basicDeduction(2190000)).toBe(26667)
    expect(basicDeduction(2230000)).toBe(13334)
    expect(basicDeduction(2300000)).toBe(0)
  })
})

describe('calcKoyouhoken', () => {
  it('総支給の0.5%を切り捨てる', () => {
    expect(calcKoyouhoken(300000)).toBe(1500)
    expect(calcKoyouhoken(333333)).toBe(Math.floor(333333 * 0.005))
  })
})

describe('calcShotokuzei', () => {
  it('10円単位に丸めて返す', () => {
    const tax = calcShotokuzei(300000, 45000)
    expect(tax % 10).toBe(0)
    expect(tax).toBe(6300)
  })

  it('課税所得が0以下なら0', () => {
    expect(calcShotokuzei(50000, 45000)).toBe(0)
  })
})

describe('overtimeUnitPrice / Floor', () => {
  const f = { shokunokyuu: 250000, jyuutakuteate: 0, tokumei: 0 }
  it('round と floor の違いを反映する', () => {
    expect(overtimeUnitPrice(f)).toBe(Math.round(250000 / 154.8 * 1.25))
    expect(overtimeUnitPriceFloor(f)).toBe(Math.floor(250000 / 154.8 * 1.25))
    expect(overtimeUnitPrice(f)).toBeGreaterThanOrEqual(overtimeUnitPriceFloor(f))
  })
})

describe('calcTotalPay', () => {
  it('固定支給＋残業代を合算する', () => {
    const f = {
      shokunokyuu: 250000, jyuutakuteate: 10000, tsuukinteate: 5000,
      shinyateate: 0, tokumei: 0,
    }
    const expected = 250000 + 10000 + 5000 + Math.floor(overtimeUnitPrice(f) * 10) + 0 + 0
    expect(calcTotalPay(f, 10)).toBe(expected)
  })
})

// ─── 賞与・請求月 ────────────────────────────────────────────

describe('isBonusMonth', () => {
  it('5,6,11,12月のみ賞与月', () => {
    expect(isBonusMonth('2026-05')).toBe(true)
    expect(isBonusMonth('2026-06')).toBe(true)
    expect(isBonusMonth('2026-11')).toBe(true)
    expect(isBonusMonth('2026-12')).toBe(true)
    expect(isBonusMonth('2026-07')).toBe(false)
    expect(isBonusMonth('2026-01')).toBe(false)
  })
})

describe('getBonusCycleInfo', () => {
  it('賞与月でなければ null', () => {
    expect(getBonusCycleInfo('2026-07')).toBeNull()
  })

  it('夏(6月)はデフォルトで前月(5月)を対象月にする', () => {
    const info = getBonusCycleInfo('2026-06')
    expect(info.season).toBe('summer')
    expect(info.label).toBe('夏賞与')
    expect(info.previousYm).toBe('2026-05')
    expect(info.currentYm).toBe('2026-06')
    expect(info.targetYm).toBe('2026-05')
  })

  it('current 設定なら当月を対象月にする', () => {
    const info = getBonusCycleInfo('2026-12', { summer: 'previous', winter: 'current' })
    expect(info.season).toBe('winter')
    expect(info.targetYm).toBe('2026-12')
  })
})

// ─── 既定請求月 ──────────────────────────────────────────────

describe('currentBillingYm', () => {
  it('YYYY-MM 形式を返す', () => {
    expect(currentBillingYm()).toMatch(/^\d{4}-\d{2}$/)
  })
})
