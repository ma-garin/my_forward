import { describe, it, expect, beforeEach } from 'vitest'
import { livingBudgetFor, monthlyBalance, yearlyBalance } from './monthly'

beforeEach(() => localStorage.clear())

const putSalary = (map) => {
  localStorage.setItem('cc_salary_override_by_ym', JSON.stringify(map))
  localStorage.setItem('cc_salary_override_migrated_v1', '1')
}
const putOther = (map) => localStorage.setItem('cc_other_income_by_ym', JSON.stringify(map))
const putVar = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))
const buy = (id, amount, date) =>
  ({ id, name: '買い物', amount, category: 'その他', spendType: '消費', date })
// 生活費として数えられるカテゴリ（LIVING_CATEGORIES）
const food = (id, amount, date) =>
  ({ id, name: 'スーパー', amount, category: '食費', spendType: '消費', date })

// 家計タブの固定費内訳は既定値（家賃 82,330 + 奨学金 13,262 + 都民共済 3,000）
const SUMMARY_FIXED = 82330 + 13262 + 3000

describe('生活費予算', () => {
  it('週予算 × その請求月の週数', () => {
    localStorage.setItem('cc_living_unit', '10000')
    // 2026-07 サイクル = 7/16〜8/15。金曜は 7/17,24,31 と 8/7,14 の 5 回
    expect(livingBudgetFor('2026-07')).toBe(50000)
    // 2026-08 サイクル = 8/16〜9/15。金曜は 8/21,28 と 9/4,11 の 4 回
    expect(livingBudgetFor('2026-08')).toBe(40000)
  })

  it('月によって週数が変わる（今日を見ない）', () => {
    localStorage.setItem('cc_living_unit', '10000')
    const all = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
      .map((m) => livingBudgetFor(`2026-${m}`))
    expect(new Set(all).size).toBeGreaterThan(1)
  })

  it('12月は年をまたいで数える', () => {
    localStorage.setItem('cc_living_unit', '10000')
    // 2026-12 サイクル = 12/16〜2027/1/15。金曜は 12/18,25 と 1/1,8,15 の 5 回
    expect(livingBudgetFor('2026-12')).toBe(50000)
  })

  it('手動上書きがあればそれを使う', () => {
    localStorage.setItem('cc_living_unit', '10000')
    localStorage.setItem('cc_living_override_jcb_2026-07', '30000')
    expect(livingBudgetFor('2026-07')).toBe(30000)
  })

  it('週予算を 0 にすれば 0', () => {
    localStorage.setItem('cc_living_unit', '0')
    expect(livingBudgetFor('2026-07')).toBe(0)
  })

  it('未設定なら既定の週予算（10,000）を使う', () => {
    expect(livingBudgetFor('2026-07')).toBe(50000)
  })
})

describe('月次の収支', () => {
  it('収入 = 手取り + その他収入', () => {
    putSalary({ '2026-07': '271500' })
    putOther({ '2026-07': '50000' })
    const b = monthlyBalance('2026-07')
    expect(b.salary).toBe(271500)
    expect(b.other).toBe(50000)
    expect(b.income).toBe(321500)
  })

  it('支出 = カード + 固定費内訳 + 生活費', () => {
    localStorage.setItem('cc_living_unit', '10000')
    putVar('jcb', '2026-07', [buy('a', 20000, '2026-07-20')])
    putVar('smbc', '2026-07', [buy('b', 5000, '2026-07-21')])
    const b = monthlyBalance('2026-07')
    expect(b.cards).toBe(25000)
    expect(b.fixed).toBe(SUMMARY_FIXED)
    expect(b.living).toBe(50000)
    expect(b.expense).toBe(25000 + SUMMARY_FIXED + 50000)
  })

  it('返金はカード合計から差し引く', () => {
    putVar('jcb', '2026-07', [
      buy('a', 20000, '2026-07-20'),
      { ...buy('b', 3000, '2026-07-21'), sign: 1 },
    ])
    expect(monthlyBalance('2026-07').cards).toBe(17000)
  })

  it('差額と貯蓄率', () => {
    localStorage.setItem('cc_living_unit', '0')
    putSalary({ '2026-07': '300000' })
    const b = monthlyBalance('2026-07')
    expect(b.balance).toBe(300000 - SUMMARY_FIXED)
    expect(b.savingRate).toBe(Math.round((b.balance / 300000) * 100))
  })

  it('収入が無ければ貯蓄率は 0（マイナス無限にしない）', () => {
    expect(monthlyBalance('2026-07').savingRate).toBe(0)
  })

  it('実績か見込みかを持つ', () => {
    putSalary({ '2026-07': '271500' })
    expect(monthlyBalance('2026-07').isActual).toBe(true)
    expect(monthlyBalance('2026-08').isActual).toBe(false)
  })
})

