import { useState, useCallback } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, Fab,
  Snackbar, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
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
    id: 'smbc', name: '三井住友VISAナンバーレスゴールド', shortName: 'SMBC',
    cutoffDay: 0, paymentDay: 26, color: '#1b5e20',
  },
}

function cutoffLabel(card) { return card.cutoffDay === 0 ? '月末締め' : `${card.cutoffDay}日締め` }
function paymentLabel(card) { return `翌月${card.paymentDay}日払い` }

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

function loadSalaryOverride() {
  const v = parseFloat(localStorage.getItem('cc_salary_override') || '')
  return isNaN(v) ? '' : String(v)
}
function saveSalaryOverride(v) { localStorage.setItem('cc_salary_override', v) }

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
  const handleChange = (e) => {
    onChange(e.target.value.replace(/[^0-9]/g, ''))
  }
  const handleStep = (step) => {
    onChange(String(parseAmount(value) + step))
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
        inputMode="numeric"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={fmtInput(value)}
        onChange={handleChange}
        inputProps={{
          style: large
            ? { fontSize: 32, fontWeight: 700, textAlign: 'center', color: dark ? '#fff' : undefined }
            : { fontSize: 14, color: dark ? '#fff' : undefined, textAlign: 'right' },
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
      <Stack direction="row" gap={0.75} sx={{ mt: 0.75 }}>
        {AMOUNT_STEPS.map(({ label: lbl, step }) => (
          <Button key={lbl} size="small" variant="outlined" onClick={() => handleStep(step)}
            sx={{
              flex: 1, fontSize: 11, py: 0.25, minWidth: 0,
              ...(dark ? {
                color: 'rgba(255,255,255,.75)',
                borderColor: 'rgba(255,255,255,.3)',
                '&:hover': { borderColor: 'rgba(255,255,255,.6)', bgcolor: 'rgba(255,255,255,.1)' },
              } : {}),
            }}>
            {lbl}
          </Button>
        ))}
      </Stack>
    </Box>
  )
}

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

  const isFixed = title?.includes('固定')

  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0) return
    const d = parseInt(day, 10)
    onSave({
      name: name.trim(), payee: payee.trim(), amount: a, category,
      ...(isFixed ? { day: (!isNaN(d) && d >= 1 && d <= 31) ? d : undefined } : { date }),
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {!isFixed && (
            <TextField label="日付" type="date" size="small" fullWidth
              InputLabelProps={{ shrink: true }}
              value={date} onChange={(e) => setDate(e.target.value)} />
          )}
          {isFixed && (
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
          )}
          <FormControl size="small" fullWidth>
            <InputLabel>カテゴリ</InputLabel>
            <Select value={categories.includes(category) ? category : (categories[0] ?? '')}
              label="カテゴリ" onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="支払先" size="small" fullWidth placeholder="例: Google, 東京ガス"
            value={payee} onChange={(e) => setPayee(e.target.value)} />
          <TextField label="項目名" size="small" fullWidth placeholder="例: YouTube Premium"
            value={name} onChange={(e) => setName(e.target.value)} />
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small">保存</Button>
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

function QuickAddDrawer({ open, onClose, onSave, categories, defaultDate, onEditCategories }) {
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'その他')
  const [name,     setName]     = useState('')
  const [payee,    setPayee]    = useState('')
  const [date,     setDate]     = useState(defaultDate)
  const [confirm,  setConfirm]  = useState(false)  // Enter確認ダイアログ

  const reset = () => {
    setDate(defaultDate)
    setAmount('')
    setName('')
    setPayee('')
    setCategory(categories[0] ?? 'その他')
    setConfirm(false)
  }

  // drawerが開くたびにリセット
  const handleOpen = () => reset()

  const doSave = () => {
    const a = parseAmount(amount)
    if (a <= 0) return
    onSave({ name: name.trim() || category, payee: payee.trim(), amount: a, category, date })
    reset()
    onClose()
  }

  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={handleOpen}
        disableSwipeToOpen
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 4, maxWidth: 600, mx: 'auto' } }}
      >
        {/* ハンドル */}
        <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto', mb: 2 }} />

        {/* 日付 */}
        <TextField
          type="date" size="small" fullWidth
          InputLabelProps={{ shrink: true }}
          label="日付"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* カテゴリ選択 */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">カテゴリ</Typography>
          <IconButton size="small" onClick={onEditCategories} sx={{ p: 0.25 }}>
            <SettingsIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </IconButton>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 2 }}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setCategory(cat)}
              sx={{
                fontWeight: category === cat ? 700 : 400,
                fontSize: 12,
                bgcolor: category === cat
                  ? (CATEGORY_COLORS[cat] ?? '#e0e0e0')
                  : '#f5f5f5',
                border: category === cat ? '2px solid' : '1px solid transparent',
                borderColor: category === cat ? 'primary.main' : 'transparent',
              }}
            />
          ))}
        </Stack>

        {/* 金額（大きく表示） */}
        <AmountField
          large autoFocus
          value={amount}
          onChange={setAmount}
          inputSx={{ mb: 0 }}
        />

        {/* 支払先（任意） */}
        <TextField
          size="small" fullWidth
          label="支払先（省略可）"
          placeholder="例: Google, Amazon"
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          sx={{ mb: 1.5, mt: 1.5 }}
        />

        {/* 項目名（任意） */}
        <TextField
          size="small" fullWidth
          label="項目名（省略可）"
          placeholder={category}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              if (parseAmount(amount) > 0) setConfirm(true)
            }
          }}
          sx={{ mb: 2 }}
        />

        {/* 追加ボタン（クリック時は即登録） */}
        <Button
          variant="contained" fullWidth size="large"
          onClick={doSave}
          disabled={parseAmount(amount) <= 0}
          sx={{ borderRadius: 3, fontWeight: 700, fontSize: 16, py: 1.5 }}
        >
          追加
        </Button>
      </SwipeableDrawer>

      {/* Enter確定確認ダイアログ */}
      <Dialog open={confirm} onClose={() => setConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>登録確認</DialogTitle>
        <DialogContent>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">日付</Typography>
              <Typography variant="body2">{date}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">カテゴリ</Typography>
              <Typography variant="body2">{category}</Typography>
            </Stack>
            {payee && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">支払先</Typography>
                <Typography variant="body2">{payee}</Typography>
              </Stack>
            )}
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">項目名</Typography>
              <Typography variant="body2">{name || category}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">金額</Typography>
              <Typography variant="body2" fontWeight={700}>¥{fmt(parseAmount(amount))}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)} color="inherit" size="small">戻る</Button>
          <Button onClick={doSave} variant="contained" size="small">登録する</Button>
        </DialogActions>
      </Dialog>
    </>
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
      <CardContent sx={{ px: 2, py: 0.5, '&:last-child': { pb: 1 } }}>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── 固定費テーブル ───────────────────────────────────────

