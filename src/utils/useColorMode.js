import { useState, useEffect, useCallback } from 'react'

/**
 * 明るい / 暗いの切り替え。
 *
 * 既定は 'system'（端末の設定に追従）。夜になったら勝手に暗くなるのが
 * いちばん手間がないので、明示的に選んだときだけ固定する。
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

export function useColorMode() {
  const [mode, setModeState] = useState(loadThemeMode)
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  // 端末側の設定は起動後も変わる（自動ダークテーマの時間帯切り替え）
  useEffect(() => {
    const mq = query()
    if (!mq) return
    const onChange = (e) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback((next) => {
    saveThemeMode(next)
    setModeState(next)
  }, [])

  return { mode, resolved: resolveMode(mode, prefersDark), setMode }
}