// 生活費はカードの記録にも入っている。予算をそのまま足すと同じ買い物を
// 記録と予算で 2 回数えるので、足すのは「これから出ていく残り」だけにする。
describe('生活費は記録と予算で二重に数えない', () => {
  // 2026-08 サイクル = 8/16〜9/15。金曜 4 回 → 週予算 10,000 なら予算 40,000
  beforeEach(() => localStorage.setItem('cc_living_unit', '10000'))

  it('まだ使っていなければ予算をそのまま足す', () => {
    const b = monthlyBalance('2026-08')
    expect(b.livingBudget).toBe(40000)
    expect(b.livingSpent).toBe(0)
    expect(b.living).toBe(40000)
  })

  it('使った分は予算から引く（合計に 1 回だけ乗る）', () => {
    putVar('jcb', '2026-08', [food('a', 15000, '2026-08-20')])
    const b = monthlyBalance('2026-08')
    expect(b.cards).toBe(15000)
    expect(b.livingSpent).toBe(15000)
    expect(b.living).toBe(25000)
    expect(b.expense).toBe(15000 + SUMMARY_FIXED + 25000)
  })

  it('予算を超えても引きすぎない（記録だけになる）', () => {
    putVar('jcb', '2026-08', [food('a', 50000, '2026-08-20')])
    const b = monthlyBalance('2026-08')
    expect(b.living).toBe(0)
    expect(b.expense).toBe(50000 + SUMMARY_FIXED)
  })

  it('生活費以外のカテゴリは予算から引かない', () => {
    putVar('jcb', '2026-08', [buy('a', 15000, '2026-08-20')])
    const b = monthlyBalance('2026-08')
    expect(b.livingSpent).toBe(0)
    expect(b.living).toBe(40000)
  })

  it('カードをまたいで数える', () => {
    putVar('jcb', '2026-08', [food('a', 8000, '2026-08-20')])
    putVar('cash', '2026-08', [food('b', 2000, '2026-08-21')])
    expect(monthlyBalance('2026-08').livingSpent).toBe(10000)
  })

  it('返金は使った分から差し引く', () => {
    putVar('jcb', '2026-08', [
      food('a', 15000, '2026-08-20'),
      { ...food('b', 5000, '2026-08-21'), sign: 1 },
    ])
    const b = monthlyBalance('2026-08')
    expect(b.livingSpent).toBe(10000)
    expect(b.living).toBe(30000)
  })

  it('振替（チャージ）は使った分に数えない', () => {
    putVar('jcb', '2026-08', [{ ...food('a', 5000, '2026-08-20'), transfer: true }])
    expect(monthlyBalance('2026-08').livingSpent).toBe(0)
  })
})

describe('年次の収支', () => {
  it('12 ヶ月ぶん返す', () => {
    const y = yearlyBalance(2026)
    expect(y.months).toHaveLength(12)
    expect(y.months[0].ym).toBe('2026-01')
    expect(y.months[11].ym).toBe('2026-12')
  })

  it('記録のある月だけ合計する', () => {
    localStorage.setItem('cc_living_unit', '0')
    putSalary({ '2026-01': '300000', '2026-02': '300000' })
    const y = yearlyBalance(2026)
    expect(y.filledCount).toBe(2)
    expect(y.income).toBe(600000)
    expect(y.expense).toBe(SUMMARY_FIXED * 2)
  })

  it('記録の無い月を 0 円として貯蓄率を下げない', () => {
    localStorage.setItem('cc_living_unit', '0')
    putSalary({ '2026-01': '300000' })
    const y = yearlyBalance(2026)
    expect(y.avgIncome).toBe(300000)
    expect(y.savingRate).toBe(Math.round(((300000 - SUMMARY_FIXED) / 300000) * 100))
  })

  it('カードの記録だけでもその月は数える', () => {
    putVar('jcb', '2026-03', [buy('a', 10000, '2026-03-20')])
    const y = yearlyBalance(2026)
    expect(y.filledCount).toBe(1)
    expect(y.months[2].empty).toBe(false)
  })

  it('何も無ければ合計は 0', () => {
    const y = yearlyBalance(2026)
    expect(y.filledCount).toBe(0)
    expect(y.income).toBe(0)
    expect(y.savingRate).toBe(0)
  })
})
