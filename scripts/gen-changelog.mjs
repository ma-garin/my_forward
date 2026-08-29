/**
 * 変更履歴を git の履歴から、ビルドごとに作る。
 *
 * 以前はアプリ情報の画面に配列を手書きしていた。「何が入ったか」という事実が
 * コミット履歴と手書きの配列の 2 箇所にあり、履歴は 1.4 で止まっていた。
 * 出どころをコミットの 1 行目だけにする。
 *
 * 区切りは「月」ではなく「ビルド」。配布物は android-<番号> のタグ付き
 * リリースなので、タグとタグの間のコミットが、そのビルドに入った変更そのもの。
 * 月でまとめると「今入っている APK に何が入っているか」が読めない。
 *
 *   node scripts/gen-changelog.mjs
 *
 * まだタグの付いていないコミット（いま作っているビルド）は、CI が渡す
 * VITE_BUILD_NUMBER の番号で載せる。番号が無い手元ビルドでは「次のビルド」。
 * タグも履歴も取れない環境では、前に作ったものをそのまま残す。
 */
import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'

const OUT = 'src/changelog.json'

// 使うのは利用者に関係のある種類だけ。chore / docs / test / ci は出さない
const KINDS = { feat: '追加', fix: '修正', perf: '改善' }
const SUBJECT = /^(feat|fix|perf)(?:\([^)]*\))?:\s*(.+)$/

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** 範囲のコミットを履歴の項目にする（squash の (#123) は読む人に関係がない） */
function itemsIn(range) {
  const log = git(`log --no-merges --pretty=%s ${range}`)
  if (!log) return []
  const items = []
  for (const subject of log.split('\n')) {
    const m = SUBJECT.exec(subject)
    if (!m) continue
    const text = m[2].replace(/\s*\(#\d+\)\s*$/, '').trim()
    if (!text) continue
    if (!items.some((i) => i.text === text)) items.push({ kind: KINDS[m[1]], text })
  }
  return items
}

const dateOf = (ref) => git(`log -1 --format=%ad --date=short ${ref}`) ?? ''

function build() {
  const raw = git(`tag --list 'android-*'`)
  const tags = (raw ? raw.split('\n') : [])
    .map((t) => ({ tag: t, n: Number(t.replace('android-', '')) }))
    .filter((t) => Number.isFinite(t.n))
    .sort((a, b) => a.n - b.n)
  if (tags.length === 0) return null

  const entries = []

  // タグより新しいコミット＝いま作っているビルド
  const pendingNumber = process.env.VITE_BUILD_NUMBER
  const pending = itemsIn(`${tags[tags.length - 1].tag}..HEAD`)
  if (pending.length > 0) {
    entries.push({
      label: pendingNumber ? `ビルド ${pendingNumber}` : '次のビルド',
      date: dateOf('HEAD'),
      items: pending,
    })
  }

  // タグとタグの間 = そのビルドに入った変更
  for (let i = tags.length - 1; i >= 1; i--) {
    const items = itemsIn(`${tags[i - 1].tag}..${tags[i].tag}`)
    if (items.length === 0) continue // 中身の無いビルド（署名や CI の直しだけ）は出さない
    entries.push({ label: `ビルド ${tags[i].n}`, date: dateOf(tags[i].tag), items })
  }

  // いちばん古いタグまで（ビルド番号を振る前の分をまとめる）
  const first = itemsIn(tags[0].tag)
  if (first.length > 0) {
    entries.push({ label: `〜ビルド ${tags[0].n}`, date: dateOf(tags[0].tag), items: first })
  }

  return entries
}

const entries = build()

if (!entries || entries.length === 0) {
  if (existsSync(OUT)) {
    console.warn('git のタグか履歴が読めないため、変更履歴は前回のものを残します')
    process.exit(0)
  }
  writeFileSync(OUT, '[]\n')
  console.warn('git の履歴が読めず、変更履歴もありません。空で作ります')
  process.exit(0)
}

writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`)
console.log(`変更履歴: ${entries.length} ビルドぶん / ${entries.reduce((s, e) => s + e.items.length, 0)} 件`)
