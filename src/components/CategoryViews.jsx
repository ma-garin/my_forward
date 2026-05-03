import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { fmt, loadCategories } from '../utils/finance'
import { CHART_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS, saveFixed, saveVar } from '../utils/ccStorage'

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2
  const R  = size * 0.46
  const ri = size * 0.26
  const GAP = 0.025
  let angle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const full  = (d.value / total) * 2 * Math.PI
    const theta = Math.max(full - GAP, 0.001)
    const a1 = angle + GAP / 2
    const a2 = a1 + theta
    angle += full
    const large = theta > Math.PI ? 1 : 0
    const p = (a) => [cx + R  * Math.cos(a), cy + R  * Math.sin(a)]
    const q = (a) => [cx + ri * Math.cos(a), cy + ri * Math.sin(a)]
    const [ox1, oy1] = p(a1), [ox2, oy2] = p(a2)
    const [ix1, iy1] = q(a1), [ix2, iy2] = q(a2)
    const path = `M${ox1} ${oy1} A${R} ${R} 0 ${large} 1 ${ox2} ${oy2} L${ix2} ${iy2} A${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`
    return { path, color: CHART_COLORS[i % CHART_COLORS.length] }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={9} fill="#90a4ae">合計</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#37474f">
        ¥{fmt(total)}
      </text>
    </svg>
  )
}

