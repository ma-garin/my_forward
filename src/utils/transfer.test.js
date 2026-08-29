import { describe, it, expect } from 'vitest'
import { looksLikeTransfer } from './transfer'

describe('振替らしさ', () => {
  it.each([
    ['モバイルSuica'],
    ['モバイルＳｕｉｃａ'.normalize('NFKC')],
    ['Suica チャージ'],
    ['オートチャージ'],
    ['PASMO'],
    ['楽天Edy チャージ'],
  ])('%s は振替', (text) => {
    expect(looksLikeTransfer(text)).toBe(true)
  })

  it.each([
    ['セブン-イレブン'],
    ['ユニクロ'],
    ['Amazon.co.jp'],
    [''],
  ])('%s は振替ではない', (text) => {
    expect(looksLikeTransfer(text)).toBe(false)
  })

  it('支払先と品名の両方を見る', () => {
    expect(looksLikeTransfer('', 'Suica チャージ')).toBe(true)
    expect(looksLikeTransfer('ローソン', '弁当')).toBe(false)
  })
})
