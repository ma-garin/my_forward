import { useMemo } from 'react'
import { Box, Card, CardContent, Typography, Stack } from '@mui/material'
import { loadFixed, loadVar } from '../utils/ccStorage'
import { isActiveForYm, fmt } from '../utils/finance'

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyTrendCard({ currentBillingYm }) {
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addMonth(currentBillingYm, -5 + i))
  }, [currentBillingYm])

  const data = useMemo(() => {
    return months.map(ym => {
      const jFixed  = loadFixed('jcb').filter(x => isActiveForYm(x, ym))
      const jVar    = loadVar('jcb', ym)
      const sFixed  = loadFixed('smbc').filter(x => isActiveForYm(x, ym))
      const sVar    = loadVar('smbc', ym)
      const total   = [...jFixed, ...jVar, ...sFixed, ...sVar]
        .filter(x => x.sign !== 1)
        .reduce((s, x) => s + x.amount, 0)
      const [, m]   = ym.split('-').map(Number)
      return { ym, month: m, total }
    })
  }, [months])

  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const hasAny   = data.some(d => d.total > 0)
  if (!hasAny) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          支出トレンド（6ヶ月）
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: 100 }}>
          {data.map(({ ym, month, total }) => {
            const isCurrent = ym === currentBillingYm
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            return (
              <Stack key={ym} alignItems="center" sx={{ flex: 1 }}>
                {total > 0 && (
                  <Typography sx={{ fontSize: 8, color: isCurrent ? 'primary.main' : 'text.secondary', mb: 0.3, fontWeight: isCurrent ? 700 : 400 }}>
                    ¥{total >= 10000 ? `${Math.round(total / 1000)}k` : fmt(total)}
                  </Typography>
                )}
                <Box sx={{
                  width: '100%',
                  height: `${Math.max(pct, total > 0 ? 4 : 0)}%`,
                  bgcolor: isCurrent ? 'primary.main' : '#b0bec5',
                  borderRadius: '3px 3px 0 0',
                  minHeight: total > 0 ? 4 : 0,
                  transition: 'height 0.3s',
                }} />
                <Typography sx={{ fontSize: 9, color: isCurrent ? 'primary.main' : 'text.secondary', mt: 0.4, fontWeight: isCurrent ? 700 : 400 }}>
                  {month}月
                </Typography>
              </Stack>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}
