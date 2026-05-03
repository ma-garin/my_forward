# Project Structure

## 配置ルール

- `src/tabs/` — 各タブの画面コンポーネント（PascalCase）
- `src/components/` — 共有UI部品
- `src/settings/` — 設定ドロワー画面
- `src/utils/` — 共有ロジック（camelCase）
- `.kiro/specs/{feature}/` — 機能ごとの要件・設計・タスク

## 命名規約

- ファイル: コンポーネント=PascalCase / その他=camelCase
- localStorage キー: snake_case
- 関数: camelCase

## コード組織原則

- **タブ = 1ファイル**: 小〜中規模は分割せず1ファイル。複雑化したら `src/tabs/{feature}/` で分割
- **状態管理**: `useState` + localStorage で完結
- **定数**: ファイル冒頭の `const` で定義（例: `DEFAULT_SETTINGS`）

詳細なコンポーネントツリーは `@doc/architecture.md` 参照。
