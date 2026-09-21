import { useState } from 'react'
import { Card, CardContent, Box, Typography, Stack, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeaderBar from './CardHeaderBar'
import { diagnose } from '../utils/diagnosis'
import { useAfterPaint } from '../utils/useAfterPaint'

/**
 * 家計診断。その請求月の家計を 5 つの観点で採点する。
 *
 * 数字は他のカードと同じ出どころ（monthlyBalance など）から読むので、
 * 収支サマリーと食い違う点数にはならない。
 */

const STATUS = {
  good: { mark: '◎', color: 'success.main' },
  ok:   { mark: '○', color: 'success.main' },
  warn: { mark: '△', color: '#e65100' },
  bad:  { mark: '×', color: 'error.main' },
  na:   { mark: '—', color: 'text.disabled' },
}

export default function DiagnosisCard({ ym }) {
  const [open, setOpen] = useState(false)

  // 3ヶ月ぶんの収支 × カード枚数の読み込みになるので、最初の描画のあとに回す
  const result = useAfterPaint(() => diagnose(ym), [ym])

  if (!result) return null

  // 畳んでいても見せる観点（気づかないと直せない）
  const alerts = result.items.filter((x) => x.status === 'warn' || x.status === 'bad')

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar
        title="家計診断"
        onClick={() => setOpen((v) => !v)}
        startIcon={
          <ExpandMoreIcon sx={{
            fontSize: 18, color: 'rgba(255,255,255,.9)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s',
          }} />
        }
        right={
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 700 }}>
            {result.score === null ? '記録が足りません' : `${result.grade} ${result.score}点`}
          </Typography>
        }
      />
      {/* 畳んだら中身は出さない。点数とグレードはヘッダーが持っているので、
          ここに出すと同じ数字が 2 箇所に並ぶ（実際にそうなっていた）。
          出すものが何も無いときは空の余白を作らない */}
      {(open || result.score === null || alerts.length > 0) && (
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {result.score === null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            収入か支出を記録すると診断できます
          </Typography>
        )}

        {/* 畳んでいても、悪い観点だけは見えるところに出す（気づかないと直せない） */}
        {!open && (
          <Stack gap={0.5}>
            {alerts.map((x) => (
              <Typography key={x.key} variant="caption" sx={{ color: STATUS[x.status].color }}>
                {STATUS[x.status].mark} {x.label}（{x.value}）{x.advice}
              </Typography>
            ))}
          </Stack>
        )}

        <Collapse in={open} unmountOnExit>
          <Stack gap={1}>
            {result.items.map((x) => (
              <Box key={x.key}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    <Box component="span" sx={{ color: STATUS[x.status].color, mr: 0.5 }}>
                      {STATUS[x.status].mark}
                    </Box>
                    {x.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: STATUS[x.status].color }}>
                    {x.value}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary"
                  sx={{ display: 'block', fontSize: 10, pl: 2 }}>
                  {x.advice}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
      )}
    </Card>
  )
}
