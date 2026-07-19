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

// 初回描画後に起動スプラッシュをフェードアウトして除去
requestAnimationFrame(() => requestAnimationFrame(() => {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('splash-hide')
  const remove = () => splash.remove()
  splash.addEventListener('transitionend', remove, { once: true })
  setTimeout(remove, 700)
}))
