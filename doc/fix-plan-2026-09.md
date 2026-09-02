# 修正プラン（2026-09 監査の対応）

`doc/audit-2026-09.md` の指摘を、**1 タスク＝1 セッションで完結する単位**に割った実行計画。
各タスクは「読むファイル・変える内容・確かめ方」が確定していて、設計判断を含まない。
判断が要るものは「§0 先に決めること」に切り出し、決まるまで着手しない。

## 使い方

1. `/clear` してからタスクを 1 つ選ぶ
2. 「読むファイル」だけを読む（大ファイルは Grep で行を特定してから Read）
3. 変更 → 「確かめ方」を実行 → コミット（1 タスク 1 コミット）
4. 依存が「なし」のタスクは並行してよい。同じファイルを触るものは順番に

各タスクの見積は「読む量」の目安。**M 以上は 1 タスク 1 セッション**にする。

---

## §0 先に決めること（着手前にユーザーが選ぶ）

コードを読めば分かる話ではなく、家計の見せ方をどうしたいかの選択。ここが決まらないと
P20 以降が書けない。

### D1. 生活費の二重計上をどう解く（監査 H1・最重要）

いま `expense = カード記録 + 固定費内訳 + 生活費予算` なので、食費・日用品をカードで
払うと記録と予算の両方で数えている。

| 案 | 式 | 長所 | 短所 |
|----|----|------|------|
| **A（推奨）残差** | `living = max(0, 予算 − その月の生活費カテゴリ実績)` | 月初は予算満額・月末は 0。常に「確定分＋これから出る分」になる | 月の途中で支出が伸びると expense が動かない（予算内なら） |
| B 実績のみ | `living = 0`（カード記録だけ見る） | いちばん単純・二重計上が構造的に起きない | 月初の見通しが立たない（使う前は支出 0 に見える） |
| C 予実を分ける | 予定列＝予算、実績列＝記録 | 2枚合計の予実テーブルの考え方と揃う | 収支サマリー・診断・年次にも「予定/実績」の 2 本立てが要る（波及が大きい） |

**推奨は A。** 生活費カテゴリは `LIVING_CATEGORIES`（生活費・食費・日用品）で既に定義済み、
`sumLiving` も揃っているので、`monthlyBalance` の中だけで閉じる。

### D2. 個人データの初期値（監査 M7）

`ccStorage.js:454-458` の `DEFAULT_SUMMARY_FIXED`（家賃 82,330 / 奨学金 13,262 /
都民共済 3,000）は開発者個人の値。新規ユーザー全員の固定費に乗る。

- **消す**（推奨・既存端末は `cc_summary_fixed` に保存済みなので影響なし）
- 残す

### D3. 賞与（監査 M5）

`bonusTakeHome` は保存の口だけあって入力 UI が無く、`getSalaryBonusTakeHome` はどこからも
呼ばれていない。

- **入力欄を足して収入に乗せる**（賞与月の収支が正しくなる。給与タブに欄 1 つ＋`takeHomeFor` への合算）
- 機能ごと外す（`bonusTakeHome` / `BONUS_CYCLE_KEY` / `getBonusCycleInfo` を削除。コードは減る）

### D4. 家計タブの月の意味（監査 M6）

いま見出しは暦月・中身は「暦月−1」の請求月。クレカタブは 15 日基準。

- **請求月に揃える**（`currentBillingYm` を使い、見出しも請求月）
- 現状維持（ただし architecture.md の記述を実態に直す）

### D5. 生活費の基準カード（監査 M8）

`'jcb'` 直書きが 4 箇所（上書きキー・週数・予算内訳・ウィジェット）。JCB を消すと
ウィジェット更新が全部止まる。

- **カード属性 `primary: true` を足して 1 枚だけ立てる**（設定で選べる）
- 「先頭の請求サイクルを持つカード」で自動決定（設定を増やさない）

### D6. Android の配布形態（監査 M27）

配布 APK が debug ビルド（`debuggable=true`）で `allowBackup="true"`。

- **release ビルドに切り替える**（同じ固定鍵で署名すれば上書きインストールは維持できる。要 CI 1 回）
- 現状維持（個人端末のみの利用なら許容）

> D6 を選ぶ場合、署名が変わると**既存アプリに上書きできず入れ直しになる**。
> 固定鍵（`ANDROID_KEYSTORE_BASE64`）を release にも使えば維持できるが、CI を回して
> `apksigner` の実測値で確認するまで確定しない。

