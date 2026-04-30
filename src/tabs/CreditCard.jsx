import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell, Fab,
  Snackbar, Alert, Collapse, InputBase, Checkbox,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import { loadCategories, saveCategories, fmt, ymStr, newId } from '../utils/finance'
import {
  CARDS, CATEGORY_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS,
  prevBusinessDay, sumLiving,
  loadFixed, saveFixed, loadVar, saveVar,
  loadLimit, saveLimit, loadBilled, saveBilled,
} from '../utils/ccStorage'
import AmountField, { CalcPad, parseAmount } from '../components/AmountField'
import { VarExpenseTable, DailyBarChart } from '../components/CCExpenseViews'
import { CategoryChart, CategoryBreakdown } from '../components/CategoryViews'
import LivingExpenseCard from '../components/LivingExpenseCard'
import CombinedSummary from '../components/CombinedSummary'
import BudgetBreakdown from '../components/BudgetBreakdown'

// ─── カテゴリ管理ダイアログ ────────────────────────────────

function CategoryDialog({ open, onClose, categories, onChange }) {
  const [newCat, setNewCat] = useState('')

  const handleAdd = () => {
    const v = newCat.trim()
    if (!v || categories.includes(v)) return
    onChange([...categories, v])
    setNewCat('')
  }

  const handleDelete = (i) => {
    const next = categories.filter((_, idx) => idx !== i)
    onChange(next)
  }

  const handleMove = (i, dir) => {
    const next = [...categories]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>カテゴリ管理</DialogTitle>
      <DialogContent sx={{ px: 2, pt: 0.5 }}>
        <Stack spacing={0}>
          {categories.map((cat, i) => (
            <Stack key={cat} direction="row" alignItems="center" gap={0.5}
              sx={{ py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
              <Typography sx={{ flex: 1, fontSize: 14 }}>{cat}</Typography>
              <IconButton size="small" aria-label="上に移動" onClick={() => handleMove(i, -1)} disabled={i === 0}
                sx={{ p: 0.75, color: i === 0 ? 'transparent' : 'text.disabled' }}>
                <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" aria-label="下に移動" onClick={() => handleMove(i, 1)} disabled={i === categories.length - 1}
                sx={{ p: 0.75, color: i === categories.length - 1 ? 'transparent' : 'text.disabled' }}>
                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" aria-label="削除" onClick={() => handleDelete(i)} sx={{ p: 0.75, color: 'error.light' }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" gap={1}>
          <TextField
            size="small" placeholder="新しいカテゴリ" fullWidth
            value={newCat} onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAdd()}
          />
          <Button variant="contained" size="small" onClick={handleAdd} sx={{ minWidth: 48 }}>
            追加
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">閉じる</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── 費用入力ダイアログ ───────────────────────────────────

function ExpenseDialog({ open, onClose, onSave, initial, title, categories }) {
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [payee,     setPayee]     = useState(initial?.payee     ?? '')
  const [amount,    setAmount]    = useState(initial?.amount    ?? '')
  const [category,  setCategory]  = useState(initial?.category  ?? categories[0] ?? 'その他')
  const [date,      setDate]      = useState(initial?.date      ?? '')
  const [day,       setDay]       = useState(initial?.day       ?? '')
  const [startYm,   setStartYm]   = useState(initial?.startYm   ?? '')
  const [spendType, setSpendType] = useState(initial?.spendType ?? '消費')

  const isFixed = title?.includes('固定')

  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0) return
    const d = parseInt(day, 10)
    onSave({
      name: name.trim(), payee: payee.trim(), amount: a, category, spendType,
      ...(isFixed ? { day: (!isNaN(d) && d >= 1 && d <= 31) ? d : undefined, startYm: startYm || undefined } : { date }),
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {!isFixed && (
            <TextField label="日付" type="date" size="small" fullWidth
              InputLabelProps={{ shrink: true }}
              value={date} onChange={(e) => setDate(e.target.value)} />
          )}
          {isFixed && (
            <>
              <TextField label="支払日" type="date" size="small" fullWidth
                InputLabelProps={{ shrink: true }}
                value={(() => {
                  if (!day) return ''
                  const now = new Date()
                  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                  return `${ym}-${String(day).padStart(2, '0')}`
                })()}
                onChange={(e) => {
                  const d = e.target.value ? parseInt(e.target.value.slice(8), 10) : ''
                  setDay(isNaN(d) ? '' : String(d))
                }} />
              <TextField label="開始年月" type="month" size="small" fullWidth
                InputLabelProps={{ shrink: true }}
                value={startYm}
                onChange={(e) => setStartYm(e.target.value)}
                helperText="未設定の場合は全ての月に反映されます" />
            </>
          )}
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>カテゴリ</InputLabel>
              <Select value={categories.includes(category) ? category : (categories[0] ?? '')}
                label="カテゴリ" onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="支払先" size="small" sx={{ flex: 1 }} placeholder="例: Google"
              value={payee} onChange={(e) => setPayee(e.target.value)} />
          </Stack>
          <TextField label="項目名" size="small" fullWidth placeholder="例: YouTube Premium"
            value={name} onChange={(e) => setName(e.target.value)} />
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12, minWidth: 52 }}>消費分類</Typography>
            <Stack direction="row" gap={0.75}>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small"
          disabled={!name.trim() || parseAmount(amount) <= 0}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── 変動費クイック入力（ボトムシート）──────────────────

// ─── 変動費クイック入力（ボトムシート）──────────────────

const TYPE_DEFS = [
  { value: 'income',   label: '収入', color: '#1565c0' },
  { value: 'expense',  label: '支出', color: '#c62828' },
  { value: 'transfer', label: '振替', color: '#37474f' },
]

function QuickAddDrawer({ open, onClose, onSave, categories, defaultDate, onEditCategories, currentCardId }) {
  const [type,      setType]      = useState('expense')
  const [amount,    setAmount]    = useState('')
  const [category,  setCategory]  = useState(categories[0] ?? 'その他')
  const [name,      setName]      = useState('')
  const [payee,     setPayee]     = useState('')
  const [memo,      setMemo]      = useState('')
  const [date,      setDate]      = useState(defaultDate)
  const [card,      setCard]      = useState(currentCardId)
  const [fromCard,  setFromCard]  = useState(currentCardId)
  const [toCard,    setToCard]    = useState(currentCardId === 'jcb' ? 'smbc' : 'jcb')
  const [spendType, setSpendType] = useState('消費')
  const [catOpen,     setCatOpen]     = useState(false)
  const [textFocused, setTextFocused] = useState(false)
  const dateInputRef = useRef(null)

  // キーボード表示時にDrawerをvisual viewport内に収める
  const [maxH, setMaxH] = useState('90vh')
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setMaxH(vv.height)
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { if (!open) { setDate(defaultDate); setCard(currentCardId) } }, [defaultDate, currentCardId, open])

  const reset = () => {
    setType('expense'); setDate(defaultDate); setAmount('')
    setName(''); setPayee(''); setMemo('')
    setCategory(categories[0] ?? 'その他'); setCatOpen(false)
    setCard(currentCardId); setFromCard(currentCardId)
    setToCard(currentCardId === 'jcb' ? 'smbc' : 'jcb')
    setSpendType('消費')
  }

  const doSave = () => {
    const a = parseAmount(amount)
    if (a <= 0) return
    if (type === 'transfer') {
      onSave({ transfer: true, fromCard, toCard, item: { name: memo.trim() || '振替', amount: a, category: 'その他', date } })
    } else {
      onSave({
        cardId: card,
        item: {
          name: name.trim() || (type === 'income' ? '収入' : category),
          payee: payee.trim(), amount: a, category, date,
          ...(type === 'income' ? { sign: 1 } : { spendType }),
        },
      })
    }
    reset(); onClose()
  }

  const typeColor = TYPE_DEFS.find(t => t.value === type)?.color ?? '#333'
  const cardList  = Object.values(CARDS)
  const fmtDate   = (d) => { const [y, m, day] = d.split('-'); return `${y}/${m}/${day}` }
  const ROW   = { display: 'flex', alignItems: 'center', px: 2, minHeight: 48, borderBottom: '1px solid #f0f0f0' }
  const LABEL = { fontSize: 13, color: '#757575', width: 52, flexShrink: 0 }

  return (
    <SwipeableDrawer
      anchor="bottom" open={open}
      onClose={onClose} onOpen={reset}
      disableSwipeToOpen disableScrollLock
      PaperProps={{ sx: { borderRadius: '16px 16px 0 0', maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', maxHeight: maxH } }}
    >
      {/* タイプタブ */}
      <Stack direction="row" sx={{ borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        {TYPE_DEFS.map(({ value, label, color }) => (
          <Box key={value} flex={1} onClick={() => setType(value)} sx={{
            textAlign: 'center', py: 1.5, fontSize: 14, cursor: 'pointer', userSelect: 'none',
            fontWeight: type === value ? 700 : 400,
            color: type === value ? color : '#9e9e9e',
            borderBottom: type === value ? `3px solid ${color}` : '3px solid transparent',
            transition: 'all .15s',
          }}>{label}</Box>
        ))}
      </Stack>

      {/* フォームエリア（スクロール可） */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* 日付 */}
        <Box sx={{ ...ROW, cursor: 'pointer' }} onClick={() => dateInputRef.current?.click()}>
          <Typography sx={LABEL}>日付</Typography>
          <Typography sx={{ flex: 1, fontSize: 15 }}>{fmtDate(date)}</Typography>
          <input ref={dateInputRef} type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: '-100px' }} />
        </Box>

        {/* 収入 / 支出 */}
        {(type === 'expense' || type === 'income') && (
          <>
            {type === 'expense' && (
              <>
                <Box sx={{ ...ROW, cursor: 'pointer' }} onClick={() => setCatOpen(v => !v)}>
                  <Typography sx={LABEL}>分類</Typography>
                  <Typography sx={{ flex: 1, fontSize: 15 }}>{category}</Typography>
                  <IconButton size="small" aria-label="カテゴリ設定" onClick={e => { e.stopPropagation(); onEditCategories() }} sx={{ p: 0.75 }}>
                    <SettingsIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  </IconButton>
                </Box>
                {catOpen && (
                  <Box sx={{ px: 2, py: 1, bgcolor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {categories.map(cat => (
                        <Chip key={cat} label={cat} onClick={() => { setCategory(cat); setCatOpen(false) }} sx={{
                          fontWeight: category === cat ? 700 : 400, fontSize: 12,
                          bgcolor: category === cat ? (CATEGORY_COLORS[cat] ?? '#e0e0e0') : '#f5f5f5',
                          border: category === cat ? '2px solid' : '1px solid transparent',
                          borderColor: category === cat ? 'primary.main' : 'transparent',
                        }} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}

            {type === 'expense' && (
              <Box sx={{ ...ROW, gap: 1 }}>
                <Typography sx={LABEL}>消費分類</Typography>
                <Stack direction="row" gap={0.75}>
                  {SPEND_TYPES.map(t => (
                    <Box key={t} onClick={() => setSpendType(t)} sx={{
                      px: 1.25, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 13, userSelect: 'none',
                      bgcolor: spendType === t ? SPEND_TYPE_COLORS[t] : '#f5f5f5',
                      color: spendType === t ? '#fff' : '#757575',
                      fontWeight: spendType === t ? 700 : 400,
                    }}>{t}</Box>
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={ROW}>
              <Typography sx={LABEL}>支払先</Typography>
              <InputBase fullWidth placeholder="省略可" value={payee}
                onChange={e => setPayee(e.target.value)} sx={{ flex: 1, fontSize: 15 }}
                onFocus={() => setTextFocused(true)} onBlur={() => setTextFocused(false)} />
            </Box>

            <Box sx={ROW}>
              <Typography sx={LABEL}>項目名</Typography>
              <InputBase fullWidth placeholder="省略可" value={name}
                onChange={e => setName(e.target.value)} sx={{ flex: 1, fontSize: 15 }}
                onFocus={() => setTextFocused(true)} onBlur={() => setTextFocused(false)} />
            </Box>

            {type === 'expense' && (
              <Box sx={ROW}>
                <Typography sx={LABEL}>カード</Typography>
                <Select value={card} onChange={e => setCard(e.target.value)}
                  variant="standard" disableUnderline
                  sx={{ flex: 1, fontSize: 15, '& .MuiSelect-select': { p: 0 } }}>
                  {cardList.map(c => <MenuItem key={c.id} value={c.id}>{c.shortName}</MenuItem>)}
                </Select>
              </Box>
            )}
          </>
        )}

        {/* 振替 */}
        {type === 'transfer' && (
          <>
            <Box sx={ROW}>
              <Typography sx={LABEL}>出金</Typography>
              <Select value={fromCard} onChange={e => setFromCard(e.target.value)}
                variant="standard" disableUnderline
                sx={{ flex: 1, fontSize: 15, '& .MuiSelect-select': { p: 0 } }}>
                {cardList.map(c => <MenuItem key={c.id} value={c.id}>{c.shortName}</MenuItem>)}
              </Select>
            </Box>
            <Box sx={ROW}>
              <Typography sx={LABEL}>入金</Typography>
              <Select value={toCard} onChange={e => setToCard(e.target.value)}
                variant="standard" disableUnderline
                sx={{ flex: 1, fontSize: 15, '& .MuiSelect-select': { p: 0 } }}>
                {cardList.map(c => <MenuItem key={c.id} value={c.id}>{c.shortName}</MenuItem>)}
              </Select>
            </Box>
            <Box sx={ROW}>
              <Typography sx={LABEL}>内容</Typography>
              <InputBase fullWidth placeholder="省略可" value={memo}
                onChange={e => setMemo(e.target.value)} sx={{ flex: 1, fontSize: 15 }}
                onFocus={() => setTextFocused(true)} onBlur={() => setTextFocused(false)} />
            </Box>
          </>
        )}
      </Box>

      {/* 金額ディスプレイ・電卓（テキスト入力中は非表示） */}
      {!textFocused && (
        <>
          <Box sx={{
            bgcolor: '#263238', px: 2, py: 1.5, flexShrink: 0,
            display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5,
          }}>
            {type !== 'transfer' && (
              <Typography sx={{ color: typeColor, fontSize: 20, fontWeight: 700, mr: 0.25 }}>
                {type === 'income' ? '+' : '−'}
              </Typography>
            )}
            <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
            <Typography sx={{ color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 44 }}>
              {parseAmount(amount) > 0 ? fmt(parseAmount(amount)) : '0'}
            </Typography>
          </Box>
          <CalcPad value={amount} onChange={setAmount} onConfirm={doSave} disabled={parseAmount(amount) <= 0} />
        </>
      )}
    </SwipeableDrawer>
  )
}


// ─── 固定費テーブル ───────────────────────────────────────

function FixedExpenseTable({ fixedList, onEdit, onDelete, billedIds = [], onToggleBilled }) {
  if (fixedList.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>
      固定費を追加してください
    </Typography>
  )

  let running = 0
  const rows = fixedList.map((item) => {
    running += item.amount
    return { ...item, subtotal: running }
  })

  return (
    <Box sx={{ overflowX: 'auto', mx: -2 }}>
      <Table size="small" sx={{ minWidth: 480 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
            <TableCell sx={{ width: 40, py: 0.75, pl: 1.5, pr: 0 }} />
            {['カテゴリ', '支払先', '項目名', '金額', '小計'].map((h) => (
              <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap',
                ...(h === '金額' || h === '小計' ? { textAlign: 'right' } : {}) }}>
                {h}
              </TableCell>
            ))}
            <TableCell sx={{ width: 56 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((item, i) => {
            const billed = billedIds.includes(item.id)
            return (
              <TableRow key={item.id} sx={{
                bgcolor: billed ? '#f1f8e9' : i % 2 === 0 ? '#fff' : '#fafafa',
                opacity: billed ? 0.6 : 1,
                '&:hover': { bgcolor: billed ? '#e8f5e9' : '#f1f8e9' },
              }}>
                <TableCell sx={{ py: 0.5, pl: 1.5, pr: 0 }}>
                  <Checkbox
                    checked={billed}
                    onChange={() => onToggleBilled(item.id)}
                    size="small"
                    sx={{ p: 0.25, color: '#bdbdbd', '&.Mui-checked': { color: '#43a047' } }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 11, py: 0.75 }}>
                  <Chip label={item.category} size="small"
                    sx={{ height: 16, fontSize: 9, bgcolor: CATEGORY_COLORS[item.category] ?? '#eceff1', color: '#37474f' }} />
                </TableCell>
                <TableCell sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>{item.payee ?? '—'}</TableCell>
                <TableCell sx={{ fontSize: 12, py: 0.75 }}>
                  <span style={billed ? { textDecoration: 'line-through', color: '#9e9e9e' } : {}}>
                    {item.name}
                  </span>
                  {item.day != null && (
                    <Typography component="div" variant="caption" color="text.disabled" sx={{ fontSize: 10, lineHeight: 1.2 }}>
                      毎月{item.day}日
                    </Typography>
                  )}
                  {item.startYm && (
                    <Typography component="div" variant="caption" color="text.disabled" sx={{ fontSize: 10, lineHeight: 1.2 }}>
                      {item.startYm.replace('-', '/')}〜
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontSize: 12, py: 0.75, textAlign: 'right', fontWeight: 500 }}>¥{fmt(item.amount)}</TableCell>
                <TableCell sx={{ fontSize: 12, py: 0.75, textAlign: 'right', color: 'text.secondary' }}>¥{fmt(item.subtotal)}</TableCell>
                <TableCell sx={{ py: 0.5, px: 0.5 }}>
                  <Stack direction="row">
                    <IconButton size="small" aria-label="編集" onClick={() => onEdit(item)} sx={{ p: 0.75 }}>
                      <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                    </IconButton>
                    <IconButton size="small" aria-label="削除" onClick={() => onDelete(item.id)} sx={{ p: 0.75 }}>
                      <DeleteIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}

// ─── 年間サマリー ────────────────────────────────────────

function YearlySummary({ year, cardId }) {
  const [open, setOpen] = useState(false)
  const data = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const ym = ymStr(year, m)
    const fl = loadFixed(cardId).filter(x => !x.startYm || x.startYm <= ym)
    const fixedTotal = fl.reduce((s, x) => s + x.amount, 0)
    const vl = loadVar(cardId, ym)
    const varTotal = vl.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
    return { m, fixedTotal, varTotal, total: fixedTotal + varTotal }
  })
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const yearTotal = data.reduce((s, d) => s + d.total, 0)

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box onClick={() => setOpen(v => !v)}
        sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ExpandMoreIcon sx={{ fontSize: 16, color: '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>年間サマリー {year}年</Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)', fontSize: 10 }}>合計 ¥{fmt(yearTotal)}</Typography>
      </Box>
      <Collapse in={open}>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          {data.map(({ m, fixedTotal, varTotal, total }) => (
            <Stack key={m} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
              <Typography variant="caption" sx={{ width: 24, flexShrink: 0, fontSize: 10, color: 'text.secondary' }}>{m}月</Typography>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ height: 8, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                  <Box sx={{ height: '100%', width: `${total > 0 ? fixedTotal / maxTotal * 100 : 0}%`, bgcolor: '#78909c', borderRadius: '2px 0 0 2px' }} />
                  <Box sx={{ height: '100%', width: `${total > 0 ? varTotal / maxTotal * 100 : 0}%`, bgcolor: '#42a5f5' }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: total > 0 ? 600 : 400, width: 60, textAlign: 'right', flexShrink: 0, color: total > 0 ? 'text.primary' : 'text.disabled' }}>
                {total > 0 ? `¥${fmt(total)}` : '—'}
              </Typography>
            </Stack>
          ))}
          <Stack direction="row" gap={2} sx={{ mt: 1 }}>
            <Stack direction="row" alignItems="center" gap={0.5}><Box sx={{ width: 8, height: 8, bgcolor: '#78909c', borderRadius: 1 }} /><Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>固定</Typography></Stack>
            <Stack direction="row" alignItems="center" gap={0.5}><Box sx={{ width: 8, height: 8, bgcolor: '#42a5f5', borderRadius: 1 }} /><Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>変動</Typography></Stack>
          </Stack>
        </CardContent>
      </Collapse>
    </Card>
  )
}

// ─── 2枚合計＋給与比較 ──────────────────────────────────

// ─── 支出入力（フルスクリーン）────────────────────────────────

function AddExpenseScreen({ open, onClose, onSave, categories, defaultDate, currentCardId, onEditCategories }) {
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState(categories[0] ?? '食費')
  const [date,     setDate]     = useState(defaultDate)
  const [payee,    setPayee]    = useState('')
  const [name,     setName]     = useState('')
  const [cardId,   setCardId]   = useState(currentCardId)
  const [payeeHistory] = useState(() => loadHistory('cc_payee_history'))
  const [nameHistory]  = useState(() => loadHistory('cc_name_history'))
  const [showPayeeSugg, setShowPayeeSugg] = useState(false)
  const [showNameSugg,  setShowNameSugg]  = useState(false)
  const dateRef = useRef(null)

  const payeeSugg = payee
    ? payeeHistory.filter(x => x.toLowerCase().includes(payee.toLowerCase()) && x !== payee).slice(0, 5)
    : payeeHistory.slice(0, 5)
  const nameSugg = name
    ? nameHistory.filter(x => x.toLowerCase().includes(name.toLowerCase()) && x !== name).slice(0, 5)
    : nameHistory.slice(0, 5)

  useEffect(() => {
    if (open) {
      setAmount(''); setPayee(''); setName('')
      setCategory(categories[0] ?? '食費')
      setDate(defaultDate); setCardId(currentCardId)
      window.history.pushState({ addExpenseOpen: true }, '')
      const handlePop = () => onClose()
      window.addEventListener('popstate', handlePop)
      return () => window.removeEventListener('popstate', handlePop)
    }
  }, [open, defaultDate, currentCardId, categories, onClose])

  const doClose = () => {
    if (window.history.state?.addExpenseOpen) window.history.back()
    else onClose()
  }

  const doSave = () => {
    const a = parseAmount(amount)
    if (a <= 0) return
    if (payee.trim()) addToHistory('cc_payee_history', payee.trim())
    if (name.trim())  addToHistory('cc_name_history',  name.trim())
    onSave({ cardId, item: { name: name.trim() || category, payee: payee.trim(), amount: a, category, date } })
    doClose()
  }

  if (!open) return null

  const fmtD = (d) => { const [y, m, day] = d.split('-'); return `${y}/${m}/${day}` }
  const IROW   = { display: 'flex', alignItems: 'center', px: 2, minHeight: 52, borderBottom: '1px solid #f0f0f0' }
  const ILABEL = { fontSize: 13, color: '#757575', width: 56, flexShrink: 0 }

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: '#fafafa', display: 'flex', flexDirection: 'column', maxWidth: 600, mx: 'auto' }}>

      {/* ヘッダー */}
      <Box sx={{ bgcolor: 'primary.main', color: '#fff', px: 1, display: 'flex', alignItems: 'center', minHeight: 56, flexShrink: 0 }}>
        <IconButton onClick={doClose} sx={{ color: '#fff' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1, textAlign: 'center' }}>支出を追加</Typography>
        <Button onClick={doSave} disabled={parseAmount(amount) <= 0}
          sx={{ color: '#fff', fontWeight: 700, opacity: parseAmount(amount) > 0 ? 1 : 0.5 }}>
          保存
        </Button>
      </Box>

      {/* フォーム（スクロール可） */}
      <Box sx={{ overflowY: 'auto', bgcolor: '#fff', borderBottom: '1px solid #e0e0e0' }}>

        {/* 日付 */}
        <Box sx={{ ...IROW, cursor: 'pointer' }} onClick={() => dateRef.current?.click()}>
          <Typography sx={ILABEL}>日付</Typography>
          <Typography sx={{ flex: 1, fontSize: 15 }}>{fmtD(date)}</Typography>
          <input ref={dateRef} type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: '-100px' }} />
        </Box>

        {/* カード */}
        <Box sx={IROW}>
          <Typography sx={ILABEL}>カード</Typography>
          <Stack direction="row" spacing={1}>
            {Object.values(CARDS).map(c => (
              <Chip key={c.id} label={c.shortName} size="small" onClick={() => setCardId(c.id)}
                sx={{ fontWeight: 600, fontSize: 12, bgcolor: cardId === c.id ? c.color : 'transparent',
                  color: cardId === c.id ? '#fff' : 'text.secondary', border: `1px solid ${c.color}` }} />
            ))}
          </Stack>
        </Box>

        {/* 分類 */}
        <Box sx={IROW}>
          <Typography sx={ILABEL}>分類</Typography>
          <Select
            value={categories.includes(category) ? category : (categories[0] ?? '')}
            onChange={e => setCategory(e.target.value)}
            variant="standard"
            disableUnderline
            sx={{ flex: 1, fontSize: 15 }}
          >
            {categories.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
          </Select>
          <IconButton size="small" aria-label="カテゴリ設定" onClick={onEditCategories} sx={{ p: 0.75 }}>
            <SettingsIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </IconButton>
        </Box>

        {/* 支払先 */}
        <Box sx={IROW}>
          <Typography sx={ILABEL}>支払先</Typography>
          <InputBase fullWidth placeholder="省略可" value={payee}
            onChange={e => setPayee(e.target.value)}
            onFocus={() => setShowPayeeSugg(true)}
            onBlur={() => setTimeout(() => setShowPayeeSugg(false), 150)}
            sx={{ flex: 1, fontSize: 15 }} />
        </Box>
        {showPayeeSugg && payeeSugg.length > 0 && (
          <Box sx={{ px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, bgcolor: '#fff', borderBottom: '1px solid #f0f0f0' }}>
            {payeeSugg.map(s => (
              <Chip key={s} label={s} size="small" onMouseDown={() => setPayee(s)}
                sx={{ fontSize: 11, height: 22, bgcolor: '#f0f4f8', cursor: 'pointer' }} />
            ))}
          </Box>
        )}

        {/* 項目名 */}
        <Box sx={IROW}>
          <Typography sx={ILABEL}>項目名</Typography>
          <InputBase fullWidth placeholder="省略可" value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => setShowNameSugg(true)}
            onBlur={() => setTimeout(() => setShowNameSugg(false), 150)}
            sx={{ flex: 1, fontSize: 15 }} />
        </Box>
        {showNameSugg && nameSugg.length > 0 && (
          <Box sx={{ px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, bgcolor: '#fff', borderBottom: '1px solid #f0f0f0' }}>
            {nameSugg.map(s => (
              <Chip key={s} label={s} size="small" onMouseDown={() => setName(s)}
                sx={{ fontSize: 11, height: 22, bgcolor: '#f0f4f8', cursor: 'pointer' }} />
            ))}
          </Box>
        )}
      </Box>

      {/* 金額ディスプレイ */}
      <Box sx={{ bgcolor: '#263238', px: 2, py: 1, flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 18, mr: 0.5 }}>¥</Typography>
        <Typography sx={{ color: '#fff', fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 40 }}>
          {parseAmount(amount) > 0 ? fmt(parseAmount(amount)) : '0'}
        </Typography>
      </Box>

      {/* 電卓 */}
      <CalcPad value={amount} onChange={setAmount} onConfirm={doSave} disabled={parseAmount(amount) <= 0} />
    </Box>
  )
}

// ─── [以下、分割済み] ─

// ─── メインコンポーネント ─────────────────────────

export default function CreditCard() {
  const today = new Date()
  const [cardId,  setCardId]  = useState('jcb')
  const [year,    setYear]    = useState(today.getFullYear())
  const [month,   setMonth]   = useState(today.getMonth() + 1)

  const card = CARDS[cardId]
  const ym   = ymStr(year, month)

  const [fixedList,    setFixedList]    = useState(() => loadFixed(cardId))
  const [varList,      setVarList]      = useState(() => loadVar(cardId, ym))
  const [billedIds,    setBilledIds]    = useState(() => loadBilled(cardId, ym))
  const [deleteDlg,    setDeleteDlg]    = useState(null) // { type:'fixed'|'var', id, name }
  const [categories,   setCategories]   = useState(loadCategories)
  const [dlg,          setDlg]          = useState(null)
  const [catDlgOpen,   setCatDlgOpen]   = useState(false)
  const [limitInputs,  setLimitInputs]  = useState(() => ({ jcb: loadLimit('jcb'), smbc: loadLimit('smbc') }))
  const [snack,        setSnack]        = useState({ open: false, severity: 'success', message: '' })
  const [fixedOpen,    setFixedOpen]    = useState(false)
  const [varOpen,      setVarOpen]      = useState(false)
  const [addOpen,      setAddOpen]      = useState(false)

  const notify = (severity, message) => setSnack({ open: true, severity, message })

  const todayStr = new Date().toISOString().slice(0, 10)

  const switchCard = (id) => {
    setCardId(id)
    setFixedList(loadFixed(id))
    setVarList(loadVar(id, ym))
    setBilledIds(loadBilled(id, ym))
  }

  const changeMonth = (delta) => {
    let y = year, m = month + delta
    if (m > 12) { y++; m = 1 }
    if (m < 1)  { y--; m = 12 }
    setYear(y); setMonth(m)
    const newYm = ymStr(y, m)
    setVarList(loadVar(cardId, newYm))
    setBilledIds(loadBilled(cardId, newYm))
  }

  const toggleBilled = (itemId) => {
    const next = billedIds.includes(itemId)
      ? billedIds.filter(id => id !== itemId)
      : [...billedIds, itemId]
    setBilledIds(next)
    saveBilled(cardId, ym, next)
  }

  // 固定費 CRUD
  const addFixed = (data) => {
    try { const next = [...fixedList, { id: newId(), ...data }]; setFixedList(next); saveFixed(cardId, next); notify('success', '固定費を保存しました') }
    catch { notify('error', '固定費の保存に失敗しました') }
  }
  const editFixed = (data) => {
    try { const next = fixedList.map((x) => x.id === dlg.initial.id ? { ...x, ...data } : x); setFixedList(next); saveFixed(cardId, next); notify('success', '固定費を更新しました') }
    catch { notify('error', '固定費の更新に失敗しました') }
  }
  const deleteFixed = useCallback((id) => {
    const item = fixedList.find(x => x.id === id)
    setDeleteDlg({ type: 'fixed', id, name: item?.name ?? '固定費' })
  }, [fixedList])

  const confirmDeleteFixed = useCallback((id) => {
    try { const next = fixedList.filter((x) => x.id !== id); setFixedList(next); saveFixed(cardId, next); notify('success', '固定費を削除しました') }
    catch { notify('error', '固定費の削除に失敗しました') }
  }, [fixedList, cardId])

  // 変動費 CRUD
  const addVar = (data) => {
    try { const next = [...varList, { id: newId(), ...data }].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を保存しました') }
    catch { notify('error', '変動費の保存に失敗しました') }
  }

  // 日付とカードIDから請求月(ym)を計算
  const getBillingYm = (date, cId) => {
    if (!date) return ym
    const cutoff = CARDS[cId]?.cutoffDay ?? 0
    const [y, m, d] = date.split('-').map(Number)
    if (cutoff > 0 && d <= cutoff) {
      // 締め日以前 → 前月扱い
      return ymStr(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
    }
    return ymStr(y, m)
  }

  // QuickAddDrawer からの保存（収入/支出/振替対応）
  const handleAddSave = ({ cardId: targetCard, item }) => {
    try {
      const targetYm = getBillingYm(item.date, targetCard)
      const existing = loadVar(targetCard, targetYm)
      const dup = existing.find(x => x.date === item.date && x.amount === item.amount && x.category === item.category)
      if (dup) notify('warning', `同日・同金額・同カテゴリの支出が既に登録されています（${item.date} ¥${fmt(item.amount)} ${item.category}）`)
      const newItem = { id: newId(), ...item }
      const nextList = [...existing, newItem].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
      saveVar(targetCard, targetYm, nextList)
      if (targetCard === cardId && targetYm === ym) setVarList(nextList)
      if (!dup) notify('success', `支出を${targetYm.replace('-', '年')}月分として記録しました`)
    } catch { notify('error', '保存に失敗しました') }
  }
  const editVar = (data) => {
    try { const next = varList.map((x) => x.id === dlg.initial.id ? { ...x, ...data } : x).sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を更新しました') }
    catch { notify('error', '変動費の更新に失敗しました') }
  }
  const deleteVar = useCallback((id) => {
    const item = varList.find(x => x.id === id)
    setDeleteDlg({ type: 'var', id, name: item?.name ?? '変動費' })
  }, [varList])

  const confirmDeleteVar = useCallback((id) => {
    try { const next = varList.filter((x) => x.id !== id); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を削除しました') }
    catch { notify('error', '変動費の削除に失敗しました') }
  }, [varList, cardId, ym])

  const handleCategoryChange = (next) => {
    try { setCategories(next); saveCategories(next); notify('success', 'カテゴリを保存しました') }
    catch { notify('error', 'カテゴリの保存に失敗しました') }
  }


  // 開始年月でフィルタリングされた固定費（選択中の月に有効なもののみ）
  const filteredFixed = fixedList.filter((x) => !x.startYm || x.startYm <= ym)
  const fixedTotal = filteredFixed.reduce((s, x) => s + x.amount, 0)
  const varTotal   = varList.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
  const grandTotal = fixedTotal + varTotal

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {year}年{month}月
        </Typography>
        <IconButton size="small" aria-label="次の月" onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* カード選択 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1}>
          {Object.values(CARDS).map((c) => (
            <Chip key={c.id} label={c.shortName} onClick={() => switchCard(c.id)}
              variant={cardId === c.id ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600, fontSize: 12,
                bgcolor: cardId === c.id ? c.color : 'transparent',
                color: cardId === c.id ? '#fff' : 'text.secondary',
                borderColor: c.color,
              }}
            />
          ))}
        </Stack>
        <IconButton size="small" aria-label="カテゴリ設定" onClick={() => setCatDlgOpen(true)}>
          <SettingsIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </IconButton>
      </Stack>

      {/* 個別カードサマリー */}
      {(() => {
        const limitInput = limitInputs[cardId]
        const limit = parseFloat(limitInput) || 0
        const pct   = limit > 0 ? Math.min(grandTotal / limit * 100, 100) : 0
        const over  = limit > 0 && grandTotal > limit
        const barColor = pct >= 90 ? '#ef9a9a' : pct >= 70 ? '#ffe082' : 'rgba(255,255,255,.55)'
        const livingTotal = sumLiving(varList)
        const otherVarTotal = varTotal - livingTotal
        return (
          <Card sx={{ mb: 2, bgcolor: card.color, color: '#fff' }}>
            <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ opacity: .65, letterSpacing: .5 }}>{card.name}</Typography>

              {/* 使用額 / 上限 / 残り の3列 */}
              {limit > 0 ? (
                <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 0.5 }}>
                  <Stack>
                    <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>使用額</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -.5, color: over ? '#ef9a9a' : '#fff' }}>
                      ¥{fmt(grandTotal)}
                    </Typography>
                  </Stack>
                  <Stack alignItems="center">
                    <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>上限</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, opacity: .75 }}>
                      ¥{fmt(limit)}
                    </Typography>
                  </Stack>
                  <Stack alignItems="flex-end">
                    <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>残り</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: over ? '#ef9a9a' : '#a5d6a7' }}>
                      {over ? `−¥${fmt(grandTotal - limit)}` : `¥${fmt(limit - grandTotal)}`}
                    </Typography>
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -.5, mt: 0.5 }}>
                  ¥{fmt(grandTotal)}
                </Typography>
              )}

              {/* プログレスバー */}
              {limit > 0 && (
                <Box sx={{ mt: 1, mb: 0.5 }}>
                  <Box sx={{ height: 6, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: barColor, borderRadius: 3,
                      transition: 'width .4s ease' }} />
                  </Box>
                  <Typography variant="caption" sx={{ opacity: .6, fontSize: 11, mt: 0.5, display: 'block' }}>{pct.toFixed(0)}% 使用</Typography>
                </Box>
              )}

              {/* 内訳フッター */}
              <Stack direction="row" spacing={2} sx={{ mt: limit > 0 ? 0 : 1 }}>
                <Typography variant="caption" sx={{ opacity: .75 }}>固定 ¥{fmt(fixedTotal)}</Typography>
                <Typography variant="caption" sx={{ opacity: .75 }}>生活費 ¥{fmt(livingTotal)}</Typography>
                <Typography variant="caption" sx={{ opacity: .75 }}>その他 ¥{fmt(otherVarTotal)}</Typography>
              </Stack>
              <Stack sx={{ mt: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: .55 }}>
                  {cutoffLabel(card)}　{paymentLabel(card)}
                </Typography>
                {(() => {
                  const { cutoffDate, payDate } = cycleDates(card, ym)
                  return (
                    <Typography variant="caption" sx={{ opacity: .4 }}>
                      {fmtCycleDate(cutoffDate)}締め　{fmtCycleDate(payDate)}払い
                    </Typography>
                  )
                })()}
              </Stack>
              {/* 上限入力 */}
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>月間上限</Typography>
                <AmountField
                  dark
                  value={limitInput}
                  onChange={(raw) => { setLimitInputs(prev => ({ ...prev, [cardId]: raw })); saveLimit(cardId, raw) }}
                  placeholder="設定なし"
                  inputSx={{ mt: 0.5, '& .MuiInputBase-root': { height: 30 } }}
                />
              </Box>
            </CardContent>
          </Card>
        )
      })()}

      {/* 予算内訳カード */}
      <BudgetBreakdown
        cardId={cardId} ym={ym}
        limit={parseFloat(limitInputs[cardId]) || 0}
        fixedTotal={fixedTotal} varTotal={varTotal} varList={varList}
        onLimitChange={(v) => { setLimitInputs(prev => ({ ...prev, [cardId]: v })); saveLimit(cardId, v) }}
      />

      {/* 固定費テーブル */}
      <Card sx={{ mb: 1.5 }}>
        <Box
          onClick={() => setFixedOpen((v) => !v)}
          sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <ExpandMoreIcon sx={{ fontSize: 16, color: '#fff', transform: fixedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>固定費</Typography>
            <Chip label="毎月" size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>¥{fmt(fixedTotal)}</Typography>
            <IconButton size="small" aria-label="固定費を追加" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'fixed' }) }} sx={{ p: 0.75, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
        <Collapse in={fixedOpen}>
          <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
            <FixedExpenseTable
              fixedList={filteredFixed}
              onEdit={(it) => setDlg({ type: 'fixed', initial: it })}
              onDelete={deleteFixed}
              billedIds={billedIds}
              onToggleBilled={toggleBilled}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* 変動費 */}
      <Card sx={{ mb: 1.5 }}>
        {(() => {
          const prevM = month === 1 ? 12 : month - 1
          const prevY = month === 1 ? year - 1 : year
          const prevVarList = loadVar(cardId, ymStr(prevY, prevM))
          const prevVarTotal = prevVarList.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
          const varDiff = varTotal - prevVarTotal
          return (
        <Box
          onClick={() => setVarOpen((v) => !v)}
          sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <ExpandMoreIcon sx={{ fontSize: 16, color: '#fff', transform: varOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>変動費</Typography>
            <Chip label={`${year}年${month}月`} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack alignItems="flex-end">
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>¥{fmt(varTotal)}</Typography>
              {prevVarTotal > 0 && (
                <Typography variant="caption" sx={{ fontSize: 9, color: varDiff > 0 ? '#ef9a9a' : '#a5d6a7' }}>
                  先月比 {varDiff >= 0 ? '+' : '−'}¥{fmt(Math.abs(varDiff))}
                </Typography>
              )}
            </Stack>
            <IconButton size="small" aria-label="変動費を追加" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'var' }) }} sx={{ p: 0.75, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
          )
        })()}
        <Collapse in={varOpen}>
          <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
            <DailyBarChart varList={varList} />
            <VarExpenseTable
              varList={varList}
              onEdit={(it) => setDlg({ type: 'var', initial: it })}
              onDelete={deleteVar}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* 年間サマリー */}
      <YearlySummary year={year} cardId={cardId} />

      {/* ダイアログ */}
      {dlg?.type === 'fixed' && (
        <ExpenseDialog open onClose={() => setDlg(null)}
          onSave={dlg.initial ? editFixed : addFixed}
          initial={dlg.initial} categories={categories}
          title={dlg.initial ? '固定費を編集' : '固定費を追加'} />
      )}
      {dlg?.type === 'var' && (
        <ExpenseDialog open onClose={() => setDlg(null)}
          onSave={dlg.initial ? editVar : addVar}
          initial={dlg.initial ?? { date: todayStr }} categories={categories}
          title={dlg.initial ? '変動費を編集' : '変動費を追加'} />
      )}
      <CategoryDialog
        open={catDlgOpen} onClose={() => setCatDlgOpen(false)}
        categories={categories} onChange={handleCategoryChange} />

      {/* FAB: 支出入力 */}
      <Fab
        color="primary"
        onClick={() => setAddOpen(true)}
        sx={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, zIndex: 200 }}
      >
        <AddIcon />
      </Fab>

      <AddExpenseScreen
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddSave}
        categories={categories}
        defaultDate={ym === todayStr.slice(0, 7) ? todayStr : `${ym}-01`}
        onEditCategories={() => setCatDlgOpen(true)}
        currentCardId={cardId}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteDlg} onClose={() => setDeleteDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            「{deleteDlg?.name}」を削除しますか？この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDlg(null)} color="inherit" size="small">キャンセル</Button>
          <Button
            onClick={() => {
              if (deleteDlg.type === 'fixed') confirmDeleteFixed(deleteDlg.id)
              else confirmDeleteVar(deleteDlg.id)
              setDeleteDlg(null)
            }}
            color="error" variant="contained" size="small">削除</Button>
        </DialogActions>
      </Dialog>

      {/* 保存通知 */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80 } }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  )
}
