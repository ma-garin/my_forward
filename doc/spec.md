# 次の 6 機能 — 実装仕様

対象読者: 実装を担当するエージェント（Opus）。各機能は独立に 1 PR で実装できるよう、
目的・受け入れ条件・計算式・データ・画面・テスト・触るファイル・非目標を機能ごとに閉じて書く。
どれも **既にアプリが持っているデータ同士を突き合わせると出せるのに、今は誰も計算していない**
もの。外部連携は一切増やさない。

## 0. 共通ルール

### 0.1 進め方
| 項目 | 決め |
|------|------|
| 単位 | 1 機能 = 1 ブランチ = 1 PR（squash merge）。優先順は §0.4 |
| 着手前 | `git fetch origin && git status -sb`。ブランチは `origin/main` から切る（`doc/dev-workflow.md`） |
| 実装順 | util（純関数 + テスト）→ 画面 → 文書同期（`doc/storage.md` / `doc/architecture.md` / `CLAUDE.md` の表）→ `npx vite build` / `npx vitest run` / `npm run lint`（既存 1 件から増えないこと） |
| 完了 | main マージ → `git push origin origin/main:refs/heads/claude/apk-<PR番号>` で APK を回し、リリース公開を確認して報告。「届いた」とは言わない |
| 見積 | 各機能の末尾に置く。着手時に「成果物が出来上がる時刻」で言い直す |

### 0.2 設計の約束（CLAUDE.md の再掲・本仕様での適用）
- **単一の事実は 1 箇所。** 計算は `src/utils/*.js` の純関数に置き、画面は結果を表示するだけ。
  同じ数字を 2 つの画面が出すときは同じ関数を呼ぶ
- **画面に色を直書きしない。** 警告は theme の `error.main` / `warning.main`、面は CSS 変数
- **新しいカードは `HIDEABLE_CARDS`（`utils/cardVisibility.js`）に登録し、`isCardVisible(id)` で包む。**
  既定は表示なので保存データは触らない
- **保存関数を足したら `bumpDataVersion()`**。忘れるとタブをまたいだ反映が止まる
- **数字の根拠を画面に添える**（「4〜6 月の支給平均 ¥x」「残高は 9/20 の値」）。
  根拠の無い警告は信用されずに隠される
- 法令由来の定数（等級表・控除額・料率）は **`src/utils/taxTables.js` に年度付きで置き、
  出典 URL と「確認日」をコメントに書く**。本仕様の数値は 2026-09 時点の記憶に基づく下書きで、
  **実装時に公式表と照合してから固定する**（照合を省いてはいけない）

### 0.3 テストの約束
- util ごとに `*.test.js`。本仕様の「受け入れ条件」の数値例をそのまま `toEqual` で固定する
- 日付に依存する関数は `now` を引数で受ける（既存の `forecastCycle` / `buildSchedule` と同じ）
- localStorage を読む関数はテストで `localStorage.clear()` してから種を入れる（既存テストの形に合わせる）

### 0.4 優先順と依存
| 順 | 機能 | 効き始め | 依存 |
|----|------|---------|------|
| 1 | F3 引き落とし日の残高不足 | 即日 | なし |
| 2 | F6 金額入力時の「この後の残り」 | 即日 | なし |
| 3 | F4 Suica の未記録額 | 即日 | なし |
| 4 | F1 9 月からの社会保険料の予告 | 2027-04〜 | F0（給与内訳の関数化） |
| 5 | F2 6 月からの住民税の予告 | 源泉徴収票が入り次第 | F0 |
| 6 | F5 ふるさと納税の上限と残り | 10〜12 月 | F0・F2 の課税所得計算 |

F1・F2・F5 が共有する下地を **F0** として先に作る（§1）。

---

## 1. F0 給与の内訳を 1 箇所から取る（下地）

### 目的
`calcSalaryTakeHomeFromData` は手取りの数値しか返さず、支給額合計・社保・課税支給額を
別の画面が欲しいときに同じ計算を書き直すことになる。F1・F2・F5 は全部これを欲しがる。

### 変更
1. `src/utils/finance.js` に `salaryBreakdown(data)` を足す。戻り値:
   ```ts
   { totalPay, customPay, customDed, koyou, shotoku, social /* 健保+厚年+雇用 */,
     kenkouhoken, kouseinenkin, jyuuminzei, taxable /* 通勤手当を除く課税支給 */,
     totalDed, takeHome }
   ```
   `calcSalaryTakeHomeFromData(data)` は `salaryBreakdown(data).takeHome` を返すだけにする
   （既存テストが通ることで等価を確認する）
