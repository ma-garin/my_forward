import { describe, it, expect } from 'vitest'
import {
  splitCsv, detectColumns, parseDate, parseAmount, parseStatementCsv, toDrafts,
} from './parseStatementCsv'

describe('CSV を配列にする', () => {
  it('引用符の中のカンマで列がずれない', () => {
    const rows = splitCsv('日付,利用先,金額\n2026/08/20,"すし処 田中, 渋谷店",1200')
    expect(rows[1]).toEqual(['2026/08/20', 'すし処 田中, 渋谷店', '1200'])
  })

  it('引用符の中の改行を落とさない', () => {
    const rows = splitCsv('a,b\n"1\n2",3')
    expect(rows).toHaveLength(2)
    expect(rows[1][0]).toBe('1\n2')
  })

  it('二重引用符を戻す', () => {
    expect(splitCsv('a\n"He said ""hi"""')[1][0]).toBe('He said "hi"')
  })

  it('CRLF と末尾の空行を落とす', () => {
    expect(splitCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('BOM を見出しに含めない', () => {
    expect(splitCsv('﻿日付,金額\n2026/08/20,100')[0][0]).toBe('日付')
  })
})

describe('列を当てる', () => {
  it('日本語の見出し（カード会社の明細）', () => {
    expect(detectColumns(['ご利用日', 'ご利用先', 'ご利用金額', '支払方法']))
      .toEqual({ date: 0, payee: 1, amount: 2, kind: 3 })
  })

  it('英語の見出し（PayPay の取引履歴）', () => {
    const c = detectColumns(['transactionDate', 'transactionType', 'paymentMethod', 'amount', 'storeName'])
    expect(c.date).toBe(0)
    expect(c.amount).toBe(3)
    expect(c.payee).toBe(4)
  })

  it('全角・空白・大文字小文字をそろえて見る', () => {
    expect(detectColumns(['　日　付　', 'Ａｍｏｕｎｔ']))
      .toMatchObject({ date: 0, amount: 1 })
  })

  it('同じ列を 2 つの役目に使わない', () => {
    const c = detectColumns(['取引日', '取引内容', '取引金額'])
    expect(new Set([c.date, c.kind, c.amount]).size).toBe(3)
  })

  it('当てられない列は null', () => {
    expect(detectColumns(['foo', 'bar'])).toEqual({ date: null, amount: null, payee: null, kind: null })
  })
})

describe('日付', () => {
  it.each([
    ['2026/8/20', '2026-08-20'],
    ['2026-08-20', '2026-08-20'],
    ['2026年8月20日', '2026-08-20'],
    ['2026/08/20 12:34', '2026-08-20'],
    ['20260820', '2026-08-20'],
    ['２０２６／０８／２０', '2026-08-20'],
  ])('%s → %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected)
  })

  it.each(['', 'あ', '2026/13/40'])('読めないものは null（%s）', (v) => {
    expect(parseDate(v)).toBe(null)
  })
})

describe('金額', () => {
  it.each([
    ['¥1,200', 1200],
    ['1,200円', 1200],
    ['1200', 1200],
    ['-1200', -1200],
    ['△1,200', -1200],
    ['▲1,200', -1200],
    ['(1,200)', -1200],
  ])('%s → %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(['', '0', 'あ'])('読めない・0 は null（%s）', (v) => {
    expect(parseAmount(v)).toBe(null)
  })
})

describe('取り込み', () => {
  // 支払いをマイナスで書く CSV（PayPay 型）
  const MINUS = [
    'transactionDate,transactionType,storeName,amount',
    '2026/08/20,支払い,セブン-イレブン,-540',
    '2026/08/21,チャージ,,10000',
    '2026/08/22,支払い,"カフェ, 渋谷",-1200',
  ].join('\n')

  // 支払いをプラスで書く CSV（カード会社型）
  const PLUS = [
    'ご利用日,ご利用先,ご利用金額',
    '2026/08/20,ユニクロ,2990',
    '2026/08/21,ローソン,540',
  ].join('\n')

  it('マイナスを支出として読む', () => {
    const r = parseStatementCsv(MINUS)
    expect(r.expenseIsNegative).toBe(true)
    expect(r.rows).toEqual([
      { date: '2026-08-20', amount: 540, payee: 'セブン-イレブン', kind: '支払い' },
      { date: '2026-08-22', amount: 1200, payee: 'カフェ, 渋谷', kind: '支払い' },
    ])
  })

  it('チャージ（入金）は取り込まない', () => {
    expect(parseStatementCsv(MINUS).skipped.notExpense).toBe(1)
  })

  it('マイナスが無ければプラスを支出として読む', () => {
    const r = parseStatementCsv(PLUS)
    expect(r.expenseIsNegative).toBe(false)
    expect(r.rows.map((x) => x.amount)).toEqual([2990, 540])
  })

  it('符号の向きは指定で上書きできる', () => {
    const r = parseStatementCsv(PLUS, { expenseIsNegative: true })
    expect(r.rows).toHaveLength(0)
    expect(r.skipped.notExpense).toBe(2)
  })

  it('列は指定で上書きできる（自動判定が外れたとき）', () => {
    const csv = 'A,B,C\n2026/08/20,ドトール,330'
    expect(parseStatementCsv(csv, { columns: { date: 0, payee: 1, amount: 2 } }).rows)
      .toEqual([{ date: '2026-08-20', amount: 330, payee: 'ドトール', kind: '' }])
  })

  it('読めない行は数えて落とす', () => {
    const csv = 'ご利用日,ご利用先,ご利用金額\n,あ,100\n2026/08/20,い,\n2026/08/21,う,200'
    const r = parseStatementCsv(csv)
    expect(r.rows).toHaveLength(1)
    expect(r.skipped).toMatchObject({ noDate: 1, noAmount: 1 })
  })

  it('見出しだけ・空でも落ちない', () => {
    expect(parseStatementCsv('ご利用日,ご利用金額').rows).toEqual([])
    expect(parseStatementCsv('').rows).toEqual([])
  })
})

describe('受信箱の形にそろえる', () => {
  it('その日の正午を入れる（同じ日の同額を重複と見なせるように）', () => {
    const [d] = toDrafts([{ date: '2026-08-20', amount: 540, payee: 'A', kind: '' }], 'paypay')
    expect(d).toMatchObject({ source: 'csv', cardId: 'paypay', amount: 540, date: '2026-08-20', payee: 'A' })
    expect(new Date(d.at).getHours()).toBe(12)
  })
})
