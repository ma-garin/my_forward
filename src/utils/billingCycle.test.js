import { describe, it, expect } from 'vitest'
import {
  cutoffDateForYm, cycleDatesForYm, daysUntil, cycleLabel, cutoffLabel, paymentLabel,
} from './billingCycle'
import { getBillingYmForDate } from './ccStorage'

const JCB  = { cutoffDay: 15, paymentDay: 10 }
const VISA = { cutoffDay: 0,  paymentDay: 26 }   // 月末締め

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('締め日', () => {
  it('ym の締めは翌月に落ちる（1 ヶ月早くならない）', () => {
    // 2026-08 請求ぶんの締めは 9/15。ym の月をそのまま使うと 8/15 になる
    expect(ymd(cutoffDateForYm(JCB, '2026-08'))).toBe('2026-09-15')
  })

  it('年をまたぐ', () => {
    expect(ymd(cutoffDateForYm(JCB, '2026-12'))).toBe('2027-01-15')
  })

  it('月末締め（cutoffDay=0）はその月の末日', () => {
    expect(ymd(cutoffDateForYm(VISA, '2026-08'))).toBe('2026-08-31')
    expect(ymd(cutoffDateForYm(VISA, '2026-01'))).toBe('2026-01-31')
  })

  // 締め日の求め方と、日付→請求月の振り分けが食い違うと集計がずれる。
  // 「締め日に使った分はその請求月に入る」で両者が噛み合っていることを見る
  it('getBillingYmForDate と噛み合う', () => {
    const check = (card, ym) => {
      const d = cutoffDateForYm(card, ym)
      expect(getBillingYmForDate(ymd(d), card.cutoffDay)).toBe(ym)
    }
    check(JCB, '2026-08')
    check(JCB, '2026-12')
    check(VISA, '2026-08')
    check(VISA, '2026-01')
  })
})

describe('支払日', () => {
  it('締めの翌月 paymentDay', () => {
    // 締め 9/15 → 10/10（土曜なので翌営業日の 10/12 へ）
    const { payDate } = cycleDatesForYm(JCB, '2026-08')
    expect(payDate.getMonth() + 1).toBe(10)
    expect(new Date(2026, 9, 10).getDay()).toBe(6)  // 前提: 10/10 は土曜
    expect(ymd(payDate)).toBe('2026-10-12')
  })

  it('平日ならその日のまま', () => {
    // 締め 10/15 → 11/10（火曜）
    expect(ymd(cycleDatesForYm(JCB, '2026-09').payDate)).toBe('2026-11-10')
  })

  it('月末締めのカードも同じ規則で決まる', () => {
    // 締め 8/31 → 9/26（土曜なので翌営業日の 9/28 へ）
    expect(ymd(cycleDatesForYm(VISA, '2026-08').payDate)).toBe('2026-09-28')
  })
})

describe('残り日数と表示', () => {
  const from = new Date(2026, 7, 24)   // 2026-08-24

  it('未到来は残り日数を出す', () => {
    expect(daysUntil(new Date(2026, 8, 15), from)).toBe(22)
    expect(cycleLabel('締め日', new Date(2026, 8, 15), from)).toBe('締め日まで あと22日（9/15）')
  })

  it('当日', () => {
    expect(cycleLabel('支払日', new Date(2026, 7, 24), from)).toBe('支払日 今日（8/24）')
  })

  it('過ぎていれば日付だけ', () => {
    expect(cycleLabel('支払日', new Date(2026, 7, 10), from)).toBe('支払日 8/10')
  })
})

describe('ラベル', () => {
  it('締め日・支払日の文言', () => {
    expect(cutoffLabel(JCB)).toBe('15日締め')
    expect(cutoffLabel(VISA)).toBe('月末締め')
    expect(paymentLabel(JCB)).toBe('翌月10日払い')
  })
})
