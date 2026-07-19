import { Box, Typography, Stack } from '@mui/material'
import { useThemeMode } from '../ThemeModeContext'
import { ios } from './apple/tokens'

/**
 * カード上部の色付きヘッダーバー（共通コンポーネント）。
 * これまで各所に散っていた `bgcolor:'primary.main', px:2, py:0.75` + caption を集約。
 *
 * - classic: 濃色バー（従来通り）
 * - apple:   iOS 設定アプリ風のグレー見出し（カード上に白背景・ダークテキスト・極細下線）
 *
 * props:
 *  - title:  ヘッダー文言（string）
 *  - right:  右寄せ要素（任意）
 *  - startIcon: タイトル左のアイコン（任意 / 折りたたみ chevron 等）
 *  - onClick, sx: passthrough
 */
export default function CardHeaderBar({ title, right, startIcon, onClick, sx }) {
  const { mode } = useThemeMode()
  const apple = mode === 'apple'

  if (apple) {
    return (
      <Box
        onClick={onClick}
        sx={{
          bgcolor: ios.cardBg,
          px: 2,
          py: 1.1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `0.5px solid ${ios.separator}`,
          userSelect: onClick ? 'none' : undefined,
          cursor: onClick ? 'pointer' : undefined,
          ...sx,
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          {startIcon}
          <Typography
            sx={{ fontSize: 15, fontWeight: 600, color: ios.label, letterSpacing: '-0.01em' }}
            noWrap
          >
            {title}
          </Typography>
        </Stack>
        {right}
      </Box>
    )
  }

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