---

## §1 判断不要・即着手できるもの

### P1. ローカル日付ヘルパの共通化 〈S〉 依存なし

**監査**: H5, L19（日付クリア）
**読む**: `src/utils/finance.js`（末尾のユーティリティ節）, `src/utils/parseCardNotification.js:62`,
`src/tabs/CreditCard.jsx:700-710`, `src/components/CCExpenseViews.jsx:255-270`

`new Date().toISOString().slice(0,10)` は UTC なので JST 0:00〜9:00 に前日が返る。

1. `finance.js` に追加（`ymStr` の隣）:
   ```js
   /** ローカル日付を YYYY-MM-DD で返す。toISOString は UTC なので使わない */
   export const toDateStr = (d = new Date()) =>
     `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
   ```
2. `CreditCard.jsx:704` の `todayStr` を `toDateStr()` に
3. `CCExpenseViews.jsx:264` の今日判定も `toDateStr()` に
4. `parseCardNotification.js:62` のローカル定義を削除し finance.js から import

**確かめ方**: `finance.test.js` に `toDateStr(new Date(2026, 8, 2, 0, 30))` が `'2026-09-02'`
を返すテスト（ローカル構築なので TZ 非依存）。`npm test` と `npx vite build`。

---

### P2. データ版数を独立モジュールに出す 〈S〉 依存なし・P3 の前提

**監査**: M4
**読む**: `src/utils/ccStorage.js:143-150`

`finance.js` は `ccStorage.js` に import されている（`ccStorage.js:1`）ので、逆向きに
import すると循環する。だから版数だけ切り出す。

1. `src/utils/dataVersion.js` を新規作成:
   ```js
   // 保存が起きるたびに増える版数。localStorage には書かない（App.jsx がタブの
   // 作り直し判定に使う）。ccStorage も finance も依存できるよう独立させる。
   let dataVersion = 0
   export const getDataVersion = () => dataVersion
   export const bumpDataVersion = () => { dataVersion += 1 }
   ```
2. `ccStorage.js` の該当 3 行を削除し、`import { getDataVersion, bumpDataVersion } from './dataVersion'`
   ＋ `export { getDataVersion, bumpDataVersion }` に置き換える

**重要**: `ccStorage` からの再エクスポートは必ず残す。**24 箇所**が `ccStorage` から
import している（`App.jsx` / `useWidget.js` / `useReminders.js` / `accounts.js` ほか）。

**確かめ方**: `npm test`（全 288 件が通ること）＋ `npx vite build`。

---

### P3. 給与とカテゴリの保存で版数を上げる 〈S〉 依存: P2

**監査**: M4
**読む**: `src/utils/finance.js:191-197, 412-414`, `src/tabs/Cashflow.jsx:323-327`

給与タブで手取りを変えても家計タブが古いまま。カテゴリを足しても他タブに出ない。

1. `finance.js` で `import { bumpDataVersion } from './dataVersion'`
2. `writeMonthlySalaryStore`（191-197）の末尾で `bumpDataVersion()`
3. `saveCategories`（412-414）の末尾で `bumpDataVersion()`
4. `saveBonusCycleSettings`（56-61）も同様
5. `Cashflow.jsx:323-327` の `storage` イベントリスナーを削除
   （同一ドキュメントでは発火しないので効いていない。タブ再構築で反映される）

**確かめ方**: `finance.test.js` に「`saveCategories` の前後で `getDataVersion()` が増える」
テスト。`npm test`。

---

### P4. 返金の扱いを signedAmount に統一 〈M〉 依存なし

**監査**: M1, M14
**読む**: `src/utils/finance.js:310-330`, `src/components/CategoryViews.jsx:50-58, 104-115`,
`src/utils/ccStorage.js:254-269`

返金の扱いがいま 4 通り（引く／除外／足す／除外）。カテゴリ別は**返金を支出として加算**、
生活費は**除外**（引かない）。

1. `CategoryViews.jsx:54` — `map[x.category] += x.amount` → `signedAmount(x)`
2. 同 `:108`, `:112`（`grandTotal` / `prevMap`）も同じく
3. `ccStorage.js` の `sumLiving`（254-259）— `.filter(x => x.sign !== 1)` を外し、
   `reduce((s, x) => s + signedAmount(x), 0)` に
4. 同 `sumLivingByCategory`（261-269）も同じく
5. `signedAmount` は `finance.js` から import（`ccStorage` は既に finance を読んでいる）

**注意**: `signedAmount` は振替を 0 にするので、生活費カテゴリの Suica チャージが
自動で外れる（これは正しい挙動）。

**確かめ方**: `src/utils/livingSummary.test.js` に返金・振替を含むケースを追加
（`sumLiving` に `{sign:1}` と `{transfer:true}` を混ぜて期待値を検証）。`npm test`。

---

### P5. 電卓の未確定演算が捨てられる 〈M〉 依存なし

**監査**: H4
**読む**: `src/tabs/CreditCard.jsx:425-445, 560-570, 612-620`,
`src/components/AmountField.jsx:155-170`

`1000 + 500` で確定せず保存すると 500 が保存される。`pressConfirm` は
`onConfirm(finalVal)` と正しく引数を渡しているが、受け側 `doSave` が引数を捨てて
`formRef.current`（コミット後の effect でしか更新されない）を読んでいる。

1. `doSave` を `useCallback((confirmedAmount) => { ... })` にし、
   `const a = parseAmount(confirmedAmount ?? f.amount)` にする
   （`f.amount` 以外のフィールドは formRef のままでよい）
2. **ヘッダーの保存ボタン（:566）は `onClick={doSave}` のままにしない。**
   `onClick` は第 1 引数に MouseEvent を渡すので `confirmedAmount` がイベントになる。
   `onClick={() => doSave()}` に変える
3. 保存に使う値は `f.amount` ではなく確定値になるので、`addToHistory` などの
   後続処理はそのままでよい

**確かめ方**: `npx vite build` ＋ `npm run preview`（`http://localhost:4173/my_forward/`）で
「1000 → + → 500 → 保存」が 1500 で入ることを目視。自動テストは無い（コンポーネント
テストの土台が無いため）。