2. `src/utils/salaryHistory.js` を新設し、`SalaryHistory.jsx` のローカル関数
   `loadBase / loadBaseWH / loadExtra / loadExtraWH / saveExtra / saveExtraWH` を移す。
   加えて次を公開する:
   - `actualSalaryFor(year, month)` → `salary_base_data ∪ salary_extra_data` から
     `type === 'salary'` の 1 件（無ければ `null`）。同年月が両方にあれば extra を優先
   - `actualBonusesFor(year)` → `type === 'bonus'` の配列
   - `withholdingFor(year)` → 源泉徴収票 1 件（無ければ `null`）
3. `src/utils/income.js` に `salaryMonthFor(ym)` を足す:
   実績（`actualSalaryFor`）があれば `{ source: 'actual', totalPay, health, pension, employment, ... }`、
   無ければ `{ source: 'sim', ...salaryBreakdown(loadSalaryMonth(ym)) }`。
   **F1・F2・F5 は月の支給額をこれ以外から取らない**

### 受け入れ条件
- `salaryBreakdown` の `takeHome` が、既存 `calcSalaryTakeHomeFromData` の全テストケースと一致
- `SalaryHistory.jsx` の挙動が変わらない（PDF 取り込み・グラフ・前年度比較）

### 見積
半日。

---

## 2. F3 引き落とし日の残高不足の警告

### 目的
口座残高（`cc_accounts`）と、各カードの請求額・支払日（`getCCTotal` / `cycleDatesForYm`）を
どちらも持っているのに突き合わせていない。延滞は手数料より信用情報への実害が大きい。
**「10 日の JCB ¥83,200 に対し、みずほ ¥61,000。不足 ¥22,200」** を締め日の翌日から出す。

### 受け入れ条件（Given / When / Then）
1. 口座 A 残高 100,000、JCB（支払日 10 日、口座 A）の 2026-09 請求 83,200 が確定（締め日を過ぎている）、
   今日が 9/20 → 「10/10 JCB ¥83,200 → 引き落とし後 ¥16,800」を表示。警告色なし
2. 同上で残高 61,000 → 「不足 ¥22,200」を `error` 色で表示。締め日〜支払日の間はずっと出す
3. 同じ口座から VISA（26 日）も 40,000 引かれる → 口座 A の行に両方を並べ、
   引き落とし後残高は **日付順に累積**（10 日時点・26 日時点の 2 つ）
4. カードに口座が紐づいていない → 全口座の合計残高と比較し、「口座を指定すると口座ごとに見られます」の 1 行
5. 支払日が 14 日より先の請求は出さない（締め前で額が動くものは対象外）。
   `noBilling` の支払い元は対象外
6. 残高の更新から 7 日以上 → 「残高は 9/13 の値」を `text.secondary` で添える
7. 口座が 1 つも無い → カードを出さない（設定への導線は既存の純資産カードにある）

### 計算（`src/utils/payability.js` 新設）
```ts
upcomingPayments(now): { card, ym, payDate, amount, accountId }[]
  // CARD_LIST のうち noBilling でないもの × 直近 2 請求月。
  // 締め日を過ぎている（isClosed）かつ payDate が now 以降 14 日以内。
  // amount = getCCTotal(card.id, ym).total（確定額。予測は使わない）

paymentCoverage(now): {
  accountId: string | null,   // null = 口座未指定の束（合計残高で見る）
  name, balance, updatedAt,
  rows: { payDate, card, amount, after }[]  // 日付順、after は累積後の残高
  short: number                             // 最小 after が負ならその絶対値、else 0
}[]
```
- 口座の紐づけは **カード側**に持つ: `Card.accountId?: string`（`cc_cards`）。
  カード設定に「引き落とし口座」の Select を足す（`CardSettings.jsx`）。
  口座を消したら参照は外れるが `accountId` は残してよい（無効 id は未指定扱い）
- `cc_accounts` の要素に `updatedAt?: string`（ISO）を足す。`saveAccounts` は残高が変わった要素にだけ現在時刻を書く

### 画面
- 家計タブ、純資産カード（`kk.networth`）の **直前**に `kk.payability` 「引き落とし予定」カード。
  `upcomingPayments` が空なら描かない
