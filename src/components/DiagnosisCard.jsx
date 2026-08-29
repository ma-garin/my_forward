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

const GRADE_COLOR = { A: 'success.main', B: 'success.main', C: '#e65100', D: 'error.main' }

export default function DiagnosisCard({ ym }) {
  const [open, setOpen] = useState(false)

  // 3ヶ月ぶんの収支 × カード枚数の読み込みになるので、最初の描画のあとに回す
  const result = useAfterPaint(() => diagnose(ym), [ym])

  if (!result) return null

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
            {result.score === null ? '記録が足りません' : `${result.score}点`}
          </Typography>
        }
      />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="baseline" gap={1}>
          {result.grade && (
            <Typography variant="h4" fontWeight={700} sx={{ color: GRADE_COLOR[result.grade] }}>
              {result.grade}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {result.score === null
              ? '収入か支出を記録すると診断できます'
              : `${result.score}点 / 100点`}
          </Typography>
        </Stack>

        {/* 畳んでいても、悪い観点だけは見えるところに出す（気づかないと直せない） */}
        {!open && result.items.filter((x) => x.status === 'warn' || x.status === 'bad').map((x) => (
          <Typography key={x.key} variant="caption"
            sx={{ display: 'block', mt: 0.5, color: STATUS[x.status].color }}>
            {STATUS[x.status].mark} {x.label}（{x.value}）{x.advice}
          </Typography>
        ))}

        <Collapse in={open} unmountOnExit>
          <Stack gap={1} sx={{ mt: 1 }}>
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
    </Card>
  )
}
