import { DEFAULT_JCB_FIXED, currentBillingYm } from './finance'
import { recordPriceChange } from './priceLog'

// ─── カード定義 ────────────────────────────────────────────

export const CARDS = {
  jcb:  { id: 'jcb',  name: 'JCBゴールド',                   shortName: 'JCB',  cutoffDay: 15, paymentDay: 10, color: '#37474f' },
  smbc: { id: 'smbc', name: '三井住友VISAナンバーレスゴールド', shortName: 'VISA', cutoffDay:  0, paymentDay: 26, color: '#1b5e20' },
  // 現金・PayPay。締め日は月末（＝暦月でそのまま集計）。請求サイクルを
  // 持たないので noBilling を立て、締め日・支払日の表示やリマインダーの
  // 対象から外す。PayPay は残高払いの扱い（あと払いはクレカ側で管理する）
  cash: { id: 'cash', name: '現金',                          shortName: '現金', cutoffDay:  0, paymentDay:  0, color: '#616161', noBilling: true },
  // 赤はブランド色そのままだと明るすぎて目に刺さる（合計カードの全面に敷かれる）
  // ので、他カードと同じ暗めトーンに落としたワインレッドにする
  paypay: { id: 'paypay', name: 'PayPay',                    shortName: 'PayPay', cutoffDay: 0, paymentDay: 0, color: '#7b3b41', noBilling: true },
}

// 保存が起きるたびに増える版数。タブは「前回描画したときから版数が変わって
// いれば作り直す」ことで、変更がないときの作り直し（＝切替のもたつき）を避ける。
let dataVersion = 0
export const getDataVersion = () => dataVersion
export const bumpDataVersion = () => { dataVersion += 1 }

// カード一覧（Object.values(CARDS) を各所で作り直さない）
export const CARD_LIST = Object.values(CARDS)

// ─── 共有スタイル定数 ────────────────────────────────────────

export const BORDER_LIGHT = '1px solid var(--surface-line)'

// ─── 表示用定数 ──────────────────────────────────────────────

export const CATEGORY_COLORS = {
  '水道光熱費': '#e3f2fd',
  '通信費':     '#f3e5f5',
  '遊興費':     '#fce4ec',
  '美容':       '#fdf5e6',
  '交通費':     '#e8f5e9',
  '食費':       '#fff8e1',
  '日用品':     '#e0f2f1',
  '医療':       '#fbe9e7',
  '衣類':       '#f9fbe7',
  'その他':     '#eceff1',
}

export const CHART_COLORS = [
  '#e53935', '#f4511e', '#fb8c00', '#fdd835', '#43a047',
  '#00897b', '#1e88e5', '#8e24aa', '#d81b60', '#6d4c41', '#757575',
]

export const SPEND_TYPES = ['消費', '投資', '浪費']
export const SPEND_TYPE_COLORS = { 消費: '#546e7a', 投資: '#2e7d32', 浪費: '#c62828' }

export const LIVING_CATEGORIES = ['生活費', '食費', '日用品']

// ─── 日付ユーティリティ ──────────────────────────────────────

