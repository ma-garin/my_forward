import { Box } from '@mui/material'
import { ios, statusColor } from './tokens'

/**
 * iOS 風カプセルメーター（プログレスバー）。
 *
 * props:
 *  - pct:    0..100（超過時は 100 でクリップ表示）
 *  - color:  塗り色（未指定なら pct から緑/橙/赤を自動判定）
 *  - track:  トラック色
 *  - height: 太さ（既定 6）
 *  - sx:     passthrough
 */
export default function Meter({ pct, color, track = 'rgba(118,118,128,0.16)', height = 6, sx }) {
  const w = Math.max(0, Math.min(100, pct))
  const fill = color || statusColor(pct)
  return (
    <Box sx={{ height, bgcolor: track, borderRadius: 999, overflow: 'hidden', ...sx }}>
      <Box
        sx={{
          height: '100%',
          width: `${w}%`,
          bgcolor: fill,
          borderRadius: 999,
          transition: 'width .4s ease',
        }}
      />
    </Box>
  )
}

export { ios }
