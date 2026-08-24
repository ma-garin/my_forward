import { describe, it, expect, beforeEach } from 'vitest'
import { isBackupKey, createExportData, restoreExportData, getAllKeys } from './backup'

beforeEach(() => localStorage.clear())

describe('isBackupKey', () => {
  it('テーマを含む（含まれておらず復元できなかった）', () => {
    expect(isBackupKey('app_theme')).toBe(true)
  })

  it('家計・給与のキーを含む', () => {
    ;['cc_var_jcb_2026-08', 'cc_var_sort', 'salary_simulation', 'life_weekly_budget']
      .forEach((k) => expect(isBackupKey(k)).toBe(true))
  })

  it('無関係なキーは含まない', () => {
    expect(isBackupKey('some_other_app')).toBe(false)
  })
})

describe('往復（書き出して読み戻す）', () => {
  it('素の文字列が保たれる（JSON として解釈できず落ちていた値）', () => {
    localStorage.setItem('app_theme', 'apple')
    localStorage.setItem('cc_var_sort', 'date_desc')

    const data = createExportData(getAllKeys())
    expect(data).toEqual({ app_theme: 'apple', cc_var_sort: 'date_desc' })

    localStorage.clear()
    restoreExportData(data)
    expect(localStorage.getItem('app_theme')).toBe('apple')
    expect(localStorage.getItem('cc_var_sort')).toBe('date_desc')
  })

  it('JSON の値も壊れない', () => {
    const list = [{ id: 'a1', amount: 2039, name: '寿司' }]
    localStorage.setItem('cc_var_jcb_2026-08', JSON.stringify(list))
    localStorage.setItem('cc_limit_jcb', '200000')

    const data = createExportData(getAllKeys())
    localStorage.clear()
    restoreExportData(data)

    expect(JSON.parse(localStorage.getItem('cc_var_jcb_2026-08'))).toEqual(list)
    expect(localStorage.getItem('cc_limit_jcb')).toBe('200000')
  })

  it('書き出した件数と復元した件数が一致する', () => {
    localStorage.setItem('app_theme', 'classic')
    localStorage.setItem('cc_limit_jcb', '200000')
    const data = createExportData(getAllKeys())
    localStorage.clear()
    expect(restoreExportData(data)).toBe(2)
  })
})

describe('旧形式のファイル', () => {
  it('値が JSON.parse 済みでも読み戻せる', () => {
    // 以前の書き出しはこの形（オブジェクト・数値がそのまま入っていた）
    const old = {
      'cc_cards': [{ id: 'jcb', cutoffDay: 15 }],
      'cc_limit_jcb': 200000,
      'life_weekly_budget': 10000,
    }
    restoreExportData(old)

    expect(JSON.parse(localStorage.getItem('cc_cards'))).toEqual([{ id: 'jcb', cutoffDay: 15 }])
    expect(localStorage.getItem('cc_limit_jcb')).toBe('200000')
    expect(localStorage.getItem('life_weekly_budget')).toBe('10000')
  })

  it('null も文字列として戻る', () => {
    restoreExportData({ some_key: null })
    expect(localStorage.getItem('some_key')).toBe('null')
  })
})

describe('壊れた入力', () => {
  it('オブジェクトでなければ弾く', () => {
    expect(() => restoreExportData([1, 2])).toThrow('バックアップの形式ではありません')
    expect(() => restoreExportData(null)).toThrow()
    expect(() => restoreExportData('文字列')).toThrow()
  })
})
