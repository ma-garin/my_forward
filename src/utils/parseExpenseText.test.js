import { describe, it, expect } from 'vitest'
import { parseExpenseText } from './parseExpenseText'

describe('金額の取り出し', () => {
  it('¥ が前に付く形', () => {
    expect(parseExpenseText('セブンイレブン ¥1,234').amount).toBe(1234)
  })

  it('全角の￥も拾う', () => {
    expect(parseExpenseText('￥980 スーパー').amount).toBe(980)
  })

  it('円が後ろに付く形', () => {
    expect(parseExpenseText('コメダ珈琲 1,480円').amount).toBe(1480)
  })

  it('区切りなしの数字', () => {
    expect(parseExpenseText('ご利用金額 ¥520').amount).toBe(520)
  })

  it('金額が無ければ 0', () => {
    expect(parseExpenseText('スーパーで買い物').amount).toBe(0)
  })

  it('0 円は入力として意味が無いので 0 のまま', () => {
    expect(parseExpenseText('¥0').amount).toBe(0)
  })
})

describe('見出しの取り出し', () => {
  it('最初の意味のある行を使う', () => {
    expect(parseExpenseText('スターバックス\n¥620').name).toBe('スターバックス')
  })

  it('金額だけの行は飛ばす', () => {
    expect(parseExpenseText('¥620\nスターバックス').name).toBe('スターバックス')
  })

  it('長い行は切り詰める', () => {
    const long = 'あ'.repeat(50)
    const { name } = parseExpenseText(long)
    expect(name).toHaveLength(31) // 30 文字 + …
    expect(name.endsWith('…')).toBe(true)
  })

  it('金額しか無ければ空', () => {
    expect(parseExpenseText('¥1,000').name).toBe('')
  })
})

describe('壊れた入力', () => {
  it('空・非文字列は空の下書きを返す', () => {
    expect(parseExpenseText('')).toEqual({ amount: 0, name: '' })
    expect(parseExpenseText('   ')).toEqual({ amount: 0, name: '' })
    expect(parseExpenseText(null)).toEqual({ amount: 0, name: '' })
    expect(parseExpenseText(undefined)).toEqual({ amount: 0, name: '' })
  })
})
