import {
  CARDS, CARD_LIST, countFridaysUntil, loadVar, sumLiving,
  loadLivingUnit, loadLivingOverride, loadOtherIncome, loadSummaryFixed,
} from './ccStorage'
import { getCCTotal } from './finance'
import { takeHomeFor } from './income'

/**
 * その請求月の収支。
 *
 * 「その月いくら入って、いくら出たか」は収支サマリー・2枚合計・年次の
 * 振り返りが同じ数字を出さないといけない。画面ごとに足し方を書くと
 * 食い違う（実際にそうなっていた）。
 */

/**
 * その請求月の生活費予算（週予算 × その月の週数）。
 *
 * 週数は請求サイクル（16日〜翌月15日）に入る金曜の数。これまで家計タブは
 * 「今日から次の支払日まで」で数えていたので、どの月を開いても同じ週数に
 * なっていた（過去の月を見ても今月の週数が出る）。
 *
 * 手動上書きがあればそれを使う（生活費カードで直せる）。
 */
export function livingBudgetFor(ym) {
  const override = loadLivingOverride('jcb', ym)
  if (override != null) return override

  const unit = loadLivingUnit()
  return unit > 0 ? livingWeeksFor(ym) * unit : 0
}

/**
 * その請求月に入る週の数（＝サイクル内の金曜の数）。
 * 生活費カード・予算内訳・家計タブがそれぞれ数えていたので 1 つにした。
 */
export function livingWeeksFor(ym) {
  const cutoff = CARDS.jcb?.cutoffDay ?? 15
  const [y, m] = ym.split('-').map(Number)
  // ym の締め日の翌日から、翌月の締め日まで
  return countFridaysUntil(new Date(y, m - 1, cutoff), new Date(y, m, cutoff))
}

/**
 * その請求月に既に使った生活費（全カード）。
 *
 * 読む範囲は `getCCTotal` と同じ `cc_var_{card}_{ym}` にそろえる。ずらすと
 * 「カード合計に入っている生活費」と一致しなくなり、下の引き算が合わなくなる。
 */
export function livingSpentFor(ym) {
  return CARD_LIST.reduce((s, c) => s + sumLiving(loadVar(c.id, ym)), 0)
}

/**
 * その請求月の収支。
 *
 * 生活費は予算で持つが、使った分は既にカードの記録に入っている。予算を
 * そのまま足すと同じ買い物を記録と予算で 2 回数える（実際にそうなっていた）。
 * 足すのは「これから出ていく残り」だけにする。
 *
 * @returns {{
 *   salary: number, isActual: boolean, other: number, income: number,
 *   cards: number, fixed: number, living: number,
 *   livingBudget: number, livingSpent: number,
 *   expense: number, balance: number, savingRate: number,
 * }}
 */
export function monthlyBalance(ym) {
  const takeHome = takeHomeFor(ym)
  const other  = parseFloat(loadOtherIncome(ym)) || 0
  const income = takeHome.amount + other

  const cards  = CARD_LIST.reduce((s, c) => s + getCCTotal(c.id, ym).total, 0)
  const fixed  = loadSummaryFixed().reduce((s, x) => s + x.amount, 0)

  const livingBudget = livingBudgetFor(ym)
  const livingSpent  = livingSpentFor(ym)
  // 使いすぎた月はマイナスにしない（記録側が既に多く出ている）
  const living  = Math.max(0, livingBudget - livingSpent)
  const expense = cards + fixed + living

  const balance = income - expense
  return {
    salary: takeHome.amount, isActual: takeHome.isActual, other, income,
    cards, fixed, living, livingBudget, livingSpent, expense, balance,
    savingRate: income > 0 ? Math.round((balance / income) * 100) : 0,
  }
}

/**
 * 1 年ぶんの収支。ym は請求月。
 * 収入も支出も無い月は「まだ来ていない月」なので合計から外す
 * （残りの月を 0 円として貯蓄率を出すと、年の途中で必ず悪く見える）。
 */
export function yearlyBalance(year) {
  const months = []
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const b = monthlyBalance(ym)
    months.push({ ym, month: m, ...b, empty: b.income === 0 && b.cards === 0 })
  }

  const filled = months.filter((x) => !x.empty)
  const sum = (k) => filled.reduce((s, x) => s + x[k], 0)
  const income = sum('income')
  const expense = sum('expense')
  const balance = income - expense

  return {
    year, months, filledCount: filled.length,
    income, expense, balance,
    savingRate: income > 0 ? Math.round((balance / income) * 100) : 0,
    // 月あたりの平均。月数が違う年どうしを比べられるようにする
    avgIncome:  filled.length ? Math.round(income / filled.length) : 0,
    avgExpense: filled.length ? Math.round(expense / filled.length) : 0,
  }
}
