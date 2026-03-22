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

// ─── 給与計算ロジック（SalarySimulationと共有）──────────────

export function calcKoyouhoken(grossSalary) {
  return Math.floor(grossSalary * 0.0055 + 0.5)
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

// ─── クレジットカードストレージ ─────────────────────────────

export function getCCTotal(cardId, ym) {
  try {
    const fixed    = JSON.parse(localStorage.getItem(`cc_fixed_${cardId}`)   || '[]')
    const variable = JSON.parse(localStorage.getItem(`cc_var_${cardId}_${ym}`) || '[]')
    const fixedSum = fixed.reduce((s, x) => s + x.amount, 0)
    const varSum   = variable.reduce((s, x) => s + x.amount, 0)
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

// ─── カテゴリストレージ ─────────────────────────────────────

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

// ─── 口座ストレージ ──────────────────────────────────────────

export const DEFAULT_ACCOUNTS = []

// CC支払い・給与の自動連動先口座ID
export const AUTO_ACCOUNT_CC   = ''
export const AUTO_ACCOUNT_SAL  = ''

const ACCOUNTS_INIT_FLAG = 'bank_accounts_v2'

export function loadAccounts() {
  try {
    // 口座定義が変わったので初回リセット
    if (!localStorage.getItem(ACCOUNTS_INIT_FLAG)) {
      localStorage.removeItem('bank_accounts')
      localStorage.setItem(ACCOUNTS_INIT_FLAG, '1')
    }
    const s = localStorage.getItem('bank_accounts')
    return s ? JSON.parse(s) : DEFAULT_ACCOUNTS.map(a => ({ ...a }))
  } catch {
    return DEFAULT_ACCOUNTS.map(a => ({ ...a }))
  }
}

export function saveAccounts(list) {
  localStorage.setItem('bank_accounts', JSON.stringify(list))
}

export function loadOpeningBalances(ym) {
  try {
    return JSON.parse(localStorage.getItem(`bank_opening_${ym}`) || '{}')
  } catch {
    return {}
  }
}

export function saveOpeningBalances(ym, obj) {
  localStorage.setItem(`bank_opening_${ym}`, JSON.stringify(obj))
}

export function loadManualEvents(ym) {
  try {
    return JSON.parse(localStorage.getItem(`bank_events_${ym}`) || '[]')
  } catch {
    return []
  }
}

export function saveManualEvents(ym, list) {
  localStorage.setItem(`bank_events_${ym}`, JSON.stringify(list))
}

// ─── 固定イベントストレージ（毎月/毎週繰り返し）────────────
// { id, name, frequency:'monthly'|'weekly', day?, dayOfWeek?, amount, accountId, sign }

export const DEFAULT_FIXED_EVENTS = []

const FIXED_EVENTS_INIT_FLAG = 'bank_fixed_events_v1'

export function loadFixedEvents() {
  try {
    if (!localStorage.getItem(FIXED_EVENTS_INIT_FLAG)) {
      saveFixedEvents(DEFAULT_FIXED_EVENTS)
      localStorage.setItem(FIXED_EVENTS_INIT_FLAG, '1')
      return DEFAULT_FIXED_EVENTS.map(e => ({ ...e }))
    }
    const s = localStorage.getItem('bank_fixed_events')
    return s ? JSON.parse(s) : DEFAULT_FIXED_EVENTS.map(e => ({ ...e }))
  } catch { return [] }
}

export function saveFixedEvents(list) {
  localStorage.setItem('bank_fixed_events', JSON.stringify(list))
}

// ─── 自動イベント生成（CC支払い・給与・固定繰返し）────────

export function buildAutoEvents(ym, accounts, fixedEvents = []) {
  const [y, m] = ym.split('-').map(Number)

  // 前月ym（CCの請求元月）
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const prevYm = `${py}-${String(pm).padStart(2, '0')}`

  const pad = (d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // 月末日
  const lastDay = new Date(y, m, 0).getDate()

  // CC支払い口座（三菱）
  const ccAccId = accounts.find(a => a.id === AUTO_ACCOUNT_CC || a.name === '三菱')?.id ?? AUTO_ACCOUNT_CC
  // 給与受取口座（住信SBI）
  const salAccId = accounts.find(a => a.id === AUTO_ACCOUNT_SAL || a.name === '住信SBI')?.id ?? AUTO_ACCOUNT_SAL

  const events = []

  const jcbTotal = getCCTotal('jcb', prevYm).total
  if (jcbTotal > 0) {
    events.push({
      id: `auto_jcb_${ym}`,
      date: pad(10),
      name: `JCB支払（${pm}月分）`,
      amount: jcbTotal,
      accountId: ccAccId,
      sign: -1,
      source: 'cc_jcb',
    })
  }

  const smbcTotal = getCCTotal('smbc', prevYm).total
  if (smbcTotal > 0) {
    events.push({
      id: `auto_smbc_${ym}`,
      date: pad(Math.min(26, lastDay)),
      name: `SMBC支払（${pm}月分）`,
      amount: smbcTotal,
      accountId: ccAccId,
      sign: -1,
      source: 'cc_smbc',
    })
  }

  const salary = getSalaryTakeHome()
  if (salary > 0) {
    events.push({
      id: `auto_salary_${ym}`,
      date: pad(25),
      name: '給与',
      amount: salary,
      accountId: salAccId,
      sign: +1,
      source: 'salary',
    })
  }

  // 固定繰返しイベント
  fixedEvents.forEach((fe) => {
    if (fe.frequency === 'weekly') {
      // 月内の該当曜日を全て生成
      for (let d = 1; d <= lastDay; d++) {
        if (new Date(y, m - 1, d).getDay() === fe.dayOfWeek) {
          events.push({
            id: `auto_fe_${fe.id}_${ym}_${d}`,
            date: pad(d),
            name: fe.name,
            amount: fe.amount,
            accountId: fe.accountId,
            sign: fe.sign,
            source: 'fixed',
            fixedId: fe.id,
          })
        }
      }
    } else {
      const day = Math.min(fe.day, lastDay)
      events.push({
        id: `auto_fe_${fe.id}_${ym}`,
        date: pad(day),
        name: fe.name,
        amount: fe.amount,
        accountId: fe.accountId,
        sign: fe.sign,
        source: 'fixed',
        fixedId: fe.id,
      })
    }
  })

  return events
}

// ─── 残高スナップショット（推移グラフ用）────────────────────

export function loadSnapshot(ym) {
  try {
    const s = localStorage.getItem(`bank_snapshot_${ym}`)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function saveSnapshot(ym, data) {
  localStorage.setItem(`bank_snapshot_${ym}`, JSON.stringify(data))
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
