import { describe, it, expect, beforeEach } from 'vitest'
import { HIDEABLE_CARDS, loadHiddenCards, isCardVisible, setCardVisible } from './cardVisibility'

beforeEach(() => localStorage.clear())

describe('カードの表示/非表示', () => {
  it('既定はすべて表示', () => {
    for (const g of HIDEABLE_CARDS) {
      for (const item of g.items) expect(isCardVisible(item.id)).toBe(true)
    }
  })

  it('隠す・戻すが保存される', () => {
    setCardVisible('kk.diagnosis', false)
    expect(isCardVisible('kk.diagnosis')).toBe(false)
    expect(isCardVisible('kk.income')).toBe(true)
    setCardVisible('kk.diagnosis', true)
    expect(isCardVisible('kk.diagnosis')).toBe(true)
    expect(loadHiddenCards()).toEqual([])
  })

  it('二重に隠しても 1 件', () => {
    setCardVisible('cc.yearly', false)
    setCardVisible('cc.yearly', false)
    expect(loadHiddenCards()).toEqual(['cc.yearly'])
  })

  it('壊れた保存でも落ちない（全部表示に戻る）', () => {
    localStorage.setItem('cc_hidden_cards', '{壊れ')
    expect(isCardVisible('kk.income')).toBe(true)
    localStorage.setItem('cc_hidden_cards', JSON.stringify([1, null, 'kk.living']))
    expect(isCardVisible('kk.living')).toBe(false)
  })

  it('id が重複していない', () => {
    const ids = HIDEABLE_CARDS.flatMap((g) => g.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