function FixedExpenseTable({ fixedList, onEdit, onDelete }) {
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
          {rows.map((item, i) => (
            <TableRow key={item.id}
              sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: '#f1f8e9' } }}>
              <TableCell sx={{ fontSize: 11, py: 0.75 }}>
                <Chip label={item.category} size="small"
                  sx={{ height: 16, fontSize: 9, bgcolor: CATEGORY_COLORS[item.category] ?? '#eceff1', color: '#37474f' }} />
              </TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>{item.payee ?? '—'}</TableCell>
              <TableCell sx={{ fontSize: 12, py: 0.75 }}>
                {item.name}
                {item.day != null && (
                  <Typography component="div" variant="caption" color="text.disabled" sx={{ fontSize: 10, lineHeight: 1.2 }}>
                    毎月{item.day}日
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
          ))}
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
      <CardContent sx={{ px: 2, py: 0.5, '&:last-child': { pb: 1 } }}>
        {entries.map(([cat, total], i) => (
          <Box key={cat}>
            {i > 0 && <Divider />}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
              <Chip label={cat} size="small"
                sx={{ height: 18, fontSize: 10, bgcolor: '#eceff1', color: '#546e7a' }} />
              <Typography variant="body2" fontWeight={600}>¥{fmt(total)}</Typography>
            </Stack>
          </Box>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── 2枚合計＋給与比較 ──────────────────────────────────

function CombinedSummary({ ym }) {
  const jcb  = getCCTotal('jcb',  ym)
  const smbc = getCCTotal('smbc', ym)
  const combined = jcb.total + smbc.total

  // 給与タブから自動取得（最小値・万円切捨）、手動上書き可能
  const autoSalary = getSalaryTakeHome()
  const savedOverride = loadSalaryOverride()
  const [salaryInput, setSalaryInput] = useState(savedOverride !== '' ? savedOverride : String(autoSalary || ''))

  const salary   = parseFloat(salaryInput) || 0
  const diff     = salary - combined
  const hasSalary = salary > 0

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
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>SMBC</Typography>
            <Typography variant="subtitle1" fontWeight={700}>¥{fmt(smbc.total)}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>合計</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: -.5 }}>¥{fmt(combined)}</Typography>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.15)', my: 1.5 }} />

        {/* 給与入力 */}
        <Stack direction="row" alignItems="flex-start" gap={1.5}>
          <Stack sx={{ pt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: .7, minWidth: 36 }}>給与</Typography>
            {autoSalary > 0 && (
              <Typography variant="caption" sx={{ opacity: .45, fontSize: 9 }}>
                自動: ¥{fmt(autoSalary)}
              </Typography>
            )}
          </Stack>
          <Box sx={{ flex: 1 }}>
            <AmountField
              dark
              value={salaryInput}
              onChange={(raw) => { setSalaryInput(raw); saveSalaryOverride(raw) }}
              placeholder={autoSalary > 0 ? fmtInput(String(autoSalary)) : '手取り額'}
              inputSx={{ '& .MuiInputBase-root': { height: 32 } }}
            />
          </Box>
          {hasSalary && (
            <Stack sx={{ pt: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>差引残り</Typography>
              <Typography variant="subtitle1" fontWeight={700}
                sx={{ color: diff >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {diff >= 0 ? '' : '−'}¥{fmt(Math.abs(diff))}
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
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
  const [categories,   setCategories]   = useState(loadCategories)
  const [dlg,          setDlg]          = useState(null)
  const [catDlgOpen,   setCatDlgOpen]   = useState(false)
  const [limitInput,   setLimitInput]   = useState(() => loadLimit(cardId))
  const [snack,        setSnack]        = useState({ open: false, severity: 'success', message: '' })

  const notify = (severity, message) => setSnack({ open: true, severity, message })

  const todayStr = new Date().toISOString().slice(0, 10)

  const switchCard = (id) => {
    setCardId(id)
    setFixedList(loadFixed(id))
    setVarList(loadVar(id, ym))
    setLimitInput(loadLimit(id))
  }

  const changeMonth = (delta) => {
    let y = year, m = month + delta
    if (m > 12) { y++; m = 1 }
    if (m < 1)  { y--; m = 12 }
    setYear(y); setMonth(m)
    setVarList(loadVar(cardId, ymStr(y, m)))
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
    try { const next = fixedList.filter((x) => x.id !== id); setFixedList(next); saveFixed(cardId, next); notify('success', '固定費を削除しました') }
    catch { notify('error', '固定費の削除に失敗しました') }
  }, [fixedList, cardId])

  // 変動費 CRUD
  const addVar = (data) => {
    try { const next = [...varList, { id: newId(), ...data }].sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を保存しました') }
    catch { notify('error', '変動費の保存に失敗しました') }
  }
  const editVar = (data) => {
    try { const next = varList.map((x) => x.id === dlg.initial.id ? { ...x, ...data } : x).sort((a, b) => (a.date ?? '') < (b.date ?? '') ? -1 : 1); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を更新しました') }
    catch { notify('error', '変動費の更新に失敗しました') }
  }
  const deleteVar = useCallback((id) => {
    try { const next = varList.filter((x) => x.id !== id); setVarList(next); saveVar(cardId, ym, next); notify('success', '変動費を削除しました') }
    catch { notify('error', '変動費の削除に失敗しました') }
  }, [varList, cardId, ym])

  const handleCategoryChange = (next) => {
    try { setCategories(next); saveCategories(next); notify('success', 'カテゴリを保存しました') }
    catch { notify('error', 'カテゴリの保存に失敗しました') }
  }

  const fixedTotal = fixedList.reduce((s, x) => s + x.amount, 0)
  const varTotal   = varList.reduce((s, x)   => s + x.amount, 0)
  const grandTotal = fixedTotal + varTotal

  return (
    <Box sx={{ px: 2, py: 2 }}>

      {/* 2枚合計サマリー */}
      <CombinedSummary ym={ym} />

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
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>
                      {pct.toFixed(0)}% 使用
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 10,
                      color: over ? '#ef9a9a' : 'rgba(255,255,255,.6)' }}>
                      {over ? `¥${fmt(grandTotal - limit)} オーバー` : `残り ¥${fmt(limit - grandTotal)}`}
                    </Typography>
                  </Stack>
                </Box>
              )}

              <Stack direction="row" spacing={2} sx={{ mt: limit > 0 ? 0 : 1 }}>
                <Typography variant="caption" sx={{ opacity: .75 }}>固定 ¥{fmt(fixedTotal)}</Typography>
                <Typography variant="caption" sx={{ opacity: .75 }}>変動 ¥{fmt(varTotal)}</Typography>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: .55 }}>{cutoffLabel(card)}</Typography>
                <Typography variant="caption" sx={{ opacity: .55 }}>{paymentLabel(card)}</Typography>
              </Stack>
              {/* 上限入力 */}
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>月の利用上限</Typography>
                <AmountField
                  dark
                  value={limitInput}
                  onChange={(raw) => { setLimitInput(raw); saveLimit(cardId, raw) }}
                  placeholder="設定なし"
                  inputSx={{ mt: 0.5, '& .MuiInputBase-root': { height: 30 } }}
                />
              </Box>
            </CardContent>
          </Card>
        )
      })()}

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {year}年{month}月
        </Typography>
        <IconButton size="small" onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* 固定費テーブル */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>固定費</Typography>
            <Chip label="毎月" size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>¥{fmt(fixedTotal)}</Typography>
            <IconButton size="small" onClick={() => setDlg({ type: 'fixed' })} sx={{ p: 0.25, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
        <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
          <FixedExpenseTable
            fixedList={fixedList}
            onEdit={(it) => setDlg({ type: 'fixed', initial: it })}
            onDelete={deleteFixed}
          />
        </CardContent>
      </Card>

      {/* 変動費 */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>変動費</Typography>
            <Chip label={`${year}年${month}月`} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>¥{fmt(varTotal)}</Typography>
            <IconButton size="small" onClick={() => setDlg({ type: 'var' })} sx={{ p: 0.25, color: '#fff' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
        <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
          <VarExpenseTable
            varList={varList}
            onEdit={(it) => setDlg({ type: 'var', initial: it })}
            onDelete={deleteVar}
          />
        </CardContent>
      </Card>

      {/* カテゴリ別グラフ */}
      <CategoryChart fixedList={fixedList} varList={varList} />

      {/* カテゴリ別集計 */}
      <CategoryBreakdown fixedList={fixedList} varList={varList} />

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

      {/* FAB: 変動費追加 */}
      <Fab
        color="primary"
        onClick={() => setDlg({ type: 'var' })}
        sx={{ position: 'fixed', bottom: 72, right: 16, zIndex: 200 }}
      >
        <AddIcon />
      </Fab>

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
