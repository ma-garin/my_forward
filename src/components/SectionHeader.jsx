import { Box, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

/**
 * カード上部の共通セクションヘッダー（primary 背景・白文字）。
 * これまで各画面にインラインでコピペされていた見出しバーを集約する。
 *
 * props:
 *  - title       見出しテキスト
 *  - badge       タイトル右の小さなチップ等（任意）
 *  - right       右端に並べる補助表示（合計金額など、任意）
 *  - action      右端のアクション（追加ボタンなど、任意）
 *  - collapsible 折りたたみ可能か（true で左にシェブロン表示）
 *  - open        折りたたみの開閉状態
 *  - onToggle    ヘッダークリック時のトグルハンドラ
 */
export default function SectionHeader({ title, badge, right, action, collapsible = false, open = false, onToggle }) {
  const clickable = collapsible && typeof onToggle === 'function'
  return (
    <Box
      onClick={clickable ? onToggle : undefined}
      sx={{
        bgcolor: 'primary.main',
        px: 2, py: 0.85,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        {collapsible && (
          <ExpandMoreIcon sx={{
            fontSize: 18, color: '#fff',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .2s',
          }} />
        )}
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 12.5, letterSpacing: 0.5 }} noWrap>
          {title}
        </Typography>
        {badge}
      </Stack>
      {(right || action) && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          {right}
          {action}
        </Stack>
      )}
    </Box>
  )
}
