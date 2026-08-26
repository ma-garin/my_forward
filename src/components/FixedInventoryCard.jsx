import { useMemo, useState } from 'react'
import { Card, CardContent, Box, Typography, Stack, Chip, Collapse, Divider } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeaderBar from './CardHeaderBar'
import { fixedInventory } from '../utils/fixedInventory'
import { CARDS } from '../utils/ccStorage'
import { fmt } from '../utils/finance'
import { useAfterPaint } from '../utils/useAfterPaint'

/**
 * 固定費の棚卸し。
 *
 * 月額だと 500 円の積み重ねが軽く見える。年額に直して大きい順に並べ、
 * 「これは続けるのか」を判断できるようにする。値上げされた項目は上に出す。
 */
export default function FixedInventoryCard({ fromYm }) {
  const [open, setOpen] = useState(false)

  // 全カード × 12 ヶ月ぶんの判定になるので、最初の描画のあとに回す
  const data = useAfterPaint(() => fixedInventory(fromYm), [fromYm])
  const share = useMemo(
    () => (row) => (data?.annualTotal ? (row._annual / data.annualTotal) * 100 : 0),
    [data],
  )

  if (!data || data.rows.length === 0) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar
        title="固定費の棚卸し"
        onClick={() => setOpen((v) => !v)}
        startIcon={
          <ExpandMoreIcon sx={{
            fontSize: 18, color: 'rgba(255,255,255,.9)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s',
          }} />
        }
        right={
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 700 }}>
            年 ¥{fmt(data.annualTotal)}
          </Typography>
        }
      />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          今後 12 ヶ月ぶん・月あたり ¥{fmt(data.monthlyAverage)}
        </Typography>

        {/* 値上げは畳んでいても見えるところに出す（気づかないと直せない） */}
        {data.increases.length > 0 && (
          <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'var(--tint-orange)' }}>
            <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
              値上げされた項目があります
            </Typography>
            {data.increases.map((c, i) => (
              <Typography key={`${c.id}-${i}`} variant="caption" sx={{ display: 'block' }}>
                {c.name}: ¥{fmt(c.from)} → ¥{fmt(c.to)}（年 +¥{fmt((c.to - c.from) * 12)}）
              </Typography>
            ))}
          </Box>
        )}

        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 1 }}>
            {data.rows.map((row, i) => (
              <Box key={`${row._cardId}-${row.id}`}>
                {i > 0 && <Divider />}
                <Stack direction="row" alignItems="center" gap={1} sx={{ py: 0.75 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.6}>
                      <Typography fontSize={13} noWrap>{row.name}</Typography>
                      <Chip label={CARDS[row._cardId]?.shortName ?? row._cardId} size="small"
                        sx={{ height: 15, fontSize: 8, bgcolor: CARDS[row._cardId]?.color, color: '#fff' }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      ¥{fmt(row.amount)} / {row._interval}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontSize={13} fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      ¥{fmt(row._annual)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                      {share(row).toFixed(0)}%
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}
