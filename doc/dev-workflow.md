# 開発ワークフロー

## ブランチ・PR

- マージ先: `main`
- マージ方法: squash merge
- `main` への push で GitHub Pages へ自動デプロイされる（`.github/workflows/deploy.yml`）

```bash
git add <files>
git commit -m "feat: 説明"
git push -u origin <作業ブランチ>
# → GitHub MCP で PR 作成 → merge_pull_request でマージ
```

作業ブランチ名は都度指示されたものを使う。

### squash マージ後の注意

squash マージすると `main` の履歴が付け替わるため、同じブランチで作業を続けると
push が fast-forward できずコンフリクト扱いになる。続きの作業は `main` から
作り直すこと。

```bash
git fetch origin main
git checkout -B <作業ブランチ> origin/main
```

## ビルド・確認

```bash
npm install        # 初回 or 依存追加後
npx vite build     # ビルド確認（必須）
npm run lint       # ESLint（既存エラーがあるので「増えていないこと」を見る）
npm test           # Vitest
npm run preview    # ビルド結果の確認
```

ビルド成功の確認ポイント: `✓ built in X.XXs` が出ること。error が出たら修正してから commit。

`vite.config.js` の `base` が `/my_forward/` なので、preview の URL は
`http://localhost:4173/my_forward/`。末尾のパスを省くと 404 になる。

## ファイル編集の原則

- **既存ファイルは `Edit` ツール優先**（`Write` は新規ファイル作成のみ）
- 大ファイルは全読みしない → `Grep` で行番号特定 → `Read` で周辺のみ
- 1ファイルへの複数箇所変更は複数の `Edit` で対応

## コミットメッセージ規約

```
feat: 新機能
fix: バグ修正
perf: 性能改善
refactor: リファクタリング
docs: ドキュメント
chore: その他
```

## 実装時の注意点

- localStorage のみ使用（外部API通信なし）
- `finance.js` の計算ロジックは給与計算・クレカ合計など複数箇所で共用されるため、
  変更時は影響範囲を確認する
- `isActiveForYm(item, ym)` は固定費フィルタの共通関数。新たにフィルタが必要な
  箇所ではこれを使う
- **請求月の計算は `billingYmForCard(date, cardId, fallbackYm)` を使う。**
  `getBillingYmForDate(dateStr, cutoffDay)` の第 2 引数は締め日（数値）で、
  カード ID を渡すと判定が効かない（過去に実際に混入したバグ）
- **カード移動を伴う保存は `upsertFixedItem` / `upsertVarItem` を通す。**
  画面ごとに移動手順を書くと挙動が食い違う
- 新しい保存関数を足したら `bumpDataVersion()` を呼ぶ。忘れるとタブをまたいだ
  変更が反映されない
- 行の見せ方は `ExpenseRow` に一本化する。画面ごとに行を書かない
- 編集フォームは `ExpenseDialog` に一本化する
- デフォルト表示月はJCB締め日（15日）基準（`CreditCard.jsx` / `Kakeibo.jsx`）

## レイアウトの落とし穴

見切れ（要素が親からはみ出して切れる）が過去に複数回発生している。

- `Card` は `overflow: hidden`。その中で負マージン（`mx: -2`）を使うと
  カード幅をはみ出して端が切れる
- 高さを固定値で決めると、中身（グラフの金額ラベル等）が入りきらず上で切れる。
  `minHeight` にして中身で決まるようにする
- 右下の FAB は内容の上に浮く。行の端に小さなボタンを置くと重なって押せない

## バックアップ

設定画面（右上の歯車 → データ管理）から全データの一括エクスポート/インポートが可能。
localStorage がクリアされるとデータが消えるため、定期的なバックアップを推奨。