---

### P6. 支払い元が 0 枚のときの白画面 〈S〉 依存なし

**監査**: H7
**読む**: `src/tabs/CreditCard.jsx:630-650, 940-950`, `src/settings/CardSettings.jsx:117-127`

1. `CreditCard.jsx` の `const card = CARDS[cardId]` の直後に早期 return:
   ```jsx
   if (!card) return (
     <Box sx={{ p: 4, textAlign: 'center' }}>
       <Typography variant="body2" color="text.secondary">
         支払い元がありません。設定 → カード設定 から追加してください。
       </Typography>
     </Box>
   )
   ```
   **hooks より後**に置くこと（`useState`/`useMemo` の呼び出し順を崩さない）
2. `CardSettings.jsx` の削除ボタンに `disabled={cards.length <= 1}`

**確かめ方**: `npx vite build`。preview で全カードを削除して白画面にならないこと。

---

### P7. 支出一覧の編集で振替フラグが落ちる 〈S〉 依存なし

**監査**: M2（の最小修正だけ。全面的な `upsert*` 移行は P21）
**読む**: `src/tabs/Cashflow.jsx:345-368`

Suica チャージを支出一覧から編集すると `transfer` が消えて支出に化け、二重計上になる。

`nextItem`（349-360）に足す:
```js
...(source.transfer ? { transfer: true } : {}),
```
`sign` の直後、同じ書き方で。コメントも `sign` と同じ趣旨で残す。

**確かめ方**: `npx vite build`。preview で振替行を編集 → 合計が変わらないこと。

---

### P8. 「暗号化バックアップ」の表示を実態に合わせる 〈S〉 依存なし

**監査**: M26
**読む**: `src/settings/SettingsMain.jsx:19`, `src/settings/AppInfo.jsx:18-24, 188-196`

実装は素の JSON（`backup.js`）。AES-256-GCM も WebCrypto も使っていない。

1. `SettingsMain.jsx:19` の sub を `'エクスポート・インポート・自動バックアップ'` に
2. `AppInfo.jsx:22` の `{ label: 'WebCrypto API', ... }` を配列から削除
3. `AppInfo.jsx:190-195` のブロックを実態に:
   見出し「端末内の自動バックアップ」／本文「週に 1 回、端末内に控えを取ります（新しい 5 件）。
   端末ごと失う事故には効かないので、一括エクスポートも併用してください。」
   アイコンは `LockIcon` → `BackupIcon`（`@mui/icons-material/Backup`）

