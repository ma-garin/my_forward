import { useState } from 'react'
import {
  Box, Typography, Button, Stack, Divider, Alert, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import SearchIcon from '@mui/icons-material/Search'
import RestoreIcon from '@mui/icons-material/Restore'
import {
  GistSyncError, buildSnapshot, applySnapshot, backupCurrentData, restoreBackup, loadBackup,
  fetchRemoteSnapshot, pushSnapshot, createGist, findExistingGist,
  loadToken, saveToken, loadGistId, saveGistId,
  loadLastSyncedAt, loadLastRemoteExportedAt, markSynced, detectDevice,
} from '../utils/gistSync'

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ja-JP')
}

export default function SyncSettings() {
  const [token, setToken] = useState(loadToken())
  const [gistId, setGistId] = useState(loadGistId())
  const [lastSynced, setLastSynced] = useState(loadLastSyncedAt())
  const [hasBackup, setHasBackup] = useState(() => !!loadBackup())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pushConfirm, setPushConfirm] = useState(null)
  const [pullConfirm, setPullConfirm] = useState(null)

  const device = detectDevice()
  const canSync = !!token

  const handleError = (e) => {
    if (e instanceof GistSyncError) {
      setError(e.message)
      if (e.code === 'not_found') setNotice('')
    } else {
      setError('同期に失敗しました')
    }
  }

  const reset = () => { setError(''); setNotice('') }

  const handleSaveToken = () => {
    reset()
    saveToken(token.trim())
    setToken(token.trim())
    setNotice(token.trim() ? 'トークンを保存しました' : 'トークンを削除しました')
  }

  const handleSaveGistId = () => {
    reset()
    const v = gistId.trim()
    saveGistId(v)
    setGistId(v)
    setNotice(v ? 'Gist ID を保存しました' : 'Gist ID を削除しました')
  }

  const handleFind = async () => {
    reset()
    setBusy('find')
    try {
      const found = await findExistingGist(token)
      if (found) {
        saveGistId(found)
        setGistId(found)
        setNotice('既存の Gist が見つかりました')
      } else {
        setNotice('同期用の Gist は見つかりませんでした。アップロードすると新規作成されます')
      }
    } catch (e) { handleError(e) } finally { setBusy('') }
  }

  // 実際のアップロード処理。確認ダイアログを経由する場合は onConfirm から呼ばれる。
  const doPush = async () => {
    setBusy('push')
    try {
      const envelope = buildSnapshot(device)
      let id = loadGistId()
      if (!id) {
        id = await findExistingGist(token)
        if (id) await pushSnapshot(token, id, envelope)
        else id = await createGist(token, envelope)
        saveGistId(id)
        setGistId(id)
      } else {
        await pushSnapshot(token, id, envelope)
      }
      markSynced(envelope.exportedAt)
      setLastSynced(loadLastSyncedAt())
      setNotice('アップロードが完了しました')
    } catch (e) { handleError(e) } finally { setBusy('') }
  }

  const handlePush = async () => {
    reset()
    const id = loadGistId()
    if (!id) return doPush()

    // 前回同期以降に他端末が push していないか確認する
    setBusy('push')
    try {
      const { envelope: remote } = await fetchRemoteSnapshot(token, id)
      const lastRemote = loadLastRemoteExportedAt()
      if (lastRemote && remote.exportedAt !== lastRemote) {
        setBusy('')
        setPushConfirm(remote)
        return
      }
    } catch (e) {
      // リモート未作成・未取得でもアップロード自体は試みる
      if (!(e instanceof GistSyncError) || (e.code !== 'not_found' && e.code !== 'invalid_data')) {
        setBusy('')
        return handleError(e)
      }
    }
    setBusy('')
    await doPush()
  }

  const handlePull = async () => {
    reset()
    const id = loadGistId()
    if (!id) {
      setError('Gist ID が未設定です。「既存の Gist を検索」または ID を入力してください')
      return
    }
    setBusy('pull')
    try {
      const { envelope } = await fetchRemoteSnapshot(token, id)
      setPullConfirm(envelope)
    } catch (e) { handleError(e) } finally { setBusy('') }
  }

  const doPull = (envelope) => {
    setPullConfirm(null)
    setBusy('pull')
    try {
      backupCurrentData(device)
      applySnapshot(envelope)
      markSynced(envelope.exportedAt)
      setHasBackup(true)
      alert('ダウンロード完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch (e) {
      setBusy('')
      handleError(e)
    }
  }

  const handleRestore = () => {
    reset()
    try {
      restoreBackup()
      alert('復元しました。アプリを再読み込みします。')
      window.location.reload()
    } catch (e) { handleError(e) }
  }

  const pullIsNotNewer = pullConfirm && lastSynced && pullConfirm.exportedAt <= lastSynced

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>クラウド同期</Typography>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2, fontSize: 12 }}>{notice}</Alert>}

      {/* 接続設定 */}
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>接続設定</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          GitHub の非公開 Gist を保存先に使います。Gist 権限のみの fine-grained トークンを発行してください。
          トークンはこの端末の localStorage に平文で保存され、Gist の内容は暗号化されません。
        </Typography>

        <TextField
          label="アクセストークン" type="password" size="small" fullWidth
          value={token} onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..." autoComplete="off"
          sx={{ mb: 1 }}
        />
        <Stack direction="row" gap={1} sx={{ mb: 2 }}>
          <Button size="small" variant="contained" onClick={handleSaveToken} sx={{ fontSize: 12 }}>
            トークンを保存
          </Button>
          <Button size="small" variant="outlined" color="inherit" sx={{ fontSize: 12 }}
            onClick={() => { saveToken(''); setToken(''); reset(); setNotice('トークンを削除しました') }}>
            クリア
          </Button>
        </Stack>

        <TextField
          label="Gist ID" size="small" fullWidth
          value={gistId} onChange={(e) => setGistId(e.target.value)}
          placeholder="初回アップロードで自動作成されます" autoComplete="off"
          sx={{ mb: 1 }}
        />
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" variant="contained" onClick={handleSaveGistId} sx={{ fontSize: 12 }}>
            ID を保存
          </Button>
          <Button size="small" variant="outlined" disabled={!canSync || !!busy} sx={{ fontSize: 12 }}
            startIcon={busy === 'find' ? <CircularProgress size={14} /> : <SearchIcon />}
            onClick={handleFind}>
            既存の Gist を検索
          </Button>
        </Stack>
      </Box>

      {/* 同期 */}
      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>同期</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          この端末: {device} ／ 最終同期: {fmtDateTime(lastSynced)}
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="contained" disabled={!canSync || !!busy} sx={{ flex: '1 1 150px' }}
            startIcon={busy === 'push' ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
            onClick={handlePush}>
            アップロード
          </Button>
          <Button variant="contained" disabled={!canSync || !!busy} sx={{ flex: '1 1 150px' }}
            startIcon={busy === 'pull' ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
            onClick={handlePull}>
            ダウンロード
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          アップロード = この端末 → クラウド（クラウド側を上書き）／
          ダウンロード = クラウド → この端末（この端末を上書き）
        </Typography>
      </Box>

      {/* 復元 */}
      {hasBackup && (
        <>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
            復元
          </Typography>
          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              直近のダウンロード直前の状態に戻します。
            </Typography>
            <Button size="small" variant="outlined" color="warning" startIcon={<RestoreIcon />}
              onClick={handleRestore} sx={{ fontSize: 12 }}>
              ダウンロード前の状態に戻す
            </Button>
          </Box>
        </>
      )}

      {/* アップロード確認（他端末が先に更新している場合） */}
      <Dialog open={!!pushConfirm} onClose={() => setPushConfirm(null)}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>クラウド側が更新されています</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1.5, fontSize: 12 }}>
            前回の同期以降に他の端末からアップロードされています。続行するとその内容は失われます。
          </Alert>
          <DialogContentText sx={{ fontSize: 13 }}>
            クラウド側の保存日時: {fmtDateTime(pushConfirm?.exportedAt)}<br />
            アップロード元: {pushConfirm?.device || '不明'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushConfirm(null)}>キャンセル</Button>
          <Button color="warning" variant="contained"
            onClick={() => { setPushConfirm(null); doPush() }}>
            上書きしてアップロード
          </Button>
        </DialogActions>
      </Dialog>

      {/* ダウンロード確認（常に表示） */}
      <Dialog open={!!pullConfirm} onClose={() => setPullConfirm(null)}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>ダウンロードの確認</DialogTitle>
        <DialogContent>
          {pullIsNotNewer && (
            <Alert severity="warning" sx={{ mb: 1.5, fontSize: 12 }}>
              クラウド側は前回の同期より新しくありません。この端末での変更が失われる可能性があります。
            </Alert>
          )}
          <DialogContentText sx={{ fontSize: 13 }}>
            クラウド側の保存日時: {fmtDateTime(pullConfirm?.exportedAt)}<br />
            アップロード元: {pullConfirm?.device || '不明'}<br />
            データ件数: {pullConfirm ? Object.keys(pullConfirm.data).length : 0} 件<br />
            この端末の最終同期: {fmtDateTime(lastSynced)}
          </DialogContentText>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            この端末のデータは上書きされます。直前の状態は自動でバックアップされ、あとから復元できます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPullConfirm(null)}>キャンセル</Button>
          <Button color="primary" variant="contained" onClick={() => doPull(pullConfirm)}>
            ダウンロードする
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
