import { Box, Typography, Stack } from '@mui/material'
import { useThemeMode } from '../ThemeModeContext'

/**
 * カード上部の色付きヘッダーバー（共通コンポーネント）。
 * これまで各所に散っていた `bgcolor:'primary.main', px:2, py:0.75` + caption を集約。
 * テーマ（現行 / Apple風）で見た目を切り替える。
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
        // Apple: 上端にごく淡いハイライトを入れてマテリアル感を出す
        ...(apple ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09)' } : {}),
        ...sx,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        {startIcon}
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,.9)',
            fontWeight: 600,
            letterSpacing: apple ? 0.6 : 0.5,
          }}
          noWrap
        >
          {title}
        </Typography>
      </Stack>
      {right}
    </Box>
  )
}
