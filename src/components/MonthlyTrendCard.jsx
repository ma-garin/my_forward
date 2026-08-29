import { useMemo } from 'react'
import { Box, Card, CardContent, Typography, Stack } from '@mui/material'
import { CARD_LIST, loadFixed, loadVar } from '../utils/ccStorage'
import { isActiveForYm, fmt, countsAsSpending } from '../utils/finance'
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

  // 6 ヶ月 × 全カードぶんの localStorage 読み込みは重い。タブを開いた瞬間の
  // 描画を止めないよう、最初の描画のあとに計算する。
  // 固定費リストはループの外で 1 回だけロードする（月ごとに再 parse しない）。
  const data = useAfterPaint(() => {
    const fixedAll = CARD_LIST.map((c) => ({ id: c.id, list: loadFixed(c.id) }))
    const totalOf = (ym) => fixedAll.flatMap(({ id, list }) => [
      ...list.filter(x => isActiveForYm(x, ym)),
      ...loadVar(id, ym),
    ]).filter((x) => x.sign !== 1 && countsAsSpending(x)).reduce((s, x) => s + x.amount, 0)

    return months.map(ym => ({
      ym,
      month: Number(ym.split('-')[1]),
      total: totalOf(ym),
      // 前年の同じ月。季節の出費（帰省・保険の年払い）は前月と比べても
      // 意味がないので、去年の同じ月と並べる
      lastYear: totalOf(addMonth(ym, -12)),
    }))
  }, [months])

  if (!data) return null
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  if (!data.some(d => d.total > 0)) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar title="支出トレンド（6ヶ月）" />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="stretch" spacing={0.5} sx={{ height: 100 }}>
          {data.map(({ ym, month, total, lastYear }) => {
            const isCurrent = ym === currentBillingYm
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            const lastPct = maxTotal > 0 ? (lastYear / maxTotal) * 100 : 0
            return (
              <Stack key={ym} alignItems="center" justifyContent="flex-end" sx={{ flex: 1, height: '100%' }}>
                {total > 0 && (
                  <Typography sx={{ fontSize: 8, color: isCurrent ? 'primary.main' : 'text.secondary', mb: 0.3, fontWeight: isCurrent ? 700 : 400 }}>
                    ¥{total >= 10000 ? `${Math.round(total / 1000)}k` : fmt(total)}
                  </Typography>
                )}
                {/* 棒 = 今年。細い横線 = 前年の同じ月（超えたか下回ったかが一目で分かる） */}
                <Box sx={{ position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <Box sx={{
                    width: '100%',
                    height: `${Math.max(pct, total > 0 ? 4 : 0)}%`,
                    bgcolor: isCurrent ? 'primary.main' : '#b0bec5',
                    borderRadius: '3px 3px 0 0',
                    minHeight: total > 0 ? 4 : 0,
                    transition: 'height 0.3s',
                  }} />
                  {lastYear > 0 && (
                    <Box sx={{
                      position: 'absolute', left: 0, right: 0,
                      bottom: `${lastPct}%`, height: 0,
                      borderTop: '1px dashed', borderColor: 'text.disabled',
                    }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: 9, color: isCurrent ? 'primary.main' : 'text.secondary', mt: 0.4, fontWeight: isCurrent ? 700 : 400 }}>
                  {month}月
                </Typography>
              </Stack>
            )
          })}
        </Stack>

        {/* 前年同月比。点線が去年の同じ月 */}
        {(() => {
          const cur = data.find((d) => d.ym === currentBillingYm) ?? data[data.length - 1]
          if (!cur?.lastYear) {
            return (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, fontSize: 10 }}>
                点線は前年の同じ月（去年のデータがある月に出ます）
              </Typography>
            )
          }
          const diff = cur.total - cur.lastYear
          const rate = Math.round((diff / cur.lastYear) * 100)
          return (
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                前年同月（{cur.month}月）¥{fmt(cur.lastYear)}
              </Typography>
              <Typography variant="caption" sx={{
                fontWeight: 700,
                color: diff === 0 ? 'text.secondary' : diff > 0 ? 'error.main' : 'success.main',
              }}>
                {diff >= 0 ? '+' : '−'}¥{fmt(Math.abs(diff))}（{diff >= 0 ? '+' : '−'}{Math.abs(rate)}%）
              </Typography>
            </Stack>
          )
        })()}
      </CardContent>
    </Card>
  )
}
