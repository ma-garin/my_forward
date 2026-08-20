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
const BACKSPACE_ICON = <BackspaceOutlinedIcon sx={{ fontSize: 22 }} />

/**
 * 電卓キー。
 * `instant` のキーは pointerdown で発火する（touchend → click を待たないので
 * 指を置いた瞬間に反応する）。ポインタイベント非対応環境では click に落ちる。
 * 確定系（確認）はシートを閉じるためゴーストクリックを避けて click のまま。
 * 押下値は `arg` として渡す（キーごとにクロージャを作らないので memo が効く）。
 */
const CalcKey = memo(function CalcKey({ sx, onPress, arg, disabled, instant = true, children }) {
  const firedRef = useRef(false)

  const handlePointerDown = useCallback((e) => {
    if (!instant || e.button > 0) return
    firedRef.current = true
    onPress(arg)
  }, [instant, onPress, arg])

  const handleClick = useCallback(() => {
    if (firedRef.current) { firedRef.current = false; return }
    onPress(arg)
  }, [onPress, arg])

  return (
    <Box component="button" type="button" disabled={disabled}
      onPointerDown={handlePointerDown} onClick={handleClick} sx={sx}>
      {children}
    </Box>
  )
})

/**
 * 電卓パッド。
 * 入力値は `valueRef`（呼び出し側が持つ ref）から読む。value を prop で受けると
 * 1 タップごとに props が変わって memo が必ず外れ、パッド全体が再レンダーされる。
 * 表示に使う state は演算子ハイライト用の `activeOp` だけに絞る。
 *
 * 確定キーの文言は `confirmLabel` で変えられる。金額シートは値を確定して閉じる
 * だけなので「確認」、支出入力画面はそのまま保存するので「保存」を渡す。
 */
export const CalcPad = memo(function CalcPad({ valueRef, onChange, onConfirm, disabled, confirmLabel = '確認' }) {
  const [activeOp, setActiveOp] = useState(null)

  // ハンドラは ref 経由で最新値を読むので依存ゼロ＝参照が固定される。
  // ref の更新はコミット後（キー押下より必ず前）に行う。
  const ref = useRef({ onChange, onConfirm, stored: null, op: null, fresh: false })
  useEffect(() => {
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

  const pressDigit = useCallback((d) => {
    const r = ref.current
    if (r.fresh) { r.onChange(d === '00' ? '0' : d); r.fresh = false; setActiveOp(null) }
    else {
      const cur = valueRef.current
      r.onChange((cur === '0' ? '' : (cur ?? '')) + d)
    }
  }, [valueRef])

  const pressOp = useCallback((next) => {
    const r = ref.current
    const cur = parseAmount(valueRef.current)
    if (r.stored !== null && r.op && !r.fresh) {
      const v = calc(r.stored, cur, r.op); r.stored = v; r.onChange(String(v))
    } else { r.stored = cur }
    r.op = next; r.fresh = true; setActiveOp(next)
  }, [valueRef])

  const pressBackspace = useCallback(() => {
    const cur = String(valueRef.current ?? '')
    ref.current.onChange(cur.length <= 1 ? '' : cur.slice(0, -1))
  }, [valueRef])

  const reset = (r) => { r.stored = null; r.op = null; r.fresh = false; setActiveOp(null) }

  const pressClear = useCallback(() => {
    const r = ref.current
    r.onChange(''); reset(r)
  }, [])

  const pressEquals = useCallback(() => {
    const r = ref.current
    if (r.stored !== null && r.op) {
      r.onChange(String(calc(r.stored, parseAmount(valueRef.current), r.op)))
      reset(r)
    }
  }, [valueRef])

  const pressConfirm = useCallback(() => {
    const r = ref.current
    let finalVal = valueRef.current
    if (r.stored !== null && r.op) {
      finalVal = String(calc(r.stored, parseAmount(valueRef.current), r.op))
      r.onChange(finalVal)
      reset(r)
    }
    r.onConfirm(finalVal)
  }, [valueRef])

  const numKey = (label, sx = SX_NUM) => (
    <CalcKey key={label} sx={sx} onPress={pressDigit} arg={label}>{label}</CalcKey>
  )
  const opKey = (label) => (
    <CalcKey key={label} sx={activeOp === label ? SX_OP_ON : SX_OP} onPress={pressOp} arg={label}>{label}</CalcKey>
  )

  return (
    <Box sx={SX_GRID}>
      {opKey('+')} {opKey('−')} {opKey('×')} {opKey('÷')}
      {numKey('7')} {numKey('8')} {numKey('9')}
      <CalcKey sx={SX_EQ} onPress={pressEquals}>=</CalcKey>
      {numKey('4')} {numKey('5')} {numKey('6')}
      <CalcKey sx={SX_CLEAR} onPress={pressClear}>C</CalcKey>
      {numKey('1')} {numKey('2')} {numKey('3')}
      <CalcKey sx={SX_BACK} onPress={pressBackspace}>{BACKSPACE_ICON}</CalcKey>
      {numKey('0', SX_ZERO)}
      {numKey('00')}
      <CalcKey sx={disabled ? SX_CONFIRM_OFF : SX_CONFIRM} onPress={pressConfirm} disabled={disabled} instant={false}>
        {confirmLabel}
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

  // CalcPad へは値を ref で渡す（prop で渡すと 1 タップごとに memo が外れる）。
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft })

  // onConfirm の参照も固定する（毎レンダーで作り直すとキーが再レンダーされる）。
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  const handleConfirm = useCallback((val) => {
    onChangeRef.current(String(val ?? '').replace(/[^0-9]/g, ''))
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
          <Button size="small" onClick={() => handleConfirm(draft)}
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
        <CalcPad valueRef={draftRef} onChange={setDraft} onConfirm={handleConfirm} disabled={!allowZero && parseAmount(draft) <= 0} />
      </Drawer>
    </Box>
  )
}
