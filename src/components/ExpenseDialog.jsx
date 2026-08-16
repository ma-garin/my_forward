import { useState } from 'react'
import {
  Box, Typography, Stack, Chip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import { CARD_LIST, SPEND_TYPES, SPEND_TYPE_COLORS } from '../utils/ccStorage'
import { ymStr } from '../utils/finance'
import AmountField, { parseAmount } from './AmountField'

// 固定費・変動費・カテゴリ別集計のいずれからも同じダイアログで編集する。
// （画面ごとに別フォームを持つと入力方法が食い違うため、ここに一本化する）

export default function ExpenseDialog({ open, onClose, onSave, initial, title, categories, cardId, isFixed }) {
  const [card,           setCard]           = useState(cardId)
  const [name,           setName]           = useState(initial?.name           ?? '')
  const [payee,          setPayee]          = useState(initial?.payee          ?? '')
  const [amount,         setAmount]         = useState(initial?.amount         ?? '')
  const [category,       setCategory]       = useState(initial?.category       ?? categories[0] ?? 'その他')
  const [date,           setDate]           = useState(initial?.date           ?? '')
  const [day,            setDay]            = useState(initial?.day            ?? '')
  const [startYm,        setStartYm]        = useState(initial?.startYm        ?? '')
  const [spendType,      setSpendType]      = useState(initial?.spendType      ?? '消費')
  const [recurrence,     setRecurrence]     = useState(initial?.recurrence     ?? 'monthly')
  const [intervalMonths, setIntervalMonths] = useState(initial?.intervalMonths ?? 2)
  const [baseYm,         setBaseYm]         = useState(initial?.baseYm         ?? '')
  const [targetYm,       setTargetYm]       = useState(initial?.targetYm       ?? '')


  const handleSave = () => {
    const a = parseAmount(amount)
    if (!name.trim() || a <= 0) return
    const d = parseInt(day, 10)
    const dayField = (!isNaN(d) && d >= 1 && d <= 31) ? d : undefined
    let recurrenceFields = {}
    if (isFixed) {
      if (recurrence === 'once') {
        recurrenceFields = { recurrence: 'once', targetYm: targetYm || undefined }
      } else if (recurrence === 'interval') {
        recurrenceFields = { recurrence: 'interval', intervalMonths: parseInt(intervalMonths, 10) || 2, baseYm: baseYm || undefined }
      } else {
        recurrenceFields = { recurrence: 'monthly', startYm: startYm || undefined }
      }
    }
    onSave({
      cardId: card,
      name: name.trim(), payee: payee.trim(), amount: a, category,
      // 固定費は消費分類を持たない（既存データに残っていても保存時に落とす）
      ...(isFixed
        ? { spendType: undefined, day: dayField, ...recurrenceFields }
        : { spendType, date }),
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {/* 消費分類は変動費のみ。固定費は分類の対象外とする。
              最初に選ぶ項目なのでフォームの先頭に置く。 */}
          {!isFixed && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12, minWidth: 52 }}>消費分類</Typography>
              <Stack direction="row" gap={0.75}>
                {SPEND_TYPES.map(t => (
                  <Box key={t} onClick={() => setSpendType(t)} sx={{
                    px: 1.5, py: 0.5, borderRadius: 2, cursor: 'pointer', fontSize: 12, userSelect: 'none',
                    bgcolor: spendType === t ? SPEND_TYPE_COLORS[t] : '#f5f5f5',
                    color: spendType === t ? '#fff' : 'text.secondary',
                    fontWeight: spendType === t ? 700 : 400,
                  }}>{t}</Box>
                ))}
              </Stack>
            </Stack>
          )}
          {/* 支払い方法（カード）。編集時も別カードへ付け替えられる。 */}
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12, minWidth: 52 }}>カード</Typography>
            <Stack direction="row" gap={0.75}>
              {CARD_LIST.map(c => (
                <Chip key={c.id} label={c.shortName} size="small" onClick={() => setCard(c.id)}
                  sx={{
                    fontWeight: 600, fontSize: 12,
                    bgcolor: card === c.id ? c.color : 'transparent',
                    color: card === c.id ? '#fff' : 'text.secondary',
                    border: `1px solid ${c.color}`,
                  }} />
              ))}
            </Stack>
          </Stack>
          {!isFixed && (
            <TextField label="日付" type="date" size="small" fullWidth
              InputLabelProps={{ shrink: true }}
              value={date} onChange={(e) => setDate(e.target.value)} />
          )}
          {isFixed && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>繰り返し</InputLabel>
                <Select value={recurrence} label="繰り返し" onChange={(e) => setRecurrence(e.target.value)}>
                  <MenuItem value="monthly">毎月</MenuItem>
                  <MenuItem value="interval">各月（N ヶ月ごと）</MenuItem>
                  <MenuItem value="once">特定月のみ</MenuItem>
                </Select>
              </FormControl>
              <TextField label="支払日" type="date" size="small" fullWidth
                InputLabelProps={{ shrink: true }}
                value={(() => {
                  if (!day) return ''
                  const now = new Date()
                  return `${ymStr(now.getFullYear(), now.getMonth() + 1)}-${String(day).padStart(2, '0')}`
                })()}
                onChange={(e) => {
                  const d = e.target.value ? parseInt(e.target.value.slice(8), 10) : ''
                  setDay(isNaN(d) ? '' : String(d))
                }} />
              {recurrence === 'monthly' && (
                <TextField label="開始年月" type="month" size="small" fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={startYm}
                  onChange={(e) => setStartYm(e.target.value)}
                  helperText="未設定の場合は全ての月に反映されます" />
              )}
              {recurrence === 'interval' && (
                <Stack direction="row" spacing={1.5}>
                  <TextField label="間隔（ヶ月）" type="number" size="small" sx={{ flex: 1 }}
                    inputProps={{ min: 2, max: 12 }}
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                    helperText="例: 3 → 3ヶ月ごと" />
                  <TextField label="基準月" type="month" size="small" sx={{ flex: 1 }}
                    InputLabelProps={{ shrink: true }}
                    value={baseYm}
                    onChange={(e) => setBaseYm(e.target.value)}
                    helperText="該当する月を1つ指定" />
                </Stack>
              )}
              {recurrence === 'once' && (
                <TextField label="対象月" type="month" size="small" fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={targetYm}
                  onChange={(e) => setTargetYm(e.target.value)}
                  helperText="この月だけに反映されます" />
              )}
            </>
          )}
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>カテゴリ</InputLabel>
              <Select value={categories.includes(category) ? category : (categories[0] ?? '')}
                label="カテゴリ" onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="支払先" size="small" sx={{ flex: 1 }} placeholder="例: Google"
              value={payee} onChange={(e) => setPayee(e.target.value)} />
          </Stack>
          <TextField label="項目名" size="small" fullWidth placeholder="例: YouTube Premium"
            value={name} onChange={(e) => setName(e.target.value)} />
          <AmountField label="金額" value={String(amount)} onChange={setAmount} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">キャンセル</Button>
        <Button onClick={handleSave} variant="contained" size="small"
          disabled={!name.trim() || parseAmount(amount) <= 0}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
