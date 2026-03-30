# AI-DLC and Spec-Driven Development

Kiro-style Spec Driven Development implementation on AI-DLC (AI Development Life Cycle)

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

## Steering Configuration
- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro:steering-custom`)

---

## Project Quick Reference

### Key Files
| ファイル | 役割 |
|---------|------|
| `src/utils/finance.js` | 全共有ロジック（給与計算・localStorage helpers）|
| `src/tabs/AssetFlowSimulation.jsx` | 資産計画タブ |
| `src/tabs/BankAccounts.jsx` | 口座管理タブ（~1900行・全読み不要）|
| `src/tabs/CreditCard.jsx` | クレカタブ（~1290行・全読み不要）|
| `src/tabs/SalarySimulation.jsx` | 給与シミュレーションタブ |
| `src/tabs/SalaryHistory.jsx` | 給与履歴タブ |

### よく使うユーティリティ（finance.js）
- `newId()` — ユニークID生成
- `fmt(n)` — 金額表示フォーマット（絶対値、カンマ区切り）
- `ymStr(y, m)` — `YYYY-MM` 文字列生成
- `addMonth(ym, n)` — 月を n ヶ月進める（負数で過去）
- `loadFixedEvents()` / `saveFixedEvents(list)` — 固定費の読み書き
- `getCCTotal(cardId, ym)` — クレカ合計取得 `{ fixed, variable, total }`
- `getSalaryTakeHome()` — 手取り計算（万円切り捨て）

### localStorage キー早見表
| キー | 内容 |
|------|------|
| `salary_simulation` | 給与固定項目・残業時間 |
| `bank_fixed_events` | 固定費イベントリスト |
| `cc_fixed_{cardId}` | クレカ固定費（jcb / smbc）|
| `cc_var_{cardId}_{ym}` | クレカ変動費（月別）|
| `bank_accounts` | 口座定義リスト |
| `cc_cards` | カード定義リスト |
| `asset_salary_override` | 資産計画タブの手取り手動上書き |

---

## Efficient File Reading
- **大ファイルは全読みしない** — `limit` / `offset` で必要箇所のみ読む
- 関数を探すときは `Grep` で行番号特定 → その周辺だけ `Read`
- 全体構造の把握が必要な場合も `Glob` + `Grep` を優先し、Explore agentは最終手段

## Editing Rules
- **既存ファイルは `Edit` ツール優先**（`Write` は新規ファイル作成のみ）
- 変更箇所が複数あっても、1ファイルなら複数の `Edit` で対応する
- フルrewriteはファイルが完全に別物になる場合のみ許可
