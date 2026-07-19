import { Box } from '@mui/material'
import { motion, useMotionValue, animate, useReducedMotion } from 'motion/react'
import { ios } from './tokens'

const ACTION_W = 84

/**
 * iOS 風スワイプ削除行。
 * 左スワイプで赤い「削除」アクションを露出（ラバーバンド）、
 * 速く弾く / 半分以上引くと確定して削除。指を離すとスプリングでスナップ。
 * prefers-reduced-motion 時は静的な削除ボタンを右端に表示。
 *
 * props:
 *  - onDelete: 削除実行
 *  - children: 行の中身（不透明背景推奨）
 */
export default function SwipeRow({ onDelete, children }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)

  if (reduce) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
        <Box component="button" type="button" onClick={onDelete}
          sx={{ width: 64, border: 'none', bgcolor: ios.red, color: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          削除
        </Box>
      </Box>
    )
  }

  const settle = (to) => animate(x, to, { type: 'spring', stiffness: 520, damping: 42 })

  const onDragEnd = (_e, info) => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390
    const commit = info.offset.x < -w * 0.45 || info.velocity.x < -1100
    const open   = info.offset.x < -ACTION_W * 0.5 || info.velocity.x < -450
    if (commit) { animate(x, -w, { type: 'spring', stiffness: 500, damping: 46 }); onDelete?.() }
    else if (open) settle(-ACTION_W)
    else settle(0)
  }

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* 背後の削除アクション */}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', bgcolor: ios.red }}>
        <Box
          component="button" type="button"
          onClick={() => { onDelete?.(); settle(0) }}
          sx={{ width: ACTION_W, border: 'none', bgcolor: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          削除
        </Box>
      </Box>
      {/* 前面のドラッグ可能な行 */}
      <motion.div
        style={{ x, background: ios.cardBg, position: 'relative' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_W, right: 0 }}
        dragElastic={{ left: 0.35, right: 0 }}
        onDragEnd={onDragEnd}
      >
        {children}
      </motion.div>
    </Box>
  )
}
