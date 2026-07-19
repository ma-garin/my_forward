import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// フォントをオフライン同梱（ネット依存を排除）。
// Inter = SF に酷似（Apple風テーマのラテン/数字用）。日本語は Noto Sans JP。
import '@fontsource-variable/inter'
import '@fontsource/noto-sans-jp/japanese-400.css'
import '@fontsource/noto-sans-jp/japanese-700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
