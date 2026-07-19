import { Box } from '@mui/material'
import { motion, useReducedMotion } from 'motion/react'
import { ios } from './tokens'

/**
 * iOS 風セグメンテッドコントロール。
 * 角丸トラック上に選択ピル（白＋微シャドウ）。タップで whileTap 縮小。
 *
 * props:
 *  - options: [{ value, label }] または string[]
 *  - value:   選択中の value
 *  - onChange: (value) => void
 *  - size:    'sm' | 'md'
 *  - accent:  選択中テキストの色（既定 label）
 *  - sx:      passthrough（トラック）
 */
export default function Segmented({ options, value, onChange, size = 'md', accent, sx }) {
  const reduce = useReducedMotion()
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const h = size === 'sm' ? 28 : 32
  const fs = size === 'sm' ? 12 : 13

  return (
    <Box
      sx={{
        display: 'flex',
        p: '2px',
        bgcolor: 'rgba(118,118,128,0.12)',
        borderRadius: `${size === 'sm' ? 8 : 9}px`,
        ...sx,
      }}
    >
      {opts.map((o) => {
        const selected = o.value === value
        return (
          <Box
            key={o.value}
            component={motion.button}
            type="button"
            onClick={() => onChange(o.value)}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            sx={{
              flex: 1,
              minWidth: 0,
              height: h,
              border: 'none',
              cursor: 'pointer',
              borderRadius: `${size === 'sm' ? 6 : 7}px`,
              fontSize: fs,
              fontWeight: selected ? 600 : 500,
              letterSpacing: '-0.01em',
              color: selected ? (accent || ios.label) : ios.secondary,
              bgcolor: selected ? '#FFFFFF' : 'transparent',
              boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.12), 0 0.5px 1px rgba(0,0,0,0.08)' : 'none',
              transition: 'color .2s, background-color .2s, box-shadow .2s',
              px: 0.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'inherit',
            }}
          >
            {o.label}
          </Box>
        )
      })}
    </Box>
  )
}
