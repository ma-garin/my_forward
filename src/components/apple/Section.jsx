import { Box, Typography } from '@mui/material'
import { ios } from './tokens'

/**
 * iOS 設定アプリ風のグループセクション。
 * グレーの小さな見出し（任意）+ 白の角丸カード。
 * 子要素（Row 等）を縦に積み、行間に inset hairline は Row 側で描く。
 *
 * props:
 *  - header: セクション見出し（string / node、任意）
 *  - footer: 補足テキスト（任意）
 *  - disablePadding: カード内パディングを無くす（Row を敷き詰める場合）
 *  - sx: カードへの passthrough
 */
export default function Section({ header, footer, children, disablePadding = true, sx }) {
  return (
    <Box sx={{ px: `${ios.insetX}px`, mb: 2.25 }}>
      {header != null && (
        <Typography
          component="div"
          sx={{
            px: 0.5,
            mb: 0.75,
            fontSize: 13,
            color: ios.secondary,
            letterSpacing: '-0.01em',
          }}
        >
          {header}
        </Typography>
      )}
      <Box
        sx={{
          bgcolor: ios.cardBg,
          borderRadius: `${ios.radius}px`,
          overflow: 'hidden',
          ...(disablePadding ? {} : { p: 1.75 }),
          ...sx,
        }}
      >
        {children}
      </Box>
      {footer != null && (
        <Typography sx={{ display: 'block', px: 0.5, mt: 0.75, fontSize: 12, color: ios.secondary }}>
          {footer}
        </Typography>
      )}
    </Box>
  )
}
