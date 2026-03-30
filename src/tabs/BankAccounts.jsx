import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell, Collapse,
  InputAdornment, Fab,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CheckIcon from '@mui/icons-material/Check'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RepeatIcon from '@mui/icons-material/Repeat'
import TableChartIcon from '@mui/icons-material/TableChart'
import ViewListIcon from '@mui/icons-material/ViewList'
import CalculateIcon from '@mui/icons-material/Calculate'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import {
  loadAccounts, saveAccounts,
  loadOpeningBalances, saveOpeningBalances,
  isOpeningManual, setOpeningManual,
  loadOpeningDate, saveOpeningDate,
  loadAmountOverrides, saveAmountOverrides,
  loadDeletedAutoIds, saveDeletedAutoIds,
  loadManualEvents, saveManualEvents,
  loadFixedEvents, saveFixedEvents,
  loadNameOverrides, saveNameOverrides,
  buildAutoEvents, loadSnapshot, saveSnapshot,
  fmt, ymStr, newId,
} from '../utils/finance'

const DAY_OF_WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// ─── E: 口座カラーマップ ─────────────────────────────────

const PALETTE = [
  { bg: '#e3f2fd', border: '#1565c0' }, // blue
  { bg: '#e8f5e9', border: '#2e7d32' }, // green
  { bg: '#fff3e0', border: '#e65100' }, // orange
  { bg: '#fce4ec', border: '#ad1457' }, // pink
  { bg: '#f3e5f5', border: '#6a1b9a' }, // purple
  { bg: '#e0f7fa', border: '#006064' }, // cyan
  { bg: '#e8eaf6', border: '#283593' }, // indigo
  { bg: '#fff8e1', border: '#f57f17' }, // amber
  { bg: '#fbe9e7', border: '#bf360c' }, // deep-orange
  { bg: '#f9fbe7', border: '#558b2f' }, // lime
]

function buildColorMap(accounts) {
  const map = {}
  let idx = 0
  const groupIdx = {}
  accounts.forEach((a) => {
    if (a.group) {
      if (groupIdx[a.group] === undefined) { groupIdx[a.group] = idx % PALETTE.length; idx++ }
      map[a.id] = PALETTE[groupIdx[a.group]]
    } else {
      map[a.id] = PALETTE[idx % PALETTE.length]; idx++
    }
  })
  return map
}

// ─── 金額入力ユーティリティ ──────────────────────────────

function fmtInput(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ja-JP')
}
function parseAmount(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

// 同日内ソート順: 振替(0) → 入金(1) → 出金(2)
function eventSortOrder(ev) {
  if (ev.type === 'transfer') return 0
  if (ev.sign > 0) return 1
  return 2
}

// 振替自動計算: 1000円単位切り上げ
// = ROUNDUP(ROUNDUP(振替先支出合計, -3) - ROUNDUP(振替先繰越残高, -3), -3)
function roundUp1000(x) { return Math.ceil(x / 1000) * 1000 }

function calcSuggestedTransfer(toAccountId, events, openingBalances) {
  const totalExpenses = events
    .filter(ev => ev.type !== 'transfer' && ev.accountId === toAccountId && ev.sign === -1)
    .reduce((sum, ev) => sum + ev.amount, 0)
  const opening = openingBalances[toAccountId] ?? 0
  return Math.max(0, roundUp1000(roundUp1000(totalExpenses) - roundUp1000(opening)))
}

const AMOUNT_STEPS = [
  { label: '+100',    step: 100 },
  { label: '+1,000',  step: 1000 },
  { label: '+10,000', step: 10000 },
]

// ─── 電卓パッド ─────────────────────────────────────────

const CALC_BTN = { minWidth: 0, fontSize: 20, fontWeight: 500, borderRadius: 0, py: 1.8, color: '#fff' }
const CALC_BG  = '#424242'
const CALC_BG2 = '#616161'
const CALC_OP  = '#555'

function CalcPad({ value, onChange, onConfirm, disabled }) {
  const [stored, setStored]   = useState(null)
  const [op, setOp]           = useState(null)
  const [fresh, setFresh]     = useState(false)

  const calc = (a, b, operator) => {
    switch (operator) {
      case '+': return a + b
      case '−': return a - b
      case '×': return a * b
      case '÷': return b !== 0 ? Math.floor(a / b) : a
      default:  return b
    }
  }

  const pressDigit = (d) => {
    if (fresh) { onChange(d); setFresh(false) }
    else {
      const cur = value === '0' ? '' : (value ?? '')
      onChange(cur + d)
    }
  }

  const pressOp = (next) => {
    const cur = parseAmount(value)
    if (stored !== null && op && !fresh) {
      const result = calc(stored, cur, op)
      setStored(result)
      onChange(String(result))
    } else {
      setStored(cur)
    }
    setOp(next)
    setFresh(true)
  }

  const pressClear = () => {
    onChange('')
    setStored(null)
    setOp(null)
    setFresh(false)
  }

  const pressEquals = () => {
    if (stored !== null && op) {
      const result = calc(stored, parseAmount(value), op)
      onChange(String(result))
      setStored(null)
      setOp(null)
      setFresh(false)
    }
  }

  const pressConfirm = () => {
    pressEquals()
    onConfirm()
  }

  const btn = (label, onClick, sx = {}) => (
    <Button key={label} onClick={onClick}
      sx={{ ...CALC_BTN, bgcolor: CALC_BG, '&:hover': { bgcolor: CALC_BG2 }, '&:active': { bgcolor: '#757575' }, ...sx }}>
      {label}
    </Button>
  )

  const opBtn = (label) => btn(label, () => pressOp(label), {
    bgcolor: op === label && fresh ? '#ff9800' : CALC_OP,
    '&:hover': { bgcolor: op === label && fresh ? '#ffa726' : CALC_BG2 },
  })

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(5, 1fr)',
      gap: '1px',
      bgcolor: '#333',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {btn('C', pressClear, { gridColumn: 'span 2', bgcolor: '#555', '&:hover': { bgcolor: '#666' } })}
      {opBtn('÷')}
      {opBtn('×')}

      {btn('7', () => pressDigit('7'))}
      {btn('8', () => pressDigit('8'))}
      {btn('9', () => pressDigit('9'))}
      {opBtn('−')}

      {btn('4', () => pressDigit('4'))}
      {btn('5', () => pressDigit('5'))}
      {btn('6', () => pressDigit('6'))}
      {opBtn('+')}

      {btn('1', () => pressDigit('1'))}
      {btn('2', () => pressDigit('2'))}
      {btn('3', () => pressDigit('3'))}
      {btn('確定', pressConfirm, {
        gridRow: 'span 2',
        bgcolor: disabled ? '#bdbdbd' : '#f57c00',
        color: '#fff',
        fontWeight: 700,
        fontSize: 18,
        '&:hover': { bgcolor: disabled ? '#bdbdbd' : '#ef6c00' },
        '&:active': { bgcolor: disabled ? '#bdbdbd' : '#e65100' },
      })}

      {btn('=', pressEquals, {
        bgcolor: '#ff9800',
        fontWeight: 700,
        fontSize: 24,
        '&:hover': { bgcolor: '#ffa726' },
        '&:active': { bgcolor: '#e65100' },
      })}
      {btn('0',  () => pressDigit('0'))}
      {btn('00', () => pressDigit('00'))}
    </Box>
  )
}

function AmountField({ value, onChange, large = false, label, placeholder = '0', autoFocus = false, inputSx = {} }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const handleOpen = () => {
    setDraft(String(parseAmount(value) || ''))
    setOpen(true)
  }
  const handleConfirm = () => {
    onChange(draft.replace(/[^0-9]/g, ''))
    setOpen(false)
  }

  return (
    <Box>
      <TextField
        fullWidth label={label} size={large ? undefined : 'small'}
        placeholder={placeholder}
        value={fmtInput(value)}
        onClick={handleOpen}
        inputProps={{
          readOnly: true,
          style: large
            ? { fontSize: 32, fontWeight: 700, textAlign: 'center' }
            : { fontSize: 14, textAlign: 'right', cursor: 'pointer' },
        }}
        InputProps={{
          startAdornment: large
            ? <Typography variant="h6" color="text.secondary" sx={{ mr: 0.5 }}>¥</Typography>
            : <InputAdornment position="start">¥</InputAdornment>,
        }}
        sx={{ ...(large ? { '& .MuiInputBase-root': { height: 64 } } : {}), ...inputSx }}
      />

      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => {}}
        disableSwipeToOpen
        sx={{ zIndex: 1500 }}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 3, maxWidth: 600, mx: 'auto' } }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto', mb: 1.5 }} />
        {label && <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>}
        <Box sx={{
          bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5,
          display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
        }}>
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
          <Typography sx={{
            color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            minHeight: 44,
          }}>
            {parseAmount(draft) > 0 ? fmt(parseAmount(draft)) : '0'}
          </Typography>
        </Box>
        <CalcPad
          value={draft}
          onChange={setDraft}
          onConfirm={handleConfirm}
          disabled={parseAmount(draft) <= 0}
        />
      </SwipeableDrawer>
    </Box>
  )
}

