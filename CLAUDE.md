# my_forward — 個人資産管理アプリ

完全オフライン（localStorage のみ）。React 19 + Vite 8 + MUI v6。4タブ構成（クレカ/家計/支出一覧/給与）。

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

### Key Utils（ccStorage.js）
- `billingYmForCard(date, cardId, fallbackYm)` — 日付+カード → 請求月。
  `getBillingYmForDate` の第2引数は締め日（数値）なので、カードIDを渡さないこと
- `upsertFixedItem` / `upsertVarItem` — 保存とカード移動。画面ごとに移動手順を書かない
- `bumpDataVersion()` — 保存関数を足したら必ず呼ぶ（タブ間の反映に使う）

### 一本化しているもの（分岐実装を作らない）
- 支出の行: `components/CCExpenseViews.jsx` の `ExpenseRow`（行タップで編集・左スワイプで削除）
- 編集フォーム: `components/ExpenseDialog.jsx`
- 金額入力: `components/AmountField.jsx`（`CalcPad` の値は ref で渡す）

### 仕様メモ
- 消費分類（消費/投資/浪費）は変動費のみ。固定費は持たない
- **画面に色を直書きしない。** 面と淡色は theme が配る CSS 変数を使う
  （`--bg-paper` / `--surface-subtle` / `--surface-muted` / `--surface-line` /
  `--surface-header` / `--divider` / `--tint-*`）。ライト/ダークの両方に効く。
  白文字が乗る帯に `primary.main` は使わない（暗い側で明るくなる）
- 高さを % で指定する棒グラフは、親に高さを持たせる
  （中身なりの親だと 0 になって棒が消える）

### Reading Rules
- 大ファイルは全読みしない — `Grep` で行番号特定 → `Read` で周辺のみ
- 構造把握は `Glob` + `Grep` 優先

### Editing Rules
- 既存ファイルは `Edit` 優先（`Write` は新規のみ）
- フルrewriteはファイルが完全に別物になる場合のみ

### Validation
- 実装後は必ず `npx vite build` でビルド確認
- `npm run preview` の URL は `http://localhost:4173/my_forward/`（base 付き）
- レイアウトは見切れが再発しやすい: `Card` は overflow:hidden、負マージン禁止。
  高さは固定値でなく `minHeight`。FAB は内容の上に浮くので行端にボタンを置かない

### Context Management
- 無関係なタスク間では `/clear` でリセット
- 調査にはサブエージェントを活用しメインコンテキストを節約
