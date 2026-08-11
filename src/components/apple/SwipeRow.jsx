import { useRef } from 'react'
import { Box } from '@mui/material'
import { motion, useMotionValue, animate, useReducedMotion } from 'motion/react'
import { ios } from './tokens'

const ACTION_W = 84
const DRAG_SLOP = 4   // これを超えて動いたらタップではなくスワイプ扱い

/**
 * iOS 風スワイプ削除行。
 * 左スワイプで赤い「削除」アクションを露出（ラバーバンド）、
 * 速く弾く / 半分以上引くと確定して削除。指を離すとスプリングでスナップ。
 * prefers-reduced-motion 時は静的な削除ボタンを右端に表示。
 *
 * props:
 *  - onDelete: 削除実行
 *  - onClick:  行タップ（スワイプ中・アクション露出中は発火しない）
 *  - bg:       前面の背景色（背後の赤を透かさないため不透明にすること）
 *  - children: 行の中身
 */
export default function SwipeRow({ onDelete, onClick, bg = ios.cardBg, children }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const draggedRef = useRef(false)
  const openRef = useRef(false)

  if (reduce) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, minWidth: 0, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
          {children}
        </Box>
        <Box component="button" type="button" onClick={onDelete}
          sx={{ width: 64, border: 'none', bgcolor: ios.red, color: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          削除
        </Box>
      </Box>
    )
  }

  const settle = (to) => {
    openRef.current = to !== 0
    return animate(x, to, { type: 'spring', stiffness: 520, damping: 42 })
  }

  const onDragEnd = (_e, info) => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390
    const commit = info.offset.x < -w * 0.45 || info.velocity.x < -1100
    const open   = info.offset.x < -ACTION_W * 0.5 || info.velocity.x < -450
    if (commit) { openRef.current = false; animate(x, -w, { type: 'spring', stiffness: 500, damping: 46 }); onDelete?.() }
    else if (open) settle(-ACTION_W)
    else settle(0)
  }

  // スワイプ直後やアクション露出中のタップで編集を開かない
  const handleClick = (e) => {
    if (draggedRef.current) { draggedRef.current = false; return }
    if (openRef.current) { settle(0); return }
    onClick?.(e)
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
        style={{ x, background: bg, position: 'relative', cursor: onClick ? 'pointer' : 'default' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_W, right: 0 }}
        dragElastic={{ left: 0.35, right: 0 }}
        onDragStart={() => { draggedRef.current = false }}
        onDrag={(_e, info) => { if (Math.abs(info.offset.x) > DRAG_SLOP) draggedRef.current = true }}
        onDragEnd={onDragEnd}
        onClick={handleClick}
      >
        {children}
      </motion.div>
    </Box>
  )
}
