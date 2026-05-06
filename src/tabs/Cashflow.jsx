import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Snackbar, Stack,
  TextField, Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AmountField, { parseAmount } from '../components/AmountField'
import { fmt, loadCategories, ymStr } from '../utils/finance'
import {
  CARDS, CATEGORY_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS,
  getBillingYmForDate, loadVar, saveVar,
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

function sortByDate(list) {
  return [...list].sort((a, b) => {
    const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
    if (dateCompare !== 0) return dateCompare
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

function shortDate(date) {
  if (!date) return '日付なし'
  const [, m, d] = date.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function loadExpenses(ym) {
  return Object.values(CARDS).flatMap(card =>
    loadVar(card.id, ym)
      .filter(item => item.sign !== 1)
      .map(item => ({
        ...item,
        cardId: card.id,
        cardName: card.shortName,
        sourceYm: ym,
      }))
  )
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
            value={date} onChange={(e) => setDate(e.target.value)} />
          <FormControl size="small" fullWidth>
            <InputLabel>カード</InputLabel>
            <Select value={cardId} label="カード" onChange={(e) => setCardId(e.target.value)}>
              {Object.values(CARDS).map(card => (
                <MenuItem key={card.id} value={card.id}>{card.shortName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>カテゴリ</InputLabel>
            <Select value={categoryOptions.includes(category) ? category : categoryOptions[0]}
              label="カテゴリ" onChange={(e) => setCategory(e.target.value)}>
              {categoryOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="支払先" size="small" fullWidth
            value={payee} onChange={(e) => setPayee(e.target.value)} />
          <TextField label="項目名" size="small" fullWidth
            value={name} onChange={(e) => setName(e.target.value)} />
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
  const expenses = useMemo(() => sortByDate(loadExpenses(ym)), [ym, version])
  const total = expenses.reduce((sum, item) => sum + item.amount, 0)
  const grouped = expenses.reduce((acc, item) => {
    const date = item.date || '日付なし'
    const last = acc[acc.length - 1]
    if (last && last.date === date) last.items.push(item)
    else acc.push({ date, items: [item] })
    return acc
  }, [])

  const notify = (severity, message) => setSnack({ open: true, severity, message })
  const refresh = () => setVersion(v => v + 1)

  const moveMonth = (delta) => {
    const next = changeYm(year, month, delta)
    setYear(next.year)
    setMonth(next.month)
  }

  const handleSaveEdit = (source, data) => {
    try {
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
        const next = sortByDate(oldList.map(x => x.id === source.id ? nextItem : x))
        saveVar(data.cardId, targetYm, next)
      } else {
        saveVar(source.cardId, source.sourceYm, cleanedOld)
        const targetList = loadVar(data.cardId, targetYm)
        saveVar(data.cardId, targetYm, sortByDate([...targetList, nextItem]))
      }

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
      const next = loadVar(deleteItem.cardId, deleteItem.sourceYm).filter(x => x.id !== deleteItem.id)
      saveVar(deleteItem.cardId, deleteItem.sourceYm, next)
      setDeleteItem(null)
      refresh()
      notify('success', '支出を削除しました')
    } catch {
      notify('error', '支出の削除に失敗しました')
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <IconButton size="small" aria-label="前月" onClick={() => moveMonth(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>{year}年{month}月</Typography>
          <Typography variant="caption" color="text.secondary">支出一覧</Typography>
        </Box>
        <IconButton size="small" aria-label="翌月" onClick={() => moveMonth(1)}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      <Box sx={{ bgcolor: '#263238', color: '#fff', borderRadius: 2, px: 2, py: 1.25, mb: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>月合計</Typography>
        <Typography variant="h6" fontWeight={700}>¥{fmt(total)}</Typography>
      </Box>

      {expenses.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 2, textAlign: 'center' }}>
          この月の支出はありません
        </Typography>
      ) : (
        <Box sx={{ mx: -2 }}>
          {grouped.map(({ date, items }) => (
            <Box key={date}>
              <Box sx={{ px: 2, py: 0.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #eeeeee' }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                  {shortDate(date)}
                  <Typography component="span" variant="caption" sx={{ fontSize: 10, color: 'text.disabled', ml: 1 }}>
                    ¥{fmt(items.reduce((sum, item) => sum + item.amount, 0))}
                  </Typography>
                </Typography>
              </Box>
              {items.map(item => (
                <Box key={`${item.cardId}-${item.id}`} sx={{ px: 2, py: 0.75, borderBottom: '1px solid #f5f5f5' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
                      <Chip label={item.cardName} size="small"
                        sx={{ height: 18, fontSize: 9, flexShrink: 0, bgcolor: CARDS[item.cardId]?.color ?? '#37474f', color: '#fff' }} />
                      <Chip label={item.category} size="small"
                        sx={{ height: 18, fontSize: 9, flexShrink: 0, bgcolor: CATEGORY_COLORS[item.category] ?? '#eceff1', color: '#37474f' }} />
                      {item.spendType && (
                        <Chip label={item.spendType} size="small"
                          sx={{ height: 16, fontSize: 8, flexShrink: 0, bgcolor: SPEND_TYPE_COLORS[item.spendType] ?? '#eceff1', color: '#fff' }} />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </Typography>
                        {item.payee && (
                          <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {item.payee}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 700 }}>¥{fmt(item.amount)}</Typography>
                      <IconButton size="small" aria-label="編集" onClick={() => setEditItem(item)} sx={{ p: 0.75 }}>
                        <EditIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      </IconButton>
                      <IconButton size="small" aria-label="削除" onClick={() => setDeleteItem(item)} sx={{ p: 0.75 }}>
                        <DeleteIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
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
