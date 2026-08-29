import { useState, useMemo, memo } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, IconButton,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CardHeaderBar from './CardHeaderBar'
import { fmt, loadCategories, countsAsSpending } from '../utils/finance'
import { CHART_COLORS, SPEND_TYPES, SPEND_TYPE_COLORS, CARDS, loadCategoryBudgets, saveCategoryBudgets, upsertFixedItem, upsertVarItem } from '../utils/ccStorage'
import AmountField from './AmountField'
import ExpenseDialog from './ExpenseDialog'

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

function CategoryChartBase({ fixedList, varList }) {
  const { all, entries, data } = useMemo(() => {
    const all = [...fixedList, ...varList]
    const map = {}
    all.filter(countsAsSpending).forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    const data = entries.map(([label, value]) => ({ label, value }))
    return { all, entries, data }
  }, [fixedList, varList])

  if (all.length === 0) return null

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar title="カテゴリ別グラフ" />
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
                  <Box sx={{ height: 6, bgcolor: 'var(--surface-muted)', borderRadius: 2, overflow: 'hidden' }}>
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

function CategoryBreakdownBase({ fixedList, varList, cardId, ym, onUpdate, prevFixedList = [], prevVarList = [] }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [detailView, setDetailView] = useState('list') // 'list' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [budgets, setBudgets] = useState(loadCategoryBudgets)
  const [budgetDlg, setBudgetDlg] = useState(null)

  const { all, entries, grandTotal, prevMap } = useMemo(() => {
    const all = [...fixedList, ...varList]
    const map = {}
    all.filter(countsAsSpending).forEach((x) => { map[x.category] = (map[x.category] ?? 0) + x.amount })
    const grandTotal = Object.values(map).reduce((s, v) => s + v, 0)
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    const prevMap = {}
    ;[...prevFixedList, ...prevVarList].filter(countsAsSpending).forEach((x) => { prevMap[x.category] = (prevMap[x.category] ?? 0) + x.amount })
    return { all, entries, grandTotal, prevMap }
  }, [fixedList, varList, prevFixedList, prevVarList])

  if (all.length === 0) return null

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
    setDetailView('edit')
  }

  // 保存は固定費/変動費の共通ダイアログ（ExpenseDialog）から呼ばれる。
  // カード変更に伴う保存先の移し替えは ccStorage 側に集約してあるので、
  // ここでは表示用のメタ（_type / _cardId）を落として渡すだけにする。
  function saveEdit({ cardId: nextCard, ...data }) {
    if (!editTarget) return
    const fromCard = editTarget._cardId ?? cardId
    const toCard   = nextCard ?? fromCard

    const { _type, _cardId, ...rest } = editTarget
    const item = { ...rest, ...data }

    if (_type === 'fixed') upsertFixedItem({ item, fromCard, toCard })
    else                   upsertVarItem({ item, fromCard, fromYm: ym, toCard })

    onUpdate?.()
    if (data.category !== selectedCat || toCard !== fromCard) closeDetail()
    else { setDetailView('list'); setEditTarget(null) }
  }

  const categories = loadCategories()
  const interactive = !!(cardId || fixedList.some(x => x._cardId) || varList.some(x => x._cardId))

  return (
    <>
      <Card sx={{ mb: 1.5 }}>
        <CardHeaderBar title="カテゴリ別集計" />
        <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
          {entries.map(([cat, total], i) => {
            const pct   = grandTotal > 0 ? Math.round(total / grandTotal * 100) : 0
            const color = CHART_COLORS[i % CHART_COLORS.length]
            const prevTotal = prevMap[cat] ?? 0
            const hasPrev = prevFixedList.length > 0 || prevVarList.length > 0
            const diff = hasPrev ? total - prevTotal : null
            const budget = budgets[cat]
            const budgetPct = budget ? Math.min(Math.round(total / budget * 100), 100) : null
            const budgetRaw = budget ? Math.round(total / budget * 100) : null
            const barColor = budgetRaw >= 90 ? '#ef9a9a' : budgetRaw >= 70 ? '#ffcc02' : '#a5d6a7'
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
                    {!budget && diff !== null && diff !== 0 && (
                      <Typography variant="caption" sx={{ fontSize: 10, color: diff > 0 ? '#c62828' : '#2e7d32', fontWeight: 600 }}>
                        {diff > 0 ? '+' : ''}¥{fmt(Math.abs(diff))}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>{pct}%</Typography>
                      <Typography variant="body2" fontWeight={600}>¥{fmt(total)}</Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      onClick={e => { e.stopPropagation(); setBudgetDlg({ cat, value: budget ? String(budget) : '' }) }}
                      sx={{
                        fontSize: 10,
                        color: budget ? '#546e7a' : 'text.disabled',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {budget ? `¥${fmt(budget)}` : '予算設定'}
                    </Typography>
                  </Stack>
                </Stack>
                {budget && (
                  <Stack direction="row" alignItems="center" gap={1} sx={{ pb: 0.75 }}>
                    <Box sx={{ flex: 1, height: 5, bgcolor: 'var(--surface-muted)', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${budgetPct}%`, bgcolor: barColor, borderRadius: 2 }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', flexShrink: 0 }}>
                      {budgetRaw}%
                    </Typography>
                  </Stack>
                )}
              </Box>
            )
          })}
        </CardContent>
      </Card>

      {/* カテゴリ内訳（一覧） */}
      <Dialog open={!!selectedCat && detailView === 'list'} onClose={closeDetail} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1, fontSize: 16 }}>{selectedCat}の内訳</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Stack divider={<Divider />}>
            {catItems.map(item => (
              <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
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
                    {item._cardId && (
                      <Chip
                        label={CARDS[item._cardId]?.shortName ?? item._cardId}
                        size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: CARDS[item._cardId]?.color ?? '#ccc', color: '#fff' }}
                      />
                    )}
                    <Typography variant="body2" noWrap>{item.name}</Typography>
                  </Stack>
                  {item._type === 'var' && item.date && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', pl: 3.5 }}>{item.date}</Typography>
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                  <Typography variant="body2" fontWeight={600}>¥{fmt(item.amount)}</Typography>
                  <IconButton size="small" aria-label="編集" onClick={() => openEdit(item)} sx={{ color: 'text.secondary' }}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetail}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 編集はクレカタブと同じ共通ダイアログを使う（入力方法を統一するため） */}
      {detailView === 'edit' && editTarget && (
        <ExpenseDialog
          open
          onClose={() => { setDetailView('list'); setEditTarget(null) }}
          onSave={saveEdit}
          initial={editTarget}
          categories={categories}
          cardId={editTarget._cardId ?? cardId}
          isFixed={editTarget._type === 'fixed'}
          title={editTarget._type === 'fixed' ? '固定費を編集' : '変動費を編集'}
        />
      )}

      <Dialog open={!!budgetDlg} onClose={() => setBudgetDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>{budgetDlg?.cat} の月間予算</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <AmountField
            value={budgetDlg?.value ?? ''}
            onChange={v => setBudgetDlg(d => ({ ...d, value: v }))}
            label="月間予算（円）"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          {budgets[budgetDlg?.cat] && (
            <Button color="error" size="small" onClick={() => {
              const next = { ...budgets }; delete next[budgetDlg.cat]
              setBudgets(next); saveCategoryBudgets(next); setBudgetDlg(null)
            }}>削除</Button>
          )}
          <Button onClick={() => setBudgetDlg(null)} size="small">キャンセル</Button>
          <Button variant="contained" size="small" onClick={() => {
            const amt = parseInt(budgetDlg?.value, 10)
            if (!isNaN(amt) && amt > 0) {
              const next = { ...budgets, [budgetDlg.cat]: amt }
              setBudgets(next); saveCategoryBudgets(next)
            }
            setBudgetDlg(null)
          }}>保存</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// 消費分類は変動費のみが対象（固定費は分類を持たない）。
function SpendTypeChartBase({ varList }) {
  const { all, totals, grandTotal } = useMemo(() => {
    const all = varList.filter((x) => x.sign !== 1 && countsAsSpending(x))
    const totals = {}
    SPEND_TYPES.forEach(t => { totals[t] = 0 })
    all.forEach(x => {
      const t = x.spendType ?? '消費'
      totals[t] = (totals[t] ?? 0) + x.amount
    })
    const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
    return { all, totals, grandTotal }
  }, [varList])

  if (all.length === 0) return null
  if (grandTotal === 0) return null

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar title="消費分類" />
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
                <Box sx={{ height: 5, bgcolor: 'var(--surface-muted)', borderRadius: 2, overflow: 'hidden' }}>
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

// props（fixedList/varList など）の参照が変わらなければ再レンダーをスキップ。
// 親（Kakeibo / CreditCard）で配列を useMemo 化しているため memo が有効に働く。
export const CategoryChart = memo(CategoryChartBase)
export const CategoryBreakdown = memo(CategoryBreakdownBase)
export const SpendTypeChart = memo(SpendTypeChartBase)
