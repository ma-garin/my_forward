import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider, Button, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material'
import { fmt } from '../utils/finance'
import {
  CARDS, LIVING_CATEGORIES, loadVar, loadWeeklyBudget, saveWeeklyBudget,
  getThisWeekRange, getRecentWeeks, sumLiving, sumLivingByCategory,
  countFridaysUntil, getBillingMonthsForRange,
} from '../utils/ccStorage'
import AmountField from './AmountField'
import { useThemeMode } from '../ThemeModeContext'
import Section from './apple/Section'
import Segmented from './apple/Segmented'
import Meter from './apple/Meter'
import { ios, CAT_IOS, statusColor } from './apple/tokens'

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const CAT_COLORS = { '食費': '#a5d6a7', '日用品': '#80cbc4', '生活費': '#80deea' }

function MiniBar({ pct, color, apple }) {
  if (apple) {
    return <Box sx={{ flex: 1 }}><Meter pct={pct} color={pct >= 80 ? statusColor(pct >= 100 ? 95 : 75) : color} height={5} /></Box>
  }
  const fill = pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffe082' : (color ?? 'rgba(255,255,255,.6)')
  return (
    <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,.18)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <Box sx={{ height: '100%', width: `${Math.min(pct, 100)}%`, bgcolor: fill, borderRadius: 2, transition: 'width .3s' }} />
    </Box>
  )
}

