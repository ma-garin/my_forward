import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider, Button, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab,
} from '@mui/material'
import { fmt } from '../utils/finance'
import {
  CARDS, LIVING_CATEGORIES, loadVar, loadWeeklyBudget, saveWeeklyBudget,
  getThisWeekRange, getRecentWeeks, sumLiving, sumLivingByCategory,
  countFridaysUntil, getBillingMonthsForRange,
} from '../utils/ccStorage'
import AmountField from './AmountField'

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const CAT_COLORS = { '食費': '#a5d6a7', '日用品': '#80cbc4', '生活費': '#80deea' }

function MiniBar({ pct, color }) {
  const fill = pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffe082' : (color ?? 'rgba(255,255,255,.6)')
  return (
    <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,.18)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <Box sx={{ height: '100%', width: `${Math.min(pct, 100)}%`, bgcolor: fill, borderRadius: 2, transition: 'width .3s' }} />
    </Box>
  )
}

function CatBreakdown({ catMap, total }) {
  return (
    <Box sx={{ mt: 1 }}>
      {LIVING_CATEGORIES.map(cat => {
        const amount = catMap[cat] ?? 0
        const pct = total > 0 ? amount / total * 100 : 0
        return (
          <Stack key={cat} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: 10, opacity: .75, width: 40, flexShrink: 0 }}>{cat}</Typography>
            <MiniBar pct={pct} color={CAT_COLORS[cat]} />
            <Typography variant="caption" sx={{ fontSize: 10, opacity: .85, width: 52, textAlign: 'right', flexShrink: 0 }}>
              ¥{fmt(amount)}
            </Typography>
          </Stack>
        )
      })}
    </Box>
  )
}

