const REPO = 'ma-garin/my_forward'

const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

/** 常に最新版を指す。外部リンクなのでシステムブラウザが開いてダウンロードする */
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
