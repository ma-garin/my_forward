import { useState } from 'react'
import {
  Box, Typography, Button, Stack, Alert, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import SearchIcon from '@mui/icons-material/Search'
import RestoreIcon from '@mui/icons-material/Restore'
import {
  GistSyncError, applyPulledSnapshot, restoreBackup, loadBackup,
  fetchRemoteSnapshot, pushSnapshot, findExistingGist, checkRemoteConflict,
  loadToken, saveToken, loadGistId, saveGistId, loadLastSyncedAt, detectDevice,
} from '../utils/gistSync'

const DEVICE = detectDevice()

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ja-JP')
}

function ConfirmDialog({ open, title, warning, confirmLabel, confirmColor, onConfirm, onClose, children }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {warning && <Alert severity="warning" sx={{ mb: 1.5, fontSize: 12 }}>{warning}</Alert>}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button color={confirmColor} variant="contained" onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function SyncSettings() {
  const [token, setToken] = useState(() => loadToken())
  const [gistId, setGistId] = useState(() => loadGistId())
  const [lastSynced, setLastSynced] = useState(() => loadLastSyncedAt())
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  // 確認ダイアログ。push / pull は同時に開かないので単一の state で持つ。
  const [confirm, setConfirm] = useState(null)

  // 適用直後は必ずリロードするため、マウント時の判定で足りる。
  const hasBackup = !!loadBackup()
  const canSync = !!token

  const notify = (text) => setMsg({ severity: 'success', text })
  const handleError = (e) => setMsg({
    severity: 'error',
    text: e instanceof GistSyncError ? e.message : '同期に失敗しました',
  })

  // 各操作の共通スキャフォールド（メッセージ初期化 → 実行 → 後始末）。
  const run = async (kind, fn) => {
    setMsg(null)
    setBusy(kind)
    try { await fn() } catch (e) { handleError(e) } finally { setBusy('') }
  }

  const applyToken = (v) => {
    setMsg(null)
    saveToken(v)
    setToken(v)
    notify(v ? 'トークンを保存しました' : 'トークンを削除しました')
  }

  const applyGistId = (v) => {
    setMsg(null)
    saveGistId(v)
    setGistId(v)
    notify(v ? 'Gist ID を保存しました' : 'Gist ID を削除しました')
  }

  const handleFind = () => run('find', async () => {
    const found = await findExistingGist(token)
    if (!found) return notify('同期用の Gist は見つかりませんでした。アップロードすると新規作成されます')
    saveGistId(found)
    setGistId(found)
    notify('既存の Gist が見つかりました')
  })

  const upload = async () => {
    setGistId(await pushSnapshot(token))
    setLastSynced(loadLastSyncedAt())
    notify('アップロードが完了しました')
  }

  const doPush = () => run('push', upload)

  const handlePush = () => run('push', async () => {
    const conflict = await checkRemoteConflict(token, loadGistId())
    if (conflict) return setConfirm({ kind: 'push', envelope: conflict })
    await upload()
  })

  const handlePull = () => run('pull', async () => {
    const id = loadGistId()
    if (!id) throw new GistSyncError('not_found', 'Gist ID が未設定です。「既存の Gist を検索」または ID を入力してください')
    setConfirm({ kind: 'pull', envelope: await fetchRemoteSnapshot(token, id) })
  })

  const doPull = (envelope) => {
    setConfirm(null)
    setMsg(null)
    try {
      applyPulledSnapshot(envelope)
      alert('ダウンロード完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch (e) { handleError(e) }
  }

  const handleRestore = () => {
    setMsg(null)
    try {
      restoreBackup()
      alert('復元しました。アプリを再読み込みします。')
      window.location.reload()
    } catch (e) { handleError(e) }
  }

  const remote = confirm?.envelope
  const isPull = confirm?.kind === 'pull'
  const pullIsNotNewer = isPull && lastSynced && remote.exportedAt <= lastSynced

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>クラウド同期</Typography>

      {msg && <Alert severity={msg.severity} sx={{ mb: 2, fontSize: 12 }}>{msg.text}</Alert>}

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
          <Button size="small" variant="contained" sx={{ fontSize: 12 }}
            onClick={() => applyToken(token.trim())}>
            トークンを保存
          </Button>
          <Button size="small" variant="outlined" color="inherit" sx={{ fontSize: 12 }}
            onClick={() => applyToken('')}>
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
          <Button size="small" variant="contained" sx={{ fontSize: 12 }}
            onClick={() => applyGistId(gistId.trim())}>
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
          この端末: {DEVICE} ／ 最終同期: {fmtDateTime(lastSynced)}
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

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={isPull ? 'ダウンロードの確認' : 'クラウド側が更新されています'}
        warning={
          isPull
            ? (pullIsNotNewer && 'クラウド側は前回の同期より新しくありません。この端末での変更が失われる可能性があります。')
            : '前回の同期以降に他の端末からアップロードされています。続行するとその内容は失われます。'
        }
        confirmLabel={isPull ? 'ダウンロードする' : '上書きしてアップロード'}
        confirmColor={isPull ? 'primary' : 'warning'}
        onConfirm={() => (isPull ? doPull(remote) : (setConfirm(null), doPush()))}
      >
        <DialogContentText sx={{ fontSize: 13 }}>
          クラウド側の保存日時: {fmtDateTime(remote?.exportedAt)}<br />
          アップロード元: {remote?.device || '不明'}
          {isPull && <>
            <br />データ件数: {Object.keys(remote?.data || {}).length} 件
            <br />この端末の最終同期: {fmtDateTime(lastSynced)}
          </>}
        </DialogContentText>
        {isPull && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            この端末のデータは上書きされます。直前の状態は自動でバックアップされ、あとから復元できます。
          </Typography>
        )}
      </ConfirmDialog>
    </Box>
  )
}
