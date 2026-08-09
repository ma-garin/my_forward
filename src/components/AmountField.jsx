import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Box, Typography, TextField, Button, InputAdornment, Drawer, Stack } from '@mui/material'
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined'
import { fmt } from '../utils/finance'
import { OPAQUE_SHEET } from '../theme'

export function fmtInput(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ja-JP')
}

export function parseAmount(raw) {
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

// ─── 電卓パッド ─────────────────────────────────────────────

// sx をモジュール定数として持つ（毎レンダーで新しいオブジェクトを作らない）。
const KEY_BASE = {
  minWidth: 0,
  border: 'none',
  borderRadius: 0,
  py: 1.6,
  px: 0,
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.4,
  cursor: 'pointer',
  userSelect: 'none',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:active': { filter: 'brightness(0.82)' },
  '@media (hover: hover)': { '&:hover': { filter: 'brightness(1.08)' } },
}
const key = (bgcolor, extra) => ({ ...KEY_BASE, bgcolor, ...extra })

const SX_NUM         = key('#546e7a')
const SX_ZERO        = key('#546e7a', { gridColumn: 'span 2' })
const SX_OP          = key('#37474f', { fontSize: 22 })
const SX_OP_ON       = key('#0288d1', { fontSize: 22 })
const SX_EQ          = key('#0288d1', { fontSize: 24, fontWeight: 700 })
const SX_CLEAR       = key('#78909c', { fontWeight: 700 })
const SX_BACK        = key('#37474f')
const SX_CONFIRM     = key('#c62828', { fontSize: 18, fontWeight: 700 })
const SX_CONFIRM_OFF = key('#455a64', { fontSize: 18, fontWeight: 700, cursor: 'default' })
const SX_GRID = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', bgcolor: '#263238', overflow: 'hidden' }

/**
 * 電卓キー。
 * `instant` のキーは pointerdown で発火する（touchend → click を待たないので
 * 指を置いた瞬間に反応する）。ポインタイベント非対応環境では click に落ちる。
 * 確定系（確認）はシートを閉じるためゴーストクリックを避けて click のまま。
 */
const CalcKey = memo(function CalcKey({ sx, onPress, disabled, instant = true, children }) {
  const firedRef = useRef(false)

  const handlePointerDown = useCallback((e) => {
    if (!instant || e.button > 0) return
    firedRef.current = true
    onPress()
  }, [instant, onPress])

  const handleClick = useCallback(() => {
    if (firedRef.current) { firedRef.current = false; return }
    onPress()
  }, [onPress])

  return (
    <Box component="button" type="button" disabled={disabled}
      onPointerDown={handlePointerDown} onClick={handleClick} sx={sx}>
      {children}
    </Box>
  )
})

export const CalcPad = memo(function CalcPad({ value, onChange, onConfirm, disabled }) {
  // 表示に必要な状態だけ state に持つ（演算子ハイライト用）。
  const [op, setOp]       = useState(null)
  const [fresh, setFresh] = useState(false)

  // ハンドラは ref 経由で最新値を読むので依存ゼロ＝参照が固定される。
  // これで 20 個のキーが memo でバイパスされ、1 タップの再レンダーが最小になる。
  // ref の更新はコミット後（キー押下より必ず前）に行う。
  const ref = useRef({ value, onChange, onConfirm, stored: null, op: null, fresh: false })
  useEffect(() => {
    ref.current.value     = value
    ref.current.onChange  = onChange
    ref.current.onConfirm = onConfirm
  })

  const calc = (a, b, operator) => {
    switch (operator) {
      case '+': return a + b
      case '−': return a - b
      case '×': return a * b
      case '÷': return b !== 0 ? Math.floor(a / b) : a
      default:  return b
    }
  }

  const putOp = useCallback((next) => { ref.current.op = next; setOp(next) }, [])
  const putFresh = useCallback((v) => { ref.current.fresh = v; setFresh(v) }, [])

  const pressDigit = useCallback((d) => {
    const r = ref.current
    if (r.fresh) { r.onChange(d === '00' ? '0' : d); putFresh(false) }
    else { r.onChange((r.value === '0' ? '' : (r.value ?? '')) + d) }
  }, [putFresh])

  const pressOp = useCallback((next) => {
    const r = ref.current
    const cur = parseAmount(r.value)
    if (r.stored !== null && r.op && !r.fresh) {
      const v = calc(r.stored, cur, r.op); r.stored = v; r.onChange(String(v))
    } else { r.stored = cur }
    putOp(next); putFresh(true)
  }, [putOp, putFresh])

  const pressBackspace = useCallback(() => {
    const s = String(ref.current.value ?? '')
    ref.current.onChange(s.length <= 1 ? '' : s.slice(0, -1))
  }, [])

  const pressClear = useCallback(() => {
    const r = ref.current
    r.onChange(''); r.stored = null; putOp(null); putFresh(false)
  }, [putOp, putFresh])

  const pressEquals = useCallback(() => {
    const r = ref.current
    if (r.stored !== null && r.op) {
      r.onChange(String(calc(r.stored, parseAmount(r.value), r.op)))
      r.stored = null; putOp(null); putFresh(false)
    }
  }, [putOp, putFresh])

  const pressConfirm = useCallback(() => {
    const r = ref.current
    let finalVal = r.value
    if (r.stored !== null && r.op) {
      finalVal = String(calc(r.stored, parseAmount(r.value), r.op))
      r.onChange(finalVal)
      r.stored = null; putOp(null); putFresh(false)
    }
    r.onConfirm(finalVal)
  }, [putOp, putFresh])

  // 数字・演算子ごとの押下ハンドラも参照を固定する。
  const digitHandlers = useRef({})
  const digitPress = (d) => (digitHandlers.current[d] ??= () => pressDigit(d))
  const opHandlers = useRef({})
  const opPress = (o) => (opHandlers.current[o] ??= () => pressOp(o))

  const numKey = (label, sx = SX_NUM) => (
    <CalcKey key={label} sx={sx} onPress={digitPress(label)}>{label}</CalcKey>
  )
  const opKey = (label) => (
    <CalcKey key={label} sx={op === label && fresh ? SX_OP_ON : SX_OP} onPress={opPress(label)}>{label}</CalcKey>
  )

  return (
    <Box sx={SX_GRID}>
      {opKey('+')} {opKey('−')} {opKey('×')} {opKey('÷')}
      {numKey('7')} {numKey('8')} {numKey('9')}
      <CalcKey sx={SX_EQ} onPress={pressEquals}>=</CalcKey>
      {numKey('4')} {numKey('5')} {numKey('6')}
      <CalcKey sx={SX_CLEAR} onPress={pressClear}>C</CalcKey>
      {numKey('1')} {numKey('2')} {numKey('3')}
      <CalcKey sx={SX_BACK} onPress={pressBackspace}>
        <BackspaceOutlinedIcon sx={{ fontSize: 22 }} />
      </CalcKey>
      {numKey('0', SX_ZERO)}
      {numKey('00')}
      <CalcKey sx={disabled ? SX_CONFIRM_OFF : SX_CONFIRM} onPress={pressConfirm} disabled={disabled} instant={false}>
        確認
      </CalcKey>
    </Box>
  )
})

// ─── 金額入力フィールド ─────────────────────────────────────

const SHEET_PAPER_SX = { borderRadius: '16px 16px 0 0', px: 2, pt: 1.5, pb: 3, maxWidth: 600, mx: 'auto', ...OPAQUE_SHEET }
const SHEET_TIMEOUT = { enter: 220, exit: 180 }

export default function AmountField({ value, onChange, large = false, dark = false, label, placeholder = '0', autoFocus = false, inputSx = {}, allowZero = false }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const handleOpen = () => {
    document.activeElement?.blur()
    const n = parseAmount(value)
    setDraft(allowZero ? String(n) : String(n || ''))
    setOpen(true)
  }

  // CalcPad の onConfirm は参照を固定する（毎レンダーで作り直すとキーが再レンダーされる）。
  const latest = useRef({ draft, onChange })
  useEffect(() => { latest.current = { draft, onChange } })
  const handleConfirm = useCallback((val) => {
    const { draft: d, onChange: cb } = latest.current
    cb(String(val ?? d).replace(/[^0-9]/g, ''))
    setOpen(false)
  }, [])

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

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        disableScrollLock
        transitionDuration={SHEET_TIMEOUT}
        sx={{ zIndex: 1500 }}
        PaperProps={{ sx: SHEET_PAPER_SX }}
      >
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ width: 36, height: 4, bgcolor: '#ccc', borderRadius: 2, mx: 'auto' }} />
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5, minHeight: 24 }}>
          {label
            ? <Typography variant="caption" color="text.secondary">{label}</Typography>
            : <Box />}
          <Button size="small" onClick={() => handleConfirm(undefined)}
            sx={{ fontSize: 13, fontWeight: 600, minWidth: 0, px: 1, py: 0, color: 'primary.main', textTransform: 'none' }}>
            完了
          </Button>
        </Stack>
        <Box sx={{ bgcolor: '#333', borderRadius: '8px 8px 0 0', px: 2, py: 1.5, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: 20, mr: 0.5 }}>¥</Typography>
          <Typography sx={{ color: '#fff', fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 44 }}>
            {parseAmount(draft) > 0 ? fmt(parseAmount(draft)) : '0'}
          </Typography>
        </Box>
        <CalcPad value={draft} onChange={setDraft} onConfirm={handleConfirm} disabled={!allowZero && parseAmount(draft) <= 0} />
      </Drawer>
    </Box>
  )
}
