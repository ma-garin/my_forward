import { useState, useRef } from 'react'
import { Box, Typography, Button, Stack, Divider, TextField, Alert, CircularProgress } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'

// 現3タブ（カード・家計・給与）で使用しているキーのみエクスポート対象
function isActiveKey(k) {
  return k === 'salary_simulation'
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

// Android: Web Share API でネイティブ共有シート（Google Drive等）を開く
// Desktop: <a download> でファイル保存
async function saveBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
}

async function exportKeys(keys, filename) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/octet-stream' })
  await saveBlob(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.json`)
}

function importFile(file, onDone) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v))
      })
      alert('インポート完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch {
      alert('ファイルの読み込みに失敗しました')
    }
  }
  reader.readAsText(file)
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
  const key  = await deriveKey(password)
  const buf  = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const iv   = buf.slice(0, 12)
  const ct   = buf.slice(12)
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

// ─── 暗号化エクスポート/インポート UI ───────────────────────
function EncryptedBackupSection({ activeKeys }) {
  const [password, setPassword] = useState('')
  const [status, setStatus]     = useState(null) // null | 'ok' | 'err'
  const [msg, setMsg]           = useState('')
  const [loading, setLoading]   = useState(false)
  const fileRef = useRef()

  const handleExport = async () => {
    if (!password) { setStatus('err'); setMsg('パスワードを入力してください'); return }
    setLoading(true)
    try {
      const data = {}
      activeKeys.forEach(k => {
        try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
      })
      const b64  = await encryptData(password, JSON.stringify(data))
      const blob = new Blob([`${HEADER}\n${b64}`], { type: 'application/octet-stream' })
      await saveBlob(blob, `myforward_encrypted_${new Date().toISOString().slice(0, 10)}.mfenc`)
      setStatus('ok'); setMsg('暗号化ファイルを保存しました')
    } catch { setStatus('err'); setMsg('エクスポートに失敗しました') }
    setLoading(false)
  }

  const handleImport = async (file) => {
    if (!password) { setStatus('err'); setMsg('パスワードを入力してください'); return }
    setLoading(true)
    try {
      const text = await file.text()
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
        AES-256-GCM暗号化。iCloud Drive / Google Drive 等に保存してデバイス間で共有できます。
      </Typography>
      <TextField
        label="パスワード（全端末で共通）"
        type="password" size="small" fullWidth
        value={password} onChange={e => { setPassword(e.target.value); setStatus(null) }}
        sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: 1 }}
      />
      {status && <Alert severity={status === 'ok' ? 'success' : 'error'} sx={{ mb: 1.5, py: 0 }}>{msg}</Alert>}
      <Stack direction="row" gap={1}>
        <Button variant="contained" startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <LockIcon />}
          fullWidth disabled={loading}
          sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' }, fontSize: 12 }}
          onClick={handleExport}>
          暗号化エクスポート
        </Button>
        <Button variant="contained" startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <LockOpenIcon />}
          fullWidth disabled={loading} component="label"
          sx={{ bgcolor: '#6a1b9a', '&:hover': { bgcolor: '#4a148c' }, fontSize: 12 }}>
          暗号化インポート
          <input ref={fileRef} type="file" accept=".mfenc,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }} />
        </Button>
      </Stack>
    </Box>
  )
}

// ─── 汎用行コンポーネント ────────────────────────────────────
function DataRow({ label, exportFilename, exportKeys: getExportKeys }) {
  const allKeys = getAllKeys()
  const keys = getExportKeys(allKeys)

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
      <Typography fontSize={14} fontWeight={500}>{label}</Typography>
      <Stack direction="row" gap={1}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
          onClick={async () => exportKeys(keys, exportFilename)}
          sx={{ fontSize: 12 }}>
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
  )
}

// ─── メイン ─────────────────────────────────────────────────
export default function DataSettings() {
  const activeKeys = getAllKeys().filter(isActiveKey)

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>

      {/* 暗号化バックアップ */}
      <EncryptedBackupSection activeKeys={activeKeys} />

      {/* 全データ */}
      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>全データ一括</Typography>
        <Stack direction="row" gap={1}>
          <Button variant="contained" startIcon={<DownloadIcon />} fullWidth
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            onClick={async () => exportKeys(activeKeys, 'myforward_backup')}>
            一括エクスポート
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} fullWidth component="label">
            一括インポート
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Box>

      {/* 個別 */}
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
