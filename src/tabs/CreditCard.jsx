import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, Fab,
  Snackbar, Alert, Collapse, InputBase, Checkbox,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SettingsIcon from '@mui/icons-material/Settings'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  getCCTotal, loadCategories, saveCategories,
  getSalaryTakeHome, DEFAULT_JCB_FIXED,
  fmt, ymStr, newId,
} from '../utils/finance'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'

// ─── カード定義 ────────────────────────────────────────────

const CARDS = {
  jcb: {
    id: 'jcb', name: 'JCBゴールド', shortName: 'JCB',
    cutoffDay: 15, paymentDay: 10, color: '#37474f',
  },
  smbc: {
    id: 'smbc', name: '三井住友VISAナンバーレスゴールド', shortName: 'VISA',
    cutoffDay: 0, paymentDay: 26, color: '#1b5e20',
  },
}

function cutoffLabel(card) { return card.cutoffDay === 0 ? '月末締め' : `${card.cutoffDay}日締め` }
function paymentLabel(card) { return `翌月${card.paymentDay}日払い` }

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function prevBusinessDay(date) {
  const d = new Date(date)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d
}

// ym='YYYY-MM' に対応する締め日・支払日（土日は前営業日）
function cycleDates(card, ym) {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const cutoffDay = card.cutoffDay === 0 ? lastDay : card.cutoffDay
  const cutoffDate = new Date(y, m - 1, cutoffDay)
  const payRaw = new Date(y, m, card.paymentDay)
  const payDate = prevBusinessDay(payRaw)
  return { cutoffDate, payDate }
}

function fmtCycleDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`
}

// 給与日（毎月25日、土日は前営業日）
function nextPayDay(from = new Date()) {
  let candidate = new Date(from.getFullYear(), from.getMonth(), 25)
  if (candidate <= from) candidate = new Date(from.getFullYear(), from.getMonth() + 1, 25)
  return prevBusinessDay(candidate)
}

// from（含まない）から to（含む）までの金曜日数
function countFridaysUntil(from, to) {
  let count = 0
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (d <= to) {
    if (d.getDay() === 5) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ─── ストレージ ────────────────────────────────────────────

function fixedKey(cardId) { return `cc_fixed_${cardId}` }
function varKey(cardId, ym) { return `cc_var_${cardId}_${ym}` }

const INIT_FLAG = 'cc_init_v3'

function loadFixed(cardId) {
  try {
    // リセットフラグがない場合は強制初期化
    if (!localStorage.getItem(INIT_FLAG)) {
      localStorage.removeItem('cc_fixed_jcb')
      localStorage.removeItem('cc_fixed_smbc')
      localStorage.setItem(INIT_FLAG, '1')
    }
    const raw = localStorage.getItem(fixedKey(cardId))
    if (raw) return JSON.parse(raw)
    if (cardId === 'jcb') {
      saveFixed('jcb', DEFAULT_JCB_FIXED)
      return [...DEFAULT_JCB_FIXED]
    }
    return []
  } catch { return [] }
}
function saveFixed(cardId, list) { localStorage.setItem(fixedKey(cardId), JSON.stringify(list)) }

function loadVar(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(varKey(cardId, ym)) || '[]') } catch { return [] }
}
function saveVar(cardId, ym, list) { localStorage.setItem(varKey(cardId, ym), JSON.stringify(list)) }

function loadLimit(cardId) {
  const v = parseFloat(localStorage.getItem(`cc_limit_${cardId}`) || '')
  return isNaN(v) ? '' : String(v)
}
function saveLimit(cardId, v) { localStorage.setItem(`cc_limit_${cardId}`, v) }

function loadBilled(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(`cc_billed_${cardId}_${ym}`) || '[]') } catch { return [] }
}
function saveBilled(cardId, ym, ids) { localStorage.setItem(`cc_billed_${cardId}_${ym}`, JSON.stringify(ids)) }

function loadWeeklyBudget() {
  const v = parseInt(localStorage.getItem('life_weekly_budget') || '', 10)
  return isNaN(v) ? 10000 : v
}
function saveWeeklyBudget(v) { localStorage.setItem('life_weekly_budget', String(v)) }

// 今週の月曜〜日曜を YYYY-MM-DD 文字列で返す
function getThisWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { mondayStr: toStr(monday), sundayStr: toStr(sunday), label: `${monday.getMonth() + 1}/${monday.getDate()} 〜 ${sunday.getMonth() + 1}/${sunday.getDate()}` }
}

// 生活費として集計するカテゴリ
const LIVING_CATEGORIES = ['生活費', '食費', '日用品']

// 生活費カテゴリの合計（date でフィルタする場合は from/to に YYYY-MM-DD を渡す）
function sumLiving(list, fromStr, toStr) {
  return list
    .filter(x => LIVING_CATEGORIES.includes(x.category) && x.sign !== 1 && x.date)
    .filter(x => (!fromStr || x.date >= fromStr) && (!toStr || x.date <= toStr))
    .reduce((s, x) => s + x.amount, 0)
}

function loadSalaryOverride() {
  const v = parseFloat(localStorage.getItem('cc_salary_override') || '')
  return isNaN(v) ? '' : String(v)
}
function saveSalaryOverride(v) { localStorage.setItem('cc_salary_override', v) }

const DEFAULT_SUMMARY_FIXED = [
  { id: 's1', label: '家賃',     amount: 82330 },
  { id: 's2', label: '奨学金',   amount: 13262 },
  { id: 's3', label: '都民共済', amount: 3000 },
]
function loadSummaryFixed() {
  try {
    const s = localStorage.getItem('cc_summary_fixed')
    return s ? JSON.parse(s) : DEFAULT_SUMMARY_FIXED.map(x => ({ ...x }))
  } catch { return DEFAULT_SUMMARY_FIXED.map(x => ({ ...x })) }
}
function saveSummaryFixed(list) { localStorage.setItem('cc_summary_fixed', JSON.stringify(list)) }

function loadLivingUnit() {
  const v = parseInt(localStorage.getItem('cc_living_unit') || '', 10)
  return isNaN(v) ? 10000 : v
}
function saveLivingUnit(v) { localStorage.setItem('cc_living_unit', String(v)) }

// ─── 金額入力ユーティリティ ──────────────────────────────

/** 生文字列（カンマなし）→ カンマ付き表示文字列 */
function fmtInput(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ja-JP')
}
/** カンマ付き文字列 or 数値 → 整数 */
function parseAmount(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

const AMOUNT_STEPS = [
  { label: '+100',    step: 100 },
  { label: '+1,000',  step: 1000 },
  { label: '+10,000', step: 10000 },
]

/**
 * AmountField — カンマ表示 + クイック加算ボタン付き金額入力
 * props:
 *   value      : raw string (カンマなし数字文字列)
 *   onChange   : (rawString) => void
 *   large      : boolean — QuickAddDrawer 用大きいスタイル
 *   dark       : boolean — 暗い背景カード用スタイル
 *   label      : string  — TextField ラベル
 *   placeholder: string
 *   autoFocus  : boolean
 *   inputSx    : TextField sx 追記
 */
function AmountField({ value, onChange, large = false, dark = false, label, placeholder = '0', autoFocus = false, inputSx = {} }) {
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

  const darkSx = dark ? {
    '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,.1)', ...(large ? { height: 64 } : { height: 26 }) },
    '& fieldset': { borderColor: 'rgba(255,255,255,.25)' },
    '& .MuiInputBase-root:hover fieldset': { borderColor: 'rgba(255,255,255,.45)' },
    '& .MuiInputBase-input': { color: '#fff' },
  } : {}

  return (
    <Box>
      <TextField
        fullWidth
        label={label}
        size={large ? undefined : 'small'}
        placeholder={placeholder}
        value={fmtInput(value)}
        onClick={handleOpen}
        inputProps={{
          readOnly: true,
          style: large
            ? { fontSize: 32, fontWeight: 700, textAlign: 'center', color: dark ? '#fff' : undefined }
            : { fontSize: 14, color: dark ? '#fff' : undefined, textAlign: 'right', cursor: 'pointer' },
        }}
        InputProps={{
          startAdornment: large
            ? <Typography variant="h6" color={dark ? 'rgba(255,255,255,.6)' : 'text.secondary'} sx={{ mr: 0.5 }}>¥</Typography>
            : <InputAdornment position="start">
                <Typography variant="caption" sx={{ color: dark ? 'rgba(255,255,255,.5)' : undefined }}>¥</Typography>
              </InputAdornment>,
        }}
        sx={{ ...(large ? { '& .MuiInputBase-root': { height: 64 } } : {}), ...darkSx, ...inputSx }}
      />

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

/* legacy step buttons removed — CalcPad replaces them */

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
              <IconButton size="small" onClick={() => handleMove(i, -1)} disabled={i === 0}
                sx={{ p: 0.25, color: i === 0 ? 'transparent' : 'text.disabled' }}>
                <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => handleMove(i, 1)} disabled={i === categories.length - 1}
                sx={{ p: 0.25, color: i === categories.length - 1 ? 'transparent' : 'text.disabled' }}>
                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(i)} sx={{ p: 0.25, color: 'error.light' }}>
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
  const [name,     setName]     = useState(initial?.name     ?? '')
  const [payee,    setPayee]    = useState(initial?.payee    ?? '')
  const [amount,   setAmount]   = useState(initial?.amount   ?? '')
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? 'その他')
  const [date,     setDate]     = useState(initial?.date     ?? '')
  const [day,      setDay]      = useState(initial?.day      ?? '')
  const [startYm,  setStartYm]  = useState(initial?.startYm  ?? '')

  const isFixed = title?.includes('固定')

  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0) return
    const d = parseInt(day, 10)
    onSave({
      name: name.trim(), payee: payee.trim(), amount: a, category,
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

const CATEGORY_COLORS = {
  '水道光熱費': '#e3f2fd',
  '通信費':     '#f3e5f5',
  '遊興費':     '#fce4ec',
  '美容':       '#fdf5e6',
  '交通費':     '#e8f5e9',
  '食費':       '#fff8e1',
  '日用品':     '#e0f2f1',
  '医療':       '#fbe9e7',
  '衣類':       '#f9fbe7',
  'その他':     '#eceff1',
}

// ─── 電卓パッド ─────────────────────────────────────────

// ─── 電卓パッド（参考アプリ準拠レイアウト）──────────────────
// Row1: + − × ÷
// Row2: 7 8 9 =
// Row3: 4 5 6 00
// Row4: 1 2 3 ⌫
// Row5: 0(×3)  確認

function CalcPad({ value, onChange, onConfirm, disabled }) {
  const [stored, setStored] = useState(null)
  const [op, setOp]         = useState(null)
  const [fresh, setFresh]   = useState(false)

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
    if (fresh) { onChange(d === '00' ? '0' : d); setFresh(false) }
    else { onChange((value === '0' ? '' : (value ?? '')) + d) }
  }

  const pressOp = (next) => {
    const cur = parseAmount(value)
    if (stored !== null && op && !fresh) {
      const r = calc(stored, cur, op); setStored(r); onChange(String(r))
    } else { setStored(cur) }
    setOp(next); setFresh(true)
  }

  const pressBackspace = () => {
    const s = String(value ?? '')
    onChange(s.length <= 1 ? '' : s.slice(0, -1))
  }

  const pressClear = () => { onChange(''); setStored(null); setOp(null); setFresh(false) }

  const pressEquals = () => {
    if (stored !== null && op) {
      const r = calc(stored, parseAmount(value), op)
      onChange(String(r)); setStored(null); setOp(null); setFresh(false)
    }
  }

  const pressConfirm = () => { pressEquals(); onConfirm() }

  // スタイル
  const BASE = {
    minWidth: 0, fontSize: 20, fontWeight: 500, borderRadius: 0,
    py: 1.6, color: '#fff', border: 'none',
  }
  // アプリのダークカード（#263238系）に合わせた青グレーパレット
  const bg  = (c) => ({ bgcolor: c, '&:hover': { bgcolor: c, filter: 'brightness(1.1)' }, '&:active': { filter: 'brightness(0.85)' } })

  const numBtn  = (label, handler) => (
    <Button key={label} onClick={handler ?? (() => pressDigit(label))}
      sx={{ ...BASE, ...bg('#546e7a') }}>{label}</Button>
  )
  const opBtn = (label) => (
    <Button key={label} onClick={() => pressOp(label)}
      sx={{ ...BASE, ...bg(op === label && fresh ? '#0288d1' : '#37474f'), fontSize: 22 }}>{label}</Button>
  )

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1px',
      bgcolor: '#263238',
      overflow: 'hidden',
    }}>
      {/* Row 1: + − × ÷ */}
      {opBtn('+')} {opBtn('−')} {opBtn('×')} {opBtn('÷')}

      {/* Row 2: 7 8 9 = */}
      {numBtn('7')} {numBtn('8')} {numBtn('9')}
      <Button onClick={pressEquals}
        sx={{ ...BASE, ...bg('#0288d1'), fontSize: 24, fontWeight: 700 }}>=</Button>

      {/* Row 3: 4 5 6 C */}
      {numBtn('4')} {numBtn('5')} {numBtn('6')}
      <Button onClick={pressClear} sx={{ ...BASE, ...bg('#78909c'), fontWeight: 700 }}>C</Button>

      {/* Row 4: 1 2 3 ⌫ */}
      {numBtn('1')} {numBtn('2')} {numBtn('3')}
      <Button onClick={pressBackspace} sx={{ ...BASE, ...bg('#37474f') }}>
        <BackspaceOutlinedIcon sx={{ fontSize: 22 }} />
      </Button>

      {/* Row 5: 0(×2) 00 確認 */}
      <Button onClick={() => pressDigit('0')}
        sx={{ ...BASE, ...bg('#546e7a'), gridColumn: 'span 2' }}>0</Button>
      {numBtn('00')}
      <Button onClick={pressConfirm} disabled={disabled}
        sx={{ ...BASE, ...bg(disabled ? '#455a64' : '#c62828'), fontWeight: 700, fontSize: 18 }}>
        確認
      </Button>
    </Box>
  )
}

// ─── 変動費クイック入力（ボトムシート）──────────────────

const TYPE_DEFS = [
  { value: 'income',   label: '収入', color: '#1565c0' },
  { value: 'expense',  label: '支出', color: '#c62828' },
  { value: 'transfer', label: '振替', color: '#37474f' },
]

function QuickAddDrawer({ open, onClose, onSave, categories, defaultDate, onEditCategories, currentCardId }) {
  const [type,     setType]     = useState('expense')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'その他')
  const [name,     setName]     = useState('')
  const [payee,    setPayee]    = useState('')
  const [memo,     setMemo]     = useState('')
  const [date,     setDate]     = useState(defaultDate)
  const [card,     setCard]     = useState(currentCardId)
  const [fromCard, setFromCard] = useState(currentCardId)
  const [toCard,   setToCard]   = useState(currentCardId === 'jcb' ? 'smbc' : 'jcb')
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
          ...(type === 'income' ? { sign: 1 } : {}),
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
                  <IconButton size="small" onClick={e => { e.stopPropagation(); onEditCategories() }} sx={{ p: 0.25 }}>
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


// ─── 費用行 ──────────────────────────────────────────────

function ExpenseRow({ item, onDelete, onEdit, showDate }) {
  return (
    <Stack direction="row" alignItems="center" sx={{ py: 0.75 }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Typography variant="body2" noWrap>{item.name}</Typography>
          <Chip label={item.category} size="small"
            sx={{ height: 16, fontSize: 9, bgcolor: '#eceff1', color: '#546e7a' }} />
        </Stack>
        {showDate && item.date && (
          <Typography variant="caption" color="text.disabled">{item.date}</Typography>
        )}
      </Stack>
      <Typography variant="body2" fontWeight={600} sx={{ mx: 1 }}>¥{fmt(item.amount)}</Typography>
      <IconButton size="small" onClick={() => onEdit(item)} sx={{ p: 0.5 }}>
        <EditIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
      </IconButton>
      <IconButton size="small" onClick={() => onDelete(item.id)} sx={{ p: 0.5 }}>
        <DeleteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
      </IconButton>
    </Stack>
  )
}

// ─── セクションカード ─────────────────────────────────────

function SectionCard({ title, badge, total, children, onAdd }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            {title}
          </Typography>
          {badge && <Chip label={badge} size="small"
            sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>
            ¥{fmt(total)}
          </Typography>
          <IconButton size="small" onClick={onAdd} sx={{ p: 0.25, color: '#fff' }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>
      <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
        {children}
      </CardContent>
    </Card>
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
                    <IconButton size="small" onClick={() => onEdit(item)} sx={{ p: 0.25 }}>
                      <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDelete(item.id)} sx={{ p: 0.25 }}>
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

// ─── 変動費テーブル ───────────────────────────────────────

function VarExpenseTable({ varList, onEdit, onDelete }) {
  if (varList.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>
      この月の変動費を追加してください
    </Typography>
  )

  let running = 0
  const rows = varList.map((item) => {
    running += item.amount
    return { ...item, subtotal: running }
  })

  return (
    <Box sx={{ overflowX: 'auto', mx: -2 }}>
      <Table size="small" sx={{ minWidth: 520 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
            {['日付', 'カテゴリ', '支払先', '項目名', '金額', '小計'].map((h) => (
              <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap',
                ...(h === '金額' || h === '小計' ? { textAlign: 'right' } : {}) }}>
                {h}
              </TableCell>
            ))}
            <TableCell sx={{ width: 56 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((item, i) => (
            <TableRow key={item.id}
              sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: '#f1f8e9' } }}>
              <TableCell sx={{ fontSize: 11, py: 0.75, whiteSpace: 'nowrap', color: 'text.secondary' }}>
                {item.date ?? '—'}
              </TableCell>
              <TableCell sx={{ fontSize: 11, py: 0.75 }}>
                <Chip label={item.category} size="small"
                  sx={{ height: 16, fontSize: 9, bgcolor: CATEGORY_COLORS[item.category] ?? '#eceff1', color: '#37474f' }} />
              </TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>{item.payee || '—'}</TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75 }}>{item.name}</TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75, textAlign: 'right', fontWeight: 500,
                color: item.sign === 1 ? '#1565c0' : 'inherit' }}>
                {item.sign === 1 ? '+' : '−'}¥{fmt(item.amount)}
              </TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75, textAlign: 'right', color: 'text.secondary' }}>¥{fmt(item.subtotal)}</TableCell>
              <TableCell sx={{ py: 0.5, px: 0.5 }}>
                <Stack direction="row">
                  <IconButton size="small" onClick={() => onEdit(item)} sx={{ p: 0.25 }}>
                    <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => onDelete(item.id)} sx={{ p: 0.25 }}>
                    <DeleteIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

// ─── カテゴリ別グラフ（SVGドーナツ）────────────────────────

const CHART_COLORS = [
  '#e53935', // 赤
  '#f4511e', // 深オレンジ
  '#fb8c00', // オレンジ
  '#fdd835', // 黄
  '#43a047', // 緑
  '#00897b', // ティール
  '#1e88e5', // 青
  '#8e24aa', // 紫
  '#d81b60', // ピンク
  '#6d4c41', // ブラウン
  '#757575', // グレー
]

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2
  const R = size * 0.38, r = size * 0.22
  let angle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const theta = (d.value / total) * 2 * Math.PI
    const x1 = cx + R * Math.cos(angle)
    const y1 = cy + R * Math.sin(angle)
    angle += theta
    const x2 = cx + R * Math.cos(angle)
    const y2 = cy + R * Math.sin(angle)
    const large = theta > Math.PI ? 1 : 0
    const xi1 = cx + r * Math.cos(angle - theta)
    const yi1 = cy + r * Math.sin(angle - theta)
    const xi2 = cx + r * Math.cos(angle)
    const yi2 = cy + r * Math.sin(angle)
    return {
      d: `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi2} ${yi2} A${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: d.label,
      value: d.value,
    }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={1.5} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill="#78909c">合計</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#37474f">
        ¥{fmt(total)}
      </text>
    </svg>
  )
}

