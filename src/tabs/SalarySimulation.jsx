import { useState, useCallback, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Slider, TextField,
  Divider, Stack, Button, Chip, InputAdornment,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import {
  DEFAULT_FIXED, UNIT_PRICE_RAW,
  calcKoyouhoken, calcShotokuzei,
  overtimeUnitPrice, overtimeUnitPriceFloor, calcTotalPay,
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
      }
    }
  } catch (_) {}
  return { fixed: { ...DEFAULT_FIXED }, overtime: 20.0, customUnit: '' }
}

function save(fixed, overtime, customUnit = '') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ fixed, overtime, customUnit }))
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

function deriveRowLocal(f, otPay) {
  const baseOtR  = Math.floor(overtimeUnitPrice(f) * 20)
  const basePay  = calcTotalPay(f, 20)
  const totalPay = basePay - baseOtR + otPay
  const koyou    = calcKoyouhoken(totalPay)
  const taxable  = totalPay - f.tsuukinteate
  const social   = f.kenkouhoken + f.kouseinenkin + koyou
  const shotoku  = calcShotokuzei(taxable, social)
  const totalDed = f.kenkouhoken + f.kouseinenkin + koyou + shotoku + f.jyuuminzei + f.kumiaifi + f.shokuhi
  return { totalPay, koyou, shotoku, totalDed, takeHome: totalPay - totalDed }
}

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

// ─── 4値表示行（自由入力 / 小数 / round / floor）─────────────

const SEP = <Box sx={{ width: '1px', bgcolor: '#c8e6c9', alignSelf: 'stretch' }} />

function QuadAutoRow({ label, valueC, valueX, valueR, valueF }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between"
      sx={{ py: 0.75, px: 1, mx: -1, borderRadius: 1, bgcolor: '#f1f8e9' }}>
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Chip label="自動" size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#c8e6c9', color: '#2e7d32' }} />
      </Stack>
      <Stack direction="row" alignItems="stretch" gap={0.75}>
        <Stack alignItems="flex-end">
          <Typography variant="caption" sx={{ fontSize: 9, color: '#1565c0' }}>自由入力</Typography>
          {valueC != null
            ? <Typography variant="body2" fontWeight={600} color="#1565c0">¥{fmt(valueC)}</Typography>
            : <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: 11 }}>—</Typography>
          }
        </Stack>
        {SEP}
        <Stack alignItems="flex-end">
          <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>小数</Typography>
          <Typography variant="body2" fontWeight={500}>¥{fmt(valueX)}</Typography>
        </Stack>
        {SEP}
        <Stack alignItems="flex-end">
          <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>round</Typography>
          <Typography variant="body2" fontWeight={500}>¥{fmt(valueR)}</Typography>
        </Stack>
        {SEP}
        <Stack alignItems="flex-end">
          <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>floor</Typography>
          <Typography variant="body2" fontWeight={500}>¥{fmt(valueF)}</Typography>
        </Stack>
      </Stack>
    </Stack>
  )
}

// ─── 残業時間入力（±ボタン）────────────────────────────────

