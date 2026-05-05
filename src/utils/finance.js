// ─── 共有定数 ────────────────────────────────────────────────

export const DEFAULT_FIXED = {
  shokunokyuu:    0,
  jyuutakuteate:  0,
  tsuukinteate:   0,
  shinyateate:    0,
  tokumei:        0,
  kenkouhoken:    0,
  kouseinenkin:   0,
  jyuuminzei:     0,
  kumiaifi:       0,
  shokuhi:        0,
}

export const UNIT_PRICE_RAW = 0

export const SALARY_MONTHLY_KEY = 'salary_simulation_monthly'
export const LEGACY_SALARY_KEY = 'salary_simulation'

export function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return ymStr(d.getFullYear(), d.getMonth() + 1)
}

export function currentBillingYm(cutoffDay = 15) {
  const today = new Date()
  if (cutoffDay > 0 && today.getDate() <= cutoffDay) {
    return addMonth(ymStr(today.getFullYear(), today.getMonth() + 1), -1)
  }
  return ymStr(today.getFullYear(), today.getMonth() + 1)
}

export function isBonusMonth(ym) {
  const month = Number(ym?.slice(5, 7))
  return month === 6 || month === 12
}

// ─── 給与計算ロジック（SalarySimulationと共有）──────────────

export function calcKoyouhoken(grossSalary) {
  // 令和8年度（2026年4月〜）一般の事業 被保険者負担率 5/1000
  return Math.floor(grossSalary * 0.005)
}

export function salaryIncomeDeduction(a) {
  if (a <= 158333)  return 54167
  if (a <= 299999)  return Math.ceil(a * 0.30 + 6667)
  if (a <= 549999)  return Math.ceil(a * 0.20 + 36667)
  if (a <= 708330)  return Math.ceil(a * 0.10 + 91667)
  return 162500
}

export function basicDeduction(a) {
  if (a <= 2120833) return 48334
  if (a <= 2162499) return 40000
  if (a <= 2204166) return 26667
  if (a <= 2245833) return 13334
  return 0
}

export function calcShotokuzei(taxablePayment, socialInsuranceTotal) {
  const a = taxablePayment - socialInsuranceTotal
  const salaryDed = salaryIncomeDeduction(a)
  const basicDed  = basicDeduction(a)
  const b = Math.max(0, a - salaryDed - basicDed)

  let taxRaw
  if      (b <= 162500)  taxRaw = b * 0.05105
  else if (b <= 275000)  taxRaw = b * 0.10210 - 8296
  else if (b <= 579166)  taxRaw = b * 0.20420 - 36374
  else if (b <= 750000)  taxRaw = b * 0.23483 - 54113
  else if (b <= 1500000) taxRaw = b * 0.33693 - 130688
  else if (b <= 3333333) taxRaw = b * 0.40840 - 237893
  else                   taxRaw = b * 0.45945 - 408061

  return Math.round(taxRaw / 10) * 10
}

export function overtimeUnitPrice(f) {
  return Math.round((f.shokunokyuu + f.jyuutakuteate + f.tokumei) / 154.8 * 1.25)
}

export function overtimeUnitPriceFloor(f) {
  return Math.floor((f.shokunokyuu + f.jyuutakuteate + f.tokumei) / 154.8 * 1.25)
}

export function calcTotalPay(f, overtime) {
  return f.shokunokyuu + f.jyuutakuteate + f.tsuukinteate
    + Math.floor(overtimeUnitPrice(f) * overtime) + f.shinyateate + f.tokumei
}

// otPay: 時間外手当（roundバリアント前提）
export function deriveRow(f, otPay) {
  const totalPay = calcTotalPay(f, 20) - Math.floor(overtimeUnitPrice(f) * 20) + otPay
  const koyou    = calcKoyouhoken(totalPay)
  const taxable  = totalPay - f.tsuukinteate
  const social   = f.kenkouhoken + f.kouseinenkin + koyou
  const shotoku  = calcShotokuzei(taxable, social)
  const totalDed = f.kenkouhoken + f.kouseinenkin + koyou + shotoku + f.jyuuminzei + f.kumiaifi + f.shokuhi
  return { totalPay, koyou, shotoku, totalDed, takeHome: totalPay - totalDed }
}

// deriveRow のオーバーライド対応版（給与シミュレーション表示用）
// koyouOverride / shotokuOverride が f に含まれる場合はそちらを優先する
export function deriveRowSim(f, otPay) {
  const totalPay    = calcTotalPay(f, 20) - Math.floor(overtimeUnitPrice(f) * 20) + otPay
  const koyouCalc   = calcKoyouhoken(totalPay)
  const koyou       = f.koyouOverride   != null ? f.koyouOverride   : koyouCalc
  const taxable     = totalPay - f.tsuukinteate
  const social      = f.kenkouhoken + f.kouseinenkin + koyou
  const shotokuCalc = calcShotokuzei(taxable, social)
  const shotoku     = f.shotokuOverride != null ? f.shotokuOverride : shotokuCalc
  const totalDed    = f.kenkouhoken + f.kouseinenkin + koyou + shotoku + f.jyuuminzei + f.kumiaifi + f.shokuhi
  return { totalPay, koyouCalc, koyou, shotokuCalc, shotoku, totalDed, takeHome: totalPay - totalDed }
}

