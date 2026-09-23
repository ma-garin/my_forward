# アーキテクチャ概要

## アプリ構成

完全オフライン・localStorage のみ使用。最大幅 600px のモバイルファーストWebアプリ。

## 画面構成（タブ）

| タブ | コンポーネント | 概要 |
|------|--------------|------|
| クレカ（tab 0） | `src/tabs/CreditCard.jsx` | クレカ固定費・変動費の管理・集計 |
| 家計（tab 1） | `src/tabs/Kakeibo.jsx` | 収支サマリー・2枚合計・生活費・全カードのカテゴリ分析 |
| 支出一覧（tab 2） | `src/tabs/Cashflow.jsx` | 固定費+変動費を横断した月次明細・集計 |
| 給与（tab 3） | `src/tabs/SalarySimulation.jsx` | 手取りシミュレーション・残業時間入力 |

設定はドロワー（右スライド）で開く。`src/settings/` 配下。

画面のカードは 設定 → 表示するカード で個別にオフにできる
（`utils/cardVisibility.js`。保存するのは隠している id だけなので、
カードを増やしても既定で表示される）。支払い元（JCB・PayPay 等）は
カード設定のスイッチで並びから隠せる。隠すのは並びだけで、合計や家計タブの
合算からは外さない（外すと隠したとたんに支出が減って見える）。

画面のカードは 設定 → 表示するカード で個別にオフにできる
（`utils/cardVisibility.js`。保存するのは隠している id だけなので、
カードを増やしても既定で表示される）。

## タブの保持と再構築

タブは切り替えても作り直さず、表示/非表示のみを切り替える（`App.jsx`）。
毎回作り直すと localStorage の読み込みと集計が丸ごと走り、切替がもたつくため。

- 一度開いたタブは DOM に残す。pane の要素参照を `useMemo` で固定しているので、
  隠れているタブは再レンダーされない
- `ccStorage` の `getDataVersion()` は保存のたびに増える。前回描画時から版数が
  変わったタブだけ `key` を進めて作り直す（＝タブをまたいだ変更は反映される）
- 切替アニメーションは持たない（iOS のタブバーと同じ即時切替）

重い集計（年間サマリー 12 ヶ月・支出トレンド 6 ヶ月）は `utils/useAfterPaint.js`
で初回描画の後に回す。画面を先に出し、集計は空き時間で差し替える。

## コンポーネントツリー（主要部分）

```
App.jsx
├── CreditCard.jsx        # クレカタブ本体
│   ├── FixedExpenseTable # 固定費リスト（内部。ExpenseRow を使う）
│   ├── InboxCard         # 未確定の支出（カード利用通知から）
│   ├── VarExpenseTable   # 変動費リスト（CCExpenseViews.jsx）
│   ├── DailyBarChart     # 日別棒グラフ（CCExpenseViews.jsx）
│   ├── AddExpenseScreen  # 支出追加のフルスクリーン入力（内部）
│   ├── YearlySummary     # 年間サマリー（内部）
│   ├── SpendTypeChart    # 消費分類グラフ（CategoryViews.jsx）
│   ├── CategoryChart     # カテゴリ別グラフ（CategoryViews.jsx）
│   ├── CategoryBreakdown # カテゴリ別集計（CategoryViews.jsx）
│   ├── LivingExpenseCard # 生活費カード（LivingExpenseCard.jsx）
│   └── BudgetBreakdown   # 予算内訳（BudgetBreakdown.jsx）
├── Kakeibo.jsx           # 家計タブ本体（全カードを合算）
│   ├── IncomeSummaryCard # 収支サマリー
│   ├── DiagnosisCard     # 家計診断（5観点の採点。utils/diagnosis.js）
│   ├── CombinedSummary   # 2枚合計・固定費内訳
│   ├── LivingExpenseCard
│   ├── MonthlyTrendCard  # 支出トレンド（6ヶ月・前年同月の点線つき）
│   ├── YearlyReviewCard  # 年次の振り返り（年間の収入・支出・貯蓄率）
│   ├── FixedInventoryCard # 固定費の棚卸し（年額換算・値上げ検知）
│   ├── NetWorthCard      # 純資産（NetWorthTrend で推移の折れ線）
│   ├── SpendTypeChart / CategoryChart / CategoryBreakdown
├── Cashflow.jsx          # 支出一覧タブ本体
└── SalarySimulation.jsx  # 給与タブ本体
```

