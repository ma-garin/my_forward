import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  Fab, Snackbar, Alert, Collapse, InputBase,
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
import { loadCategories, saveCategories, fmt, ymStr, newId, isActiveForYm } from '../utils/finance'
import {
  CARDS, CATEGORY_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS,
  prevBusinessDay, nextBusinessDay, sumLiving, getBillingYmForDate,
  loadFixed, saveFixed, loadVar, saveVar,
  CARD_LIST, billingYmForCard, upsertFixedItem, upsertVarItem,
  loadLimit, saveLimit, loadBilled, saveBilled,
} from '../utils/ccStorage'
import AmountField, { CalcPad, parseAmount } from '../components/AmountField'
import ExpenseDialog from '../components/ExpenseDialog'
import { VarExpenseTable, DailyBarChart, ExpenseRow, ExpenseGroupHeader } from '../components/CCExpenseViews'
import { CategoryChart, CategoryBreakdown, SpendTypeChart } from '../components/CategoryViews'
import LivingExpenseCard from '../components/LivingExpenseCard'
import CombinedSummary from '../components/CombinedSummary'
import BudgetBreakdown from '../components/BudgetBreakdown'
import { useAfterPaint } from '../utils/useAfterPaint'
import { useThemeMode } from '../ThemeModeContext'
import Section from '../components/apple/Section'
import Row from '../components/apple/Row'
import Segmented from '../components/apple/Segmented'
import Meter from '../components/apple/Meter'
import HeroValue from '../components/apple/HeroValue'
import { ios } from '../components/apple/tokens'

function cutoffLabel(card) {
  return card.cutoffDay === 0 ? '月末締め' : `${card.cutoffDay}日締め`
}

function paymentLabel(card) {
  return `翌月${card.paymentDay}日払い`
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function nextCutoffDate(card, from = new Date()) {
  const today = startOfDay(from)
  const year = today.getFullYear()
  const month = today.getMonth()
  let candidate = card.cutoffDay === 0
    ? new Date(year, month + 1, 0)
    : new Date(year, month, card.cutoffDay)
  if (candidate < today) {
    candidate = card.cutoffDay === 0
      ? new Date(year, month + 2, 0)
      : new Date(year, month + 1, card.cutoffDay)
  }
  return candidate
}

function payDateForCutoff(card, cutoffDate) {
  return nextBusinessDay(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, card.paymentDay))
}

function nextCardCycleDates(card, from = new Date()) {
  const cutoffDate = nextCutoffDate(card, from)
  return { cutoffDate, payDate: payDateForCutoff(card, cutoffDate) }
}

// ym（請求月）自体から締め日を求める。ym の締め日は「ym の月+1」に落ちる
// （例: cutoffDay=15 なら ym=2026-08 の締めは 9/15）。ym の月をそのまま使うと
// 1 ヶ月早い日付になる（実際に混入したバグ）
function cutoffDateForYm(card, ym) {
  const [y, m] = ym.split('-').map(Number)
  return card.cutoffDay === 0 ? new Date(y, m, 0) : new Date(y, m, card.cutoffDay)
}

function cycleDatesForYm(card, ym) {
  const cutoffDate = cutoffDateForYm(card, ym)
  return { cutoffDate, payDate: payDateForCutoff(card, cutoffDate) }
}

function daysUntil(date, from = new Date()) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(date) - startOfDay(from)) / MS_PER_DAY)
}

function countdownLabel(date, from = new Date()) {
  const days = daysUntil(date, from)
  const label = days === 0 ? '今日' : `あと${days}日`
  return `${label}（${fmtCycleDate(date)}）`
}

function fmtCycleDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function loadHistory(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function addToHistory(key, value) {
  const text = value.trim()
  if (!text) return
  try {
    const next = [text, ...loadHistory(key).filter((x) => x !== text)].slice(0, 20)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // 履歴候補は補助機能なので、保存失敗時も入力処理は続行する
  }
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

// AddExpenseScreen で使う静的定数（レンダーごとに作り直さない）
const HIDDEN_DATE_STYLE = { position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: '-100px' }

// ─── 固定費テーブル ───────────────────────────────────────

// 固定費の繰り返し設定を補足行のテキストにまとめる
function recurrenceNotes(item) {
  const notes = []
  const rec = item.recurrence ?? 'monthly'
  if (rec === 'monthly' && item.startYm) notes.push(`${item.startYm.replace('-', '/')}〜`)
  if (rec === 'interval') notes.push(`${item.intervalMonths}ヶ月ごと${item.baseYm ? `（基準 ${item.baseYm.replace('-', '/')}）` : ''}`)
  if (rec === 'once' && item.targetYm) notes.push(`${item.targetYm.replace('-', '/')}のみ`)
  return notes
}

// 固定費リスト。変動費と同じ ExpenseRow / ExpenseGroupHeader を使い、
// 変動費が「日付」でグループ化するのに合わせて「支払日」でグループ化する。
function FixedExpenseTable({ fixedList, onEdit, onDelete, billedIds = [], onToggleBilled }) {
  // 並べ替え・累計・グループ化・補足行は fixedList が変わったときだけ計算する
  // （親の再レンダーごとにやり直さない）。行の props 参照も安定するので
  // ExpenseRow の memo が効く。
  const grouped = useMemo(() => {
    const sorted = [...fixedList].sort((a, b) => (a.day ?? 99) - (b.day ?? 99))
    const out = []
    let running = 0
    sorted.forEach(item => {
      running += item.amount
      // 固定費は消費分類を持たない。既存データに残っていても行には出さない。
      const { spendType: _drop, ...rest } = item
      const row  = { ...rest, subtotal: running, notes: recurrenceNotes(item) }
      const key  = item.day == null ? '—' : String(item.day)
      const last = out[out.length - 1]
      if (last && last.key === key) { last.items.push(row); last.total += item.amount }
      else out.push({ key, items: [row], total: item.amount })
    })
    return out
  }, [fixedList])

  if (fixedList.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>
      固定費を追加してください
    </Typography>
  )

  return (
    <Box>
      {grouped.map(({ key, items, total }) => (
        <Box key={key}>
          <ExpenseGroupHeader label={key === '—' ? '支払日未設定' : `毎月${key}日`} total={total} />
          {items.map(item => (
            <ExpenseRow
              key={item.id}
              item={item}
              subtotal={item.subtotal}
              notes={item.notes}
              billed={billedIds.includes(item.id)}
              onToggleBilled={onToggleBilled}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ─── 年間サマリー ────────────────────────────────────────

function YearlySummary({ year, cardId }) {
  const [open, setOpen] = useState(false)
  const { mode } = useThemeMode()
  const apple = mode === 'apple'
  // 12 ヶ月ぶんの localStorage 読み込みは重い。タブを開いた瞬間の描画を止めない
  // よう、最初の描画のあとに計算する（固定費リストはループの外で 1 回だけロード）。
  const summary = useAfterPaint(() => {
    const fixedAll = loadFixed(cardId)
    const data = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const ym = ymStr(year, m)
      const fixedTotal = fixedAll.filter(x => isActiveForYm(x, ym)).reduce((s, x) => s + x.amount, 0)
      const vl = loadVar(cardId, ym)
      const varTotal = vl.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
      return { m, fixedTotal, varTotal, total: fixedTotal + varTotal }
    })
    const maxTotal = Math.max(...data.map(d => d.total), 1)
    const yearTotal = data.reduce((s, d) => s + d.total, 0)
    return { data, maxTotal, yearTotal }
  }, [year, cardId])
  const { data, maxTotal, yearTotal } = summary ?? { data: [], maxTotal: 1, yearTotal: null }

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box onClick={() => setOpen(v => !v)}
        sx={apple
          ? { bgcolor: ios.cardBg, borderBottom: `0.5px solid ${ios.separator}`, px: 2, py: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }
          : { bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ExpandMoreIcon sx={{ fontSize: 16, color: apple ? ios.tertiary : '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
          <Typography variant="caption" sx={apple ? { color: ios.label, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' } : { color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>年間サマリー {year}年</Typography>
        </Stack>
        <Typography variant="caption" sx={apple ? { color: ios.secondary, fontSize: 13 } : { color: 'rgba(255,255,255,.7)', fontSize: 10 }}>
          {yearTotal == null ? '集計中…' : `合計 ¥${fmt(yearTotal)}`}
        </Typography>
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

function defaultExpenseCategory(categories) {
  return categories.includes('食費') ? '食費' : categories[0] ?? '食費'
}

// レンダーごとに作り直さない静的スタイル・定数
const IROW       = { display: 'flex', alignItems: 'center', px: 2, minHeight: 52, borderBottom: '1px solid #f0f0f0' }
const IROW_TAP   = { ...IROW, cursor: 'pointer' }
const IROW_GAP   = { ...IROW, gap: 1 }
const ILABEL     = { fontSize: 13, color: '#757575', width: 56, flexShrink: 0 }
const IVALUE     = { flex: 1, fontSize: 15 }
const ISUGG_CHIP = { fontSize: 11, height: 22, bgcolor: '#f0f4f8', cursor: 'pointer' }
const ISUGG_BOX  = { px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, bgcolor: '#fff', borderBottom: '1px solid #f0f0f0' }

const fmtD = (d) => { const [y, m, day] = d.split('-'); return `${y}/${m}/${day}` }

function AddExpenseScreen({ open, onClose, onSave, categories, defaultDate, currentCardId, onEditCategories }) {
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState(() => defaultExpenseCategory(categories))
  const [date,     setDate]     = useState(defaultDate)
  const [payee,    setPayee]    = useState('')
  const [name,     setName]     = useState('')
  const [cardId,   setCardId]   = useState(currentCardId)
  const [spendType, setSpendType] = useState('消費')
  const [payeeHistory] = useState(() => loadHistory('cc_payee_history'))
  const [nameHistory]  = useState(() => loadHistory('cc_name_history'))
  const [showPayeeSugg, setShowPayeeSugg] = useState(false)
  const [showNameSugg,  setShowNameSugg]  = useState(false)
  const dateRef = useRef(null)

  const payeeSugg = useMemo(() => payee
    ? payeeHistory.filter(x => x.toLowerCase().includes(payee.toLowerCase()) && x !== payee).slice(0, 5)
    : payeeHistory.slice(0, 5), [payee, payeeHistory])
  const nameSugg = useMemo(() => name
    ? nameHistory.filter(x => x.toLowerCase().includes(name.toLowerCase()) && x !== name).slice(0, 5)
    : nameHistory.slice(0, 5), [name, nameHistory])

  useEffect(() => {
    if (open) {
      setAmount(''); setPayee(''); setName('')
      setCategory(defaultExpenseCategory(categories))
      setSpendType('消費')
      setDate(defaultDate); setCardId(currentCardId)
      window.history.pushState({ addExpenseOpen: true }, '')
      const handlePop = () => onClose()
      window.addEventListener('popstate', handlePop)
      return () => window.removeEventListener('popstate', handlePop)
    }
  }, [open, defaultDate, currentCardId, categories, onClose])

  const doClose = useCallback(() => {
    if (window.history.state?.addExpenseOpen) window.history.back()
    else onClose()
  }, [onClose])

  // 電卓の 1 タップごとに doSave の参照が変わると CalcPad 全体が再レンダーされる。
  // 最新の入力値は ref から読み、ハンドラの参照は固定する。
  // ref の更新はコミット後（キー押下より必ず前）に行う。
  const formRef = useRef({})
  useEffect(() => {
    formRef.current = { amount, payee, name, cardId, category, date, spendType }
  })

  // CalcPad へは値を ref で渡す（prop で渡すと 1 タップごとに memo が外れる）。
  const amountRef = useRef(amount)
  useEffect(() => { amountRef.current = amount })

  const doSave = useCallback(() => {
    const f = formRef.current
    const a = parseAmount(f.amount)
    if (a <= 0) return
    if (f.payee.trim()) addToHistory('cc_payee_history', f.payee.trim())
    if (f.name.trim())  addToHistory('cc_name_history',  f.name.trim())
    onSave({ cardId: f.cardId, item: { name: f.name.trim() || f.category, payee: f.payee.trim(), amount: a, category: f.category, date: f.date, spendType: f.spendType } })
    doClose()
  }, [onSave, doClose])

  // 金額（電卓）以外のフォームは amount に依存しない。
  // メモ化して、キー入力ごとに Select / InputBase / 候補チップまで
  // 再レンダーされるのを防ぐ（体感の入力遅れの主因）。
  // 閉じている間は組み立てない（親の再レンダーごとに 90 行分の JSX を作り直さない）
  const formArea = useMemo(() => !open ? null : (
    <Box sx={{ overflowY: 'auto', bgcolor: '#fff', borderBottom: '1px solid #e0e0e0' }}>

      {/* 日付 */}
      <Box sx={IROW_TAP} onClick={() => dateRef.current?.click()}>
        <Typography sx={ILABEL}>日付</Typography>
        <Typography sx={IVALUE}>{fmtD(date)}</Typography>
        <input ref={dateRef} type="date" value={date} onChange={e => setDate(e.target.value)}
          style={HIDDEN_DATE_STYLE} />
      </Box>

      {/* カード */}
      <Box sx={IROW}>
        <Typography sx={ILABEL}>カード</Typography>
        <Stack direction="row" spacing={1}>
          {CARD_LIST.map(c => (
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
          sx={IVALUE}
        >
          {categories.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
        </Select>
        <IconButton size="small" aria-label="カテゴリ設定" onClick={onEditCategories} sx={{ p: 0.75 }}>
          <SettingsIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        </IconButton>
      </Box>

      {/* 消費分類 */}
      <Box sx={IROW_GAP}>
        <Typography sx={ILABEL}>消費分類</Typography>
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

      {/* 支払先 */}
      <Box sx={IROW}>
        <Typography sx={ILABEL}>支払先</Typography>
        <InputBase fullWidth placeholder="省略可" value={payee}
          onChange={e => setPayee(e.target.value)}
          onFocus={() => setShowPayeeSugg(true)}
          onBlur={() => setTimeout(() => setShowPayeeSugg(false), 150)}
          sx={IVALUE} />
      </Box>
      {showPayeeSugg && payeeSugg.length > 0 && (
        <Box sx={ISUGG_BOX}>
          {payeeSugg.map(s => (
            <Chip key={s} label={s} size="small" onMouseDown={() => setPayee(s)} sx={ISUGG_CHIP} />
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
          sx={IVALUE} />
      </Box>
      {showNameSugg && nameSugg.length > 0 && (
        <Box sx={ISUGG_BOX}>
          {nameSugg.map(s => (
            <Chip key={s} label={s} size="small" onMouseDown={() => setName(s)} sx={ISUGG_CHIP} />
          ))}
        </Box>
      )}
    </Box>
  ), [open, date, cardId, category, categories, spendType, payee, name,
      showPayeeSugg, showNameSugg, payeeSugg, nameSugg, onEditCategories])

  if (!open) return null

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

      {/* フォーム（スクロール可）— amount に依存しないためメモ化済み */}
      {formArea}

      {/* 金額ディスプレイ */}
      <Box sx={{ bgcolor: '#263238', px: 2, py: 1, flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 18, mr: 0.5 }}>¥</Typography>
        <Typography sx={{ color: '#fff', fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 40 }}>
          {parseAmount(amount) > 0 ? fmt(parseAmount(amount)) : '0'}
        </Typography>
      </Box>

      {/* 電卓 */}
      <CalcPad valueRef={amountRef} onChange={setAmount} onConfirm={doSave} disabled={parseAmount(amount) <= 0} />
    </Box>
  )
}

// ─── [以下、分割済み] ─

// ─── メインコンポーネント ─────────────────────────

function defaultBillingMonth() {
  const today = new Date()
  const cutoff = CARDS.jcb?.cutoffDay ?? 0
  if (cutoff > 0 && today.getDate() <= cutoff) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

export default function CreditCard() {
  const { year: defaultYear, month: defaultMonth } = defaultBillingMonth()
  const [cardId,  setCardId]  = useState('jcb')
  const [year,    setYear]    = useState(defaultYear)
  const [month,   setMonth]   = useState(defaultMonth)

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

  const changeMonth = useCallback((delta) => {
    let y = year, m = month + delta
    if (m > 12) { y++; m = 1 }
    if (m < 1)  { y--; m = 12 }
    const newYm = ymStr(y, m)
    setYear(y)
    setMonth(m)
    setVarList(loadVar(cardId, newYm))
    setBilledIds(loadBilled(cardId, newYm))
  }, [year, month, cardId])

  const toggleBilled = useCallback((itemId) => {
    const next = billedIds.includes(itemId)
      ? billedIds.filter(id => id !== itemId)
      : [...billedIds, itemId]
    setBilledIds(next)
    saveBilled(cardId, ym, next)
  }, [billedIds, cardId, ym])

  // 固定費・変動費 CRUD
  // 保存先の移し替え（カード変更・請求月の再計算）は ccStorage の
  // upsertFixedItem / upsertVarItem に集約し、ここでは画面の state 更新と通知だけを持つ。
  const cardName = (id) => CARDS[id]?.shortName ?? id

  const saveFixedItem = (item, target) => {
    const next = upsertFixedItem({ item, fromCard: cardId, toCard: target })
    if (target === cardId) setFixedList(next)
    else setFixedList(prev => prev.filter(x => x.id !== item.id))
  }

  const addFixed = ({ cardId: target = cardId, ...data }) => {
    try {
      saveFixedItem({ id: newId(), ...data }, target)
      notify('success', target === cardId ? '固定費を保存しました' : `固定費を ${cardName(target)} に保存しました`)
    } catch { notify('error', '固定費の保存に失敗しました') }
  }

  const editFixed = ({ cardId: target = cardId, ...data }) => {
    try {
      const current = fixedList.find(x => x.id === dlg.initial.id)
      saveFixedItem({ ...current, ...data }, target)
      notify('success', target === cardId ? '固定費を更新しました' : `固定費を ${cardName(target)} に移動しました`)
    } catch { notify('error', '固定費の更新に失敗しました') }
  }

  const deleteFixed = useCallback((id) => {
    const item = fixedList.find(x => x.id === id)
    setDeleteDlg({ type: 'fixed', id, name: item?.name ?? '固定費' })
  }, [fixedList])

  const confirmDeleteFixed = useCallback((id) => {
    try { const next = fixedList.filter((x) => x.id !== id); setFixedList(next); saveFixed(cardId, next); notify('success', '固定費を削除しました') }
    catch { notify('error', '固定費の削除に失敗しました') }
  }, [fixedList, cardId])

  const saveVarItem = (item, target) => {
    const { ym: toYm, list } = upsertVarItem({ item, fromCard: cardId, fromYm: ym, toCard: target })
    if (target === cardId && toYm === ym) setVarList(list)
    else setVarList(prev => prev.filter(x => x.id !== item.id))
    return toYm
  }

  const addVar = ({ cardId: target = cardId, ...data }) => {
    try {
      const toYm = saveVarItem({ id: newId(), ...data }, target)
      notify('success', target === cardId
        ? '変動費を保存しました'
        : `変動費を ${cardName(target)} の ${toYm.replace('-', '年')}月分に保存しました`)
    } catch { notify('error', '変動費の保存に失敗しました') }
  }

  const editVar = ({ cardId: target = cardId, ...data }) => {
    try {
      const current = varList.find(x => x.id === dlg.initial.id)
      const toYm = saveVarItem({ ...current, ...data }, target)
      notify('success', target === cardId
        ? '変動費を更新しました'
        : `変動費を ${cardName(target)} の ${toYm.replace('-', '年')}月分に移動しました`)
    } catch { notify('error', '変動費の更新に失敗しました') }
  }

  const openFixedEdit = useCallback((it) => setDlg({ type: 'fixed', initial: it }), [])
  const openVarEdit   = useCallback((it) => setDlg({ type: 'var',   initial: it }), [])
  const closeAddExpense   = useCallback(() => setAddOpen(false), [])
  const openCategoryDialog = useCallback(() => setCatDlgOpen(true), [])

  // 支出入力画面からの保存（重複警告つき）
  const handleAddSave = useCallback(({ cardId: targetCard, item }) => {
    try {
      const targetYm = billingYmForCard(item.date, targetCard, ym)
      const dup = loadVar(targetCard, targetYm)
        .find(x => x.date === item.date && x.amount === item.amount && x.category === item.category)
      if (dup) notify('warning', `同日・同金額・同カテゴリの支出が既に登録されています（${item.date} ¥${fmt(item.amount)} ${item.category}）`)
      const { list } = upsertVarItem({ item: { id: newId(), ...item }, fromCard: targetCard, fromYm: targetYm })
      if (targetCard === cardId && targetYm === ym) setVarList(list)
      if (!dup) notify('success', `支出を${targetYm.replace('-', '年')}月分として記録しました`)
    } catch { notify('error', '保存に失敗しました') }
  }, [cardId, ym])

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


  const { mode } = useThemeMode()
  const apple = mode === 'apple'

  // 折りたたみヘッダーのテーマ別スタイル（固定費/変動費で共有）
  const hdrSx = apple
    ? { bgcolor: ios.cardBg, borderBottom: `0.5px solid ${ios.separator}`, px: 2, py: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }
    : { bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }
  const hdrIconColor = apple ? ios.tertiary : '#fff'
  const hdrTitleSx   = apple ? { color: ios.label, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' } : { color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }
  const hdrAmtSx     = apple ? { color: ios.label, fontWeight: 600, fontSize: 15 } : { color: 'rgba(255,255,255,.8)', fontWeight: 600 }
  const hdrChipSx    = apple ? { height: 18, fontSize: 10, bgcolor: 'rgba(118,118,128,0.12)', color: ios.secondary } : { height: 16, fontSize: 9, bgcolor: 'rgba(255,255,255,.2)', color: '#fff' }
  const hdrAddColor  = apple ? ios.accent : '#fff'

  const { filteredFixed, fixedTotal, varTotal, grandTotal } = useMemo(() => {
    const filteredFixed = fixedList.filter((x) => isActiveForYm(x, ym))
    const fixedTotal = filteredFixed.reduce((s, x) => s + x.amount, 0)
    const varTotal   = varList.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
    return { filteredFixed, fixedTotal, varTotal, grandTotal: fixedTotal + varTotal }
  }, [fixedList, varList, ym])

  // カテゴリ別集計の先月比用（同一カードの前月分）
  const prevYm = ymStr(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
  const { prevFilteredFixed, prevVarListForCat } = useMemo(() => ({
    prevFilteredFixed: fixedList.filter((x) => isActiveForYm(x, prevYm)),
    prevVarListForCat: loadVar(cardId, prevYm),
  }), [fixedList, cardId, prevYm])

  // カテゴリ別集計の編集後にストレージから再読み込み
  const refreshLists = () => {
    setFixedList(loadFixed(cardId))
    setVarList(loadVar(cardId, ym))
  }

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
        {apple ? (
          <Box sx={{ minWidth: 168 }}>
            <Segmented
              options={CARD_LIST.map((c) => ({ value: c.id, label: c.shortName }))}
              value={cardId}
              onChange={switchCard}
            />
          </Box>
        ) : (
          <Stack direction="row" spacing={1}>
            {CARD_LIST.map((c) => (
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
        )}
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

        // 締め日/支払日のカウントダウン表示（共通ロジック）
        const cycleNode = (secondaryColor) => {
          const today = new Date()
          const todayStr = today.toISOString().slice(0, 10)
          const todayBillingYm = getBillingYmForDate(todayStr, card.cutoffDay)
          if (todayBillingYm === ym) {
            const { cutoffDate, payDate } = nextCardCycleDates(card, today)
            return `締め日まで ${countdownLabel(cutoffDate, today)}　支払日まで ${countdownLabel(payDate, today)}`
          }
          const { cutoffDate, payDate } = cycleDatesForYm(card, ym)
          return `締め日 ${fmtCycleDate(cutoffDate)}　支払日 ${fmtCycleDate(payDate)}`
        }

        // ─── Apple（iOS 設定アプリ風）ヒーロー ─────────────
        if (apple) {
          return (
            <Section header={card.name}>
              <Box sx={{ px: 2, pt: 1.75, pb: 1.5 }}>
                {limit > 0 ? (
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                    <HeroValue label="使用額" value={fmt(grandTotal)} color={over ? ios.red : ios.label} size={32} />
                    <Stack alignItems="flex-end" spacing={0.25}>
                      <Typography sx={{ fontSize: 12.5, color: ios.secondary }}>上限 ¥{fmt(limit)}</Typography>
                      <Typography sx={{ fontSize: 15, fontWeight: 600, color: over ? ios.red : ios.green }}>
                        {over ? `−¥${fmt(grandTotal - limit)}` : `残り ¥${fmt(limit - grandTotal)}`}
                      </Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <HeroValue label="使用額" value={fmt(grandTotal)} size={32} />
                )}
                {limit > 0 && (
                  <Box sx={{ mt: 1.25 }}>
                    <Meter pct={pct} height={7} />
                    <Typography sx={{ fontSize: 12, color: ios.secondary, mt: 0.5 }}>{pct.toFixed(0)}% 使用</Typography>
                  </Box>
                )}
              </Box>
              <Row label="固定費" dense value={`¥${fmt(fixedTotal)}`} />
              <Row label="生活費" dense value={`¥${fmt(livingTotal)}`} />
              <Row label="その他" dense value={`¥${fmt(otherVarTotal)}`} />
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography sx={{ fontSize: 12.5, color: ios.secondary }}>{cutoffLabel(card)} {paymentLabel(card)}</Typography>
                <Typography sx={{ fontSize: 12.5, color: ios.secondary, mt: 0.25 }}>{cycleNode()}</Typography>
              </Box>
              <Box sx={{ px: 2, pb: 1.75 }}>
                <Typography sx={{ fontSize: 12, color: ios.secondary, mb: 0.5 }}>月間上限</Typography>
                <AmountField
                  allowZero
                  value={limitInput}
                  onChange={(raw) => { setLimitInputs(prev => ({ ...prev, [cardId]: raw })); saveLimit(cardId, raw) }}
                  placeholder="設定なし"
                  inputSx={{ '& .MuiInputBase-root': { height: 36 } }}
                />
              </Box>
            </Section>
          )
        }

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
                  {cutoffLabel(card)} {paymentLabel(card)}
                </Typography>
                {(() => {
                  const today = new Date()
                  const todayStr = today.toISOString().slice(0, 10)
                  const todayBillingYm = getBillingYmForDate(todayStr, card.cutoffDay)
                  if (todayBillingYm === ym) {
                    const { cutoffDate, payDate } = nextCardCycleDates(card, today)
                    return (
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                        <Typography variant="caption" sx={{ opacity: .75 }}>
                          締め日まで {countdownLabel(cutoffDate, today)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: .75 }}>
                          支払日まで {countdownLabel(payDate, today)}
                        </Typography>
                      </Stack>
                    )
                  }
                  const { cutoffDate, payDate } = cycleDatesForYm(card, ym)
                  return (
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" sx={{ opacity: .75 }}>
                        締め日 {fmtCycleDate(cutoffDate)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: .75 }}>
                        支払日 {fmtCycleDate(payDate)}
                      </Typography>
                    </Stack>
                  )
                })()}
              </Stack>
              {/* 上限入力 */}
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>月間上限</Typography>
                <AmountField
                  dark
                  allowZero
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
          sx={hdrSx}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <ExpandMoreIcon sx={{ fontSize: 16, color: hdrIconColor, transform: fixedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
            <Typography variant="caption" sx={hdrTitleSx}>固定費</Typography>
            <Chip label="毎月" size="small" sx={hdrChipSx} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={hdrAmtSx}>¥{fmt(fixedTotal)}</Typography>
            <IconButton size="small" aria-label="固定費を追加" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'fixed' }) }} sx={{ p: 0.75, color: hdrAddColor }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
        <Collapse in={fixedOpen}>
          <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
            <FixedExpenseTable
              fixedList={filteredFixed}
              onEdit={openFixedEdit}
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
          // 前月変動費は上部でメモ化済みの prevVarListForCat（同一 prevYm）を再利用
          const prevVarTotal = prevVarListForCat.reduce((s, x) => s + (x.sign === 1 ? -x.amount : x.amount), 0)
          const varDiff = varTotal - prevVarTotal
          return (
        <Box
          onClick={() => setVarOpen((v) => !v)}
          sx={hdrSx}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <ExpandMoreIcon sx={{ fontSize: 16, color: hdrIconColor, transform: varOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
            <Typography variant="caption" sx={hdrTitleSx}>変動費</Typography>
            <Chip label={`${year}年${month}月`} size="small" sx={hdrChipSx} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack alignItems="flex-end">
              <Typography variant="caption" sx={hdrAmtSx}>¥{fmt(varTotal)}</Typography>
              {prevVarTotal > 0 && (
                <Typography variant="caption" sx={{ fontSize: 9, color: varDiff > 0 ? (apple ? ios.red : '#ef9a9a') : (apple ? ios.green : '#a5d6a7') }}>
                  先月比 {varDiff >= 0 ? '+' : '−'}¥{fmt(Math.abs(varDiff))}
                </Typography>
              )}
            </Stack>
            <IconButton size="small" aria-label="変動費を追加" onClick={(e) => { e.stopPropagation(); setDlg({ type: 'var' }) }} sx={{ p: 0.75, color: hdrAddColor }}>
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
              onEdit={openVarEdit}
              onDelete={deleteVar}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* 消費分類（当カード） */}
      <SpendTypeChart varList={varList} />

      {/* カテゴリ別グラフ（当カード） */}
      <CategoryChart fixedList={filteredFixed} varList={varList} />

      {/* カテゴリ別集計（当カード） */}
      <CategoryBreakdown
        fixedList={filteredFixed}
        varList={varList}
        cardId={cardId}
        ym={ym}
        onUpdate={refreshLists}
        prevFixedList={prevFilteredFixed}
        prevVarList={prevVarListForCat}
      />

      {/* 年間サマリー */}
      <YearlySummary year={year} cardId={cardId} />

      {/* ダイアログ */}
      {dlg?.type === 'fixed' && (
        <ExpenseDialog open onClose={() => setDlg(null)}
          onSave={dlg.initial ? editFixed : addFixed}
          initial={dlg.initial} categories={categories} cardId={cardId} isFixed
          title={dlg.initial ? '固定費を編集' : '固定費を追加'} />
      )}
      {dlg?.type === 'var' && (
        <ExpenseDialog open onClose={() => setDlg(null)}
          onSave={dlg.initial ? editVar : addVar}
          initial={dlg.initial ?? { date: todayStr }} categories={categories} cardId={cardId} isFixed={false}
          title={dlg.initial ? '変動費を編集' : '変動費を追加'} />
      )}
      <CategoryDialog
        open={catDlgOpen} onClose={() => setCatDlgOpen(false)}
        categories={categories} onChange={handleCategoryChange} />

      {/* FAB: 支出入力 */}
      <Fab
        color="primary"
        onClick={() => setAddOpen(true)}
        sx={{
          position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, zIndex: 200,
          transition: 'transform .15s ease',
          '&:active': { transform: 'scale(0.9)' },
          ...(apple ? { bgcolor: ios.accent, '&:hover': { bgcolor: '#0a6fe0' }, boxShadow: '0 6px 20px rgba(0,122,255,0.4)' } : {}),
        }}
      >
        <AddIcon />
      </Fab>

      <AddExpenseScreen
        open={addOpen}
        onClose={closeAddExpense}
        onSave={handleAddSave}
        categories={categories}
        defaultDate={todayStr}
        onEditCategories={openCategoryDialog}
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
