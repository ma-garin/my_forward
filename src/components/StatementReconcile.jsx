import { useState } from 'react'
import { Card, CardContent, Box, Typography, Stack, Chip } from '@mui/material'
import CardHeaderBar from './CardHeaderBar'
import AmountField from './AmountField'
import { fmt } from '../utils/finance'
import { loadStatement, saveStatement, isClosed, compare, diffLabel } from '../utils/statement'

/**
 * カード明細との突合。
 *
 * 自分の記録が実際の請求額と合っているかは、どこにも出ていなかった。
 * 合っていなければ取りこぼし（入力漏れ）か二重計上がある。家計簿の数字を
 * 信用できるかはここで決まる。
 *
 * 締め日が過ぎた月にだけ出す。締め日前は記録がまだ増える途中なので、
 * 合わないのが当たり前で、差を出しても意味がない。
 *
 * 記録額（recorded）は画面から受け取る。ここで数え直すと同じ事実が 2 箇所に
 * なり、片方だけ変わったときにカード上部の使用額と食い違う。
 *
 * 入力欄の中身は保存から作る。カード・月が変わったら読み直したいので、
 * 呼び出し側が key={cardId}-{ym} で作り直す（effect で入れ直すと、
 * 一瞬だけ前の月の請求額が見える）。
 */
export default function StatementReconcile({ cardId, ym, recorded }) {
  const [raw, setRaw] = useState(() => {
    const v = loadStatement(cardId, ym)
    return v === null ? '' : String(v)
  })

  if (!isClosed(cardId, ym)) return null

  const statement = raw === '' ? null : Number(raw)
  const { diff, matched } = compare(recorded, statement)

  const handleChange = (v) => {
    setRaw(v)
    saveStatement(cardId, ym, v === '' ? null : v)
  }

  const diffColor = matched ? 'success.main' : 'error.main'
  const hint = matched
    ? '記録と請求が一致しています'
    : diff > 0
      ? '請求のほうが多い。登録していない支払いがあります'
      : '記録のほうが多い。二重に入れたか、請求に載っていない支払いがあります'

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar
        title="明細と突合"
        right={statement !== null && (
          <Chip
            label={diffLabel(diff)}
            size="small"
            sx={{
              height: 18, fontSize: 10, fontWeight: 700,
              bgcolor: matched ? 'var(--tint-mint)' : 'var(--tint-red)',
              color: matched ? 'success.main' : 'error.main',
            }}
          />
        )}
      />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">記録</Typography>
          <Typography variant="body2" fontWeight={700}>¥{fmt(recorded)}</Typography>
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            請求額
          </Typography>
          <Box sx={{ width: 140 }}>
            <AmountField
              value={raw}
              onChange={handleChange}
              placeholder="未入力"
              inputSx={{ '& .MuiInputBase-root': { height: 32 }, '& input': { textAlign: 'right', fontWeight: 700 } }}
            />
          </Box>
        </Stack>

        {statement === null ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: 10 }}>
            カード明細の請求額を入れると、記録との差が出ます
          </Typography>
        ) : (
          <Box sx={{ mt: 1.25, py: 0.75, px: 1, borderRadius: 1,
            bgcolor: matched ? 'var(--tint-green)' : 'var(--tint-red)' }}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: diffColor }}>差</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: diffColor }}>
                {diff === 0 ? '¥0' : diff > 0 ? `+¥${fmt(diff)}` : `−¥${fmt(-diff)}`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: diffColor, opacity: .85 }}>
              {hint}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
