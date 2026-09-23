# my_forward — 個人資産管理アプリ

完全オフライン（localStorage のみ）。React 19 + Vite 8 + MUI v6。4タブ構成（クレカ/家計/支出一覧/給与）。

## Development Guidelines
- Think in English, generate responses in Japanese
- プロジェクト内 Markdown は spec.json.language の言語で書く
- ユーザーの指示に従い、必要なコンテキストを集めて end-to-end で完遂する

## 進め方（手戻りとトークンを減らす）
- 結論を1行目に置く。理由・経緯は聞かれてから書く
- **「無い・できない・走らない」と言う前に実物を読む。** 回し方はワークフロー
  本体（`.github/workflows/*.yml` の `on:` と先頭コメント）に書いてある
- APK 配布は `git push origin origin/main:refs/heads/claude/apk-<PR番号>`
  （Actions API の dispatch は権限が無く 403）
- **リリース公開＝利用者に届いた、ではない。** アプリの更新確認は
  `settings/AppInfo.jsx` の手動ボタンのみ（起動時チェックも通知も無い）
- **報告の時刻は JST（UTC+9）で書く。** GitHub API・Actions の時刻（`published_at` 等、
  末尾 `Z`）は UTC なので +9 時間して日付もまたぐ（例: `2026-09-23T15:32Z` → 9/24 00:32 JST）

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

### 単一の事実は1箇所に置く
過去の不具合はどれも「1つの事実が2箇所にあり、片方だけ更新された」形だった
（署名鍵の在り処 / 配色の state / 週予算のキー）。書く前に
**「この事実の持ち主は1人か」**を問う。持ち主が2人になる形は作らない。

| 事実 | 唯一の出どころ |
|------|--------------|
| アプリのバージョン | `package.json` の `version`（Vite が `__APP_VERSION__` で注入、`build.gradle` も同じファイルを読む） |
| 週予算 | `cc_living_unit`（`loadLivingUnit` / `saveLivingUnit`） |
| 明暗の判定 | `utils/useColorMode.js`（スプラッシュは結果の色 `cc_theme_bg` を読むだけ） |
| 支払い元の一覧 | `cc_cards`（`loadCards` / `saveCards`。`CARDS` / `CARD_LIST` は中身を入れ替える） |
| 今どの請求月か | `finance.currentBillingYm(cutoffDay)` |
| その月の手取り | `utils/income.js` の `takeHomeFor(ym)`（実績があれば実績・無ければ見込み） |
| 合計に足す額 | `finance.signedAmount(item)`（返金はマイナス・振替は 0）。行ごとに書かない |
| その月の収支 | `utils/monthly.js` の `monthlyBalance(ym)`（年次はこれを 12 ヶ月ぶん積む） |
| 生活費の週数 | `utils/monthly.js` の `livingWeeksFor(ym)`（今日ではなく請求サイクルで数える） |
| 記録と請求額の差 | `utils/statement.js` の `compare(recorded, statement)`（記録額は画面から渡す） |
| 通知から拾う文字 | extras 全体を歩く（`NotificationText`）。キーを数え上げない |
| 通知の項目（日時・利用先・金額・カード） | 項目名で拾う（`parseCardNotification` の `LABELS`）。カード会社ごとに読み方を書かない |
| 支払先ごとの前回の内容 | 登録済みの変動費（`utils/payeeMemory.js` の `suggestFromPayee`）。控えを別に持たない |

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

### 入力の形に依存するもの（通知パーサなど）の判断ルール
- **1 サンプルで設計判断しない。** 実機の記録が 1 件（や画面写真）しか無いなら、それは仮説。
  読み方を変える前に 設定 → 通知の取り込み → 各記録のコピー で実記録を取る
- **トレードオフを勝手に決めない。** 「A を取ると B を落とす」形の変更は、選択肢と失うものを
  書いて利用者に選んでもらう
- **実記録をテストに固定する。** `parseCardNotification.test.js` に記録を**そのまま**貼り、
  `toEqual` で固定する。文面を整えない。仮説で書いた文面には `// 仮` を付け、実記録が取れたら
  差し替える

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
