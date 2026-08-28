import { describe, it, expect, beforeEach } from 'vitest'
import { takeHomeFor, incomeDiffLabel } from './income'

beforeEach(() => localStorage.clear())

// 見込み（給与シミュレーション）を仕込む。控除後の手取りは
// getSimulatedIncome が計算するので、額そのものは固定しない
const putSim = (ym) =>
  localStorage.setItem('salary_simulation_monthly', JSON.stringify({
    version: 1, migratedLegacy: true,
    months: {
      [ym]: {
        fixed: {
          shokunokyuu: 300000, jyuutakuteate: 0, tsuukinteate: 0, shinyateate: 0,
          tokumei: 0, kenkouhoken: 15000, kouseinenkin: 27000,
          jyuuminzei: 12000, kumiaifi: 2000, shokuhi: 0,
        },
        overtime: 0, customUnit: '', payItems: [], dedItems: [],
      },
    },
  }))

const putActual = (ym, v) => {
  localStorage.setItem('cc_salary_override_by_ym', JSON.stringify({ [ym]: v }))
  localStorage.setItem('cc_salary_override_migrated_v1', '1')
}

describe('その月の手取り', () => {
  it('実績が無ければ見込みを使う', () => {
    putSim('2026-07')
    const r = takeHomeFor('2026-07')
    expect(r.estimate).toBeGreaterThan(0)
    expect(r.actual).toBe(null)
    expect(r.amount).toBe(r.estimate)
    expect(r.isActual).toBe(false)
    expect(r.diff).toBe(null)
  })

  it('実績が入っていれば実績を使う', () => {
    putSim('2026-07')
    putActual('2026-07', '271500')
    const r = takeHomeFor('2026-07')
    expect(r.actual).toBe(271500)
    expect(r.amount).toBe(271500)
    expect(r.isActual).toBe(true)
  })

  it('差は 実績 − 見込み', () => {
    putSim('2026-07')
    const estimate = takeHomeFor('2026-07').estimate
    putActual('2026-07', String(estimate + 35360))
    expect(takeHomeFor('2026-07').diff).toBe(35360)
  })

  it('見込みより少なければマイナス', () => {
    putSim('2026-07')
    const estimate = takeHomeFor('2026-07').estimate
    putActual('2026-07', String(estimate - 5000))
    const r = takeHomeFor('2026-07')
    expect(r.diff).toBe(-5000)
    expect(incomeDiffLabel(r.diff)).toBe('見込みより少ない')
  })

  it('実績 0 円は「未記録」と区別する', () => {
    putSim('2026-07')
    putActual('2026-07', '0')
    const r = takeHomeFor('2026-07')
    expect(r.isActual).toBe(true)
    expect(r.amount).toBe(0)
  })

  it('見込みも実績も無ければ 0', () => {
    const r = takeHomeFor('2026-07')
    expect(r.amount).toBe(0)
    expect(r.isActual).toBe(false)
  })

  it('月ごとに独立している', () => {
    putSim('2026-07')
    putActual('2026-07', '271500')
    expect(takeHomeFor('2026-08').isActual).toBe(false)
  })

  it('向きの言葉', () => {
    expect(incomeDiffLabel(null)).toBe('')
    expect(incomeDiffLabel(0)).toBe('見込みどおり')
    expect(incomeDiffLabel(1)).toBe('見込みより多い')
    expect(incomeDiffLabel(-1)).toBe('見込みより少ない')
  })
})