function CatBreakdown({ catMap, total, apple }) {
  return (
    <Box sx={{ mt: 1 }}>
      {LIVING_CATEGORIES.map(cat => {
        const amount = catMap[cat] ?? 0
        const pct = total > 0 ? amount / total * 100 : 0
        return (
          <Stack key={cat} direction="row" alignItems="center" spacing={1} sx={{ mb: apple ? 0.75 : 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: apple ? 13 : 10, opacity: apple ? 1 : .75, color: apple ? ios.secondary : undefined, width: apple ? 48 : 40, flexShrink: 0 }}>{cat}</Typography>
            <MiniBar pct={pct} color={apple ? (CAT_IOS[cat] ?? ios.accent) : CAT_COLORS[cat]} apple={apple} />
            <Typography variant="caption" sx={{ fontSize: apple ? 13 : 10, opacity: apple ? 1 : .85, color: apple ? ios.label : undefined, width: 56, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
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

  // ── サイクル（JCB: ym の 16日〜翌月15日）────────────────
  // ym はすでに請求月（Kakeibo から billingYm が渡される）
  const nextYm       = addMonth(ym, 1)
  const [nextY, nextM] = nextYm.split('-').map(Number)
  const cycleFromStr = `${ym}-16`
  const cycleToStr   = `${nextYm}-15`
  const cycleList    = [
    ...getBillingMonthsForRange(cycleFromStr, cycleToStr, jcbCutoff).flatMap(m => loadVar('jcb', m)),
    ...getBillingMonthsForRange(cycleFromStr, cycleToStr, smbcCutoff).flatMap(m => loadVar('smbc', m)),
  ]
  const cycleUsed    = sumLiving(cycleList, cycleFromStr, cycleToStr)
  const cycleCatMap  = sumLivingByCategory(cycleList, cycleFromStr, cycleToStr)
  const fridays      = countFridaysUntil(new Date(vy, vm - 1, cutoff), new Date(nextY, nextM - 1, cutoff))
  const monthlyBudget = fridays * weeklyBudget
  const cycleRemain  = monthlyBudget - cycleUsed
  const cyclePct     = monthlyBudget > 0 ? cycleUsed / monthlyBudget * 100 : 0
  const cycleLabel   = `${vm}月サイクル（${vm}/16〜${nextM}/15）`

  const handleSave = () => {
    const v = parseInt(editVal.replace(/,/g, ''), 10)
    if (!isNaN(v) && v > 0) { setWeeklyBudget(v); saveWeeklyBudget(v) }
    setEditOpen(false)
  }

  const { mode } = useThemeMode()
  const apple = mode === 'apple'

  // 週予算編集ダイアログ（両モード共通）
  const editDialog = (
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
  )

  // ─── Apple（iOS 設定アプリ風）────────────────────────────
  if (apple) {
    const remainColor = (r) => (r >= 0 ? ios.green : ios.red)
    return (
      <>
        <Section
          header={
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <span>生活費</span>
              <Box component="button" type="button" onClick={() => { setEditVal(String(weeklyBudget)); setEditOpen(true) }}
                sx={{ border: 'none', bgcolor: 'transparent', color: ios.accent, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', p: 0 }}>
                週予算 ¥{fmt(weeklyBudget)} を編集
              </Box>
            </Stack>
          }
        >
          <Box sx={{ p: 1.75 }}>
            <Segmented
              options={['今週', '週履歴', 'サイクル']}
              value={['今週', '週履歴', 'サイクル'][tab]}
              onChange={(v) => setTab(['今週', '週履歴', 'サイクル'].indexOf(v))}
            />

            {tab === 0 && (
              <Box sx={{ mt: 1.75 }}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 13, color: ios.secondary }}>週（{label.replace(' 〜 ', '–')}）</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: remainColor(weekRemain) }}>
                    {weekRemain >= 0 ? `残り ¥${fmt(weekRemain)}` : `¥${fmt(-weekRemain)} 超過`}
                  </Typography>
                </Stack>
                <Meter pct={weekPct} height={7} />
                <Typography sx={{ fontSize: 12.5, color: ios.secondary, mt: 0.75 }}>¥{fmt(weekUsed)} ／ ¥{fmt(weeklyBudget)}</Typography>
                <CatBreakdown catMap={weekCatMap} total={weekUsed} apple />
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ mt: 1.5 }}>
                {recentWeeks.map((w, i) => {
                  const wList = [
                    ...getBillingMonthsForRange(w.from, w.to, jcbCutoff).flatMap(m => loadVar('jcb', m)),
                    ...getBillingMonthsForRange(w.from, w.to, smbcCutoff).flatMap(m => loadVar('smbc', m)),
                  ]
                  const used   = sumLiving(wList, w.from, w.to)
                  const catMap = sumLivingByCategory(wList, w.from, w.to)
                  const pct    = weeklyBudget > 0 ? used / weeklyBudget * 100 : 0
                  const isOpen = expandedWeek === i
                  return (
                    <Box key={w.from} sx={{ mb: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}
                        onClick={() => setExpandedWeek(isOpen ? null : i)} sx={{ cursor: 'pointer' }}>
                        <Typography sx={{ fontSize: 12.5, color: i === 0 ? ios.label : ios.secondary, width: 72, flexShrink: 0 }}>{w.label}</Typography>
                        <MiniBar pct={pct} apple />
                        <Typography sx={{ fontSize: 13, width: 56, textAlign: 'right', flexShrink: 0, fontWeight: i === 0 ? 600 : 400, color: pct >= 100 ? ios.red : ios.label, fontVariantNumeric: 'tabular-nums' }}>¥{fmt(used)}</Typography>
                      </Stack>
                      <Collapse in={isOpen}>
                        <Box sx={{ pl: '84px' }}><CatBreakdown catMap={catMap} total={used} apple /></Box>
                      </Collapse>
                    </Box>
                  )
                })}
                <Typography sx={{ fontSize: 12, color: ios.tertiary, mt: 1 }}>週予算 ¥{fmt(weeklyBudget)}</Typography>
              </Box>
            )}

            {tab === 2 && (
              <Box sx={{ mt: 1.75 }}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 13, color: ios.secondary }}>{cycleLabel}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: remainColor(cycleRemain) }}>
                    {cycleRemain >= 0 ? `残り ¥${fmt(cycleRemain)}` : `¥${fmt(-cycleRemain)} 超過`}
                  </Typography>
                </Stack>
                <Meter pct={cyclePct} height={7} />
                <Typography sx={{ fontSize: 12.5, color: ios.secondary, mt: 0.75 }}>
                  ¥{fmt(cycleUsed)} ／ ¥{fmt(monthlyBudget)}（¥{fmt(weeklyBudget)}×{fridays}週）
                </Typography>
                <CatBreakdown catMap={cycleCatMap} total={cycleUsed} apple />
              </Box>
            )}
          </Box>
        </Section>
        {editDialog}
      </>
    )
  }

  // ─── Classic（現行）─────────────────────────────────────
  return (
    <>
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

        {/* セグメントボタン（タブ代替） */}
        <Stack direction="row" sx={{ bgcolor: 'rgba(0,0,0,.35)', borderRadius: 2, p: '3px', gap: '3px', mb: 1.5 }}>
          {['今週', '週履歴', 'サイクル'].map((lbl, i) => (
            <Button key={i} onClick={() => setTab(i)} disableRipple sx={{
              flex: 1, py: 0.5, fontSize: 12, lineHeight: 1.4, minHeight: 0,
              fontWeight: tab === i ? 700 : 500,
              color: tab === i ? '#1b5e20' : 'rgba(255,255,255,.85)',
              bgcolor: tab === i ? '#fff' : 'transparent',
              borderRadius: 1.5,
              textTransform: 'none',
              '&:hover': { bgcolor: tab === i ? '#fff' : 'rgba(255,255,255,.12)' },
            }}>{lbl}</Button>
          ))}
        </Stack>

        {/* Tab 0: 今週 */}
        {tab === 0 && (
          <Box>
            <Typography variant="caption" sx={{ fontSize: 11, opacity: .75, display: 'block', mb: 0.75 }}>
              生活費　週（{label.replace(' 〜 ', '-')}）
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <MiniBar pct={weekPct} />
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, flexShrink: 0, color: weekRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {weekRemain >= 0 ? `残り ¥${fmt(weekRemain)}` : `¥${fmt(-weekRemain)} 超過`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10, display: 'block', mb: 0.5 }}>
              ¥{fmt(weekUsed)} ／ ¥{fmt(weeklyBudget)}
            </Typography>
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
    </Card>
    {editDialog}
    </>
  )
}
