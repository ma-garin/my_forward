import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, TextField,
  Divider, Stack, Button, Chip, InputAdornment,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  DEFAULT_FIXED, UNIT_PRICE_RAW,
  calcKoyouhoken, calcShotokuzei,
  overtimeUnitPrice, overtimeUnitPriceFloor, calcTotalPay,
  deriveRowSim, newId,
} from '../utils/finance'

const STORAGE_KEY = 'salary_simulation'

function load() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const p = JSON.parse(s)
      return {
        fixed:      { ...DEFAULT_FIXED, ...p.fixed },
        overtime:   p.overtime ?? 20.0,
        customUnit: p.customUnit ?? '',
        payItems:   p.payItems  ?? [],
        dedItems:   p.dedItems  ?? [],
      }
    }
  } catch (_) {}
  return { fixed: { ...DEFAULT_FIXED }, overtime: 20.0, customUnit: '', payItems: [], dedItems: [] }
}

function save(fixed, overtime, customUnit = '', payItems = [], dedItems = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ fixed, overtime, customUnit, payItems, dedItems }))
}

// ─── 計算ロジック ────────────────────────────────────────────

function calcAllOvertime(f, overtime, customUnit) {
  const upR = overtimeUnitPrice(f)
  const upF = overtimeUnitPriceFloor(f)
  const upX = UNIT_PRICE_RAW
  const upC = customUnit
  return {
    unitR: upR, unitF: upF, unitX: upX, unitC: upC,
    otR: Math.floor(upR * overtime),
    otF: Math.floor(upF * overtime),
    otX: Math.floor(upX * overtime),
    otC: upC != null ? Math.floor(upC * overtime) : null,
  }
}

const deriveRowLocal = deriveRowSim

// ─── 時間変換ユーティリティ ──────────────────────────────────

function fmt(n) { return n.toLocaleString('ja-JP') }

// ─── UI パーツ ───────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
        {children}
      </CardContent>
    </Card>
  )
}

function FixedRow({ label, value, editMode, fieldKey, onEdit }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {!editMode && <Chip label="固定" size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#eceff1', color: '#78909c' }} />}
      </Stack>
      {editMode ? (
        <TextField
          size="small" type="number"
          inputProps={{ min: 0, style: { textAlign: 'right', width: 110 } }}
          value={value}
          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) onEdit(fieldKey, v) }}
          sx={{ '& .MuiInputBase-root': { height: 32, fontSize: 13 } }}
        />
      ) : (
        <Typography variant="body2" fontWeight={500}>¥{fmt(value)}</Typography>
      )}
    </Stack>
  )
}

// ─── 手動上書き可能な自動計算行 ─────────────────────────────

function OverrideRow({ label, autoValue, overrideValue, editMode, fieldKey, onEdit, onClear }) {
  const isOverridden = overrideValue != null
  const displayValue = isOverridden ? overrideValue : autoValue
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between"
      sx={{ py: 0.75, px: 1, mx: -1, borderRadius: 1, bgcolor: '#f1f8e9' }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Chip label={isOverridden ? '手動' : '自動'} size="small"
          sx={{ height: 16, fontSize: 10,
            bgcolor: isOverridden ? '#e3f2fd' : '#c8e6c9',
            color:   isOverridden ? '#1565c0' : '#2e7d32' }} />
      </Stack>
      {editMode ? (
        <Stack direction="row" alignItems="center" gap={0.5}>
          <TextField size="small" type="number"
            inputProps={{ min: 0, style: { textAlign: 'right', width: 90 } }}
            value={displayValue}
            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) onEdit(fieldKey, v) }}
            sx={{ '& .MuiInputBase-root': { height: 32, fontSize: 13 } }} />
          {isOverridden && (
            <Button size="small" onClick={() => onClear(fieldKey)}
              sx={{ fontSize: 9, minWidth: 0, px: 0.75, py: 0.25, color: 'text.disabled' }}>自動</Button>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" fontWeight={600} color={isOverridden ? 'primary.main' : 'text.primary'}>
          ¥{fmt(displayValue)}
        </Typography>
      )}
    </Stack>
  )
}

