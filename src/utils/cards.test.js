import { describe, it, expect, beforeEach, vi } from 'vitest'

// CARDS / CARD_LIST は読み込み時に localStorage から作るので、
// テストごとに読み込み直す
async function freshImport() {
  vi.resetModules()
  return import('./ccStorage')
}

beforeEach(() => localStorage.clear())

describe('支払い元の出どころ', () => {
  it('保存が無ければ既定を入れて cc_cards に書く', async () => {
    const { CARD_LIST } = await freshImport()
    expect(CARD_LIST.map((c) => c.id)).toEqual(['jcb', 'smbc', 'cash', 'paypay', 'suica'])
    expect(JSON.parse(localStorage.getItem('cc_cards')).map((c) => c.id))
      .toEqual(['jcb', 'smbc', 'cash', 'paypay', 'suica'])
  })

  it('モバイルSuica は残高払い（締め日を持たない）', async () => {
    const { CARDS } = await freshImport()
    expect(CARDS.suica).toMatchObject({ shortName: 'Suica', noBilling: true })
  })

  it('保存したものが CARDS に出る', async () => {
    const { saveCards, CARDS, CARD_LIST } = await freshImport()
    saveCards([{ id: 'rakuten', name: '楽天カード', shortName: '楽天', cutoffDay: 0, paymentDay: 27, color: '#b71c1c' }])
    expect(CARD_LIST.map((c) => c.id)).toEqual(['rakuten'])
    expect(CARDS.rakuten.shortName).toBe('楽天')
    expect(CARDS.jcb).toBeUndefined()
  })

  it('CARD_LIST の参照は作り替えない（import 済みの画面に届く）', async () => {
    const { saveCards, CARD_LIST } = await freshImport()
    const before = CARD_LIST
    saveCards([{ id: 'a', name: 'A', shortName: 'A', cutoffDay: 0, paymentDay: 0, color: '#000' }])
    expect(CARD_LIST).toBe(before)
    expect(CARD_LIST).toHaveLength(1)
  })

  it('設定画面が壊れていた頃の保存（既定が入っていない）は補って読む', async () => {
    // cc_cards はあるが seeded フラグが無い＝壊れた画面が書いたもの
    localStorage.setItem('cc_cards', JSON.stringify([
      { id: 'mysuica', name: 'モバイルSuica', shortName: 'Suica2', cutoffDay: 15, paymentDay: 10, color: '#37474f' },
    ]))
    const { CARD_LIST } = await freshImport()
    const ids = CARD_LIST.map((c) => c.id)
    expect(ids).toContain('jcb')
    expect(ids).toContain('smbc')
    expect(ids).toContain('mysuica')
  })

  it('一度入れたあとは、消したカードを復活させない', async () => {
    const first = await freshImport()
    first.saveCards(first.CARD_LIST.filter((c) => c.id !== 'paypay'))
    const again = await freshImport()
    expect(again.CARD_LIST.map((c) => c.id)).not.toContain('paypay')
  })

  it('壊れた保存でも落ちない', async () => {
    localStorage.setItem('cc_cards', '{ではない')
    const { CARD_LIST } = await freshImport()
    expect(CARD_LIST.map((c) => c.id)).toContain('jcb')
  })
})

describe('記録があるか', () => {
  it('固定費があれば true', async () => {
    const { cardHasRecords } = await freshImport()
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([{ id: 'f1', name: 'A', amount: 100 }]))
    expect(cardHasRecords('jcb')).toBe(true)
  })

  it('変動費があれば true', async () => {
    const { cardHasRecords } = await freshImport()
    localStorage.setItem('cc_var_jcb_2026-07', JSON.stringify([{ id: 'v1', name: 'A', amount: 100 }]))
    expect(cardHasRecords('jcb')).toBe(true)
  })

  it('空のリストしか無ければ false', async () => {
    const { cardHasRecords } = await freshImport()
    localStorage.setItem('cc_fixed_jcb', '[]')
    localStorage.setItem('cc_var_jcb_2026-07', '[]')
    expect(cardHasRecords('jcb')).toBe(false)
  })

  it('別のカードの記録に反応しない', async () => {
    const { cardHasRecords } = await freshImport()
    localStorage.setItem('cc_var_smbc_2026-07', JSON.stringify([{ id: 'v1', name: 'A', amount: 100 }]))
    expect(cardHasRecords('jcb')).toBe(false)
  })
})
