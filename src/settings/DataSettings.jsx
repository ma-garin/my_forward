import { useState, useRef } from 'react'
import { Box, Typography, Button, Stack, Divider, TextField, Alert, CircularProgress, Link } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'

const GDRIVE_BACKUP_URL = 'https://drive.google.com/drive/folders/1BM9emtr7yBNVcgGOUZzr9hCK08zSzNKb'

function isActiveKey(k) {
  return k === 'salary_simulation'
      || k === 'life_weekly_budget'
      || k.startsWith('salary_base_')
      || k.startsWith('salary_extra_')
      || k.startsWith('cc_')
}

function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * ファイル保存。優先順位:
 *   1. showSaveFilePicker (Chrome 86+ / Android) — システムファイルピッカー、Google Drive 選択可
 *   2. Web Share API (iOS Safari / Samsung Internet 等)
 *   3. <a download> フォールバック
 * 戻り値: true=保存完了, false=ユーザーがキャンセル
 */
async function saveBlob(blob, filename) {
  const isJson = filename.endsWith('.json')
  const types = [{
    description: isJson ? 'JSONバックアップ' : '暗号化バックアップ',
    accept: isJson
      ? { 'application/json': ['.json'] }
      : { 'application/octet-stream': ['.mfenc'] },
  }]

  // 1. File System Access API（Android Chrome PWA 対応、Google Drive 選択可）
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return false  // ユーザーキャンセル
      // SecurityError 等 → 次の方法へ
    }
  }

  // 2. Web Share API
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch {
      // キャンセル・失敗 → download へ
    }
  }

  // 3. <a download> フォールバック
  downloadBlob(blob, filename)
  return true
}

function buildExportBlob(keys) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

function importFile(file) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
      alert('インポート完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch {
      alert('ファイルの読み込みに失敗しました')
    }
  }
  reader.readAsText(file)
}

function DriveLink() {
  return (
    <Link href={GDRIVE_BACKUP_URL} target="_blank" rel="noopener"
      sx={{ fontSize: 11, display: 'block', mt: 0.5 }}>
      Google Drive バックアップフォルダを開く →
    </Link>
  )
}

// ─── 暗号化ユーティリティ（WebCrypto API） ───────────────────
const SALT = new TextEncoder().encode('myforward_v1')
const HEADER = 'MYFORWARD_ENCRYPTED_V1'

async function deriveKey(password) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 200000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

async function encryptData(password, data) {
  const key = await deriveKey(password)
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return btoa(String.fromCharCode(...out))
}

async function decryptData(password, b64) {
  const key = await deriveKey(password)
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const iv  = buf.slice(0, 12)
  const ct  = buf.slice(12)
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

// ─── 暗号化バックアップ UI ────────────────────────────────────
function EncryptedBackupSection({ activeKeys }) {
  const [password, setPassword]         = useState('')
  const [status, setStatus]             = useState(null)
  const [msg, setMsg]                   = useState('')
  const [loading, setLoading]           = useState(false)
  const [readyBlob, setReadyBlob]       = useState(null)
  const [readyFilename, setReadyFilename] = useState('')
  const [saved, setSaved]               = useState(false)
  const fileRef = useRef()

  const handlePrepare = async () => {
    if (!password) { setStatus('err'); setMsg('パスワードを入力してください'); return }
    setLoading(true); setReadyBlob(null); setStatus(null); setSaved(false)
    try {
      const data = {}
      activeKeys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {} })
      const b64  = await encryptData(password, JSON.stringify(data))
      const blob = new Blob([`${HEADER}\n${b64}`], { type: 'application/octet-stream' })
      const fname = `myforward_encrypted_${new Date().toISOString().slice(0, 10)}.mfenc`
      setReadyBlob(blob); setReadyFilename(fname)
      setStatus('ok'); setMsg('準備完了。「ファイルを保存」を押してください')
    } catch { setStatus('err'); setMsg('暗号化に失敗しました') }
    setLoading(false)
  }

  // ボタン押下から直接呼ぶことで showSaveFilePicker のユーザー操作要件を満たす
  const handleSave = async () => {
    if (!readyBlob) return
    const ok = await saveBlob(readyBlob, readyFilename)
    if (ok) { setReadyBlob(null); setStatus('ok'); setMsg('保存しました'); setSaved(true) }
  }

  const handleImport = async (file) => {
    if (!password) { setStatus('err'); setMsg('パスワードを入力してください'); return }
    setLoading(true)
    try {
      const text  = await file.text()
      const lines = text.split('\n')
      if (lines[0].trim() !== HEADER) throw new Error('invalid header')
      const plain = await decryptData(password, lines[1].trim())
      const data  = JSON.parse(plain)
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
      alert('インポート完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch (e) {
      setStatus('err')
      setMsg(e.message === 'invalid header' ? '対応していないファイル形式です' : 'パスワードが正しくありません')
    }
    setLoading(false)
  }

  return (
    <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2, mb: 2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>暗号化バックアップ（デバイス間転送用）</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        AES-256-GCM暗号化。Google Drive 等に保存してデバイス間で共有できます。
      </Typography>
      <TextField
        label="パスワード（全端末で共通）" type="password" size="small" fullWidth
        value={password}
        onChange={e => { setPassword(e.target.value); setStatus(null); setReadyBlob(null); setSaved(false) }}
        sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: 1 }}
      />
      {status && (
        <Alert severity={status === 'ok' ? 'success' : 'error'} sx={{ mb: 1.5, py: 0.5 }}>
          {msg}
          {saved && <DriveLink />}
        </Alert>
      )}
      <Stack direction="row" gap={1} sx={{ mb: 1 }}>
        <Button variant="contained" fullWidth disabled={loading || !!readyBlob}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <LockIcon />}
          sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' }, fontSize: 12 }}
          onClick={handlePrepare}>
          {loading ? '暗号化中…' : '① 暗号化する'}
        </Button>
        <Button variant="contained" fullWidth disabled={!readyBlob}
          startIcon={<DownloadIcon />}
          sx={{ bgcolor: readyBlob ? '#2e7d32' : undefined, '&:hover': { bgcolor: '#1b5e20' }, fontSize: 12 }}
          onClick={handleSave}>
          ② ファイルを保存
        </Button>
      </Stack>
      <Button variant="outlined" fullWidth disabled={loading} component="label"
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <LockOpenIcon />}
        sx={{ fontSize: 12 }}>
        暗号化インポート
        <input ref={fileRef} type="file" accept=".mfenc,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }} />
      </Button>
    </Box>
  )
}

