import { describe, it, expect, beforeEach } from 'vitest'
import { loadAccounts, saveAccounts, totalBalance } from './accounts'

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
