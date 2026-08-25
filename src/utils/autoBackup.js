import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { createExportData, getAllKeys, isBackupKey, restoreExportData } from './backup'

/**
 * 自動バックアップ。
 *
 * データは localStorage にしか無く、WebView のストレージが整理されると消える。
 * 手で書き出す運用だと「消えてから気づく」ので、定期的にアプリ内へ控えを取る。
 *
 * これは端末内の控えなので、端末ごと失う事故には効かない。端末の外へ出すのは
 * 従来どおり データ管理 → 一括エクスポート（共有シート）の役目。
 */

const DIR = Directory.Data
const FOLDER = 'backups'
const PREFIX = 'myforward_auto_'
const KEEP = 5                       // 残す世代数
const INTERVAL_DAYS = 7
const LAST_RUN_KEY = 'cc_auto_backup_at'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const isAutoBackupAvailable = () => Capacitor.isNativePlatform()

const pad = (n) => String(n).padStart(2, '0')

export function backupFileName(date) {
  return `${PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/** 前回から INTERVAL_DAYS 経ったか。まだ一度も取っていなければ取る */
export function isDue(now, lastRunAt) {
  if (!lastRunAt) return true
  const last = new Date(lastRunAt).getTime()
  if (!Number.isFinite(last)) return true
  return now.getTime() - last >= INTERVAL_DAYS * MS_PER_DAY
}

/** 新しい順に並べ、KEEP 世代を超えたぶんの名前を返す */
export function pickStale(names, keep = KEEP) {
  return names
    .filter((n) => n.startsWith(PREFIX))
    .sort()
    .reverse()
    .slice(keep)
}

function loadLastRunAt() {
  try {
    return localStorage.getItem(LAST_RUN_KEY)
  } catch {
    return null
  }
}

function saveLastRunAt(iso) {
  try {
    localStorage.setItem(LAST_RUN_KEY, iso)
  } catch {
    // 控えは取れているので、記録できなくても止めない（次回また取るだけ）
  }
}

async function ensureFolder() {
  try {
    await Filesystem.mkdir({ path: FOLDER, directory: DIR, recursive: true })
  } catch {
    // すでにあるときも例外になるので、ここは無視してよい
  }
}

/** 控えの一覧。新しい順 */
export async function listBackups() {
  if (!isAutoBackupAvailable()) return []
  try {
    const { files } = await Filesystem.readdir({ path: FOLDER, directory: DIR })
    return files
      .filter((f) => f.name.startsWith(PREFIX))
      .sort((a, b) => (a.name < b.name ? 1 : -1))
      .map((f) => ({ name: f.name, size: f.size ?? 0, mtime: f.mtime ?? 0 }))
  } catch {
    return []
  }
}

export async function readBackup(name) {
  const { data } = await Filesystem.readFile({
    path: `${FOLDER}/${name}`, directory: DIR, encoding: Encoding.UTF8,
  })
  return data
}

/** 控えから書き戻す。復元した件数を返す */
export async function restoreFromBackup(name) {
  return restoreExportData(JSON.parse(await readBackup(name)))
}

/**
 * 期限が来ていれば控えを取る。取ったらファイル名、取らなければ null。
 * @param {Date} now
 */
export async function runAutoBackup(now = new Date()) {
  if (!isAutoBackupAvailable()) return null
  if (!isDue(now, loadLastRunAt())) return null

  const keys = getAllKeys().filter(isBackupKey)
  if (keys.length === 0) return null   // 中身が無いときに空の控えで上書きしない

  const name = backupFileName(now)
  try {
    await ensureFolder()
    await Filesystem.writeFile({
      path: `${FOLDER}/${name}`,
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(createExportData(keys)),
    })
    saveLastRunAt(now.toISOString())

    const { files } = await Filesystem.readdir({ path: FOLDER, directory: DIR })
    await Promise.all(pickStale(files.map((f) => f.name)).map((stale) =>
      Filesystem.deleteFile({ path: `${FOLDER}/${stale}`, directory: DIR }).catch(() => {})))

    return name
  } catch {
    // 控えが取れなくても家計簿としては動くので、画面は止めない
    return null
  }
}

/** 家計のデータが 1 件も無いか。復元を勧めてよいかの判断に使う */
export function hasNoData() {
  return getAllKeys().filter(isBackupKey).length === 0
}
