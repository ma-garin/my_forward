import { useState, useMemo } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider,
  IconButton, Chip,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import RepeatIcon from '@mui/icons-material/Repeat'
import SavingsIcon from '@mui/icons-material/Savings'
import { getSalaryTakeHome, getCCTotal, loadFixedEvents } from '../utils/finance'

// ─── ユーティリティ ───────────────────────────────────────────

function fmt(n) { return Math.abs(n).toLocaleString('ja-JP') }

function ymStr(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

// ym を N ヶ月進める（n < 0 で過去方向）
function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return ymStr(d.getFullYear(), d.getMonth() + 1)
}

// 指定 ym の月の日数
function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// 週次固定費の月発生回数（実際の曜日カウント）
function weeklyCount(ym, dayOfWeek) {
  const days = daysInMonth(ym)
  const [y, m] = ym.split('-').map(Number)
  let count = 0
  for (let d = 1; d <= days; d++) {
    if (new Date(y, m - 1, d).getDay() === dayOfWeek) count++
  }
  return count
}

// ─── 月別データ計算 ───────────────────────────────────────────

function calcMonthData(ym) {
  const salary = getSalaryTakeHome()

  // 固定費（支出のみ、振替除く）- 月次＋週次
  const fixedEvts = loadFixedEvents()
  const fixedItems = []
  let fixedCost = 0

  fixedEvts.forEach((fe) => {
    if (fe.type === 'transfer' || fe.sign !== -1) return
    const count = fe.frequency === 'weekly' ? weeklyCount(ym, fe.dayOfWeek) : 1
    const amt = fe.amount * count
    fixedItems.push({ name: fe.name, amount: amt, weekly: fe.frequency === 'weekly', count })
    fixedCost += amt
  })

  // クレカ請求（前月分が当月引き落とし）
  const [y, m] = ym.split('-').map(Number)
  const prevYm = ymStr(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
  const jcbAmt  = getCCTotal('jcb',  prevYm).total
  const smbcAmt = getCCTotal('smbc', prevYm).total
  const ccTotal = jcbAmt + smbcAmt

  const remaining = salary - fixedCost - ccTotal

  return { ym, salary, fixedCost, fixedItems, jcbAmt, smbcAmt, ccTotal, remaining }
}

// 過去 N ヶ月 + 当月 の ym 配列（古い順）
function buildYmList(baseYm, count) {
  const list = []
  for (let i = count - 1; i >= 0; i--) list.push(addMonth(baseYm, -i))
  return list
}

// ─── グラフ ───────────────────────────────────────────────────

function BarChart({ data }) {
  const W = 340, H = 120, PAD = 8
  const innerW = W - PAD * 2
  const barW = (innerW / data.length) * 0.6
  const gap   = innerW / data.length

  const maxVal = Math.max(...data.map(d => Math.abs(d.remaining)), 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      {/* ゼロライン */}
      <line x1={PAD} x2={W - PAD} y1={H - 24} y2={H - 24} stroke="#cfd8dc" strokeWidth={1} />
      {data.map((d, i) => {
        const cx = PAD + gap * i + gap / 2
        const isPos = d.remaining >= 0
        const barH = (Math.abs(d.remaining) / maxVal) * (H - 40)
        const barY = isPos ? (H - 24 - barH) : (H - 24)
        const [, mm] = d.ym.split('-').map(Number)
        return (
          <g key={d.ym}>
            <rect
              x={cx - barW / 2} y={barY} width={barW} height={barH}
              rx={3}
              fill={isPos ? '#43a047' : '#e53935'}
              opacity={0.85}
            />
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#78909c">{mm}月</text>
            <text x={cx} y={isPos ? barY - 3 : barY + barH + 10}
              textAnchor="middle" fontSize={8}
              fill={isPos ? '#2e7d32' : '#c62828'}>
              {isPos ? '+' : '−'}{fmt(d.remaining / 10000)}万
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function CumLineChart({ data }) {
  const W = 340, H = 90, PAD = 16
  const innerW = W - PAD * 2

  let cum = 0
  const points = data.map((d, i) => {
    cum += d.remaining
    return { x: PAD + (innerW / (data.length - 1 || 1)) * i, cum }
  })

  const maxC = Math.max(...points.map(p => p.cum), 1)
  const minC = Math.min(...points.map(p => p.cum), 0)
  const range = maxC - minC || 1

  const toY = (v) => PAD + (1 - (v - minC) / range) * (H - PAD * 2)

  const path = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${toY(p.cum).toFixed(1)}`
  ).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <polyline points={points.map(p => `${p.x.toFixed(1)},${toY(p.cum).toFixed(1)}`).join(' ')}
        fill="none" stroke="#1565c0" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => {
        const [, mm] = data[i].ym.split('-').map(Number)
        return (
          <g key={i}>
            <circle cx={p.x} cy={toY(p.cum)} r={3} fill="#1565c0" />
            <text x={p.x} y={toY(p.cum) - 6} textAnchor="middle" fontSize={8} fill="#1565c0">
              {p.cum >= 0 ? '+' : ''}{(p.cum / 10000).toFixed(1)}万
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────

export default function AssetFlowSimulation() {
  const today = new Date()
  const [baseYm, setBaseYm] = useState(ymStr(today.getFullYear(), today.getMonth() + 1))
  const MONTHS = 6

  const ymList  = useMemo(() => buildYmList(baseYm, MONTHS), [baseYm])
  const months  = useMemo(() => ymList.map(calcMonthData), [ymList])
  const current = months[months.length - 1]

  // ym ラベル
  const [cy, cm] = baseYm.split('-').map(Number)

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" onClick={() => setBaseYm(addMonth(baseYm, -1))}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {cy}年{cm}月
        </Typography>
        <IconButton size="small" onClick={() => setBaseYm(addMonth(baseYm, 1))}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* 当月サマリー */}
      <Card sx={{ mb: 1.5, bgcolor: '#263238', color: '#fff' }}>
        <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>
            {cy}年{cm}月 収支シミュレーション
          </Typography>

          {/* 収入 */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 1.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <AccountBalanceIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>手取り給与</Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ color: '#a5d6a7' }}>
              +¥{fmt(current.salary)}
            </Typography>
          </Stack>

          {/* 固定費 */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <RepeatIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>固定費</Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ color: '#ef9a9a' }}>
              −¥{fmt(current.fixedCost)}
            </Typography>
          </Stack>

          {/* クレカ */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <CreditCardIcon sx={{ fontSize: 14, opacity: .7 }} />
              <Typography variant="caption" sx={{ opacity: .7 }}>クレカ請求</Typography>
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ color: '#ef9a9a' }}>
              −¥{fmt(current.ccTotal)}
            </Typography>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(255,255,255,.15)', my: 1 }} />

          {/* 残金 */}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Stack direction="row" alignItems="center" gap={0.75}>
              <SavingsIcon sx={{ fontSize: 14, opacity: .8 }} />
              <Typography variant="caption" sx={{ opacity: .8, fontWeight: 600 }}>貯蓄可能額</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={700}
              sx={{ color: current.remaining >= 0 ? '#69f0ae' : '#ff5252' }}>
              {current.remaining >= 0 ? '+' : '−'}¥{fmt(current.remaining)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* 内訳 */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            支出内訳（{cy}年{cm}月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>

          {/* クレカ内訳 */}
          {current.ccTotal > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                クレカ（前月分引き落とし）
              </Typography>
              {current.jcbAmt > 0 && (
                <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">JCB</Typography>
                  <Typography variant="caption" sx={{ color: '#c62828' }}>−¥{fmt(current.jcbAmt)}</Typography>
                </Stack>
              )}
              {current.smbcAmt > 0 && (
                <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">SMBC</Typography>
                  <Typography variant="caption" sx={{ color: '#c62828' }}>−¥{fmt(current.smbcAmt)}</Typography>
                </Stack>
              )}
              {current.fixedItems.length > 0 && <Divider sx={{ my: 0.75 }} />}
            </>
          )}

          {/* 固定費内訳 */}
          {current.fixedItems.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                固定費
              </Typography>
              {current.fixedItems.map((item, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.25 }}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography variant="caption" color="text.secondary">{item.name}</Typography>
                    {item.weekly && (
                      <Chip label={`週次×${item.count}`} size="small"
                        sx={{ height: 14, fontSize: 8, bgcolor: '#f3e5f5', color: '#6a1b9a' }} />
                    )}
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#c62828' }}>−¥{fmt(item.amount)}</Typography>
                </Stack>
              ))}
            </>
          )}

          {current.ccTotal === 0 && current.fixedItems.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1, textAlign: 'center' }}>
              支出データがありません
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 過去6ヶ月 棒グラフ */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            貯蓄可能額（過去{MONTHS}ヶ月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <BarChart data={months} />
        </CardContent>
      </Card>

      {/* 累計折れ線グラフ */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
            累計貯蓄シミュレーション（過去{MONTHS}ヶ月）
          </Typography>
        </Box>
        <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <CumLineChart data={months} />
          {/* 月別テーブル */}
          <Divider sx={{ my: 1 }} />
          {[...months].reverse().map((d) => {
            const [dy, dm] = d.ym.split('-').map(Number)
            return (
              <Stack key={d.ym} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
                  {dy}年{dm}月
                </Typography>
                <Stack direction="row" gap={2} alignItems="baseline">
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    +¥{fmt(d.salary)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#c62828', fontSize: 10 }}>
                    −¥{fmt(d.fixedCost + d.ccTotal)}
                  </Typography>
                  <Typography variant="caption" fontWeight={700}
                    sx={{ color: d.remaining >= 0 ? '#2e7d32' : '#c62828', minWidth: 72, textAlign: 'right' }}>
                    {d.remaining >= 0 ? '+' : '−'}¥{fmt(d.remaining)}
                  </Typography>
                </Stack>
              </Stack>
            )
          })}
        </CardContent>
      </Card>

    </Box>
  )
}
