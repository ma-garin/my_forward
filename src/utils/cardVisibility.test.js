import { describe, it, expect, beforeEach } from 'vitest'
import { HIDEABLE_CARDS, loadHiddenCards, isCardVisible, setCardVisible, visibleCardList, paymentCardKey } from './cardVisibility'
import { CARD_LIST } from './ccStorage'

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

describe('支払い元の表示/非表示', () => {
  it('既定はすべて出る', () => {
    expect(visibleCardList().map((c) => c.id)).toEqual(CARD_LIST.map((c) => c.id))
  })

  it('隠した支払い元は並びから外れる', () => {
    setCardVisible(paymentCardKey('paypay'), false)
    const ids = visibleCardList().map((c) => c.id)
    expect(ids).not.toContain('paypay')
    expect(ids).toContain('jcb')
  })

  it('隠しても CARD_LIST（合計に使う一覧）は減らない', () => {
    const before = CARD_LIST.length
    setCardVisible(paymentCardKey('paypay'), false)
    expect(CARD_LIST).toHaveLength(before)
  })

  it('全部隠したら元の一覧に戻す（開けるものが無くならないように）', () => {
    for (const c of CARD_LIST) setCardVisible(paymentCardKey(c.id), false)
    expect(visibleCardList()).toHaveLength(CARD_LIST.length)
  })

  it('画面のカードと保存先を共有しても混ざらない', () => {
    setCardVisible('kk.diagnosis', false)
    expect(visibleCardList().map((c) => c.id)).toEqual(CARD_LIST.map((c) => c.id))
    expect(isCardVisible('kk.diagnosis')).toBe(false)
  })
})

describe('登録と配線', () => {
  it('4つのタブすべてを網羅している', () => {
    expect(HIDEABLE_CARDS.map((g) => g.tab)).toEqual(['クレカ', '家計', '支出一覧', '給与'])
  })

  it('どのタブも 1 件以上ある', () => {
    for (const g of HIDEABLE_CARDS) expect(g.items.length).toBeGreaterThan(0)
  })

  it('id はタブの接頭辞と揃っている', () => {
    const prefix = { クレカ: 'cc.', 家計: 'kk.', 支出一覧: 'cf.', 給与: 'sal.' }
    for (const g of HIDEABLE_CARDS) {
      for (const item of g.items) expect(item.id.startsWith(prefix[g.tab])).toBe(true)
    }
  })
})
