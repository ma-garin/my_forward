import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Divider,
  Table, TableHead, TableBody, TableRow, TableCell,
  ToggleButtonGroup, ToggleButton, IconButton,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'

// ─── localStorage ─────────────────────────────────────────
const BASE_KEY     = 'salary_base_data'
const BASE_WH_KEY  = 'salary_base_withholding'
const EXTRA_KEY    = 'salary_extra_data'
const EXTRA_WH_KEY = 'salary_extra_withholding'
function loadBase()    { try { return JSON.parse(localStorage.getItem(BASE_KEY)     || '[]') } catch { return [] } }
function loadBaseWH()  { try { return JSON.parse(localStorage.getItem(BASE_WH_KEY)  || '[]') } catch { return [] } }
function loadExtra()   { try { return JSON.parse(localStorage.getItem(EXTRA_KEY)    || '[]') } catch { return [] } }
function loadExtraWH() { try { return JSON.parse(localStorage.getItem(EXTRA_WH_KEY) || '[]') } catch { return [] } }
function saveExtra(d)   { localStorage.setItem(EXTRA_KEY,    JSON.stringify(d)) }
function saveExtraWH(d) { localStorage.setItem(EXTRA_WH_KEY, JSON.stringify(d)) }

// ─── ユーティリティ ────────────────────────────────────────
function fmt(n) { return n == null ? '—' : Math.round(n).toLocaleString('ja-JP') }
function diff(a, b) {
  if (a == null || b == null) return null
  return a - b
}

// ─── SVG 折れ線グラフ ─────────────────────────────────────
function LineChart({ points, color = '#1e88e5', height = 130, yFmt = (v) => `¥${fmt(v)}` }) {
  const vals = points.map(p => p.value).filter(v => v != null)
  if (vals.length < 2) return null
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const w = 320, pT = 18, pB = 20, pL = 8, pR = 8
  const innerW = w - pL - pR, innerH = height - pT - pB

  const coords = points.map((p, i) => {
    if (p.value == null) return null
    return { x: pL + (i / (points.length - 1)) * innerW, y: pT + (1 - (p.value - minV) / range) * innerH, ...p }
  })
  const segs = []; let seg = []
  coords.forEach(c => { if (!c) { if (seg.length > 1) segs.push(seg); seg = [] } else seg.push(c) })
  if (seg.length > 1) segs.push(seg)

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={Math.max(w, 300)} height={height} style={{ display: 'block', maxWidth: '100%' }}>
        {[0, 0.5, 1].map(t => (
          <line key={t} x1={pL} x2={w - pR} y1={pT + t * innerH} y2={pT + t * innerH} stroke="#eeeeee" strokeWidth={1} />
        ))}
        <text x={pL} y={pT - 4} fontSize={9} fill="#90a4ae">{yFmt(maxV)}</text>
        <text x={pL} y={height - 4} fontSize={9} fill="#90a4ae">{yFmt(minV)}</text>
        {segs.map((sg, si) => (
          <polyline key={si} points={sg.map(c => `${c.x},${c.y}`).join(' ')}
            fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {coords.filter(Boolean).map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={3} fill={color} />
            {c.label && <text x={c.x} y={height - 4} textAnchor="middle" fontSize={8} fill="#90a4ae">{c.label}</text>}
          </g>
        ))}
      </svg>
    </Box>
  )
}

