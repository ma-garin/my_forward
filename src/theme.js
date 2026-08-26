import { createTheme } from '@mui/material/styles'

// ─── パレット ───────────────────────────────────────────
//
// 面（背景）の色は明暗で入れ替わる。画面側が '#fff' や '#f5f5f5' を直に書くと
// 暗くしたときに白い板だけ残るので、面と境界線はここの token を使うこと。
//   surface.subtle … カードの中の一段沈んだ帯（旧 #fafafa / #f9fafb）
//   surface.muted  … 選択肢の背景・目盛りの下地（旧 #f0f0f0 / #eeeeee）
//   surface.line   … 行間の細い区切り（旧 #f5f5f5）

const light = {
  mode: 'light',
  primary: { main: '#37474f', light: '#546e7a', dark: '#263238' },
  secondary: { main: '#546e7a' },
  background: { default: '#eceff1', paper: '#ffffff' },
  text: { primary: '#263238', secondary: '#546e7a' },
  error: { main: '#b71c1c' },
  success: { main: '#2e7d32' },
  divider: '#e0e0e0',
  surface: { subtle: '#fafafa', muted: '#f0f0f0', line: '#f5f5f5', header: '#37474f' },
  // 淡い塗り分け（表の強調行・種別チップ）。暗い側では同じ色相のまま
  // 明度だけ反転させる。ここを反転し忘れると、暗い画面に明るい札が残る。
  tint: {
    green: '#e8f5e9', greenSoft: '#f1f8e9', mint: '#c8e6c9', blue: '#e3f2fd',
    purple: '#f3e5f5', orange: '#fff3e0', indigo: '#e8eaf6', red: '#ffebee',
    beige: '#f7f4ef',
  },
  onTint: { blue: '#1565c0', beige: '#5d4037' },
}

// 暗い側は真っ黒にしない。有機ELの黒はカードの段差が消えて、金額の羅列が
// どこで切れているか読めなくなる。背景 → カード → 帯が少しずつ明るくなる
// 三段にして、境界を色ではなく明度差で見せる。
const dark = {
  mode: 'dark',
  primary: { main: '#8fa5b0', light: '#b0c2cc', dark: '#5b6f7a' },
  secondary: { main: '#90a4ae' },
  background: { default: '#12171a', paper: '#1b2226' },
  text: { primary: '#e2e7ea', secondary: '#9dabb3' },
  error: { main: '#ef9a9a' },
  success: { main: '#81c784' },
  divider: '#333c42',
  surface: { subtle: '#232b30', muted: '#2b343a', line: '#262f34', header: '#2f3c43' },
  tint: {
    green: '#1e3a28', greenSoft: '#223329', mint: '#24402c', blue: '#14304a',
    purple: '#33243a', orange: '#3a2c18', indigo: '#23273d', red: '#3b2023',
    beige: '#2c2823',
  },
  onTint: { blue: '#90caf9', beige: '#d7ccc8' },
}

// ─── テーマ ─────────────────────────────────────────────

export function buildTheme(mode = 'light') {
  const palette = mode === 'dark' ? dark : light
  return createTheme({
    palette,
    typography: {
      fontFamily: '"Noto Sans JP", "Helvetica Neue", Arial, sans-serif',
      h6: { fontWeight: 500 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { color: palette.text.secondary },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // 面と淡色は CSS 変数で配る。画面側は var(--…) を書くだけで
          // 明暗の両方に追随する（sx ごとに mode を見る分岐を持たない）。
          ':root': {
            '--bg-paper': palette.background.paper,
            '--surface-subtle': palette.surface.subtle,
            '--surface-muted': palette.surface.muted,
            '--surface-line': palette.surface.line,
            '--surface-header': palette.surface.header,
            '--divider': palette.divider,
            '--tint-green': palette.tint.green,
            '--tint-green-soft': palette.tint.greenSoft,
            '--tint-mint': palette.tint.mint,
            '--tint-blue': palette.tint.blue,
            '--tint-purple': palette.tint.purple,
            '--tint-orange': palette.tint.orange,
            '--tint-indigo': palette.tint.indigo,
            '--tint-red': palette.tint.red,
            '--tint-beige': palette.tint.beige,
            '--on-tint-blue': palette.onTint.blue,
            '--on-tint-beige': palette.onTint.beige,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            // 暗い側では primary が明るいので、ヘッダーは面の色で塗る
            ...(mode === 'dark' && {
              backgroundColor: palette.background.paper,
              color: palette.text.primary,
            }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'dark'
              ? '0 1px 3px rgba(0,0,0,0.5)'
              : '0 1px 4px rgba(0,0,0,0.08)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 0,
            '&.Mui-selected': {
              color: mode === 'dark' ? palette.primary.light : '#37474f',
            },
          },
        },
      },
    },
  })
}

export const classicTheme = buildTheme('light')

export default classicTheme