**確かめ方**: `npx vite build`。

---

### P9. ドキュメントを実態に合わせる 〈S〉 依存なし

**監査**: L17
**読む**: `README.md`, `doc/storage.md`, `doc/architecture.md`, `.kiro/steering/product.md`

1. `README.md` — 「外観 | テーマ切替（Apple 風 / 現行）」→「ライト / ダーク / 端末に合わせる」。
   技術情報の「Inter Variable / Noto Sans JP（同梱）」→ `Noto Sans JP（同梱）` のみ
   （Inter は同梱していない。`main.jsx` が読むのは Noto だけ）。
   「JCB と VISA の支出を」→「支払い元ごとの支出を」
2. `doc/storage.md` — `cc_hidden_cards` の行が 2 回ある。下（説明が詳しい方）を残して上を削除
3. `doc/architecture.md` — 「画面のカードは 設定 → 表示するカード で…」の段落が 2 回ある。
   後ろ（支払い元の説明を含む方）を残す
4. `doc/architecture.md` — 「外したときは編集ダイアログの「振替」で直せる」に
   「（受信箱から登録した行はリストで開いて直す）」を補う。P22 で直すまでの現状記述
5. `.kiro/steering/product.md` — 「3タブ構成」→「4タブ構成」、支出一覧タブを追加、
   「（JCB / SMBC）」→「（支払い元は設定で増やせる）」

**確かめ方**: 目視。ビルドには影響しない。

---

### P10. フックの誤検知を直す 〈S〉 依存なし

**監査**: L27
**読む**: `.claude/hooks/validate-command.sh:30-34`

`(printenv|env\b|set\b).*\|` が `asset` / `reset` / `offset` の語尾にも当たる。
ブランチ名 `claude/system-asset-scan-…` を含むコマンドがパイプを持つだけでブロックされる。

```bash
if echo "$COMMAND" | grep -qE '\b(printenv|env|set)\b[^|]*\|'; then
```

**確かめ方**:
```bash
echo 'git push -u origin claude/system-asset-scan-x && echo ok' | grep -qE '\b(printenv|env|set)\b[^|]*\|' ; echo "asset(通るべき)=$?"
echo 'printenv | grep KEY' | grep -qE '\b(printenv|env|set)\b[^|]*\|' ; echo "printenv(止まるべき)=$?"
```
前者が 1、後者が 0 になること。

---

### P11. ESLint のエラーを減らす 〈M〉 依存なし

**監査**: L16
**読む**: `eslint.config.js`, および `npx eslint .` の出力

23 エラーのうち、機能に関わらないものだけ片づける。**触らないもの**を先に確認する:

- `SalarySimulation.jsx:433` `handleBonusCycleChange` — D3 の判断待ち。**残す**
- `AmountField.jsx:199` `autoFocus` — 未実装の props。P17 で実装するので**残す**
- `CategoryViews.jsx:29` `angle` の再代入 — レンダー中のローカル変数で実害なし。
  `data.reduce` で累積角を作る形に直せば消えるが、描画の検証が要る。**別タスク**

片づけるもの:
1. `SalaryHistory.jsx:388` `barData` — 未使用なので削除
2. `SalaryHistory.jsx:610` の `(y, i, arr)` → `(y)`
3. `SalarySimulation.jsx:17` `calcTotalPay` / `:30` `ymLabel` / `:338` `bonusMonth` /
   `:363` `unitR` — 未使用なので削除（`calcTotalPay` は import だけ外す。
   `calcAllOvertime` は使っているので消さない）
4. `BudgetBreakdown.jsx:57` `subLabel` — 分割代入から外す
5. `ccStorage.js:201, 524, 532` の空 catch → `catch { /* 読めなくても既定値で動く */ }`
6. `eslint.config.js` に node 用の設定を足す:
   ```js
   { files: ['vite.config.js', 'scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
   ```
7. `LivingExpenseCard.jsx:156` の全角空白を半角に

**確かめ方**: `npx eslint .` のエラー数が減っていること（**増えていない**だけでなく減る）。
`npm test` と `npx vite build`。

---

## §2 局所的だが仕様の理解が要るもの

### P12. 復元の安全網を直す 〈M〉 依存なし

