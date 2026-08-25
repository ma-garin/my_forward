import { describe, it, expect, beforeEach } from 'vitest'
import { backupFileName, isDue, pickStale, hasNoData } from './autoBackup'

beforeEach(() => localStorage.clear())

describe('取るべきか', () => {
  const now = new Date(2026, 7, 24, 12)

  it('一度も取っていなければ取る', () => {
    expect(isDue(now, null)).toBe(true)
    expect(isDue(now, '')).toBe(true)
  })

  it('壊れた記録は取り直す', () => {
    expect(isDue(now, 'こわれている')).toBe(true)
  })

  it('7 日経っていれば取る', () => {
    expect(isDue(now, new Date(2026, 7, 17, 12).toISOString())).toBe(true)
  })

  it('7 日経っていなければ取らない', () => {
    expect(isDue(now, new Date(2026, 7, 18, 12).toISOString())).toBe(false)
    expect(isDue(now, new Date(2026, 7, 24, 11).toISOString())).toBe(false)
  })
})

describe('ファイル名', () => {
  it('日付で並べ替えられる形にする', () => {
    expect(backupFileName(new Date(2026, 7, 4))).toBe('myforward_auto_2026-08-04.json')
    expect(backupFileName(new Date(2026, 11, 31))).toBe('myforward_auto_2026-12-31.json')
  })
})

describe('古い世代の整理', () => {
  const names = [
    'myforward_auto_2026-08-24.json',
    'myforward_auto_2026-08-17.json',
    'myforward_auto_2026-08-10.json',
    'myforward_auto_2026-08-03.json',
    'myforward_auto_2026-07-27.json',
    'myforward_auto_2026-07-20.json',
    'myforward_auto_2026-07-13.json',
  ]

  it('新しい 5 件を残して古いものを返す', () => {
    expect(pickStale(names)).toEqual([
      'myforward_auto_2026-07-20.json',
      'myforward_auto_2026-07-13.json',
    ])
  })

  it('5 件以下なら消さない', () => {
    expect(pickStale(names.slice(0, 5))).toEqual([])
  })

  it('関係ないファイルには触れない', () => {
    expect(pickStale([...names, 'メモ.txt', 'myforward_backup_2026-01-01.json']))
      .not.toContain('メモ.txt')
  })
})

describe('データが空かどうか', () => {
  it('何も無ければ空', () => {
    expect(hasNoData()).toBe(true)
  })

  it('家計のキーがあれば空ではない', () => {
    localStorage.setItem('cc_limit_jcb', '200000')
    expect(hasNoData()).toBe(false)
  })

  it('無関係なキーだけなら空とみなす', () => {
    localStorage.setItem('some_other_app', '1')
    expect(hasNoData()).toBe(true)
  })
})
