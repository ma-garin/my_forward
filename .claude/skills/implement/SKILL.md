---
name: implement
description: 機能追加・修正の標準開発フロー。実装からマージまで一気通貫で行う
disable-model-invocation: true
---

実装タスク: $ARGUMENTS

以下の手順で end-to-end で対応する。

## 1. 探索（最小限）
- 変更対象のファイルを `Grep` で特定し、必要箇所のみ `Read`
- 大ファイルは全読みしない（`limit`/`offset` を活用）
- アーキテクチャ不明な場合は `@doc/architecture.md` を参照

## 2. 実装
- 既存ファイルは `Edit` ツール優先（`Write` は新規のみ）
- 必要最小限の変更に留める。不要なリファクタはしない

## 3. ビルド確認
```bash
npx vite build
```
エラーがあれば修正してから次へ進む。

## 4. コミット・プッシュ
```bash
git add <変更ファイル>
git commit -m "feat/fix/docs: 説明\n\nhttps://claude.ai/code/session_01Piu8GSn8AyTisUHvWUyB1j"
git push -u origin claude/review-code-optimize-costs-UDBnX
```

## 5. PR 作成・マージ
- GitHub MCP の `create_pull_request` で PR 作成
- 即座に `merge_pull_request`（squash）でマージ
- ユーザーへ完了報告（PR番号・変更内容）
