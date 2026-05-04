import { useState } from 'react'
import { Box, Card, CardContent, Typography, Stack, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material'
import { fmt } from '../utils/finance'
import {
  CARDS, loadVar, loadWeeklyBudget, saveWeeklyBudget,
  getThisWeekRange, getRecentWeeks, sumLiving, countFridaysUntil,
  getBillingMonthsForRange,
} from '../utils/ccStorage'
import AmountField from './AmountField'

export default function LivingExpenseCard({ ym }) {
  const [weeklyBudget, setWeeklyBudget] = useState(loadWeeklyBudget)
  const [editOpen, setEditOpen]         = useState(false)
  const [editVal, setEditVal]           = useState('')

  const { weekStartStr, weekEndStr, label } = getThisWeekRange()

  const jcbCutoff  = CARDS.jcb?.cutoffDay ?? 0
  const smbcCutoff = CARDS.smbc?.cutoffDay ?? 0
  const weekList   = [
    ...getBillingMonthsForRange(weekStartStr, weekEndStr, jcbCutoff).flatMap(m => loadVar('jcb', m)),
    ...getBillingMonthsForRange(weekStartStr, weekEndStr, smbcCutoff).flatMap(m => loadVar('smbc', m)),
  ]
  const weekUsed   = sumLiving(weekList, weekStartStr, weekEndStr)
  const weekRemain = weeklyBudget - weekUsed
  const weekPct    = weeklyBudget > 0 ? Math.min(weekUsed / weeklyBudget * 100, 100) : 0

  const monthList    = [...loadVar('jcb', ym), ...loadVar('smbc', ym)]
  const monthUsed    = sumLiving(monthList)
  const [vy, vm]     = ym.split('-').map(Number)
  const cutoff       = CARDS.jcb.cutoffDay
  const fridays      = countFridaysUntil(new Date(vy, vm - 1, cutoff), new Date(vy, vm, cutoff))
  const monthlyBudget = fridays * weeklyBudget
  const monthRemain  = monthlyBudget - monthUsed
  const monthPct     = monthlyBudget > 0 ? Math.min(monthUsed / monthlyBudget * 100, 100) : 0

  const barColor = (pct) => pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffe082' : 'rgba(255,255,255,.6)'

  const handleSave = () => {
    const v = parseInt(editVal.replace(/,/g, ''), 10)
    if (!isNaN(v) && v > 0) { setWeeklyBudget(v); saveWeeklyBudget(v) }
    setEditOpen(false)
  }

  return (
    <Card sx={{ mb: 2, bgcolor: '#1b5e20', color: '#fff' }}>
      <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>生活費</Typography>

        {/* 今週 */}
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="caption" sx={{ opacity: .8, fontSize: 11, fontWeight: 600 }}>今週</Typography>
            <Typography variant="caption" sx={{ opacity: .45, fontSize: 10 }}>{label}</Typography>
          </Stack>
          <Box sx={{ mt: 0.75, height: 5, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${weekPct}%`, bgcolor: barColor(weekPct), borderRadius: 3, transition: 'width .4s' }} />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: .65, fontSize: 10 }}>¥{fmt(weekUsed)} 使用 ／ ¥{fmt(weeklyBudget)}</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: weekRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
              {weekRemain >= 0 ? `残り ¥${fmt(weekRemain)}` : `¥${fmt(-weekRemain)} オーバー`}
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.25 }} />

        {/* 今月 */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="caption" sx={{ opacity: .8, fontSize: 11, fontWeight: 600 }}>今月（{vm}/{cutoff + 1}〜{vm === 12 ? 1 : vm + 1}/{cutoff}）</Typography>
            <Typography variant="caption" sx={{ opacity: .45, fontSize: 10 }}>¥{fmt(weeklyBudget)} × {fridays}週</Typography>
          </Stack>
          <Box sx={{ mt: 0.75, height: 5, bgcolor: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${monthPct}%`, bgcolor: barColor(monthPct), borderRadius: 3, transition: 'width .4s' }} />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: .65, fontSize: 10 }}>¥{fmt(monthUsed)} 使用 ／ ¥{fmt(monthlyBudget)}</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: monthRemain >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
              {monthRemain >= 0 ? `残り ¥${fmt(monthRemain)}` : `¥${fmt(-monthRemain)} オーバー`}
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.25 }} />

        {/* 直近4週履歴 */}
        {(() => {
          const weeks = getRecentWeeks(4)
          return (
            <Box>
              <Typography variant="caption" sx={{ opacity: .5, fontSize: 9, display: 'block', mb: 0.5 }}>直近4週</Typography>
              {weeks.map((w, i) => {
                const wList = [
                  ...getBillingMonthsForRange(w.from, w.to, jcbCutoff).flatMap(m => loadVar('jcb', m)),
                  ...getBillingMonthsForRange(w.from, w.to, smbcCutoff).flatMap(m => loadVar('smbc', m)),
                ]
                const used    = sumLiving(wList, w.from, w.to)
                const pct     = weeklyBudget > 0 ? Math.min(used / weeklyBudget * 100, 100) : 0
                const isThis  = i === 0
                return (
                  <Stack key={w.from} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: 9, opacity: isThis ? 1 : .5, width: 64, flexShrink: 0 }}>{w.label}</Typography>
                    <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(255,255,255,.15)', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: barColor(pct), borderRadius: 2 }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 9, opacity: isThis ? 1 : .6, width: 44, textAlign: 'right', flexShrink: 0 }}>¥{fmt(used)}</Typography>
                  </Stack>
                )
              })}
            </Box>
          )
        })()}

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.25 }} />

        {/* 週予算編集 */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ opacity: .6, fontSize: 10 }}>週予算 ¥{fmt(weeklyBudget)}</Typography>
          <Button size="small" onClick={() => { setEditVal(String(weeklyBudget)); setEditOpen(true) }}
            sx={{ color: 'rgba(255,255,255,.6)', fontSize: 10, minWidth: 0, px: 1, py: 0.25, textTransform: 'none' }}>
            編集
          </Button>
        </Stack>
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
