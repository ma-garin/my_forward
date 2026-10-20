/**
 * 宅内サーバー（Raspberry Pi）との同期。
 *
 * ## 「いつ変わったか」の出どころは cc_sync_base の 1 つ
 *
 * 最後に同期したときの内容の指紋（h）と、そのとき合意した時刻（t）だけを持つ。
 * 今の値の指紋がそれと違えば「前回の同期のあとに変わった」とわかる。
 *
 * localStorage の書き込みを横取りして時刻を記録する作りにはしていない。
 * `Storage.prototype.setItem` を差し替えることになり、保存の経路が 2 つに
 * 増える（どちらを通ったかで記録の有無が変わる）ため。指紋なら保存側は
 * 今までどおりで、同期のときに差分を見つけられる。
 *
 * ## 突き合わせの粒度はキー単位
 *
 * 配列の中の行まで混ぜない。行を混ぜると、片方で消した行が
 * 「もう片方にまだある」として復活する（消したことを表す印が無いため）。
 * キー単位なら、新しく触ったほうの内容がそのキーごと残る。
 *
 * 同じキーを両方の端末で別々に編集した場合、古いほうの変更は失われる。
 * これは受け入れる（1 人が 2 台を使う前提で、同時編集は起きない）。
 */

import { isBackupKey, getAllKeys } from './backup'
import { bumpDataVersion } from './ccStorage'

const CONFIG_KEY = 'cc_sync_config'
const BASE_KEY = 'cc_sync_base'

/**
 * 同期しないキー。端末ごとの状態であって、家計のデータではない。
 * 送ると、片方の端末で外観を変えただけでもう片方の見た目が変わる。
 */
const LOCAL_ONLY = new Set([
  CONFIG_KEY,
  BASE_KEY,
  'cc_theme_bg',        // スプラッシュ用に控えた色（端末の外観に従う）
  'cc_auto_backup_at',  // その端末で最後に控えを取った時刻
])

export function isSyncKey(k) {
  return isBackupKey(k) && !LOCAL_ONLY.has(k)
}

// ─── 設定 ──────────────────────────────────────────────

export const DEFAULT_CONFIG = { url: '', token: '', auto: false }

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveSyncConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...DEFAULT_CONFIG, ...cfg }))
  } catch (e) {
    console.warn('saveSyncConfig failed', e)
  }
}

/** 末尾のスラッシュを落として http:// を補う */
export function normalizeUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  const withScheme = /^https?:\/\//i.test(s) ? s : `http://${s}`
  return withScheme.replace(/\/+$/, '')
}

// ─── 指紋 ──────────────────────────────────────────────

/**
 * FNV-1a（32bit）＋ 長さ。
 * 中身が変わったかどうかを知りたいだけなので、暗号強度は要らない。
 * 長さを足すのは、短い衝突を潰すため。
 */
