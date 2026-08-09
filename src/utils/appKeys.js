import { BONUS_CYCLE_KEY, SALARY_MONTHLY_KEY, LEGACY_SALARY_KEY } from './finance'

// プレフィックスで表せないキーはここを唯一の定義元とし、所有モジュール側が import する。
// こうすることでキー名を変えるとホワイトリストも必ず追従する。
export const THEME_KEY = 'app_theme'
export const WEEKLY_BUDGET_KEY = 'life_weekly_budget'

// 同期メタデータ（端末固有）。スナップショットにもエクスポートにも含めない。
export const SYNC_PREFIX = 'sync_'

export const isSalaryKey = (k) => k === LEGACY_SALARY_KEY || k === SALARY_MONTHLY_KEY
export const isCardKey = (k) => k.startsWith('cc_')
export const isSalaryHistoryKey = (k) => k.startsWith('salary_base_') || k.startsWith('salary_extra_')

// アプリのユーザーデータとして扱うキーか判定する。
export function isActiveKey(k) {
  if (k.startsWith(SYNC_PREFIX)) return false
  return isSalaryKey(k)
      || isCardKey(k)
      || isSalaryHistoryKey(k)
      || k === WEEKLY_BUDGET_KEY
      || k === BONUS_CYCLE_KEY
      || k === THEME_KEY
}

export function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

export function listActiveKeys() {
  return getAllKeys().filter(isActiveKey)
}
