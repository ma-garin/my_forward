# localStorage キー完全リファレンス

## クレジットカード

| キー | 型 | 内容 | 読み書き関数 |
|------|---|------|------------|
| `cc_fixed_{cardId}` | `FixedItem[]` | カード固定費リスト | `loadFixed(cardId)` / `saveFixed(cardId, list)` |
| `cc_var_{cardId}_{ym}` | `VarItem[]` | カード変動費（月別） | `loadVar(cardId, ym)` / `saveVar(cardId, ym, list)` |
| `cc_billed_{cardId}_{ym}` | `string[]` | 引き落とし済みID | `loadBilled(cardId, ym)` / `saveBilled(cardId, ym, ids)` |
| `cc_limit_{cardId}` | `number` | 月間利用上限額 | `loadLimit(cardId)` / `saveLimit(cardId, v)` |
| `cc_cards` | `Card[]` | カード定義リスト | `loadCards()` / `saveCards(list)` |
| `cc_categories` | `string[]` | カテゴリ一覧 | `loadCategories()` / `saveCategories(list)` |
| `cc_salary_override` | `number` | 旧形式: 家計タブ・給与手動入力値 | 初回のみ月別キーへ移行 |
| `cc_salary_override_by_ym` | `{ [ym: string]: string }` | 家計タブ・月別給与手動入力値 | `loadSalaryOverride(ym)` / `saveSalaryOverride(v, ym)` |
| `cc_salary_override_migrated_v1` | `string` | 旧給与手動入力値の移行済みフラグ | 自動管理 |
| `cc_summary_fixed` | `SummaryItem[]` | 家計タブ固定費内訳 | `loadSummaryFixed()` / `saveSummaryFixed(list)` |
| `cc_living_unit` | `number` | 週予算（円） | `loadLivingUnit()` / `saveLivingUnit(v)` |
| `cc_living_override_{cardId}_{ym}` | `number` | 生活費手動上書き | `loadLivingOverride(cardId, ym)` / `saveLivingOverride(cardId, ym, v)` |
| `life_weekly_budget` | `number` | 週予算（LivingExpenseCard用） | `loadWeeklyBudget()` / `saveWeeklyBudget(v)` |

## 給与

| キー | 型 | 内容 |
|------|---|------|
| `salary_simulation` | `SimData` | 旧形式: 給与固定項目・残業時間・カスタム支給/控除項目 |
| `salary_simulation_monthly` | `{ version: 1, migratedLegacy: boolean, months: { [ym: string]: SimData } }` | 月別給与シミュレーション |
| `salary_base_data` | `BaseItem[]` | 月別給与ベースデータ（SalaryHistory） |
| `salary_base_withholding` | `WHItem[]` | 源泉徴収票データ（SalaryHistory） |
| `salary_extra_data` | `ExtraItem[]` | 残業等追加データ（SalaryHistory） |
| `salary_extra_withholding` | `WHItem[]` | 追加源泉徴収データ（SalaryHistory） |
| `salary_bonus_cycle_settings` | `{ summer, winter }` | 賞与の計上サイクル設定（`finance.js` の `BONUS_CYCLE_KEY`） |

## 同期（クラウド同期・端末固有）

`sync_` プレフィックスのキーは**端末ごとの設定**であり、エクスポート・同期スナップショットのどちらにも含まれない
（`isActiveKey` のどのパターンにも一致しないため自動的に除外される）。定義は `src/utils/gistSync.js`。

| キー | 型 | 内容 |
|------|---|------|
| `sync_gist_token` | `string` | GitHub アクセストークン（平文保存。Gist 権限のみの fine-grained PAT を想定） |
| `sync_gist_id` | `string` | 同期先の非公開 Gist ID（初回アップロード時に自動作成・保存） |
| `sync_last_synced_at` | `string` | 最後に同期が成功した日時（ISO） |
| `sync_last_remote_exported_at` | `string` | 最後に確認したリモートスナップショットの `exportedAt`。他端末の更新検知に使う |
| `sync_backup_before_pull` | `Snapshot` | ダウンロード直前の自動バックアップ（復元用） |

### スナップショット形式

localStorage の値を **`JSON.parse` せず生文字列のまま**保持するためロスレス。
`app_theme` のような非JSON文字列や、空文字が入りうる `cc_limit_*` も欠落しない。

```json
{ "schema": 1, "app": "my_forward", "exportedAt": "2026-07-28T12:34:56.789Z",
  "device": "iPhone", "data": { "cc_cards": "[...]", "app_theme": "apple" } }
```

### エクスポートファイル形式との違い

設定 → データ管理 の JSON ファイルは従来どおり `{ キー: パース済みの値 }` 形式で、後方互換のため変更していない。
この形式では `app_theme` が `JSON.parse` に失敗して除外される（生文字列を入れるとインポート時に `'"apple"'` へ変質するため意図的にそのまま）。
端末間で完全なデータを移すときはクラウド同期を使う。

## データ型定義

```ts
// クレカ固定費アイテム
FixedItem = {
  id: string
  name: string
  payee?: string
  amount: number
  category: string
  spendType: '消費' | '投資' | '浪費'
  day?: number              // 支払日
  recurrence?: 'monthly' | 'interval' | 'once'  // デフォルト: monthly
  startYm?: string          // recurrence=monthly: 開始年月 (YYYY-MM)
  intervalMonths?: number   // recurrence=interval: 間隔ヶ月数
  baseYm?: string           // recurrence=interval: 基準月 (YYYY-MM)
  targetYm?: string         // recurrence=once: 対象月 (YYYY-MM)
}

// クレカ変動費アイテム
VarItem = {
  id: string
  name: string
  payee?: string
  amount: number
  category: string
  spendType: '消費' | '投資' | '浪費'
  date: string              // YYYY-MM-DD
  sign?: 0 | 1              // 1=返金（マイナス扱い）
}

// 家計タブ固定費内訳
SummaryItem = {
  id: string
  label: string
  amount: number
}

// 給与シミュレーション保存データ
SimData = {
  fixed: {
    shokunokyuu: number     // 基本給
    jyuutakuteate: number   // 住宅手当
    tsuukinteate: number    // 通勤手当
    shinyateate: number     // 深夜手当
    tokumei: number         // 特命手当
    kenkouhoken: number     // 健康保険
    kouseinenkin: number    // 厚生年金保険
    jyuuminzei: number      // 住民税
    kumiaifi: number        // 組合費
    shokuhi: number         // 食事補助
    koyouOverride?: number  // 雇用保険（手動上書き）
    shotokuOverride?: number // 所得税（手動上書き）
  }
  overtime: number          // 残業時間（h）
  customUnit: string        // 残業単価 自由入力
  payItems: CustomItem[]    // カスタム支給項目
  dedItems: CustomItem[]    // カスタム控除項目
  bonusTakeHome?: string    // 6月・12月の賞与手取り
}

CustomItem = { id: string; label: string; amount: number }
```
