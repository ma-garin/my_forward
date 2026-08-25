import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { restoreFromBackup } from '../utils/autoBackup'

/**
 * 起動時にデータが空で、控えが残っているときだけ出す。
 * localStorage が消えても、ここから 1 タップで戻せるようにするのが目的。
 */
export default function RestoreOffer({ backup, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!backup) return null

  const date = backup.name.replace(/^myforward_auto_/, '').replace(/\.json$/, '')

  const restore = async () => {
    setBusy(true); setError('')
    try {
      const n = await restoreFromBackup(backup.name)
      alert(`${n}件を復元しました。アプリを再読み込みします。`)
      window.location.reload()
    } catch (e) {
      setError(`復元できませんでした: ${e.message ?? ''}`)
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onDismiss} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, pb: 1 }}>データが見つかりません</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          端末内に {date} の控えがあります。ここから戻せます。
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          あとで戻す場合は 設定 → データ管理 からも選べます。
        </Typography>
        {error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss} color="inherit" size="small" disabled={busy}>あとで</Button>
        <Button onClick={restore} variant="contained" size="small" disabled={busy}>復元する</Button>
      </DialogActions>
    </Dialog>
  )
}