設定画面:
```
SettingsMain.jsx → SalarySettings.jsx / CardSettings.jsx / DataSettings.jsx
                 → SalaryHistory.jsx（給与履歴グラフ）/ AppInfo.jsx
```

## 共通コンポーネント（重要）

画面ごとに実装を持つと見せ方や入力方法が食い違うため、以下に一本化している。

| コンポーネント | 場所 | 役割 |
|--------------|------|------|
| `ExpenseRow` | `components/CCExpenseViews.jsx` | 固定費・変動費で共通の 1 行 |
| `ExpenseGroupHeader` | 同上 | グループ見出し（変動費=日付 / 固定費=支払日） |
| `ExpenseDialog` | `components/ExpenseDialog.jsx` | 固定費・変動費・カテゴリ別集計の編集ダイアログ |
| `AmountField` / `CalcPad` | `components/AmountField.jsx` | 金額入力（電卓シート） |
| `SwipeRow` | `components/SwipeRow.jsx` | 行タップ + 左スワイプ削除 |
| `MonthNav` | `components/MonthNav.jsx` | 月ナビ（前後移動 + 年月タップで直接ジャンプ） |
| `SearchScreen` | `components/SearchScreen.jsx` | 全カード・全期間の横断検索（支出一覧タブの虫めがね） |

### 行の操作

`ExpenseRow` は行タップで編集、左スワイプで削除。
右下に固定表示される FAB が行内の小さなボタンと重なるため、
ボタンを置かず行全体をタップ領域にしている。

### CalcPad の値の受け渡し

電卓は入力値を props ではなく **ref**（`valueRef`）で受け取る。
props で渡すと 1 タップごとに props が変わって `memo` が必ず外れ、
パッド全体が再レンダーされるため。

## データフロー

- 全データは localStorage に保存（サーバー通信なし）
- `src/utils/finance.js` — 給与計算ロジック・共有関数
- `src/utils/income.js` — その月の手取り（実績があれば実績・無ければ見込み）
- `src/utils/monthly.js` — その月の収支・生活費予算。年次はこれを 12 ヶ月ぶん積む
- `src/utils/statement.js` — カード明細との突合（記録と請求額の差）
- `src/utils/ccStorage.js` — クレカ・生活費・サマリー用ストレージ関数
- `src/utils/parseSalaryPdf.js` — 給与明細PDF解析（SalaryHistory から動的 import）
- `src/utils/useAfterPaint.js` — 重い集計を初回描画の後に回すフック

### 保存先の移し替え

カード（支払い方法）を変更したときの移動は `ccStorage` に集約している。
画面ごとに手順を書き分けると挙動が食い違うため、必ずこれを通すこと。

| 関数 | 用途 |
|------|------|
| `upsertFixedItem({ item, fromCard, toCard })` | 固定費の保存・カード移動（引き落とし済みチェックも追随） |
| `upsertVarItem({ item, fromCard, fromYm, toCard })` | 変動費の保存・カード移動（請求月を再計算） |
| `billingYmForCard(date, cardId, fallbackYm)` | 日付とカードから請求月を求める |

`getBillingYmForDate(dateStr, cutoffDay)` の第 2 引数は **締め日（数値）**。
カード ID を渡すと締め日判定が効かないので、通常は `billingYmForCard` を使う。

## カード利用通知の取り込み

Android アプリ版のみ。通知を読む → 支出の下書きを作る → 押したものだけ登録する。