- 行: `10/10  JCB  ¥83,200  →  ¥16,800`。不足行は金額を `error.main`、カード見出しに「不足 ¥22,200」
- 既存リマインダー（`reminders.js` の支払日前夜通知）の本文末尾に、不足があれば
  「口座残高 ¥61,000・不足 ¥22,200」を足す。計算は `paymentCoverage` を呼ぶ（別に書かない）

### テスト（`payability.test.js`）
上の受け入れ条件 1〜5 をそのまま固定。`now` は引数で渡す。

### 触るファイル
`utils/payability.js`（新）/ `utils/accounts.js` / `utils/ccStorage.js`（Card 型）/
`settings/CardSettings.jsx` / `components/PayabilityCard.jsx`（新）/ `tabs/Kakeibo.jsx` /
`utils/cardVisibility.js` / `utils/reminders.js` / `doc/storage.md`（`cc_cards.accountId`, `cc_accounts.updatedAt`）

### 非目標
銀行連携・残高の自動更新・支払日以降の延滞追跡。

### 見積
1 日。

---

## 3. F6 金額を入れた瞬間に「この後の残り」

### 目的
今は保存してからカードを見に行って残りを知る。**買う前に知る**に変える。
支出追加画面（`AddExpenseScreen`）と通知からの登録（`ExpenseDialog`）で、金額を打った時点で
週予算とカード上限の残りが動く。

### 受け入れ条件
1. 週予算 20,000、今週使用 12,300、カテゴリ「食費」、金額 1,980 →
   金額欄の下に `今週の生活費 残り ¥7,700 → ¥5,720`
2. 金額 9,000 → `→ −¥1,300` を `error.main`
3. カテゴリ「医療」（`LIVING_CATEGORIES` 外）→ 生活費の行を出さない
4. カード JCB の月間上限 100,000（`loadLimit`）、今月 84,000 使用、金額 20,000 →
   `JCB 今月の上限 残り ¥16,000 → −¥4,000`。上限 0 のカードは行を出さない
5. 編集（既存行の金額を 1,000 → 3,000 に変更）→ 差分 +2,000 で計算する（元の額は既に使用分に入っている）
6. 金額が空または 0 → 現在の残りだけを出す（矢印なし）
7. 返金（`refund`）→ 残りが増える向きで計算する。振替（`transfer`）→ 行を出さない

### 計算（`src/utils/remaining.js` 新設）
```ts
remainingAfter({ cardId, ym, category, amount, delta = amount, sign, transfer, now }): {
  living?: { before, after },   // LIVING_CATEGORIES のときだけ。weeklyLivingSummary() を使う
  limit?:  { before, after },   // loadLimit(cardId) > 0 のときだけ。getCCTotal(cardId, ym).total を使う
}
```
- 生活費の判定は `LIVING_CATEGORIES`（`ccStorage.js`）を使う。別のリストを作らない
- `weeklyLivingSummary()` は **画面を開いたとき 1 回**だけ呼ぶ（`useMemo(…, [open])`）。
  キー入力ごとに localStorage を走査しない（既存の `visibleCardList()` の再読と同じ罠）

### 画面
- 共通コンポーネント `components/RemainingHint.jsx`。2 行以内・`caption`。
  `AddExpenseScreen` の金額行の直下と、`ExpenseDialog` の `AmountField` 直下に置く
- 表示は数字だけで、文言で叱らない（「使いすぎ」等は書かない）

### テスト
`remaining.test.js` に 1〜7 を固定。

### 触るファイル
`utils/remaining.js`（新）/ `components/RemainingHint.jsx`（新）/ `tabs/CreditCard.jsx`（AddExpenseScreen）/
`components/ExpenseDialog.jsx` / `doc/architecture.md`（共通コンポーネント表）

### 非目標
カテゴリ別予算（`cc_category_budgets`）の残り。要望が出てから同じ関数に足す。

### 見積
半日。

---

## 4. F4 Suica の未記録額の検知と一括登録

### 目的
オートチャージはカード通知で自動取得され振替（`transfer`）として記録されるが、
Suica の利用は手入力で、自動連携の口は存在しない（`doc/architecture.md`）。
**チャージ累計 − 記録累計 − 今の残高 = 未記録額** を出し、「交通費として一括登録」を 1 タップで。