**監査**: H3（最重要のひとつ）
**読む**: `src/utils/autoBackup.js:103-135`, `src/utils/backup.js:10-17`,
`src/utils/useAutoBackup.js:14-31`, `src/utils/autoBackup.test.js:60-72`,
`src/utils/ccStorage.js:88-108, 150`

`ccStorage.js:150` がモジュール読込時に `applyCards(loadCards())` を呼び、その中で
`cc_cards` と `cc_cards_seeded_v2` を必ず書く。だから `hasNoData()`（`isBackupKey` に
当たるキーが 0 件か）は**常に false**。データが全部消えても復元提案が出ず、
`runAutoBackup` の空判定も通らないので、2 キーだけの控えを書いて 5 世代の最古を消す。

1. `autoBackup.js` の `hasNoData` を「実データの有無」に変える:
   ```js
   /**
    * 家計のデータが 1 件も無いか。
    *
    * キーの有無では見ない。ccStorage は読み込まれた時点で cc_cards を書くので、
    * データが全部消えていてもキーは 2 つ残る（それで復元提案が出なかった）。
    * 中身のある記録があるかで見る。
    */
   const DATA_PREFIXES = ['cc_fixed_', 'cc_var_', 'salary_base_', 'salary_extra_']
   const DATA_KEYS = ['salary_simulation', 'salary_simulation_monthly',
     'cc_summary_fixed', 'cc_accounts', 'cc_salary_override_by_ym']

   export function hasNoData() {
     const hasContent = (k) => {
       const v = localStorage.getItem(k)
       return !!v && v !== '[]' && v !== '{}' && v !== 'null'
     }
     return !getAllKeys().some((k) =>
       (DATA_PREFIXES.some((p) => k.startsWith(p)) || DATA_KEYS.includes(k)) && hasContent(k))
   }
   ```
2. `runAutoBackup`（107-108）の空判定も `if (hasNoData()) return null` に変える
   （いまの `keys.length === 0` は同じ理由で通らない）

**確かめ方**: `autoBackup.test.js` を直す。**先頭で `import './ccStorage'` する**
（これが無いと現実と違う状態でテストが通ってしまう。今がその状態）。
- `cc_cards` だけある状態で `hasNoData() === true`
- `cc_var_jcb_2026-08` に `[{...}]` を入れると `false`
- `cc_var_jcb_2026-08` が `'[]'` なら `true`

---

### P13. 変動費の請求月を保存時に必ず計算する 〈M〉 依存なし

**監査**: H6
**読む**: `src/utils/ccStorage.js:384-402`, `src/tabs/CreditCard.jsx:772-800`,
`src/utils/cards.test.js`

見出しの＋から追加・編集すると、日付が別サイクルでもカードが同じなら表示中の `ym` に
入る。FAB 経由は日付から決めるので、経路で結果が食い違う。

`upsertVarItem` を書き換える:
```js
export function upsertVarItem({ item, fromCard, fromYm, toCard = fromCard }) {
  const list = loadVar(fromCard, fromYm)
  // 請求月は日付とカードから決まる。カードが同じでも、日付が締め日をまたげば
  // 別の月になる（＝画面が開いている月に入れてはいけない）
  const toYm = billingYmForCard(item.date, toCard, fromYm)

  if (toCard === fromCard && toYm === fromYm) {
    const next = (list.some(x => x.id === item.id)
      ? list.map(x => x.id === item.id ? item : x)
      : [...list, item]).sort(byDate)
    saveVar(fromCard, fromYm, next)
    return { ym: fromYm, list: next }
  }

  saveVar(fromCard, fromYm, list.filter(x => x.id !== item.id))
  const next = [...loadVar(toCard, toYm), item].sort(byDate)
  saveVar(toCard, toYm, next)
  return { ym: toYm, list: next }
}
```

呼び出し側 `saveVarItem`（`CreditCard.jsx:772-777`）は既に
`if (target === cardId && toYm === ym)` を見ているので**変更不要**。

**確かめ方**: `src/utils/upsert.test.js` を新規作成:
- JCB（締め 15）で `fromYm='2026-07'` の行を `date='2026-08-20'` に編集 → 戻り値の
  `ym === '2026-08'`、`cc_var_jcb_2026-07` から消えて `cc_var_jcb_2026-08` に入る
- 同じ月内の編集では移動しない
- カード移動（JCB → VISA）で締め日の違いが反映される

