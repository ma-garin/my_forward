import { createTheme } from '@mui/material/styles'

// ─── 共通パレット ───────────────────────────────────────
const palette = {
  mode: 'light',
  primary: {
    main: '#37474f',       // blue-grey 800
    light: '#546e7a',
    dark: '#263238',
  },
  secondary: {
    main: '#546e7a',
  },
  background: {
    default: '#eceff1',    // blue-grey 50
    paper: '#ffffff',
  },
  text: {
    primary: '#263238',
    secondary: '#546e7a',
  },
  error: {
    main: '#b71c1c',
  },
}

// ─── 現行テーマ（classic）────────────────────────────────
// これまでの見た目そのまま。テーマ選択で「現行」を選ぶと必ずここへ戻る。
export const classicTheme = createTheme({
  palette,
  typography: {
    fontFamily: '"Noto Sans JP", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { color: '#546e7a' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
            color: '#37474f',
          },
        },
      },
    },
  },
})

// ─── Apple 風テーマ（apple）──────────────────────────────
// Apple のデザイン原則（すりガラス・光学タイポ・柔らかな奥行き）を web に翻訳。
// prefers-reduced-transparency 時は blur を切って不透明背景へフォールバック。
const GLASS_BLUR = 'blur(20px) saturate(180%)'
const noBlur = '@media (prefers-reduced-transparency: reduce)'

export const appleTheme = createTheme({
  palette: {
    ...palette,
    // iOS システムグループ背景（薄グレー）。白カードをインセット配置する土台。
    background: {
      default: '#F2F2F7',
      paper: '#ffffff',
    },
    text: {
      primary: '#1C1C1E',
      secondary: 'rgba(60,60,67,0.6)',
    },
  },
  typography: {
    // iOS/macOS は SF/ヒラギノ、Android/その他は Noto Sans JP にフォールバック
    fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Helvetica Neue", Arial, sans-serif',
    // サイズ別トラッキング: 大見出しは詰め（負）、本文は 0、小テキストは僅かに広げる
    h4: { fontWeight: 700, letterSpacing: '-0.021em', lineHeight: 1.1 },
    h5: { fontWeight: 700, letterSpacing: '-0.019em', lineHeight: 1.12 },
    h6: { fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.2 },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, letterSpacing: '-0.006em', color: '#546e7a' },
    body1: { letterSpacing: 0, lineHeight: 1.5 },
    body2: { letterSpacing: 0, lineHeight: 1.5 },
    button: { letterSpacing: 0, textTransform: 'none', fontWeight: 600 },
    caption: { letterSpacing: '0.008em' },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    // 半透明のツールバー（コンテンツがその下を通る）
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
        colorPrimary: {
          backgroundColor: 'rgba(38,50,56,0.72)',
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          [noBlur]: {
            backgroundColor: '#263238',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        },
      },
    },
    // 設定パネル（右スライド）もすりガラス
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(236,239,241,0.82)',
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          [noBlur]: {
            backgroundColor: '#eceff1',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        },
      },
    },
    // ダイアログ/シートは大きめ角丸 + マテリアル感 + 柔らかい影
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.86)',
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.5)',
          [noBlur]: {
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(20,26,30,0.32)',
        },
      },
    },
    // カードは境界線を細く・影を柔らかく（浮遊するマテリアル感）
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(38,50,56,0.06)',
          border: '1px solid rgba(38,50,56,0.06)',
          overflow: 'hidden',
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
    // 押下フィードバックを即時・自然に（Apple: pointer-down で反応）
    MuiButtonBase: {
      defaultProps: {
        // リップルは残しつつ、素早い反応を優先
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          transition: 'color .2s, transform .2s',
          '&.Mui-selected': {
            color: '#263238',
          },
        },
      },
    },
  },
})

// 後方互換: 既存の `import theme from './theme'` は現行テーマを指す
export default classicTheme
