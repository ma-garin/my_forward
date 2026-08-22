import { useState } from 'react'
import {
  Box, Stack, Typography, IconButton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const LABEL_SX = {
  minWidth: 96, textAlign: 'center', border: 'none', bgcolor: 'transparent',
  fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', px: 1, py: 0.25,
  borderRadius: 1.5, '&:active': { bgcolor: 'action.selected' },
}
const GRID_SX = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }

/**
 * 月ナビゲーション（クレカ・家計で共通）。
 *
 * 前後ボタンだけだと半年前を見るのに 6 タップかかるので、年月をタップして
 * 直接ジャンプできるようにしている。画面ごとに書くと見た目と操作が食い違うため
 * ここに一本化する。
 *
 * onStep(delta) … 前後の月へ / onJump(year, month) … 指定の月へ
 */
export default function MonthNav({ year, month, onStep, onJump }) {
  const [open, setOpen] = useState(false)
  const [pickYear, setPickYear] = useState(year)

  const today     = new Date()
  const thisYear  = today.getFullYear()
  const thisMonth = today.getMonth() + 1

  const jump = (y, m) => { onJump(y, m); setOpen(false) }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" aria-label="前の月" onClick={() => onStep(-1)}><ChevronLeftIcon /></IconButton>
        <Typography
          component="button" type="button" variant="subtitle2" fontWeight={600}
          aria-label={`年月を選ぶ（現在: ${year}年${month}月）`}
          onClick={() => { setPickYear(year); setOpen(true) }}
          sx={LABEL_SX}
        >
          {year}年{month}月
        </Typography>
        <IconButton size="small" aria-label="次の月" onClick={() => onStep(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>年月を選ぶ</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
            <IconButton size="small" aria-label="前の年" onClick={() => setPickYear(y => y - 1)}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography sx={{ minWidth: 72, textAlign: 'center', fontWeight: 700 }}>{pickYear}年</Typography>
            <IconButton size="small" aria-label="次の年" onClick={() => setPickYear(y => y + 1)}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
          <Box sx={GRID_SX}>
            {MONTHS.map(m => {
              const selected = pickYear === year && m === month
              // 今月は枠線で分かるようにする（遠い月まで飛んだあと戻る目印になる）
              const isThisMonth = pickYear === thisYear && m === thisMonth
              return (
                <Button
                  key={m} size="small" onClick={() => jump(pickYear, m)}
                  variant={selected ? 'contained' : 'outlined'}
                  sx={{
                    minWidth: 0, py: 0.75, fontSize: 13, fontWeight: selected ? 700 : 500,
                    ...(isThisMonth && !selected ? { borderColor: 'primary.main', borderWidth: 2 } : null),
                  }}
                >
                  {m}月
                </Button>
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => jump(thisYear, thisMonth)}>今月</Button>
          <Button size="small" onClick={() => setOpen(false)}>キャンセル</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
