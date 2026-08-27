/**
 * 変更履歴を git の履歴から作る。
 *
 * 以前はアプリ情報の画面に配列を手書きしていた。「何が入ったか」という
 * 事実がコミット履歴と手書きの配列の 2 箇所にあり、コミット側だけ更新され
 * 続けて、履歴は 1.4（2026-05）で止まっていた。
 *
 * 出どころをコミットの 1 行目だけにする。ビルドのたびに作り直すので、
 * 書き忘れという状態が存在しなくなる。
 *
 *   node scripts/gen-changelog.mjs
 *
 * 履歴が取れない環境（浅いクローン）では、前に作ったものをそのまま残す。
 * 空で上書きすると、画面から履歴が消える。
 */
import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'

const OUT = 'src/changelog.json'

// 使うのは利用者に関係のある種類だけ。chore / docs / test / ci は出さない
const KINDS = {
  feat: '追加',
  fix: '修正',
  perf: '改善',
}

const SUBJECT = /^(feat|fix|perf)(?:\([^)]*\))?:\s*(.+)$/

function readLog() {
  try {
    return execSync('git log --no-merges --date=short --pretty=%ad%x09%s', {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function build() {
  const lines = readLog().split('\n').filter(Boolean)
  const months = new Map()

  for (const line of lines) {
    const [date, subject] = line.split('\t')
    const m = SUBJECT.exec(subject ?? '')
    if (!m) continue

    const ym = date.slice(0, 7)
    // squash マージで付く末尾の (#123) は読む人に関係がない
    const text = m[2].replace(/\s*\(#\d+\)\s*$/, '').trim()
    if (!text) continue

    if (!months.has(ym)) months.set(ym, [])
    const items = months.get(ym)
    // 同じ内容が複数回入っていたら 1 度だけ
    if (!items.some((i) => i.text === text)) {
      items.push({ kind: KINDS[m[1]], text })
    }
  }

  return [...months.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }))
}

const entries = build()

if (entries.length === 0) {
  if (existsSync(OUT)) {
    console.warn('git の履歴が読めないため、変更履歴は前回のものを残します')
    process.exit(0)
  }
  console.warn('git の履歴が読めず、変更履歴もありません。空で作ります')
}

writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`)
console.log(`変更履歴: ${entries.length} ヶ月ぶん / ${entries.reduce((s, e) => s + e.items.length, 0)} 件`)
