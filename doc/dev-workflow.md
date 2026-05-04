# 開発ワークフロー

## ブランチ・PR

- 開発ブランチ: `claude/review-code-optimize-costs-UDBnX`
- マージ先: `main`
- マージ方法: squash merge

```bash
git add <files>
git commit -m "feat: 説明"
git push -u origin claude/review-code-optimize-costs-UDBnX
# → GitHub MCP で PR 作成 → merge_pull_request でマージ
```

## ビルド

```bash
npm install        # 初回 or 依存追加後
npx vite build     # ビルド確認（必須）
```

ビルド成功の確認ポイント: `✓ built in X.XXs` が出ること。error が出たら修正してから commit。

## ファイル編集の原則

- **既存ファイルは `Edit` ツール優先**（`Write` は新規ファイル作成のみ）
- 大ファイルは全読みしない → `Grep` で行番号特定 → `Read` で周辺のみ
- 1ファイルへの複数箇所変更は複数の `Edit` で対応

## コミットメッセージ規約

```
feat: 新機能
fix: バグ修正
docs: ドキュメント
refactor: リファクタリング
```

## 注意点

- localStorage のみ使用（外部API通信なし）
- `finance.js` の計算ロジックは給与計算・クレカ合計など複数箇所で共用されるため、変更時は影響範囲を確認する
- `isActiveForYm(item, ym)` は固定費フィルタの共通関数。新たにフィルタが必要な箇所ではこれを使う
- `getBillingYmForDate(dateStr, cutoffDay)` で日付→請求月変換。変動費の月跨ぎロードに使う
- デフォルト表示月はJCB締め日（15日）基準（`CreditCard.jsx` / `Kakeibo.jsx` の `defaultBillingMonth` / `currentYm`）

## バックアップ

設定画面（右上ハンバーガー → データ管理）から全データの一括エクスポート/インポートが可能。  
localStorage がクリアされるとデータが消えるため、定期的なバックアップを推奨。
