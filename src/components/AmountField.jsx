import { useState } from 'react'
import { Box, Typography, TextField, Button, InputAdornment } from '@mui/material'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import { fmt } from '../utils/finance'

export function fmtInput(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ja-JP')
}

export function parseAmount(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

// ─── 電卓パッド ─────────────────────────────────────────────

export function CalcPad({ value, onChange, onConfirm, disabled }) {
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

  const BASE = { minWidth: 0, fontSize: 20, fontWeight: 500, borderRadius: 0, py: 1.6, color: '#fff', border: 'none' }
  const bg   = (c) => ({ bgcolor: c, '&:hover': { bgcolor: c, filter: 'brightness(1.1)' }, '&:active': { filter: 'brightness(0.85)' } })
  const numBtn = (label, handler) => (
    <Button key={label} onClick={handler ?? (() => pressDigit(label))} sx={{ ...BASE, ...bg('#546e7a') }}>{label}</Button>
  )
  const opBtn = (label) => (
    <Button key={label} onClick={() => pressOp(label)}
      sx={{ ...BASE, ...bg(op === label && fresh ? '#0288d1' : '#37474f'), fontSize: 22 }}>{label}</Button>
  )

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', bgcolor: '#263238', overflow: 'hidden' }}>
      {opBtn('+')} {opBtn('−')} {opBtn('×')} {opBtn('÷')}
      {numBtn('7')} {numBtn('8')} {numBtn('9')}
      <Button onClick={pressEquals} sx={{ ...BASE, ...bg('#0288d1'), fontSize: 24, fontWeight: 700 }}>=</Button>
      {numBtn('4')} {numBtn('5')} {numBtn('6')}
      <Button onClick={pressClear} sx={{ ...BASE, ...bg('#78909c'), fontWeight: 700 }}>C</Button>
      {numBtn('1')} {numBtn('2')} {numBtn('3')}
      <Button onClick={pressBackspace} sx={{ ...BASE, ...bg('#37474f') }}>
        <BackspaceOutlinedIcon sx={{ fontSize: 22 }} />
      </Button>
      <Button onClick={() => pressDigit('0')} sx={{ ...BASE, ...bg('#546e7a'), gridColumn: 'span 2' }}>0</Button>
      {numBtn('00')}
      <Button onClick={pressConfirm} disabled={disabled}
        sx={{ ...BASE, ...bg(disabled ? '#455a64' : '#c62828'), fontWeight: 700, fontSize: 18 }}>
        確認
      </Button>
    </Box>
  )
}

// ─── 金額入力フィールド ─────────────────────────────────────

export default function AmountField({ value, onChange, large = false, dark = false, label, placeholder = '0', autoFocus = false, inputSx = {} }) {
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
        <Box sx={{ bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
          <Typography sx={{ color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 44 }}>
            {parseAmount(draft) > 0 ? fmt(parseAmount(draft)) : '0'}
          </Typography>
        </Box>
        <CalcPad value={draft} onChange={setDraft} onConfirm={handleConfirm} disabled={parseAmount(draft) <= 0} />
      </SwipeableDrawer>
    </Box>
  )
}