### 受け入れ条件
1. JCB の変動費に `transfer: true` かつ支払先 `モバイルSuica` の 3,000 が 9/2・9/16（計 6,000）、
   Suica の変動費が 9 月に 1,800 のみ、残高入力なし → 「チャージ ¥6,000 / 記録 ¥1,800 / 差 ¥4,200」
2. 残高 1,200 を入力 → 「未記録 ¥3,000」（6,000 − 1,800 − 1,200）
3. 「交通費として登録」→ Suica に `{ name: '交通費（未記録分）', category: '交通費', spendType: '消費',
   date: 今日, amount: 3000 }` が 1 件できる（`upsertVarItem` を通す）。登録後の差は 0
4. 差が 0 以下 → ボタンを出さず「記録が揃っています」
5. 集計期間は **暦月**（Suica は `cutoffDay: 0`）。ただし累計は **記録のある最初の月から**の通算
   （月ごとの差は繰り越すため、月内だけで見ると常にずれる）
6. PayPay へのチャージ（`/paypay/i`）は Suica に混ぜない。チャージ先が判定できない振替は数えない

### 計算
- `utils/transfer.js` に `transferTargetCard(...texts): cardId | null` を足す。
  `TRANSFER_PATTERNS` を `{ re, target }` の配列にし、`looksLikeTransfer` は同じ配列から判定する
  （判定の持ち主を 2 人にしない）。`target` が `CARDS` に無ければ `null`
- `utils/icGap.js`（新）:
  ```ts
  icGap(targetCardId, now): {
    charged, recorded, balance, balanceAt, gap,   // gap = charged − recorded − balance
    months: { ym, charged, recorded }[]            // 直近 6 ヶ月・表示用
  }
  ```
  charged は全カード（`CARD_LIST`）の変動費のうち `transfer && transferTargetCard(payee, name) === targetCardId`。
  recorded は `targetCardId` の変動費で `transfer` でないもの（`signedAmount` で符号を見る）
- 残高: `cc_ic_balance_{cardId}` = `{ balance: number, at: string }`。`saveIcBalance` は `bumpDataVersion()`

### 画面
- クレカタブで **チャージ先になる支払い元**（`transferTargetCard` の target に現れ、`noBilling`）を選んでいるとき、
  使用額サマリーの直後に `cc.icGap` 「チャージと記録の差」カード
- 上段: チャージ / 記録 / 残高（タップで入力）/ 未記録。下段: 直近 6 ヶ月の 2 本棒（チャージ・記録）
- ボタン「¥3,000 を交通費として登録」。押したら Snackbar「登録しました」（取り消しは行のスワイプ削除で足りる）

### テスト
`transfer.test.js` に target 判定を追加、`icGap.test.js` に 1〜6 を固定。

### 触るファイル
`utils/transfer.js` / `utils/icGap.js`（新）/ `components/IcGapCard.jsx`（新）/ `tabs/CreditCard.jsx` /
`utils/cardVisibility.js` / `doc/storage.md`（`cc_ic_balance_{cardId}`）/ `doc/architecture.md`（振替の節）

### 非目標
Suica 利用履歴の読み取り（口が無い）。現金チャージ（記録が無いので差に出ない。architecture.md の記述どおり）。

### 見積
1 日。

---

## 5. F1 9 月からの社会保険料の予告（定時決定）

### 目的
標準報酬月額は **4・5・6 月に支給された報酬の平均**で決まり 9 月から 1 年適用される（定時決定）。
残業を自分で調整できる人にとって、4 月時点で「このままだと 9 月から月 ¥x 手取り減。
6 月の残業を y 時間以内なら据え置き」が見えることは、年間で数万円の差になる。

### 前提（実装前に利用者へ閉じた質問で確認する）
- 給与タブの月キー `ym` は **支給月**である（4 月分の残業が 4 月キーに入る）。ずれていれば
  `cc_salary_pay_month_offset`（0 / 1）を設定に足して補正する
- 保険料の控除は翌月（9 月分 → 10 月支給から）。文言は「9 月分から（10 月の給与から）」

### 受け入れ条件
1. 厚生年金の現在の控除額 41,175 → 標準報酬月額 450,000 相当…ではなく、**逆算 450,000 → 厚年等級 28（標準 440,000）**
   のように、`kouseinenkin / 0.0915` を等級表に当てて現在の等級を出す（41,175 / 0.0915 = 450,000 → 報酬月額 450,000 は 等級 28: 425,000〜455,000 → 標準 440,000）
