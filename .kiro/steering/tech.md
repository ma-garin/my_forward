# Technology Stack

## Architecture

シングルページアプリケーション（SPA）。全状態は React state + localStorage で管理し、バックエンド・DBは持たない。

## Core Technologies

- **Language**: JavaScript (ESM)
- **Framework**: React 19
- **Build Tool**: Vite 8
- **UI Library**: MUI (Material UI) v6
- **Styling**: MUI sx prop / theme による Material Design 3 準拠

## Key Libraries

- `@mui/material` v6 — UI コンポーネント全般
- `@mui/icons-material` v6 — アイコン
- `@emotion/react` / `@emotion/styled` — MUI の CSS-in-JS エンジン

## Development Standards

### デザイン方針
- カラーパレット: Blue Grey 系（primary: #37474f, dark: #263238）。派手な原色は使わない
- フォント: Noto Sans JP（Google Fonts）
- エレベーション・アニメーションは最小限
- モバイルファースト。max-width: 600px で中央揃え

### データ永続化
- localStorage のみ使用
- キー名は機能単位で命名（例: `salary_simulation`）
- 読み込み時は `DEFAULT_SETTINGS` とマージして後方互換を保つ

### コード品質
- ESLint（eslint-plugin-react-hooks, eslint-plugin-react-refresh）
- コンポーネントは関数コンポーネント + hooks のみ

## Development Environment

### Required Tools
- Node.js 18+
- npm

### Common Commands
```bash
# Dev:   npm run dev
# Build: npm run build
# Lint:  npm run lint
```

## Key Technical Decisions

- **MUI v6 + Emotion**: Tailwind ではなく MUI を採用。Material Design 3 の落ち着いたトーンを優先
- **localStorage**: DB・認証不要でシンプルに保つ。データ移行は JSON エクスポート機能で将来対応予定
- **Vite 8**: 最新版を使用。`@tailwindcss/vite` のような peer deps 問題は `.npmrc` の `legacy-peer-deps` で回避しない（MUI 移行済みのため不要）

---
_Document standards and patterns, not every dependency_
