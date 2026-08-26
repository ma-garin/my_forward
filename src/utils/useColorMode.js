import { useCallback, useSyncExternalStore } from 'react'

/**
 * 明るい / 暗いの切り替え。
 *
 * 既定は 'system'（端末の設定に追従）。夜になったら勝手に暗くなるのが
 * いちばん手間がないので、明示的に選んだときだけ固定する。
 *
 * 選択は画面をまたいで共有する。useState でフックの中に持つと、設定画面と
 * App がそれぞれ別の値を持ってしまい、設定で切り替えても画面が変わらない
 * （実際にそうなっていた）。値は localStorage に置き、変わったことを
 * 購読者全員に知らせる。
 */

const KEY = 'cc_theme_mode'

/** @typedef {'system' | 'light' | 'dark'} ThemeMode */

export const THEME_MODES = ['system', 'light', 'dark']

export const THEME_MODE_LABELS = {
  system: '端末に合わせる',
  light: 'ライト',
  dark: 'ダーク',
}

/** @returns {ThemeMode} */
export function loadThemeMode() {
  try {
    const v = localStorage.getItem(KEY)
    return THEME_MODES.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemeMode(mode) {
  try {
    localStorage.setItem(KEY, THEME_MODES.includes(mode) ? mode : 'system')
  } catch {
    // 保存できなくても、その場の切り替えは効く
  }
  emit()
}

const query = () =>
  (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

const systemPrefersDark = () => !!query()?.matches

/** 保存値と端末設定から、実際に使う側（'light' | 'dark'）を決める */
export function resolveMode(mode, prefersDark) {
  if (mode === 'light' || mode === 'dark') return mode
  return prefersDark ? 'dark' : 'light'
}

// ─── 共有ストア ──────────────────────────────────────────

const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

function subscribe(fn) {
  listeners.add(fn)
  // 端末側の設定は起動後も変わる（自動ダークテーマの時間帯切り替え）
  const mq = query()
  mq?.addEventListener('change', fn)
  return () => {
    listeners.delete(fn)
    mq?.removeEventListener('change', fn)
  }
}

// スナップショットは文字列にする。毎回新しいオブジェクトを返すと
// React が「変わった」と見なし続けて描画が止まらなくなる。
const getSnapshot = () => `${loadThemeMode()}|${systemPrefersDark() ? 'dark' : 'light'}`

export function useColorMode() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'system|light')
  const [mode, system] = snapshot.split('|')

  const setMode = useCallback((next) => saveThemeMode(next), [])

  return { mode, resolved: resolveMode(mode, system === 'dark'), setMode }
}