2. 4・5・6 月の支給額合計（`salaryMonthFor(ym).totalPay`。実績があれば実績）が 471,000 / 466,000 / 489,000 →
   平均 475,333 → 等級 29（455,000〜485,000、標準 470,000）。差 +1 等級
3. 健保料率は現在の控除額から逆算: `kenkouhoken / 現在の標準報酬月額`（介護保険込みで吸収される）。
   例: 22,440 / 440,000 = 5.1%。差額/月 = (470,000 − 440,000) × (0.051 + 0.0915) = 4,275 → 「9 月分から月 ¥4,275 増」
4. 据え置き条件: 6 月の支給上限 = 現等級上限 455,000 × 3 − (471,000 + 466,000) = 428,000。
   6 月の残業なし支給が 420,000、残業単価 3,100 → 「6 月の残業 2.5 時間以内なら据え置き」。
   6 月が実績で確定していれば条件は出さない
5. 表示期間: 4 月 1 日〜 9 月 30 日。7〜9 月は 4〜6 月の実績で確定した結果を出す
6. 厚生年金の控除額が 0（未入力）→ 「厚生年金の控除額を入れると等級を出せます」だけ出す

### 計算
- `utils/taxTables.js`（新）: `STANDARD_REWARD_GRADES` = 健保 50 等級の
  `{ grade, standard, lower, upper }`（報酬月額 `lower ≤ x < upper`）。厚生年金は健保等級 4〜35 を
  等級 1〜32 として読む（下限 88,000・上限 650,000 に丸める）。**協会けんぽの保険料額表で照合**して
  出典と確認日をコメントに書く。厚年料率 18.3%（折半 9.15%）
- `utils/shaho.js`（新）:
  ```ts
  gradeFor(monthlyReward): { grade, standard }            // 健保等級
  pensionGradeFor(monthlyReward): { grade, standard }     // 厚年等級（丸め込み）
  currentStandard(fixed): number | null                   // kouseinenkin から逆算
  regularRevision(year, now): {
    months: { ym, totalPay, source: 'actual'|'sim' }[],  // 4,5,6 月
    average, current: { standard }, next: { standard },
    healthRate, monthlyDiff,                             // 手取りの増減（負なら減る）
    holdCondition?: { juneMaxPay, maxOvertimeHours }     // 6 月が未確定のとき
  } | null
  ```
  支給額は `salaryMonthFor(ym).totalPay`（F0）のみから取る

### 画面
- 給与タブ、手取りサマリー（`sal.result`）の直後に `sal.shaho` 「9 月からの社会保険料」
- 1 行目に結論（「月 ¥4,275 増の見込み」/「据え置きの見込み」）、2 行目に根拠（4〜6 月の支給と平均）、
  3 行目に条件（あれば）。月の値の出どころ（実績 / 見込み）をチップで示す

### テスト
`shaho.test.js` に 1〜4・6 を固定。等級表は境界値（83,000 / 92,999 / 93,000 / 665,000）を固定。

### 触るファイル
`utils/taxTables.js`（新）/ `utils/shaho.js`（新）/ `components/ShahoCard.jsx`（新）/
`tabs/SalarySimulation.jsx` / `utils/cardVisibility.js` / `doc/architecture.md`

### 非目標
随時改定（固定的賃金の変動で 3 ヶ月 2 等級以上）、賞与の標準賞与額、育休中の特例。

### 見積
1 日（等級表の照合 1 時間を含む）。

---

## 6. F2 6 月からの住民税の予告

### 目的
住民税（特別徴収）は前年の所得で決まり、**6 月の給与から額が変わる**。今は 6 月の明細を見て
初めて気づく。源泉徴収票（`salary_base_withholding`）が入った時点で「6 月から月 ¥x（今 ¥y、±¥z）」を出し、
給与タブの控除項目 `jyuuminzei` を 6 月以降に 1 タップで書き込む。賞与からは引かれないので月給のみ。

### 受け入れ条件（数値は概算。±数百円は仕様どおり）
1. 源泉徴収票 2026 年: 給与所得控除後 3,760,000、所得控除の合計額 1,250,000 →
   住民税の課税所得 = 3,760,000 − (1,250,000 − 50,000) = 2,560,000（基礎控除の差 48 万→43 万）
