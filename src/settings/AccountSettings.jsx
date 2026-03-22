import { useState } from 'react'
import {
  Box, Typography, Stack, Button, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { loadAccounts, saveAccounts, newId } from '../utils/finance'

function AccountDialog({ initial, onSave, onClose }) {
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [group,     setGroup]     = useState(initial?.group     ?? '')
  const [groupName, setGroupName] = useState(initial?.groupName ?? '')

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? '口座を編集' : '口座を追加'}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField label="口座名" value={name} onChange={e => setName(e.target.value)} size="small" fullWidth />
          <TextField label="グループID（任意）" value={group} onChange={e => setGroup(e.target.value)} size="small" fullWidth
            helperText="同じIDの口座をまとめて表示します" />
          <TextField label="グループ名（任意）" value={groupName} onChange={e => setGroupName(e.target.value)} size="small" fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" disabled={!name.trim()}
          onClick={() => onSave({
            name: name.trim(),
            ...(group ? { group: group.trim(), groupName: groupName.trim() } : {}),
          })}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function AccountSettings() {
  const [accounts, setAccounts] = useState(loadAccounts)
  const [dlg, setDlg] = useState(null)

  const handleSave = (data) => {
    let next
    if (dlg.mode === 'add') {
      next = [...accounts, { id: newId(), ...data }]
    } else {
      next = accounts.map(a => a.id === dlg.initial.id ? { ...a, ...data } : a)
    }
    setAccounts(next)
    saveAccounts(next)
    setDlg(null)
  }

  const handleDelete = (id) => {
    const next = accounts.filter(a => a.id !== id)
    setAccounts(next)
    saveAccounts(next)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>口座設定</Typography>

      {accounts.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          口座がありません。追加してください。
        </Typography>
      )}

      <Stack gap={1} sx={{ mb: 2 }}>
        {accounts.map(acc => (
          <Box key={acc.id} sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={600} fontSize={14}>{acc.name}</Typography>
                {acc.groupName && (
                  <Typography variant="caption" color="text.secondary">{acc.groupName}</Typography>
                )}
              </Box>
              <Stack direction="row">
                <IconButton size="small" onClick={() => setDlg({ mode: 'edit', initial: acc })}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(acc.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Button variant="outlined" startIcon={<AddIcon />} fullWidth onClick={() => setDlg({ mode: 'add' })}>
        口座を追加
      </Button>

      {dlg && <AccountDialog initial={dlg.initial} onSave={handleSave} onClose={() => setDlg(null)} />}
    </Box>
  )
}