// ─── 自動計算行（自由入力優先、なければfloor）────────────────

function AutoRow({ label, valueC, valueF }) {
  const value = valueC ?? valueF
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between"
      sx={{ py: 0.75, px: 1, mx: -1, borderRadius: 1, bgcolor: '#f1f8e9' }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Chip label="自動" size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#c8e6c9', color: '#2e7d32' }} />
      </Stack>
      <Typography variant="body2" fontWeight={600} color={valueC != null ? '#1565c0' : 'text.primary'}>
        ¥{fmt(value)}
      </Typography>
    </Stack>
  )
}

// ─── カスタム項目行 ───────────────────────────────────────────

function CustomRow({ item, editMode, onEdit, onDelete }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
      {editMode ? (
        <>
          <TextField size="small" value={item.label}
            onChange={(e) => onEdit(item.id, 'label', e.target.value)}
            inputProps={{ style: { fontSize: 13, width: 100 } }}
            sx={{ '& .MuiInputBase-root': { height: 32 }, mr: 1 }} />
          <Stack direction="row" alignItems="center" gap={0.5}>
            <TextField size="small" type="number"
              inputProps={{ min: 0, style: { textAlign: 'right', width: 90 } }}
              value={item.amount}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) onEdit(item.id, 'amount', v) }}
              sx={{ '& .MuiInputBase-root': { height: 32, fontSize: 13 } }} />
            <IconButton size="small" onClick={() => onDelete(item.id)} sx={{ p: 0.5 }}>
              <DeleteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            </IconButton>
          </Stack>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">{item.label}</Typography>
          <Typography variant="body2" fontWeight={500}>¥{fmt(item.amount)}</Typography>
        </>
      )}
    </Stack>
  )
}

// ─── 項目追加ダイアログ ───────────────────────────────────────

