import { useState } from 'react'
import { Box, Typography, Stack, Chip, IconButton, Menu, MenuItem } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fmt } from '../utils/finance'
import { CATEGORY_COLORS, BORDER_LIGHT } from '../utils/ccStorage'

export function VarExpenseTable({ varList, onEdit, onDelete }) {
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, item }

  if (varList.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>
      この月の変動費を追加してください
    </Typography>
  )

  let running = 0
  const rows = varList.map((item) => {
    running += item.amount
    return { ...item, subtotal: running }
  })

  const grouped = []
  rows.forEach(item => {
    const d    = item.date ?? '—'
    const last = grouped[grouped.length - 1]
    if (last && last.date === d) last.items.push(item)
    else grouped.push({ date: d, items: [item] })
  })

  const shortDate = (d) => {
    if (!d || d === '—') return '—'
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }

  return (
    <>
      <Box sx={{ mx: -2 }}>
        {grouped.map(({ date, items }) => (
          <Box key={date}>
            <Box sx={{ px: 2, py: 0.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #eeeeee' }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                {shortDate(date)}
                <Typography component="span" variant="caption" sx={{ fontSize: 10, color: 'text.disabled', ml: 1 }}>
                  ¥{fmt(items.reduce((s, x) => s + x.amount, 0))}
                </Typography>
              </Typography>
            </Box>
            {items.map(item => (
              <Box key={item.id}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }) }}
                sx={{ px: 2, py: 0.75, borderBottom: BORDER_LIGHT, '&:hover': { bgcolor: '#f9fbe7' } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Chip label={item.category} size="small"
                      sx={{ height: 18, fontSize: 9, flexShrink: 0, bgcolor: CATEGORY_COLORS[item.category] ?? '#eceff1', color: '#37474f' }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </Typography>
                      {item.payee && (
                        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {item.payee}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Stack alignItems="flex-end" direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
                    <Stack alignItems="flex-end">
                      <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 700 }}>¥{fmt(item.amount)}</Typography>
                      <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>累計 ¥{fmt(item.subtotal)}</Typography>
                    </Stack>
                    <Stack>
                      <IconButton size="small" aria-label="編集" onClick={() => onEdit(item)} sx={{ p: 0.75 }}>
                        <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      </IconButton>
                      <IconButton size="small" aria-label="削除" onClick={() => onDelete(item.id)} sx={{ p: 0.75 }}>
                        <DeleteIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Menu open={!!ctxMenu} onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}>
        <MenuItem onClick={() => { onEdit(ctxMenu.item); setCtxMenu(null) }}>
          <EditIcon sx={{ mr: 1, fontSize: 16 }} />編集
        </MenuItem>
        <MenuItem onClick={() => { onDelete(ctxMenu.item.id); setCtxMenu(null) }} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 16 }} />削除
        </MenuItem>
      </Menu>
    </>
  )
}

export function DailyBarChart({ varList }) {
  if (varList.length === 0) return null

  const byDate = {}
  varList.forEach(x => {
    if (!x.date || x.sign === 1) return
    byDate[x.date] = (byDate[x.date] ?? 0) + x.amount
  })
  const dates = Object.keys(byDate).sort()
  if (dates.length === 0) return null

  const maxAmt   = Math.max(...Object.values(byDate))
  const CHART_H  = 80
  const BAR_W    = 28
  const todayStr = new Date().toISOString().slice(0, 10)
  const fmtAmt   = (v) => v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`

  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: '1px solid #f0f0f0' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>日別支出</Typography>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled' }}>最大 ¥{fmt(maxAmt)}</Typography>
      </Stack>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: CHART_H + 30, overflowX: 'auto', pb: 0.5 }}>
        {dates.map(d => {
          const amt  = byDate[d]
          const barH = Math.max(4, Math.round((amt / maxAmt) * CHART_H))
          const day  = parseInt(d.slice(8))
          const isToday = d === todayStr
          const isMax   = amt === maxAmt
          return (
            <Box key={d} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: BAR_W }}>
              <Typography variant="caption" sx={{ fontSize: 8, color: isMax ? '#e53935' : 'text.disabled', fontWeight: isMax ? 700 : 400, mb: 0.25, lineHeight: 1.2 }}>
                ¥{fmtAmt(amt)}
              </Typography>
              <Box sx={{ width: BAR_W - 4, height: barH, bgcolor: isToday ? '#1976d2' : isMax ? '#e53935' : '#90a4ae', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
              <Box sx={{ width: '100%', borderTop: '1px solid #e0e0e0', pt: 0.25 }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: isToday ? '#1976d2' : 'text.secondary', fontWeight: isToday ? 700 : 400, display: 'block', textAlign: 'center' }}>
                  {day}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