---

### P14. タブに戻ったとき表示月がリセットされる 〈M〉 依存なし

**監査**: M15
**読む**: `src/App.jsx:97-138`, `src/utils/inbox.js:85-92`, `src/utils/useInbox.js:22-33`

`seenVersion` は「そのタブを最後に描画したときの版数」だが、表示中のタブが自分で保存
しても更新されない。だから他タブへ行って戻るだけで作り直され、表示月・スクロール・
展開状態・選択カードが初期化される。アプリ版は復帰のたびに `ingestNotifications` が
追加 0 件でも `saveInbox` を呼ぶので、他アプリから戻るたびに起きる。

1. `App.jsx` の `handleTabChange` で、**離れるタブの版数を現在値に追随させてから**
   移動先を判定する:
   ```js
   const handleTabChange = useCallback((_, v) => {
     // 出るタブが自分で保存したぶんは、そのタブの state に既に入っている。
     // 追随させないと、戻ったときに毎回作り直されて表示月が初期化される
     seenVersion.current[activeTab] = getDataVersion()
     setActiveTab(v)
     setMounted(prev => prev[v] ? prev : prev.map((m, i) => i === v ? true : m))
     refreshTabIfChanged(v)
     window.scrollTo(0, 0)
   }, [activeTab, refreshTabIfChanged])
   ```
   `closeSettings` / `onPop` の `refreshTabIfChanged(activeTab)` は**そのまま**
   （設定での変更は反映させたい）
2. `inbox.js:90` — `if (added.length || drafts.length)` を `if (added.length)` に
   （追加が無いのに保存すると版数だけ上がる）

**注意**: 「タブ B で保存 → タブ A へ」でタブ A が作り直されることは維持する。
上の変更は「出るタブ自身の保存」だけを対象にしている。

**確かめ方**: `npx vite build` ＋ preview。クレカタブで月を戻す → 家計タブ → クレカタブ
に戻って月が保たれること。家計タブで固定費を編集 → クレカタブで数字が更新されること。

---

### P15. 給与の読み取り時複製をやめる 〈L〉 依存: D3 の判断（賞与に触るため）

**監査**: H2
**読む**: `src/utils/finance.js:208-250`, `src/utils/monthly.js:76-98`,
`src/tabs/SalarySimulation.jsx:321-360`, `src/settings/SalarySettings.jsx:110-131`

`loadSalaryMonth` が読むだけで前月を複製保存する。年次振り返りが 1〜12 月を読むと
未来月まで材料化され、`empty` 除外が効かず貯蓄率が上振れる。さらに一度材料化された月は
以後複製されないので、給与設定（当月しか書かない）の変更が翌月以降に引き継がれない。

1. `finance.js:226-232` の前月複製ブロックから**保存を外す**（値は返すが書かない）:
   ```js
   const prevYm = addMonth(ym, -1)
   if (store.months[prevYm]) {
     // 前月の設定を引き継いで見せるが、保存はしない。
     // 読むだけで書くと、年次が 12 ヶ月を読んだだけで未来月が「記録あり」になる
     return { ...normalizeSalaryMonth(store.months[prevYm]), bonusTakeHome: '' }
   }
   ```
2. `monthly.js:81` の `empty` 判定を「記録の有無」に変える。
   `takeHomeFor` の `isActual`（実績が入力されているか）と `cards` を見る:
   ```js
   months.push({ ym, month: m, ...b, empty: !b.isActual && b.cards === 0 && b.other === 0 })
   ```
   見込み手取り（シミュレーション）だけの月は「まだ来ていない月」として除外される
3. `SalarySimulation.jsx` の `loadYm` は変更不要（返り値をそのまま state に入れており、
   保存は編集時の `save(...)` で起きる）

**副作用の確認**: 給与タブで月を移動しただけでは保存されなくなる。編集すれば保存される
（`editFixed` / `handleOvertimeChange` が `save` を呼ぶ）。これは意図どおり。

**確かめ方**: `monthly.test.js` に「見込みだけの未来月が `empty` になる」テスト。
`finance.test.js` に「`loadSalaryMonth` を呼んでも `salary_simulation_monthly` の
`months` にキーが増えない」テスト。`npm test`。

---

## §3 判断が決まってから着手するもの

### P20. 生活費の二重計上を直す 〈L〉 依存: **D1**・P4

