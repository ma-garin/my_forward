# アーキテクチャ概要

## アプリ構成

完全オフライン・localStorage のみ使用。最大幅 600px のモバイルファーストWebアプリ。

## 画面構成（タブ）

| タブ | コンポーネント | 概要 |
|------|--------------|------|
| カード（tab 0） | `src/tabs/CreditCard.jsx` | クレカ固定費・変動費の管理・集計 |
| 家計（tab 1） | `src/tabs/Kakeibo.jsx` | 収支サマリー・2枚合計・生活費・JCB+SMBC全カードのカテゴリ分析 |
| 給与（tab 2） | `src/tabs/SalarySimulation.jsx` | 手取りシミュレーション・残業時間入力 |

設定はドロワー（右スライド）で開く。`src/settings/` 配下。

## コンポーネントツリー（主要部分）

```
App.jsx
├── CreditCard.jsx        # カードタブ本体（~1200行）
│   ├── ExpenseDialog     # 固定費・変動費入力ダイアログ（内部）
│   ├── FixedExpenseTable # 固定費テーブル（内部）
│   ├── VarExpenseTable   # 変動費テーブル（CCExpenseViews.jsx）
│   ├── DailyBarChart     # 日別棒グラフ（CCExpenseViews.jsx）
│   ├── YearlySummary     # 年間サマリー（内部）
│   ├── CategoryChart     # カテゴリ別グラフ（CategoryViews.jsx）
│   ├── CategoryBreakdown # カテゴリ別集計（CategoryViews.jsx）
│   ├── LivingExpenseCard # 生活費カード（LivingExpenseCard.jsx）
│   └── CombinedSummary   # 2枚合計（CombinedSummary.jsx）
├── Kakeibo.jsx           # 家計タブ本体（JCB+SMBC両カードを合算）
│   ├── IncomeSummaryCard # 収支サマリー（手取り/支出/差額・貯蓄率）
│   ├── CombinedSummary   # 2枚合計・固定費内訳
│   ├── LivingExpenseCard # 生活費週予算管理
│   ├── SpendTypeChart    # 消費分類グラフ（CategoryViews.jsx）
│   ├── CategoryChart
│   └── CategoryBreakdown # タップで内訳・編集ダイアログ（カード別バッジ表示）
└── SalarySimulation.jsx  # 給与タブ本体
    ├── DrumRoll          # 残業時間ドラムロール（内部）
    ├── FixedRow          # 固定項目行（内部）
    ├── OverrideRow       # 手動上書き可能行（内部）
    ├── AutoRow           # 自動計算行（内部）
    ├── CustomRow         # カスタム項目行（内部）
    └── AddItemDialog     # 項目追加ダイアログ（内部）
```

設定画面:
```
SettingsMain.jsx → SalarySettings.jsx / CardSettings.jsx / DataSettings.jsx
                 → SalaryHistory.jsx（給与履歴グラフ）
```

## データフロー

- 全データは localStorage に保存（サーバー通信なし）
- `src/utils/finance.js` — 給与計算ロジック・共有関数
- `src/utils/ccStorage.js` — クレカ・生活費・サマリー用ストレージ関数（`getBillingYmForDate`, `getBillingMonthsForRange` 含む）
- `src/utils/parseSalaryPdf.js` — 給与明細PDF解析（SalaryHistory用）

## カード定義

`cc_cards` に保存。デフォルトは JCB（id: `jcb`）と SMBC（id: `smbc`）を想定。

```js
// ccStorage.js の CARDS 定数
CARDS = {
  jcb:  { id: 'jcb',  shortName: 'JCB',  cutoffDay: 15, paymentDay: 10, color: '#37474f' },
  smbc: { id: 'smbc', shortName: 'VISA', cutoffDay:  0, paymentDay: 26, color: '#1b5e20' },
}
```

## デフォルト表示月

クレカ・家計タブはJCB締め日（15日）基準でデフォルト月を決定する。  
今日 ≤ 15日 → 前月（請求サイクルの起点月）、それ以降 → 当月。

## 締め日と請求月の関係

`getBillingYmForDate(dateStr, cutoffDay)` で日付→請求月を変換。  
例: JCB cutoff=15 のとき 5/4 → `2026-04`（4月請求）。  
生活費の週集計は `getBillingMonthsForRange` で各カードの正しい請求月からロードする。

## 固定費の繰り返しパターン（recurrence）

| `recurrence` | 追加フィールド | 動作 |
|-------------|-------------|------|
| `'monthly'`（デフォルト） | `startYm?` | startYm 以降の全月 |
| `'interval'` | `intervalMonths`, `baseYm` | N ヶ月ごと |
| `'once'` | `targetYm` | 指定月のみ |

判定関数: `isActiveForYm(item, ym)` in `finance.js`
