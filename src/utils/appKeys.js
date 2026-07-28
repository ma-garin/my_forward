import { BONUS_CYCLE_KEY, SALARY_MONTHLY_KEY, LEGACY_SALARY_KEY } from './finance'

// アプリのユーザーデータとして扱うキーか判定する。
// sync_* （同期メタデータ）は端末固有のためどのパターンにも一致させない。
export function isActiveKey(k) {
  return k === LEGACY_SALARY_KEY
      || k === SALARY_MONTHLY_KEY
      || k === 'life_weekly_budget'
      || k === BONUS_CYCLE_KEY
      || k === 'app_theme'
      || k.startsWith('salary_base_')
      || k.startsWith('salary_extra_')
      || k.startsWith('cc_')
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
