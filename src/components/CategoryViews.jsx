import { Box, Card, CardContent, Typography, Stack, Divider } from '@mui/material'
import { fmt } from '../utils/finance'
import { CHART_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS } from '../utils/ccStorage'

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2
  const R  = size * 0.46
  const ri = size * 0.26
  const GAP = 0.025
  let angle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const full  = (d.value / total) * 2 * Math.PI
    const theta = Math.max(full - GAP, 0.001)
    const a1 = angle + GAP / 2
    const a2 = a1 + theta
    angle += full
    const large = theta > Math.PI ? 1 : 0
    const p = (a) => [cx + R  * Math.cos(a), cy + R  * Math.sin(a)]
    const q = (a) => [cx + ri * Math.cos(a), cy + ri * Math.sin(a)]
    const [ox1, oy1] = p(a1), [ox2, oy2] = p(a2)
    const [ix1, iy1] = q(a1), [ix2, iy2] = q(a2)
    const path = `M${ox1} ${oy1} A${R} ${R} 0 ${large} 1 ${ox2} ${oy2} L${ix2} ${iy2} A${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`
    return { path, color: CHART_COLORS[i % CHART_COLORS.length] }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={9} fill="#90a4ae">合計</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#37474f">
        ¥{fmt(total)}
      </text>
    </svg>
  )
}

export function CategoryChart({ fixedList, varList }) {
  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const total   = Object.values(map).reduce((s, v) => s + v, 0)
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
  const data    = entries.map(([label, value]) => ({ label, value }))

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          カテゴリ別グラフ
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <DonutChart data={data} size={140} />
          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            {entries.map(([cat, val], i) => {
              const pct = Math.round(val / total * 100)
              return (
                <Stack key={cat} spacing={0.4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontSize: 10 }} noWrap>{cat}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>{pct}%</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10 }}>¥{fmt(val)}</Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 6, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 2 }} />
                  </Box>
                </Stack>
              )
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function CategoryBreakdown({ fixedList, varList }) {
  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const grandTotal = Object.values(map).reduce((s, v) => s + v, 0)
  const entries    = Object.entries(map).sort((a, b) => b[1] - a[1])

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          カテゴリ別集計
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
        {entries.map(([cat, total], i) => {
          const pct   = grandTotal > 0 ? Math.round(total / grandTotal * 100) : 0
          const color = CHART_COLORS[i % CHART_COLORS.length]
          return (
            <Box key={cat}>
              {i > 0 && <Divider />}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: 12, color: '#546e7a' }}>{cat}</Typography>
                </Stack>
                <Stack direction="row" alignItems="baseline" gap={1}>
                  <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>{pct}%</Typography>
                  <Typography variant="body2" fontWeight={600}>¥{fmt(total)}</Typography>
                </Stack>
              </Stack>
            </Box>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function SpendTypeChart({ fixedList, varList }) {
  const all = [...fixedList, ...varList].filter(x => x.sign !== 1)
  if (all.length === 0) return null

  const totals = {}
  SPEND_TYPES.forEach(t => { totals[t] = 0 })
  all.forEach(x => {
    const t = x.spendType ?? '消費'
    totals[t] = (totals[t] ?? 0) + x.amount
  })

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grandTotal === 0) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          消費分類
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        {/* 積み上げバー */}
        <Box sx={{ height: 12, borderRadius: 2, overflow: 'hidden', display: 'flex', mb: 1.5 }}>
          {SPEND_TYPES.map(t => {
            const pct = grandTotal > 0 ? (totals[t] / grandTotal) * 100 : 0
            return pct > 0 ? (
              <Box key={t} sx={{ width: `${pct}%`, bgcolor: SPEND_TYPE_COLORS[t], height: '100%' }} />
            ) : null
          })}
        </Box>
        {/* 凡例 */}
        <Stack spacing={0.75}>
          {SPEND_TYPES.map(t => {
            const val = totals[t]
            const pct = grandTotal > 0 ? Math.round(val / grandTotal * 100) : 0
            return (
              <Stack key={t} spacing={0.3}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SPEND_TYPE_COLORS[t], flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontSize: 12 }}>{t}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="baseline" gap={0.5}>
                    <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{pct}%</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>¥{fmt(val)}</Typography>
                  </Stack>
                </Stack>
                <Box sx={{ height: 5, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: SPEND_TYPE_COLORS[t], borderRadius: 2 }} />
                </Box>
              </Stack>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}
