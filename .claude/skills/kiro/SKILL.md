---
name: kiro
description: Kiro-style Spec Driven Development の3段階ワークフロー（要件→設計→タスク→実装）を使うときに参照する
---

# AI-DLC and Spec-Driven Development

Kiro-style Spec Driven Development implementation on AI-DLC.

## Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

## Steering vs Specification
- **Steering** (`.kiro/steering/`) - Project-wide rules and context
- **Specs** (`.kiro/specs/`) - Per-feature development process

## Minimal Workflow
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional)
- Progress: `/kiro:spec-status {feature}`

## Rules
- 3-phase approval: Requirements → Design → Tasks → Implementation
- Human review each phase. `-y` only for intentional fast-track
- Generate Markdown in the language defined in spec.json.language

## Steering Configuration
- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files managed via `/kiro:steering-custom`
