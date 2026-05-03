# Technology Stack

- **Language**: JavaScript (ESM)
- **Framework**: React 19 + Vite 8
- **UI**: MUI v6（Material Design 3 / Blue Grey 系・派手色は使わない）
- **State**: useState + localStorage のみ。グローバル状態管理ライブラリは使わない

## デザイン方針

- カラー: primary `#37474f` / dark `#263238`
- フォント: Noto Sans JP
- エレベーション・アニメーションは最小限
- max-width: 600px で中央揃え

## データ永続化

- localStorage のみ。キーは snake_case で機能単位に命名（例: `salary_simulation`）
- 読み込み時は `DEFAULT_*` とマージして後方互換を保つ

詳細なキー一覧と型定義は `@doc/storage.md` 参照。
