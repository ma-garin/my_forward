import { useMemo } from 'react'
import { Box, Card, CardContent, Typography, Stack } from '@mui/material'
import { loadFixed, loadVar } from '../utils/ccStorage'
import { isActiveForYm, fmt } from '../utils/finance'
import { useAfterPaint } from '../utils/useAfterPaint'
import CardHeaderBar from './CardHeaderBar'

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyTrendCard({ currentBillingYm }) {
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addMonth(currentBillingYm, -5 + i))
  }, [currentBillingYm])

  // 6 ヶ月 × 2 カードぶんの localStorage 読み込みは重い。タブを開いた瞬間の
  // 描画を止めないよう、最初の描画のあとに計算する。
  // 固定費リストはループの外で 1 回だけロードする（月ごとに再 parse しない）。
  const data = useAfterPaint(() => {
    const jFixedAll = loadFixed('jcb')
    const sFixedAll = loadFixed('smbc')
    return months.map(ym => {
      const total = [
        ...jFixedAll.filter(x => isActiveForYm(x, ym)),
        ...loadVar('jcb', ym),
        ...sFixedAll.filter(x => isActiveForYm(x, ym)),
        ...loadVar('smbc', ym),
      ].filter(x => x.sign !== 1).reduce((s, x) => s + x.amount, 0)
      return { ym, month: Number(ym.split('-')[1]), total }
    })
  }, [months])

  if (!data) return null
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  if (!data.some(d => d.total > 0)) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar title="支出トレンド（6ヶ月）" />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: 100 }}>
          {data.map(({ ym, month, total }) => {
            const isCurrent = ym === currentBillingYm
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            return (
              <Stack key={ym} alignItems="center" sx={{ flex: 1 }}>
                {total > 0 && (
                  <Typography sx={{ fontSize: 8, color: isCurrent ? 'primary.main' : 'text.secondary', mb: 0.3, fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap' }}>
                    ¥{fmt(total)}
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
