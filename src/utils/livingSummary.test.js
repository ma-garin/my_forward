import { describe, it, expect, beforeEach } from 'vitest'
import { weeklyLivingSummary } from './livingSummary'
import { CARDS, getBillingYmForDate, getThisWeekRange, saveLivingUnit } from './ccStorage'

beforeEach(() => localStorage.clear())

// 「今週」は実行日によって変わるので、範囲そのものを基準に組み立てる
const { weekStartStr, weekEndStr } = getThisWeekRange()

const shift = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(y, m - 1, d + days)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** JCB の、その日付が属する請求月に変動費を 1 件置く */
const putJcb = (date, item) => {
  const ym = getBillingYmForDate(date, CARDS.jcb.cutoffDay)
  const key = `cc_var_jcb_${ym}`
  const list = JSON.parse(localStorage.getItem(key) ?? '[]')
  list.push({ id: `${date}-${item.amount}`, date, ...item })
  localStorage.setItem(key, JSON.stringify(list))
}

describe('今週の生活費', () => {
  it('週の中の生活費だけを数える', () => {
    putJcb(weekStartStr, { amount: 1200, category: '食費' })
    putJcb(weekEndStr,   { amount: 800,  category: '日用品' })
    putJcb(shift(weekStartStr, -1), { amount: 5000, category: '食費' })   // 先週
    putJcb(shift(weekEndStr, 1),    { amount: 5000, category: '食費' })   // 来週

    expect(weeklyLivingSummary().used).toBe(2000)
  })

  it('生活費以外の分類は数えない', () => {
    putJcb(weekStartStr, { amount: 1000, category: '食費' })
    putJcb(weekStartStr, { amount: 9000, category: '交際費' })

    expect(weeklyLivingSummary().used).toBe(1000)
  })

  it('予算と残りを出す', () => {
    saveLivingUnit(10000)
    putJcb(weekStartStr, { amount: 2500, category: '生活費' })

    const s = weeklyLivingSummary()
    expect(s.budget).toBe(10000)
    expect(s.remain).toBe(7500)
    expect(s.pct).toBe(25)
  })

  it('未設定なら既定の週予算 10,000 を使う', () => {
    expect(weeklyLivingSummary().budget).toBe(10000)
  })

  it('予算 0 でも割合は 0（0 除算にしない）', () => {
    saveLivingUnit(0)
    putJcb(weekStartStr, { amount: 2500, category: '生活費' })

    const s = weeklyLivingSummary()
    expect(s.budget).toBe(0)
    expect(s.pct).toBe(0)
    expect(Number.isFinite(s.pct)).toBe(true)
  })

  it('週の範囲を返す（ウィジェットが古さの判定に使う）', () => {
    const s = weeklyLivingSummary()
    expect(s.from).toBe(weekStartStr)
    expect(s.to).toBe(weekEndStr)
    expect(s.from <= s.to).toBe(true)
  })

  it('カードをまたいで合算する', () => {
    putJcb(weekStartStr, { amount: 1000, category: '食費' })
    const smbcYm = getBillingYmForDate(weekStartStr, CARDS.smbc.cutoffDay)
    localStorage.setItem(`cc_var_smbc_${smbcYm}`, JSON.stringify([
      { id: 's1', date: weekStartStr, amount: 400, category: '日用品' },
    ]))

    expect(weeklyLivingSummary().used).toBe(1400)
  })
})
