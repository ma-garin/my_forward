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

## Reference Docs
詳細は必要なときだけ参照する（トークン節約のため常時読み込み不要）:
- アーキテクチャ・画面構成・コンポーネントツリー: @doc/architecture.md
- localStorage キー・データ型定義: @doc/storage.md
- ビルド手順・ブランチ・コミット規約: @doc/dev-workflow.md

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
