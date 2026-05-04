import { Box, Card, CardContent, Typography, Stack, Divider } from '@mui/material'
import { fmt, getSimulatedTakeHome } from '../utils/finance'

function getTakeHomeWithCustom() {
  try {
    const s = localStorage.getItem('salary_simulation')
    if (!s) return getSimulatedTakeHome()
    const saved = JSON.parse(s)
    const base = getSimulatedTakeHome()
    const customPay = (saved.payItems ?? []).reduce((sum, x) => sum + x.amount, 0)
    const customDed = (saved.dedItems ?? []).reduce((sum, x) => sum + x.amount, 0)
    return base + customPay - customDed
  } catch {
    return 0
  }
}

export default function IncomeSummaryCard({ fixedList, varList }) {
  const takeHome = getTakeHomeWithCustom()
  if (takeHome === 0) return null

  const expense = [...fixedList, ...varList]
    .filter(x => x.sign !== 1)
    .reduce((s, x) => s + x.amount, 0)

  const balance = takeHome - expense
  const savingRate = takeHome > 0 ? Math.round((balance / takeHome) * 100) : 0

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          収支サマリー
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={0} divider={<Divider orientation="vertical" flexItem />}>
          <Stack alignItems="center" sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>手取り</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14 }}>¥{fmt(takeHome)}</Typography>
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
      </CardContent>
    </Card>
  )
}