2. 所得割 = 2,560,000 × 10% = 256,000。調整控除 2,500（課税所得 200 万超の既定値）。
   均等割 5,000 + 森林環境税 1,000 → 年額 = 256,000 − 2,500 + 6,000 = 259,500
3. 月額 = 259,500 / 12 = 21,625 → 7〜5 月は 100 円未満を切り捨てて 21,600、6 月に端数を寄せて
   259,500 − 21,600 × 11 = 21,900
4. 現在の `jyuuminzei` が 19,800 → 「2027 年 6 月から月 ¥21,600（+¥1,800）」
5. 「6 月以降に反映」→ `saveSalaryMonth('2027-06', …jyuuminzei: 21900)` と `2027-07` に 21,600 を書く。
   7 月以降は既存の引き継ぎ（#172）に任せる。既に保存済みの 8 月以降があれば同じ値で上書きし、件数を Snackbar に出す
6. 6 月の給与明細 PDF（`resident`）が入ったら「実際 ¥21,700（誤差 +¥100）」を同じカードに出す
7. 表示期間: 源泉徴収票 Y が入った日〜 (Y+1) 年 6 月末。源泉徴収票が無ければカードを出さない

### 計算（`utils/residentTax.js` 新設）
```ts
estimateResidentTax(withholding): {
  taxableIncome, incomeLevy, adjustment, perCapita, annual, june, monthly
}
residentTaxPreview(now): { year, from: 'YYYY-06', current, next, diff, actual? } | null
```
- 定数（`taxTables.js`）: 基礎控除の差 50,000、所得割 10%、調整控除 2,500（課税所得 > 200 万）/
  人的控除差 × 5%（≤ 200 万。人的控除差は基礎控除分 50,000 のみを既定とし、扶養は非目標）、
  均等割 5,000、森林環境税 1,000（2024 年度〜）。**自治体の HP で照合**（均等割の超過課税がある自治体は
  設定 `cc_tax_profile.perCapitaExtra` で足せるようにする）

### 画面
- 給与タブ、控除項目カード（`sal.deduction`）の直前に `sal.residentTax` 「6 月からの住民税」
- 1 行目に結論、2 行目に根拠（課税所得と年額）、ボタン「6 月以降に反映」。反映済みなら「反映済み」

### テスト
`residentTax.test.js` に 1〜5 を固定（端数の寄せ方を境界で 1 件足す: 年額 100 で割り切れる場合）。

### 触るファイル
`utils/taxTables.js` / `utils/residentTax.js`（新）/ `components/ResidentTaxCard.jsx`（新）/
`tabs/SalarySimulation.jsx` / `utils/cardVisibility.js` / `doc/storage.md`（`cc_tax_profile`）

### 非目標
ふるさと納税・住宅ローン控除の反映（次年度の住民税を下げる方向。F5 で寄付額が分かれば
「寄付分 −¥x」を **表示だけ** 足す。計算の本体は変えない）、普通徴収。

### 見積
1 日。

---

## 7. F5 ふるさと納税の上限目安と年内の残り

### 目的
控除上限は年収・社保・扶養で決まり、**年内に使い切らないと消える**。給与タブが年収見込みを持ち、
家計タブが寄付の記録を持つのに、上限も残りも出していない。

### 受け入れ条件
1. 今年の支給額（`salaryMonthFor` 1〜12 月の `totalPay`。実績優先）合計 5,640,000 + 賞与実績（`actualBonusesFor`）
   1,200,000 → 年収 6,840,000
2. 給与所得控除 = 6,840,000 × 10% + 1,100,000 = 1,784,000 → 給与所得 5,056,000
3. 社保 = 各月の health + pension + employment の合計（実績優先）= 980,000。
   基礎控除（所得税）480,000、その他控除（`cc_tax_profile.otherDeductions`、既定 0）→ 所得税の課税所得 3,596,000 → 税率 20%
4. 住民税所得割 = (5,056,000 − 980,000 − 430,000) × 10% = 364,600
5. 上限目安 = 364,600 × 20% ÷ (90% − 20% × 1.021) + 2,000 = 72,920 ÷ 0.6958 + 2,000 ≈ 106,800（100 円未満切り捨て）
6. 寄付済み = 今年の変動費で `category === 'ふるさと納税'` または支払先・項目名が `/ふるさと|さとふる|ふるなび|ふるさとチョイス/`
   に当たるものの合計（`signedAmount`）。60,000 → 「残り ¥46,800・12/31 まで 97 日」
