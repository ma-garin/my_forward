import { Box, Typography, Stack } from '@mui/material'

/**
 * カード上部の色付きヘッダーバー（共通コンポーネント）。
 * これまで各所に散っていた `bgcolor:'primary.main', px:2, py:0.75` + caption を集約。
 *
 * props:
 *  - title:  ヘッダー文言（string）
 *  - right:  右寄せ要素（任意）
 *  - startIcon: タイトル左のアイコン（任意 / 折りたたみ chevron 等）
 *  - onClick, sx: passthrough
 */
export default function CardHeaderBar({ title, right, startIcon, onClick, sx }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: 'primary.main',
        px: 2,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: onClick ? 'none' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        ...sx,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        {startIcon}
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}
          noWrap
        >
          {title}
        </Typography>
      </Stack>
      {right}
    </Box>
  )
}