function CategoryChart({ fixedList, varList }) {
  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const total = Object.values(map).reduce((s, v) => s + v, 0)
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])

  const data = entries.map(([label, value]) => ({ label, value }))

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          カテゴリ別グラフ
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <DonutChart data={data} size={140} />
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            {entries.map(([cat, val], i) => (
              <Stack key={cat} spacing={0.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontSize: 10 }} noWrap>{cat}</Typography>
                  </Stack>
                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: 10 }}>¥{fmt(val)}</Typography>
                </Stack>
                <Box sx={{ height: 4, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${(val / total) * 100}%`, bgcolor: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 2 }} />
                </Box>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

// ─── カテゴリ別集計 ───────────────────────────────────────

function CategoryBreakdown({ fixedList, varList }) {
  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          カテゴリ別集計
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
        {entries.map(([cat, total], i) => (
          <Box key={cat}>
            {i > 0 && <Divider />}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
              <Chip label={cat} size="small"
                sx={{ height: 16, fontSize: 10, bgcolor: '#eceff1', color: '#546e7a' }} />
              <Typography variant="body2" fontWeight={600}>¥{fmt(total)}</Typography>
            </Stack>
          </Box>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── 2枚合計＋給与比較 ──────────────────────────────────

// ─── 生活費カード ────────────────────────────────────────────

function LivingExpenseCard({ ym }) {
  const [weeklyBudget, setWeeklyBudget] = useState(loadWeeklyBudget)
  const [editOpen, setEditOpen] = useState(false)
  const [editVal, setEditVal] = useState('')

  const { mondayStr, sundayStr, label } = getThisWeekRange()

  // 週またぎ対応: 月曜と日曜が別月なら両月ロード
  const mondayYm = mondayStr.slice(0, 7)
  const sundayYm = sundayStr.slice(0, 7)
  const weekMonths = [...new Set([mondayYm, sundayYm])]
  const weekList = weekMonths.flatMap(m => [
    ...loadVar('jcb', m),
    ...loadVar('smbc', m),
  ])
  const weekUsed = sumLiving(weekList, mondayStr, sundayStr)
  const weekRemain = weeklyBudget - weekUsed
  const weekPct = weeklyBudget > 0 ? Math.min(weekUsed / weeklyBudget * 100, 100) : 0

  // 今月（選択月）
  const monthList = [...loadVar('jcb', ym), ...loadVar('smbc', ym)]
  const monthUsed = sumLiving(monthList)
  const today = new Date()
  const fridays = countFridaysUntil(today, nextPayDay(today))
  const monthlyBudget = fridays * weeklyBudget
  const monthRemain = monthlyBudget - monthUsed
  const monthPct = monthlyBudget > 0 ? Math.min(monthUsed / monthlyBudget * 100, 100) : 0

  const barColor = (pct) => pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffe082' : 'rgba(255,255,255,.6)'

  const handleSave = () => {
    const v = parseInt(editVal.replace(/,/g, ''), 10)
    if (!isNaN(v) && v > 0) { setWeeklyBudget(v); saveWeeklyBudget(v) }
    setEditOpen(false)
  }

  return (
    <Card sx={{ mb: 2, bgcolor: '#1b5e20', color: '#fff' }}>
      <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>生活費</Typography>

        {/* 今週 */}
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="caption" sx={{ opacity: .8, fontSize: 11, fontWeight: 600 }}>今週</Typography>
            <Typography variant="caption" sx={{ opacity: .45, fontSize: 10 }}>{label}</Typography>
          </Stack>
          <Box sx={{ mt: 0.75, height: 5, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${weekPct}%`, bgcolor: barColor(weekPct), borderRadius: 3, transition: 'width .4s' }} />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: .65, fontSize: 10 }}>¥{fmt(weekUsed)} 使用 ／ ¥{fmt(weeklyBudget)}</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: weekRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
              {weekRemain >= 0 ? `残り ¥${fmt(weekRemain)}` : `¥${fmt(-weekRemain)} オーバー`}
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.25 }} />

        {/* 今月 */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="caption" sx={{ opacity: .8, fontSize: 11, fontWeight: 600 }}>今月（{ym}）</Typography>
            <Typography variant="caption" sx={{ opacity: .45, fontSize: 10 }}>¥{fmt(weeklyBudget)} × {fridays}週</Typography>
          </Stack>
          <Box sx={{ mt: 0.75, height: 5, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${monthPct}%`, bgcolor: barColor(monthPct), borderRadius: 3, transition: 'width .4s' }} />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: .65, fontSize: 10 }}>¥{fmt(monthUsed)} 使用 ／ ¥{fmt(monthlyBudget)}</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: monthRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
              {monthRemain >= 0 ? `残り ¥${fmt(monthRemain)}` : `¥${fmt(-monthRemain)} オーバー`}
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.25 }} />

        {/* 週予算編集 */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>週予算 ¥{fmt(weeklyBudget)}</Typography>
          <Button size="small" onClick={() => { setEditVal(String(weeklyBudget)); setEditOpen(true) }}
            sx={{ color: 'rgba(255,255,255,.6)', fontSize: 10, minWidth: 0, px: 1, py: 0.25, textTransform: 'none' }}>
            編集
          </Button>
        </Stack>
      </CardContent>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>週予算を編集</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <AmountField value={editVal} onChange={setEditVal} label="週予算（円）" autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} size="small">キャンセル</Button>
          <Button onClick={handleSave} variant="contained" size="small">保存</Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

// ─── 2枚合計 ─────────────────────────────────────────────────

function CombinedSummary({ ym, jcbLimit = 0, smbcLimit = 0 }) {
  const jcb  = getCCTotal('jcb',  ym)
  const smbc = getCCTotal('smbc', ym)
  const combined = jcb.total + smbc.total
  const combinedLimit = jcbLimit + smbcLimit
  const fixedOnlyTotal = jcb.fixed + smbc.fixed

  const [salaryInput, setSalaryInput] = useState(loadSalaryOverride)
  const [fixedItems, setFixedItems]   = useState(loadSummaryFixed)
  const [livingUnit, setLivingUnit]   = useState(loadLivingUnit)

  // ダイアログ: { mode:'add'|'edit'|'living', id? }
  const [dlg, setDlg]         = useState(null)
  const [dlgLabel, setDlgLabel] = useState('')
  const [dlgAmount, setDlgAmount] = useState('')

  const salary = parseFloat(salaryInput) || 0
  const hasSalary = salary > 0

  const today = new Date()
  const payDay = nextPayDay(today)
  const fridays = countFridaysUntil(today, payDay)
  const livingCost = fridays * livingUnit
  const fixedTotal = fixedItems.reduce((s, i) => s + i.amount, 0) + livingCost
  const diff = salary - fixedTotal - combined
  const simBalance = salary - fixedTotal - combinedLimit

  function openAdd() { setDlgLabel(''); setDlgAmount(''); setDlg({ mode: 'add' }) }
  function openEdit(item) { setDlgLabel(item.label); setDlgAmount(String(item.amount)); setDlg({ mode: 'edit', id: item.id }) }
  function openLiving() { setDlgAmount(String(livingUnit)); setDlg({ mode: 'living' }) }

  function handleDelete(id) {
    const next = fixedItems.filter(x => x.id !== id)
    setFixedItems(next); saveSummaryFixed(next)
  }

  function handleSave() {
    const amt = parseInt(dlgAmount, 10)
    if (!dlgLabel.trim() && dlg.mode !== 'living') return
    if (isNaN(amt) || amt <= 0) return
    if (dlg.mode === 'living') {
      setLivingUnit(amt); saveLivingUnit(amt)
    } else if (dlg.mode === 'add') {
      const next = [...fixedItems, { id: newId(), label: dlgLabel.trim(), amount: amt }]
      setFixedItems(next); saveSummaryFixed(next)
    } else {
      const next = fixedItems.map(x => x.id === dlg.id ? { ...x, label: dlgLabel.trim(), amount: amt } : x)
      setFixedItems(next); saveSummaryFixed(next)
    }
    setDlg(null)
  }

  const iconSx = { p: 0.3, color: 'rgba(255,255,255,.4)', '&:hover': { color: 'rgba(255,255,255,.8)' } }

  return (
    <Card sx={{ mb: 2, bgcolor: '#263238', color: '#fff' }}>
      <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>2枚合計（{ym}）</Typography>

        {/* カード別 */}
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>JCB</Typography>
            <Typography variant="subtitle1" fontWeight={700}>¥{fmt(jcb.total)}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>VISA</Typography>
            <Typography variant="subtitle1" fontWeight={700}>¥{fmt(smbc.total)}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>合計</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: -.5 }}>¥{fmt(combined)}</Typography>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.5 }} />

        {/* 給与入力 */}
        <Stack direction="row" alignItems="flex-start" gap={1.5}>
          <Typography variant="caption" sx={{ opacity: .7, minWidth: 36, pt: 0.5 }}>給与</Typography>
          <Box sx={{ flex: 1 }}>
            <AmountField
              dark
              value={salaryInput}
              onChange={(raw) => { setSalaryInput(raw); saveSalaryOverride(raw) }}
              placeholder="手取り額"
              inputSx={{ '& .MuiInputBase-root': { height: 32 } }}
            />
          </Box>
          {hasSalary && (
            <Stack sx={{ pt: 0.5, alignItems: 'flex-end' }}>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>差引残り</Typography>
              <Typography variant="subtitle1" fontWeight={700}
                sx={{ color: diff >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {diff >= 0 ? '' : '−'}¥{fmt(Math.abs(diff))}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* 給与 - 固定費 - 変動費(上限) = 残高 */}
        {hasSalary && combinedLimit > 0 && (
          <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ opacity: .5, fontSize: 9, display: 'block', mb: 0.5 }}>
              給与 - 固定費 - 変動費 = 残高
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
              <Typography variant="caption" sx={{ opacity: .75, fontSize: 10 }}>¥{fmt(salary)}</Typography>
              <Typography variant="caption" sx={{ opacity: .4, fontSize: 10 }}>−</Typography>
              <Typography variant="caption" sx={{ opacity: .75, fontSize: 10 }}>¥{fmt(fixedTotal)}</Typography>
              <Typography variant="caption" sx={{ opacity: .4, fontSize: 10 }}>−</Typography>
              <Typography variant="caption" sx={{ opacity: .75, fontSize: 10 }}>¥{fmt(combinedLimit)}</Typography>
              <Typography variant="caption" sx={{ opacity: .4, fontSize: 10 }}>=</Typography>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 13, color: simBalance >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {simBalance < 0 ? '−' : ''}¥{fmt(Math.abs(simBalance))}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* 固定費内訳 */}
        {hasSalary && (
          <Box sx={{ mt: 1.5, pl: 0.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: .45, letterSpacing: .5 }}>固定費内訳</Typography>
              <IconButton size="small" sx={{ ...iconSx, p: 0.2 }} onClick={openAdd}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
            <Stack spacing={0.25}>
              {fixedItems.map(item => (
                <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ opacity: .6, flex: 1 }}>{item.label}</Typography>
                  <Stack direction="row" alignItems="center" gap={0.25}>
                    <Typography variant="caption" sx={{ opacity: .6 }}>¥{fmt(item.amount)}</Typography>
                    <IconButton size="small" sx={iconSx} onClick={() => openEdit(item)}>
                      <EditIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                    <IconButton size="small" sx={iconSx} onClick={() => handleDelete(item.id)}>
                      <DeleteIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ opacity: .6, flex: 1 }}>
                  生活費（{fridays}週 × {fmt(livingUnit)}）
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.25}>
                  <Typography variant="caption" sx={{ opacity: .6 }}>¥{fmt(livingCost)}</Typography>
                  <IconButton size="small" sx={iconSx} onClick={openLiving}>
                    <EditIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Stack>
              </Stack>
              <Divider sx={{ borderColor: 'rgba(255,255,255,.1)', my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ opacity: .8 }}>固定費合計</Typography>
                <Typography variant="caption" sx={{ opacity: .8 }}>¥{fmt(fixedTotal)}</Typography>
              </Stack>
            </Stack>
          </Box>
        )}
      </CardContent>

      {/* 編集ダイアログ */}
      <Dialog open={dlg !== null} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>
          {dlg?.mode === 'add' ? '固定費を追加' : dlg?.mode === 'living' ? '生活費（週あたり）を編集' : '固定費を編集'}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack gap={2}>
            {dlg?.mode !== 'living' && (
              <TextField label="項目名" value={dlgLabel} onChange={e => setDlgLabel(e.target.value)}
                size="small" fullWidth autoFocus />
            )}
            <AmountField
              value={dlgAmount}
              onChange={setDlgAmount}
              label="金額"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)} size="small">キャンセル</Button>
          <Button onClick={handleSave} variant="contained" size="small"
            disabled={(!dlgLabel.trim() && dlg?.mode !== 'living') || parseInt(dlgAmount, 10) <= 0}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

// ─── メインコンポーネント ────────────────────────────────

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
  const [quickOpen,    setQuickOpen]    = useState(false)

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
  const handleQuickSave = ({ cardId: targetCard, item, transfer, fromCard, toCard }) => {
    try {
      if (transfer) {
        // 振替：fromCard に支出、toCard に収入を記録（振替は表示月に保存）
        const outItem = { id: newId(), ...item }
        const inItem  = { id: newId(), ...item, sign: 1, name: item.name + '（受取）' }
        const outList = loadVar(fromCard, ym)
        const inList  = loadVar(toCard,   ym)
        const nextOut = [...outList, outItem].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
        const nextIn  = [...inList,  inItem ].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
        saveVar(fromCard, ym, nextOut)
        saveVar(toCard,   ym, nextIn)
        if (fromCard === cardId) setVarList(nextOut)
        else if (toCard === cardId) setVarList(nextIn)
        notify('success', '振替を記録しました')
      } else {
        // 日付から正しい請求月を計算
        const targetYm = getBillingYm(item.date, targetCard)
        const newItem = { id: newId(), ...item }
        const existing = loadVar(targetCard, targetYm)
        const nextList = [...existing, newItem].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1)
        saveVar(targetCard, targetYm, nextList)
        // 表示中の月と一致する場合のみ画面を更新
        if (targetCard === cardId && targetYm === ym) setVarList(nextList)
        const ymLabel = `${targetYm.replace('-', '年')}月`
        notify('success', `${item.sign === 1 ? '収入' : '支出'}を${ymLabel}分として記録しました`)
      }
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
        <IconButton size="small" onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {year}年{month}月
        </Typography>
        <IconButton size="small" onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* 2枚合計サマリー */}
      <CombinedSummary ym={ym} jcbLimit={parseFloat(limitInputs.jcb) || 0} smbcLimit={parseFloat(limitInputs.smbc) || 0} />
      <LivingExpenseCard ym={ym} />

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
        <IconButton size="small" onClick={() => setCatDlgOpen(true)}>
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
        return (
          <Card sx={{ mb: 2, bgcolor: card.color, color: '#fff' }}>
            <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ opacity: .65, letterSpacing: .5 }}>{card.name}</Typography>
              <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -.5,
                  color: over ? '#ef9a9a' : '#fff' }}>
                  ¥{fmt(grandTotal)}
                </Typography>
                {limit > 0 && (
                  <Typography variant="caption" sx={{ opacity: .7, mb: 0.5 }}>
                    上限 ¥{fmt(limit)}
                  </Typography>
                )}
              </Stack>

              {/* プログレスバー */}
              {limit > 0 && (
                <Box sx={{ mt: 1, mb: 0.75 }}>
                  <Box sx={{ height: 6, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: barColor, borderRadius: 3,
                      transition: 'width .4s ease' }} />
                  </Box>
                  <Stack sx={{ mt: 0.5, gap: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>{pct.toFixed(0)}% 使用</Typography>
                    {(() => {
                      const af = limit - fixedTotal
                      return (
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                          <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>固定費後</Typography>
                          <Stack alignItems="flex-end">
                            <Typography variant="caption" sx={{ fontSize: 10, color: af >= 0 ? 'rgba(255,255,255,.6)' : '#ef9a9a' }}>
                              {af >= 0 ? `残り ¥${fmt(af)}` : `¥${fmt(-af)} オーバー`}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: .4, fontSize: 9 }}>
                              ¥{fmt(limit)} − ¥{fmt(fixedTotal)}
                            </Typography>
                          </Stack>
                        </Stack>
                      )
                    })()}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                      <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>固定＋変動後</Typography>
                      <Stack alignItems="flex-end">
                        <Typography variant="caption" sx={{ fontSize: 10, color: over ? '#ef9a9a' : 'rgba(255,255,255,.6)' }}>
                          {over ? `¥${fmt(grandTotal - limit)} オーバー` : `残り ¥${fmt(limit - grandTotal)}`}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: .4, fontSize: 9 }}>
                          ¥{fmt(limit)} − ¥{fmt(fixedTotal)} − ¥{fmt(varTotal)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>
              )}

              <Stack direction="row" spacing={2} sx={{ mt: limit > 0 ? 0 : 1 }}>
                <Typography variant="caption" sx={{ opacity: .75 }}>固定 ¥{fmt(fixedTotal)}</Typography>
                <Typography variant="caption" sx={{ opacity: .75 }}>変動 ¥{fmt(varTotal)}</Typography>
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
                <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>月の利用上限</Typography>
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
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'fixed' }) }} sx={{ p: 0.25, color: '#fff' }}>
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
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>¥{fmt(varTotal)}</Typography>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'var' }) }} sx={{ p: 0.25, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
        <Collapse in={varOpen}>
          <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
            <VarExpenseTable
              varList={varList}
              onEdit={(it) => setDlg({ type: 'var', initial: it })}
              onDelete={deleteVar}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* カテゴリ別グラフ */}
      <CategoryChart fixedList={filteredFixed} varList={varList} />

      {/* カテゴリ別集計 */}
      <CategoryBreakdown fixedList={filteredFixed} varList={varList} />

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

      {/* FAB: クイック入力（収入/支出/振替） */}
      <Fab
        color="primary"
        onClick={() => setQuickOpen(true)}
        sx={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, zIndex: 200 }}
      >
        <AddIcon />
      </Fab>

      {/* クイック入力ドロワー */}
      <QuickAddDrawer
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSave={handleQuickSave}
        categories={categories}
        defaultDate={ym === todayStr.slice(0, 7) ? todayStr : `${ym}-01`}
        onEditCategories={() => { setQuickOpen(false); setCatDlgOpen(true) }}
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