function OvertimeInput({ overtime, onChange }) {
  const hours   = Math.floor(overtime)
  const minutes = Math.round((overtime - hours) * 60)
  const [hText, setHText] = useState(String(hours))
  const [mText, setMText] = useState(String(minutes))
  const [hFocus, setHFocus] = useState(false)
  const [mFocus, setMFocus] = useState(false)

  // 外部から overtime が変わった場合のみ同期（フォーカス中は除く）
  useEffect(() => {
    if (!hFocus) setHText(String(hours))
  }, [hours, hFocus])
  useEffect(() => {
    if (!mFocus) setMText(String(minutes))
  }, [minutes, mFocus])

  const addHours = (d) => { const h = Math.max(0, hours + d); onChange(h + minutes / 60) }
  const addMins  = (d) => {
    let m = minutes + d
    let h = hours
    if (m >= 60) { h += 1; m -= 60 }
    if (m < 0)   { h = Math.max(0, h - 1); m = h < 0 ? 0 : 59 }
    onChange(Math.max(0, h) + m / 60)
  }

  const btnSx = { minWidth: 36, height: 36, fontSize: 18, fontWeight: 700 }

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={1}>
        {/* 時間 */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Button variant="outlined" size="small" sx={btnSx} onClick={() => addHours(-1)}>−</Button>
          <TextField
            size="small" type="number"
            inputProps={{ min: 0, max: 999, style: { width: 48, textAlign: 'center', fontSize: 16, fontWeight: 700 } }}
            value={hText}
            onChange={(e) => setHText(e.target.value)}
            onFocus={() => setHFocus(true)}
            onBlur={() => {
              setHFocus(false)
              const h = Math.max(0, parseInt(hText, 10) || 0)
              setHText(String(h))
              onChange(h + minutes / 60)
            }}
            sx={{ '& .MuiInputBase-root': { height: 36 } }}
            InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>時間</Typography> }}
          />
          <Button variant="outlined" size="small" sx={btnSx} onClick={() => addHours(1)}>＋</Button>
        </Stack>

        {/* 分 */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Button variant="outlined" size="small" sx={btnSx} onClick={() => addMins(-1)}>−</Button>
          <TextField
            size="small" type="number"
            inputProps={{ min: 0, max: 59, style: { width: 36, textAlign: 'center', fontSize: 16, fontWeight: 700 } }}
            value={mText}
            onChange={(e) => setMText(e.target.value)}
            onFocus={() => setMFocus(true)}
            onBlur={() => {
              setMFocus(false)
              const m = Math.min(59, Math.max(0, parseInt(mText, 10) || 0))
              setMText(String(m))
              onChange(hours + m / 60)
            }}
            sx={{ '& .MuiInputBase-root': { height: 36 } }}
            InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>分</Typography> }}
          />
          <Button variant="outlined" size="small" sx={btnSx} onClick={() => addMins(1)}>＋</Button>
        </Stack>

        <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#f1f8e9', borderRadius: 1, border: '1px solid #c8e6c9' }}>
          <Typography variant="body2" fontWeight={600} color="primary.dark" sx={{ fontFamily: 'monospace' }}>
            {overtime.toFixed(2)}h
          </Typography>
        </Box>
      </Stack>
    </Stack>
  )
}

// ─── メインコンポーネント ────────────────────────────────────