export function hashValue(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${(h >>> 0).toString(36)}.${s.length.toString(36)}`
}

// ─── 前回同期時の控え ──────────────────────────────────

export function loadBase() {
  try {
    const raw = localStorage.getItem(BASE_KEY)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

export function saveBase(base) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(base))
  } catch (e) {
    console.warn('saveBase failed', e)
  }
}

export function clearBase() {
  try { localStorage.removeItem(BASE_KEY) } catch { /* 消せなくても次の同期で上書きする */ }
}

// ─── 端末側の状態を集める ──────────────────────────────

/**
 * 今の localStorage を `{ key: { v, t } }` にする。`v === null` は「消した」印。
 *
 * 指紋が控えと一致するキーは、前回の同期から変わっていないので
 * そのときの時刻をそのまま使う。違えば「今」に更新する。
 */
export function collectLocal(base = loadBase(), now = Date.now()) {
  const out = {}
  const present = new Set()

  getAllKeys().filter(isSyncKey).forEach((k) => {
    const v = localStorage.getItem(k)
    if (v === null) return
    present.add(k)
    const h = hashValue(v)
    const b = base[k]
    out[k] = { v, t: b && b.h === h ? b.t : now }
  })

  // 控えにあって今は無い ＝ 前回の同期のあとで消した。
  // 印を送らないと、もう片方の端末から同じ行がまた降ってくる
  Object.keys(base).forEach((k) => {
    if (present.has(k)) return
    const b = base[k]
    out[k] = { v: null, t: b.h === null ? b.t : now }
  })

  return out
}

// ─── 突き合わせ ────────────────────────────────────────

/**
 * ローカルとサーバーを突き合わせ、書き戻すぶんと送るぶんに分ける。
 *
 * 同じ時刻で中身が違うときはサーバー側を採る。どちらを採るか決めておかないと、
 * 2 台が互いに相手を上書きし合って収束しない。
 */
export function mergeEntries(local, remote) {
  const apply = {}
  const push = {}
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])

  keys.forEach((k) => {
    const a = local[k]
    const b = remote[k]
    if (!b) { if (a) push[k] = a; return }
    if (!a) { apply[k] = b; return }
    if (a.v === b.v) return            // 中身が同じなら時刻の差は見ない
    if (a.t > b.t) push[k] = a
    else apply[k] = b
  })

  return { apply, push }
}

/** 書き戻す。反映した件数を返す */
export function applyEntries(apply) {
  const entries = Object.entries(apply)
  if (entries.length === 0) return 0
  entries.forEach(([k, e]) => {
    try {
      if (e.v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, e.v)
    } catch (err) {
      console.warn('applyEntries failed', k, err)
    }
  })
  // 保存関数を通さずに書いているので、ここで版数を進める。
  // 忘れると開いているタブに反映されない
  bumpDataVersion()
  return entries.length
}

/** 合意した内容から控えを作り直す */
export function buildBase(local, apply) {
  const base = {}
  const merged = { ...local, ...apply }
  Object.entries(merged).forEach(([k, e]) => {
    base[k] = { h: e.v === null ? null : hashValue(e.v), t: e.t }
  })
  return base
}

// ─── サーバーとのやりとり ──────────────────────────────

const TIMEOUT_MS = 15000

async function request(cfg, path, init = {}) {
  const url = normalizeUrl(cfg.url)
  if (!url) throw new Error('サーバーのアドレスが未設定です')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { 'X-Sync-Token': cfg.token } : {}),
        ...init.headers,
      },
    })
    if (res.status === 401) throw new Error('合言葉が違います')
    if (!res.ok) throw new Error(`サーバーが ${res.status} を返しました`)
    return await res.json()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('サーバーが応答しません')
    if (e instanceof TypeError) throw new Error('サーバーにつながりません（アドレス・同じWi-Fiかを確認）')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** つながるか確かめる */
export async function probe(cfg) {
  const r = await request(cfg, '/api/health')
  return { name: r.name || '', count: r.count || 0 }
}

// ─── 同期の実行 ────────────────────────────────────────

/**
 * 1 回ぶんの同期。
 *
 * direction を渡すと突き合わせをせずに片方向で揃える。初回だけ使う
 * （前回同期時の控えが無く、どちらが新しいか判断できないため）。
 */
export async function runSync(cfg, { direction = null } = {}) {
  const base = loadBase()
  const now = Date.now()
  const local = collectLocal(base, now)
  const { entries: remote } = await request(cfg, '/api/state')

  let apply, push
  if (direction === 'push') {
    apply = {}
    push = local
  } else if (direction === 'pull') {
    apply = remote
    push = {}
  } else {
    ({ apply, push } = mergeEntries(local, remote))
  }

  if (Object.keys(push).length > 0) {
    await request(cfg, '/api/state', { method: 'POST', body: JSON.stringify({ entries: push }) })
  }
  const applied = applyEntries(apply)

  saveBase(buildBase(direction === 'pull' ? {} : local, apply))
  return { sent: Object.keys(push).length, received: applied, at: now }
}

/** 初回か（前回同期時の控えが無い） */
export function isFirstSync() {
  return Object.keys(loadBase()).length === 0
}

/** サーバーに何か入っているか。初回に方向を選ばせるかの判断に使う */
export async function remoteCount(cfg) {
  const r = await probe(cfg)
  return r.count
}
