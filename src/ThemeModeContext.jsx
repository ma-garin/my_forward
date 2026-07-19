import { createContext, useContext, useState, useCallback, useMemo } from 'react'

// テーマモード: 'classic'（現行）| 'apple'（Apple 風）
// localStorage に保存し、リロード後も選択を保持する。
// デフォルトは Apple 風（未選択時）。現行に戻すには 設定→外観 で切替。
const STORAGE_KEY = 'app_theme'
const VALID = ['classic', 'apple']
const DEFAULT_MODE = 'apple'

export function loadThemeMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v) ? v : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

const ThemeModeContext = createContext({ mode: DEFAULT_MODE, setMode: () => {} })

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState(loadThemeMode)

  const setMode = useCallback((next) => {
    const value = VALID.includes(next) ? next : 'classic'
    setModeState(value)
    try { localStorage.setItem(STORAGE_KEY, value) } catch { /* localStorage 不可でも動作継続 */ }
  }, [])

  const ctx = useMemo(() => ({ mode, setMode }), [mode, setMode])

  return (
    <ThemeModeContext.Provider value={ctx}>
      {children}
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
