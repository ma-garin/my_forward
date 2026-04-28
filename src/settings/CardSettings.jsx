import { useState } from 'react'
import {
  Box, Typography, Stack, Button, TextField, IconButton,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { loadCards, saveCards, newId } from '../utils/finance'

const COLORS = ['#37474f', '#1b5e20', '#1a237e', '#4a148c', '#b71c1c', '#e65100']

function CardDialog({ initial, onSave, onClose }) {
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [shortName,   setShortName]   = useState(initial?.shortName   ?? '')
  const [cutoffDay,   setCutoffDay]   = useState(initial?.cutoffDay   ?? 15)
  const [paymentDay,  setPaymentDay]  = useState(initial?.paymentDay  ?? 10)
  const [color,       setColor]       = useState(initial?.color       ?? COLORS[0])

  const valid = name.trim() && shortName.trim()

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'カードを編集' : 'カードを追加'}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField label="カード名" value={name} onChange={e => setName(e.target.value)} size="small" fullWidth />
          <TextField label="略称（タブ表示名）" value={shortName} onChange={e => setShortName(e.target.value)} size="small" fullWidth />
          <Stack direction="row" gap={1}>
            <TextField
              label="締め日" type="number" size="small" fullWidth
              value={cutoffDay} onChange={e => setCutoffDay(Number(e.target.value))}
              helperText="0=月末"
              inputProps={{ min: 0, max: 31 }}
            />
            <TextField
              label="支払い日" type="number" size="small" fullWidth
              value={paymentDay} onChange={e => setPaymentDay(Number(e.target.value))}
              inputProps={{ min: 1, max: 31 }}
            />
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary">カラー</Typography>
            <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setColor(c)}
                  sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                    border: color === c ? '3px solid #000' : '3px solid transparent' }} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" disabled={!valid}
          onClick={() => onSave({ name: name.trim(), shortName: shortName.trim(), cutoffDay, paymentDay, color })}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function CardSettings() {
  const [cards, setCards] = useState(loadCards)
  const [dlg, setDlg] = useState(null) // null | { mode: 'add' | 'edit', initial? }

  const handleSave = (data) => {
    let next
    if (dlg.mode === 'add') {
      next = [...cards, { id: newId(), ...data }]
    } else {
      next = cards.map(c => c.id === dlg.initial.id ? { ...c, ...data } : c)
    }
    setCards(next)
    saveCards(next)
    setDlg(null)
  }

  const handleDelete = (id) => {
    const next = cards.filter(c => c.id !== id)
    setCards(next)
    saveCards(next)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>カード設定</Typography>

      {cards.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          カードがありません。追加してください。
        </Typography>
      )}

      <Stack gap={1} sx={{ mb: 2 }}>
        {cards.map(card => (
          <Box key={card.id} sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 2,
            borderLeft: `4px solid ${card.color}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={600} fontSize={14}>{card.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.cutoffDay === 0 ? '月末締め' : `${card.cutoffDay}日締め`}　翌月{card.paymentDay}日払い
                </Typography>
              </Box>
              <Stack direction="row">
                <IconButton size="small" aria-label="カードを編集" onClick={() => setDlg({ mode: 'edit', initial: card })}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="カードを削除" onClick={() => handleDelete(card.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Button variant="outlined" startIcon={<AddIcon />} fullWidth onClick={() => setDlg({ mode: 'add' })}>
        カードを追加
      </Button>

      {dlg && <CardDialog initial={dlg.initial} onSave={handleSave} onClose={() => setDlg(null)} />}
    </Box>
  )
}
