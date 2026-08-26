import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Button, Stack, Divider, Alert, CircularProgress } from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import IosShareIcon from '@mui/icons-material/IosShare'
import { isAutoBackupAvailable, listBackups, readBackup, restoreFromBackup } from '../utils/autoBackup'
import { saveFile } from '../utils/saveFile'

/**
 * 自動で取った控えの一覧。
 *
 * 端末内の控えなので、端末ごと失う事故には効かない。外へ出したいときのために
 * 各行から共有もできるようにしてある。
 */

const fmtDate = (name) => name.replace(/^myforward_auto_/, '').replace(/\.json$/, '')
const fmtSize = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function AutoBackupList() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(() => { listBackups().then(setItems).catch(() => setItems([])) }, [])
  useEffect(() => { refresh() }, [refresh])

  if (!isAutoBackupAvailable()) return null

  const handleRestore = async (name) => {
    if (!window.confirm(`${fmtDate(name)} の控えで今のデータを置き換えます。よろしいですか？`)) return
    setBusy(name); setError(''); setMessage('')
    try {
      const n = await restoreFromBackup(name)
      alert(`${n}件を復元しました。アプリを再読み込みします。`)
      window.location.reload()
    } catch (e) {
      setError(`復元できませんでした: ${e.message ?? ''}`)
      setBusy('')
    }
  }

  const handleShare = async (name) => {
    setBusy(name); setError(''); setMessage('')
    try {
      const text = await readBackup(name)
      const result = await saveFile(new Blob([text], { type: 'application/json' }), name)
      setMessage(result === 'shared' ? '保存先に渡しました' : '')
    } catch (e) {
      setError(`書き出せませんでした: ${e.message ?? ''}`)
    } finally {
      setBusy('')
    }
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        自動バックアップ
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 1, py: 0.25, fontSize: 12 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1, py: 0.25, fontSize: 12 }}>{error}</Alert>}

      {items.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1.5, textAlign: 'center' }}>
          まだ控えはありません（週に 1 回、自動で取ります）
        </Typography>
      ) : (
        <Box sx={{ border: '1px solid var(--divider)', borderRadius: 2, px: 2 }}>
          {items.map((item, i) => (
            <Box key={item.name}>
              {i > 0 && <Divider />}
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ py: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontSize={13} fontWeight={500}>{fmtDate(item.name)}</Typography>
                  <Typography variant="caption" color="text.secondary">{fmtSize(item.size)}</Typography>
                </Box>
                <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
                  <Button size="small" onClick={() => handleShare(item.name)} disabled={!!busy}
                    startIcon={busy === item.name ? <CircularProgress size={12} /> : <IosShareIcon sx={{ fontSize: 16 }} />}
                    sx={{ fontSize: 12, minWidth: 0 }}>
                    共有
                  </Button>
                  <Button size="small" color="error" onClick={() => handleRestore(item.name)} disabled={!!busy}
                    startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
                    sx={{ fontSize: 12, minWidth: 0 }}>
                    復元
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: 11 }}>
        週に 1 回、端末内に控えを取ります（新しい 5 件を保持）。
        端末ごと失う事故には効かないので、上の一括エクスポートも併用してください。
      </Typography>
    </Box>
  )
}
