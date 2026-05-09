import { describe, expect, it, beforeEach } from 'vitest'
import { collectActiveLocalData, validateSyncPayload, buildSyncPayload, isActiveKey } from '../services/localDataStore'

beforeEach(() => {
  localStorage.clear()
})

describe('localDataStore', () => {
  it('collects only active data keys', () => {
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([{ id: '1', amount: 1000 }]))
    localStorage.setItem('salary_simulation_monthly', JSON.stringify({ '2026-05': {} }))
    localStorage.setItem('unrelated_key', JSON.stringify({ x: 1 }))

    const data = collectActiveLocalData()

    expect(data.cc_fixed_jcb).toEqual([{ id: '1', amount: 1000 }])
    expect(data.salary_simulation_monthly).toEqual({ '2026-05': {} })
    expect(data.unrelated_key).toBeUndefined()
  })

  it('validates generated payload', async () => {
    localStorage.setItem('cc_var_jcb_2026-05', JSON.stringify([{ id: 'v1', amount: 500 }]))
    const payload = await buildSyncPayload({ appVersion: 'test' })
    const result = await validateSyncPayload(payload)
    expect(result.ok).toBe(true)
  })

  it('rejects invalid app payload', async () => {
    const result = await validateSyncPayload({ app: 'other', schemaVersion: 1, updatedAt: new Date().toISOString(), data: {} })
    expect(result.ok).toBe(false)
  })

  it('recognizes active keys', () => {
    expect(isActiveKey('cc_fixed_jcb')).toBe(true)
    expect(isActiveKey('salary_base_2026-05')).toBe(true)
    expect(isActiveKey('life_weekly_budget')).toBe(true)
    expect(isActiveKey('random')).toBe(false)
  })
})
