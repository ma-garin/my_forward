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
| `cc_category_budgets` | `{ [category: string]: number }` | カテゴリ別の月間予算 | `loadCategoryBudgets()` / `saveCategoryBudgets(map)` |
| `cc_salary_override` | `number` | 旧形式: 家計タブ・給与手動入力値 | 初回のみ月別キーへ移行 |
| `cc_salary_override_by_ym` | `{ [ym: string]: string }` | 家計タブ・月別給与手動入力値 | `loadSalaryOverride(ym)` / `saveSalaryOverride(v, ym)` |
| `cc_salary_override_migrated_v1` | `string` | 旧給与手動入力値の移行済みフラグ | 自動管理 |
| `cc_other_income_by_ym` | `{ [ym: string]: string }` | 月別のその他収入 | `loadOtherIncome(ym)` / `saveOtherIncome(v, ym)` |
| `cc_summary_fixed` | `SummaryItem[]` | 家計タブ固定費内訳 | `loadSummaryFixed()` / `saveSummaryFixed(list)` |
| `cc_living_unit` | `number` | 週予算（円） | `loadLivingUnit()` / `saveLivingUnit(v)` |
| `cc_living_override_{cardId}_{ym}` | `number` | 生活費手動上書き | `loadLivingOverride(cardId, ym)` / `saveLivingOverride(cardId, ym, v)` |
| `life_weekly_budget` | `number` | 週予算（LivingExpenseCard用） | `loadWeeklyBudget()` / `saveWeeklyBudget(v)` |
| `cc_payee_history` | `string[]` | 支払先の入力履歴（支出追加の候補） | `loadHistory` / `addToHistory`（CreditCard.jsx 内） |
| `cc_name_history` | `string[]` | 項目名の入力履歴（同上） | 同上 |
| `cc_payee_meta` | `{ [payee: string]: { category: string, spendType: string } }` | 支払先ごとに前回選んだ分類・消費分類。支出追加で支払先を選ぶと自動で埋める | `loadPayeeMeta` / `savePayeeMeta`（CreditCard.jsx 内） |
| `cc_var_sort_desc` | `'0' \| '1'` | 変動費リストの日付の並び順（`'1'`=新しい順）。表示の好みのみで集計に影響しないため `bumpDataVersion()` は呼ばない | `loadVarSortDesc` / `saveVarSortDesc`（CreditCard.jsx 内） |
| `cc_init_v4` | `string` | 初期データ投入済みフラグ | 自動管理 |

## 給与

| キー | 型 | 内容 |
|------|---|------|
| `salary_simulation` | `SimData` | 旧形式: 給与固定項目・残業時間・カスタム支給/控除項目 |
| `salary_simulation_monthly` | `{ version: 1, migratedLegacy: boolean, months: { [ym: string]: SimData } }` | 月別給与シミュレーション |
| `salary_base_data` | `BaseItem[]` | 月別給与ベースデータ（SalaryHistory） |
| `salary_base_withholding` | `WHItem[]` | 源泉徴収票データ（SalaryHistory） |
| `salary_extra_data` | `ExtraItem[]` | 残業等追加データ（SalaryHistory） |
| `salary_extra_withholding` | `WHItem[]` | 追加源泉徴収データ（SalaryHistory） |
| `salary_bonus_cycle_settings` | `object` | 賞与サイクル設定（`finance.js` の `BONUS_CYCLE_KEY`） |

## アプリ設定

| キー | 型 | 内容 |
|------|---|------|
| `app_theme` | `'apple' \| 'classic'` | 外観テーマ。未設定時は `'apple'`（`ThemeModeContext.jsx`） |

## データ版数（メモリ上のみ）

`ccStorage` は保存が起きるたびに増える版数をメモリに持つ。localStorage には
書かない。`App.jsx` が「前回描画時から変わったタブだけ作り直す」ために使う。

```js
getDataVersion()   // 現在の版数
bumpDataVersion()  // 各 save* 関数の内部で呼ばれる
```

新しく保存関数を足すときは `bumpDataVersion()` を呼ぶこと。忘れると
他のタブに変更が反映されない。

## データ型定義

```ts
// クレカ固定費アイテム
// 消費分類（spendType）は持たない。固定費は分類の対象外。
FixedItem = {
  id: string
  name: string
  payee?: string
  amount: number
  category: string
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
