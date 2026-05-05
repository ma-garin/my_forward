import { useState, useRef } from 'react'
import { Box, Typography, Button, Stack, Divider, TextField, Alert, CircularProgress } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'

// 現3タブ（カード・家計・給与）で使用しているキーのみエクスポート対象
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

// Share API が使える場合は共有シート（Android Google Drive等）、失敗時は download にフォールバック
async function saveBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e?.name === 'AbortError') throw e  // ユーザーがキャンセル → 呼び出し元に伝える
      // それ以外の失敗（NotAllowedError等）→ download にフォールバック
    }
  }
  downloadBlob(blob, filename)
}

async function exportKeys(keys, filename) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/octet-stream' })
  try {
    await saveBlob(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.json`)
  } catch (e) {
    if (e?.name !== 'AbortError') throw e
    // AbortError = ユーザーがキャンセル → 何もしない
  }
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
  // 暗号化済みBlobをstateに持ち、保存ボタン押下時（＝ユーザー操作）にShare APIを呼ぶ
  const [readyBlob, setReadyBlob]     = useState(null)
  const [readyFilename, setReadyFilename] = useState('')
  const fileRef = useRef()

  const handlePrepare = async () => {
    if (!password) { setStatus('err'); setMsg('パスワードを入力してください'); return }
    setLoading(true); setReadyBlob(null); setStatus(null)
    try {
      const data = {}
      activeKeys.forEach(k => {
        try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
      })
      const b64  = await encryptData(password, JSON.stringify(data))
      const blob = new Blob([`${HEADER}\n${b64}`], { type: 'application/octet-stream' })
      const fname = `myforward_encrypted_${new Date().toISOString().slice(0, 10)}.mfenc`
      setReadyBlob(blob); setReadyFilename(fname)
      setStatus('ok'); setMsg('準備完了。「ファイルを保存」を押してください')
    } catch { setStatus('err'); setMsg('暗号化に失敗しました') }
    setLoading(false)
  }

  // このハンドラはボタン押下から直接呼ばれるため、Share API のユーザー操作要件を確実に満たす
  const handleSave = async () => {
    if (!readyBlob) return
    try {
      await saveBlob(readyBlob, readyFilename)
      setReadyBlob(null); setStatus('ok'); setMsg('保存しました')
    } catch (e) {
      if (e?.name !== 'AbortError') { setStatus('err'); setMsg('保存に失敗しました') }
      // AbortError = ユーザーが共有シートを閉じた → readyBlobを残して再試行可能にする
    }
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
        value={password} onChange={e => { setPassword(e.target.value); setStatus(null); setReadyBlob(null) }}
        sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: 1 }}
      />
      {status && <Alert severity={status === 'ok' ? 'success' : 'error'} sx={{ mb: 1.5, py: 0 }}>{msg}</Alert>}

      {/* エクスポート: ステップ1 暗号化 → ステップ2 保存 */}
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

      {/* インポート */}
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

// ─── 汎用行コンポーネント ────────────────────────────────────
function DataRow({ label, exportFilename, exportKeys: getExportKeys }) {
  const allKeys = getAllKeys()
  const keys = getExportKeys(allKeys)

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
      <Typography fontSize={14} fontWeight={500}>{label}</Typography>
      <Stack direction="row" gap={1}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
          onClick={async () => { try { await exportKeys(keys, exportFilename) } catch { alert('エクスポートに失敗しました') } }}
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
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>全データ一括</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Android: 共有シートが開くので「Drive に保存」等を選択。PC: ブラウザのダウンロードフォルダに保存されます。
        </Typography>
        <Stack direction="row" gap={1}>
          <Button variant="contained" startIcon={<DownloadIcon />} fullWidth
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            onClick={async () => { try { await exportKeys(activeKeys, 'myforward_backup') } catch { alert('エクスポートに失敗しました') } }}>
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
