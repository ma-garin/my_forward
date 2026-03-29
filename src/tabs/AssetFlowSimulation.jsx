import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider,
  IconButton, Chip, TextField, InputAdornment, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import RepeatIcon from '@mui/icons-material/Repeat'
import SavingsIcon from '@mui/icons-material/Savings'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import {
  getSalaryTakeHome, getCCTotal, loadFixedEvents, saveFixedEvents,
  loadCategories, newId,
} from '../utils/finance'

// ─── ストレージヘルパー ────────────────────────────────────────

const SALARY_OVERRIDE_KEY = 'asset_salary_override'

function loadSalaryOverride() {
  try { const v = localStorage.getItem(SALARY_OVERRIDE_KEY); return v !== null ? Number(v) : null } catch { return null }
}
function saveSalaryOverride(value) {
  try { value === null ? localStorage.removeItem(SALARY_OVERRIDE_KEY) : localStorage.setItem(SALARY_OVERRIDE_KEY, String(value)) } catch {}
}

function loadCCFixed(cardId) {
  try { return JSON.parse(localStorage.getItem(`cc_fixed_${cardId}`) || '[]') } catch { return [] }
}
function saveCCFixed(cardId, list) { localStorage.setItem(`cc_fixed_${cardId}`, JSON.stringify(list)) }

function loadCCVar(cardId, ym) {
  try { return JSON.parse(localStorage.getItem(`cc_var_${cardId}_${ym}`) || '[]') } catch { return [] }
}
function saveCCVar(cardId, ym, list) { localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list)) }

// ─── ユーティリティ ───────────────────────────────────────────

function fmt(n) { return Math.abs(n).toLocaleString('ja-JP') }
function parseAmt(raw) { const n = parseInt(String(raw ?? '').replace(/[,，\s]/g, ''), 10); return isNaN(n) ? 0 : n }

function ymStr(y, m) { return `${y}-${String(m).padStart(2, '0')}` }

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return ymStr(d.getFullYear(), d.getMonth() + 1)
}

function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate() }

function weeklyCount(ym, dayOfWeek) {
  const days = daysInMonth(ym)
  const [y, m] = ym.split('-').map(Number)
  let count = 0
  for (let d = 1; d <= days; d++) { if (new Date(y, m - 1, d).getDay() === dayOfWeek) count++ }
  return count
}

// ─── 月別データ計算 ───────────────────────────────────────────

