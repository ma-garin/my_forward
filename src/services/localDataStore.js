const ACTIVE_PREFIXES = [
  'salary_base_',
  'salary_extra_',
  'cc_',
]

const ACTIVE_KEYS = new Set([
  'salary_simulation',
  'salary_simulation_monthly',
  'life_weekly_budget',
])

export const MY_FORWARD_SYNC_FILE_NAME = 'my_forward_data.json'
export const MY_FORWARD_APP_NAME = 'my_forward'
export const MY_FORWARD_SCHEMA_VERSION = 1

const META_KEYS = new Set([
  'my_forward_device_id',
  'my_forward_local_updated_at',
  'my_forward_sync_status',
  'my_forward_last_synced_at',
  'my_forward_drive_updated_at',
  'my_forward_drive_device_name',
  'my_forward_last_imported_at',
  'my_forward_last_imported_device',
  'my_forward_last_drive_check_date',
  'my_forward_last_local_checksum',
  'my_forward_last_drive_checksum',
  'my_forward_sync_log',
])

export function isActiveKey(key) {
  return ACTIVE_KEYS.has(key) || ACTIVE_PREFIXES.some(prefix => key.startsWith(prefix))
}

export function isMetaKey(key) {
  return META_KEYS.has(key)
}

export function getAllLocalStorageKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) keys.push(key)
  }
  return keys.sort()
}

export function getActiveDataKeys() {
  return getAllLocalStorageKeys().filter(isActiveKey)
}

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, value: raw }
  }
}

export async function sha256Hex(text) {
  const encoded = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function detectDeviceName() {
  const ua = navigator.userAgent || ''
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Galaxy / Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  return 'Unknown Device'
}

export function getOrCreateDeviceId() {
  const key = 'my_forward_device_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing

  const id = `${detectDeviceName().replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${crypto.randomUUID()}`
  localStorage.setItem(key, id)
  return id
}

export function collectActiveLocalData() {
  const data = {}
  for (const key of getActiveDataKeys()) {
    const raw = localStorage.getItem(key)
    if (raw == null) continue
    const parsed = safeJsonParse(raw)
    data[key] = parsed.value
  }
  return data
}

export async function getLocalChecksum() {
  return sha256Hex(JSON.stringify(collectActiveLocalData()))
}

export async function buildSyncPayload({ appVersion = '0.0.0', updatedAt = new Date().toISOString() } = {}) {
  const data = collectActiveLocalData()
  const checksum = await sha256Hex(JSON.stringify(data))

  return {
    schemaVersion: MY_FORWARD_SCHEMA_VERSION,
    app: MY_FORWARD_APP_NAME,
    appVersion,
    updatedAt,
    deviceId: getOrCreateDeviceId(),
    deviceName: detectDeviceName(),
    checksum,
    data,
  }
}

export async function validateSyncPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'JSON形式が不正です' }
  if (payload.app !== MY_FORWARD_APP_NAME) return { ok: false, reason: 'my_forward用データではありません' }
  if (payload.schemaVersion !== MY_FORWARD_SCHEMA_VERSION) return { ok: false, reason: 'schemaVersionが未対応です' }
  if (!payload.updatedAt || Number.isNaN(Date.parse(payload.updatedAt))) return { ok: false, reason: 'updatedAtが不正です' }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return { ok: false, reason: 'dataが不正です' }

  const checksum = await sha256Hex(JSON.stringify(payload.data))
  if (payload.checksum && payload.checksum !== checksum) return { ok: false, reason: 'checksumが一致しません' }

  return { ok: true, reason: '' }
}

export function applyDataToLocalStorage(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data')

  window.__MY_FORWARD_SYNC_RESTORE_IN_PROGRESS__ = true
  try {
    Object.entries(data).forEach(([key, value]) => {
      if (!isActiveKey(key)) return
      localStorage.setItem(key, JSON.stringify(value))
    })
  } finally {
    window.__MY_FORWARD_SYNC_RESTORE_IN_PROGRESS__ = false
  }

  localStorage.setItem('my_forward_local_updated_at', new Date().toISOString())
}

export async function importSyncPayloadToLocalStorage(payload) {
  const validation = await validateSyncPayload(payload)
  if (!validation.ok) throw new Error(validation.reason)

  applyDataToLocalStorage(payload.data)
  localStorage.setItem('my_forward_last_imported_at', new Date().toISOString())
  localStorage.setItem('my_forward_last_imported_device', payload.deviceName || '')
  localStorage.setItem('my_forward_last_local_checksum', await getLocalChecksum())
}

export function markLocalDirty() {
  if (window.__MY_FORWARD_SYNC_RESTORE_IN_PROGRESS__) return
  localStorage.setItem('my_forward_local_updated_at', new Date().toISOString())
  localStorage.setItem('my_forward_sync_status', 'dirty')
}

export async function markSynced(payload) {
  localStorage.setItem('my_forward_sync_status', 'synced')
  localStorage.setItem('my_forward_last_synced_at', new Date().toISOString())

  if (payload?.updatedAt) localStorage.setItem('my_forward_drive_updated_at', payload.updatedAt)
  if (payload?.deviceName) localStorage.setItem('my_forward_drive_device_name', payload.deviceName)
  if (payload?.checksum) {
    localStorage.setItem('my_forward_last_drive_checksum', payload.checksum)
    localStorage.setItem('my_forward_last_local_checksum', await getLocalChecksum())
  }
}

export async function getLocalMeta() {
  const checksum = await getLocalChecksum()
  const lastDriveChecksum = localStorage.getItem('my_forward_last_drive_checksum') || ''
  const dirtyByChecksum = Boolean(lastDriveChecksum) && checksum !== lastDriveChecksum

  return {
    localUpdatedAt: localStorage.getItem('my_forward_local_updated_at') || '',
    lastSyncedAt: localStorage.getItem('my_forward_last_synced_at') || '',
    status: dirtyByChecksum ? 'dirty' : (localStorage.getItem('my_forward_sync_status') || 'unknown'),
    deviceId: getOrCreateDeviceId(),
    deviceName: detectDeviceName(),
    checksum,
    lastDriveChecksum,
  }
}

export function shouldCheckDriveToday(today = new Date()) {
  const yyyyMmDd = today.toISOString().slice(0, 10)
  return localStorage.getItem('my_forward_last_drive_check_date') !== yyyyMmDd
}

export function markDriveCheckedToday(today = new Date()) {
  const yyyyMmDd = today.toISOString().slice(0, 10)
  localStorage.setItem('my_forward_last_drive_check_date', yyyyMmDd)
}

export function addSyncLog(entry) {
  const key = 'my_forward_sync_log'
  let current = []
  try {
    current = JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    current = []
  }

  const next = [{ at: new Date().toISOString(), ...entry }, ...current].slice(0, 20)
  localStorage.setItem(key, JSON.stringify(next))
}
