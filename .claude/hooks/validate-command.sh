#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# PreToolUse フック: Bashコマンドの安全性チェック
# exit 0 = 許可, exit 2 = ブロック（ユーザーに通知）
# ─────────────────────────────────────────────────────────

# 入力はJSON（stdinから tool_input を受け取る）
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# コマンドが取得できない場合はスキップ
if [ -z "$COMMAND" ]; then
  exit 0
fi

# --- 危険パターンの検出 ---

# 本番環境への接続を含むコマンド
if echo "$COMMAND" | grep -qiE '(production|prod[^u])\s*(db|database|server|deploy)'; then
  echo "BLOCKED: 本番環境への接続が検出されました" >&2
  exit 2
fi

# パイプで外部送信（データ流出パターン）
if echo "$COMMAND" | grep -qE '\|\s*(curl|wget|nc|ncat)'; then
  echo "BLOCKED: パイプ経由の外部送信が検出されました" >&2
  exit 2
fi

# 環境変数の出力（機密情報の漏洩）
if echo "$COMMAND" | grep -qE '(printenv|env\b|set\b).*\|'; then
  echo "BLOCKED: 環境変数のパイプ出力が検出されました" >&2
  exit 2
fi

# base64エンコードで送信（難読化による流出）
if echo "$COMMAND" | grep -qE 'base64.*\|.*(curl|wget|nc)'; then
  echo "BLOCKED: base64エンコード経由の外部送信が検出されました" >&2
  exit 2
fi

# /etc/passwd, /etc/shadow の読み取り
if echo "$COMMAND" | grep -qE '(cat|less|more|head|tail)\s+/etc/(passwd|shadow)'; then
  echo "BLOCKED: システムファイルへのアクセスが検出されました" >&2
  exit 2
fi

# 問題なし
exit 0