export function CategoryChart({ fixedList, varList }) {
  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const total   = Object.values(map).reduce((s, v) => s + v, 0)
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
  const data    = entries.map(([label, value]) => ({ label, value }))

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          カテゴリ別グラフ
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <DonutChart data={data} size={140} />
          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            {entries.map(([cat, val], i) => {
              const pct = Math.round(val / total * 100)
              return (
                <Stack key={cat} spacing={0.4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontSize: 10 }} noWrap>{cat}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>{pct}%</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10 }}>¥{fmt(val)}</Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 6, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 2 }} />
                  </Box>
                </Stack>
              )
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function CategoryBreakdown({ fixedList, varList, cardId, ym, onUpdate, prevFixedList = [], prevVarList = [] }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [detailView, setDetailView] = useState('list') // 'list' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})

  const all = [...fixedList, ...varList]
  if (all.length === 0) return null

  const map = {}
  all.forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
  const grandTotal = Object.values(map).reduce((s, v) => s + v, 0)
  const entries    = Object.entries(map).sort((a, b) => b[1] - a[1])

  const prevMap = {}
  ;[...prevFixedList, ...prevVarList].forEach((x) => { prevMap[x.category] = (prevMap[x.category] ?? 0) + x.amount })

  const catItems = selectedCat ? [
    ...fixedList.filter(x => x.category === selectedCat).map(x => ({ ...x, _type: 'fixed' })),
    ...varList.filter(x => x.category === selectedCat).map(x => ({ ...x, _type: 'var' })),
  ].sort((a, b) => b.amount - a.amount) : []

  function openDetail(cat) {
    if (!cardId) return
    setSelectedCat(cat)
    setDetailView('list')
    setEditTarget(null)
  }

  function closeDetail() {
    setSelectedCat(null)
    setDetailView('list')
    setEditTarget(null)
  }

  function openEdit(item) {
    setEditTarget(item)
    setEditForm({
      name: item.name,
      amount: item.amount,
      category: item.category,
      spendType: item.spendType ?? '消費',
      date: item.date ?? '',
    })
    setDetailView('edit')
  }

  function saveEdit() {
    if (!editTarget) return
    const patch = {
      name: editForm.name,
      amount: Number(editForm.amount),
      category: editForm.category,
      spendType: editForm.spendType,
    }
    if (editTarget._type === 'fixed') {
      const updated = fixedList.map(x => x.id === editTarget.id ? { ...x, ...patch } : x)
      saveFixed(cardId, updated)
    } else {
      const updated = varList.map(x => x.id === editTarget.id ? { ...x, ...patch, date: editForm.date } : x)
      saveVar(cardId, ym, updated)
    }
    onUpdate?.()
    // カテゴリ名が変わった場合はダイアログを閉じる
    if (editForm.category !== selectedCat) {
      closeDetail()
    } else {
      setDetailView('list')
      setEditTarget(null)
    }
  }

  const categories = loadCategories()
  const interactive = !!cardId

  return (
    <>
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            カテゴリ別集計
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
          {entries.map(([cat, total], i) => {
            const pct   = grandTotal > 0 ? Math.round(total / grandTotal * 100) : 0
            const color = CHART_COLORS[i % CHART_COLORS.length]
            const prevTotal = prevMap[cat] ?? 0
            const hasPrev = prevFixedList.length > 0 || prevVarList.length > 0
            const diff = hasPrev ? total - prevTotal : null
            return (
              <Box
                key={cat}
                onClick={() => openDetail(cat)}
                sx={{
                  cursor: interactive ? 'pointer' : 'default',
                  borderRadius: 1,
                  mx: -1,
                  px: 1,
                  '&:hover': interactive ? { bgcolor: 'action.hover' } : {},
                }}
              >
                {i > 0 && <Divider />}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontSize: 12, color: '#546e7a' }}>{cat}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={1}>
                    {diff !== null && diff !== 0 && (
                      <Typography variant="caption" sx={{ fontSize: 10, color: diff > 0 ? '#c62828' : '#2e7d32', fontWeight: 600 }}>
                        {diff > 0 ? '+' : ''}¥{fmt(Math.abs(diff))}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>{pct}%</Typography>
                      <Typography variant="body2" fontWeight={600}>¥{fmt(total)}</Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
            )
          })}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCat} onClose={closeDetail} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1, fontSize: 16 }}>
          {detailView === 'list' ? `${selectedCat}の内訳` : '項目を編集'}
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {detailView === 'list' ? (
            <Stack divider={<Divider />}>
              {catItems.map(item => (
                <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
                  <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Chip
                        label={item._type === 'fixed' ? '固定' : '変動'}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          bgcolor: item._type === 'fixed' ? '#eceff1' : '#e0f2f1',
                          color: item._type === 'fixed' ? '#546e7a' : '#00695c',
                        }}
                      />
                      <Typography variant="body2" noWrap>{item.name}</Typography>
                    </Stack>
                    {item._type === 'var' && item.date && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', pl: 3.5 }}>{item.date}</Typography>
                    )}
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                    <Typography variant="body2" fontWeight={600}>¥{fmt(item.amount)}</Typography>
                    <IconButton size="small" onClick={() => openEdit(item)} sx={{ color: 'text.secondary' }}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="名称"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                fullWidth size="small"
              />
              <TextField
                label="金額"
                type="number"
                value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                fullWidth size="small"
                inputProps={{ min: 0 }}
              />
              <FormControl fullWidth size="small">
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={editForm.category}
                  label="カテゴリ"
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                >
                  {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>消費分類</InputLabel>
                <Select
                  value={editForm.spendType}
                  label="消費分類"
                  onChange={e => setEditForm(f => ({ ...f, spendType: e.target.value }))}
                >
                  {SPEND_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              {editTarget?._type === 'var' && (
                <TextField
                  label="日付"
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  fullWidth size="small"
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {detailView === 'list' ? (
            <Button onClick={closeDetail}>閉じる</Button>
          ) : (
            <>
              <Button onClick={() => setDetailView('list')}>戻る</Button>
              <Button onClick={saveEdit} variant="contained" disabled={!editForm.name || !editForm.amount}>保存</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export function SpendTypeChart({ fixedList, varList }) {
  const all = [...fixedList, ...varList].filter(x => x.sign !== 1)
  if (all.length === 0) return null

  const totals = {}
  SPEND_TYPES.forEach(t => { totals[t] = 0 })
  all.forEach(x => {
    const t = x.spendType ?? '消費'
    totals[t] = (totals[t] ?? 0) + x.amount
  })

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grandTotal === 0) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          消費分類
        </Typography>
      </Box>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 2 } }}>
        {/* 積み上げバー */}
        <Box sx={{ height: 12, borderRadius: 2, overflow: 'hidden', display: 'flex', mb: 1.5 }}>
          {SPEND_TYPES.map(t => {
            const pct = grandTotal > 0 ? (totals[t] / grandTotal) * 100 : 0
            return pct > 0 ? (
              <Box key={t} sx={{ width: `${pct}%`, bgcolor: SPEND_TYPE_COLORS[t], height: '100%' }} />
            ) : null
          })}
        </Box>
        {/* 凡例 */}
        <Stack spacing={0.75}>
          {SPEND_TYPES.map(t => {
            const val = totals[t]
            const pct = grandTotal > 0 ? Math.round(val / grandTotal * 100) : 0
            return (
              <Stack key={t} spacing={0.3}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SPEND_TYPE_COLORS[t], flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontSize: 12 }}>{t}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="baseline" gap={0.5}>
                    <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{pct}%</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>¥{fmt(val)}</Typography>
                  </Stack>
                </Stack>
                <Box sx={{ height: 5, bgcolor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: SPEND_TYPE_COLORS[t], borderRadius: 2 }} />
                </Box>
              </Stack>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}
