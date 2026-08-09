import { isActiveKey, getAllKeys, listActiveKeys, SYNC_PREFIX } from './appKeys'

const TOKEN_KEY = `${SYNC_PREFIX}gist_token`
const GIST_ID_KEY = `${SYNC_PREFIX}gist_id`
const LAST_SYNCED_KEY = `${SYNC_PREFIX}last_synced_at`
const LAST_REMOTE_KEY = `${SYNC_PREFIX}last_remote_exported_at`
const BACKUP_KEY = `${SYNC_PREFIX}backup_before_pull`

const GIST_FILENAME = 'my_forward_sync.json'
const GIST_MARKER = 'my_forward-sync-v1'

const API_BASE = 'https://api.github.com'
const SCHEMA_VERSION = 1
const APP_ID = 'my_forward'

export class GistSyncError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'GistSyncError'
    this.code = code
    this.status = status
  }
}

// ---- 同期メタデータ（端末固有・スナップショット対象外） ----

const read = (k) => localStorage.getItem(k) || ''
const write = (k, v) => { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k) }

export const loadToken = () => read(TOKEN_KEY)
export const saveToken = (v) => write(TOKEN_KEY, v)
export const loadGistId = () => read(GIST_ID_KEY)
export const saveGistId = (v) => write(GIST_ID_KEY, v)
export const loadLastSyncedAt = () => read(LAST_SYNCED_KEY)

function markSynced(exportedAt) {
  write(LAST_SYNCED_KEY, new Date().toISOString())
  write(LAST_REMOTE_KEY, exportedAt)
}

// ---- スナップショット ----

// 端末名の簡易ラベル。同期先の表示用のみに使う。
export function detectDevice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'その他'
}

// localStorage の値を生文字列のまま格納する（JSON.parse を通さないためロスレス）。
function buildSnapshot() {
  const data = {}
  listActiveKeys().forEach(k => {
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  })
  return {
    schema: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: new Date().toISOString(),
    device: detectDevice(),
    data,
  }
}

function validateSnapshot(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new GistSyncError('invalid_data', '同期データの形式が不正です')
  }
  if (obj.schema !== SCHEMA_VERSION || obj.app !== APP_ID) {
    throw new GistSyncError('invalid_data', 'このアプリの同期データではありません')
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new GistSyncError('invalid_data', '同期データの中身が不正です')
  }
  return obj
}

// 真のスナップショット適用: 受信データに無いキーは削除し、削除操作を他端末へ伝播させる。
// isActiveKey を通らないキーは読み書きともに無視する（sync_* や任意キーの注入を防ぐ）。
function applySnapshot(envelope) {
  const { data } = validateSnapshot(envelope)

  getAllKeys().forEach(k => {
    if (isActiveKey(k) && !(k in data)) localStorage.removeItem(k)
  })

  Object.entries(data).forEach(([k, v]) => {
    if (isActiveKey(k) && typeof v === 'string') localStorage.setItem(k, v)
  })
}

export function loadBackup() {
  const raw = read(BACKUP_KEY)
  if (!raw) return null
  try {
    return validateSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export function restoreBackup() {
  const snap = loadBackup()
  if (!snap) throw new GistSyncError('invalid_data', 'バックアップが見つかりません')
  applySnapshot(snap)
}

// ダウンロード適用。直前の状態を自動バックアップしてから上書きする。
export function applyPulledSnapshot(envelope) {
  write(BACKUP_KEY, JSON.stringify(buildSnapshot()))
  applySnapshot(envelope)
  markSynced(envelope.exportedAt)
}

// ---- GitHub Gist API ----

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
})

async function request(url, options) {
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new GistSyncError('network', 'ネットワークに接続できません。オフラインの可能性があります')
  }
  if (res.ok) return res

  if (res.status === 401) {
    throw new GistSyncError('unauthorized', 'トークンが無効です。再設定してください', 401)
  }
  if (res.status === 404) {
    throw new GistSyncError('not_found', 'Gist が見つかりません。Gist ID を確認してください', 404)
  }
  if (res.status === 403) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      throw new GistSyncError('rate_limited', 'GitHub API の制限に達しました。しばらく待ってから再試行してください', 403)
    }
    throw new GistSyncError('unauthorized', 'アクセスが拒否されました。トークンの権限（Gist）を確認してください', 403)
  }
  throw new GistSyncError('http', `通信エラーが発生しました（HTTP ${res.status}）`, res.status)
}

const gistBody = (envelope) => JSON.stringify({
  description: GIST_MARKER,
  public: false,
  files: { [GIST_FILENAME]: { content: JSON.stringify(envelope) } },
})

export async function fetchRemoteSnapshot(token, gistId) {
  const res = await request(`${API_BASE}/gists/${gistId}`, { headers: headers(token) })
  const gist = await res.json()
  const file = gist.files?.[GIST_FILENAME]
  if (!file) {
    throw new GistSyncError('not_found', 'Gist 内に同期ファイルがありません', 404)
  }

  let content = file.content
  if (file.truncated || content == null) {
    const rawRes = await request(file.raw_url, { headers: headers(token) })
    content = await rawRes.text()
  }

  try {
    return validateSnapshot(JSON.parse(content))
  } catch (e) {
    if (e instanceof GistSyncError) throw e
    throw new GistSyncError('invalid_data', '同期データの解析に失敗しました')
  }
}

// 既存の同期用 Gist を description / ファイル名で探す。見つからなければ null。
export async function findExistingGist(token) {
  const res = await request(`${API_BASE}/gists?per_page=100`, { headers: headers(token) })
  const list = await res.json()
  if (!Array.isArray(list)) return null
  const hit = list.find(g => g.description === GIST_MARKER || g.files?.[GIST_FILENAME])
  return hit ? hit.id : null
}

// 前回の同期以降に他端末がアップロードしていれば、そのスナップショットを返す（無ければ null）。
// リモート未作成・中身が不正なだけならアップロードは可能なので競合なしとして扱う。
export async function checkRemoteConflict(token, gistId) {
  if (!gistId) return null
  let remote
  try {
    remote = await fetchRemoteSnapshot(token, gistId)
  } catch (e) {
    const ignorable = e instanceof GistSyncError && (e.code === 'not_found' || e.code === 'invalid_data')
    if (ignorable) return null
    throw e
  }
  const lastRemote = read(LAST_REMOTE_KEY)
  return lastRemote && remote.exportedAt !== lastRemote ? remote : null
}

// アップロード。Gist が未作成なら検索し、無ければ新規作成する。保存先 ID を返す。
export async function pushSnapshot(token) {
  const envelope = buildSnapshot()
  let gistId = loadGistId() || await findExistingGist(token)

  if (gistId) await request(`${API_BASE}/gists/${gistId}`, {
    method: 'PATCH', headers: headers(token), body: gistBody(envelope),
  })
  else {
    const res = await request(`${API_BASE}/gists`, {
      method: 'POST', headers: headers(token), body: gistBody(envelope),
    })
    gistId = (await res.json()).id
  }

  saveGistId(gistId)
  markSynced(envelope.exportedAt)
  return gistId
}
