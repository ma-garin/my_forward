import { DEFAULT_JCB_FIXED } from './finance'

// ─── カード定義 ────────────────────────────────────────────

export const CARDS = {
  jcb:  { id: 'jcb',  name: 'JCBゴールド',                   shortName: 'JCB',  cutoffDay: 15, paymentDay: 10, color: '#37474f' },
  smbc: { id: 'smbc', name: '三井住友VISAナンバーレスゴールド', shortName: 'VISA', cutoffDay:  0, paymentDay: 26, color: '#1b5e20' },
}

// ─── 共有スタイル定数 ────────────────────────────────────────

export const BORDER_LIGHT = '1px solid #f5f5f5'

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

export const LIVING_CATEGORIES = ['生活費', '食費', '日用品']

// ─── 日付ユーティリティ ──────────────────────────────────────

export function prevBusinessDay(date) {
  const d = new Date(date)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d
}

export function nextPayDay(from = new Date()) {
  let candidate = new Date(from.getFullYear(), from.getMonth(), 25)
  if (candidate <= from) candidate = new Date(from.getFullYear(), from.getMonth() + 1, 25)
  return prevBusinessDay(candidate)
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
    mondayStr: toStr(sunday),
    sundayStr: toStr(saturday),
    label: `${sunday.getMonth() + 1}/${sunday.getDate()} 〜 ${saturday.getMonth() + 1}/${saturday.getDate()}`,
  }
}

export function getRecentWeeks(n = 4) {
  const { mondayStr } = getThisWeekRange()
  const weeks = []
  let d = new Date(mondayStr)
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
export function saveFixed(cardId, list) { localStorage.setItem(fixedKey(cardId), JSON.stringify(list)) }

export function loadVar(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(varKey(cardId, ym)) || '[]') } catch { return [] }
}
export function saveVar(cardId, ym, list) { localStorage.setItem(varKey(cardId, ym), JSON.stringify(list)) }

export function loadLimit(cardId) {
  const v = parseFloat(localStorage.getItem(`cc_limit_${cardId}`) || '')
  return isNaN(v) ? '' : String(v)
}
export function saveLimit(cardId, v) { localStorage.setItem(`cc_limit_${cardId}`, v) }

export function loadBilled(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(`cc_billed_${cardId}_${ym}`) || '[]') } catch { return [] }
}
export function saveBilled(cardId, ym, ids) { localStorage.setItem(`cc_billed_${cardId}_${ym}`, JSON.stringify(ids)) }

export function loadWeeklyBudget() {
  const v = parseInt(localStorage.getItem('life_weekly_budget') || '', 10)
  return isNaN(v) ? 10000 : v
}
export function saveWeeklyBudget(v) { localStorage.setItem('life_weekly_budget', String(v)) }

export function loadSalaryOverride() {
  const v = parseFloat(localStorage.getItem('cc_salary_override') || '')
  return isNaN(v) ? '' : String(v)
}
export function saveSalaryOverride(v) { localStorage.setItem('cc_salary_override', v) }

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
export function saveSummaryFixed(list) { localStorage.setItem('cc_summary_fixed', JSON.stringify(list)) }

export function loadLivingUnit() {
  const v = parseInt(localStorage.getItem('cc_living_unit') || '', 10)
  return isNaN(v) ? 10000 : v
}
export function saveLivingUnit(v) { localStorage.setItem('cc_living_unit', String(v)) }

export function loadLivingOverride(cardId, ym) {
  const v = parseInt(localStorage.getItem(`cc_living_override_${cardId}_${ym}`) || '', 10)
  return isNaN(v) ? null : v
}
export function saveLivingOverride(cardId, ym, v) {
  if (v == null) localStorage.removeItem(`cc_living_override_${cardId}_${ym}`)
  else localStorage.setItem(`cc_living_override_${cardId}_${ym}`, String(v))
}
