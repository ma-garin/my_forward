import {
  MY_FORWARD_SYNC_FILE_NAME,
  buildSyncPayload,
  importSyncPayloadToLocalStorage,
  validateSyncPayload,
  markSynced,
  addSyncLog,
} from './localDataStore'

export const DRIVE_FOLDER_ID = '1aOLqiBN5jlKataLDJ_qXNF_jbwBv8xNN'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const MAX_BACKUP_FILES = 5

let accessToken = ''
let tokenClient = null

export function hasAccessToken() {
  return Boolean(accessToken)
}

export function clearAccessToken() {
  accessToken = ''
}

export function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Identity Servicesの読み込みに失敗しました')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Google Identity Servicesの読み込みに失敗しました'))
    document.head.appendChild(script)
  })
}

export async function requestAccessToken() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID が未設定です')

  await loadGoogleIdentityScript()

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        accessToken = response.access_token
        resolve(accessToken)
      },
    })

    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

async function ensureToken() {
  if (accessToken) return accessToken
  return requestAccessToken()
}

async function driveFetch(url, options = {}) {
  const token = await ensureToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Drive API error: ${response.status} ${text}`)
  }

  return response
}

async function deleteDriveFile(fileId) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' })
}

export async function findSyncFile() {
  const q = [`'${DRIVE_FOLDER_ID}' in parents`, `name='${MY_FORWARD_SYNC_FILE_NAME}'`, `trashed=false`].join(' and ')
  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,modifiedTime,size)',
    pageSize: '10',
  })

  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`)
  const json = await response.json()
  return json.files?.[0] || null
}

export async function listBackupFiles() {
  const q = [
    `'${DRIVE_FOLDER_ID}' in parents`,
    `name contains 'my_forward_'`,
    `name contains '_before_'`,
    `trashed=false`,
  ].join(' and ')

  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  })

  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`)
  const json = await response.json()
  return json.files || []
}

export async function pruneBackupFiles(maxCount = MAX_BACKUP_FILES) {
  const files = await listBackupFiles()
  const removeTargets = files.slice(maxCount)
  await Promise.all(removeTargets.map(file => deleteDriveFile(file.id)))
  return { kept: files.slice(0, maxCount), removed: removeTargets }
}

export async function downloadFileById(fileId) {
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
  return response.json()
}

export async function getDrivePayload() {
  const file = await findSyncFile()
  if (!file) return { file: null, payload: null }

  const payload = await downloadFileById(file.id)
  const validation = await validateSyncPayload(payload)
  if (!validation.ok) throw new Error(validation.reason)

  return { file, payload }
}

export async function createSyncFile(payload) {
  const metadata = {
    name: MY_FORWARD_SYNC_FILE_NAME,
    mimeType: 'application/json',
    parents: [DRIVE_FOLDER_ID],
    appProperties: { app: 'my_forward', role: 'sync-main' },
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))

  const response = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
    { method: 'POST', body: form },
  )

  return response.json()
}

export async function updateSyncFile(fileId, payload) {
  const response = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, null, 2),
    },
  )

  return response.json()
}

export async function createBackupFile(payload, prefix = 'my_forward_backup') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const metadata = {
    name: `${prefix}_${stamp}.json`,
    mimeType: 'application/json',
    parents: [DRIVE_FOLDER_ID],
    appProperties: { app: 'my_forward', role: 'backup' },
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))

  const response = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
    { method: 'POST', body: form },
  )

  const result = await response.json()
  await pruneBackupFiles(MAX_BACKUP_FILES)
  return result
}

export async function uploadCurrentLocalData({ force = false, appVersion = '0.0.0' } = {}) {
  const localPayload = await buildSyncPayload({ appVersion })
  const current = await getDrivePayload()

  if (current.payload && !force) {
    const lastKnownDriveChecksum = localStorage.getItem('my_forward_last_drive_checksum') || ''
    const driveChangedSinceLastSync = current.payload.checksum && current.payload.checksum !== lastKnownDriveChecksum

    if (driveChangedSinceLastSync && current.payload.checksum !== localPayload.checksum) {
      addSyncLog({ action: 'upload', result: 'conflict' })
      return {
        ok: false,
        conflict: true,
        reason: 'Drive側に未反映の新しい変更があります',
        drivePayload: current.payload,
        localPayload,
      }
    }
  }

  if (current.payload) await createBackupFile(current.payload, 'my_forward_drive_before_upload')

  const fileResult = current.file
    ? await updateSyncFile(current.file.id, localPayload)
    : await createSyncFile(localPayload)

  await markSynced(localPayload)
  addSyncLog({ action: 'upload', result: 'success', fileId: fileResult.id })

  return { ok: true, conflict: false, payload: localPayload, file: fileResult }
}

export async function downloadDriveDataToLocal({ createLocalBackup = true } = {}) {
  const current = await getDrivePayload()
  if (!current.payload) throw new Error('Drive上に同期ファイルがありません')

  if (createLocalBackup) {
    const localPayload = await buildSyncPayload()
    await createBackupFile(localPayload, 'my_forward_local_before_download')
  }

  await importSyncPayloadToLocalStorage(current.payload)
  await markSynced(current.payload)
  addSyncLog({ action: 'download', result: 'success', fileId: current.file.id })

  return { ok: true, payload: current.payload, file: current.file }
}

export async function checkDriveStatus() {
  const current = await getDrivePayload()
  addSyncLog({ action: 'check', result: 'success', hasFile: Boolean(current.file) })
  return current
}
