import { getSimulatedIncome } from './finance'
import { loadSalaryOverride } from './ccStorage'

/**
 * その月の手取り。
 *
 * 手取りには「見込み」（給与タブのシミュレーション）と「実績」（実際に
 * 振り込まれた額）の 2 つがあり、画面ごとにどちらを読むかが分かれていた。
 * 家計タブでは収支サマリーが見込みを、2枚合計が実績を出していて、同じ画面に
 * 違う手取りが並んでいた（貯蓄率も見込みの側で計算されていた）。
 *
 * 「その月の手取り」の出どころをここ 1 つにする。実績が入っていれば実績、
 * 入っていなければ見込み。
 *
 * 実績の保存先は `cc_salary_override_by_ym`（loadSalaryOverride /
 * saveSalaryOverride）。書き込みはそのまま使う。ここに別名の保存関数を
 * 足すと、同じ値の入り口が 2 つになる。
 */
export function takeHomeFor(ym) {
  const estimate = getSimulatedIncome(ym)
  const raw = loadSalaryOverride(ym)
  const parsed = raw === '' ? NaN : Number(raw)
  const hasActual = Number.isFinite(parsed)

  return {
    estimate,
    actual: hasActual ? parsed : null,
    amount: hasActual ? parsed : estimate,
    isActual: hasActual,
    // 実績 − 見込み。プラスなら見込みより多く入った
    diff: hasActual ? parsed - estimate : null,
  }
}

/** 差の向きを言葉にする（画面ごとに書き分けない） */
export function incomeDiffLabel(diff) {
  if (diff === null) return ''
  if (diff === 0) return '見込みどおり'
  return diff > 0 ? '見込みより多い' : '見込みより少ない'
}
