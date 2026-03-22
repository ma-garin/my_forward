# Project Structure

## Organization Philosophy

タブ単位の機能分割。各タブは `src/tabs/` 配下に独立したコンポーネントとして配置する。
共通ロジック（テーマ・ユーティリティ）は `src/` 直下に置く。

## Directory Patterns

### タブコンポーネント
**Location**: `src/tabs/`
**Purpose**: 各タブの画面ロジックと UI をまとめた単一ファイル
**Example**: `SalarySimulation.jsx` — 給与シミュレーション全体

### アプリ共通
**Location**: `src/`
**Purpose**: エントリーポイント・テーマ・グローバルスタイル
**Example**: `theme.js`（MUI テーマ定義）、`App.jsx`（タブナビゲーション）

### 仕様・設計
**Location**: `.kiro/specs/{feature}/`
**Purpose**: 機能ごとの要件・設計・タスクを格納
**Example**: `.kiro/specs/credit-card/requirements.md`

## Naming Conventions

- **ファイル（コンポーネント）**: PascalCase（例: `SalarySimulation.jsx`）
- **ファイル（設定・ユーティリティ）**: camelCase（例: `theme.js`）
- **localStorage キー**: snake_case（例: `salary_simulation`）
- **関数**: camelCase

## Import Organization

```javascript
// 1. React
import { useState, useCallback } from 'react'
// 2. MUI コンポーネント
import { Box, Card, Typography } from '@mui/material'
// 3. MUI アイコン
import EditIcon from '@mui/icons-material/Edit'
// 4. ローカル（相対パス）
import theme from './theme'
```

## Code Organization Principles

- **タブ = 1ファイル**: 小〜中規模の機能は分割せず 1 ファイルにまとめる。複雑になったら `src/tabs/{feature}/` ディレクトリに分割する
- **状態管理**: グローバルな状態管理ライブラリは使わない。`useState` + localStorage で完結させる
- **定数・デフォルト値**: ファイル冒頭の `const` として定義（例: `DEFAULT_SETTINGS`）
- **localStorage**: 読み書きはタブコンポーネント内にカプセル化。共通 hook 化は複数タブで共有する場合のみ

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