export function prevBusinessDay(date) {
  const d = new Date(date)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

export function nextBusinessDay(date) {
  const d = new Date(date)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

export function nextPayDay(from = new Date()) {
  let day = CARDS.smbc?.paymentDay ?? 26
  try {
    const saved = JSON.parse(localStorage.getItem('cc_cards') || '[]')
    const smbc  = saved.find(c => c.id === 'smbc')
    if (smbc?.paymentDay) day = smbc.paymentDay
  } catch {}
  let candidate = new Date(from.getFullYear(), from.getMonth(), day)
  if (candidate <= from) candidate = new Date(from.getFullYear(), from.getMonth() + 1, day)
  return nextBusinessDay(candidate)
}

export function countFridaysUntil(from, to) {
  let count = 0
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (d <= to) {
    if (d.getDay() === 5) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export function getThisWeekRange() {
  const today = new Date()
  const day   = today.getDay()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - day)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  const toStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    weekStartStr: toStr(sunday),
    weekEndStr:   toStr(saturday),
    label: `${sunday.getMonth() + 1}/${sunday.getDate()} 〜 ${saturday.getMonth() + 1}/${saturday.getDate()}`,
  }
}

export function getRecentWeeks(n = 4) {
  const { weekStartStr } = getThisWeekRange()
  const weeks = []
  let d = new Date(weekStartStr)
  for (let i = 0; i < n; i++) {
    const sun = new Date(d)
    const sat = new Date(d)
    sat.setDate(sat.getDate() + 6)
    const toStr = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    weeks.push({
      from:  toStr(sun),
      to:    toStr(sat),
      label: `${sun.getMonth() + 1}/${sun.getDate()}〜${sat.getMonth() + 1}/${sat.getDate()}`,
    })
    d.setDate(d.getDate() - 7)
  }
  return weeks
}

export function sumLiving(list, fromStr, toStr) {
  return list
    .filter(x => LIVING_CATEGORIES.includes(x.category) && x.sign !== 1 && x.date)
    .filter(x => (!fromStr || x.date >= fromStr) && (!toStr || x.date <= toStr))
    .reduce((s, x) => s + x.amount, 0)
}

export function sumLivingByCategory(list, fromStr, toStr) {
  const result = {}
  LIVING_CATEGORIES.forEach(c => { result[c] = 0 })
  list
    .filter(x => LIVING_CATEGORIES.includes(x.category) && x.sign !== 1 && x.date)
    .filter(x => (!fromStr || x.date >= fromStr) && (!toStr || x.date <= toStr))
    .forEach(x => { result[x.category] = (result[x.category] ?? 0) + x.amount })
  return result
}

// 日付文字列(YYYY-MM-DD)とカードの締め日から請求月(YYYY-MM)を返す
export function getBillingYmForDate(dateStr, cutoffDay) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (cutoffDay > 0 && d <= cutoffDay) {
    return m === 1
      ? `${y - 1}-12`
      : `${y}-${String(m - 1).padStart(2, '0')}`
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

// 週の期間[fromStr, toStr]で各カードの請求月セットを返す
export function getBillingMonthsForRange(fromStr, toStr, cutoffDay) {
  return [...new Set([
    getBillingYmForDate(fromStr, cutoffDay),
    getBillingYmForDate(toStr, cutoffDay),
  ])]
}

// ─── ストレージ ─────────────────────────────────────────────

const INIT_FLAG = 'cc_init_v4'

function cleanupLegacyKeys() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (k.startsWith('bank_') || k.startsWith('asset_')) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

const fixedKey = (cardId) => `cc_fixed_${cardId}`
const varKey   = (cardId, ym) => `cc_var_${cardId}_${ym}`

export function loadFixed(cardId) {
  try {
    if (!localStorage.getItem(INIT_FLAG)) {
      cleanupLegacyKeys()
      localStorage.setItem(INIT_FLAG, '1')
    }
    const raw = localStorage.getItem(fixedKey(cardId))
    if (raw) return JSON.parse(raw)
    if (cardId === 'jcb') {
      saveFixed('jcb', DEFAULT_JCB_FIXED)
      return [...DEFAULT_JCB_FIXED]
    }
    return []
  } catch { return [] }
}
export function saveFixed(cardId, list) { try { localStorage.setItem(fixedKey(cardId), JSON.stringify(list)); bumpDataVersion() } catch(e) { console.warn('saveFixed failed', e) } }

export function loadVar(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(varKey(cardId, ym)) || '[]') } catch { return [] }
}
export function saveVar(cardId, ym, list) { try { localStorage.setItem(varKey(cardId, ym), JSON.stringify(list)); bumpDataVersion() } catch(e) { console.warn('saveVar failed', e) } }

// 変動費の並び順（日付昇順）。散らばったインライン比較をここに一本化する。
export const byDate = (a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1

// 日付とカードから請求月を返す。カードごとに締め日が違うため、
// 「どのカードの何月分か」を求めるときは必ずこれを通す。
export function billingYmForCard(dateStr, cardId, fallbackYm) {
  if (!dateStr) return fallbackYm
  return getBillingYmForDate(dateStr, CARDS[cardId]?.cutoffDay ?? 0)
}

/**
 * 固定費を保存する。toCard が fromCard と違えば保存先ごと移し替える。
 * 画面ごとに移動手順を書き分けると挙動が食い違うため、ここに集約する。
 * 戻り値: 移動先カードの更新後リスト
 */
export function upsertFixedItem({ item, fromCard, toCard = fromCard }) {
  const list = loadFixed(fromCard)
  // 金額を書き換えると前の金額は残らないので、変わった時点でここに控える。
  // 棚卸しの「値上げ」はこの記録だけが頼り
  const before = list.find(x => x.id === item.id)
  if (before) recordPriceChange({ before, after: item })
  if (toCard === fromCard) {
    const next = list.some(x => x.id === item.id)
      ? list.map(x => x.id === item.id ? item : x)
      : [...list, item]
    saveFixed(fromCard, next)
    return next
  }
  saveFixed(fromCard, list.filter(x => x.id !== item.id))
  const next = [...loadFixed(toCard), item]
  saveFixed(toCard, next)
  moveBilledFlags(item.id, fromCard, toCard)
  return next
}

/**
 * 引き落とし済みチェックは `cc_billed_{cardId}_{ym}` に項目 ID で入っている。
 * 固定費をカード移動したときに移し替えないと、旧カードに ID が残り続け、
 * 移動先ではチェックが外れて見える。全請求月ぶんを追随させる。
 */
function moveBilledFlags(itemId, fromCard, toCard) {
  const prefix = `cc_billed_${fromCard}_`
  const yms = Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .map(k => k.slice(prefix.length))
  yms.forEach(ym => {
    const ids = loadBilled(fromCard, ym)
    if (!ids.includes(itemId)) return
    saveBilled(fromCard, ym, ids.filter(id => id !== itemId))
    const toIds = loadBilled(toCard, ym)
    if (!toIds.includes(itemId)) saveBilled(toCard, ym, [...toIds, itemId])
  })
}

/**
 * 変動費を保存する。toCard が fromCard と違えば、移動先カードの締め日から
 * 請求月を計算し直してそのキーへ移す。
 * 戻り値: { ym, list } 移動先の請求月と更新後リスト
 */
export function upsertVarItem({ item, fromCard, fromYm, toCard = fromCard }) {
  const list = loadVar(fromCard, fromYm)
  if (toCard === fromCard) {
    const next = (list.some(x => x.id === item.id)
      ? list.map(x => x.id === item.id ? item : x)
      : [...list, item]).sort(byDate)
    saveVar(fromCard, fromYm, next)
    return { ym: fromYm, list: next }
  }
  saveVar(fromCard, fromYm, list.filter(x => x.id !== item.id))
  const toYm = billingYmForCard(item.date, toCard, fromYm)
  const next = [...loadVar(toCard, toYm), item].sort(byDate)
  saveVar(toCard, toYm, next)
  return { ym: toYm, list: next }
}

export function loadLimit(cardId) {
  const v = parseFloat(localStorage.getItem(`cc_limit_${cardId}`) || '')
  return isNaN(v) ? '' : String(v)
}
export function saveLimit(cardId, v) { try { localStorage.setItem(`cc_limit_${cardId}`, v); bumpDataVersion() } catch(e) { console.warn('saveLimit failed', e) } }

export function loadBilled(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(`cc_billed_${cardId}_${ym}`) || '[]') } catch { return [] }
}
export function saveBilled(cardId, ym, ids) { try { localStorage.setItem(`cc_billed_${cardId}_${ym}`, JSON.stringify(ids)); bumpDataVersion() } catch(e) { console.warn('saveBilled failed', e) } }

