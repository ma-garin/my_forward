import { describe, it, expect } from 'vitest'
import { forecastCycle, cycleRange } from './forecast'
import { CARDS } from './ccStorage'

const JCB = CARDS.jcb      // 15日締め
const VISA = CARDS.smbc    // 月末締め
const CASH = CARDS.cash    // 締め日なし（暦月）

const d = (y, m, day) => new Date(y, m - 1, day)

describe('請求サイクルの期間', () => {
  it('15日締めは翌月15日までが 1 サイクル', () => {
    const { start, end } = cycleRange(JCB, '2026-08')
    expect(start).toEqual(d(2026, 8, 16))
    expect(end).toEqual(d(2026, 9, 15))
  })

  it('月末締めは暦月と同じ', () => {
    const { start, end } = cycleRange(VISA, '2026-08')
    expect(start).toEqual(d(2026, 8, 1))
    expect(end).toEqual(d(2026, 8, 31))
  })

  it('締め日を持たない支払い元も暦月', () => {
    const { start, end } = cycleRange(CASH, '2026-02')
    expect(start).toEqual(d(2026, 2, 1))
    expect(end).toEqual(d(2026, 2, 28))
  })
})

describe('着地の見込み', () => {
  it('経過ぶんのペースで月末まで延ばす', () => {
    // 8/1〜8/31 の 31 日。8/10 時点（10日経過）で 20,000 円
    // → 1日 2,000 円 → 月末 62,000 円
    const f = forecastCycle({ card: VISA, ym: '2026-08', varTotal: 20000, now: d(2026, 8, 10) })
    expect(f.elapsedDays).toBe(10)
    expect(f.totalDays).toBe(31)
    expect(f.forecast).toBe(62000)
  })

  it('固定費は日割りせず、そのまま足す', () => {
    const f = forecastCycle({
      card: VISA, ym: '2026-08', varTotal: 20000, fixedTotal: 5000, now: d(2026, 8, 10),
    })
    expect(f.forecast).toBe(67000)
  })

  it('上限を超えそうなら超過額を出す', () => {
    const f = forecastCycle({
      card: VISA, ym: '2026-08', varTotal: 20000, limit: 50000, now: d(2026, 8, 10),
    })
    expect(f.overBy).toBe(12000)
  })

  it('上限に収まる見込みなら超過は 0', () => {
    const f = forecastCycle({
      card: VISA, ym: '2026-08', varTotal: 20000, limit: 80000, now: d(2026, 8, 10),
    })
    expect(f.overBy).toBe(0)
  })

  it('残り日数で上限に収めるための 1 日あたりを出す', () => {
    // 上限 50,000 − 実績 20,000 = 30,000 を残り 21 日で
    const f = forecastCycle({
      card: VISA, ym: '2026-08', varTotal: 20000, limit: 50000, now: d(2026, 8, 10),
    })
    expect(f.remainingDays).toBe(21)
    expect(f.safePerDay).toBe(1429)
  })

  it('上限を使い切っていれば 1 日あたりは 0', () => {
    const f = forecastCycle({
      card: VISA, ym: '2026-08', varTotal: 60000, limit: 50000, now: d(2026, 8, 10),
    })
    expect(f.safePerDay).toBe(0)
  })

  it('15日締めのカードは締め日基準で数える', () => {
    // 8/16 開始。8/25 は 10 日経過、サイクルは 31 日（8/16〜9/15）
    const f = forecastCycle({ card: JCB, ym: '2026-08', varTotal: 10000, now: d(2026, 8, 25) })
    expect(f.elapsedDays).toBe(10)
    expect(f.totalDays).toBe(31)
    expect(f.forecast).toBe(31000)
  })
})

describe('予測を出さない場合', () => {
  it('まだ数日ぶんしか実績がないときは出さない', () => {
    expect(forecastCycle({ card: VISA, ym: '2026-08', varTotal: 5000, now: d(2026, 8, 2) })).toBe(null)
  })

  it('終わったサイクルには出さない（実績が確定している）', () => {
    expect(forecastCycle({ card: VISA, ym: '2026-07', varTotal: 5000, now: d(2026, 8, 10) })).toBe(null)
  })

  it('まだ始まっていないサイクルには出さない', () => {
    expect(forecastCycle({ card: VISA, ym: '2026-09', varTotal: 0, now: d(2026, 8, 10) })).toBe(null)
  })

  it('締め日当日でも出す（最終日まで見込みは要る）', () => {
    const f = forecastCycle({ card: VISA, ym: '2026-08', varTotal: 31000, now: d(2026, 8, 31) })
    expect(f.elapsedDays).toBe(31)
    expect(f.remainingDays).toBe(0)
    expect(f.forecast).toBe(31000)
  })
})
