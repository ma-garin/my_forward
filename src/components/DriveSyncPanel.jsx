import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import SyncIcon from '@mui/icons-material/Sync'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import { checkDriveStatus, clearAccessToken, downloadDriveDataToLocal, hasAccessToken, requestAccessToken, uploadCurrentLocalData } from '../services/driveSync'
import { getLocalMeta, markDriveCheckedToday, shouldCheckDriveToday } from '../services/localDataStore'

function fmtDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getStatus(localMeta, drivePayload) {
  if (!drivePayload?.checksum) return { label: localMeta.status === 'dirty' ? '未同期' : 'Drive未作成', color: localMeta.status === 'dirty' ? 'warning' : 'default' }
  if (localMeta.checksum === drivePayload.checksum) return { label: '同期済み', color: 'success' }
  const lastDriveChecksum = localMeta.lastDriveChecksum || ''
  if (lastDriveChecksum && drivePayload.checksum !== lastDriveChecksum && localMeta.status === 'dirty') return { label: '競合可能性あり', color: 'error' }
  const driveTime = Date.parse(drivePayload.updatedAt || 0)
  const localTime = Date.parse(localMeta.localUpdatedAt || localMeta.lastSyncedAt || 0)
  if (driveTime > localTime) return { label: 'Driveが新しい', color: 'warning' }
  return { label: 'この端末が新しい', color: 'info' }
}

export default function DriveSyncPanel() {
  const [loggedIn, setLoggedIn] = useState(hasAccessToken())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [drivePayload, setDrivePayload] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [localMeta, setLocalMeta] = useState(null)

  const refreshLocalMeta = async () => setLocalMeta(await getLocalMeta())

  const run = async (fn) => {
    setBusy(true); setError(''); setMessage('')
    try { const result = await fn(); await refreshLocalMeta(); return result }
    catch (e) { setError(e?.message || '処理に失敗しました'); return null }
    finally { setBusy(false) }
  }

  const handleLogin = () => run(async () => {
    await requestAccessToken()
    setLoggedIn(true)
    setMessage('Google Driveへ接続しました')
  })

  const handleLogout = () => {
    clearAccessToken()
    setLoggedIn(false)
    setDrivePayload(null)
    setMessage('ログアウトしました')
  }

  const handleCheck = () => run(async () => {
    await requestAccessToken()
    setLoggedIn(true)
    const current = await checkDriveStatus()
    setDrivePayload(current.payload)
    markDriveCheckedToday()
    setMessage(current.payload ? 'Driveを確認しました' : 'Driveに同期ファイルはありません')
  })

  const handleUpload = (force = false) => run(async () => {
    const result = await uploadCurrentLocalData({ force, appVersion: import.meta.env.VITE_APP_VERSION || '0.0.0' })
    if (result?.conflict) { setConfirm({ type: 'conflict-upload', result }); return }
    setDrivePayload(result.payload)
    setMessage('Driveへアップロードしました')
  })

  const handleDownload = () => run(async () => {
    const result = await downloadDriveDataToLocal()
    setDrivePayload(result.payload)
    setMessage('Driveからダウンロードしました。画面を再読み込みします。')
    setTimeout(() => window.location.reload(), 800)
  })

  useEffect(() => { refreshLocalMeta() }, [])
  useEffect(() => {
    if (!loggedIn) return
    if (!shouldCheckDriveToday()) return
    handleCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  const status = getStatus(localMeta || {}, drivePayload)

  return (
    <Box sx={{ p: 2, bgcolor: '#f7f9fc', borderRadius: 2, mb: 2, border: '1px solid #e0e0e0' }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Google Drive同期</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>通常利用時は通信しません。Drive確認・アップロード・ダウンロード時のみ通信します。</Typography>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
        <Chip size="small" label={loggedIn ? 'ログイン済み' : '未ログイン'} color={loggedIn ? 'success' : 'default'} />
        <Chip size="small" label={status.label} color={status.color} />
      </Stack>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">この端末: {localMeta?.deviceName || '—'}</Typography>
        <Typography variant="caption" color="text.secondary">ローカル更新: {fmtDateTime(localMeta?.localUpdatedAt)}</Typography>
        <Typography variant="caption" color="text.secondary">Drive更新: {fmtDateTime(drivePayload?.updatedAt)}</Typography>
        <Typography variant="caption" color="text.secondary">Drive更新端末: {drivePayload?.deviceName || '—'}</Typography>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{message}</Alert>}
      <Stack direction="row" gap={1} flexWrap="wrap">
        {!loggedIn ? <Button size="small" variant="contained" startIcon={<LoginIcon />} disabled={busy} onClick={handleLogin}>Googleでログイン</Button> : <Button size="small" variant="outlined" startIcon={<LogoutIcon />} disabled={busy} onClick={handleLogout}>ログアウト</Button>}
        <Button size="small" variant="outlined" startIcon={<SyncIcon />} disabled={busy || !loggedIn} onClick={handleCheck}>Driveを確認</Button>
        <Button size="small" variant="contained" startIcon={<CloudUploadIcon />} disabled={busy || !loggedIn} onClick={() => setConfirm({ type: 'upload' })}>Driveへアップロード</Button>
        <Button size="small" variant="contained" color="secondary" startIcon={<CloudDownloadIcon />} disabled={busy || !loggedIn || !drivePayload} onClick={() => setConfirm({ type: 'download' })}>Driveからダウンロード</Button>
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" color="text.secondary">保存先: Google Drive指定フォルダ / my_forward_data.json</Typography>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 16 }}>{confirm?.type === 'download' ? 'Driveからダウンロード' : confirm?.type === 'conflict-upload' ? '競合があります' : 'Driveへアップロード'}</DialogTitle>
        <DialogContent>
          {confirm?.type === 'download' && <Typography variant="body2">Driveのデータでこの端末のlocalStorageを更新します。現在のローカルデータはDriveへバックアップされます。</Typography>}
          {confirm?.type === 'upload' && <Typography variant="body2">この端末のデータでDrive上の my_forward_data.json を更新します。更新前にDrive上の現在データをバックアップします。</Typography>}
          {confirm?.type === 'conflict-upload' && (
            <Stack spacing={1}>
              <Typography variant="body2">Drive側に、この端末が最後に同期した後の変更があります。この端末のデータで上書きしますか？</Typography>
              <Typography variant="caption" color="text.secondary">Drive: {fmtDateTime(confirm.result.drivePayload.updatedAt)} / {confirm.result.drivePayload.deviceName}</Typography>
              <Typography variant="caption" color="text.secondary">この端末: {fmtDateTime(confirm.result.localPayload.updatedAt)} / {confirm.result.localPayload.deviceName}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="small" color="inherit" onClick={() => setConfirm(null)}>キャンセル</Button>
          {confirm?.type === 'download' && <Button size="small" variant="contained" onClick={() => { setConfirm(null); handleDownload() }}>ダウンロード</Button>}
          {confirm?.type === 'upload' && <Button size="small" variant="contained" onClick={() => { setConfirm(null); handleUpload(false) }}>アップロード</Button>}
          {confirm?.type === 'conflict-upload' && <>
            <Button size="small" variant="outlined" onClick={() => { setConfirm(null); handleDownload() }}>Driveを採用</Button>
            <Button size="small" variant="contained" color="error" onClick={() => { setConfirm(null); handleUpload(true) }}>この端末で上書き</Button>
          </>}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