// ─── SVG 棒グラフ ──────────────────────────────────────────
function BarChart({ data, keys, colors, height = 160, labels }) {
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => d[k] ?? 0)), 1)
  const barW   = Math.max(Math.floor(320 / data.length), 24)
  const w      = data.length * barW

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={Math.max(w, 300)} height={height + 20} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const x = i * barW; let y = height
          return (
            <g key={i}>
              {keys.map((k, ki) => {
                const bh = Math.round(((d[k] ?? 0) / maxVal) * height)
                y -= bh
                return <rect key={k} x={x + 2} y={y} width={barW - 4} height={bh}
                  fill={colors[ki]} opacity={0.85} rx={2} />
              })}
              <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={9} fill="#90a4ae">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      {labels && (
        <Stack direction="row" gap={2} sx={{ mt: 0.5 }}>
          {labels.map((l, i) => (
            <Stack key={l} direction="row" alignItems="center" gap={0.5}>
              <Box sx={{ width: 10, height: 10, bgcolor: colors[i], borderRadius: 0.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{l}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  )
}

// ─── セクションカード ──────────────────────────────────────
function SectionCard({ title, children, action }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>
          {title}
        </Typography>
        {action}
      </Box>
      <CardContent sx={{ px: 2, py: 1, '&:last-child': { pb: 1.5 } }}>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── 月別テーブル（サマリ/詳細） ──────────────────────────
function MonthlyTable({ salaries, mode }) {
  if (salaries.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>データなし</Typography>
  )

  if (mode === 'summary') {
    return (
      <Box sx={{ overflowX: 'auto', mx: -2 }}>
        <Table size="small" sx={{ minWidth: 340 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              {['月', '総支給', '総控除', '手取り'].map(h => (
                <TableCell key={h} align={h === '月' ? 'left' : 'right'}
                  sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {salaries.map((r, i) => (
              <TableRow key={r.month}
                sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: '#f1f8e9' } }}>
                <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.month}月</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>¥{fmt(r.totalPay)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'error.main' }}>¥{fmt(r.totalDed)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#1e88e5' }}>¥{fmt(r.takeHome)}</TableCell>
              </TableRow>
            ))}
            {/* 合計行 */}
            {(() => {
              const tp = salaries.reduce((s, r) => s + (r.totalPay ?? 0), 0)
              const td = salaries.reduce((s, r) => s + (r.totalDed ?? 0), 0)
              const th = salaries.reduce((s, r) => s + (r.takeHome ?? 0), 0)
              return (
                <TableRow sx={{ bgcolor: '#e8eaf6' }}>
                  <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 700 }}>合計</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>¥{fmt(tp)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600, color: 'error.main' }}>¥{fmt(td)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#1e88e5' }}>¥{fmt(th)}</TableCell>
                </TableRow>
              )
            })()}
          </TableBody>
        </Table>
      </Box>
    )
  }

  // 詳細モード：月ごとに明細カード
  const dedFields = [
    { key: 'health',     label: '健康保険' },
    { key: 'pension',    label: '厚生年金' },
    { key: 'employment', label: '雇用保険' },
    { key: 'income',     label: '所得税' },
    { key: 'resident',   label: '住民税' },
    { key: 'union',      label: '組合費' },
  ]

  return (
    <Box sx={{ overflowX: 'auto', mx: -2 }}>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
            <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>月</TableCell>
            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>総支給</TableCell>
            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>時間外</TableCell>
            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>残業h</TableCell>
            {dedFields.map(f => (
              <TableCell key={f.key} align="right"
                sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>{f.label}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap', color: '#1e88e5' }}>手取り</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {salaries.map((r, i) => (
            <TableRow key={r.month}
              sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: '#f1f8e9' } }}>
              <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.month}月</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, py: 0.75 }}>¥{fmt(r.totalPay)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, py: 0.75, color: 'text.secondary' }}>¥{fmt(r.overtime)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, py: 0.75, color: 'text.secondary' }}>{r.overtimeHours ?? '—'}h</TableCell>
              {dedFields.map(f => (
                <TableCell key={f.key} align="right" sx={{ fontSize: 11, py: 0.75, color: 'text.secondary' }}>
                  ¥{fmt(r[f.key])}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#1e88e5' }}>¥{fmt(r.takeHome)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

// ─── 前年比較テーブル ──────────────────────────────────────
const YOY_FIELDS = [
  { key: 'takeHome', label: '手取り',  color: '#1e88e5' },
  { key: 'totalPay', label: '総支給',  color: '#43a047' },
  { key: 'totalDed', label: '総控除',  color: '#e53935' },
]

function YoYTable({ curSalaries, prevSalaries, field, onFieldChange }) {
  const curByMonth  = Object.fromEntries(curSalaries.map(r  => [r.month, r]))
  const prevByMonth = Object.fromEntries(prevSalaries.map(r => [r.month, r]))
  const months = [...new Set([...curSalaries.map(r => r.month), ...prevSalaries.map(r => r.month)])].sort((a, b) => a - b)
  const fieldDef = YOY_FIELDS.find(f => f.key === field)

  if (months.length === 0) return (
    <Typography variant="caption" color="text.disabled">前年データなし</Typography>
  )

  const DiffCell = ({ cur, prev }) => {
    const d = diff(cur, prev)
    if (d == null) return <TableCell align="right" sx={{ fontSize: 11, py: 0.75, color: 'text.disabled' }}>—</TableCell>
    return (
      <TableCell align="right" sx={{ fontSize: 11, py: 0.75, fontWeight: 600, color: d >= 0 ? '#2e7d32' : '#c62828' }}>
        {d >= 0 ? '+' : '−'}¥{fmt(Math.abs(d))}
      </TableCell>
    )
  }

  return (
    <Box>
      {/* フィールド切り替え */}
      <Stack direction="row" gap={0.75} sx={{ mb: 1 }}>
        {YOY_FIELDS.map(f => (
          <Chip key={f.key} label={f.label} size="small" onClick={() => onFieldChange(f.key)}
            sx={{ fontWeight: field === f.key ? 700 : 400, fontSize: 11,
              bgcolor: field === f.key ? f.color : '#f0f0f0',
              color:   field === f.key ? '#fff'  : 'text.secondary' }} />
        ))}
      </Stack>
      <Box sx={{ overflowX: 'auto', mx: -2 }}>
        <Table size="small" sx={{ minWidth: 380 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>月</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, color: 'text.secondary' }}>前年</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75, color: fieldDef.color }}>今年</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>差額</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {months.map((m, i) => {
              const cur  = curByMonth[m]
              const prev = prevByMonth[m]
              return (
                <TableRow key={m} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{m}月</TableCell>
                  <TableCell align="right" sx={{ fontSize: 11, py: 0.75, color: 'text.secondary' }}>
                    {prev ? `¥${fmt(prev[field])}` : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: fieldDef.color }}>
                    {cur ? `¥${fmt(cur[field])}` : '—'}
                  </TableCell>
                  <DiffCell cur={cur?.[field]} prev={prev?.[field]} />
                </TableRow>
              )
            })}
            {(() => {
              const ct = curSalaries.reduce((s, r) => s + (r[field] ?? 0), 0)
              const pt = prevSalaries.reduce((s, r) => s + (r[field] ?? 0), 0)
              return (
                <TableRow sx={{ bgcolor: '#e8eaf6' }}>
                  <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 700 }}>合計</TableCell>
                  <TableCell align="right" sx={{ fontSize: 11, py: 0.75, fontWeight: 600, color: 'text.secondary' }}>¥{fmt(pt)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: fieldDef.color }}>¥{fmt(ct)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 11, py: 0.75, fontWeight: 700, color: ct - pt >= 0 ? '#2e7d32' : '#c62828' }}>
                    {ct - pt >= 0 ? '+' : '−'}¥{fmt(Math.abs(ct - pt))}
                  </TableCell>
                </TableRow>
              )
            })()}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}

