import { useState, useCallback, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, TextField,
  Divider, Stack, Button, Chip, InputAdornment,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  DEFAULT_FIXED, UNIT_PRICE_RAW,
  overtimeUnitPrice, overtimeUnitPriceFloor, calcTotalPay,
  deriveRowSim, newId,
  addMonth, currentBillingYm, isBonusMonth, loadSalaryMonth, saveSalaryMonth,
} from '../utils/finance'

function save(ym, fixed, overtime, customUnit = '', payItems = [], dedItems = [], bonusTakeHome = '') {
  saveSalaryMonth(ym, { fixed, overtime, customUnit, payItems, dedItems, bonusTakeHome })
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

// ─── 残業時間入力 ─────────────────────────────────────────────

function OvertimeInput({ overtime, onChange }) {
  const hours = Math.floor(overtime)
  const minutes = Math.min(59, Math.max(0, Math.round((overtime - hours) * 60)))
  return (
    <Stack direction="row" gap={1.5} alignItems="center" sx={{ my: 1 }}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <TextField size="small" type="number"
          inputProps={{ min: 0, max: 80, style: { textAlign: 'right', width: 56 } }}
          value={hours}
          onChange={(e) => {
            const h = Math.max(0, Math.min(80, parseInt(e.target.value, 10) || 0))
            onChange(h + minutes / 60)
          }}
          sx={{ '& .MuiInputBase-root': { height: 36 } }}
        />
        <Typography variant="body2" color="text.secondary">時間</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <TextField size="small" type="number"
          inputProps={{ min: 0, max: 59, style: { textAlign: 'right', width: 56 } }}
          value={minutes}
          onChange={(e) => {
            const m = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
            onChange(hours + m / 60)
          }}
          sx={{ '& .MuiInputBase-root': { height: 36 } }}
        />
        <Typography variant="body2" color="text.secondary">分</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
        （{overtime.toFixed(2)}h）
      </Typography>
    </Stack>
  )
}

// ─── メインコンポーネント ────────────────────────────────────

export default function SalarySimulation() {
  const [initial] = useState(() => {
    const initialYm = currentBillingYm()
    return { ym: initialYm, data: loadSalaryMonth(initialYm) }
  })
  const [ym, setYm]                 = useState(initial.ym)
  const [fixed, setFixed]           = useState(initial.data.fixed)
  const [overtime, setOvertime]     = useState(initial.data.overtime)
  const [editMode, setEditMode]     = useState(false)
  const [customUnit, setCustomUnit] = useState(initial.data.customUnit)
  const [payItems, setPayItems]     = useState(initial.data.payItems)
  const [dedItems, setDedItems]     = useState(initial.data.dedItems)
  const [bonusTakeHome, setBonusTakeHome] = useState(initial.data.bonusTakeHome)
  const [addDlg, setAddDlg]         = useState(null) // 'pay' | 'ded' | null

  const [year, month] = ym.split('-').map(Number)
  const bonusMonth = isBonusMonth(ym)

  const persistCurrent = useCallback(() => {
    save(ym, fixed, overtime, customUnit, payItems, dedItems, bonusTakeHome)
  }, [ym, fixed, overtime, customUnit, payItems, dedItems, bonusTakeHome])

  const loadYm = useCallback((nextYm) => {
    const next = loadSalaryMonth(nextYm)
    setYm(nextYm)
    setFixed(next.fixed)
    setOvertime(next.overtime)
    setCustomUnit(next.customUnit)
    setPayItems(next.payItems)
    setDedItems(next.dedItems)
    setBonusTakeHome(next.bonusTakeHome)
    setEditMode(false)
  }, [])

  const changeMonth = (n) => {
    persistCurrent()
    loadYm(addMonth(ym, n))
  }

  const parsedCustomUnit = customUnit === '' ? null : (parseInt(customUnit, 10) || null)
  const { unitR, unitF, unitC, otF, otC } = calcAllOvertime(fixed, overtime, parsedCustomUnit)

  const rowF = deriveRowLocal(fixed, otF)
  const rowC = otC != null ? deriveRowLocal(fixed, otC) : null

  const customPayTotal = payItems.reduce((s, x) => s + x.amount, 0)
  const customDedTotal = dedItems.reduce((s, x) => s + x.amount, 0)
  const bonusAmount = bonusMonth ? (parseInt(String(bonusTakeHome).replace(/,/g, ''), 10) || 0) : 0
  const baseRow = rowC ?? rowF
  const salaryTakeHome = baseRow.takeHome + customPayTotal - customDedTotal
  const displayTakeHome = salaryTakeHome + bonusAmount
  const displayTotalPay = baseRow.totalPay + customPayTotal
  const displayTotalDed = baseRow.totalDed + customDedTotal

  const editFixed = useCallback((key, val) => {
    setFixed((prev) => {
      const next = { ...prev, [key]: val }
      save(ym, next, overtime, customUnit, payItems, dedItems, bonusTakeHome)
      return next
    })
  }, [ym, overtime, customUnit, payItems, dedItems, bonusTakeHome])

  const clearFixed = useCallback((key) => {
    setFixed((prev) => {
      const next = { ...prev, [key]: null }
      save(ym, next, overtime, customUnit, payItems, dedItems, bonusTakeHome)
      return next
    })
  }, [ym, overtime, customUnit, payItems, dedItems, bonusTakeHome])

  const handleOvertimeChange = (val) => {
    const v = Math.round(val * 100) / 100
    if (!isNaN(v) && v >= 0) {
      setOvertime(v)
      save(ym, fixed, v, customUnit, payItems, dedItems, bonusTakeHome)
    }
  }

  const toggleEdit = () => {
    if (editMode) persistCurrent()
    setEditMode((v) => !v)
  }

  const editCustomItem = (list, setList, id, field, val) => {
    const next = list.map(x => x.id === id ? { ...x, [field]: val } : x)
    setList(next)
    save(ym, fixed, overtime, customUnit,
      list === payItems ? next : payItems,
      list === dedItems ? next : dedItems,
      bonusTakeHome)
  }

  const deleteCustomItem = (list, setList, id) => {
    const next = list.filter(x => x.id !== id)
    setList(next)
    save(ym, fixed, overtime, customUnit,
      list === payItems ? next : payItems,
      list === dedItems ? next : dedItems,
      bonusTakeHome)
  }

  const addCustomItem = (type, item) => {
    if (type === 'pay') {
      const next = [...payItems, item]
      setPayItems(next); save(ym, fixed, overtime, customUnit, next, dedItems, bonusTakeHome)
    } else {
      const next = [...dedItems, item]
      setDedItems(next); save(ym, fixed, overtime, customUnit, payItems, next, bonusTakeHome)
    }
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

      {/* 手取りサマリー */}
      <Card sx={{ mb: 2, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>{ym} の手取り（シミュレーション）</Typography>
          {rowC != null && (
            <Typography variant="caption" sx={{ opacity: .6, fontSize: 9, color: '#90caf9' }}>自由入力単価</Typography>
          )}
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.25, letterSpacing: -0.5 }}>
            ¥{fmt(displayTakeHome)}
          </Typography>
          <Typography variant="caption" sx={{ opacity: .55, fontSize: 10, mt: 0.25 }}>
            総支給 ¥{fmt(displayTotalPay)}
          </Typography>
          {bonusMonth && bonusAmount > 0 && (
            <Stack direction="row" gap={1.5} sx={{ mt: 0.75 }}>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>
                給与 ¥{fmt(salaryTakeHome)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: .75, fontSize: 10, color: '#ffcc80' }}>
                賞与 ¥{fmt(bonusAmount)}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>

      {bonusMonth && (
        <SectionCard title="賞与">
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72 }}>賞与手取り</Typography>
            <TextField
              size="small" type="number" fullWidth
              inputProps={{ min: 0, style: { textAlign: 'right', fontSize: 13 } }}
              value={bonusTakeHome}
              onChange={(e) => {
                setBonusTakeHome(e.target.value)
                save(ym, fixed, overtime, customUnit, payItems, dedItems, e.target.value)
              }}
              sx={{ '& .MuiInputBase-root': { height: 32 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              }}
            />
          </Stack>
        </SectionCard>
      )}

      {/* 残業時間 */}
      <SectionCard title="残業時間">
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
            onChange={(e) => { setCustomUnit(e.target.value); save(ym, fixed, overtime, e.target.value, payItems, dedItems, bonusTakeHome) }}
            sx={{ '& .MuiInputBase-root': { height: 32 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
              endAdornment: <Typography variant="caption" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>/h</Typography>,
            }}
          />
          {customUnit !== '' && (
            <Button size="small" variant="text" color="inherit"
              sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.disabled' }}
              onClick={() => { setCustomUnit(''); save(ym, fixed, overtime, '', payItems, dedItems, bonusTakeHome) }}>クリア</Button>
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
        <FixedRow label="住民税" value={fixed.jyuuminzei} editMode={editMode} fieldKey="jyuuminzei" onEdit={editFixed} />
        {(fixed.kumiaifi > 0 || editMode) && (
          <>
            <Divider />
            <FixedRow label="組合費" value={fixed.kumiaifi} editMode={editMode} fieldKey="kumiaifi" onEdit={editFixed} />
          </>
        )}
        {(fixed.shokuhi > 0 || editMode) && (
          <>
            <Divider />
            <FixedRow label="食事補助" value={fixed.shokuhi} editMode={editMode} fieldKey="shokuhi" onEdit={editFixed} />
          </>
        )}
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
