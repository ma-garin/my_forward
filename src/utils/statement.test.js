import { describe, it, expect, beforeEach } from 'vitest'
import { loadStatement, saveStatement, isClosed, reconcile, diffLabel } from './statement'

beforeEach(() => localStorage.clear())

const putVar = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))
const putFixed = (cardId, list) =>
  localStorage.setItem(`cc_fixed_${cardId}`, JSON.stringify(list))

// JCB は 15 日締め → 2026-08 請求の締めは 2026-09-15
const BEFORE_CUTOFF = new Date(2026, 8, 10)
const AFTER_CUTOFF = new Date(2026, 8, 16)

describe('請求額の保存', () => {
  it('往復する', () => {
    saveStatement('jcb', '2026-08', 52340)
    expect(loadStatement('jcb', '2026-08')).toBe(52340)
  })

  it('未入力と 0 円を区別する', () => {
    expect(loadStatement('jcb', '2026-08')).toBe(null)
    saveStatement('jcb', '2026-08', 0)
    expect(loadStatement('jcb', '2026-08')).toBe(0)
  })

  it('空を渡すと消える', () => {
    saveStatement('jcb', '2026-08', 1000)
    saveStatement('jcb', '2026-08', '')
    expect(loadStatement('jcb', '2026-08')).toBe(null)
  })
})

describe('締めが終わっているか', () => {
  it('締め日を過ぎていれば対象', () => {
    expect(isClosed('jcb', '2026-08', AFTER_CUTOFF)).toBe(true)
  })

  it('締め日前は対象にしない（記録が増える途中）', () => {
    expect(isClosed('jcb', '2026-08', BEFORE_CUTOFF)).toBe(false)
  })

  it('締め日当日はまだ対象にしない', () => {
    expect(isClosed('jcb', '2026-08', new Date(2026, 8, 15))).toBe(false)
  })

  it('請求サイクルを持たない支払い元は対象外', () => {
    expect(isClosed('cash', '2026-08', AFTER_CUTOFF)).toBe(false)
    expect(isClosed('paypay', '2026-08', AFTER_CUTOFF)).toBe(false)
  })
})

describe('突合', () => {
  beforeEach(() => {
    putFixed('jcb', [{ id: 'f1', name: 'Netflix', amount: 1590, category: '遊興費' }])
    putVar('jcb', '2026-08', [
      { id: 'a', name: '買い物', amount: 50000, category: '食費', spendType: '消費', date: '2026-08-20' },
      { id: 'b', name: '返金', amount: 1000, category: '食費', spendType: '消費', date: '2026-08-21', sign: 1 },
    ])
  })

  it('記録は固定費 + 変動費（返金は差し引く）', () => {
    expect(reconcile('jcb', '2026-08', AFTER_CUTOFF).recorded).toBe(50590)
  })

  it('請求額が未入力なら差は出さない', () => {
    const r = reconcile('jcb', '2026-08', AFTER_CUTOFF)
    expect(r.statement).toBe(null)
    expect(r.diff).toBe(null)
    expect(r.matched).toBe(null)
  })

  it('一致していれば matched', () => {
    saveStatement('jcb', '2026-08', 50590)
    const r = reconcile('jcb', '2026-08', AFTER_CUTOFF)
    expect(r.diff).toBe(0)
    expect(r.matched).toBe(true)
  })

  it('請求のほうが多ければ記録が不足（入力漏れ）', () => {
    saveStatement('jcb', '2026-08', 51030)
    const r = reconcile('jcb', '2026-08', AFTER_CUTOFF)
    expect(r.diff).toBe(440)
    expect(diffLabel(r.diff)).toBe('記録が不足')
  })

  it('記録のほうが多ければ記録が過多（二重計上）', () => {
    saveStatement('jcb', '2026-08', 49590)
    const r = reconcile('jcb', '2026-08', AFTER_CUTOFF)
    expect(r.diff).toBe(-1000)
    expect(diffLabel(r.diff)).toBe('記録が過多')
  })

  it('締め日前かどうかも返す（画面で出し分ける）', () => {
    expect(reconcile('jcb', '2026-08', BEFORE_CUTOFF).closed).toBe(false)
    expect(reconcile('jcb', '2026-08', AFTER_CUTOFF).closed).toBe(true)
  })
})
