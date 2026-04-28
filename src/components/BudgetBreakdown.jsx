import { useState, useEffect } from 'react'
import { Box, Card, Typography, Stack, Divider, IconButton, Button, TextField, Chip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { fmt } from '../utils/finance'
import {
  CARDS, LIVING_CATEGORIES, loadWeeklyBudget,
  sumLiving, countFridaysUntil,
  loadLivingOverride, saveLivingOverride,
  BORDER_LIGHT,
} from '../utils/ccStorage'

export default function BudgetBreakdown({ cardId, ym, limit, fixedTotal, varTotal, varList, onLimitChange }) {
  const [editMode,      setEditMode]      = useState(false)
  const [limitVal,      setLimitVal]      = useState(String(limit))
  const [livingOverride, setLivingOverride] = useState(() => loadLivingOverride(cardId, ym))
  const [livingEditVal,  setLivingEditVal]  = useState('')

  useEffect(() => { setLimitVal(String(limit)) }, [limit])
  useEffect(() => {
    setLivingOverride(loadLivingOverride(cardId, ym))
    setLivingEditVal('')
  }, [cardId, ym])

  if (limit === 0) return null

  const isJcb = cardId === 'jcb'

  let livingAuto = 0
  if (isJcb) {
    const [vy, vm] = ym.split('-').map(Number)
    const fridayCount = countFridaysUntil(
      new Date(vy, vm - 1, CARDS.jcb.cutoffDay),
      new Date(vy, vm,     CARDS.jcb.cutoffDay),
    )
    livingAuto = fridayCount * loadWeeklyBudget()
  }
  const livingBudget   = isJcb ? (livingOverride ?? livingAuto) : 0
  const isOverridden   = livingOverride != null
  const livingActual   = isJcb ? sumLiving(varList ?? []) : 0
  const otherVarActual = isJcb ? varTotal - livingActual : varTotal

  const effectiveLimit  = parseFloat(limitVal) || limit
  const fixedAfter      = effectiveLimit - fixedTotal
  const planAfterLiving = fixedAfter - livingBudget
  const actAfterLiving  = fixedAfter - livingActual
  const planBalance     = planAfterLiving - otherVarActual
  const actBalance      = actAfterLiving  - otherVarActual
  const smbcBalance     = effectiveLimit  - fixedTotal - varTotal

  const handleSave = () => {
    const parsed = parseFloat(limitVal)
    if (!isNaN(parsed) && parsed > 0) onLimitChange(String(parsed))
    setEditMode(false)
  }

  const amtText = (v) => v >= 0 ? `¥${fmt(v)}` : `−¥${fmt(-v)}`
  const balBg   = (v) => v >= 0 ? '#e8f5e9' : '#ffebee'
  const balCol  = (v) => v >= 0 ? '#1b5e20' : '#b71c1c'

  const HDR = { fontSize: 10, fontWeight: 700, color: 'text.disabled', letterSpacing: .5, textAlign: 'right' }
  const VAL = { fontSize: 13, fontWeight: 500, textAlign: 'right' }

  const Row = ({ sign, label, plan, actual, subtotal, subLabel }) => (
    <Stack direction="row" alignItems="center"
      sx={{
        py: 0.65, px: subtotal ? 1 : 0,
        bgcolor: subtotal ? '#f5f5f5' : 'transparent',
        borderRadius: subtotal ? 1 : 0,
        borderBottom: subtotal ? 'none' : BORDER_LIGHT,
        my: subtotal ? 0.25 : 0,
      }}>
      <Box sx={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {sign && <Typography sx={{ fontSize: 13, color: 'text.disabled', minWidth: 14 }}>{sign}</Typography>}
        <Typography sx={{ fontSize: 13, fontWeight: subtotal ? 600 : 400, color: subtotal ? 'text.primary' : 'text.secondary' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ flex: 1, ...VAL, fontWeight: subtotal ? 700 : 500, color: subtotal ? 'primary.main' : 'inherit' }}>
        {amtText(plan)}
      </Typography>
      {isJcb && (
        <Typography sx={{ flex: 1, ...VAL, fontWeight: subtotal ? 700 : 500, color: subtotal ? 'primary.main' : 'inherit' }}>
          {amtText(actual)}
        </Typography>
      )}
    </Stack>
  )

  return (
    <Card sx={{ mb: 1.5, px: 2, pt: 1, pb: 1.5 }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, fontWeight: 600, letterSpacing: .5 }}>予算内訳</Typography>
        {editMode ? (
          <Stack direction="row" alignItems="center" gap={0.75}>
            <TextField size="small" type="number" value={limitVal}
              onChange={(e) => setLimitVal(e.target.value)}
              inputProps={{ min: 0, style: { textAlign: 'right', width: 90, fontSize: 12 } }}
              sx={{ '& .MuiInputBase-root': { height: 26 } }} />
            <Button size="small" onClick={handleSave} variant="contained"
              sx={{ fontSize: 11, py: 0.25, minWidth: 0, px: 1.5 }}>保存</Button>
          </Stack>
        ) : (
          <IconButton size="small" aria-label="上限を編集" onClick={() => { setEditMode(true); setLivingEditVal(String(livingBudget)) }} sx={{ p: 0.75 }}>
            <EditIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </IconButton>
        )}
      </Stack>

      {/* 列ヘッダー */}
      <Stack direction="row" sx={{ pb: 0.4, borderBottom: '2px solid #e0e0e0', mb: 0.25 }}>
        <Box sx={{ flex: 1.6 }} />
        <Typography sx={{ flex: 1, ...HDR }}>予定</Typography>
        {isJcb && <Typography sx={{ flex: 1, ...HDR }}>実績</Typography>}
      </Stack>

      <Row label="月間上限" plan={effectiveLimit} actual={effectiveLimit} />
      <Row sign="−" label="固定費" plan={fixedTotal} actual={fixedTotal} />
      <Row label="固定費後" plan={fixedAfter} actual={fixedAfter} subtotal />

      {/* 生活費（JCBのみ） */}
      {isJcb && (
        editMode ? (
          <Stack direction="row" alignItems="center" sx={{ py: 0.65, borderBottom: BORDER_LIGHT }}>
            <Box sx={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 13, color: 'text.disabled', minWidth: 14 }}>−</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>生活費</Typography>
              {isOverridden && <Chip label="手動" size="small" sx={{ height: 14, fontSize: 8, bgcolor: '#e3f2fd', color: '#1565c0' }} />}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
              <TextField size="small" type="number" value={livingEditVal}
                onChange={(e) => {
                  setLivingEditVal(e.target.value)
                  const n = parseInt(e.target.value, 10)
                  if (!isNaN(n) && n >= 0) { setLivingOverride(n); saveLivingOverride(cardId, ym, n) }
                }}
                inputProps={{ min: 0, style: { textAlign: 'right', width: 68, fontSize: 12 } }}
                sx={{ '& .MuiInputBase-root': { height: 26 } }} />
              {isOverridden && (
                <Button size="small" onClick={() => {
                  setLivingOverride(null); saveLivingOverride(cardId, ym, null)
                  setLivingEditVal(String(livingAuto))
                }} sx={{ fontSize: 9, minWidth: 0, px: 0.5, py: 0, color: 'text.disabled' }}>自動</Button>
              )}
            </Box>
            <Typography sx={{ flex: 1, ...VAL }}>¥{fmt(livingActual)}</Typography>
          </Stack>
        ) : (
          <Row sign="−" label="生活費" plan={livingBudget} actual={livingActual} />
        )
      )}

      {isJcb && <Row label="生活費後" plan={planAfterLiving} actual={actAfterLiving} subtotal />}

      <Row sign="−" label={isJcb ? 'その他変動費' : '変動費'} plan={otherVarActual} actual={otherVarActual} />

      <Divider sx={{ mt: 0.5, mb: 0.75 }} />
      {isJcb ? (
        <Stack direction="row" gap={1}>
          {[{ label: '残高（予定）', val: planBalance }, { label: '残高（実績）', val: actBalance }].map(({ label, val }) => (
            <Box key={label} sx={{ flex: 1, bgcolor: balBg(val), borderRadius: 1.5, px: 1, py: 0.75 }}>
              <Typography sx={{ fontSize: 10, color: balCol(val), fontWeight: 600, mb: 0.25 }}>{label}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: balCol(val) }}>{amtText(val)}</Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ bgcolor: balBg(smbcBalance), borderRadius: 1.5, px: 1.5, py: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: balCol(smbcBalance) }}>残高</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: balCol(smbcBalance) }}>{amtText(smbcBalance)}</Typography>
          </Stack>
        </Box>
      )}
    </Card>
  )
}