```
NotificationCaptureService(Java)  通知を SharedPreferences に貯める
  → utils/notificationCapture.js  ネイティブから読む
  → utils/parseCardNotification.js 文面 → 下書き（金額・日時・利用先・カード）
  → utils/inbox.js                重複を潰して cc_inbox に貯める / 承認して変動費へ
  → utils/useInbox.js             起動時と復帰時に読み直す
  → components/InboxCard.jsx      クレカタブの「未確定の支出」
```

### 文面から何を拾うか

カード会社の利用通知はどれも「項目名＋値」の並びで、違うのは飾りだけ。

```
Vpass  ◇ご利用カード：… ◇日時：2026/08/14 12:12 ◇利用先：ユニクロ ◇金額：2,990円
MyJCB  【カード名称】… 【利用日時】2026/09/22 18:44 【利用金額】1,840円 【利用先】…
```

**会社ごとに読み方を書かない。** 飾り（`◇` `【】` `：`）は区切りとして読み飛ばし、
項目名（`LABELS`）だけで値を取り出す。Vpass の形だけを書いていたとき、MyJCB の
通知からは金額しか取れず、**日時と利用先を捨てていた**（利用先が空だと
`payeeMemory` の思い出しも効かず、毎回カテゴリを入れ直しになる）。

値の終わりは「次の項目名」か**行末**。飾りで切ると値の中の `【】` で切れる
（MyJCB のカード名称は `【ＯＳ】ＪＣＢゴールド　ＮＬ`）ので、飾りでは切らず、
**1 行 1 項目という通知の形をそのまま終わりに使う**。`normalizeText` は改行を
残す（空白に潰さない）。

潰していたときは、空欄の `【利用先】` が次の行のカード名を飲み込み、支払先が
`JCBクレジットカード ••1004` になっていた。

**項目名だけの行なら、次の行が値。** InboxStyle の通知は 1 要素 1 行で届くので、
`【利用先】` と `ウエルシア` が別の行に分かれる。次の行も項目名で始まるなら、
その欄は空。次の行が支払い元そのものの名前（カード名）なら捨てる。

**人が読む文ではない行は、読む前に落とす**（`isNoiseLine`）。ネイティブ側は
extras を全部歩くので、通知の組み立て情報（`androidx.core.app.NotificationCompat$InboxStyle`）
や送り主のパッケージ名（`jp.co.jcb.my`）まで混ざる。キー名では判定しない（数え
切れない）。値の形で見る: `$` を含むクラス名と、送り主の名前そのもの。店名と
取り違えないよう、ドットを含むだけの値（`Amazon.co.jp`）は落とさない。
判定は JS の 1 箇所に置く（ネイティブ側にも置くと持ち主が 2 人になる。既に端末に
貯まっている記録も JS 側なら読むときに効く）。

項目名が無い文面（Google ウォレット）は金額とカードだけ拾う。

| 拾うもの | 使いみち |
|---------|---------|
| 金額 | 支出の額 |
| 利用日時 | 取引の日付。通知が届いた時刻ではないので、日をまたいでも請求月がずれない |
| 利用先 | `payeeMemory` が過去の登録から項目名・カテゴリ・消費分類を思い出す種 |
| カード名称 | 支払い元の判定（`shortName` で引く） |

支払い元は文面のカード名で決めるが、決まらなければ通知の送り主
（`CARDS` の `androidPackage`）で決める。PayPay は文面に「PayPay」を書かない
ことがあり、文面だけ見ていると捨てていた。

**自動で家計に入る経路はここだけ。** 明細 CSV や画面の読み取りのように、
利用者が毎回ファイルを選ぶものは「自動連携」ではないので持たない。
メールや LINE の通知は金額を持たないので落とす。同じ買い物で複数のアプリが
鳴るため、**支払い元・金額が同じで 15 分以内なら 1 件**にまとめる。まとめるときは
片方にしか無い情報で埋める（店名、そして文面から読めた利用日時＝`atFromText`。
読めなかった側は通知が届いた時刻しか知らない）。
カードの判定は `CARDS` の `shortName` で引くので、カードを増やしてもパーサは
触らなくてよい。