// ─── 月別給与シミュレーション ───────────────────────────────

export function normalizeSalaryMonth(data = {}) {
  return {
    fixed:         { ...DEFAULT_FIXED, ...(data.fixed ?? {}) },
    overtime:      data.overtime ?? 20.0,
    customUnit:    data.customUnit ?? '',
    payItems:      data.payItems ?? [],
    dedItems:      data.dedItems ?? [],
    bonusTakeHome: data.bonusTakeHome ?? '',
  }
}

function readMonthlySalaryStore() {
  try {
    const raw = localStorage.getItem(SALARY_MONTHLY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const months = parsed?.months && typeof parsed.months === 'object' ? parsed.months : {}
    return {
      version: 1,
      migratedLegacy: parsed?.migratedLegacy ?? Object.keys(months).length > 0,
      months,
    }
  } catch {
    return { version: 1, migratedLegacy: false, months: {} }
  }
}

function writeMonthlySalaryStore(store) {
  localStorage.setItem(SALARY_MONTHLY_KEY, JSON.stringify({
    version: 1,
    migratedLegacy: store.migratedLegacy ?? false,
    months: store.months ?? {},
  }))
}

function loadLegacySalaryMonth() {
  try {
    const raw = localStorage.getItem(LEGACY_SALARY_KEY)
    return raw ? normalizeSalaryMonth(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function ensureLegacySalaryMigrated(store, ym) {
  if (store.migratedLegacy) return store
  if (store.months[ym]) return store
  const legacy = loadLegacySalaryMonth()
  if (!legacy) {
    const next = { ...store, migratedLegacy: true }
    writeMonthlySalaryStore(next)
    return next
  }
  const next = { ...store, migratedLegacy: true, months: { ...store.months, [ym]: legacy } }
  writeMonthlySalaryStore(next)
  return next
}

export function loadSalaryMonth(ym = currentBillingYm()) {
  let store = ensureLegacySalaryMigrated(readMonthlySalaryStore(), ym)
  if (store.months[ym]) return normalizeSalaryMonth(store.months[ym])

  const prevYm = addMonth(ym, -1)
  if (store.months[prevYm]) {
    const copied = { ...normalizeSalaryMonth(store.months[prevYm]), bonusTakeHome: '' }
    const next = { ...store, months: { ...store.months, [ym]: copied } }
    writeMonthlySalaryStore(next)
    return copied
  }

  return normalizeSalaryMonth(loadLegacySalaryMonth() ?? {})
}

export function saveSalaryMonth(ym, data) {
  const store = readMonthlySalaryStore()
  const normalized = normalizeSalaryMonth(data)
  if (!isBonusMonth(ym)) normalized.bonusTakeHome = ''
  const next = {
    ...store,
    migratedLegacy: true,
    months: {
      ...store.months,
      [ym]: normalized,
    },
  }
  writeMonthlySalaryStore(next)
}

export function calcSalaryTakeHomeFromData(data) {
  const saved = normalizeSalaryMonth(data)
  const f = { ...DEFAULT_FIXED, ...saved.fixed }
  const overtime = saved.overtime ?? 20.0
  const customUnit = saved.customUnit ? (parseInt(saved.customUnit, 10) || null) : null

  const up    = customUnit != null ? customUnit : overtimeUnitPriceFloor(f)
  const otPay = Math.floor(up * overtime)

  const baseOtR  = Math.floor(overtimeUnitPrice(f) * 20)
  const totalPay = calcTotalPay(f, 20) - baseOtR + otPay

  const koyouCalc   = calcKoyouhoken(totalPay)
  const koyou       = f.koyouOverride   != null ? f.koyouOverride   : koyouCalc
  const taxable     = totalPay - f.tsuukinteate
  const social      = f.kenkouhoken + f.kouseinenkin + koyou
  const shotokuCalc = calcShotokuzei(taxable, social)
  const shotoku     = f.shotokuOverride != null ? f.shotokuOverride : shotokuCalc
  const totalDed    = f.kenkouhoken + f.kouseinenkin + koyou + shotoku + f.jyuuminzei + f.kumiaifi + f.shokuhi
  const customPay   = saved.payItems.reduce((sum, x) => sum + x.amount, 0)
  const customDed   = saved.dedItems.reduce((sum, x) => sum + x.amount, 0)
  return totalPay - totalDed + customPay - customDed
}

export function getSalaryBonusTakeHome(ym = currentBillingYm()) {
  if (!isBonusMonth(ym)) return 0
  const v = parseInt(String(loadSalaryMonth(ym).bonusTakeHome).replace(/,/g, ''), 10)
  return isNaN(v) ? 0 : v
}

// ─── クレジットカードストレージ ─────────────────────────────

// カード別締め日（0 = 月末締め）
export const CARD_CUTOFF_DAYS = {
  jcb:  15,  // 15日締め翌10日払い
  smbc:  0,  // 月末締め翌26日払い
}

// 固定費アイテムが指定月に有効かどうか判定
export function isActiveForYm(item, ym) {
  const rec = item.recurrence ?? 'monthly'
  if (rec === 'once') return item.targetYm === ym
  if (rec === 'interval') {
    if (!item.baseYm || !item.intervalMonths) return false
    if (item.baseYm > ym) return false
    const [by, bm] = item.baseYm.split('-').map(Number)
    const [vy, vm] = ym.split('-').map(Number)
    return ((vy - by) * 12 + (vm - bm)) % item.intervalMonths === 0
  }
  return !item.startYm || item.startYm <= ym
}

// カレンダー月の変動費合計（CCタブ表示用）
export function getCCTotal(cardId, ym) {
  try {
    const fixed    = JSON.parse(localStorage.getItem(`cc_fixed_${cardId}`)   || '[]')
    const variable = JSON.parse(localStorage.getItem(`cc_var_${cardId}_${ym}`) || '[]')
    const fixedSum = fixed.filter((x) => isActiveForYm(x, ym)).reduce((s, x) => s + x.amount, 0)
    const varSum   = variable.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
    return { fixed: fixedSum, variable: varSum, total: fixedSum + varSum }
  } catch {
    return { fixed: 0, variable: 0, total: 0 }
  }
}

// ─── 給与手取り取得（最小値・万円単位切り捨て）──────────────

export function getSalaryTakeHome() {
  try {
    const s = localStorage.getItem('salary_simulation')
    if (!s) return 0
    const saved = JSON.parse(s)
    const f = { ...DEFAULT_FIXED, ...saved.fixed }
    const overtime = saved.overtime ?? 20.0

    // 3パターン計算してすべての手取りを求め、最小値を採用
    const calcVariant = (otPay) => {
      const totalPay = calcTotalPay(f, overtime) - Math.floor(overtimeUnitPrice(f) * overtime) + otPay
      const koyou    = calcKoyouhoken(totalPay)
      const taxable  = totalPay - f.tsuukinteate
      const social   = f.kenkouhoken + f.kouseinenkin + koyou
      const shotoku  = calcShotokuzei(taxable, social)
      const totalDed = f.kenkouhoken + f.kouseinenkin + koyou + shotoku + f.jyuuminzei + f.kumiaifi + f.shokuhi
      return totalPay - totalDed
    }

    const otR = Math.floor(overtimeUnitPrice(f) * overtime)
    const otF = Math.floor(overtimeUnitPriceFloor(f) * overtime)
    const otX = Math.floor(UNIT_PRICE_RAW * overtime)

    const minimum = Math.min(calcVariant(otR), calcVariant(otF), calcVariant(otX))

    // 万円単位で切り捨て（例：198,000 → 190,000）
    return Math.floor(minimum / 10000) * 10000
  } catch {
    return 0
  }
}

// ─── 給与手取り取得（シミュレーション表示値・オーバーライド反映）──
// 給与タブの「今月の手取りシミュレーション」に表示される値と同じ計算

export function getSimulatedTakeHome(ym = currentBillingYm()) {
  try {
    return calcSalaryTakeHomeFromData(loadSalaryMonth(ym))
  } catch {
    return 0
  }
}

export function getSimulatedIncome(ym = currentBillingYm()) {
  return getSimulatedTakeHome(ym) + getSalaryBonusTakeHome(ym)
}



export const DEFAULT_CATEGORIES = [
  '水道光熱費', '通信費', '遊興費', '美容', '交通費',
  '食費', '日用品', '医療', '衣類', 'その他',
]

// ─── カードストレージ ────────────────────────────────────────

export const DEFAULT_CARDS = []

export function loadCards() {
  try {
    const s = localStorage.getItem('cc_cards')
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

export function saveCards(list) {
  localStorage.setItem('cc_cards', JSON.stringify(list))
}

// ─── JCBデフォルト固定費 ────────────────────────────────────

export const DEFAULT_JCB_FIXED = []

export function loadCategories() {
  try {
    const s = localStorage.getItem('cc_categories')
    return s ? JSON.parse(s) : [...DEFAULT_CATEGORIES]
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

export function saveCategories(list) {
  localStorage.setItem('cc_categories', JSON.stringify(list))
}

// ─── ユーティリティ ──────────────────────────────────────────

export function ymStr(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export function fmt(n) {
  return Number(n).toLocaleString('ja-JP')
}
