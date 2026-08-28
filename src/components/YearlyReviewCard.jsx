import { useState } from 'react'
import { Card, CardContent, Box, Typography, Stack, Divider, Collapse, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CardHeaderBar from './CardHeaderBar'
import { fmt } from '../utils/finance'
import { yearlyBalance } from '../utils/monthly'
import { useAfterPaint } from '../utils/useAfterPaint'

/**
 * 年次の振り返り。
 *
 * これまで年間の集計はクレカタブの「年間サマリー」しかなく、カード 1 枚の
 * 支出だけを見ていた。1 年でいくら入っていくら残ったのかは、どこにも
 * 出ていなかった。
 *
 * 月ごとの数字は monthlyBalance（収支サマリー・2枚合計と同じ足し方）。
 * ここで足し方を書くと、月の画面と年の画面で数字が食い違う。
 */
export default function YearlyReviewCard({ year: initialYear }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(initialYear)

  // 12 ヶ月 × カード枚数ぶんの読み込みになるので、最初の描画のあとに回す
  const data = useAfterPaint(() => yearlyBalance(year), [year])

  if (!data) return null

  const amt = (v) => (v >= 0 ? `¥${fmt(v)}` : `−¥${fmt(-v)}`)
  // 棒の幅は「その年でいちばん大きい月」を基準にする
  const peak = Math.max(1, ...data.months.map((m) => Math.max(m.income, m.expense)))

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar
        title="年次の振り返り"
        onClick={() => setOpen((v) => !v)}
        startIcon={
          <ExpandMoreIcon sx={{
            fontSize: 18, color: 'rgba(255,255,255,.9)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s',
          }} />
        }
        right={
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 700 }}>
            {year}年 {data.filledCount > 0 ? `貯蓄率 ${data.savingRate}%` : '記録なし'}
          </Typography>
        }
      />

      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* 年の切り替え。畳んでいても動かせるようにここに置く */}
        <Stack direction="row" alignItems="center" justifyContent="center" gap={1}>
          <IconButton size="small" aria-label="前の年" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" fontWeight={700}>{year}年</Typography>
          <IconButton size="small" aria-label="次の年" onClick={() => setYear((y) => y + 1)}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>

        {data.filledCount === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1 }}>
            {year}年の記録がまだありません
          </Typography>
        ) : (
          <>
            <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} sx={{ mt: 0.5 }}>
              {[
                { label: '収入', value: data.income },
                { label: '支出', value: data.expense },
                { label: '貯蓄', value: data.balance, accent: true },
              ].map(({ label, value, accent }) => (
                <Stack key={label} alignItems="center" sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{
                    fontSize: 14,
                    color: accent ? (data.balance >= 0 ? 'success.main' : 'error.main') : 'inherit',
                  }}>
                    {accent ? amt(value) : `¥${fmt(value)}`}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', fontSize: 10, mt: 0.5 }}>
              記録のある {data.filledCount} ヶ月・月あたり 収入 ¥{fmt(data.avgIncome)} / 支出 ¥{fmt(data.avgExpense)}
            </Typography>

            <Collapse in={open} unmountOnExit>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" sx={{ pb: 0.4 }}>
                <Box sx={{ width: 28 }} />
                <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'text.disabled', textAlign: 'right' }}>収入</Typography>
                <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'text.disabled', textAlign: 'right' }}>支出</Typography>
                <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'text.disabled', textAlign: 'right' }}>差額</Typography>
              </Stack>

              {data.months.map((m) => (
                <Box key={m.ym} sx={{ py: 0.4, borderTop: '1px solid var(--surface-line)' }}>
                  <Stack direction="row" alignItems="center">
                    <Typography sx={{ width: 28, fontSize: 11, color: 'text.secondary' }}>{m.month}月</Typography>
                    {m.empty ? (
                      <Typography sx={{ flex: 3, fontSize: 11, color: 'text.disabled', textAlign: 'right' }}>—</Typography>
                    ) : (
                      <>
                        <Typography sx={{ flex: 1, fontSize: 11, textAlign: 'right' }}>¥{fmt(m.income)}</Typography>
                        <Typography sx={{ flex: 1, fontSize: 11, textAlign: 'right' }}>¥{fmt(m.expense)}</Typography>
                        <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 700, textAlign: 'right',
                          color: m.balance >= 0 ? 'success.main' : 'error.main' }}>
                          {amt(m.balance)}
                        </Typography>
                      </>
                    )}
                  </Stack>

                  {/* 横棒。縦棒だと親の高さが要る（過去に棒が消えた） */}
                  {!m.empty && (
                    <Stack sx={{ mt: 0.3, ml: 3.5, gap: '2px' }}>
                      <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'var(--tint-mint)',
                        width: `${(m.income / peak) * 100}%` }} />
                      <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'var(--tint-red)',
                        width: `${(m.expense / peak) * 100}%` }} />
                    </Stack>
                  )}
                </Box>
              ))}

              <Typography variant="caption" color="text.secondary"
                sx={{ display: 'block', fontSize: 10, mt: 0.75 }}>
                収入は手取り（実績があれば実績）＋その他収入。支出はカード・現金＋固定費内訳＋生活費。
              </Typography>
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  )
}