## 過去の登録から思い出す（支払先の補完）

支払先を入れると、前に同じ相手で登録した**項目名・カテゴリ・消費分類**が埋まる。
通知から登録する画面（`ExpenseDialog`）と手動入力（`AddExpenseScreen`）の
どちらでも同じように効く。

**出どころは登録済みの変動費そのもの**（`utils/payeeMemory.js`）。以前は入力の
たびに `cc_payee_meta` へ「前回選んだ分類」を書き写していたが、同じ事実が実データと
控えの 2 箇所にあり、控えは手動入力の画面からしか読み書きされていなかった。通知から
登録しても何も引き継がれず、毎回入れ直しになっていた。

| 関数 | 用途 |
|------|------|
| `suggestFromPayee(payee)` | 過去の登録から `{ payee, name, category, spendType }` を返す（無ければ null） |
| `payeeKey(s)` | 突き合わせ用に表記を均す |

突き合わせは `NFKC` で正規化してから行う。通知の利用先は半角カナ・全角英数で
届くので（`ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ` / `ＡＭＡＺＯＮ`）、手で入れた表記とそのままでは当たらない。
長音（`ー`）は語の一部なので残す（消すと「コーヒー」が「コヒ」になる）。

完全一致が無ければ、片方がもう片方を含むいちばん長いものを採る
（`ローソン渋谷店` → `ローソン`）。3 文字未満では部分一致を見にいかない。

直近 12 ヶ月ぶんを走査した結果はメモリに持ち、`getDataVersion()` が変わるまで
使い回す。ダイアログを開くたびに走らせない。

## 支払い元（カード）の定義

**出どころは `cc_cards` の 1 つ。** 設定 → カード設定 で足す・直す・消す。

以前は `ccStorage.js` に定数で持ちながら、設定画面だけが `cc_cards` を読んで
いた。設定は「カードがありません」と言い、そこで足したカードはどの画面にも
出てこなかった（実測して確認した不具合）。

```js
// ccStorage.js
DEFAULT_CARD_LIST = [   // 初回に入れるだけ。以後の正は cc_cards
  { id: 'jcb',    shortName: 'JCB',    cutoffDay: 15, paymentDay: 10, color: '#37474f' },
  { id: 'smbc',   shortName: 'VISA',   cutoffDay:  0, paymentDay: 26, color: '#1b5e20' },
  { id: 'cash',   shortName: '現金',   cutoffDay:  0, paymentDay:  0, color: '#616161', noBilling: true },
  { id: 'paypay', shortName: 'PayPay', cutoffDay:  0, paymentDay:  0, color: '#7b3b41', noBilling: true,
    androidPackage: 'jp.ne.paypay.android.app' },
  { id: 'suica',  shortName: 'Suica',  cutoffDay:  0, paymentDay:  0, color: '#1b4d3e', noBilling: true },
]

CARDS      // { [id]: card }。中身を入れ替えて使う（参照は配り直さない）
CARD_LIST  // 同じ配列の中身を入れ替える
loadCards() / saveCards(list) / cardHasRecords(cardId)
```

並びは `DEFAULT_CARD_LIST` の順（JCB → VISA → 現金 → PayPay → Suica）に
読むたびにそろえる。自分で足したカードはその後ろに、入れた順のまま並ぶ。
保存の順に引きずられると、古いバックアップを戻したときなどに入れ替わる。

`CARDS` / `CARD_LIST` は **参照を変えずに中身だけ入れ替える**。読む側が 49 箇所
あり、そのすべてを関数呼び出しに書き換えると、どこか 1 つ書き忘れたときに
古いカード一覧が残る。

