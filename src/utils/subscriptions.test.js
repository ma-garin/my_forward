import { describe, it, expect, beforeEach } from 'vitest'
import { detectSubscriptions, dismissSubscription, subscriptionKey } from './subscriptions'

beforeEach(() => localStorage.clear())

const put = (ym, list) => localStorage.setItem(`cc_var_jcb_${ym}`, JSON.stringify(list))

const netflix = (ym, over = {}) => ({
  id: `n-${ym}`, name: '動画', payee: 'Netflix', amount: 1490,
  category: '遊興費', spendType: '消費', date: `${ym}-02`, ...over,
})

describe('サブスク検出', () => {
  it('3 ヶ月続いた同じ支払先・同額を候補にする', () => {
    put('2026-08', [netflix('2026-08')])
    put('2026-07', [netflix('2026-07')])
    put('2026-06', [netflix('2026-06')])

    const [c] = detectSubscriptions('jcb', '2026-08')
    expect(c).toMatchObject({ payee: 'Netflix', amount: 1490, category: '遊興費', day: 2 })
  })

  it('2 ヶ月では候補にしない（偶然の一致を拾いすぎる）', () => {
    put('2026-08', [netflix('2026-08')])
    put('2026-07', [netflix('2026-07')])

    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('金額が変わった月があれば別物として数える', () => {
    put('2026-08', [netflix('2026-08')])
    put('2026-07', [netflix('2026-07', { amount: 1980 })])
    put('2026-06', [netflix('2026-06')])

    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('同月に複数回あっても 1 ヶ月と数える（毎週のスーパーはサブスクではない）', () => {
    put('2026-08', [netflix('2026-08'), netflix('2026-08', { id: 'x' })])
    put('2026-07', [netflix('2026-07')])

    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('すでに固定費にあるものは提案しない', () => {
    put('2026-08', [netflix('2026-08')])
    put('2026-07', [netflix('2026-07')])
    put('2026-06', [netflix('2026-06')])
    localStorage.setItem('cc_fixed_jcb', JSON.stringify([
      { id: 'f1', name: 'Netflix', amount: 1490, category: '遊興費' },
    ]))

    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('断ったものは二度と出さない', () => {
    put('2026-08', [netflix('2026-08')])
    put('2026-07', [netflix('2026-07')])
    put('2026-06', [netflix('2026-06')])

    dismissSubscription(subscriptionKey(netflix('2026-08')))
    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('返金は数えない', () => {
    put('2026-08', [netflix('2026-08', { sign: 1 })])
    put('2026-07', [netflix('2026-07')])
    put('2026-06', [netflix('2026-06')])

    expect(detectSubscriptions('jcb', '2026-08')).toEqual([])
  })

  it('金額の大きい順に並ぶ', () => {
    const gym = (ym) => ({ id: `g-${ym}`, name: 'ジム', payee: 'GYM', amount: 7800, category: 'その他', date: `${ym}-05` })
    put('2026-08', [netflix('2026-08'), gym('2026-08')])
    put('2026-07', [netflix('2026-07'), gym('2026-07')])
    put('2026-06', [netflix('2026-06'), gym('2026-06')])

    const list = detectSubscriptions('jcb', '2026-08')
    expect(list.map((c) => c.payee)).toEqual(['GYM', 'Netflix'])
  })
})
