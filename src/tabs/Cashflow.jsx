import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Snackbar,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AmountField, { parseAmount } from '../components/AmountField'
import { fmt, isActiveForYm, loadCategories, ymStr } from '../utils/finance'
import {
  CARDS, SPEND_TYPES, SPEND_TYPE_COLORS,
  getBillingYmForDate, loadFixed, saveFixed, loadVar, saveVar,
} from '../utils/ccStorage'

function defaultBillingMonth() {
  const today = new Date()
  const cutoff = CARDS.jcb?.cutoffDay ?? 0
  if (cutoff > 0 && today.getDate() <= cutoff) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function changeYm(year, month, delta) {
  let y = year
  let m = month + delta
  if (m > 12) { y += 1; m = 1 }
  if (m < 1) { y -= 1; m = 12 }
  return { year: y, month: m }
}

function dateFromYmDay(ym, day) {
  const d = parseInt(day, 10)
  if (isNaN(d) || d < 1) return null
  const [year, month] = ym.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return `${ym}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

function paymentSource(cardId) {
  return cardId === 'jcb' ? 'JCBカード' : 'VISAカード'
}

function dateLabel(date) {
  if (!date) return '—'
  const d = new Date(`${date}T00:00:00`)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${weekdays[d.getDay()]})`
}

function sortRows(list) {
  return [...list].sort((a, b) => {
    const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
    if (dateCompare !== 0) return dateCompare
    const sourceCompare = (a.cardId ?? '').localeCompare(b.cardId ?? '')
    if (sourceCompare !== 0) return sourceCompare
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

function withCumulative(list) {
  let running = 0
  return list.map(row => {
    running += row.amount
    return { ...row, cumulative: running }
  })
}

function loadExpenseRows(ym) {
  const rows = Object.values(CARDS).flatMap(card => {
    const variableRows = loadVar(card.id, ym)
      .filter(item => item.sign !== 1)
      .map(item => ({
        ...item,
        type: 'var',
        cardId: card.id,
        sourceYm: ym,
        sourceLabel: paymentSource(card.id),
      }))

    const fixedRows = loadFixed(card.id)
      .filter(item => isActiveForYm(item, ym))
      .map(item => ({ item, date: dateFromYmDay(ym, item.day) }))
      .filter(({ date }) => date)
      .map(({ item, date }) => ({
        ...item,
        date,
        type: 'fixed',
        cardId: card.id,
        sourceYm: ym,
        sourceLabel: paymentSource(card.id),
      }))

    return [...variableRows, ...fixedRows]
  })

  return withCumulative(sortRows(rows))
}

function ExpenseEditDialog({ open, item, categories, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [cardId, setCardId] = useState('jcb')
  const [category, setCategory] = useState('')
  const [spendType, setSpendType] = useState('消費')
  const [payee, setPayee] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (!item) return
    setDate(item.date ?? '')
    setCardId(item.cardId ?? 'jcb')
    setCategory(item.category ?? categories[0] ?? 'その他')
    setSpendType(item.spendType ?? '消費')
    setPayee(item.payee ?? '')
    setName(item.name ?? '')
    setAmount(String(item.amount ?? ''))
  }, [item, categories])

  if (!item) return null

  const categoryOptions = [...new Set([category, ...categories].filter(Boolean))]

  const handleSave = () => {
    const parsed = parseAmount(amount)
    if (!date || !name.trim() || parsed <= 0) return
    onSave(item, {
      date,
      amount: parsed,
      category,
      spendType,
      payee: payee.trim(),
      name: name.trim(),
      cardId,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>支出を編集</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField label="日付" type="date" size="small" fullWidth
            InputLabelProps={{ shrink: true }}
            value={date} onChange={(e) => setDate(e.target.value)}
            helperText={item.type === 'fixed' ? '固定費は日付の日だけを保存します' : undefined} />
          <FormControl size="small" fullWidth>
            <InputLabel>支払元</InputLabel>
            <Select value={cardId} label="支払元" onChange={(e) => setCardId(e.target.value)}>
              <MenuItem value="jcb">JCBカード</MenuItem>
              <MenuItem value="smbc">VISAカード</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>項目</InputLabel>
            <Select value={categoryOptions.includes(category) ? category : categoryOptions[0]}
              label="項目" onChange={(e) => setCategory(e.target.value)}>
              {categoryOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="内容" size="small" fullWidth
            value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="支払先" size="small" fullWidth
            value={payee} onChange={(e) => setPayee(e.target.value)} />
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>消費分類</Typography>
            {SPEND_TYPES.map(t => (
              <Box key={t} onClick={() => setSpendType(t)} sx={{
                px: 1.5, py: 0.5, borderRadius: 2, cursor: 'pointer', fontSize: 12, userSelect: 'none',
                bgcolor: spendType === t ? SPEND_TYPE_COLORS[t] : '#f5f5f5',
                color: spendType === t ? '#fff' : 'text.secondary',
                fontWeight: spendType === t ? 700 : 400,
              }}>{t}</Box>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small"
          disabled={!date || !name.trim() || parseAmount(amount) <= 0}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function Cashflow() {
  const initial = defaultBillingMonth()
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [version, setVersion] = useState(0)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' })
  const [categories] = useState(loadCategories)

  const ym = ymStr(year, month)
  const rows = useMemo(() => loadExpenseRows(ym), [ym, version])
  const total = rows.reduce((sum, item) => sum + item.amount, 0)

  const notify = (severity, message) => setSnack({ open: true, severity, message })
  const refresh = () => setVersion(v => v + 1)

  const moveMonth = (delta) => {
    const next = changeYm(year, month, delta)
    setYear(next.year)
    setMonth(next.month)
  }

  const handleSaveVar = (source, data) => {
    const targetYm = getBillingYmForDate(data.date, data.cardId)
    const oldList = loadVar(source.cardId, source.sourceYm)
    const cleanedOld = oldList.filter(x => x.id !== source.id)
    const nextItem = {
      id: source.id,
      name: data.name,
      payee: data.payee,
      amount: data.amount,
      category: data.category,
      date: data.date,
      spendType: data.spendType,
    }

    if (source.cardId === data.cardId && source.sourceYm === targetYm) {
      saveVar(data.cardId, targetYm, sortRows(oldList.map(x => x.id === source.id ? nextItem : x)))
      return
    }

    saveVar(source.cardId, source.sourceYm, cleanedOld)
    saveVar(data.cardId, targetYm, sortRows([...loadVar(data.cardId, targetYm), nextItem]))
  }

  const handleSaveFixed = (source, data) => {
    const oldList = loadFixed(source.cardId)
    const cleanedOld = oldList.filter(x => x.id !== source.id)
    const day = parseInt(data.date.slice(8), 10)
    const current = oldList.find(x => x.id === source.id) ?? source
    const nextItem = {
      ...current,
      name: data.name,
      payee: data.payee,
      amount: data.amount,
      category: data.category,
      spendType: data.spendType,
      day,
    }

    if (source.cardId === data.cardId) {
      saveFixed(data.cardId, oldList.map(x => x.id === source.id ? nextItem : x))
      return
    }

    saveFixed(source.cardId, cleanedOld)
    saveFixed(data.cardId, [...loadFixed(data.cardId), nextItem])
  }

  const handleSaveEdit = (source, data) => {
    try {
      if (source.type === 'fixed') handleSaveFixed(source, data)
      else handleSaveVar(source, data)
      setEditItem(null)
      refresh()
      notify('success', '支出を更新しました')
    } catch {
      notify('error', '支出の更新に失敗しました')
    }
  }

  const handleDelete = () => {
    if (!deleteItem) return
    try {
      if (deleteItem.type === 'fixed') {
        saveFixed(deleteItem.cardId, loadFixed(deleteItem.cardId).filter(x => x.id !== deleteItem.id))
      } else {
        saveVar(deleteItem.cardId, deleteItem.sourceYm, loadVar(deleteItem.cardId, deleteItem.sourceYm).filter(x => x.id !== deleteItem.id))
      }
      setDeleteItem(null)
      refresh()
      notify('success', '支出を削除しました')
    } catch {
      notify('error', '支出の削除に失敗しました')
    }
  }

  const cellSx = { fontSize: 12, py: 0.9, borderColor: '#eeeeee', whiteSpace: 'nowrap' }
  const amountSx = { ...cellSx, textAlign: 'right', color: '#b23b3b', fontVariantNumeric: 'tabular-nums' }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <IconButton size="small" aria-label="前月" onClick={() => moveMonth(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>{year}年{month}月</Typography>
          <Typography variant="caption" color="text.secondary">JCB/VISA 支出明細</Typography>
        </Box>
        <IconButton size="small" aria-label="翌月" onClick={() => moveMonth(1)}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      <Box sx={{ bgcolor: '#263238', color: '#fff', borderRadius: 2, px: 2, py: 1.25, mb: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>月合計</Typography>
        <Typography variant="h6" fontWeight={700}>-¥{fmt(total)}</Typography>
      </Box>

      {rows.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 2, textAlign: 'center' }}>
          この月の支出はありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mx: -2, width: 'calc(100% + 32px)', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f7f4ef' }}>
                {['日付', '支払元', '項目', '内容', '金額', '累計'].map((label, index) => (
                  <TableCell key={label} align={index >= 4 ? 'right' : 'left'} sx={{
                    fontSize: 12, fontWeight: 700, py: 1, whiteSpace: 'nowrap', borderColor: '#e7e2da',
                  }}>
                    {label}
                  </TableCell>
                ))}
                <TableCell sx={{ width: 64, py: 1, borderColor: '#e7e2da' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={`${row.type}-${row.cardId}-${row.id}`} hover>
                  <TableCell sx={cellSx}>{dateLabel(row.date)}</TableCell>
                  <TableCell sx={cellSx}>{row.sourceLabel}</TableCell>
                  <TableCell sx={cellSx}>{row.category}</TableCell>
                  <TableCell sx={{ ...cellSx, minWidth: 160, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </TableCell>
                  <TableCell sx={amountSx}>-{fmt(row.amount)}</TableCell>
                  <TableCell sx={amountSx}>-{fmt(row.cumulative)}</TableCell>
                  <TableCell align="right" sx={{ ...cellSx, px: 0.5 }}>
                    <IconButton size="small" aria-label="編集" onClick={() => setEditItem(row)} sx={{ p: 0.5 }}>
                      <EditIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </IconButton>
                    <IconButton size="small" aria-label="削除" onClick={() => setDeleteItem(row)} sx={{ p: 0.5 }}>
                      <DeleteIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ExpenseEditDialog
        open={!!editItem}
        item={editItem}
        categories={categories}
        onClose={() => setEditItem(null)}
        onSave={handleSaveEdit}
      />

      <Dialog open={!!deleteItem} onClose={() => setDeleteItem(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 16 }}>支出を削除</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            「{deleteItem?.name ?? '支出'}」を削除しますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteItem(null)} color="inherit" size="small">キャンセル</Button>
          <Button onClick={handleDelete} color="error" variant="contained" size="small">削除</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={2200} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  )
}