// ─── D: 次回発生日計算 ───────────────────────────────────

function getNextOccurrence(fe) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (fe.frequency === 'monthly') {
    const y = today.getFullYear(), m = today.getMonth()
    const d = Math.min(fe.day, new Date(y, m + 1, 0).getDate())
    let next = new Date(y, m, d)
    if (next <= today) {
      const nm = m + 1 > 11 ? 0 : m + 1
      const ny = m + 1 > 11 ? y + 1 : y
      next = new Date(ny, nm, Math.min(fe.day, new Date(ny, nm + 1, 0).getDate()))
    }
    return next
  } else {
    const next = new Date(today); next.setDate(today.getDate() + 1)
    while (next.getDay() !== fe.dayOfWeek) next.setDate(next.getDate() + 1)
    return next
  }
}

// ─── 口座セレクタ ────────────────────────────────────────

function AccountSelect({ accounts, value, onChange, label = '口座', size = 'small' }) {
  const groups = []
  const seen = new Set()
  accounts.forEach((a) => {
    if (a.group && !seen.has(a.group)) {
      seen.add(a.group)
      groups.push({ type: 'group', id: a.group, label: a.groupName ?? a.group })
    }
    groups.push({ type: 'account', id: a.id, label: a.name, indent: !!a.group })
  })
  return (
    <FormControl size={size} fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {groups.map((g) =>
          g.type === 'group'
            ? <MenuItem key={g.id} disabled value="" sx={{ fontSize: 11, opacity: 0.6, minHeight: 28, py: 0.25 }}>
                ── {g.label}
              </MenuItem>
            : <MenuItem key={g.id} value={g.id} sx={{ pl: g.indent ? 3 : 2 }}>{g.label}</MenuItem>
        )}
      </Select>
    </FormControl>
  )
}

// ─── イベント入力ダイアログ ──────────────────────────────

