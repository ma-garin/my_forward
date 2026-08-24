import { Capacitor, registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

const REPO = 'ma-garin/my_forward'

const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

/** 常に最新版を指す */
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/app-debug.apk`

export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

/**
 * このビルドの番号。CI が VITE_BUILD_NUMBER に GitHub の run_number を入れる。
 * 手元でビルドしたものには入らないので null になる。
 */
export function buildNumber() {
  const n = parseInt(import.meta.env.VITE_BUILD_NUMBER ?? '', 10)
  return Number.isFinite(n) ? n : null
}

// リリースのタグは android-<ビルド番号>（ワークフローが run_number で付ける）
function tagNumber(tag) {
  const m = /^android-(\d+)$/.exec(tag ?? '')
  return m ? parseInt(m[1], 10) : null
}

/**
 * 最新リリースを問い合わせて、今のビルドと比べる。
 * これはユーザーが明示的に押したときだけ走る唯一の外部通信で、家計データは送らない。
 */
export async function checkForUpdate() {
  let res
  try {
    res = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
  } catch {
    throw new Error('通信できませんでした。接続を確認してください')
  }
  if (!res.ok) throw new Error(`最新版を取得できませんでした（${res.status}）`)

  const data = await res.json()
  const latest = tagNumber(data.tag_name)
  const current = buildNumber()

  return {
    current,
    latest,
    tag: data.tag_name ?? '',
    publishedAt: data.published_at ?? '',
    // 番号が分からないときは「更新あり」と言い切らない
    hasUpdate: latest != null && current != null && latest > current,
    unknown: latest == null || current == null,
  }
}

// ─── 更新の取得とインストール（アプリ版のみ） ───

const AppUpdate = registerPlugin('AppUpdate')

const APK_FILE = 'my_forward-update.apk'

/** インストールまでアプリ内で完結できる環境か（Web 版では常に false） */
export const canSelfUpdate = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AppUpdate')

/** 「提供元不明のアプリ」の許可があるか */
export async function canInstall() {
  if (!canSelfUpdate()) return false
  try {
    const { granted } = await AppUpdate.canInstall()
    return !!granted
  } catch {
    return false
  }
}

/** 「提供元不明のアプリ」の許可画面を開く */
export async function openInstallSettings() {
  if (!canSelfUpdate()) return
  try {
    await AppUpdate.openInstallSettings()
  } catch {
    // 開けなくても画面の案内は残るので握りつぶす
  }
}

/**
 * APK を取得する。進捗は onProgress(0〜1) で返す。
 *
 * ダウンロードはネイティブ側で直接ファイルに書く（downloadFile）。
 * fetch でブリッジに載せると 13MB が base64 でメモリを通るため使わない。
 */
export async function downloadApk(onProgress) {
  if (!canSelfUpdate()) throw new Error('アプリ版でのみ更新できます')

  let handle
  if (onProgress) {
    handle = await Filesystem.addListener('progress', ({ bytes, contentLength }) => {
      if (contentLength > 0) onProgress(Math.min(1, bytes / contentLength))
    })
  }

  try {
    const { path } = await Filesystem.downloadFile({
      url: APK_URL,
      path: APK_FILE,
      directory: Directory.Cache,
      progress: true,
    })
    if (!path) throw new Error('ダウンロードに失敗しました')
    return path
  } catch (e) {
    throw new Error(`ダウンロードできませんでした: ${e?.message ?? ''}`)
  } finally {
    await handle?.remove()
  }
}

/**
 * 取得済みの APK をインストーラに渡す。
 * 実際に上書きするかはインストーラの画面でユーザーが決める（データは残る）。
 */
export async function installApk(path) {
  if (!canSelfUpdate()) throw new Error('アプリ版でのみ更新できます')
  await AppUpdate.install({ path })
}
