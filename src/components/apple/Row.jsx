import { Box, Stack, Typography } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { motion, useReducedMotion } from 'motion/react'
import { ios } from './tokens'

/**
 * iOS リスト行。左ラベル / 右バリュー / 任意 chevron。
 * Section の子として並べると、行間に inset の極細セパレータが入る（最終行以外）。
 *
 * props:
 *  - label:   左側（string / node）
 *  - sub:     左ラベル下の補足（任意）
 *  - value:   右側（string / node）
 *  - leading: 左端の要素（アイコン・カラードット等、任意）
 *  - chevron: 右端に > を表示（タップ可能を示唆）
 *  - onClick: タップ時
 *  - last:    最終行（セパレータを引かない）
 *  - dense:   行高を詰める
 *  - sx:      passthrough
 */
export default function Row({ label, sub, value, leading, chevron, onClick, last = false, dense = false, sx }) {
  const reduce = useReducedMotion()
  const tappable = !!onClick
  return (
    <Box
      {...(tappable && !reduce ? { component: motion.div, whileTap: { scale: 0.985 } } : {})}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: dense ? 36 : ios.rowMinHeight,
        pl: `${ios.insetX}px`,
        pr: `${ios.insetX}px`,
        py: dense ? 0.5 : 0.75,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        userSelect: onClick ? 'none' : undefined,
        '&:active': onClick ? { bgcolor: 'rgba(0,0,0,0.04)' } : undefined,
        // inset hairline（最終行以外）: leading があれば左端をラベル位置まで下げる
        '&::after': last ? {} : {
          content: '""',
          position: 'absolute',
          left: leading ? `${ios.insetX + 32}px` : `${ios.insetX}px`,
          right: 0,
          bottom: 0,
          height: '0.5px',
          bgcolor: ios.separator,
        },
        ...sx,
      }}
    >
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {typeof label === 'string'
          ? <Typography sx={{ fontSize: 15, color: ios.label, letterSpacing: '-0.01em' }} noWrap>{label}</Typography>
          : label}
        {sub != null && (
          typeof sub === 'string'
            ? <Typography sx={{ fontSize: 12.5, color: ios.secondary }} noWrap>{sub}</Typography>
            : sub
        )}
      </Box>
      {value != null && (
        <Stack direction="row" alignItems="center" gap={0.25} sx={{ flexShrink: 0, color: ios.secondary }}>
          {typeof value === 'string'
            ? <Typography sx={{ fontSize: 15, color: ios.secondary, letterSpacing: '-0.01em' }}>{value}</Typography>
            : value}
        </Stack>
      )}
      {chevron && <ChevronRightIcon sx={{ fontSize: 20, color: ios.tertiary, flexShrink: 0, ml: -0.5 }} />}
    </Box>
  )
}