**監査**: H1
**読む**: `src/utils/monthly.js` 全体, `src/components/CombinedSummary.jsx:39-56`,
`src/utils/ccStorage.js`（`sumLiving`, `LIVING_CATEGORIES`）, `src/utils/monthly.test.js`

D1 で **案 A（残差）** を選んだ場合の手順:

1. `monthly.js` に「その月の生活費実績」を足す:
   ```js
   /** その請求月に既に使った生活費（全カード・生活費カテゴリ） */
   function livingSpentFor(ym) {
     return CARD_LIST.reduce((s, c) => s + sumLiving(loadVar(c.id, ym)), 0)
   }
   ```
   `sumLiving` と `loadVar` を `ccStorage` から import
2. `monthlyBalance` の `living` を残差に:
   ```js
   // 生活費は「予算」だが、既に使った分はカード記録に入っている。
   // 予算をそのまま足すと同じ支出を 2 回数える（記録と予算の両方で）。
   // これから出ていく残りだけを足す。
   const budget = livingBudgetFor(ym)
   const living = Math.max(0, budget - livingSpentFor(ym))
   ```
   戻り値に `livingBudget: budget` と `livingSpent` も足す（画面が内訳を出せるように）
3. `CombinedSummary.jsx:53` — 固定費内訳の「生活費（N週 × 単価）」の表示は
   **予算のまま**（`balanceOf.livingBudget`）。ただし残りが分かるよう
   `¥{fmt(livingBudget)}（残り ¥{fmt(living)}）` にする
4. `fixedTotal`（:55）は `fixedItemsTotal + living`（残差）に。予実テーブルの
   「残高」が二重計上でなくなる

**波及先の確認**（すべて `monthlyBalance` 経由なので自動で直る。数字が変わることを確認）:
`IncomeSummaryCard` / `CombinedSummary` / `YearlyReviewCard` / `diagnosis.js`（貯蓄率・
固定費比率・黒字継続）

**確かめ方**: `monthly.test.js` に:
- 予算 40,000・生活費実績 0 → `living === 40000`
- 実績 15,000 → `living === 25000`、`expense` に 15,000 が二重で入らない
- 実績 50,000（予算超過）→ `living === 0`、`expense` は記録の 50,000 のみ

---

### P21. 支出一覧タブを共通部品に寄せる 〈L〉 依存: P13

**監査**: M2, M3, L4
**読む**: `src/tabs/Cashflow.jsx` 全体, `src/components/ExpenseDialog.jsx`,
`src/components/CCExpenseViews.jsx`, `src/utils/ccStorage.js`（`upsert*`）

いま独自の行・編集ダイアログ・移動処理を持っていて、振替が落ちる（P7 で応急処置済み）・
価格変更が記録されない・引き落とし済みが追随しない・繰り返しを編集できない。

1. `ExpenseEditDialog`（219-309）を削除し `ExpenseDialog` を使う
   （`isFixed` / `cardId` / `categories` / `initial` を渡す）
2. `handleSaveVar` / `handleSaveFixed`（344-393）を `upsertVarItem` / `upsertFixedItem` に
   置き換える。`_type` / `sourceYm` の受け渡しは `CategoryViews.jsx:144-158` が手本
3. `dateFromYmDay` が null を返す固定費（支払日なし）を落としている（93-96）。
   月初（`${ym}-01`）に置いて行を出す
4. 既定カード `'jcb'`（221, 231）→ `CARD_LIST[0]?.id`
5. 見出し「JCB/VISA 支出明細」（434）→「支出明細」

**確かめ方**: `npx vite build` ＋ preview。振替行・返金行・繰り返し固定費を編集して
クレカタブの合計と一致すること。`npm test`。

---

### P22. 受信箱の登録経路を揃える 〈M〉 依存: P13

**監査**: M10, M11, L20
**読む**: `src/utils/inbox.js:110-139`, `src/utils/duplicates.js`,
`src/components/InboxCard.jsx:60-95`, `src/utils/inbox.test.js`

1. `acceptDraft` の保存（137）を `upsertVarItem({ item, fromCard: cardId, fromYm: ym })`
   に変える（日付順に入り、請求月も正しくなる）
2. 同関数で `findDuplicate(item, loadVar(cardId, ym))` を呼び、結果を戻り値に足す
   （`{ item, cardId, ym, duplicate }`）。`useInbox.accept` はそのまま透過