function calcMonthData(ym, salaryOverride) {
  const salary = salaryOverride !== null ? salaryOverride : getSalaryTakeHome()

  const fixedEvts = loadFixedEvents()
  const fixedItems = []
  let fixedCost = 0

  fixedEvts.forEach((fe) => {
    if (fe.type === 'transfer' || fe.sign !== -1) return
    const count = fe.frequency === 'weekly' ? weeklyCount(ym, fe.dayOfWeek) : 1
    const amt = fe.amount * count
    fixedItems.push({ id: fe.id, name: fe.name, amount: amt, rawAmount: fe.amount, weekly: fe.frequency === 'weekly', count, frequency: fe.frequency, dayOfWeek: fe.dayOfWeek })
    fixedCost += amt
  })

  const [y, m] = ym.split('-').map(Number)
  const prevYm = ymStr(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
  const jcbAmt  = getCCTotal('jcb',  prevYm).total
  const smbcAmt = getCCTotal('smbc', prevYm).total
  const ccTotal = jcbAmt + smbcAmt

  const remaining = salary - fixedCost - ccTotal
  return { ym, prevYm, salary, fixedCost, fixedItems, jcbAmt, smbcAmt, ccTotal, remaining }
}

function buildYmList(baseYm, count) {
  const list = []
  for (let i = count - 1; i >= 0; i--) list.push(addMonth(baseYm, -i))
  return list
}

// ─── グラフ ───────────────────────────────────────────────────

function BarChart({ data }) {
  const W = 340, H = 120, PAD = 8
  const innerW = W - PAD * 2
  const barW = (innerW / data.length) * 0.6
  const gap   = innerW / data.length
  const maxVal = Math.max(...data.map(d => Math.abs(d.remaining)), 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <line x1={PAD} x2={W - PAD} y1={H - 24} y2={H - 24} stroke="#cfd8dc" strokeWidth={1} />
      {data.map((d, i) => {
        const cx = PAD + gap * i + gap / 2
        const isPos = d.remaining >= 0
        const barH = (Math.abs(d.remaining) / maxVal) * (H - 40)
        const barY = isPos ? (H - 24 - barH) : (H - 24)
        const [, mm] = d.ym.split('-').map(Number)
        return (
          <g key={d.ym}>
            <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} fill={isPos ? '#43a047' : '#e53935'} opacity={0.85} />
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#78909c">{mm}月</text>
            <text x={cx} y={isPos ? barY - 3 : barY + barH + 10} textAnchor="middle" fontSize={8} fill={isPos ? '#2e7d32' : '#c62828'}>
              {isPos ? '+' : '−'}{fmt(d.remaining / 10000)}万
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function CumLineChart({ data }) {
  const W = 340, H = 90, PAD = 16
  const innerW = W - PAD * 2
  let cum = 0
  const points = data.map((d, i) => { cum += d.remaining; return { x: PAD + (innerW / (data.length - 1 || 1)) * i, cum } })
  const maxC = Math.max(...points.map(p => p.cum), 1)
  const minC = Math.min(...points.map(p => p.cum), 0)
  const range = maxC - minC || 1
  const toY = (v) => PAD + (1 - (v - minC) / range) * (H - PAD * 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <polyline points={points.map(p => `${p.x.toFixed(1)},${toY(p.cum).toFixed(1)}`).join(' ')}
        fill="none" stroke="#1565c0" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={toY(p.cum)} r={3} fill="#1565c0" />
          <text x={p.x} y={toY(p.cum) - 6} textAnchor="middle" fontSize={8} fill="#1565c0">
            {p.cum >= 0 ? '+' : ''}{(p.cum / 10000).toFixed(1)}万
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─── 項目編集ダイアログ ────────────────────────────────────────

function ItemDialog({ open, title, initialName, initialAmount, initialCategory, categories, onSave, onClose }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName || '')
      setAmount(initialAmount ? String(initialAmount) : '')
      setCategory(initialCategory || '')
    }
  }, [open, initialName, initialAmount, initialCategory])

  const valid = name.trim().length > 0 && parseAmt(amount) > 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1, fontSize: 15 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <TextField
            label="項目名" value={name} onChange={e => setName(e.target.value)}
            size="small" fullWidth autoFocus
          />
          <TextField
            label="金額" value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            size="small" fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
          />
          {categories && (
            <FormControl size="small" fullWidth>
              <InputLabel>カテゴリ</InputLabel>
              <Select value={category} onChange={e => setCategory(e.target.value)} label="カテゴリ">
                <MenuItem value="">未分類</MenuItem>
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">キャンセル</Button>
        <Button onClick={() => valid && onSave({ name: name.trim(), amount: parseAmt(amount), category: category || undefined })}
          variant="contained" size="small" disabled={!valid}>保存</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────

export default function AssetFlowSimulation() {
  const today = new Date()
  const [baseYm, setBaseYm] = useState(ymStr(today.getFullYear(), today.getMonth() + 1))
  const MONTHS = 6
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // 手取り給与
  const [salaryOverride, setSalaryOverride] = useState(loadSalaryOverride)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryInput, setSalaryInput] = useState('')

  // 前月（クレカ請求月）
  const prevYm = useMemo(() => addMonth(baseYm, -1), [baseYm])

  // 固定費
  const [fixedEvts, setFixedEvts] = useState(() => loadFixedEvents())

  // クレカ固定費
  const [jcbFixed, setJcbFixed] = useState(() => loadCCFixed('jcb'))
  const [smbcFixed, setSmbcFixed] = useState(() => loadCCFixed('smbc'))

  // クレカ変動費（前月分）
  const [jcbVar, setJcbVar] = useState(() => loadCCVar('jcb', prevYm))
  const [smbcVar, setSmbcVar] = useState(() => loadCCVar('smbc', prevYm))
  useEffect(() => {
    setJcbVar(loadCCVar('jcb', prevYm))
    setSmbcVar(loadCCVar('smbc', prevYm))
  }, [prevYm])

  // 展開状態（クレカ内訳）
  const [jcbOpen, setJcbOpen] = useState(false)
  const [smbcOpen, setSmbcOpen] = useState(false)

  // ダイアログ: { mode, cardId?, itemId?, item? }
  const [dlg, setDlg] = useState(null)

  const categories = useMemo(() => loadCategories(), [])

  const ymList = useMemo(() => buildYmList(baseYm, MONTHS), [baseYm])
  const months = useMemo(() => ymList.map(ym => calcMonthData(ym, salaryOverride)), [ymList, salaryOverride, refreshKey])
  const current = months[months.length - 1]
  const [cy, cm] = baseYm.split('-').map(Number)
  const [py, pm] = prevYm.split('-').map(Number)

  // ─── 給与編集 ────────────────────────────────────────────────

  function startEditSalary() { setSalaryInput(String(salaryOverride !== null ? salaryOverride : current.salary)); setEditingSalary(true) }
  function commitSalary() {
    const num = parseAmt(salaryInput)
    if (num >= 0) { setSalaryOverride(num); saveSalaryOverride(num) }
    setEditingSalary(false)
  }
  function resetSalary() { setSalaryOverride(null); saveSalaryOverride(null); setEditingSalary(false) }

  // ─── 固定費操作 ──────────────────────────────────────────────

  function deleteFixed(id) {
    const next = fixedEvts.filter(e => e.id !== id)
    setFixedEvts(next); saveFixedEvents(next); refresh()
  }
  function handleSaveFixed({ name, amount }) {
    let next
    if (dlg.itemId) {
      next = fixedEvts.map(e => e.id === dlg.itemId ? { ...e, name, amount } : e)
    } else {
      next = [...fixedEvts, { id: newId(), name, amount, frequency: 'monthly', sign: -1 }]
    }
    setFixedEvts(next); saveFixedEvents(next); refresh(); setDlg(null)
  }

  // ─── CC固定費操作 ────────────────────────────────────────────

  function deleteCCFixed(cardId, id) {
    const list = cardId === 'jcb' ? jcbFixed : smbcFixed
    const next = list.filter(x => x.id !== id)
    if (cardId === 'jcb') { setJcbFixed(next) } else { setSmbcFixed(next) }
    saveCCFixed(cardId, next); refresh()
  }
  function handleSaveCCFixed({ name, amount }) {
    const { cardId, itemId } = dlg
    const list = cardId === 'jcb' ? jcbFixed : smbcFixed
    const next = itemId
      ? list.map(x => x.id === itemId ? { ...x, name, amount } : x)
      : [...list, { id: newId(), name, amount }]
    if (cardId === 'jcb') { setJcbFixed(next) } else { setSmbcFixed(next) }
    saveCCFixed(cardId, next); refresh(); setDlg(null)
  }

  // ─── CC変動費操作 ────────────────────────────────────────────

  function deleteCCVar(cardId, id) {
    const list = cardId === 'jcb' ? jcbVar : smbcVar
    const next = list.filter(x => x.id !== id)
    if (cardId === 'jcb') { setJcbVar(next) } else { setSmbcVar(next) }
    saveCCVar(cardId, prevYm, next); refresh()
  }
  function handleSaveCCVar({ name, amount, category }) {
    const { cardId, itemId } = dlg
    const list = cardId === 'jcb' ? jcbVar : smbcVar
    const next = itemId
      ? list.map(x => x.id === itemId ? { ...x, name, amount, category } : x)
      : [...list, { id: newId(), name, amount, category }]
    if (cardId === 'jcb') { setJcbVar(next) } else { setSmbcVar(next) }
    saveCCVar(cardId, prevYm, next); refresh(); setDlg(null)
  }

  // ─── ダイアログ dispatch ─────────────────────────────────────

  function onDlgSave(data) {
    if (!dlg) return
    if (dlg.mode === 'fixedAdd' || dlg.mode === 'fixedEdit') return handleSaveFixed(data)
    if (dlg.mode === 'ccFixedAdd' || dlg.mode === 'ccFixedEdit') return handleSaveCCFixed(data)
    if (dlg.mode === 'ccVarAdd' || dlg.mode === 'ccVarEdit') return handleSaveCCVar(data)
  }

  const dlgTitles = { fixedAdd: '固定費を追加', fixedEdit: '固定費を編集', ccFixedAdd: 'CC固定費を追加', ccFixedEdit: 'CC固定費を編集', ccVarAdd: '変動費を追加', ccVarEdit: '変動費を編集' }

  // 固定費アイテム（in-memory から生成、ID付き）
  const fixedItems = useMemo(() => {
    const items = []
    fixedEvts.forEach(fe => {
      if (fe.type === 'transfer' || fe.sign !== -1) return
      const count = fe.frequency === 'weekly' ? weeklyCount(current.ym, fe.dayOfWeek) : 1
      items.push({ id: fe.id, name: fe.name, amount: fe.amount * count, rawAmount: fe.amount, weekly: fe.frequency === 'weekly', count })
    })
    return items
  }, [fixedEvts, current.ym])

  // CC固定費（startYm フィルタ）
  const effJcbFixed = useMemo(() => jcbFixed.filter(x => !x.startYm || x.startYm <= prevYm), [jcbFixed, prevYm])
  const effSmbcFixed = useMemo(() => smbcFixed.filter(x => !x.startYm || x.startYm <= prevYm), [smbcFixed, prevYm])

  // ─── CC セクション共通レンダリング ───────────────────────────

  function CCSection({ cardId, label, total, fixedList, varList, expanded, onToggle }) {
    return (
      <>
        {/* カードヘッダ行 */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.25 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={onToggle}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Stack>
          <Typography variant="caption" sx={{ color: '#c62828' }}>−¥{fmt(total)}</Typography>
        </Stack>

        <Collapse in={expanded}>
          <Box sx={{ pl: 1.5, borderLeft: '2px solid #f5f5f5', ml: 0.5, mb: 0.5 }}>

            {/* CC固定費 */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5, mb: 0.25 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 600 }}>固定費</Typography>
              <IconButton size="small" sx={{ p: 0.25, color: 'primary.main' }}
                onClick={() => setDlg({ mode: 'ccFixedAdd', cardId })}>
                <AddIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Stack>
            {fixedList.length === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, display: 'block', pl: 0.5 }}>なし</Typography>
            )}
            {fixedList.map(item => (
              <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, flex: 1 }}>{item.name}</Typography>
                <Stack direction="row" alignItems="center" gap={0.25}>
                  <Typography variant="caption" sx={{ color: '#c62828', fontSize: 10 }}>−¥{fmt(item.amount)}</Typography>
                  <IconButton size="small" sx={{ p: 0.2 }}
                    onClick={() => setDlg({ mode: 'ccFixedEdit', cardId, itemId: item.id, item })}>
                    <EditIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  </IconButton>
                  <IconButton size="small" sx={{ p: 0.2 }} onClick={() => deleteCCFixed(cardId, item.id)}>
                    <DeleteIcon sx={{ fontSize: 12, color: '#ef9a9a' }} />
                  </IconButton>
                </Stack>
              </Stack>
            ))}

            <Divider sx={{ my: 0.5 }} />

            {/* CC変動費 */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, fontWeight: 600 }}>変動費（{py}年{pm}月）</Typography>
              <IconButton size="small" sx={{ p: 0.25, color: 'primary.main' }}
                onClick={() => setDlg({ mode: 'ccVarAdd', cardId })}>
                <AddIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Stack>
            {varList.length === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, display: 'block', pl: 0.5 }}>なし</Typography>
            )}
            {varList.map(item => (
              <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.2 }}>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }} noWrap>{item.name}</Typography>
                  {item.category && (
                    <Chip label={item.category} size="small" sx={{ height: 13, fontSize: 8, bgcolor: '#e3f2fd', color: '#1565c0' }} />
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.25}>
                  <Typography variant="caption" sx={{ color: '#c62828', fontSize: 10 }}>−¥{fmt(item.amount)}</Typography>
                  <IconButton size="small" sx={{ p: 0.2 }}
                    onClick={() => setDlg({ mode: 'ccVarEdit', cardId, itemId: item.id, item })}>
                    <EditIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  </IconButton>
                  <IconButton size="small" sx={{ p: 0.2 }} onClick={() => deleteCCVar(cardId, item.id)}>
                    <DeleteIcon sx={{ fontSize: 12, color: '#ef9a9a' }} />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Box>
        </Collapse>
      </>
    )
  }

  // ─── レンダリング ─────────────────────────────────────────────

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" onClick={() => setBaseYm(addMonth(baseYm, -1))}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {cy}年{cm}月
        </Typography>
        <IconButton size="small" onClick={() => setBaseYm(addMonth(baseYm, 1))}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* 当月サマリー */}
      <Card sx={{ mb: 1.5, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>
            {cy}年{cm}月 収支シミュレーション
          </Typography>

          {/* 収入 */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <AccountBalanceIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>手取り給与</Typography>
              {salaryOverride !== null && !editingSalary && (
                <Typography variant="caption" sx={{ opacity: .5, fontSize: 9 }}>（手動）</Typography>
              )}
            </Stack>
            {editingSalary ? (
              <Stack direction="row" alignItems="center" gap={0.5}>
                <TextField
                  value={salaryInput}
                  onChange={e => setSalaryInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitSalary(); if (e.key === 'Escape') setEditingSalary(false) }}
                  size="small" autoFocus
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Typography variant="caption" sx={{ color: '#a5d6a7' }}>¥</Typography></InputAdornment>,
                    sx: { color: '#a5d6a7', fontSize: 13, height: 28, input: { textAlign: 'right', p: 0, pr: 0.5 } },
                  }}
                  sx={{ width: 110, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(165,214,167,.5)' } }}
                />
                <IconButton size="small" onClick={commitSalary} sx={{ color: '#a5d6a7', p: 0.25 }}><CheckIcon sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" onClick={() => setEditingSalary(false)} sx={{ color: 'rgba(255,255,255,.5)', p: 0.25 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
                {salaryOverride !== null && (
                  <IconButton size="small" onClick={resetSalary} sx={{ color: 'rgba(255,255,255,.4)', p: 0.25 }}>
                    <Typography variant="caption" sx={{ fontSize: 9, opacity: .7 }}>戻す</Typography>
                  </IconButton>
                )}
              </Stack>
            ) : (
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="body1" fontWeight={700} sx={{ color: '#a5d6a7' }}>+¥{fmt(current.salary)}</Typography>
                <IconButton size="small" onClick={startEditSalary} sx={{ color: 'rgba(255,255,255,.4)', p: 0.25 }}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            )}
          </Stack>

          {/* 固定費 */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <RepeatIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>固定費</Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ color: '#ef9a9a' }}>
              −¥{fmt(current.fixedCost)}
            </Typography>
          </Stack>

          {/* クレカ */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <CreditCardIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>クレカ請求</Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ color: '#ef9a9a' }}>
              −¥{fmt(current.ccTotal)}
            </Typography>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(255,255,255,.15)', my: 1 }} />

          {/* 貯蓄可能額 */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Stack direction="row" alignItems="center" gap={0.75}>
              <SavingsIcon sx={{ fontSize: 14, opacity: .8 }} />
              <Typography variant="caption" sx={{ opacity: .8, fontWeight: 600 }}>貯蓄可能額</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={700}
              sx={{ color: current.remaining >= 0 ? '#69f0ae' : '#ff5252' }}>
              {current.remaining >= 0 ? '+' : '−'}¥{fmt(current.remaining)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* 支出内訳（編集可能） */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            支出内訳（{cy}年{cm}月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>

          {/* クレカ内訳 */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              クレカ（{py}年{pm}月分）
            </Typography>
          </Stack>

          <CCSection
            cardId="jcb" label="JCB" total={current.jcbAmt}
            fixedList={effJcbFixed} varList={jcbVar}
            expanded={jcbOpen} onToggle={() => setJcbOpen(v => !v)}
          />
          <CCSection
            cardId="smbc" label="SMBC" total={current.smbcAmt}
            fixedList={effSmbcFixed} varList={smbcVar}
            expanded={smbcOpen} onToggle={() => setSmbcOpen(v => !v)}
          />

          {fixedItems.length > 0 && <Divider sx={{ my: 0.75 }} />}

          {/* 固定費内訳 */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>固定費</Typography>
            <IconButton size="small" sx={{ p: 0.25, color: 'primary.main' }}
              onClick={() => setDlg({ mode: 'fixedAdd' })}>
              <AddIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Stack>
          {fixedItems.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 0.5 }}>なし</Typography>
          )}
          {fixedItems.map(item => (
            <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.2 }}>
              <Stack direction="row" alignItems="center" gap={0.5} sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">{item.name}</Typography>
                {item.weekly && (
                  <Chip label={`週次×${item.count}`} size="small"
                    sx={{ height: 14, fontSize: 8, bgcolor: '#f3e5f5', color: '#6a1b9a' }} />
                )}
              </Stack>
              <Stack direction="row" alignItems="center" gap={0.25}>
                <Typography variant="caption" sx={{ color: '#c62828' }}>−¥{fmt(item.amount)}</Typography>
                <IconButton size="small" sx={{ p: 0.2 }}
                  onClick={() => setDlg({ mode: 'fixedEdit', itemId: item.id, item: { name: item.name, amount: item.rawAmount } })}>
                  <EditIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                </IconButton>
                <IconButton size="small" sx={{ p: 0.2 }} onClick={() => deleteFixed(item.id)}>
                  <DeleteIcon sx={{ fontSize: 12, color: '#ef9a9a' }} />
                </IconButton>
              </Stack>
            </Stack>
          ))}
        </CardContent>
      </Card>

      {/* 過去6ヶ月 棒グラフ */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            貯蓄可能額（過去{MONTHS}ヶ月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <BarChart data={months} />
        </CardContent>
      </Card>

      {/* 累計折れ線グラフ */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            累計貯蓄シミュレーション（過去{MONTHS}ヶ月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <CumLineChart data={months} />
          <Divider sx={{ my: 1 }} />
          {[...months].reverse().map((d) => {
            const [dy, dm] = d.ym.split('-').map(Number)
            return (
              <Stack key={d.ym} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
                  {dy}年{dm}月
                </Typography>
                <Stack direction="row" gap={2} alignItems="baseline">
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>+¥{fmt(d.salary)}</Typography>
                  <Typography variant="caption" sx={{ color: '#c62828', fontSize: 10 }}>−¥{fmt(d.fixedCost + d.ccTotal)}</Typography>
                  <Typography variant="caption" fontWeight={700}
                    sx={{ color: d.remaining >= 0 ? '#2e7d32' : '#c62828', minWidth: 72, textAlign: 'right' }}>
                    {d.remaining >= 0 ? '+' : '−'}¥{fmt(d.remaining)}
                  </Typography>
                </Stack>
              </Stack>
            )
          })}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <ItemDialog
        open={dlg !== null}
        title={dlg ? (dlgTitles[dlg.mode] || '') : ''}
        initialName={dlg?.item?.name}
        initialAmount={dlg?.item?.amount}
        initialCategory={dlg?.item?.category}
        categories={dlg?.mode?.startsWith('ccVar') ? categories : undefined}
        onSave={onDlgSave}
        onClose={() => setDlg(null)}
      />

    </Box>
  )
}
