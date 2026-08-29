import { describe, it, expect } from 'vitest'
import { normalizeLine, resolveDate, readLine, parseSuicaHistory } from './parseSuicaHistory'

const TODAY = new Date(2026, 7, 29) // 2026-08-29

describe('文字をそろえる', () => {
  it('全角・記号のゆれを吸収する', () => {
    expect(normalizeLine('０８／２０　物販　￥３，４６０')).toBe('08/20 物販 3,460')
  })

  it('OCR が ¥ を Y や \\ に読んでも落とす', () => {
    expect(normalizeLine('08/20 物販 \\3,460')).toBe('08/20 物販 3,460')
  })
})

describe('年を決める', () => {
  const d = (s) => resolveDate(/(?:(\d{4})[/.年-])?(\d{1,2})[/.月-](\d{1,2})/.exec(s), TODAY)

  it('月日だけなら今年', () => {
    expect(d('08/20')).toBe('2026-08-20')
  })

  it('今日より先なら前の年（1月に12月の履歴を読む）', () => {
    expect(d('12/28')).toBe('2025-12-28')
  })

  it('年があればそれを使う', () => {
    expect(d('2024/03/05')).toBe('2024-03-05')
  })

  it('数日先までは今年のまま（端末の日付が進んでいても飛ばさない）', () => {
    expect(d('08/31')).toBe('2026-08-31')
  })

  it('あり得ない月日は null', () => {
    expect(d('13/40')).toBe(null)
  })
})

describe('行を読む', () => {
  it('残額は右端の数字', () => {
    expect(readLine('08/20 出 渋谷 3,460')).toMatchObject({ balance: 3460, label: '出 渋谷' })
  })

  it('「残額」の文字は場所に混ぜない', () => {
    expect(readLine('08/20 物販 残額 1,234').label).toBe('物販')
  })

  it('3桁未満の数字は残額にしない', () => {
    expect(readLine('08/20 入 JY17 4,168')).toMatchObject({ balance: 4168 })
  })

  it('数字が無ければ残額なし', () => {
    expect(readLine('2026年8月').balance).toBe(null)
  })

  it('空行は null', () => {
    expect(readLine('   ')).toBe(null)
  })
})

describe('利用履歴の取り込み', () => {
  // モバイルSuica の画面（新しい順）。使った額は出ず、残額だけが並ぶ
  const SCREEN = [
    '08/20 物販 3,460',
    '08/20 出 渋谷 4,000',
    '08/20 入 新宿 4,168',
    '08/19 オート 4,168',
    '08/18 出 東京 1,168',
  ]

  it('残額の差から使った額を出す', () => {
    const r = parseSuicaHistory(SCREEN, { today: TODAY })
    expect(r.rows).toEqual([
      { date: '2026-08-20', amount: 540, payee: '物販', balance: 3460 },
      { date: '2026-08-20', amount: 168, payee: '出 渋谷', balance: 4000 },
    ])
  })

  it('入場（残額が動かない行）は取り込まない', () => {
    expect(parseSuicaHistory(SCREEN, { today: TODAY }).noChange).toBe(1)
  })

  it('チャージは取り込まない（チャージ元で既に記録されるため）', () => {
    const r = parseSuicaHistory(SCREEN, { today: TODAY })
    expect(r.charges).toBe(1)
    expect(r.rows.some((x) => x.payee.includes('オート'))).toBe(false)
  })

  it('いちばん古い行は額を出せないと数える', () => {
    expect(parseSuicaHistory(SCREEN, { today: TODAY }).lastRow).toBe(1)
  })

  it('月日が別の行に出る作りでも読む', () => {
    const r = parseSuicaHistory([
      '2026/08/20',
      '物販 3,460',
      '出 渋谷 4,000',
      '2026/08/19',
      'オート 4,168',
    ], { today: TODAY })
    expect(r.rows).toEqual([
      { date: '2026-08-20', amount: 540, payee: '物販', balance: 3460 },
      { date: '2026-08-20', amount: 168, payee: '出 渋谷', balance: 4000 },
    ])
  })

  it('OCR が返すオブジェクトの形でも読む', () => {
    const r = parseSuicaHistory(
      SCREEN.map((text) => ({ text, y: 0 })), { today: TODAY })
    expect(r.rows).toHaveLength(2)
  })

  it('日付より前の行は捨てる（画面上部の見出し）', () => {
    const r = parseSuicaHistory(['利用履歴', '残額 3,460', ...SCREEN], { today: TODAY })
    expect(r.rows).toHaveLength(2)
  })

  it('読めない画像でも落ちない', () => {
    expect(parseSuicaHistory([]).rows).toEqual([])
    expect(parseSuicaHistory(['あ', 'い']).rows).toEqual([])
  })

  it('1 行しか読めなければ額は出せない', () => {
    const r = parseSuicaHistory(['08/20 物販 3,460'], { today: TODAY })
    expect(r.rows).toEqual([])
    expect(r.lastRow).toBe(1)
  })
})
