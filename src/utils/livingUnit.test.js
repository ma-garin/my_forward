import { describe, it, expect, beforeEach } from 'vitest'
import { loadLivingUnit, saveLivingUnit, DEFAULT_LIVING_UNIT } from './ccStorage'

beforeEach(() => localStorage.clear())

/**
 * 週予算は以前 cc_living_unit と life_weekly_budget の 2 キーに分かれていて、
 * 生活費カードと 2 枚合計で別々に編集でき、互いに反映されなかった。
 * 持ち主が 1 つであることを見る。
 */
describe('週予算', () => {
  it('どこから保存しても、どこから読んでも同じ値になる', () => {
    saveLivingUnit(12000)
    expect(loadLivingUnit()).toBe(12000)
  })

  it('未設定なら既定値', () => {
    expect(loadLivingUnit()).toBe(DEFAULT_LIVING_UNIT)
  })

  it('旧キーしか無い端末の値を引き継ぐ', () => {
    localStorage.setItem('life_weekly_budget', '8000')
    expect(loadLivingUnit()).toBe(8000)
    // 引き継いだら新しいキーに写っている
    expect(localStorage.getItem('cc_living_unit')).toBe('8000')
  })

  it('新しいキーがあれば旧キーは見ない', () => {
    localStorage.setItem('life_weekly_budget', '8000')
    localStorage.setItem('cc_living_unit', '15000')
    expect(loadLivingUnit()).toBe(15000)
  })

  it('保存すると旧キーは消える（次回起動で古い値に戻らない）', () => {
    localStorage.setItem('life_weekly_budget', '8000')
    saveLivingUnit(20000)
    expect(localStorage.getItem('life_weekly_budget')).toBe(null)
    expect(loadLivingUnit()).toBe(20000)
  })
})
