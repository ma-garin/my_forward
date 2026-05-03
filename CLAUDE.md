# my_forward — 個人資産管理アプリ

完全オフライン（localStorage のみ）。React 19 + Vite 8 + MUI v6。3タブ構成（カード/家計/給与）。

## Development Guidelines
- Think in English, generate responses in Japanese
- プロジェクト内 Markdown は spec.json.language の言語で書く
- ユーザーの指示に従い、必要なコンテキストを集めて end-to-end で完遂する

## Reference Docs
詳細は必要なときだけ参照する（トークン節約のため常時読み込み不要）:
- アーキテクチャ・画面構成・コンポーネントツリー: @doc/architecture.md
- localStorage キー・データ型定義: @doc/storage.md
- ビルド手順・ブランチ・コミット規約: @doc/dev-workflow.md

Kiro Spec Driven Development を使う場合は `/kiro` skill を呼び出す。

## Quick Reference

### Key Utils（finance.js）
- `newId()` — ID生成 / `fmt(n)` — 金額フォーマット / `ymStr(y,m)` — YYYY-MM生成
- `isActiveForYm(item, ym)` — 固定費が指定月に有効か / `getCCTotal(cardId, ym)` — クレカ合計

### Reading Rules
- 大ファイルは全読みしない — `Grep` で行番号特定 → `Read` で周辺のみ
- 構造把握は `Glob` + `Grep` 優先

### Editing Rules
- 既存ファイルは `Edit` 優先（`Write` は新規のみ）
- フルrewriteはファイルが完全に別物になる場合のみ

### Validation
- 実装後は必ず `npx vite build` でビルド確認

### Context Management
- 無関係なタスク間では `/clear` でリセット
- 調査にはサブエージェントを活用しメインコンテキストを節約
