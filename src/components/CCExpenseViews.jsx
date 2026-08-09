import { useState } from 'react'
import { Box, Typography, Stack, Chip, IconButton, Menu, MenuItem, Checkbox } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fmt } from '../utils/finance'
import { CATEGORY_COLORS, BORDER_LIGHT, SPEND_TYPE_COLORS } from '../utils/ccStorage'

// ─── 共通スタイル ─────────────────────────────────────────

const SUBLINE_SX = {
  fontSize: 10, color: 'text.disabled', lineHeight: 1.2, display: 'block',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const GROUP_HEAD_SX = { px: 2, py: 0.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #eeeeee' }

/**
 * 固定費・変動費で共通の 1 行。
 * 左: [チェック（固定費のみ）] カテゴリ / 消費分類 / 項目名 / 補足行
 * 右: 金額 / 累計 と 編集・削除
 * 見せ方が両者で食い違わないよう、必ずこのコンポーネントを使う。
 */
export function ExpenseRow({
  category, spendType, sign, name, payee, notes = [], amount, subtotal,
  billed = false, onToggleBilled, onEdit, onDelete, onContextMenu,
}) {
  return (
    <Box
      onContextMenu={onContextMenu}
      sx={{
        px: 2, py: 0.75, borderBottom: BORDER_LIGHT,
        opacity: billed ? 0.55 : 1,
        '&:hover': { bgcolor: '#f9fbe7' },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
          {onToggleBilled && (
            <Checkbox
              checked={billed} onChange={onToggleBilled} size="small" aria-label="引き落とし済み"
              sx={{ p: 0.25, ml: -0.75, flexShrink: 0, color: '#bdbdbd', '&.Mui-checked': { color: '#43a047' } }}
            />
          )}
          <Chip label={category} size="small"
            sx={{ height: 18, fontSize: 9, flexShrink: 0, bgcolor: CATEGORY_COLORS[category] ?? '#eceff1', color: '#37474f' }} />
          {spendType && sign !== 1 && (
            <Chip label={spendType} size="small" sx={{
              height: 16, fontSize: 8, flexShrink: 0,
              bgcolor: SPEND_TYPE_COLORS[spendType] ?? '#eceff1', color: '#fff',
            }} />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{
              fontSize: 12, fontWeight: 500, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              ...(billed ? { textDecoration: 'line-through', color: '#9e9e9e' } : {}),
            }}>
              {name}
            </Typography>
            {payee && <Typography variant="caption" sx={SUBLINE_SX}>{payee}</Typography>}
            {notes.filter(Boolean).map(n => (
              <Typography key={n} variant="caption" sx={SUBLINE_SX}>{n}</Typography>
            ))}
          </Box>
        </Stack>
        <Stack alignItems="flex-end" direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
          <Stack alignItems="flex-end">
            <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 700 }}>¥{fmt(amount)}</Typography>
            {subtotal != null && (
              <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>累計 ¥{fmt(subtotal)}</Typography>
            )}
          </Stack>
          <Stack>
            <IconButton size="small" aria-label="編集" onClick={onEdit} sx={{ p: 0.75 }}>
              <EditIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            </IconButton>
            <IconButton size="small" aria-label="削除" onClick={onDelete} sx={{ p: 0.75 }}>
              <DeleteIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            </IconButton>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}

/** グループ見出し（変動費=日付 / 固定費=支払日）。両者で同じ体裁にする。 */
export function ExpenseGroupHeader({ label, total }) {
  return (
    <Box sx={GROUP_HEAD_SX}>
      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
        {label}
        <Typography component="span" variant="caption" sx={{ fontSize: 10, color: 'text.disabled', ml: 1 }}>
          ¥{fmt(total)}
        </Typography>
      </Typography>
    </Box>
  )
}

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
      <Box>
        {grouped.map(({ date, items }) => (
          <Box key={date}>
            <ExpenseGroupHeader label={shortDate(date)} total={items.reduce((s, x) => s + x.amount, 0)} />
            {items.map(item => (
              <ExpenseRow
                key={item.id}
                category={item.category} spendType={item.spendType} sign={item.sign}
                name={item.name} payee={item.payee}
                amount={item.amount} subtotal={item.subtotal}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item.id)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }) }}
              />
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
      {/* 高さは固定しない。固定値だと最も高い棒の金額ラベルが入りきらず上で切れる。
          列の中身（ラベル + 棒 + 日付軸）で自然に高さが決まるようにする。 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', minHeight: CHART_H + 30, overflowX: 'auto', overflowY: 'hidden', pb: 0.5 }}>
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
