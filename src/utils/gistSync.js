import { isActiveKey, getAllKeys, listActiveKeys } from './appKeys'

export const SYNC_TOKEN_KEY = 'sync_gist_token'
export const SYNC_GIST_ID_KEY = 'sync_gist_id'
export const SYNC_LAST_SYNCED_KEY = 'sync_last_synced_at'
export const SYNC_LAST_REMOTE_KEY = 'sync_last_remote_exported_at'
export const SYNC_BACKUP_KEY = 'sync_backup_before_pull'

export const GIST_FILENAME = 'my_forward_sync.json'
export const GIST_MARKER = 'my_forward-sync-v1'

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

export function loadToken() {
  return localStorage.getItem(SYNC_TOKEN_KEY) || ''
}
export function saveToken(v) {
  if (v) localStorage.setItem(SYNC_TOKEN_KEY, v)
  else localStorage.removeItem(SYNC_TOKEN_KEY)
}
export function loadGistId() {
  return localStorage.getItem(SYNC_GIST_ID_KEY) || ''
}
export function saveGistId(v) {
  if (v) localStorage.setItem(SYNC_GIST_ID_KEY, v)
  else localStorage.removeItem(SYNC_GIST_ID_KEY)
}
export function loadLastSyncedAt() {
  return localStorage.getItem(SYNC_LAST_SYNCED_KEY) || ''
}
export function loadLastRemoteExportedAt() {
  return localStorage.getItem(SYNC_LAST_REMOTE_KEY) || ''
}
export function markSynced(exportedAt) {
  localStorage.setItem(SYNC_LAST_SYNCED_KEY, new Date().toISOString())
  if (exportedAt) localStorage.setItem(SYNC_LAST_REMOTE_KEY, exportedAt)
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
export function buildSnapshot(device = detectDevice()) {
  const data = {}
  listActiveKeys().forEach(k => {
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  })
  return {
    schema: SCHEMA_VERSION,
    app: APP_ID,
    exportedAt: new Date().toISOString(),
    device,
    data,
  }
}

export function validateSnapshot(obj) {
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
export function applySnapshot(envelope) {
  const { data } = validateSnapshot(envelope)

  getAllKeys().forEach(k => {
    if (isActiveKey(k) && !(k in data)) localStorage.removeItem(k)
  })

  Object.entries(data).forEach(([k, v]) => {
    if (isActiveKey(k) && typeof v === 'string') localStorage.setItem(k, v)
  })
}

export function backupCurrentData(device = detectDevice()) {
  const snap = buildSnapshot(device)
  localStorage.setItem(SYNC_BACKUP_KEY, JSON.stringify(snap))
  return snap
}

export function loadBackup() {
  const raw = localStorage.getItem(SYNC_BACKUP_KEY)
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
  return snap
}

// ---- GitHub Gist API ----

function headers(token, withContentType = false) {
  const h = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (withContentType) h['Content-Type'] = 'application/json'
  return h
}

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
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new GistSyncError('rate_limited', 'GitHub API の制限に達しました。しばらく待ってから再試行してください', 403)
    }
    throw new GistSyncError('unauthorized', 'アクセスが拒否されました。トークンの権限（Gist）を確認してください', 403)
  }
  throw new GistSyncError('http', `通信エラーが発生しました（HTTP ${res.status}）`, res.status)
}

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

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new GistSyncError('invalid_data', '同期データの解析に失敗しました')
  }

  return { envelope: validateSnapshot(parsed), gistUpdatedAt: gist.updated_at }
}

export async function createGist(token, envelope) {
  const res = await request(`${API_BASE}/gists`, {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify({
      description: GIST_MARKER,
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(envelope) } },
    }),
  })
  const gist = await res.json()
  return gist.id
}

export async function pushSnapshot(token, gistId, envelope) {
  await request(`${API_BASE}/gists/${gistId}`, {
    method: 'PATCH',
    headers: headers(token, true),
    body: JSON.stringify({
      description: GIST_MARKER,
      files: { [GIST_FILENAME]: { content: JSON.stringify(envelope) } },
    }),
  })
  return gistId
}

// 既存の同期用 Gist を description / ファイル名で探す。見つからなければ null。
export async function findExistingGist(token) {
  const res = await request(`${API_BASE}/gists?per_page=100`, { headers: headers(token) })
  const list = await res.json()
  if (!Array.isArray(list)) return null
  const hit = list.find(g => g.description === GIST_MARKER || g.files?.[GIST_FILENAME])
  return hit ? hit.id : null
}
