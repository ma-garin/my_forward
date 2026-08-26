import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadAccounts, saveAccounts, totalBalance,
  recordNetWorth, loadNetWorthHistory, netWorthChange,
} from './accounts'

beforeEach(() => localStorage.clear())

describe('口座残高', () => {
  it('往復する', () => {
    saveAccounts([{ id: 'a', name: 'ゆうちょ', balance: 250000 }])
    expect(loadAccounts()).toEqual([{ id: 'a', name: 'ゆうちょ', balance: 250000 }])
  })

  it('何も無ければ空配列', () => {
    expect(loadAccounts()).toEqual([])
  })

  it('壊れた保存値でも落ちない', () => {
    localStorage.setItem('cc_accounts', '{こわれている')
    expect(loadAccounts()).toEqual([])
    localStorage.setItem('cc_accounts', '"文字列"')
    expect(loadAccounts()).toEqual([])
  })

  it('合計を出す（数値でない残高は 0 扱い）', () => {
    expect(totalBalance([
      { id: 'a', name: 'A', balance: 100000 },
      { id: 'b', name: 'B', balance: 25000 },
      { id: 'c', name: 'C', balance: 'x' },
    ])).toBe(125000)
  })
})

describe('純資産の推移', () => {
  beforeEach(() => localStorage.clear())

  it('月ごとに 1 点だけ残す（同じ月は上書き）', () => {
    recordNetWorth(1000000, '2026-08')
    recordNetWorth(1200000, '2026-08')
    expect(loadNetWorthHistory()).toEqual([{ ym: '2026-08', value: 1200000 }])
  })

  it('古い順に並ぶ', () => {
    recordNetWorth(3, '2026-09')
    recordNetWorth(1, '2026-07')
    recordNetWorth(2, '2026-08')
    expect(loadNetWorthHistory().map((s) => s.ym)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('直近の変化額を出す', () => {
    recordNetWorth(1000000, '2026-07')
    recordNetWorth(1150000, '2026-08')
    expect(netWorthChange()).toBe(150000)
  })

  it('比べる相手がなければ変化額は出さない', () => {
    recordNetWorth(1000000, '2026-08')
    expect(netWorthChange()).toBe(null)
  })

  it('端数は丸めて持つ', () => {
    recordNetWorth(1000.6, '2026-08')
    expect(loadNetWorthHistory()[0].value).toBe(1001)
  })
})
