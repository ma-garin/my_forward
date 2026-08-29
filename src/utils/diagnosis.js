import { CARD_LIST, loadVar } from './ccStorage'
import { getCCTotal, addMonth, countsAsSpending } from './finance'
import { monthlyBalance } from './monthly'
import { loadPriceLog } from './priceLog'

/**
 * 家計診断。その請求月の家計を 5 つの観点で採点する。
 *
 * 数字はすべて既存の出どころから読む（monthlyBalance / getCCTotal /
 * loadPriceLog）。ここで足し直すと、収支サマリーと違う数字で診断する
 * ことになり、点数と画面が食い違う。
 *
 * 基準は一般的な家計の目安に置く:
 * - 貯蓄率は手取りの 2 割が目安（1 割を切ると貯まらない）
 * - 固定費は手取りの 45% 以下（超えると節約の余地が固定化される）
 * - 浪費は支出の 5% 程度なら健全（我慢ではなく把握が目的）
 */

// 観点ごとの配点。判定できない観点は分母から外して 100 点に換算する
const WEIGHTS = { saving: 30, fixedRatio: 25, waste: 15, streak: 15, priceUp: 15 }

const STATUS_POINT = { good: 1, ok: 0.7, warn: 0.4, bad: 0 }

const item = (key, label, status, value, advice) =>
  ({ key, label, status, value, advice })

/** 貯蓄率。手取りが無い月は判定しない */
function diagnoseSaving(b) {
  if (b.income <= 0) return item('saving', '貯蓄率', 'na', '', '収入が未記録のため判定できません')
  const v = `${b.savingRate}%`
  if (b.savingRate >= 20) return item('saving', '貯蓄率', 'good', v, '手取りの2割を貯められています')
  if (b.savingRate >= 10) return item('saving', '貯蓄率', 'ok', v, 'あと少しで目安の2割です')
  if (b.savingRate >= 0)  return item('saving', '貯蓄率', 'warn', v, '1割を切っています。固定費から見直すのが近道です')
  return item('saving', '貯蓄率', 'bad', v, '赤字です。今月の大きな支出を確かめてください')
}

/** 固定費比率 = (固定費内訳 + カードの固定費) ÷ 手取り */
function diagnoseFixedRatio(b, ym) {
  if (b.income <= 0) return item('fixedRatio', '固定費の重さ', 'na', '', '収入が未記録のため判定できません')
  const cardFixed = CARD_LIST.reduce((s, c) => s + getCCTotal(c.id, ym).fixed, 0)
  const ratio = Math.round(((b.fixed + cardFixed) / b.income) * 100)
  const v = `手取りの${ratio}%`
  if (ratio <= 40) return item('fixedRatio', '固定費の重さ', 'good', v, '身軽です。変動費だけ見ていれば足ります')
  if (ratio <= 50) return item('fixedRatio', '固定費の重さ', 'ok', v, '目安の45%前後です')
  if (ratio <= 60) return item('fixedRatio', '固定費の重さ', 'warn', v, '重めです。固定費の棚卸しで年額の大きい順に見直しを')
  return item('fixedRatio', '固定費の重さ', 'bad', v, '手取りの6割を超えています。住居・通信・保険から見直しを')
}

/** 浪費の割合（変動費のみ。返金・振替は除く） */
function diagnoseWaste(ym) {
  const rows = CARD_LIST.flatMap((c) => loadVar(c.id, ym))
    .filter((x) => x.sign !== 1 && countsAsSpending(x))
  const total = rows.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) return item('waste', '浪費の割合', 'na', '', '変動費が未記録のため判定できません')
  const waste = rows.filter((x) => x.spendType === '浪費').reduce((s, x) => s + x.amount, 0)
  const ratio = Math.round((waste / total) * 100)
  const v = `変動費の${ratio}%`
  if (ratio <= 5)  return item('waste', '浪費の割合', 'good', v, '健全です')
  if (ratio <= 15) return item('waste', '浪費の割合', 'ok', v, '楽しみの範囲です')
  if (ratio <= 25) return item('waste', '浪費の割合', 'warn', v, '浪費が膨らんでいます。中身を消費分類グラフで確認を')
  return item('waste', '浪費の割合', 'bad', v, '変動費の4分の1超が浪費です')
}

/** 黒字の継続（直近3ヶ月）。収入のある月だけ数える */
function diagnoseStreak(ym) {
  const months = [ym, addMonth(ym, -1), addMonth(ym, -2)]
    .map((m) => monthlyBalance(m))
    .filter((b) => b.income > 0)
  if (months.length === 0) return item('streak', '黒字の継続', 'na', '', '収入が未記録のため判定できません')
  const black = months.filter((b) => b.balance >= 0).length
  const v = `${months.length}ヶ月中 ${black}ヶ月`
  if (black === months.length) return item('streak', '黒字の継続', 'good', v, '続けて黒字です')
  if (black >= months.length - 1) return item('streak', '黒字の継続', 'ok', v, '赤字の月の中身を確かめておきましょう')
  if (black > 0) return item('streak', '黒字の継続', 'warn', v, '赤字が続いています')
  return item('streak', '黒字の継続', 'bad', v, '毎月赤字です。固定費から見直してください')
}

/** 固定費の値上げ（直近3ヶ月の記録） */
function diagnosePriceUp(ym) {
  const recent = new Set([ym, addMonth(ym, -1), addMonth(ym, -2)])
  const ups = loadPriceLog().filter((e) => e.to > e.from && recent.has(e.ym))
  const names = [...new Set(ups.map((e) => e.name))]
  if (names.length === 0) return item('priceUp', '固定費の値上げ', 'good', 'なし', '直近3ヶ月に値上げはありません')
  const v = `${names.length}件`
  const list = names.slice(0, 3).join('・')
  if (names.length === 1) return item('priceUp', '固定費の値上げ', 'ok', v, `${list} が値上げされました。続けるか判断を`)
  if (names.length === 2) return item('priceUp', '固定費の値上げ', 'warn', v, `${list} が値上げされました`)
  return item('priceUp', '固定費の値上げ', 'bad', v, `${list} など${names.length}件が値上げされました`)
}

/**
 * @returns {{
 *   score: number|null, grade: 'A'|'B'|'C'|'D'|null,
 *   items: { key, label, status: 'good'|'ok'|'warn'|'bad'|'na', value, advice }[],
 * }} score は判定できた観点だけで 100 点に換算。全部 na なら null
 */
export function diagnose(ym) {
  const b = monthlyBalance(ym)
  const items = [
    diagnoseSaving(b),
    diagnoseFixedRatio(b, ym),
    diagnoseWaste(ym),
    diagnoseStreak(ym),
    diagnosePriceUp(ym),
  ]

  const judged = items.filter((x) => x.status !== 'na')
  if (judged.length === 0) return { score: null, grade: null, items }

  const max = judged.reduce((s, x) => s + WEIGHTS[x.key], 0)
  const got = judged.reduce((s, x) => s + WEIGHTS[x.key] * STATUS_POINT[x.status], 0)
  const score = Math.round((got / max) * 100)
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
  return { score, grade, items }
}
