import { Box, Typography, Stack } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { fmt } from '../utils/finance'

/**
 * 純資産の推移（折れ線）。
 *
 * 記録は月に 1 点だけなので、点が 2 つ未満のうちは線にならない＝出さない。
 * 金額の桁が大きく、上下の幅は小さいので、0 起点ではなく
 * 実際の最小〜最大に合わせて引く（0 から引くとほぼ平らな線になる）。
 */

const W = 300
const H = 76
const PAD = 8

const label = (ym) => `${Number(ym.split('-')[1])}月`

export default function NetWorthTrend({ history }) {
  const theme = useTheme()
  if (!history || history.length < 2) return null

  const values = history.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (i) => PAD + (i * (W - PAD * 2)) / (history.length - 1)
  const y = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2)

  const points = history.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`)
  const line = `M${points.join(' L')}`
  const area = `${line} L${x(history.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`

  const last = history[history.length - 1]
  const first = history[0]
  const diff = last.value - first.value
  const stroke = theme.palette.primary.main

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary">
          推移（{label(first.ym)}〜{label(last.ym)}）
        </Typography>
        <Typography variant="caption" sx={{
          fontWeight: 700,
          color: diff === 0 ? 'text.secondary' : diff > 0 ? 'success.main' : 'error.main',
        }}>
          {diff >= 0 ? '+' : '−'}¥{fmt(Math.abs(diff))}
        </Typography>
      </Stack>

      {/* 幅は画面に合わせて伸びるが、線の太さは保つ（non-scaling-stroke） */}
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`純資産の推移 ${label(first.ym)}から${label(last.ym)}`}
        sx={{ width: '100%', height: H, display: 'block' }}
      >
        <path d={area} fill={stroke} opacity={0.12} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(history.length - 1)} cy={y(last.value)} r={3.5}
          fill={stroke} vectorEffect="non-scaling-stroke" />
      </Box>

      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          最小 ¥{fmt(min)}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          最大 ¥{fmt(max)}
        </Typography>
      </Stack>
    </Box>
  )
}
