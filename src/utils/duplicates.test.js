import { describe, it, expect } from 'vitest'
import { findDuplicate, duplicateMessage } from './duplicates'

const base = { id: 'a1', date: '2026-08-24', amount: 1280, name: 'ランチ', payee: 'なか卯', category: '食費' }

describe('重複らしさ', () => {
  it('同日・同額なら重複', () => {
    const hit = findDuplicate({ date: '2026-08-24', amount: 1280 }, [base])
    expect(hit).toBe(base)
  })

  it('カテゴリが違っても重複とみなす（取り込み経路でカテゴリは変わる）', () => {
    const hit = findDuplicate({ date: '2026-08-24', amount: 1280, category: 'その他' }, [base])
    expect(hit).toBe(base)
  })

  it('日付が違えば重複ではない', () => {
    expect(findDuplicate({ date: '2026-08-23', amount: 1280 }, [base])).toBeNull()
  })

  it('金額が違えば重複ではない', () => {
    expect(findDuplicate({ date: '2026-08-24', amount: 1281 }, [base])).toBeNull()
  })

  it('支出と返金は同額でも別物', () => {
    expect(findDuplicate({ date: '2026-08-24', amount: 1280, sign: 1 }, [base])).toBeNull()
    const refund = { ...base, id: 'r1', sign: 1 }
    expect(findDuplicate({ date: '2026-08-24', amount: 1280, sign: 1 }, [refund])).toBe(refund)
  })

  it('編集中の自分自身は除く', () => {
    expect(findDuplicate({ date: '2026-08-24', amount: 1280 }, [base], 'a1')).toBeNull()
  })

  it('空のリストなら null', () => {
    expect(findDuplicate({ date: '2026-08-24', amount: 1280 }, [])).toBeNull()
  })
})

describe('警告文', () => {
  it('支払先を優先して出す', () => {
    expect(duplicateMessage(base)).toContain('なか卯')
    expect(duplicateMessage(base)).toContain('1,280')
  })

  it('支払先が無ければ項目名', () => {
    expect(duplicateMessage({ ...base, payee: '' })).toContain('ランチ')
  })
})
