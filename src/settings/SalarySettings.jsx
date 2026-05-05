import { useState } from 'react'
import {
  Box, Typography, TextField, Divider, Stack, Button, InputAdornment,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, List,
  ListItem, ListItemText,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { DEFAULT_FIXED, newId } from '../utils/finance'

const STORAGE_KEY = 'salary_simulation'

function loadAll() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const p = JSON.parse(s)
      return {
        fixed:    { ...DEFAULT_FIXED, ...p.fixed },
        payItems: p.payItems ?? [],
        dedItems: p.dedItems ?? [],
      }
    }
  } catch (_) {}
  return { fixed: { ...DEFAULT_FIXED }, payItems: [], dedItems: [] }
}

function saveAll(fixed, payItems, dedItems) {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    const current = s ? JSON.parse(s) : {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, fixed, payItems, dedItems }))
  } catch (_) {}
}

const FIXED_FIELDS = [
  { section: '支給項目（固定）' },
  { key: 'shokunokyuu',   label: '基本給（職能給）', note: '残業単価・雇用保険の計算に使用' },
  { key: 'jyuutakuteate', label: '住宅手当' },
  { key: 'tsuukinteate',  label: '通勤手当',          note: '課税対象外' },
  { key: 'shinyateate',   label: '深夜手当' },
  { key: 'tokumei',       label: '特命手当' },
  { section: '控除項目（固定）' },
  { key: 'kenkouhoken',   label: '健康保険' },
  { key: 'kouseinenkin',  label: '厚生年金' },
  { key: 'jyuuminzei',    label: '住民税' },
  { key: 'kumiaifi',      label: '組合費' },
  { key: 'shokuhi',       label: '食費控除' },
]

function AddItemDialog({ open, onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const handleAdd = () => {
    const n = parseInt(amount.replace(/,/g, ''), 10)
    if (label.trim() && !isNaN(n) && n > 0) {
      onAdd({ id: newId(), label: label.trim(), amount: n })
      setLabel(''); setAmount('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1, fontSize: 15 }}>項目を追加</DialogTitle>
      <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="項目名" size="small" fullWidth autoFocus
          value={label} onChange={e => setLabel(e.target.value)} />
        <TextField label="金額（円）" size="small" fullWidth type="number" inputProps={{ min: 0 }}
          value={amount} onChange={e => setAmount(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">キャンセル</Button>
        <Button onClick={handleAdd} variant="contained" size="small"
          disabled={!label.trim() || !amount}>追加</Button>
      </DialogActions>
    </Dialog>
  )
}

function CustomSection({ title, items, onAdd, onDelete }) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Box sx={{ mb: 0.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
          sx={{ fontSize: 11, py: 0.25, minWidth: 0 }}>追加</Button>
      </Stack>
      {items.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ pl: 1, fontSize: 11 }}>
          項目なし
        </Typography>
      ) : (
        <List dense disablePadding sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
          {items.map((item, i) => (
            <ListItem key={item.id} divider={i < items.length - 1}
              secondaryAction={
                <IconButton size="small" onClick={() => onDelete(item.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              sx={{ py: 0.5 }}>
              <ListItemText
                primary={<Typography fontSize={13}>{item.label}</Typography>}
                secondary={<Typography fontSize={11} color="text.secondary">¥{item.amount.toLocaleString('ja-JP')}</Typography>}
              />
            </ListItem>
          ))}
        </List>
      )}
      <AddItemDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={onAdd} />
    </Box>
  )
}

export default function SalarySettings() {
  const init = loadAll()
  const [fixed,    setFixed]    = useState(init.fixed)
  const [payItems, setPayItems] = useState(init.payItems)
  const [dedItems, setDedItems] = useState(init.dedItems)
  const [saved, setSaved] = useState(false)

  const handleChange = (key, val) => {
    const n = parseInt(val.replace(/,/g, ''), 10)
    setFixed(prev => ({ ...prev, [key]: isNaN(n) ? 0 : n }))
    setSaved(false)
  }

  const handleSave = () => {
    saveAll(fixed, payItems, dedItems)
    setSaved(true)
  }

  const addPay = (item) => { const next = [...payItems, item]; setPayItems(next); saveAll(fixed, next, dedItems); setSaved(false) }
  const addDed = (item) => { const next = [...dedItems, item]; setDedItems(next); saveAll(fixed, payItems, next); setSaved(false) }
  const delPay = (id)   => { const next = payItems.filter(x => x.id !== id); setPayItems(next); saveAll(fixed, next, dedItems); setSaved(false) }
  const delDed = (id)   => { const next = dedItems.filter(x => x.id !== id); setDedItems(next); saveAll(fixed, payItems, next); setSaved(false) }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>給与設定</Typography>

      {FIXED_FIELDS.map((f, i) =>
        f.section ? (
          <Box key={i}>
            {i > 0 && <Divider sx={{ my: 2 }} />}
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
              {f.section}
            </Typography>
          </Box>
        ) : (
          <TextField
            key={f.key}
            label={f.note ? `${f.label}（${f.note}）` : f.label}
            value={fixed[f.key] === 0 ? '' : fixed[f.key].toLocaleString('ja-JP')}
            onChange={(e) => handleChange(f.key, e.target.value)}
            size="small" fullWidth sx={{ mb: 1.5 }}
            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
          />
        )
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
        残業
      </Typography>
      <TextField
        label="残業単価（時給）"
        size="small" fullWidth sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
        defaultValue={(() => { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return s.unitPrice || '' } catch { return '' } })()}
        onChange={(e) => {
          try {
            const s = localStorage.getItem(STORAGE_KEY)
            const cur = s ? JSON.parse(s) : {}
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, unitPrice: parseFloat(e.target.value) || 0 }))
          } catch (_) {}
          setSaved(false)
        }}
      />

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1.5, display: 'block' }}>
        カスタム項目（給与タブに反映されます）
      </Typography>
      <Stack spacing={2}>
        <CustomSection title="支給項目（カスタム）" items={payItems} onAdd={addPay} onDelete={delPay} />
        <CustomSection title="控除項目（カスタム）" items={dedItems} onAdd={addDed} onDelete={delDed} />
      </Stack>

      <Divider sx={{ my: 2 }} />
      <Button variant="contained" fullWidth onClick={handleSave}>
        {saved ? '保存しました ✓' : '保存する'}
      </Button>
    </Box>
  )
}