3. `CreditCard.jsx` の受信箱の accept ハンドラで `duplicate` があれば
   `notify('warning', duplicateMessage(dup))`
4. `inbox.js:133` の振替判定 — `overrides.transfer ?? looksLikeTransfer(...)` は
   `transfer: false` を明示しても自動判定に落ちる。`'transfer' in overrides` で
   明示値を優先する
5. `InboxCard.jsx:87` の行タップの既定カテゴリを `'その他'` に（「登録」ボタンと揃える）

**確かめ方**: `inbox.test.js` に「同じ日・同額の既存行があると `duplicate` が返る」
「`transfer: false` を渡すと Suica でも振替にならない」を追加。`npm test`。

---

### P23. 個人データの初期値を外す 〈S〉 依存: **D2**

**監査**: M7
**読む**: `src/utils/ccStorage.js:454-465`, `src/components/CombinedSummary.jsx:49, 230`

D2 で「消す」を選んだ場合:
1. `DEFAULT_SUMMARY_FIXED` を `[]` にする（配列ごと消さず、空にしてコメントを残す）
2. `CombinedSummary.jsx:230` の `{hasSalary && (固定費内訳)}` の条件を外す。
   給与が未入力でも固定費を足せるようにする（いまは消す口が無い）。
   `:186` の予実テーブルは給与が無いと意味がないので `hasSalary` のまま残す

**確かめ方**: `npx vite build`。既存端末は `cc_summary_fixed` に保存済みなので影響なし。

---

### P24. 賞与 〈M〉 依存: **D3**

**監査**: M5
「入力欄を足す」を選んだ場合: `SalarySimulation.jsx` の賞与月（5/6/11/12）に
`bonusTakeHome` の `AmountField` と `handleBonusCycleChange` のトグルを出し、
`income.js` の `takeHomeFor` に `getSalaryBonusTakeHome(ym)` を足す。
「外す」を選んだ場合: `bonusTakeHome` / `BONUS_CYCLE_KEY` / `getBonusCycleInfo` /
`isBonusMonth` / `getSalaryBonusTakeHome` と `SalarySimulation` の関連 state を削除。
`normalizeSalaryMonth` の `bonusTakeHome` も外す（既存データは無視されるだけ）。

### P25. 家計タブの月 〈M〉 依存: **D4**
### P26. 生活費の基準カード 〈M〉 依存: **D5**
### P27. Android の release ビルド 〈M〉 依存: **D6**

---

## §4 後回しでよいもの（低）

まとめて 1 タスクにしてよい。`doc/audit-2026-09.md` の L1〜L26 を参照。
先に片づける価値があるのは:

- **L6** `AmountField` の `autoFocus` 未実装（予算・週予算ダイアログでキーボードが出ない）
- **L5** 検索結果をタップしても開けない（検索の使い道が半分になっている）
- **L25** 口座削除に確認が無い
- **L1/L2** 死んだコードの削除（`prevBusinessDay` / `nextPayDay` / `CARD_CUTOFF_DAYS` /
  `getSalaryTakeHome`）— 触る前に `grep -rn` で参照が無いことを確認する
- **L15** `package-lock.json` の version が `0.0.0`（`npm install` のたびに差分が出る）

---

## 推奨する着手順

```
第1陣（判断不要・すぐ効く・衝突しない）
  P10 → P9 → P8 → P6 → P7 → P1
第2陣（土台）
  P2 → P3 → P11
第3陣（金額の正しさ）
  P12 → P13 → P4 → P5 → P14 → P15
第4陣（判断が出てから）
  P20（D1）→ P21 → P22 → P23（D2）→ P24（D3）→ P25〜P27
```

第1陣は 1 セッションで 2〜3 個まとめてよい。第3陣以降は 1 タスク 1 セッション。

## 共通の確認手順

```bash
npm test          # 288 件が通ること（減っていないこと）
npx eslint .      # エラーが増えていないこと（現状 23）
npx vite build    # ✓ built in X.XXs が出ること
```

画面の確認が要るタスクは `npm run preview` →
`http://localhost:4173/my_forward/`（末尾のパスを省くと 404）。

コミットは `feat:` / `fix:` / `refactor:` / `docs:` を使う（`doc/dev-workflow.md`）。