export default function SalarySimulation() {
  const init = load()
  const [fixed, setFixed]       = useState(init.fixed)
  const [overtime, setOvertime] = useState(init.overtime)
  const [editMode, setEditMode] = useState(false)
  const [customUnit, setCustomUnit] = useState(init.customUnit)

  const parsedCustomUnit = customUnit === '' ? null : (parseInt(customUnit, 10) || null)
  const { unitR, unitF, unitX, unitC, otR, otF, otX, otC } = calcAllOvertime(fixed, overtime, parsedCustomUnit)

  const rowR = deriveRowLocal(fixed, otR)
  const rowF = deriveRowLocal(fixed, otF)
  const rowX = deriveRowLocal(fixed, otX)
  const rowC = otC != null ? deriveRowLocal(fixed, otC) : null

  const editFixed = useCallback((key, val) => {
    setFixed((prev) => {
      const next = { ...prev, [key]: val }
      save(next, overtime, customUnit)
      return next
    })
  }, [overtime, customUnit])

  const handleOvertimeChange = (val) => {
    const v = Math.round(val * 100) / 100
    if (!isNaN(v) && v >= 0) {
      setOvertime(v)
      save(fixed, v, customUnit)
    }
  }

  const toggleEdit = () => {
    if (editMode) save(fixed, overtime, customUnit)
    setEditMode((v) => !v)
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 手取りサマリー */}
      <Card sx={{ mb: 2, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>今月の手取り（シミュレーション）</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', mt: 0.5 }}>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .7, fontSize: 10, color: '#90caf9' }}>自由入力</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{rowC != null ? `¥${fmt(rowC.takeHome)}` : '—'}</Typography>
              <Typography variant="caption" sx={{ opacity: .6, color: '#90caf9', fontSize: 9 }}>{rowC != null ? `¥${fmt(rowC.totalPay)}` : ''}</Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>小数</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.85 }}>¥{fmt(rowX.takeHome)}</Typography>
              <Typography variant="caption" sx={{ opacity: .5, fontSize: 9 }}>¥{fmt(rowX.totalPay)}</Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>round</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.85 }}>¥{fmt(rowR.takeHome)}</Typography>
              <Typography variant="caption" sx={{ opacity: .5, fontSize: 9 }}>¥{fmt(rowR.totalPay)}</Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>floor</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.85 }}>¥{fmt(rowF.takeHome)}</Typography>
              <Typography variant="caption" sx={{ opacity: .5, fontSize: 9 }}>¥{fmt(rowF.totalPay)}</Typography>
            </Stack>
          </Box>
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

        <Slider
          value={overtime} min={0} max={80} step={0.1}
          onChange={(_, v) => handleOvertimeChange(v)}
          sx={{ color: 'primary.main', mb: 0.5 }}
        />
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          {['0h', '20h', '40h', '60h', '80h'].map((l) => (
            <Typography key={l} variant="caption" color="text.secondary">{l}</Typography>
          ))}
        </Stack>

        <OvertimeInput overtime={overtime} onChange={handleOvertimeChange} />

        {/* 単価比較 */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={2} sx={{ mt: 1.5 }}>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ fontSize: 9, color: '#1565c0' }}>自由入力</Typography>
            <Typography variant="body2" color="#1565c0" fontWeight={700}>
              {parsedCustomUnit != null ? `¥${fmt(unitC)}/h → ¥${fmt(otC)}` : '—'}
            </Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>小数</Typography>
            <Typography variant="body2" color="primary.dark" fontWeight={500}>¥{unitX.toFixed(1)}/h → ¥{fmt(otX)}</Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>round</Typography>
            <Typography variant="body2" color="primary.dark" fontWeight={500}>¥{fmt(unitR)}/h → ¥{fmt(otR)}</Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>floor</Typography>
            <Typography variant="body2" color="primary.dark" fontWeight={500}>¥{fmt(unitF)}/h → ¥{fmt(otF)}</Typography>
          </Stack>
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
        <QuadAutoRow label="時間外手当" valueC={otC} valueX={otX} valueR={otR} valueF={otF} />
        {fixed.shinyateate > 0 && (
          <>
            <Divider />
            <FixedRow label="深夜手当" value={fixed.shinyateate} editMode={editMode} fieldKey="shinyateate" onEdit={editFixed} />
          </>
        )}
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>支給額合計</Typography>
          <Stack direction="row" gap={1.5}>
            <Typography variant="body2" fontWeight={700} color="#1565c0">{rowC != null ? `¥${fmt(rowC.totalPay)}` : '—'}</Typography>
            <Typography variant="body2" fontWeight={500} color="primary.dark">¥{fmt(rowX.totalPay)}</Typography>
            <Typography variant="body2" fontWeight={500} color="primary.dark" sx={{ opacity: 0.7 }}>¥{fmt(rowR.totalPay)}</Typography>
            <Typography variant="body2" fontWeight={500} color="primary.dark" sx={{ opacity: 0.5 }}>¥{fmt(rowF.totalPay)}</Typography>
          </Stack>
        </Stack>
      </SectionCard>

      {/* 控除項目 */}
      <SectionCard title="控除項目">
        <FixedRow label="健康保険"     value={fixed.kenkouhoken}  editMode={editMode} fieldKey="kenkouhoken"  onEdit={editFixed} />
        <Divider />
        <FixedRow label="厚生年金保険" value={fixed.kouseinenkin} editMode={editMode} fieldKey="kouseinenkin" onEdit={editFixed} />
        <Divider />
        <QuadAutoRow label="雇用保険" valueC={rowC?.koyou ?? null} valueX={rowX.koyou} valueR={rowR.koyou} valueF={rowF.koyou} />
        <Divider />
        <QuadAutoRow label="所得税" valueC={rowC?.shotoku ?? null} valueX={rowX.shotoku} valueR={rowR.shotoku} valueF={rowF.shotoku} />
        <Divider />
        <FixedRow label="住民税"   value={fixed.jyuuminzei} editMode={editMode} fieldKey="jyuuminzei" onEdit={editFixed} />
        <Divider />
        <FixedRow label="組合費"   value={fixed.kumiaifi}   editMode={editMode} fieldKey="kumiaifi"   onEdit={editFixed} />
        <Divider />
        <FixedRow label="食事補助" value={fixed.shokuhi}    editMode={editMode} fieldKey="shokuhi"    onEdit={editFixed} />
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>控除額合計</Typography>
          <Stack direction="row" gap={1.5}>
            <Typography variant="body2" fontWeight={700} color="#c62828">{rowC != null ? `¥${fmt(rowC.totalDed)}` : '—'}</Typography>
            <Typography variant="body2" fontWeight={500} color="error.main">¥{fmt(rowX.totalDed)}</Typography>
            <Typography variant="body2" fontWeight={500} color="error.main" sx={{ opacity: 0.7 }}>¥{fmt(rowR.totalDed)}</Typography>
            <Typography variant="body2" fontWeight={500} color="error.main" sx={{ opacity: 0.5 }}>¥{fmt(rowF.totalDed)}</Typography>
          </Stack>
        </Stack>
      </SectionCard>

    </Box>
  )
}