function EventDialog({ open, onClose, onSave, initial, accounts, defaultDate = '', allEvents = [], openingBalances = {} }) {
  const initType = initial?.type ?? (initial ? (initial.sign === 1 ? 'income' : 'expense') : 'expense')
  const [date,          setDate]          = useState(initial?.date          ?? defaultDate)
  const [name,          setName]          = useState(initial?.name          ?? '')
  const [amount,        setAmount]        = useState(initial?.amount         ?? '')
  const [type,          setType]          = useState(initType)
  const [accountId,     setAccountId]     = useState(initial?.accountId     ?? accounts[0]?.id ?? '')
  const [fromAccountId, setFromAccountId] = useState(initial?.fromAccountId ?? accounts[0]?.id ?? '')
  const [toAccountId,   setToAccountId]   = useState(initial?.toAccountId   ?? accounts[1]?.id ?? accounts[0]?.id ?? '')

  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0 || !date) return
    if (type === 'transfer') {
      onSave({ date, name: name.trim(), amount: a, type: 'transfer', fromAccountId, toAccountId })
    } else {
      onSave({ date, name: name.trim(), amount: a, type, accountId, sign: type === 'income' ? 1 : -1 })
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>{initial ? 'イベントを編集' : 'イベントを追加'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="日付" type="date" size="small" fullWidth
            InputLabelProps={{ shrink: true }}
            value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="摘要" size="small" fullWidth
            value={name} onChange={(e) => setName(e.target.value)} />
          <Stack direction="row" gap={1}>
            {[
              { key: 'expense',  label: '支出', bg: '#ffebee', col: '#c62828' },
              { key: 'income',   label: '入金', bg: '#e8f5e9', col: '#2e7d32' },
              { key: 'transfer', label: '振替', bg: '#e3f2fd', col: '#1565c0' },
            ].map((t) => (
              <Chip key={t.key} label={t.label} onClick={() => setType(t.key)}
                sx={{
                  fontWeight: type === t.key ? 700 : 400,
                  bgcolor: type === t.key ? t.bg : '#f5f5f5',
                  color: type === t.key ? t.col : 'text.secondary',
                  border: type === t.key ? `1.5px solid ${t.col}` : '1.5px solid transparent',
                }}
              />
            ))}
          </Stack>
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
          {type === 'transfer' ? (
            <Stack spacing={1.5}>
              <AccountSelect accounts={accounts} value={fromAccountId} onChange={setFromAccountId} label="振替元" />
              <AccountSelect accounts={accounts} value={toAccountId}   onChange={setToAccountId}   label="振替先" />
              {(() => {
                const s = calcSuggestedTransfer(toAccountId, allEvents, openingBalances)
                return s > 0 ? (
                  <Button size="small" variant="outlined" color="info"
                    startIcon={<CalculateIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setAmount(String(s))}
                    sx={{ fontSize: 11, py: 0.5 }}>
                    ¥{fmt(s)} を自動入力
                  </Button>
                ) : null
              })()}
            </Stack>
          ) : (
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small">保存</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── クイック入力ボトムシート ─────────────────────────────

function QuickAddDrawer({ open, onClose, onSave, accounts, defaultDate, allEvents = [], openingBalances = {} }) {
  const [date,          setDate]          = useState(defaultDate)
  const [name,          setName]          = useState('')
  const [amount,        setAmount]        = useState('')
  const [type,          setType]          = useState('expense')
  const [accountId,     setAccountId]     = useState(accounts[0]?.id ?? '')
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '')
  const [toAccountId,   setToAccountId]   = useState(accounts[1]?.id ?? accounts[0]?.id ?? '')

  const handleOpen = () => {
    setDate(defaultDate); setAmount(''); setName(''); setType('expense')
    setAccountId(accounts[0]?.id ?? '')
  }

  const handleSave = () => {
    const a = parseAmount(amount)
    if (a <= 0) return
    const base = { date, name: name.trim() || (type === 'transfer' ? '振替' : type === 'income' ? '入金' : '支出') }
    if (type === 'transfer') {
      onSave({ ...base, amount: a, type: 'transfer', fromAccountId, toAccountId })
    } else {
      onSave({ ...base, amount: a, type, accountId, sign: type === 'income' ? 1 : -1 })
    }
    onClose()
  }

  const typeConfig = {
    expense:  { label: '支出', col: '#c62828' },
    income:   { label: '入金', col: '#2e7d32' },
    transfer: { label: '振替', col: '#1565c0' },
  }

  return (
    <SwipeableDrawer
      anchor="bottom" open={open} onClose={onClose} onOpen={handleOpen}
      disableSwipeToOpen
      PaperProps={{ sx: { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 4, maxWidth: 600, mx: 'auto' } }}
    >
      <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto', mb: 2 }} />

      <TextField type="date" size="small" fullWidth label="日付"
        InputLabelProps={{ shrink: true }}
        value={date} onChange={(e) => setDate(e.target.value)}
        sx={{ mb: 2 }} />

      <Stack direction="row" gap={1} sx={{ mb: 2 }}>
        {Object.entries(typeConfig).map(([k, v]) => (
          <Chip key={k} label={v.label} onClick={() => setType(k)}
            sx={{
              fontWeight: type === k ? 700 : 400, fontSize: 13, px: 0.5,
              bgcolor: type === k ? v.col : '#f0f0f0',
              color: type === k ? '#fff' : 'text.secondary',
            }}
          />
        ))}
      </Stack>

      <TextField size="small" fullWidth label="摘要（省略可）"
        value={name} onChange={(e) => setName(e.target.value)}
        sx={{ mb: 1.5 }} />

      {type === 'transfer' ? (
        <Stack spacing={1.5} sx={{ mb: 1.5 }}>
          <AccountSelect accounts={accounts} value={fromAccountId} onChange={setFromAccountId} label="振替元" />
          <AccountSelect accounts={accounts} value={toAccountId}   onChange={setToAccountId}   label="振替先" />
          {(() => {
            const s = calcSuggestedTransfer(toAccountId, allEvents, openingBalances)
            return s > 0 ? (
              <Button size="small" variant="outlined" color="info"
                startIcon={<CalculateIcon sx={{ fontSize: 14 }} />}
                onClick={() => setAmount(String(s))}
                sx={{ fontSize: 11, py: 0.5 }}>
                ¥{fmt(s)} を自動入力
              </Button>
            ) : null
          })()}
        </Stack>
      ) : (
        <Box sx={{ mb: 1.5 }}>
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        </Box>
      )}

      {/* 金額ディスプレイ */}
      <Box sx={{
        bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5,
        display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
      }}>
        <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
        <Typography sx={{
          color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          minHeight: 44,
        }}>
          {parseAmount(amount) > 0 ? fmt(parseAmount(amount)) : '0'}
        </Typography>
      </Box>

      {/* 電卓パッド */}
      <CalcPad
        value={amount}
        onChange={setAmount}
        onConfirm={handleSave}
        disabled={parseAmount(amount) <= 0}
      />
    </SwipeableDrawer>
  )
}

// ─── C + E: 月次サマリーカード ───────────────────────────

function SummaryCards({ accounts, openingBalances, events, colorMap }) {
  const finalBal = {}
  accounts.forEach((a) => { finalBal[a.id] = openingBalances[a.id] ?? 0 })
  events.forEach((ev) => {
    if (ev.type === 'transfer') {
      finalBal[ev.fromAccountId] = (finalBal[ev.fromAccountId] ?? 0) - ev.amount
      finalBal[ev.toAccountId]   = (finalBal[ev.toAccountId]   ?? 0) + ev.amount
    } else {
      finalBal[ev.accountId] = (finalBal[ev.accountId] ?? 0) + ev.sign * ev.amount
    }
  })

  const total = accounts.reduce((s, a) => s + (finalBal[a.id] ?? 0), 0)

  // C: 収支計算（振替除く）
  let totalIncome = 0, totalExpense = 0
  events.forEach((ev) => {
    if (ev.type === 'transfer') return
    if (ev.sign === 1) totalIncome += ev.amount
    else totalExpense += ev.amount
  })
  const net = totalIncome - totalExpense

  // グループ構造
  const groups = []
  const seenG = new Set()
  accounts.forEach((a) => {
    if (a.group) {
      if (!seenG.has(a.group)) {
        seenG.add(a.group)
        groups.push({ type: 'group', id: a.group, label: a.groupName ?? a.group, accounts: [] })
      }
      groups[groups.length - 1].accounts.push(a)
    } else {
      groups.push({ type: 'single', id: a.id, label: a.name, accounts: [a] })
    }
  })

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* 合計 + C: 収支サマリー */}
      <Card sx={{ mb: 1, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>資産合計</Typography>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: -.5, mt: 0.25 }}>
            ¥{fmt(total)}
          </Typography>
          <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1 }} />
          <Stack direction="row" spacing={3}>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>収入</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#a5d6a7', fontSize: 13 }}>
                +¥{fmt(totalIncome)}
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>支出</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#ef9a9a', fontSize: 13 }}>
                −¥{fmt(totalExpense)}
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>差引</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13, color: net >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {net >= 0 ? '+' : '−'}¥{fmt(Math.abs(net))}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* E: 口座別カード（カラーボーダー付き横スクロール） */}
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#cfd8dc', borderRadius: 2 } }}>
        {groups.map((g) => {
          const groupBal = g.accounts.reduce((s, a) => s + (finalBal[a.id] ?? 0), 0)
          const isGroup  = g.type === 'group'
          const color    = colorMap[g.accounts[0]?.id]
          return (
            <Box key={g.id} sx={{ minWidth: isGroup ? 160 : 110, flexShrink: 0 }}>
              <Card sx={{
                height: '100%',
                bgcolor: groupBal < 0 ? '#fff8f8' : (color?.bg ?? '#f9fafb'),
                borderTop: `3px solid ${color?.border ?? '#90a4ae'}`,
              }}>
                <CardContent sx={{ px: 1.5, py: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 600 }}>
                    {g.label}
                  </Typography>
                  {isGroup ? (
                    <>
                      <Typography variant="subtitle2" fontWeight={700}
                        sx={{ color: groupBal < 0 ? 'error.main' : '#263238', fontSize: 13, mt: 0.25 }}>
                        ¥{fmt(groupBal)}
                      </Typography>
                      <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                        {g.accounts.map((a) => (
                          <Stack key={a.id} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{a.name}</Typography>
                            <Typography sx={{ fontSize: 10, fontWeight: 500, color: (finalBal[a.id] ?? 0) < 0 ? 'error.main' : 'text.primary' }}>
                              ¥{fmt(finalBal[a.id] ?? 0)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </>
                  ) : (
                    <Typography variant="subtitle2" fontWeight={700}
                      sx={{ color: groupBal < 0 ? 'error.main' : '#263238', fontSize: 13, mt: 0.25 }}>
                      ¥{fmt(groupBal)}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── InlineEditName: 摘要インライン編集 ──────────────────

function InlineEditName({ value, onSave, fontSize = 12, fontWeight = 400 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <TextField
        variant="standard"
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        autoFocus
        inputProps={{ style: { fontSize, fontWeight, padding: 0 } }}
        sx={{ '& .MuiInput-underline:before': { borderBottom: '1px solid #90a4ae' } }}
      />
    )
  }

  return (
    <Typography
      variant="body2"
      onClick={() => { setDraft(value); setEditing(true) }}
      sx={{ fontSize, fontWeight, cursor: 'text', '&:hover': { bgcolor: '#f5f5f5', borderRadius: 0.5 } }}
    >
      {value}
    </Typography>
  )
}

// ─── InlineEditAmount: 金額インライン編集（CalcPad） ─────

function InlineEditAmount({ value, sign, isTransfer, onSave, fontSize = 12 }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const handleOpen = () => { setDraft(String(value || '')); setOpen(true) }
  const handleConfirm = () => {
    const a = parseAmount(draft)
    if (a > 0 && a !== value) onSave(a)
    setOpen(false)
  }

  const color = isTransfer ? '#1565c0' : sign > 0 ? '#2e7d32' : '#c62828'
  const prefix = isTransfer ? '' : sign > 0 ? '+' : '−'

  return (
    <>
      <Typography
        variant="caption"
        onClick={handleOpen}
        sx={{
          fontSize, color, cursor: 'pointer',
          '&:hover': { bgcolor: '#f5f5f5', borderRadius: 0.5 },
        }}
      >
        {prefix}¥{fmt(value)}
      </Typography>
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => {}}
        disableSwipeToOpen
        disableScrollLock
        sx={{ zIndex: 1500 }}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 3, maxWidth: 600, mx: 'auto' } }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto', mb: 1.5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>金額</Typography>
        <Box sx={{
          bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5,
          display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
        }}>
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
          <Typography sx={{
            color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            minHeight: 44,
          }}>
            {parseAmount(draft) > 0 ? fmt(parseAmount(draft)) : '0'}
          </Typography>
        </Box>
        <CalcPad
          value={draft}
          onChange={setDraft}
          onConfirm={handleConfirm}
          disabled={parseAmount(draft) <= 0}
        />
      </SwipeableDrawer>
    </>
  )
}

// ─── F: タイムライン表示（手動イベント編集付き）──────────

function TimelineView({ accounts, openingBalances, events, onEdit, onDelete, onNameEdit, onAmountEdit }) {
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

  const runBal = {}
  accounts.forEach((a) => { runBal[a.id] = openingBalances[a.id] ?? 0 })

  const sorted = [...events].sort((a, b) => {
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    return eventSortOrder(a) - eventSortOrder(b)
  })

  const items = sorted.map((ev) => {
    if (ev.type === 'transfer') {
      runBal[ev.fromAccountId] = (runBal[ev.fromAccountId] ?? 0) - ev.amount
      runBal[ev.toAccountId]   = (runBal[ev.toAccountId]   ?? 0) + ev.amount
      return { ...ev, fromBal: runBal[ev.fromAccountId], toBal: runBal[ev.toAccountId] }
    } else {
      runBal[ev.accountId] = (runBal[ev.accountId] ?? 0) + ev.sign * ev.amount
      return { ...ev, bal: runBal[ev.accountId] }
    }
  })

  const SOURCE_LABELS = { cc_jcb: 'JCB自動', cc_smbc: 'SMBC自動', salary: '給与自動', fixed: '固定', manual: null }

  const byDate = []
  items.forEach((item) => {
    const last = byDate[byDate.length - 1]
    if (last && last.date === item.date) last.items.push(item)
    else byDate.push({ date: item.date, items: [item] })
  })

  return (
    <Box>
      {byDate.map((day) => (
        <Box key={day.date} sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{
            display: 'block', px: 1.5, py: 0.5, mb: 0.5,
            bgcolor: '#eceff1', color: '#546e7a', fontWeight: 700, fontSize: 11, borderRadius: 1,
          }}>
            {day.date}
          </Typography>
          <Stack spacing={0.75}>
            {day.items.map((ev) => {
              const isTransfer = ev.type === 'transfer'
              const isManual   = ev.source === 'manual'
              const autoLabel  = SOURCE_LABELS[ev.source]
              return (
                <Box key={ev.id} sx={{
                  px: 1.5, py: 1,
                  bgcolor: isTransfer ? '#e8f0fe' : ev.sign === 1 ? '#f1f8e9' : '#fff8f8',
                  borderRadius: 1.5,
                  borderLeft: `3px solid ${isTransfer ? '#1565c0' : ev.sign === 1 ? '#2e7d32' : '#c62828'}`,
                }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                        <InlineEditName
                          value={ev.name}
                          onSave={(n) => onNameEdit(ev.id, ev.source, n, ev.fixedId)}
                          fontSize={13}
                          fontWeight={600}
                        />
                        {autoLabel && (
                          <Chip label={autoLabel} size="small" sx={{
                            height: 16, fontSize: 9,
                            bgcolor: ev.source === 'fixed' ? '#ede7f6' : '#e3f2fd',
                            color: ev.source === 'fixed' ? '#4a148c' : '#1565c0',
                          }} />
                        )}
                      </Stack>
                      {isTransfer ? (
                        <Typography variant="caption" sx={{ color: '#1565c0', fontSize: 10 }}>
                          {accMap[ev.fromAccountId] ?? ev.fromAccountId} → {accMap[ev.toAccountId] ?? ev.toAccountId}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                          {accMap[ev.accountId] ?? ev.accountId}　残高: ¥{fmt(ev.bal)}
                        </Typography>
                      )}
                    </Stack>
                    <Stack alignItems="flex-end">
                      <InlineEditAmount
                        value={ev.amount} sign={ev.sign} isTransfer={isTransfer}
                        onSave={(a) => onAmountEdit(ev.id, ev.source, a, ev.fixedId)}
                        fontSize={14}
                      />
                      <Stack direction="row" sx={{ mt: 0.25 }}>
                        {isManual && (
                          <IconButton size="small" onClick={() => onEdit(ev)} sx={{ p: 0.25 }}>
                            <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => onDelete(ev.id, ev.source, ev.name)} sx={{ p: 0.25 }}>
                          <DeleteIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Stack>
                  {isTransfer && (
                    <Stack direction="row" gap={2} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: 10, color: '#c62828' }}>
                        {accMap[ev.fromAccountId]}: ¥{fmt(ev.fromBal)}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10, color: '#2e7d32' }}>
                        {accMap[ev.toAccountId]}: ¥{fmt(ev.toBal)}
                      </Typography>
                    </Stack>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      ))}
      {byDate.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 2, textAlign: 'center' }}>
          イベントがありません
        </Typography>
      )}
    </Box>
  )
}

// ─── B + E: キャッシュフロー表（編集・カラーヘッダー）───

const TYPE_CHIP = {
  fixed:    { label: '固定',   bg: '#f3e5f5', col: '#6a1b9a' },
  salary:   { label: '給与',   bg: '#e8f5e9', col: '#1b5e20' },
  cc_jcb:   { label: 'JCB',   bg: '#e3f2fd', col: '#1565c0' },
  cc_smbc:  { label: 'SMBC',  bg: '#e3f2fd', col: '#1565c0' },
  manual:   { label: '手動',   bg: '#fff3e0', col: '#e65100' },
  transfer: { label: '振替',   bg: '#e3f2fd', col: '#1565c0' },
}

function buildGroupedHeader(accounts) {
  const groupSpans = {}
  accounts.forEach((a) => { if (a.group) groupSpans[a.group] = (groupSpans[a.group] ?? 0) + 1 })
  const headerCells = []
  const seenGroups = new Set()
  accounts.forEach((a) => {
    if (a.group) {
      if (!seenGroups.has(a.group)) {
        seenGroups.add(a.group)
        headerCells.push({ id: a.group, label: a.groupName ?? a.group, colspan: groupSpans[a.group], isGroup: true })
      }
    } else {
      headerCells.push({ id: a.id, label: a.name, colspan: 1, isGroup: false })
    }
  })
  return headerCells
}

function CashFlowTable({ accounts, openingBalances, events, colorMap, onEdit, onDelete, onNameEdit, onAmountEdit, ym, openingDate }) {
  const [balEdit, setBalEdit] = useState(null)
  const [balDraft, setBalDraft] = useState('')

  const initBal = {}
  accounts.forEach((a) => { initBal[a.id] = openingBalances[a.id] ?? 0 })

  const sorted = [...events]
    .filter((ev) => !openingDate || ev.date >= openingDate)
    .sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return eventSortOrder(a) - eventSortOrder(b)
    })

  // Build event rows with running balances
  const runBal = { ...initBal }
  const eventRows = []
  sorted.forEach((ev) => {
    if (ev.type === 'transfer') {
      runBal[ev.fromAccountId] = (runBal[ev.fromAccountId] ?? 0) - ev.amount
      runBal[ev.toAccountId]   = (runBal[ev.toAccountId]   ?? 0) + ev.amount
    } else {
      runBal[ev.accountId] = (runBal[ev.accountId] ?? 0) + ev.sign * ev.amount
    }
    eventRows.push({ ...ev, balances: { ...runBal } })
  })

  const eventsByDate = {}
  eventRows.forEach((row) => {
    if (!eventsByDate[row.date]) eventsByDate[row.date] = []
    eventsByDate[row.date].push(row)
  })

  // Precompute end-of-day balances
  const balAfterDay = {}
  const runBal2 = { ...initBal }
  sorted.forEach((ev) => {
    if (ev.type === 'transfer') {
      runBal2[ev.fromAccountId] = (runBal2[ev.fromAccountId] ?? 0) - ev.amount
      runBal2[ev.toAccountId]   = (runBal2[ev.toAccountId]   ?? 0) + ev.amount
    } else {
      runBal2[ev.accountId] = (runBal2[ev.accountId] ?? 0) + ev.sign * ev.amount
    }
    balAfterDay[ev.date] = { ...runBal2 }
  })

  // Generate all-days rows
  const [ymYear, ymMonth] = (ym ?? '2026-01').split('-').map(Number)
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate()

  const openingLabel = openingDate
    ? `残高（${parseInt(openingDate.slice(8), 10)}日）`
    : '残高'
  const openingDay = openingDate ? parseInt(openingDate.slice(8), 10) : 0
  const rows = []
  let lastBal = { ...initBal }

  // 繰越日付が未設定 or 1日 → 先頭に繰越行
  if (!openingDate || openingDay <= 1) {
    rows.push({ id: '__opening', label: openingLabel, isOpening: true, balances: { ...initBal }, openingDate })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ymYear}-${String(ymMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    // 繰越日付の位置に繰越行を挿入
    if (openingDate && d === openingDay && openingDay > 1) {
      rows.push({ id: '__opening', label: openingLabel, isOpening: true, balances: { ...initBal }, openingDate })
    }

    // 繰越日付より前の日はイベントがあっても空白行扱い
    if (openingDate && d < openingDay) {
      rows.push({ id: `__blank_${dateStr}`, date: dateStr, isBlank: true, balances: {} })
      continue
    }

    const dayEvents = eventsByDate[dateStr] ?? []
    if (dayEvents.length > 0) {
      dayEvents.forEach((ev) => rows.push(ev))
      lastBal = { ...balAfterDay[dateStr] }
    } else {
      rows.push({ id: `__blank_${dateStr}`, date: dateStr, isBlank: true, balances: lastBal })
    }
  }

  const headerCells = buildGroupedHeader(accounts)
  const hasGroups   = accounts.some((a) => a.group)
  const totalBal    = (bals) => accounts.reduce((s, a) => s + (bals[a.id] ?? 0), 0)

  const groupColor = {}
  accounts.forEach((a) => {
    if (a.group && !groupColor[a.group]) groupColor[a.group] = colorMap[a.id]
  })

  const headBase = { fontWeight: 600, fontSize: 11, borderBottom: '2px solid #cfd8dc', bgcolor: '#f5f5f5' }
  const stickyDateHead = { ...headBase, position: 'sticky', left: 0, zIndex: 3, width: 76, minWidth: 76, whiteSpace: 'nowrap' }
  const stickyDateCell = { position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, borderBottom: '1px solid #f0f0f0', width: 76, minWidth: 76, py: 0.5, px: 1 }

  return (
    <Box sx={{ overflowX: 'auto', mb: 1.5, WebkitOverflowScrolling: 'touch' }}>
      <Table size="small" sx={{ minWidth: Math.max(accounts.length * 90 + 260, 400) }}>
        <TableHead>
          {hasGroups ? (
            <>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell rowSpan={2} sx={{ ...stickyDateHead, verticalAlign: 'middle' }}>日付</TableCell>
                <TableCell rowSpan={2} sx={{ ...headBase, minWidth: 130, verticalAlign: 'middle' }}>摘要</TableCell>
                <TableCell rowSpan={2} sx={{ ...headBase, minWidth: 56, textAlign: 'center', verticalAlign: 'middle' }}>種別</TableCell>
                {headerCells.map((h) => {
                  const gc = h.isGroup ? groupColor[h.id] : colorMap[h.id]
                  return (
                    <TableCell key={h.id} colSpan={h.colspan} rowSpan={h.isGroup ? 1 : 2}
                      align="center" sx={{
                        fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', verticalAlign: 'middle',
                        bgcolor: gc?.bg ?? '#f5f5f5', borderBottom: `2px solid ${gc?.border ?? '#cfd8dc'}`,
                      }}>
                      {h.label}
                    </TableCell>
                  )
                })}
                <TableCell rowSpan={2} align="right" sx={{
                  fontWeight: 700, fontSize: 11, minWidth: 90, verticalAlign: 'middle',
                  borderBottom: '2px solid #cfd8dc', bgcolor: '#263238', color: '#fff',
                }}>合計</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                {accounts.map((acc) => {
                  if (!acc.group) return null
                  const c = colorMap[acc.id]
                  return (
                    <TableCell key={acc.id} align="right" sx={{
                      fontWeight: 600, fontSize: 11, minWidth: 80, whiteSpace: 'nowrap',
                      bgcolor: c?.bg ?? '#f5f5f5', borderBottom: `2px solid ${c?.border ?? '#cfd8dc'}`,
                    }}>
                      {acc.name}
                    </TableCell>
                  )
                })}
              </TableRow>
            </>
          ) : (
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={stickyDateHead}>日付</TableCell>
              <TableCell sx={{ ...headBase, minWidth: 130 }}>摘要</TableCell>
              <TableCell sx={{ ...headBase, minWidth: 56, textAlign: 'center' }}>種別</TableCell>
              {accounts.map((acc) => {
                const c = colorMap[acc.id]
                return (
                  <TableCell key={acc.id} align="right" sx={{
                    ...headBase, minWidth: 80, whiteSpace: 'nowrap',
                    bgcolor: c?.bg ?? '#f5f5f5', borderBottom: `2px solid ${c?.border ?? '#cfd8dc'}`,
                  }}>
                    {acc.name}
                  </TableCell>
                )
              })}
              <TableCell align="right" sx={{ ...headBase, minWidth: 90, bgcolor: '#263238', color: '#fff' }}>合計</TableCell>
            </TableRow>
          )}
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const isTransfer = row.type === 'transfer'
            const isManual   = row.source === 'manual'
            const isBlank    = row.isBlank
            const isOpening  = row.isOpening
            const total      = totalBal(row.balances)

            // 種別チップ
            const chipKey = isTransfer ? 'transfer' : (row.source ?? null)
            const chip    = chipKey ? TYPE_CHIP[chipKey] : null

            // 日付表示（曜日付き）
            const DOW = ['日', '月', '火', '水', '木', '金', '土']
            const dayNum = row.date ? parseInt(row.date.slice(8), 10) : null
            const dow = row.date ? DOW[new Date(row.date).getDay()] : ''
            const isSun = dow === '日'
            const isSat = dow === '土'
            const dateLabel = isOpening
              ? (row.openingDate ? `${parseInt(row.openingDate.slice(8), 10)}日` : '繰越')
              : (dayNum != null ? `${dayNum}日` : '')
            const dowLabel  = dow ? `(${dow})` : ''

            return (
              <TableRow key={row.id} sx={{
                bgcolor: isBlank ? 'transparent' : undefined,
                '&:hover': { bgcolor: '#f5f5f5' },
                opacity: isBlank ? 0.6 : 1,
              }}>
                {/* 日付 */}
                <TableCell sx={{
                  ...stickyDateCell,
                  bgcolor: isOpening ? '#eceff1'
                    : isSun ? '#fff5f5' : isSat ? '#f0f4ff' : 'background.paper',
                  fontWeight: isOpening ? 700 : (isBlank ? 400 : 500),
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                }}>
                  <Box component="span" sx={{ color: isBlank ? 'text.disabled' : 'text.primary' }}>
                    {dateLabel}
                  </Box>
                  {dowLabel && (
                    <Box component="span" sx={{
                      fontSize: 10, ml: 0.25,
                      color: isSun ? '#e53935' : isSat ? '#1565c0' : 'text.disabled',
                    }}>
                      {dowLabel}
                    </Box>
                  )}
                </TableCell>

                {/* 摘要 */}
                <TableCell sx={{ borderBottom: '1px solid #f0f0f0', py: 0.5, px: 1 }}>
                  {!isBlank && !isOpening && (
                    <>
                      <InlineEditName
                        value={row.label ?? row.name}
                        onSave={(n) => onNameEdit(row.id, row.source, n, row.fixedId)}
                        fontSize={12}
                        fontWeight={isManual ? 600 : 400}
                      />
                      <InlineEditAmount
                        value={row.amount} sign={row.sign} isTransfer={isTransfer}
                        onSave={(a) => onAmountEdit(row.id, row.source, a, row.fixedId)}
                        fontSize={10}
                      />
                      <Stack direction="row" sx={{ mt: 0.125 }}>
                        {isManual && (
                          <IconButton size="small" onClick={() => onEdit(row)} sx={{ p: 0.25 }}>
                            <EditIcon sx={{ fontSize: 11, color: '#90a4ae' }} />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => onDelete(row.id, row.source, row.name)} sx={{ p: 0.25 }}>
                          <DeleteIcon sx={{ fontSize: 11, color: '#90a4ae' }} />
                        </IconButton>
                      </Stack>
                    </>
                  )}
                  {isOpening && (
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                      {row.label ?? '残高'}
                    </Typography>
                  )}
                </TableCell>

                {/* 種別 */}
                <TableCell align="center" sx={{ borderBottom: '1px solid #f0f0f0', py: 0.5, px: 0.5 }}>
                  {chip && (
                    <Chip label={chip.label} size="small" sx={{
                      height: 16, fontSize: 9, bgcolor: chip.bg, color: chip.col,
                    }} />
                  )}
                </TableCell>

                {/* 口座残高 */}
                {accounts.map((acc) => {
                  const isFrom     = isTransfer && row.fromAccountId === acc.id
                  const isTo       = isTransfer && row.toAccountId   === acc.id
                  const isAffected = !isOpening && !isBlank && (!isTransfer ? row.accountId === acc.id : (isFrom || isTo))
                  const bal        = row.balances[acc.id] ?? 0
                  let bgColor = 'transparent'
                  if (isFrom) bgColor = '#fff8f8'
                  else if (isTo) bgColor = '#f1f8e9'
                  else if (isAffected) bgColor = row.sign > 0 ? '#f1f8e9' : '#fff8f8'
                  const canEdit = isAffected && (isManual || row.source === 'fixed')
                  return (
                    <TableCell key={acc.id} align="right" sx={{
                      bgcolor: bgColor,
                      color: bal < 0 ? 'error.main' : isBlank ? 'text.disabled' : 'inherit',
                      fontWeight: isAffected ? 700 : 400,
                      fontSize: 12, borderBottom: '1px solid #f0f0f0',
                      ...(canEdit ? { cursor: 'pointer', '&:active': { bgcolor: '#e3f2fd' } } : {}),
                    }}
                      {...(canEdit ? { onClick: () => { setBalDraft(String(row.amount || '')); setBalEdit({ id: row.id, source: row.source, fixedId: row.fixedId, amount: row.amount }) } } : {})}
                    >
                      ¥{fmt(bal)}
                    </TableCell>
                  )
                })}

                {/* 合計 */}
                <TableCell align="right" sx={{
                  fontWeight: 700, fontSize: 12, bgcolor: '#f5f7fa',
                  color: total < 0 ? 'error.main' : isBlank ? 'text.disabled' : '#263238',
                  borderBottom: '1px solid #e0e0e0', borderLeft: '2px solid #cfd8dc',
                }}>
                  ¥{fmt(total)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* 残高セルタップ時の金額編集ドロワー */}
      <SwipeableDrawer
        anchor="bottom"
        open={!!balEdit}
        onClose={() => setBalEdit(null)}
        onOpen={() => {}}
        disableSwipeToOpen
        disableScrollLock
        sx={{ zIndex: 1500 }}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 3, maxWidth: 600, mx: 'auto' } }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto', mb: 1.5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>金額</Typography>
        <Box sx={{
          bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5,
          display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
        }}>
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
          <Typography sx={{
            color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            minHeight: 44,
          }}>
            {parseAmount(balDraft) > 0 ? fmt(parseAmount(balDraft)) : '0'}
          </Typography>
        </Box>
        <CalcPad
          value={balDraft}
          onChange={setBalDraft}
          onConfirm={() => {
            const a = parseAmount(balDraft)
            if (a > 0 && balEdit && a !== balEdit.amount) {
              onAmountEdit(balEdit.id, balEdit.source, a, balEdit.fixedId)
            }
            setBalEdit(null)
          }}
          disabled={parseAmount(balDraft) <= 0}
        />
      </SwipeableDrawer>
    </Box>
  )
}

// ─── 固定イベントダイアログ ──────────────────────────────

function FixedEventDialog({ open, onClose, onSave, initial, accounts }) {
  const initType = initial?.type === 'transfer' ? 'transfer' : (initial?.sign === 1 ? 'income' : 'expense')
  const [name,          setName]          = useState(initial?.name          ?? '')
  const [frequency,     setFrequency]     = useState(initial?.frequency    ?? 'monthly')
  const [day,           setDay]           = useState(initial?.day           ?? '')
  const [dayOfWeek,     setDayOfWeek]     = useState(initial?.dayOfWeek    ?? 5)
  const [amount,        setAmount]        = useState(initial?.amount        ?? '')
  const [type,          setType]          = useState(initType)
  const [accountId,     setAccountId]     = useState(initial?.accountId     ?? accounts[0]?.id ?? '')
  const [fromAccountId, setFromAccountId] = useState(initial?.fromAccountId ?? accounts[0]?.id ?? '')
  const [toAccountId,   setToAccountId]   = useState(initial?.toAccountId   ?? accounts[1]?.id ?? accounts[0]?.id ?? '')

  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0) return
    const base = { name: name.trim(), frequency, amount: a }
    if (frequency === 'monthly') {
      const d = parseInt(day, 10)
      if (isNaN(d) || d < 1 || d > 31) return
      base.day = d
    } else {
      base.dayOfWeek = dayOfWeek
    }
    if (type === 'transfer') {
      onSave({ ...base, type: 'transfer', fromAccountId, toAccountId })
    } else {
      onSave({ ...base, accountId, sign: type === 'income' ? 1 : -1 })
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>{initial ? '固定イベントを編集' : '固定イベントを追加'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="摘要" size="small" fullWidth placeholder="例: 家賃, 生活費"
            value={name} onChange={(e) => setName(e.target.value)} />
          <Stack direction="row" gap={1}>
            {['monthly', 'weekly'].map((f) => (
              <Chip key={f} label={f === 'monthly' ? '毎月' : '毎週'} onClick={() => setFrequency(f)}
                sx={{
                  fontWeight: frequency === f ? 700 : 400,
                  bgcolor: frequency === f ? '#37474f' : '#f5f5f5',
                  color: frequency === f ? '#fff' : 'text.secondary',
                }}
              />
            ))}
          </Stack>
          {frequency === 'monthly' ? (
            <TextField label="毎月何日" size="small" type="number" fullWidth
              inputProps={{ min: 1, max: 31 }} placeholder="1〜31"
              value={day} onChange={(e) => setDay(e.target.value)} />
          ) : (
            <FormControl size="small" fullWidth>
              <InputLabel>曜日</InputLabel>
              <Select value={dayOfWeek} label="曜日" onChange={(e) => setDayOfWeek(e.target.value)}>
                {DAY_OF_WEEK_LABELS.map((l, idx) => (
                  <MenuItem key={idx} value={idx}>毎週{l}曜日</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
          <Stack direction="row" gap={1}>
            {[
              { key: 'expense',  label: '支出', bg: '#ffebee', col: '#c62828' },
              { key: 'income',   label: '入金', bg: '#e8f5e9', col: '#2e7d32' },
              { key: 'transfer', label: '振替', bg: '#e3f2fd', col: '#1565c0' },
            ].map((t) => (
              <Chip key={t.key} label={t.label} onClick={() => setType(t.key)}
                sx={{
                  fontWeight: type === t.key ? 700 : 400,
                  bgcolor: type === t.key ? t.bg : '#f5f5f5',
                  color: type === t.key ? t.col : 'text.secondary',
                  border: type === t.key ? `1.5px solid ${t.col}` : '1.5px solid transparent',
                }}
              />
            ))}
          </Stack>
          {type === 'transfer' ? (
            <Stack spacing={1.5}>
              <AccountSelect accounts={accounts} value={fromAccountId} onChange={setFromAccountId} label="振替元" />
              <AccountSelect accounts={accounts} value={toAccountId}   onChange={setToAccountId}   label="振替先" />
            </Stack>
          ) : (
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small">保存</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── A: 繰越残高エディタ（前月引き継ぎボタン付き）────────

function OpeningBalanceEditor({ accounts, balances, onChange, onCarryForward, openingDate, onDateChange }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(balances)
  const [saved, setSaved] = useState(false)

  // 親のbalancesが変わったとき（前月引き継ぎ等）にdraftを同期
  useEffect(() => { setDraft(balances) }, [balances])

  const isDirty = accounts.some((a) => (draft[a.id] ?? 0) !== (balances[a.id] ?? 0))

  const handleSave = () => {
    onChange(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections = []
  const seenGroups = new Set()
  accounts.forEach((acc) => {
    if (acc.group) {
      if (!seenGroups.has(acc.group)) {
        seenGroups.add(acc.group)
        sections.push({ type: 'group', id: acc.group, label: acc.groupName ?? acc.group })
      }
      sections.push({ type: 'account', acc })
    } else {
      sections.push({ type: 'account', acc })
    }
  })

  const dateLabel = openingDate
    ? `${parseInt(openingDate.slice(8), 10)}日時点`
    : ''

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box
        sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            残高{dateLabel && `（${dateLabel}）`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.5)', fontSize: 10 }}>
            合計 ¥{fmt(accounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0))}
          </Typography>
        </Stack>
        <IconButton size="small" sx={{ color: '#fff', p: 0 }}>
          {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
          {/* 基準日選択 */}
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
              基準日
            </Typography>
            <input
              type="date"
              value={openingDate || ''}
              onChange={(e) => onDateChange(e.target.value)}
              style={{
                fontSize: 13, fontWeight: 500, padding: '4px 8px',
                border: '1px solid #cfd8dc', borderRadius: 6,
                outline: 'none', background: '#fafafa', flex: 1, maxWidth: 160,
              }}
            />
            {openingDate && (
              <Button
                size="small" variant="text"
                onClick={() => onDateChange('')}
                sx={{ fontSize: 10, minWidth: 'auto', px: 1, color: 'text.disabled' }}
              >
                クリア
              </Button>
            )}
          </Stack>
          {/* A: 前月引き継ぎボタン */}
          <Button
            size="small" variant="outlined" onClick={onCarryForward}
            sx={{ mb: 1.5, fontSize: 11, borderColor: '#b0bec5', color: 'text.secondary' }}
          >
            前月末残高から引き継ぐ
          </Button>
          <Stack spacing={0.5}>
            {sections.map((s) => {
              if (s.type === 'group') {
                return (
                  <Typography key={s.id} variant="caption"
                    sx={{ fontSize: 10, color: 'text.disabled', letterSpacing: 0.5, pt: 1, pb: 0.25, display: 'block' }}>
                    ── {s.label}
                  </Typography>
                )
              }
              const acc = s.acc
              return (
                <Stack key={acc.id} direction="row" alignItems="center" gap={1.5} sx={{ pl: acc.group ? 1 : 0 }}>
                  <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>{acc.name}</Typography>
                  <Box sx={{ width: 140 }}>
                    <AmountField
                      value={String(draft[acc.id] ?? 0)}
                      onChange={(v) => {
                        const num = parseInt(v, 10)
                        setDraft((prev) => ({ ...prev, [acc.id]: isNaN(num) ? 0 : num }))
                      }}
                      placeholder="0"
                      inputSx={{ '& .MuiInputBase-root': { height: 44 }, '& .MuiInputBase-input': { fontSize: 16, fontWeight: 600 } }}
                    />
                  </Box>
                </Stack>
              )
            })}
          </Stack>
          {/* 保存ボタン */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={saved ? <CheckIcon sx={{ fontSize: 16 }} /> : <SaveIcon sx={{ fontSize: 16 }} />}
              onClick={handleSave}
              disabled={!isDirty && !saved}
              sx={{
                fontSize: 13, fontWeight: 600, borderRadius: 2, px: 2,
                bgcolor: saved ? '#2e7d32' : isDirty ? 'primary.main' : '#bdbdbd',
                '&:hover': { bgcolor: saved ? '#1b5e20' : 'primary.dark' },
                '&.Mui-disabled': { bgcolor: '#e0e0e0', color: '#9e9e9e' },
                transition: 'background-color 0.3s',
              }}
            >
              {saved ? '保存しました' : '保存'}
            </Button>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  )
}

// ─── D: 固定イベント一覧（次回発生日プレビュー付き）────────

function FixedEventsPanel({ fixedEvents, accounts, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <Card sx={{ mb: 1.5 }}>
      <Box
        sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <RepeatIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,.8)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            固定イベント（毎月自動）
          </Typography>
          <Chip label={fixedEvents.length} size="small"
            sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />
        </Stack>
        <Stack direction="row" alignItems="center">
          <IconButton size="small" sx={{ color: '#fff', p: 0.25 }} onClick={(e) => { e.stopPropagation(); onAdd() }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: '#fff', p: 0 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Stack>
      </Box>
      <Collapse in={open}>
        <CardContent sx={{ px: 2, py: 0.5, '&:last-child': { pb: 1 } }}>
          {fixedEvents.length === 0
            ? <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>固定イベントはありません</Typography>
            : [...fixedEvents].sort((a, b) => {
                const ak = a.frequency === 'weekly' ? a.dayOfWeek * 100 : a.day
                const bk = b.frequency === 'weekly' ? b.dayOfWeek * 100 : b.day
                return ak - bk
              }).map((fe, i) => {
                // D: 次回発生日を計算
                const nextDate = getNextOccurrence(fe)
                const nextLabel = `${nextDate.getMonth() + 1}/${nextDate.getDate()}（${DAY_OF_WEEK_LABELS[nextDate.getDay()]}）`
                return (
                  <Box key={fe.id}>
                    {i > 0 && <Divider />}
                    <Stack direction="row" alignItems="center" sx={{ py: 0.75 }}>
                      <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Typography variant="body2" noWrap>{fe.name}</Typography>
                          {fe.type === 'transfer' ? (
                            <Chip
                              label={`${accounts.find(a => a.id === fe.fromAccountId)?.name ?? '?'} → ${accounts.find(a => a.id === fe.toAccountId)?.name ?? '?'}`}
                              size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#e3f2fd', color: '#1565c0' }}
                            />
                          ) : (
                            <Chip label={accounts.find((a) => a.id === fe.accountId)?.name ?? fe.accountId}
                              size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#f3e5f5', color: '#6a1b9a' }} />
                          )}
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="caption" color="text.disabled">
                            {fe.frequency === 'weekly' ? `毎週${DAY_OF_WEEK_LABELS[fe.dayOfWeek]}曜日` : `毎月${fe.day}日`}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#1565c0', fontSize: 10, fontWeight: 600 }}>
                            次回: {nextLabel}
                          </Typography>
                        </Stack>
                      </Stack>
                      <Typography variant="body2" fontWeight={600} sx={{ mx: 1, color: fe.type === 'transfer' ? '#1565c0' : fe.sign > 0 ? '#2e7d32' : '#c62828' }}>
                        {fe.type === 'transfer' ? '' : fe.sign > 0 ? '+' : '−'}¥{fmt(fe.amount)}
                      </Typography>
                      <IconButton size="small" onClick={() => onEdit(fe)} sx={{ p: 0.5 }}>
                        <EditIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => onDelete(fe.id)} sx={{ p: 0.5 }}>
                        <DeleteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                      </IconButton>
                    </Stack>
                  </Box>
                )
              })
          }
        </CardContent>
      </Collapse>
    </Card>
  )
}

// ─── メインコンポーネント ────────────────────────────────

export default function BankAccounts() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const ym = ymStr(year, month)

  const [accounts,        setAccounts]        = useState(loadAccounts)
  const [openingBalances, setOpeningBalances] = useState(() => loadOpeningBalances(ym))
  const [openingDate,     setOpeningDate]     = useState(() => loadOpeningDate(ym))
  const [manualEvents,    setManualEvents]    = useState(() => loadManualEvents(ym))
  const [fixedEvents,     setFixedEvents]     = useState(loadFixedEvents)

  const [nameOverrides,   setNameOverrides]   = useState(loadNameOverrides)
  const [amountOverrides, setAmountOverrides] = useState(loadAmountOverrides)
  const [deletedAutoIds,  setDeletedAutoIds]  = useState(() => loadDeletedAutoIds(ym))

  const [evDlg,       setEvDlg]       = useState(null)
  const [fixedDlg,    setFixedDlg]    = useState(null)
  const [quickOpen,   setQuickOpen]   = useState(false)
  const [viewMode,    setViewMode]    = useState('table')
  const [deleteDlg,   setDeleteDlg]   = useState(null) // { id, source, name, isFixed }

  const todayStr = today.toISOString().slice(0, 10)
  // デフォルト日付: 表示月が当月なら今日、それ以外は表示月の1日
  const defaultEventDate = todayStr.slice(0, 7) === ym ? todayStr : `${ym}-01`

  const colorMap = useMemo(() => buildColorMap(accounts), [accounts])

  // 指定月の前月末残高を計算する（表示と完全一致させる）
  const calcPrevEndBal = useCallback((y, m) => {
    let py = y, pm = m - 1
    if (pm < 1) { py--; pm = 12 }
    const prevYm         = ymStr(py, pm)
    const prevOpening    = loadOpeningBalances(prevYm)
    const prevOpeningDate = loadOpeningDate(prevYm)
    const prevManual     = loadManualEvents(prevYm)
    const prevAuto       = buildAutoEvents(prevYm, accounts, fixedEvents)
    const prevDeleted    = new Set(loadDeletedAutoIds(prevYm))
    const prevAmtOv      = loadAmountOverrides()
    const filteredAuto = prevAuto
      .filter(ev => !prevDeleted.has(ev.id))
      .map(ev => {
        let patched = ev
        if (prevAmtOv[ev.id] != null) patched = { ...patched, amount: prevAmtOv[ev.id] }
        return patched
      })
    // openingDate以降のイベントのみ集計（基準日前は繰越残高に含まれるため除外）
    const prevAll = [...filteredAuto, ...prevManual]
      .filter(ev => !prevOpeningDate || ev.date >= prevOpeningDate)
    const bal = {}
    accounts.forEach((a) => { bal[a.id] = prevOpening[a.id] ?? 0 })
    prevAll.forEach((ev) => {
      if (ev.type === 'transfer') {
        bal[ev.fromAccountId] = (bal[ev.fromAccountId] ?? 0) - ev.amount
        bal[ev.toAccountId]   = (bal[ev.toAccountId]   ?? 0) + ev.amount
      } else {
        bal[ev.accountId] = (bal[ev.accountId] ?? 0) + ev.sign * ev.amount
      }
    })
    return bal
  }, [accounts, fixedEvents])

  // 月切り替え時：手動フラグがなければ常に前月末残高から自動繰越
  const changeMonth = (delta) => {
    let y = year, m = month + delta
    if (m > 12) { y++; m = 1 }
    if (m < 1)  { y--; m = 12 }
    const newYm = ymStr(y, m)
    let bal
    if (isOpeningManual(newYm)) {
      bal = loadOpeningBalances(newYm)
    } else {
      bal = calcPrevEndBal(y, m)
      saveOpeningBalances(newYm, bal)
    }
    setYear(y); setMonth(m)
    setOpeningBalances(bal)
    setOpeningDate(loadOpeningDate(newYm))
    setManualEvents(loadManualEvents(newYm))
    setDeletedAutoIds(loadDeletedAutoIds(newYm))
  }

  const autoEvents = useMemo(() => buildAutoEvents(ym, accounts, fixedEvents), [ym, accounts, fixedEvents])
  const allEvents  = useMemo(() => {
    const deletedSet = new Set(deletedAutoIds)
    const autos = autoEvents
      .filter(ev => !deletedSet.has(ev.id))
      .map(ev => {
        let patched = ev
        if (nameOverrides[ev.id]) patched = { ...patched, name: nameOverrides[ev.id] }
        if (amountOverrides[ev.id] != null) patched = { ...patched, amount: amountOverrides[ev.id] }
        return patched
      })
    return [...autos, ...manualEvents]
  }, [autoEvents, manualEvents, nameOverrides, amountOverrides, deletedAutoIds])

  // G: 最終残高を計算してスナップショット保存（openingDate以降のイベントのみ）
  const finalTotal = useMemo(() => {
    const bal = {}
    accounts.forEach((a) => { bal[a.id] = openingBalances[a.id] ?? 0 })
    const filtered = openingDate
      ? allEvents.filter(ev => ev.date >= openingDate)
      : allEvents
    filtered.forEach((ev) => {
      if (ev.type === 'transfer') {
        bal[ev.fromAccountId] = (bal[ev.fromAccountId] ?? 0) - ev.amount
        bal[ev.toAccountId]   = (bal[ev.toAccountId]   ?? 0) + ev.amount
      } else {
        bal[ev.accountId] = (bal[ev.accountId] ?? 0) + ev.sign * ev.amount
      }
    })
    return accounts.reduce((s, a) => s + (bal[a.id] ?? 0), 0)
  }, [accounts, openingBalances, allEvents, openingDate])

  useEffect(() => {
    saveSnapshot(ym, { total: finalTotal })
  }, [ym, finalTotal])

  const handleOpeningChange = (next, manual = false) => {
    setOpeningBalances(next); saveOpeningBalances(ym, next)
    if (manual) setOpeningManual(ym, true)
  }
  const handleOpeningDateChange = (d) => { setOpeningDate(d); saveOpeningDate(ym, d) }

  // 初期ロード時：手動フラグがなければ前月末残高を自動繰越
  useEffect(() => {
    if (!isOpeningManual(ym)) {
      const carryBal = calcPrevEndBal(year, month)
      const hasAny = accounts.some((a) => (carryBal[a.id] ?? 0) !== 0)
      if (hasAny) {
        setOpeningBalances(carryBal)
        saveOpeningBalances(ym, carryBal)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A: 前月末残高を引き継ぐ（手動ボタン用 → 手動フラグ解除して自動繰越に戻す）
  const handleCarryForward = useCallback(() => {
    const bal = calcPrevEndBal(year, month)
    setOpeningManual(ym, false)
    setOpeningBalances(bal)
    saveOpeningBalances(ym, bal)
  }, [year, month, ym, calcPrevEndBal])

  // 手動イベント CRUD
  const addEvent = (data) => {
    const next = [...manualEvents, { id: newId(), source: 'manual', ...data }]
    setManualEvents(next); saveManualEvents(ym, next)
  }
  const editEvent = (data) => {
    const next = manualEvents.map((x) => x.id === evDlg.initial.id ? { ...x, ...data } : x)
    setManualEvents(next); saveManualEvents(ym, next)
  }

  // 固定イベント CRUD
  const addFixed = (data) => {
    const next = [...fixedEvents, { id: newId(), ...data }]
    setFixedEvents(next); saveFixedEvents(next)
  }
  const editFixed = (data) => {
    const next = fixedEvents.map((x) => x.id === fixedDlg.initial.id ? { ...x, ...data } : x)
    setFixedEvents(next); saveFixedEvents(next)
  }
  const requestDeleteFixed = useCallback((id) => {
    const fe = fixedEvents.find(x => x.id === id)
    setDeleteDlg({ id, source: 'fixed', name: fe?.name || '?', isFixed: true })
  }, [fixedEvents])

  // 摘要インライン編集ハンドラ
  const handleInlineNameEdit = useCallback((eventId, source, newName, fixedId) => {
    if (source === 'manual') {
      const next = manualEvents.map((x) => x.id === eventId ? { ...x, name: newName } : x)
      setManualEvents(next); saveManualEvents(ym, next)
    } else if (source === 'fixed' && fixedId) {
      const next = fixedEvents.map((x) => x.id === fixedId ? { ...x, name: newName } : x)
      setFixedEvents(next); saveFixedEvents(next)
    } else {
      const next = { ...nameOverrides, [eventId]: newName }
      setNameOverrides(next); saveNameOverrides(next)
    }
  }, [manualEvents, fixedEvents, nameOverrides, ym])

  // 金額インライン編集ハンドラ
  const handleInlineAmountEdit = useCallback((eventId, source, newAmount, fixedId) => {
    if (source === 'manual') {
      const next = manualEvents.map((x) => x.id === eventId ? { ...x, amount: newAmount } : x)
      setManualEvents(next); saveManualEvents(ym, next)
    } else if (source === 'fixed' && fixedId) {
      const next = fixedEvents.map((x) => x.id === fixedId ? { ...x, amount: newAmount } : x)
      setFixedEvents(next); saveFixedEvents(next)
    } else {
      // 自動イベント（cc_jcb, cc_smbc, salary等）の金額オーバーライド
      const next = { ...amountOverrides, [eventId]: newAmount }
      setAmountOverrides(next); saveAmountOverrides(next)
    }
  }, [manualEvents, fixedEvents, amountOverrides, ym])

  // B + F: テーブル・タイムラインからの編集用ハンドラ
  const handleEditEvent  = useCallback((ev) => setEvDlg({ type: 'edit', initial: ev }), [])
  const requestDeleteEvent = useCallback((id, source, name) => {
    setDeleteDlg({ id, source, name: name || '?', isFixed: false })
  }, [])
  const confirmDeleteEvent = useCallback(() => {
    if (!deleteDlg) return
    const { id, source, isFixed } = deleteDlg
    if (isFixed) {
      const next = fixedEvents.filter((x) => x.id !== id)
      setFixedEvents(next); saveFixedEvents(next)
    } else if (source === 'manual') {
      const next = manualEvents.filter((x) => x.id !== id)
      setManualEvents(next); saveManualEvents(ym, next)
    } else {
      const next = [...deletedAutoIds, id]
      setDeletedAutoIds(next); saveDeletedAutoIds(ym, next)
    }
    setDeleteDlg(null)
  }, [deleteDlg, manualEvents, fixedEvents, deletedAutoIds, ym])

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {year}年{month}月
        </Typography>
        <IconButton size="small" onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* A: 繰越残高 */}
      <OpeningBalanceEditor
        accounts={accounts} balances={openingBalances}
        onChange={(next) => handleOpeningChange(next, true)} onCarryForward={handleCarryForward}
        openingDate={openingDate} onDateChange={handleOpeningDateChange}
      />

      {/* D: 固定イベント */}
      <FixedEventsPanel
        fixedEvents={fixedEvents} accounts={accounts}
        onAdd={() => setFixedDlg({ type: 'add' })}
        onEdit={(fe) => setFixedDlg({ type: 'edit', initial: fe })}
        onDelete={requestDeleteFixed}
      />

      {/* B + F: キャッシュフロー */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            キャッシュフロー
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <IconButton size="small"
              onClick={() => setViewMode((v) => v === 'table' ? 'timeline' : 'table')}
              sx={{ p: 0.25, color: '#fff' }}>
              {viewMode === 'table'
                ? <ViewListIcon sx={{ fontSize: 18 }} />
                : <TableChartIcon sx={{ fontSize: 18 }} />
              }
            </IconButton>
            <IconButton size="small" onClick={() => setEvDlg({ type: 'add' })} sx={{ p: 0.25, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>

        {viewMode === 'table' ? (
          <CashFlowTable
            accounts={accounts} openingBalances={openingBalances} events={allEvents}
            colorMap={colorMap} onEdit={handleEditEvent} onDelete={requestDeleteEvent}
            onNameEdit={handleInlineNameEdit} onAmountEdit={handleInlineAmountEdit} ym={ym}
            openingDate={openingDate}
          />
        ) : (
          <CardContent sx={{ px: 1.5, py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <TimelineView
              accounts={accounts} openingBalances={openingBalances} events={allEvents}
              onEdit={handleEditEvent} onDelete={requestDeleteEvent}
              onNameEdit={handleInlineNameEdit} onAmountEdit={handleInlineAmountEdit}
            />
          </CardContent>
        )}
      </Card>

      {/* FAB */}
      <Fab color="primary" onClick={() => setQuickOpen(true)}
        sx={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, zIndex: 200 }}>
        <AddIcon />
      </Fab>

      {/* ダイアログ: 手動イベント */}
      {evDlg && (
        <EventDialog open onClose={() => setEvDlg(null)}
          onSave={evDlg.type === 'edit' ? editEvent : addEvent}
          initial={evDlg.initial} accounts={accounts}
          defaultDate={defaultEventDate}
          allEvents={allEvents} openingBalances={openingBalances} />
      )}

      {/* 固定イベントダイアログ */}
      {fixedDlg && (
        <FixedEventDialog open onClose={() => setFixedDlg(null)}
          onSave={fixedDlg.type === 'edit' ? editFixed : addFixed}
          initial={fixedDlg.initial} accounts={accounts} />
      )}

      {/* クイック入力ボトムシート */}
      <QuickAddDrawer
        open={quickOpen} onClose={() => setQuickOpen(false)}
        onSave={addEvent} accounts={accounts} defaultDate={defaultEventDate}
        allEvents={allEvents} openingBalances={openingBalances}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteDlg} onClose={() => setDeleteDlg(null)} maxWidth="xs">
        <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>削除確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            「{deleteDlg?.name}」を削除しますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDlg(null)} color="inherit" size="small">キャンセル</Button>
          <Button onClick={confirmDeleteEvent} variant="contained" color="error" size="small">削除</Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