// ─── メイン ───────────────────────────────────────────────
export default function SalaryHistory() {
  const [extraSalary, setExtraSalary] = useState(loadExtra)
  const [extraWH,     setExtraWH]     = useState(loadExtraWH)
  const [monthlyView, setMonthlyView] = useState('summary')   // 'summary' | 'detail'
  const [yoyField,    setYoyField]    = useState('takeHome')  // 'takeHome' | 'totalPay' | 'totalDed'

  // PDF アップロード
  const fileRef = useRef(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadResult, setUploadResult] = useState(null) // { salaries, withholding, errors }

  const handleUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const { parseMultiplePdfs } = await import('../utils/parseSalaryPdf')
      const result = await parseMultiplePdfs(files)
      // 既存データとマージ（重複排除）
      if (result.salaries.length > 0) {
        const merged = [...extraSalary]
        result.salaries.forEach(rec => {
          if (!merged.some(x => x.year === rec.year && x.month === rec.month && x.type === rec.type))
            merged.push(rec)
        })
        setExtraSalary(merged)
        saveExtra(merged)
      }
      if (result.withholding.length > 0) {
        const merged = [...extraWH]
        result.withholding.forEach(rec => {
          if (!merged.some(x => x.year === rec.year)) merged.push(rec)
        })
        setExtraWH(merged)
        saveExtraWH(merged)
      }
      setUploadResult(result)
    } catch (err) {
      setUploadResult({ salaries: [], withholding: [], errors: [err.message] })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [extraSalary, extraWH])

  const allSalary = useMemo(() => {
    const merged = [...loadBase()]
    extraSalary.forEach(ex => {
      if (!merged.some(b => b.year === ex.year && b.month === ex.month && b.type === ex.type))
        merged.push(ex)
    })
    return merged.sort((a, b) => (a.year - b.year) || (a.month - b.month))
  }, [extraSalary])

  const allWH = useMemo(() => {
    const merged = [...loadBaseWH()]
    extraWH.forEach(ex => { if (!merged.some(b => b.year === ex.year)) merged.push(ex) })
    return merged.sort((a, b) => a.year - b.year)
  }, [extraWH])

  const YEARS = useMemo(() =>
    [...new Set(allSalary.map(d => d.year))].sort((a, b) => b - a), [allSalary])

  const [year, setYear] = useState(() => YEARS[0])

  const salaries  = useMemo(() => allSalary.filter(d => d.year === year  && d.type === 'salary'), [allSalary, year])
  const bonuses   = useMemo(() => allSalary.filter(d => d.year === year  && d.type === 'bonus'),  [allSalary, year])
  const prevSalaries = useMemo(() => allSalary.filter(d => d.year === year - 1 && d.type === 'salary'), [allSalary, year])
  const wh        = useMemo(() => allWH.find(d => d.year === year), [allWH, year])

  const summary = useMemo(() => {
    const s = salaries.reduce((acc, r) => ({
      takeHome:      acc.takeHome      + (r.takeHome      ?? 0),
      totalPay:      acc.totalPay      + (r.totalPay      ?? 0),
      totalDed:      acc.totalDed      + (r.totalDed      ?? 0),
      overtime:      acc.overtime      + (r.overtime      ?? 0),
      overtimeHours: acc.overtimeHours + (r.overtimeHours ?? 0),
    }), { takeHome: 0, totalPay: 0, totalDed: 0, overtime: 0, overtimeHours: 0 })
    const bonusTotal = bonuses.reduce((acc, r) => acc + (r.takeHome ?? 0), 0)
    return { ...s, bonusTotal, months: salaries.length }
  }, [salaries, bonuses])

  const barData = useMemo(() =>
    salaries.map(r => ({ label: `${r.month}月`, totalPay: r.totalPay, totalDed: r.totalDed, takeHome: r.takeHome }))
  , [salaries])

  const statItems = [
    { label: '年間手取り合計', value: `¥${fmt(summary.takeHome)}`,  color: '#1e88e5' },
    { label: '年間総支給合計', value: `¥${fmt(summary.totalPay)}`,  color: '#43a047' },
    { label: '年間総控除合計', value: `¥${fmt(summary.totalDed)}`,  color: '#e53935' },
    { label: '賞与手取り合計', value: `¥${fmt(summary.bonusTotal)}`,color: '#fb8c00' },
    { label: '月平均手取り',   value: `¥${fmt(summary.months ? Math.round(summary.takeHome / summary.months) : 0)}`, color: '#8e24aa' },
    { label: '総残業時間',     value: `${summary.overtimeHours.toFixed(1)}h`, color: '#f4511e' },
  ]

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      {/* 年選択 + アップロード */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
        <Box sx={{ overflowX: 'auto', flex: 1 }}>
          <Stack direction="row" gap={0.75}>
            {YEARS.map(y => (
              <Chip key={y} label={`${y}年`} size="small" onClick={() => setYear(y)}
                sx={{ fontWeight: year === y ? 700 : 400, flexShrink: 0,
                  bgcolor: year === y ? 'primary.main' : '#f0f0f0',
                  color:   year === y ? '#fff' : 'text.secondary' }} />
            ))}
          </Stack>
        </Box>
        <input ref={fileRef} type="file" accept="*/*" multiple hidden onChange={handleUpload} />
        <Button
          size="small" variant="outlined"
          startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileIcon sx={{ fontSize: 16 }} />}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          sx={{ flexShrink: 0, fontSize: 11, whiteSpace: 'nowrap', borderColor: '#b0bec5', color: 'text.secondary' }}
        >
          PDF取込
        </Button>
      </Stack>

      {/* PDF取込結果ダイアログ */}
      <Dialog open={!!uploadResult} onClose={() => setUploadResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.5, fontSize: 16 }}>PDF取込結果</DialogTitle>
        <DialogContent>
          {uploadResult && (
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              {uploadResult.salaries.length > 0 && (
                <Alert severity="success" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 13 } }}>
                  給与/賞与明細: {uploadResult.salaries.length}件を登録
                </Alert>
              )}
              {uploadResult.withholding.length > 0 && (
                <Alert severity="success" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 13 } }}>
                  源泉徴収票: {uploadResult.withholding.length}件を登録
                </Alert>
              )}
              {uploadResult.salaries.length === 0 && uploadResult.withholding.length === 0 && uploadResult.errors.length === 0 && (
                <Alert severity="info" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 13 } }}>
                  新規データはありませんでした（既に登録済み）
                </Alert>
              )}
              {uploadResult.errors.length > 0 && (
                <Alert severity="error" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 12 } }}>
                  {uploadResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                </Alert>
              )}
              {uploadResult.salaries.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>取込内容:</Typography>
                  {uploadResult.salaries.map((r, i) => (
                    <Typography key={i} variant="body2" sx={{ fontSize: 12 }}>
                      {r.year}年{r.month}月 {r.type === 'bonus' ? '賞与' : '給与'} — 手取り ¥{fmt(r.takeHome)}
                    </Typography>
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadResult(null)} variant="contained" size="small">閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* ① サマリー */}
      <SectionCard title={`${year}年 サマリー`}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {statItems.map(s => (
            <Box key={s.label} sx={{ p: 1, bgcolor: '#f9fafb', borderRadius: 1, borderLeft: `3px solid ${s.color}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{s.label}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: s.color, fontSize: 13 }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>
      </SectionCard>

      {/* ② 表（総支給 / 総控除 / 手取り） */}
      <SectionCard title="総支給 / 総控除 / 手取り">
        <Box sx={{ overflowX: 'auto', mx: -2 }}>
          <Table size="small" sx={{ minWidth: 340 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                {['月', '総支給', '総控除', '手取り'].map(h => (
                  <TableCell key={h} align={h === '月' ? 'left' : 'right'}
                    sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {salaries.map((r, i) => (
                <TableRow key={r.month} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.month}月</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>¥{fmt(r.totalPay)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'error.main' }}>¥{fmt(r.totalDed)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#1e88e5' }}>¥{fmt(r.takeHome)}</TableCell>
                </TableRow>
              ))}
              {(() => {
                const tp = salaries.reduce((s, r) => s + (r.totalPay ?? 0), 0)
                const td = salaries.reduce((s, r) => s + (r.totalDed ?? 0), 0)
                const th = salaries.reduce((s, r) => s + (r.takeHome ?? 0), 0)
                return (
                  <TableRow sx={{ bgcolor: '#e8eaf6' }}>
                    <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 700 }}>合計</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>¥{fmt(tp)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600, color: 'error.main' }}>¥{fmt(td)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#1e88e5' }}>¥{fmt(th)}</TableCell>
                  </TableRow>
                )
              })()}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>

      {/* ③ 月別明細 */}
      <Card sx={{ mb: 1.5 }}>
        <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: 0.5 }}>月別明細</Typography>
          <ToggleButtonGroup size="small" value={monthlyView} exclusive onChange={(_, v) => v && setMonthlyView(v)}
            sx={{ '& .MuiToggleButton-root': { py: 0, px: 1, fontSize: 11, color: 'rgba(255,255,255,.8)', borderColor: 'rgba(255,255,255,.3)' },
                  '& .Mui-selected': { bgcolor: 'rgba(255,255,255,.2) !important', color: '#fff !important' } }}>
            <ToggleButton value="summary">サマリ</ToggleButton>
            <ToggleButton value="detail">詳細</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <CardContent sx={{ px: 0, py: 0, '&:last-child': { pb: 0 } }}>
          <MonthlyTable salaries={salaries} mode={monthlyView} />
        </CardContent>
      </Card>

      {/* 賞与 */}
      {bonuses.length > 0 && (
        <SectionCard title="賞与">
          <Box sx={{ overflowX: 'auto', mx: -2 }}>
            <Table size="small" sx={{ minWidth: 320 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  {['月', '総支給', '総控除', '手取り'].map(h => (
                    <TableCell key={h} align={h === '月' ? 'left' : 'right'}
                      sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {bonuses.map(r => (
                  <TableRow key={r.month}>
                    <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.month}月</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>¥{fmt(r.totalPay)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'error.main' }}>¥{fmt(r.totalDed)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#fb8c00' }}>¥{fmt(r.takeHome)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>
      )}

      {/* ④ 前年度との比較 */}
      {prevSalaries.length > 0 && (
        <SectionCard title={`前年度比較（${year - 1}年 vs ${year}年）`}>
          <YoYTable
            curSalaries={salaries} prevSalaries={prevSalaries}
            field={yoyField} onFieldChange={setYoyField}
          />
        </SectionCard>
      )}

      {/* ⑤ 源泉徴収票 */}
      {wh && (
        <SectionCard title={`${year}年 源泉徴収票`}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { label: '支払金額（年収）', value: wh.totalPay,        color: '#1e88e5' },
              { label: '給与所得控除後',   value: wh.afterDeduction,  color: '#43a047' },
              { label: '所得控除の合計額', value: wh.deductionTotal,  color: '#8e24aa' },
              { label: '源泉徴収税額',     value: wh.incomeTax,       color: '#e53935' },
              { label: '社会保険料等',     value: wh.socialInsurance, color: '#fb8c00' },
            ].map(s => (
              <Box key={s.label} sx={{ p: 1, bgcolor: '#f9fafb', borderRadius: 1, borderLeft: `3px solid ${s.color}` }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{s.label}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: s.color, fontSize: 13 }}>¥{fmt(s.value)}</Typography>
              </Box>
            ))}
            {wh.totalPay && wh.incomeTax != null && wh.socialInsurance != null && (() => {
              const rate = Math.round((wh.incomeTax + wh.socialInsurance) / wh.totalPay * 100)
              return (
                <Box sx={{ p: 1, bgcolor: '#f9fafb', borderRadius: 1, borderLeft: '3px solid #607d8b' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>税・社保 負担率</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#607d8b', fontSize: 13 }}>{rate}%</Typography>
                </Box>
              )
            })()}
          </Box>
        </SectionCard>
      )}

      {/* A. 昇給トラッキング */}
      {(() => {
        const byYear = YEARS.slice().reverse().map(y => {
          const jan = allSalary.find(r => r.year === y && r.month === 1 && r.type === 'salary')
          return { label: `${y}`, value: jan?.basePay ?? null, year: y }
        })
        const rows = YEARS.slice().reverse().map((y, i, arr) => {
          const cur  = allSalary.find(r => r.year === y   && r.month === 1 && r.type === 'salary')
          const prev = allSalary.find(r => r.year === y-1 && r.month === 1 && r.type === 'salary')
          return { year: y, base: cur?.basePay, prevBase: prev?.basePay }
        }).filter(r => r.base != null)
        return (
          <SectionCard title="A. 昇給トラッキング（基本給 年別推移）">
            <LineChart points={byYear} color="#43a047" height={130} />
            <Box sx={{ overflowX: 'auto', mx: -2, mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    {['年', '基本給', '前年比'].map(h => (
                      <TableCell key={h} align={h === '年' ? 'left' : 'right'}
                        sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const d = r.prevBase != null ? r.base - r.prevBase : null
                    return (
                      <TableRow key={r.year} sx={{ bgcolor: r.year === year ? '#e8f5e9' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: r.year === year ? 700 : 400 }}>{r.year}年</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600, color: '#43a047' }}>¥{fmt(r.base)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600,
                          color: d == null ? 'text.disabled' : d > 0 ? '#2e7d32' : d < 0 ? '#c62828' : 'text.secondary' }}>
                          {d == null ? '—' : d === 0 ? '±0' : `${d > 0 ? '+' : '−'}¥${fmt(Math.abs(d))}`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          </SectionCard>
        )
      })()}

      {/* B. 残業分析 */}
      {(() => {
        const otPoints = Array.from({ length: 12 }, (_, i) => ({
          label: `${i + 1}月`,
          value: salaries.find(r => r.month === i + 1)?.overtimeHours ?? null,
        }))
        const avgH  = summary.overtimeHours / (summary.months || 1)
        const maxR  = salaries.reduce((m, r) => r.overtimeHours > (m?.overtimeHours ?? -1) ? r : m, null)
        const minR  = salaries.reduce((m, r) => (r.overtimeHours ?? 999) < (m?.overtimeHours ?? 999) ? r : m, null)
        return (
          <SectionCard title="B. 残業分析">
            <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
              {[
                { label: '月平均残業', value: `${avgH.toFixed(1)}h`, color: '#f4511e' },
                { label: '年間残業代', value: `¥${fmt(summary.overtime)}`, color: '#e53935' },
                { label: '最多月', value: maxR ? `${maxR.month}月 ${maxR.overtimeHours}h` : '—', color: '#fb8c00' },
                { label: '最少月', value: minR ? `${minR.month}月 ${minR.overtimeHours}h` : '—', color: '#43a047' },
              ].map(s => (
                <Box key={s.label} sx={{ flex: 1, p: 0.75, bgcolor: '#f9fafb', borderRadius: 1, borderLeft: `3px solid ${s.color}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{s.label}</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: s.color, fontSize: 11 }}>{s.value}</Typography>
                </Box>
              ))}
            </Stack>
            <LineChart points={otPoints} color="#f4511e" height={110} yFmt={v => `${v}h`} />
            <Box sx={{ overflowX: 'auto', mx: -2, mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    {['月', '残業時間', '残業代'].map(h => (
                      <TableCell key={h} align={h === '月' ? 'left' : 'right'}
                        sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salaries.map((r, i) => (
                    <TableRow key={r.month} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.month}月</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>{r.overtimeHours ?? '—'}h</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: '#e53935' }}>¥{fmt(r.overtime)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#fbe9e7' }}>
                    <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: 700 }}>合計</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700 }}>{summary.overtimeHours.toFixed(1)}h</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#e53935' }}>¥{fmt(summary.overtime)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </SectionCard>
        )
      })()}

      {/* D. 手取り推移グラフ（全期間） */}
      {(() => {
        // 全月を時系列で並べる
        const allPoints = allSalary
          .filter(r => r.type === 'salary')
          .sort((a, b) => a.year - b.year || a.month - b.month)
          .map(r => ({
            label: r.month === 1 ? `${r.year}` : '',
            value: r.takeHome,
          }))
        return (
          <SectionCard title="D. 手取り推移（全期間）">
            <LineChart points={allPoints} color="#1e88e5" height={150} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 10 }}>
              ※ラベルは各年1月
            </Typography>
          </SectionCard>
        )
      })()}

      {/* E. 負担率の経年変化 */}
      {allWH.length >= 2 && (() => {
        const whPoints = allWH.map(w => ({
          label: `${w.year}`,
          value: w.totalPay ? Math.round((((w.incomeTax ?? 0) + (w.socialInsurance ?? 0)) / w.totalPay) * 100) : null,
        }))
        return (
          <SectionCard title="E. 税・社保 負担率の経年変化">
            <LineChart points={whPoints} color="#8e24aa" height={110} yFmt={v => `${v}%`} />
            <Box sx={{ overflowX: 'auto', mx: -2, mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    {['年', '年収', '所得税', '社会保険料', '負担率'].map(h => (
                      <TableCell key={h} align={h === '年' ? 'left' : 'right'}
                        sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allWH.map((w, i) => {
                    const burden = (w.incomeTax ?? 0) + (w.socialInsurance ?? 0)
                    const rate   = w.totalPay ? Math.round(burden / w.totalPay * 100) : null
                    const prevW  = allWH[i - 1]
                    const prevRate = prevW?.totalPay ? Math.round(((prevW.incomeTax ?? 0) + (prevW.socialInsurance ?? 0)) / prevW.totalPay * 100) : null
                    const rateDiff = rate != null && prevRate != null ? rate - prevRate : null
                    return (
                      <TableRow key={w.year} sx={{ bgcolor: w.year === year ? '#f3e5f5' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: w.year === year ? 700 : 400 }}>{w.year}年</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>¥{fmt(w.totalPay)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'error.main' }}>¥{fmt(w.incomeTax)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>¥{fmt(w.socialInsurance)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#8e24aa' }}>
                          {rate != null ? `${rate}%` : '—'}
                          {rateDiff != null && (
                            <Typography component="span" sx={{ fontSize: 10, ml: 0.5, color: rateDiff > 0 ? '#c62828' : '#2e7d32' }}>
                              ({rateDiff > 0 ? '+' : ''}{rateDiff}pt)
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          </SectionCard>
        )
      })()}

      {/* F. 賞与の年別比較 */}
      {(() => {
        const bonusByYear = YEARS.slice().reverse().map(y => {
          const bs = allSalary.filter(r => r.year === y && r.type === 'bonus')
          return {
            year: y,
            label: `${y}`,
            total:   bs.reduce((s, r) => s + (r.takeHome  ?? 0), 0) || null,
            count:   bs.length,
            details: bs,
          }
        }).filter(r => r.count > 0)
        if (bonusByYear.length === 0) return null
        const linePoints = bonusByYear.map(r => ({ label: `${r.year}`, value: r.total }))
        return (
          <SectionCard title="F. 賞与 年別比較">
            <LineChart points={linePoints} color="#fb8c00" height={110} />
            <Box sx={{ overflowX: 'auto', mx: -2, mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    {['年', '回数', '手取り合計', '前年比'].map(h => (
                      <TableCell key={h} align={h === '年' ? 'left' : 'right'}
                        sx={{ fontSize: 11, fontWeight: 700, py: 0.75 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bonusByYear.map((r, i) => {
                    const prev = bonusByYear[i + 1]
                    const d = prev ? (r.total ?? 0) - (prev.total ?? 0) : null
                    return (
                      <TableRow key={r.year} sx={{ bgcolor: r.year === year ? '#fff3e0' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: r.year === year ? 700 : 400 }}>{r.year}年</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>{r.count}回</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 700, color: '#fb8c00' }}>¥{fmt(r.total)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600,
                          color: d == null ? 'text.disabled' : d > 0 ? '#2e7d32' : d < 0 ? '#c62828' : 'text.secondary' }}>
                          {d == null ? '—' : d === 0 ? '±0' : `${d > 0 ? '+' : '−'}¥${fmt(Math.abs(d))}`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          </SectionCard>
        )
      })()}

      {/* 源泉徴収票 年次一覧 */}
      {allWH.length > 1 && (
        <SectionCard title="源泉徴収票 年次一覧">
          <Box sx={{ overflowX: 'auto', mx: -2 }}>
            <Table size="small" sx={{ minWidth: 400 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  {['年', '年収', '控除後所得', '源泉徴収税額', '社会保険料', '負担率'].map(h => (
                    <TableCell key={h} align={h === '年' ? 'left' : 'right'}
                      sx={{ fontSize: 11, fontWeight: 700, py: 0.75, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {allWH.map((w, i) => {
                  const burden = (w.incomeTax ?? 0) + (w.socialInsurance ?? 0)
                  const rate   = w.totalPay ? Math.round(burden / w.totalPay * 100) : null
                  return (
                    <TableRow key={w.year}
                      sx={{ bgcolor: w.year === year ? '#e3f2fd' : i % 2 === 0 ? '#fff' : '#fafafa',
                            cursor: 'pointer', '&:hover': { bgcolor: '#f1f8e9' } }}
                      onClick={() => setYear(w.year)}>
                      <TableCell sx={{ fontSize: 12, py: 0.75, fontWeight: w.year === year ? 700 : 400 }}>{w.year}年</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75 }}>¥{fmt(w.totalPay)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>¥{fmt(w.afterDeduction)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'error.main' }}>¥{fmt(w.incomeTax)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75, color: 'text.secondary' }}>¥{fmt(w.socialInsurance)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, py: 0.75, fontWeight: 600, color: '#607d8b' }}>
                        {rate != null ? `${rate}%` : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>
      )}
    </Box>
  )
}