function AddItemDialog({ open, onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const handleAdd = () => {
    const a = parseInt(amount, 10)
    if (!label.trim() || isNaN(a) || a < 0) return
    onAdd({ id: newId(), label: label.trim(), amount: a })
    setLabel(''); setAmount(''); onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1, fontSize: 15 }}>項目を追加</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={1.5}>
          <TextField label="項目名" size="small" fullWidth autoFocus value={label} onChange={e => setLabel(e.target.value)} />
          <TextField label="金額（円）" size="small" fullWidth type="number" inputProps={{ min: 0 }}
            value={amount} onChange={e => setAmount(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">キャンセル</Button>
        <Button onClick={handleAdd} variant="contained" size="small"
          disabled={!label.trim() || !(parseInt(amount, 10) >= 0)}>追加</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── ドラムロール ─────────────────────────────────────────────

const ITEM_H = 24
const DRUM_H = ITEM_H * 5  // 5 items visible
const HOUR_ITEMS = Array.from({ length: 81 }, (_, i) => i)
const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => i)

function DrumRoll({ items, value, onChange, format = (v) => String(v) }) {
  const idxOf = (v) => { const i = items.indexOf(v); return i >= 0 ? i : 0 }
  const [offset, setOffset] = useState(() => idxOf(value) * ITEM_H)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(null)
  const startOffset = useRef(0)

  useEffect(() => {
    if (!isDragging) setOffset(idxOf(value) * ITEM_H)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (o) => Math.max(0, Math.min((items.length - 1) * ITEM_H, o))

  const onTouchStart = (e) => {
    e.preventDefault()
    startY.current = e.touches[0].clientY
    startOffset.current = offset
    setIsDragging(true)
  }
  const onTouchMove = (e) => {
    e.preventDefault()
    if (startY.current == null) return
    setOffset(clamp(startOffset.current + (startY.current - e.touches[0].clientY)))
  }
  const onTouchEnd = () => {
    setIsDragging(false)
    startY.current = null
    const newIdx = Math.max(0, Math.min(items.length - 1, Math.round(offset / ITEM_H)))
    setOffset(newIdx * ITEM_H)
    onChange(items[newIdx])
  }

  const centerIdx = Math.round(offset / ITEM_H)

  return (
    <Box
      sx={{ position: 'relative', width: 52, height: DRUM_H, overflow: 'hidden', userSelect: 'none', touchAction: 'none' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Scrolling list */}
      <Box sx={{
        position: 'absolute', top: ITEM_H * 2, left: 0, right: 0,
        transform: `translateY(${-offset}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease',
      }}>
        {items.map((item, i) => {
          const sel = i === centerIdx
          return (
            <Box key={String(item)} sx={{ height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{
                fontSize: sel ? 15 : 10, fontWeight: sel ? 700 : 400,
                color: sel ? 'primary.dark' : 'text.disabled',
                lineHeight: 1, transition: isDragging ? 'none' : 'all 0.15s',
              }}>
                {format(item)}
              </Typography>
            </Box>
          )
        })}
      </Box>
      {/* Center selector lines */}
      <Box sx={{
        position: 'absolute', top: ITEM_H * 2, left: 8, right: 8, height: ITEM_H,
        borderTop: '1.5px solid', borderBottom: '1.5px solid', borderColor: 'primary.light',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Top fade */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Bottom fade */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
    </Box>
  )
}

// ─── 残業時間入力（ドラムロール）────────────────────────────────

function OvertimeInput({ overtime, onChange }) {
  const hours = Math.floor(overtime)
  const minutes = Math.min(59, Math.max(0, Math.round((overtime - hours) * 60)))
  return (
    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ my: 1 }}>
      <Stack alignItems="center">
        <DrumRoll items={HOUR_ITEMS} value={hours} onChange={(h) => onChange(h + minutes / 60)} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>時間</Typography>
      </Stack>
      <Typography variant="body1" color="text.disabled" sx={{ mb: 1.5, lineHeight: 1 }}>:</Typography>
      <Stack alignItems="center">
        <DrumRoll
          items={MINUTE_ITEMS} value={minutes}
          format={(v) => String(v).padStart(2, '0')}
          onChange={(m) => onChange(hours + m / 60)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>分</Typography>
      </Stack>
    </Stack>
  )
}

// ─── メインコンポーネント ────────────────────────────────────

export default function SalarySimulation() {
  const init = load()
  const [fixed, setFixed]           = useState(init.fixed)
  const [overtime, setOvertime]     = useState(init.overtime)
  const [editMode, setEditMode]     = useState(false)
  const [customUnit, setCustomUnit] = useState(init.customUnit)
  const [payItems, setPayItems]     = useState(init.payItems)
  const [dedItems, setDedItems]     = useState(init.dedItems)
  const [addDlg, setAddDlg]         = useState(null) // 'pay' | 'ded' | null

  const parsedCustomUnit = customUnit === '' ? null : (parseInt(customUnit, 10) || null)
  const { unitR, unitF, unitC, otR, otF, otC } = calcAllOvertime(fixed, overtime, parsedCustomUnit)

  const rowF = deriveRowLocal(fixed, otF)
  const rowC = otC != null ? deriveRowLocal(fixed, otC) : null

  const customPayTotal = payItems.reduce((s, x) => s + x.amount, 0)
  const customDedTotal = dedItems.reduce((s, x) => s + x.amount, 0)
  const baseRow = rowC ?? rowF
  const displayTakeHome = baseRow.takeHome + customPayTotal - customDedTotal
  const displayTotalPay = baseRow.totalPay + customPayTotal
  const displayTotalDed = baseRow.totalDed + customDedTotal

  const editFixed = useCallback((key, val) => {
    setFixed((prev) => {
      const next = { ...prev, [key]: val }
      save(next, overtime, customUnit, payItems, dedItems)
      return next
    })
  }, [overtime, customUnit, payItems, dedItems])

  const clearFixed = useCallback((key) => {
    setFixed((prev) => {
      const next = { ...prev, [key]: null }
      save(next, overtime, customUnit, payItems, dedItems)
      return next
    })
  }, [overtime, customUnit, payItems, dedItems])

  const handleOvertimeChange = (val) => {
    const v = Math.round(val * 100) / 100
    if (!isNaN(v) && v >= 0) {
      setOvertime(v)
      save(fixed, v, customUnit, payItems, dedItems)
    }
  }

  const toggleEdit = () => {
    if (editMode) save(fixed, overtime, customUnit, payItems, dedItems)
    setEditMode((v) => !v)
  }

  const editCustomItem = (list, setList, id, field, val) => {
    const next = list.map(x => x.id === id ? { ...x, [field]: val } : x)
    setList(next)
    if (field === 'amount') save(fixed, overtime, customUnit,
      list === payItems ? next : payItems,
      list === dedItems ? next : dedItems)
  }

  const deleteCustomItem = (list, setList, id) => {
    const next = list.filter(x => x.id !== id)
    setList(next)
    save(fixed, overtime, customUnit,
      list === payItems ? next : payItems,
      list === dedItems ? next : dedItems)
  }

  const addCustomItem = (type, item) => {
    if (type === 'pay') {
      const next = [...payItems, item]
      setPayItems(next); save(fixed, overtime, customUnit, next, dedItems)
    } else {
      const next = [...dedItems, item]
      setDedItems(next); save(fixed, overtime, customUnit, payItems, next)
    }
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 手取りサマリー */}
      <Card sx={{ mb: 2, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>今月の手取り（シミュレーション）</Typography>
          {rowC != null && (
            <Typography variant="caption" sx={{ opacity: .6, fontSize: 9, color: '#90caf9' }}>自由入力単価</Typography>
          )}
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.25, letterSpacing: -0.5 }}>
            ¥{fmt(displayTakeHome)}
          </Typography>
          <Typography variant="caption" sx={{ opacity: .55, fontSize: 10, mt: 0.25 }}>
            総支給 ¥{fmt(displayTotalPay)}
          </Typography>
        </CardContent>
      </Card>

      {/* 残業時間 */}
      <SectionCard title="残業時間">
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
          <Typography variant="h5" fontWeight={700} color="primary.dark">
            {Math.floor(overtime)}時間{Math.round((overtime % 1) * 60)}分
          </Typography>
          <Typography variant="body2" color="text.secondary">（{overtime.toFixed(2)}h）</Typography>
          <Box sx={{ flex: 1 }} />
        </Stack>

        <OvertimeInput overtime={overtime} onChange={handleOvertimeChange} />

        {/* 残業単価・金額 */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mt: 1.5 }}>
          {parsedCustomUnit != null ? (
            <Typography variant="body2" color="#1565c0" fontWeight={700}>
              ¥{fmt(unitC)}/h → ¥{fmt(otC)}
            </Typography>
          ) : (
            <Typography variant="body2" color="primary.dark" fontWeight={500}>
              ¥{fmt(unitF)}/h → ¥{fmt(otF)}
            </Typography>
          )}
        </Stack>

        {/* 単価自由入力 */}
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>単価 自由入力</Typography>
          <TextField
            size="small" type="number" placeholder={String(unitR)}
            inputProps={{ min: 1, style: { textAlign: 'right', width: 70, fontSize: 13 } }}
            value={customUnit}
            onChange={(e) => { setCustomUnit(e.target.value); save(fixed, overtime, e.target.value) }}
            sx={{ '& .MuiInputBase-root': { height: 32 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              endAdornment: <Typography variant="caption" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>/h</Typography>,
            }}
          />
          {customUnit !== '' && (
            <Button size="small" variant="text" color="inherit"
              sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.disabled' }}
              onClick={() => { setCustomUnit(''); save(fixed, overtime, '') }}>クリア</Button>
          )}
        </Stack>
      </SectionCard>

      {/* 編集ボタン */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Button
          size="small"
          variant={editMode ? 'contained' : 'outlined'}
          color="primary"
          startIcon={editMode ? <CheckIcon /> : <EditIcon />}
          onClick={toggleEdit}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {editMode ? '保存' : '固定項目を編集'}
        </Button>
      </Stack>

      {/* 支給項目 */}
      <SectionCard title="支給項目">
        <FixedRow label="基本給"   value={fixed.shokunokyuu}   editMode={editMode} fieldKey="shokunokyuu"   onEdit={editFixed} />
        <Divider />
        <FixedRow label="住宅手当" value={fixed.jyuutakuteate} editMode={editMode} fieldKey="jyuutakuteate" onEdit={editFixed} />
        <Divider />
        <FixedRow label="特命手当" value={fixed.tokumei}       editMode={editMode} fieldKey="tokumei"       onEdit={editFixed} />
        <Divider />
        <FixedRow label="通勤手当" value={fixed.tsuukinteate}  editMode={editMode} fieldKey="tsuukinteate"  onEdit={editFixed} />
        <Divider />
        <AutoRow label="時間外手当" valueC={otC} valueF={otF} />
        {(fixed.shinyateate > 0 || editMode) && (
          <>
            <Divider />
            <FixedRow label="深夜手当" value={fixed.shinyateate} editMode={editMode} fieldKey="shinyateate" onEdit={editFixed} />
          </>
        )}
        {payItems.map((item) => (
          <Box key={item.id}>
            <Divider />
            <CustomRow item={item} editMode={editMode}
              onEdit={(id, f, v) => editCustomItem(payItems, setPayItems, id, f, v)}
              onDelete={(id) => deleteCustomItem(payItems, setPayItems, id)} />
          </Box>
        ))}
        {editMode && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddDlg('pay')}
            sx={{ mt: 0.5, fontSize: 11, color: 'text.secondary' }}>項目を追加</Button>
        )}
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>支給額合計</Typography>
          <Typography variant="body2" fontWeight={700} color={rowC != null ? '#1565c0' : 'primary.dark'}>
            ¥{fmt(displayTotalPay)}
          </Typography>
        </Stack>
      </SectionCard>

      {/* 控除項目 */}
      <SectionCard title="控除項目">
        <FixedRow label="健康保険"     value={fixed.kenkouhoken}  editMode={editMode} fieldKey="kenkouhoken"  onEdit={editFixed} />
        <Divider />
        <FixedRow label="厚生年金保険" value={fixed.kouseinenkin} editMode={editMode} fieldKey="kouseinenkin" onEdit={editFixed} />
        <Divider />
        <OverrideRow label="雇用保険"
          autoValue={rowF.koyouCalc} overrideValue={fixed.koyouOverride ?? null}
          editMode={editMode} fieldKey="koyouOverride" onEdit={editFixed} onClear={clearFixed} />
        <Divider />
        <OverrideRow label="所得税"
          autoValue={rowF.shotokuCalc} overrideValue={fixed.shotokuOverride ?? null}
          editMode={editMode} fieldKey="shotokuOverride" onEdit={editFixed} onClear={clearFixed} />
        <Divider />
        <FixedRow label="住民税"   value={fixed.jyuuminzei} editMode={editMode} fieldKey="jyuuminzei" onEdit={editFixed} />
        <Divider />
        <FixedRow label="組合費"   value={fixed.kumiaifi}   editMode={editMode} fieldKey="kumiaifi"   onEdit={editFixed} />
        <Divider />
        <FixedRow label="食事補助" value={fixed.shokuhi}    editMode={editMode} fieldKey="shokuhi"    onEdit={editFixed} />
        {dedItems.map((item) => (
          <Box key={item.id}>
            <Divider />
            <CustomRow item={item} editMode={editMode}
              onEdit={(id, f, v) => editCustomItem(dedItems, setDedItems, id, f, v)}
              onDelete={(id) => deleteCustomItem(dedItems, setDedItems, id)} />
          </Box>
        ))}
        {editMode && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddDlg('ded')}
            sx={{ mt: 0.5, fontSize: 11, color: 'text.secondary' }}>項目を追加</Button>
        )}
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>控除額合計</Typography>
          <Typography variant="body2" fontWeight={700} color="error.main">
            ¥{fmt(displayTotalDed)}
          </Typography>
        </Stack>
      </SectionCard>

      <AddItemDialog
        open={addDlg !== null}
        onClose={() => setAddDlg(null)}
        onAdd={(item) => addCustomItem(addDlg, item)}
      />

    </Box>
  )
}