現金・電子マネーは暦月（月末締め扱い）でそのまま集計する。`noBilling` が
立っているものは締め日・支払日の表示とリマインダーの対象から外す。家計タブの
合算・トレンド・生活費は `CARD_LIST` を列挙するので、支払い元を増やしても
画面側は触らなくてよい（jcb/smbc を直書きしない）。

記録のある支払い元を消すと、その固定費・変動費はどの画面にも出なくなる
（データ自体は残る）。`cardHasRecords` で確かめて、消す前に確認を出す。

### 交通系 IC（モバイルSuica）

JR 東日本は個人向けの利用履歴 API を出していない。マネーフォワード ME でも
手動更新＋画像認証のスクレイピングで、JRE ID へ移行すると連携できなくなる。
モバイルSuica 自体に CSV 書き出しも無い。改札・物販の決済はカードとリーダーの
間だけで完結するので、端末に通知も来ない。**自動で取り込む口が存在しない。**

## 振替（チャージ）

チャージは家計の外にお金が出ていない。財布からカードへ移しただけで、使われる
のはその後。カードでチャージすればカード側に支出が載るので、そこへ Suica の
利用も取り込むと **同じお金を 2 回数える**。

`VarItem.transfer` が立っている行は合計にも分析にも入れない。判断は
`finance.signedAmount(item)` の 1 箇所（振替は 0）と `countsAsSpending(item)`
に置く。行ごとに足し方を書かない。

受信箱から登録するとき、支払先・品名が Suica などチャージ先に見えれば自動で
立てる（`utils/transfer.js`）。外したときは編集ダイアログの「振替」で直せる。

オートチャージはカードの利用通知が来るので、そこは自動で取れる。

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

## 消費分類（消費 / 投資 / 浪費）

**変動費のみが持つ**。固定費は分類の対象外で、保存時に `spendType` を書き込まない。
消費分類グラフ（`SpendTypeChart`）の集計対象も変動費のみ。

## テーマ（ライト / ダーク）

`src/theme.js` の `buildTheme(mode)` が明暗 2 つのパレットを作る。選択は
`utils/useColorMode.js`（`cc_theme_mode`: `system` / `light` / `dark`、既定は
`system`＝端末追従）。設定 → 外観 で変えられる。

**選択は画面をまたいで共有する。** `useColorMode` はフックの中に `useState` を
持たず、`useSyncExternalStore` で購読者全員に知らせる。フックごとに state を
持つと、設定画面と App がそれぞれ別の値を持ってしまい、切り替えても画面が
変わらない（実際にそうなっていた）。

**画面側は色を直に書かない。** 面と淡色は theme が `:root` に配る CSS 変数を使う。

| 変数 | 用途（旧ハードコード値） |
|------|------------------------|
| `--bg-paper` | カードの地（`#fff`） |
| `--surface-subtle` | 一段沈んだ帯・表の縞（`#fafafa` / `#f9fafb`） |
| `--surface-muted` | 選択肢の下地（`#f0f0f0` / `#eeeeee`） |
| `--surface-line` | 行間の細い区切り（`#f5f5f5`。`BORDER_LIGHT` が使う） |
| `--surface-header` | カード上部の見出し帯。白文字が乗るので暗い側でも暗いまま |
| `--divider` | 枠線（`#e0e0e0`） |
| `--tint-*` / `--on-tint-*` | 表の強調行・淡色チップとその文字色 |

`primary.main` は暗い側では明るい色になる。**白文字を乗せる帯に
`bgcolor: 'primary.main'` を使わない**（`--surface-header` を使う）。
カード色・グラフ色・消費分類の色は識別のための強い色なので反転させない。

スプラッシュ（`index.html`）も同じ判定で先に地の色を決める。ここを抜くと
起動のたびに白く光る。

以前は Apple 風テーマを併存させていたが、画面ごとに `mode === 'apple'` の
分岐を抱えることになり、見せ方が二重管理になっていたため取りやめた。
今回の明暗は分岐ではなく token の入れ替えで実現している。
