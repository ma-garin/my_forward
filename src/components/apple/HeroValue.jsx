import { Box, Typography } from '@mui/material'
import { ios } from './tokens'

/**
 * 大きな金額表示（iOS の残高風）。SF システムフォント + 詰めたトラッキング。
 *
 * props:
 *  - label:  上の小さなラベル（任意）
 *  - value:  数値（円）— ¥ + カンマ整形は呼び出し側の fmt を渡す
 *  - prefix: 既定 '¥'
 *  - color:  数字の色
 *  - size:   数字フォントサイズ（既定 34）
 *  - align:  'left' | 'center' | 'right'
 */
export default function HeroValue({ label, value, prefix = '¥', color = ios.label, size = 34, align = 'left' }) {
  return (
    <Box sx={{ textAlign: align }}>
      {label != null && (
        <Typography sx={{ fontSize: 13, color: ios.secondary, letterSpacing: '-0.01em', mb: 0.25 }}>
          {label}
        </Typography>
      )}
      <Typography
        component="div"
        sx={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Box component="span" sx={{ fontSize: size * 0.62, fontWeight: 600, mr: 0.25, verticalAlign: '0.06em' }}>
          {prefix}
        </Box>
        {value}
      </Typography>
    </Box>
  )
}