export default function LivingExpenseCard({ ym }) {
  const [tab, setTab]                   = useState(0)
  const [weeklyBudget, setWeeklyBudget] = useState(loadWeeklyBudget)
  const [editOpen, setEditOpen]         = useState(false)
  const [editVal, setEditVal]           = useState('')
  const [expandedWeek, setExpandedWeek] = useState(null)

  const jcbCutoff  = CARDS.jcb?.cutoffDay ?? 15
  const smbcCutoff = CARDS.smbc?.cutoffDay ?? 0
  const cutoff     = jcbCutoff
  const [vy, vm]   = ym.split('-').map(Number)

  // ── 今週 ──────────────────────────────────────────────────
  const { weekStartStr, weekEndStr, label } = getThisWeekRange()
  const weekList = [
    ...getBillingMonthsForRange(weekStartStr, weekEndStr, jcbCutoff).flatMap(m => loadVar('jcb', m)),
    ...getBillingMonthsForRange(weekStartStr, weekEndStr, smbcCutoff).flatMap(m => loadVar('smbc', m)),
  ]
  const weekUsed   = sumLiving(weekList, weekStartStr, weekEndStr)
  const weekCatMap = sumLivingByCategory(weekList, weekStartStr, weekEndStr)
  const weekRemain = weeklyBudget - weekUsed
  const weekPct    = weeklyBudget > 0 ? weekUsed / weeklyBudget * 100 : 0

  // ── 週履歴 ────────────────────────────────────────────────
  const recentWeeks = getRecentWeeks(4)

  // ── サイクル（JCB: 前月16日〜当月15日）──────────────────
  const prevYm       = addMonth(ym, -1)
  const [prevY, prevM] = prevYm.split('-').map(Number)
  const cycleFromStr = `${prevYm}-16`
  const cycleToStr   = `${vy}-${String(vm).padStart(2, '0')}-15`
  const cycleList    = [
    ...getBillingMonthsForRange(cycleFromStr, cycleToStr, jcbCutoff).flatMap(m => loadVar('jcb', m)),
    ...getBillingMonthsForRange(cycleFromStr, cycleToStr, smbcCutoff).flatMap(m => loadVar('smbc', m)),
  ]
  const cycleUsed    = sumLiving(cycleList, cycleFromStr, cycleToStr)
  const cycleCatMap  = sumLivingByCategory(cycleList, cycleFromStr, cycleToStr)
  const fridays      = countFridaysUntil(new Date(prevY, prevM - 1, cutoff), new Date(vy, vm - 1, cutoff))
  const monthlyBudget = fridays * weeklyBudget
  const cycleRemain  = monthlyBudget - cycleUsed
  const cyclePct     = monthlyBudget > 0 ? cycleUsed / monthlyBudget * 100 : 0
  const cycleLabel   = `${prevM}月サイクル（${prevM}/16〜${vm}/15）`

  const handleSave = () => {
    const v = parseInt(editVal.replace(/,/g, ''), 10)
    if (!isNaN(v) && v > 0) { setWeeklyBudget(v); saveWeeklyBudget(v) }
    setEditOpen(false)
  }

  return (
    <Card sx={{ mb: 2, bgcolor: '#1b5e20', color: '#fff' }}>
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>

        {/* ヘッダー */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>生活費</Typography>
          <Button size="small" onClick={() => { setEditVal(String(weeklyBudget)); setEditOpen(true) }}
            sx={{ color: 'rgba(255,255,255,.5)', fontSize: 10, minWidth: 0, px: 1, py: 0, textTransform: 'none' }}>
            週予算 ¥{fmt(weeklyBudget)} 編集
          </Button>
        </Stack>

        {/* タブ */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          minHeight: 28, mb: 1.5,
          '& .MuiTab-root': { color: 'rgba(255,255,255,.45)', minHeight: 28, fontSize: 11, py: 0, px: 1.5, textTransform: 'none' },
          '& .Mui-selected': { color: '#fff' },
          '& .MuiTabs-indicator': { bgcolor: '#a5d6a7' },
        }}>
          <Tab label="今週" />
          <Tab label="週履歴" />
          <Tab label="サイクル" />
        </Tabs>

        {/* Tab 0: 今週 */}
        {tab === 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <MiniBar pct={weekPct} />
              <Typography variant="caption" sx={{ fontSize: 10, opacity: .5, flexShrink: 0 }}>{label}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>¥{fmt(weekUsed)} ／ ¥{fmt(weeklyBudget)}</Typography>
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: weekRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {weekRemain >= 0 ? `残り ¥${fmt(weekRemain)}` : `¥${fmt(-weekRemain)} オーバー`}
              </Typography>
            </Stack>
            <CatBreakdown catMap={weekCatMap} total={weekUsed} />
          </Box>
        )}

        {/* Tab 1: 週履歴 */}
        {tab === 1 && (
          <Box>
            {recentWeeks.map((w, i) => {
              const wList = [
                ...getBillingMonthsForRange(w.from, w.to, jcbCutoff).flatMap(m => loadVar('jcb', m)),
                ...getBillingMonthsForRange(w.from, w.to, smbcCutoff).flatMap(m => loadVar('smbc', m)),
              ]
              const used   = sumLiving(wList, w.from, w.to)
              const catMap = sumLivingByCategory(wList, w.from, w.to)
              const pct    = weeklyBudget > 0 ? used / weeklyBudget * 100 : 0
              const over   = pct >= 100
              const isOpen = expandedWeek === i
              return (
                <Box key={w.from} sx={{ mb: 0.75 }}>
                  <Stack direction="row" alignItems="center" spacing={1}
                    onClick={() => setExpandedWeek(isOpen ? null : i)}
                    sx={{ cursor: 'pointer' }}>
                    <Typography variant="caption" sx={{ fontSize: 10, opacity: i === 0 ? 1 : .55, width: 70, flexShrink: 0 }}>{w.label}</Typography>
                    <MiniBar pct={pct} />
                    <Typography variant="caption" sx={{ fontSize: 10, width: 50, textAlign: 'right', flexShrink: 0, fontWeight: i === 0 ? 600 : 400, color: over ? '#ef9a9a' : undefined, opacity: i === 0 ? 1 : .7 }}>
                      ¥{fmt(used)}
                    </Typography>
                  </Stack>
                  <Collapse in={isOpen}>
                    <Box sx={{ pl: '82px' }}>
                      <CatBreakdown catMap={catMap} total={used} />
                    </Box>
                  </Collapse>
                </Box>
              )
            })}
            <Divider sx={{ borderColor: 'rgba(255,255,255,.1)', my: 0.75 }} />
            <Typography variant="caption" sx={{ fontSize: 9, opacity: .4 }}>週予算 ¥{fmt(weeklyBudget)}</Typography>
          </Box>
        )}

        {/* Tab 2: サイクル */}
        {tab === 2 && (
          <Box>
            <Typography variant="caption" sx={{ fontSize: 10, opacity: .55, display: 'block', mb: 1 }}>{cycleLabel}</Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <MiniBar pct={cyclePct} />
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, flexShrink: 0, color: cycleRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {cycleRemain >= 0 ? `残り ¥${fmt(cycleRemain)}` : `¥${fmt(-cycleRemain)} 超過`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ opacity: .5, fontSize: 10, display: 'block', mb: 1 }}>
              ¥{fmt(cycleUsed)} ／ ¥{fmt(monthlyBudget)}（¥{fmt(weeklyBudget)}×{fridays}週）
            </Typography>
            <CatBreakdown catMap={cycleCatMap} total={cycleUsed} />
          </Box>
        )}

      </CardContent>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>週予算を編集</DialogTitle>
        <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AmountField value={editVal} onChange={setEditVal} label="週予算（円）" autoFocus />
          <Divider><Typography variant="caption" color="text.secondary">または月予算から逆算</Typography></Divider>
          <Box>
            <TextField
              label={`月予算（÷ ${fridays}週 で割算）`}
              size="small" fullWidth type="number" inputProps={{ min: 0 }}
              onChange={(e) => {
                const monthly = parseInt(e.target.value, 10)
                if (!isNaN(monthly) && monthly > 0 && fridays > 0) setEditVal(String(Math.round(monthly / fridays)))
              }}
              helperText="入力すると週予算欄に自動反映されます"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} size="small">キャンセル</Button>
          <Button onClick={handleSave} variant="contained" size="small">保存</Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
