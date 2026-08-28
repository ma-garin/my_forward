import { useState } from 'react'
import { Box, Card, CardContent, Typography, Stack, Divider, Button,
         Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { fmt } from '../utils/finance'
import { monthlyBalance } from '../utils/monthly'
import { loadOtherIncome, saveOtherIncome } from '../utils/ccStorage'
import AmountField from './AmountField'

export default function IncomeSummaryCard({ ym, salaryYm: salaryYmProp }) {
  const salaryYm = salaryYmProp ?? ym

  const [otherIncome, setOtherIncome] = useState(() => loadOtherIncome(salaryYm))
  const [dlgOpen, setDlgOpen]         = useState(false)
  const [dlgVal, setDlgVal]           = useState('')

  // 収入・支出の足し方は monthlyBalance 1 つ。ここで足し直すと 2枚合計や
  // 年次の振り返りと違う数字が出る（実際にそうなっていた）
  const b = monthlyBalance(salaryYm)

  if (b.salary === 0 && otherIncome === '') return null

  const otherAmt   = b.other
  const takeHome   = b.income
  const expense    = b.expense
  const balance    = b.balance
  const savingRate = b.savingRate

  const handleSave = () => {
    const raw = dlgVal === '' ? '' : dlgVal
    setOtherIncome(raw)
    saveOtherIncome(raw, salaryYm)
    setDlgOpen(false)
  }

  return (
    <>
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'var(--surface-header)', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            収支サマリー
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={0} divider={<Divider orientation="vertical" flexItem />}>
            <Stack alignItems="center" sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>手取り</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14 }}>¥{fmt(takeHome)}</Typography>
              {/* どちらの数字を見ているかが分からないと、差額の意味が変わる */}
              <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>
                {b.isActual ? '実績' : '見込み'}
              </Typography>
            </Stack>
            <Stack alignItems="center" sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>支出</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14, color: expense > takeHome ? '#c62828' : 'inherit' }}>
                ¥{fmt(expense)}
              </Typography>
            </Stack>
            <Stack alignItems="center" sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>差額</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14, color: balance >= 0 ? '#2e7d32' : '#c62828' }}>
                {balance >= 0 ? '+' : ''}¥{fmt(balance)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>
                貯蓄率 {savingRate}%
              </Typography>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1 }} />

          {/* その他収入 */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="baseline" spacing={0.75}>
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>その他収入</Typography>
              {otherAmt > 0 && (
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: '#2e7d32' }}>
                  ¥{fmt(otherAmt)}
                </Typography>
              )}
              {otherIncome === '0' && (
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>¥0</Typography>
              )}
            </Stack>
            <Button size="small" onClick={() => { setDlgVal(otherIncome); setDlgOpen(true) }}
              sx={{ fontSize: 10, minWidth: 0, px: 1, py: 0, textTransform: 'none' }}>
              {otherIncome === '' ? '追加' : '編集'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>その他収入</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <AmountField value={dlgVal} onChange={setDlgVal} label="金額（円）" allowZero autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)} size="small">キャンセル</Button>
          <Button onClick={handleSave} variant="contained" size="small">保存</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