7. 見込みの月が 3 ヶ月以上含まれる → 「目安（見込み月 3）」と添える。1〜3 月は前年の源泉徴収票が
   あればそれで出し、「前年の実績で計算」と添える
8. 上限を超えている → 残りを 0 とし、超過分を `text.secondary` で「上限超過 ¥x（自己負担）」

### 計算（`utils/furusato.js` 新設）
```ts
furusatoLimit(year, now): { income, salaryIncome, social, taxable, rate, residentLevy, limit, simMonths }
furusatoStatus(year, now): { limit, donated, remaining, daysLeft, basis: 'thisYear'|'lastYear' }
```
- 給与所得控除・所得税率の階段は `taxTables.js` に年度付きで置く。**2025 年改正（給与所得控除の最低額・
  基礎控除の引き上げ）を国税庁の表で照合**してから固定する
- 寄付判定 `isFurusatoDonation(item)` は `furusato.js` に置き、家計タブの分析からは除外しない（支出には数える）

### 画面
- 家計タブ、年次の振り返り（`kk.yearlyReview`）の直後に `kk.furusato` 「ふるさと納税」。通年表示、
  10〜12 月は見出しに残り日数を出す
- 上段: 上限目安 / 寄付済み / 残り。下段 1 行: 根拠（年収・社保・見込み月数）

### テスト
`furusato.test.js` に 1〜8 を固定。税率の境界（1,950,000 / 3,300,000 / 6,950,000）を 1 件ずつ。

### 触るファイル
`utils/taxTables.js` / `utils/furusato.js`（新）/ `components/FurusatoCard.jsx`（新）/ `tabs/Kakeibo.jsx` /
`utils/cardVisibility.js` / `doc/storage.md`（`cc_tax_profile.otherDeductions`）

### 非目標
ワンストップ特例か確定申告かの判定、医療費控除・iDeCo の入力画面（`otherDeductions` に手で足す）、
返礼品の管理。

### 見積
1 日。

---

## 8. 新しい保存キー（`doc/storage.md` に転記する）

| キー | 型 | 内容 | 機能 |
|------|---|------|------|
| `cc_cards[].accountId` | `string?` | カードの引き落とし口座（`cc_accounts` の id） | F3 |
| `cc_accounts[].updatedAt` | `string?` | 残高を最後に変えた時刻（ISO） | F3 |
| `cc_ic_balance_{cardId}` | `{ balance: number, at: string }` | 交通系 IC の今の残高（未記録額の計算に使う） | F4 |
| `cc_tax_profile` | `{ otherDeductions?: number, perCapitaExtra?: number }` | 税の概算に使う本人設定 | F2・F5 |

## 9. 照合してから固定する法令定数（`utils/taxTables.js`）

| 定数 | 下書きの値 | 照合先 |
|------|-----------|--------|
| 健保 標準報酬月額 50 等級の区分 | 1: 58,000（〜63,000）… 4: 88,000（83,000〜93,000）… 35: 650,000（635,000〜665,000）… 50: 1,390,000（1,355,000〜） | 協会けんぽ 保険料額表 |
| 厚年 等級 | 健保 4〜35 = 厚年 1〜32、料率 18.3%（折半 9.15%） | 日本年金機構 |
| 住民税 | 所得割 10%、均等割 5,000、森林環境税 1,000、調整控除 2,500（課税所得 > 200 万）、基礎控除の差 50,000 | 居住自治体の HP |
| 給与所得控除 | 〜1,625,000: 550,000 / 〜1,800,000: 40%−100,000 / 〜3,600,000: 30%+80,000 / 〜6,600,000: 20%+440,000 / 〜8,500,000: 10%+1,100,000 / 超: 1,950,000 | 国税庁（2025 年改正の反映を確認） |
| 所得税率 | 〜1,950,000: 5% / 〜3,300,000: 10% / 〜6,950,000: 20% / 〜9,000,000: 23% / 〜18,000,000: 33% / 〜40,000,000: 40% / 超: 45% | 国税庁 |
| 基礎控除 | 所得税 480,000 / 住民税 430,000（2025 年改正で所得税側が変わる） | 国税庁 |
| ふるさと納税上限 | 住民税所得割 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000 | 総務省ポータル |