// ─── 個別エクスポート行 ───────────────────────────────────────
function DataRow({ label, exportFilename, exportKeys: getExportKeys }) {
  const [saved, setSaved] = useState(false)
  const keys = getExportKeys(getAllKeys())

  const doExport = async () => {
    setSaved(false)
    const filename = `${exportFilename}_${new Date().toISOString().slice(0, 10)}.json`
    const blob = buildExportBlob(keys)
    const ok = await saveBlob(blob, filename)
    if (ok) setSaved(true)
  }

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontSize={14} fontWeight={500}>{label}</Typography>
        <Stack direction="row" gap={1}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
            onClick={doExport} sx={{ fontSize: 12 }}>
            出力
          </Button>
          <Button size="small" variant="outlined" startIcon={<UploadFileIcon />}
            component="label" sx={{ fontSize: 12 }}>
            読込
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Stack>
      {saved && (
        <Alert severity="success" sx={{ py: 0.25, mt: 0.5, fontSize: 12 }}>
          保存しました。<DriveLink />
        </Alert>
      )}
    </Box>
  )
}

// ─── メイン ──────────────────────────────────────────────────
export default function DataSettings() {
  const activeKeys = getAllKeys().filter(isActiveKey)
  const [bulkSaved, setBulkSaved] = useState(false)

  // showSaveFilePicker をユーザー操作の直後に呼ぶため、ここで直接 saveBlob を呼ぶ
  const doBulkExport = async () => {
    setBulkSaved(false)
    const filename = `myforward_backup_${new Date().toISOString().slice(0, 10)}.json`
    const blob = buildExportBlob(activeKeys)
    const ok = await saveBlob(blob, filename)
    if (ok) setBulkSaved(true)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>

      <EncryptedBackupSection activeKeys={activeKeys} />

      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>全データ一括</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          保存ダイアログが開きます。Google Drive のバックアップフォルダを選択して保存できます。
        </Typography>
        {bulkSaved && (
          <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>
            保存しました。<DriveLink />
          </Alert>
        )}
        <Stack direction="row" gap={1}>
          <Button variant="contained" startIcon={<DownloadIcon />} fullWidth
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            onClick={doBulkExport}>
            一括エクスポート
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} fullWidth component="label">
            一括インポート
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        個別データ
      </Typography>
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, px: 2 }}>
        <DataRow label="給与シミュレーション" exportFilename="myforward_salary"
          exportKeys={(keys) => keys.filter(k => k === 'salary_simulation')} />
        <Divider />
        <DataRow label="カード" exportFilename="myforward_card"
          exportKeys={(keys) => keys.filter(k => k.startsWith('cc_'))} />
        <Divider />
        <DataRow label="給与履歴" exportFilename="myforward_salary_history"
          exportKeys={(keys) => keys.filter(k => k.startsWith('salary_base_') || k.startsWith('salary_extra_'))} />
      </Box>
    </Box>
  )
}