export function loadWeeklyBudget() {
  const v = parseInt(localStorage.getItem('life_weekly_budget') || '', 10)
  return isNaN(v) ? 10000 : v
}
export function saveWeeklyBudget(v) { try { localStorage.setItem('life_weekly_budget', String(v)); bumpDataVersion() } catch(e) { console.warn('saveWeeklyBudget failed', e) } }

const salaryOverrideMonthlyKey = 'cc_salary_override_by_ym'
const salaryOverrideMigratedKey = 'cc_salary_override_migrated_v1'

function loadSalaryOverrideMap() {
  try { return JSON.parse(localStorage.getItem(salaryOverrideMonthlyKey) || '{}') } catch { return {} }
}

function saveSalaryOverrideMap(map) {
  try { localStorage.setItem(salaryOverrideMonthlyKey, JSON.stringify(map)); bumpDataVersion() } catch(e) { console.warn('saveSalaryOverrideMap failed', e) }
}

function migrateLegacySalaryOverride(ym) {
  const map = loadSalaryOverrideMap()
  if (localStorage.getItem(salaryOverrideMigratedKey)) return map
  if (map[ym] != null) return map
  const legacy = localStorage.getItem('cc_salary_override')
  if (legacy == null || legacy === '') {
    try { localStorage.setItem(salaryOverrideMigratedKey, '1') } catch(e) { console.warn('migrateLegacySalaryOverride failed', e) }
    return map
  }
  const next = { ...map, [ym]: legacy }
  saveSalaryOverrideMap(next)
  try { localStorage.setItem(salaryOverrideMigratedKey, '1') } catch(e) { console.warn('migrateLegacySalaryOverride failed', e) }
  return next
}

export function loadSalaryOverride(ym = currentBillingYm()) {
  const map = migrateLegacySalaryOverride(ym)
  const v = parseFloat(map[ym] ?? '')
  return isNaN(v) ? '' : String(v)
}
export function saveSalaryOverride(v, ym = currentBillingYm()) {
  const map = loadSalaryOverrideMap()
  saveSalaryOverrideMap({ ...map, [ym]: v })
  try { localStorage.setItem(salaryOverrideMigratedKey, '1'); bumpDataVersion() } catch(e) { console.warn('saveSalaryOverride failed', e) }
  bumpDataVersion()
}

const DEFAULT_SUMMARY_FIXED = [
  { id: 's1', label: '家賃',     amount: 82330 },
  { id: 's2', label: '奨学金',   amount: 13262 },
  { id: 's3', label: '都民共済', amount: 3000 },
]
export function loadSummaryFixed() {
  try {
    const s = localStorage.getItem('cc_summary_fixed')
    return s ? JSON.parse(s) : DEFAULT_SUMMARY_FIXED.map(x => ({ ...x }))
  } catch { return DEFAULT_SUMMARY_FIXED.map(x => ({ ...x })) }
}
export function saveSummaryFixed(list) { try { localStorage.setItem('cc_summary_fixed', JSON.stringify(list)); bumpDataVersion() } catch(e) { console.warn('saveSummaryFixed failed', e) } }

export function loadLivingUnit() {
  const v = parseInt(localStorage.getItem('cc_living_unit') || '', 10)
  return isNaN(v) ? 10000 : v
}
export function saveLivingUnit(v) { try { localStorage.setItem('cc_living_unit', String(v)); bumpDataVersion() } catch(e) { console.warn('saveLivingUnit failed', e) } }

export function loadLivingOverride(cardId, ym) {
  const v = parseInt(localStorage.getItem(`cc_living_override_${cardId}_${ym}`) || '', 10)
  return isNaN(v) ? null : v
}
export function saveLivingOverride(cardId, ym, v) {
  if (v == null) localStorage.removeItem(`cc_living_override_${cardId}_${ym}`)
  else { try { localStorage.setItem(`cc_living_override_${cardId}_${ym}`, String(v)); bumpDataVersion() } catch(e) { console.warn('saveLivingOverride failed', e) } }
  bumpDataVersion()
}

const otherIncomeKey = 'cc_other_income_by_ym'
export function loadOtherIncome(ym) {
  try {
    const map = JSON.parse(localStorage.getItem(otherIncomeKey) || '{}')
    const v = parseFloat(map[ym] ?? '')
    return isNaN(v) ? '' : String(v)
  } catch { return '' }
}
export function saveOtherIncome(v, ym) {
  try {
    const map = JSON.parse(localStorage.getItem(otherIncomeKey) || '{}')
    localStorage.setItem(otherIncomeKey, JSON.stringify({ ...map, [ym]: v }))
  } catch {}
  bumpDataVersion()
}

export function loadCategoryBudgets() {
  try { return JSON.parse(localStorage.getItem('cc_category_budgets') || '{}') } catch { return {} }
}
export function saveCategoryBudgets(map) {
  try { localStorage.setItem('cc_category_budgets', JSON.stringify(map)) } catch {}
  bumpDataVersion()
}
