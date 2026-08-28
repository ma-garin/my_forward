import { useEffect, useState, useMemo, memo } from 'react'
import { Box, Card, CardContent, Typography, Stack, Divider, IconButton, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { getCCTotal, fmt, newId } from '../utils/finance'
import { takeHomeFor, incomeDiffLabel } from '../utils/income'
import {
  CARD_LIST,
  loadSalaryOverride, saveSalaryOverride,
  loadSummaryFixed, saveSummaryFixed,
  loadLivingUnit, saveLivingUnit,
  countFridaysUntil, nextPayDay,
  loadOtherIncome,
} from '../utils/ccStorage'
import AmountField from './AmountField'

function CombinedSummaryBase({ ym, salaryYm = ym, otherIncomeYm, combinedLimit = 0 }) {
  // ダイアログ・給与入力などの state 変化による再レンダーで
  // getCCTotal（カードごとに parse）が毎回走るのを防ぐ。
  const { perCard, combined } = useMemo(() => {
    const perCard = CARD_LIST.map((c) => ({ card: c, total: getCCTotal(c.id, ym).total }))
    return { perCard, combined: perCard.reduce((s, x) => s + x.total, 0) }
  }, [ym])

  const [salaryInput, setSalaryInput] = useState(() => loadSalaryOverride(salaryYm))
  const [fixedItems,  setFixedItems]  = useState(loadSummaryFixed)
  const [livingUnit,  setLivingUnit]  = useState(loadLivingUnit)

  const [dlg,         setDlg]         = useState(null)
  const [dlgLabel,    setDlgLabel]    = useState('')
  const [dlgAmount,   setDlgAmount]   = useState('')
  const [deleteDlg,   setDeleteDlg]   = useState(null)
  const [livingEdit,  setLivingEdit]  = useState(null)

  useEffect(() => {
    setSalaryInput(loadSalaryOverride(salaryYm))
  }, [salaryYm])

  // 手取りの出どころは takeHomeFor 1 つ。ここで見込みと実績を別々に
  // 読むと、収支サマリーと違う手取りが同じ画面に並ぶ（実際にそうなっていた）。
  // 入力のたびに保存 → 読み直しになるので memo にしない（memo にすると
  // 打った直後だけ古い手取りが残る）
  const income      = takeHomeFor(salaryYm)
  const simSalary   = income.estimate
  const salary      = income.amount
  const otherIncome = useMemo(
    () => parseFloat(loadOtherIncome(otherIncomeYm ?? salaryYm)) || 0,
    [otherIncomeYm, salaryYm],
  )
  const totalIncome = salary + otherIncome
  const hasSalary   = salary > 0

  const today   = new Date()
  const payDay  = nextPayDay(today)
  const fridays = countFridaysUntil(today, payDay)
  const livingCost      = fridays * livingUnit
  const fixedItemsTotal = fixedItems.reduce((s, i) => s + i.amount, 0)
  const fixedTotal      = fixedItemsTotal + livingCost
  const planBalance     = totalIncome - fixedTotal - combinedLimit
  const actualBalance   = totalIncome - fixedTotal - combined

  function openAdd()        { setDlgLabel(''); setDlgAmount(''); setDlg({ mode: 'add' }) }
  function openEdit(item)   { setDlgLabel(item.label); setDlgAmount(String(item.amount)); setDlg({ mode: 'edit', id: item.id }) }
  function askDelete(item)  { setDeleteDlg({ id: item.id, label: item.label }) }

  function commitLivingEdit() {
    const n = parseInt(livingEdit, 10)
    if (!isNaN(n) && n > 0) { setLivingUnit(n); saveLivingUnit(n) }
    setLivingEdit(null)
  }

  function confirmDelete() {
    if (deleteDlg.id === '__living__') {
      setLivingUnit(0); saveLivingUnit(0)
    } else {
      const next = fixedItems.filter(x => x.id !== deleteDlg.id)
      setFixedItems(next); saveSummaryFixed(next)
    }
    setDeleteDlg(null)
  }

  function handleSave() {
    const amt = parseInt(dlgAmount, 10)
    if (!dlgLabel.trim()) return
    if (isNaN(amt) || amt <= 0) return
    if (dlg.mode === 'add') {
      const next = [...fixedItems, { id: newId(), label: dlgLabel.trim(), amount: amt }]
      setFixedItems(next); saveSummaryFixed(next)
    } else {
      const next = fixedItems.map(x => x.id === dlg.id ? { ...x, label: dlgLabel.trim(), amount: amt } : x)
      setFixedItems(next); saveSummaryFixed(next)
    }
    setDlg(null)
  }

  const iconSx = { p: 0.75, color: 'rgba(255,255,255,.4)', '&:hover': { color: 'rgba(255,255,255,.8)' } }

  // 追加/編集/削除ダイアログ
  const dialogs = (
    <>
      <Dialog open={dlg !== null} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1, fontSize: 15 }}>
          {dlg?.mode === 'add' ? '固定費を追加' : '固定費を編集'}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack gap={2}>
            <TextField label="項目名" value={dlgLabel} onChange={e => setDlgLabel(e.target.value)} size="small" fullWidth autoFocus />
            <AmountField value={dlgAmount} onChange={setDlgAmount} label="金額" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)} size="small">キャンセル</Button>
          <Button onClick={handleSave} variant="contained" size="small"
            disabled={!dlgLabel.trim() || parseInt(dlgAmount, 10) <= 0}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteDlg} onClose={() => setDeleteDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2">「{deleteDlg?.label}」を削除しますか？この操作は元に戻せません。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDlg(null)} color="inherit" size="small">キャンセル</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">削除</Button>
        </DialogActions>
      </Dialog>
    </>
  )

  return (
    <>
    <Card sx={{ mb: 2, bgcolor: '#263238', color: '#fff' }}>
      <CardContent sx={{ px: 3, py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" sx={{ opacity: .6, letterSpacing: .5 }}>支出合計（{ym}）</Typography>

        {/* 支払い方法別。使っていないものまで並べると合計が探しにくい */}
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          {perCard.filter(({ total }) => total !== 0).map(({ card, total }) => (
            <Stack key={card.id}>
              <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>{card.shortName}</Typography>
              <Typography variant="subtitle1" fontWeight={700}>¥{fmt(total)}</Typography>
            </Stack>
          ))}
          <Stack>
            <Typography variant="caption" sx={{ opacity: .55, fontSize: 10 }}>合計</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: -.5 }}>¥{fmt(combined)}</Typography>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.5 }} />

        {/* 給与入力 */}
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography variant="caption" sx={{ opacity: .7, minWidth: 36 }}>給与</Typography>
          <Box sx={{ flex: 1 }}>
            {/* 空のままなら見込みを使う。だから空欄は「未記録」であって
                「¥0」ではない。それが分かるように見込み額を薄く出す */}
            <AmountField
              dark
              value={salaryInput}
              onChange={(raw) => { setSalaryInput(raw); saveSalaryOverride(raw, salaryYm) }}
              placeholder={simSalary > 0 ? `見込み ${fmt(simSalary)}` : '手取り額'}
              inputSx={{ '& .MuiInputBase-root': { height: 32 } }}
            />
          </Box>
        </Stack>

        {/* 実際に振り込まれた額と、給与タブの見込みとの差。
            見込みが外れているなら、残業の入れ方か控除の設定が古い */}
        {income.isActual && simSalary > 0 && (
          <Stack direction="row" alignItems="baseline" gap={0.75} sx={{ mt: 0.5, ml: 6.5 }}>
            <Typography sx={{ fontSize: 10, opacity: .55 }}>
              見込み ¥{fmt(simSalary)}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700,
              color: income.diff === 0 ? 'rgba(255,255,255,.55)'
                : income.diff > 0 ? '#a5d6a7' : '#ef9a9a' }}>
              {income.diff === 0 ? '見込みどおり'
                : `${income.diff > 0 ? '+' : '−'}¥${fmt(Math.abs(income.diff))}・${incomeDiffLabel(income.diff)}`}
            </Typography>
          </Stack>
        )}

        {/* 予実テーブル */}
        {hasSalary && (
          <Box sx={{ mt: 1, px: 1.25, pt: 1, pb: 0.75, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 1 }}>
            <Stack direction="row" sx={{ pb: 0.4, borderBottom: '1px solid rgba(255,255,255,.15)', mb: 0.25 }}>
              <Box sx={{ flex: 1.6 }} />
              <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, opacity: .5, textAlign: 'right' }}>予定</Typography>
              <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, opacity: .5, textAlign: 'right' }}>実績</Typography>
            </Stack>

            {[
              { label: otherIncome > 0 ? `給与+その他` : '給与', plan: totalIncome, actual: totalIncome },
              { label: '固定費',     plan: fixedTotal,     actual: fixedTotal,   sign: '−' },
              { label: 'カード・現金', plan: combinedLimit,  actual: combined,     sign: '−', planNote: '月間上限', actualNote: '実績' },
            ].map(({ label, plan, actual, sign, planNote, actualNote }) => (
              <Stack key={label} direction="row" alignItems="baseline"
                sx={{ py: 0.55, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <Box sx={{ flex: 1.6, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  {sign && <Typography sx={{ fontSize: 12, opacity: .4, minWidth: 12 }}>{sign}</Typography>}
                  <Typography sx={{ fontSize: 12, opacity: .75 }}>{label}</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, opacity: .8 }}>¥{fmt(plan)}</Typography>
                  {planNote && <Typography sx={{ fontSize: 9, opacity: .4 }}>{planNote}</Typography>}
                </Box>
                <Box sx={{ flex: 1, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, opacity: .8 }}>¥{fmt(actual)}</Typography>
                  {actualNote && <Typography sx={{ fontSize: 9, opacity: .4 }}>{actualNote}</Typography>}
                </Box>
              </Stack>
            ))}

            <Divider sx={{ borderColor: 'rgba(255,255,255,.15)', my: 0.5 }} />
            <Stack direction="row" alignItems="center">
              <Typography sx={{ flex: 1.6, fontSize: 12, fontWeight: 600, opacity: .9 }}>残高</Typography>
              <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, textAlign: 'right', color: planBalance >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {planBalance < 0 ? '−' : ''}¥{fmt(Math.abs(planBalance))}
              </Typography>
              <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, textAlign: 'right', color: actualBalance >= 0 ? '#a5d6a7' : '#ef9a9a' }}>
                {actualBalance < 0 ? '−' : ''}¥{fmt(Math.abs(actualBalance))}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* 固定費内訳 */}
        {hasSalary && (
          <Box sx={{ mt: 1.5, pl: 0.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: .45, letterSpacing: .5 }}>固定費内訳</Typography>
              <IconButton size="small" aria-label="固定費を追加" sx={iconSx} onClick={openAdd}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
            <Stack spacing={0.25}>
              {fixedItems.map(item => (
                <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ opacity: .6, flex: 1 }}>{item.label}</Typography>
                  <Stack direction="row" alignItems="center" gap={0.25}>
                    <Typography variant="caption" sx={{ opacity: .6 }}>¥{fmt(item.amount)}</Typography>
                    <IconButton size="small" aria-label="編集" sx={iconSx} onClick={() => openEdit(item)}>
                      <EditIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                    <IconButton size="small" aria-label="削除" sx={iconSx} onClick={() => askDelete(item)}>
                      <DeleteIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
              {livingUnit > 0 && (livingEdit !== null ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ opacity: .6, flex: 1 }}>生活費（週あたり）</Typography>
                  <TextField
                    size="small" type="number" autoFocus
                    value={livingEdit}
                    onChange={e => setLivingEdit(e.target.value)}
                    onBlur={commitLivingEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setLivingEdit(null)
                    }}
                    inputProps={{ min: 0, style: { textAlign: 'right', width: 72, fontSize: 11, color: '#fff' } }}
                    sx={{ '& .MuiInputBase-root': { height: 22, color: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,.3)' } }}
                  />
                </Stack>
              ) : (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ opacity: .6, flex: 1 }}>
                    生活費（{fridays}週 × {fmt(livingUnit)}）
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.25}>
                    <Typography variant="caption" sx={{ opacity: .6 }}>¥{fmt(livingCost)}</Typography>
                    <IconButton size="small" aria-label="生活費を編集" sx={iconSx} onClick={() => setLivingEdit(String(livingUnit))}>
                      <EditIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                    <IconButton size="small" aria-label="生活費を削除" sx={iconSx} onClick={() => setDeleteDlg({ id: '__living__', label: '生活費' })}>
                      <DeleteIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
              <Divider sx={{ borderColor: 'rgba(255,255,255,.1)', my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ opacity: .8 }}>固定費合計</Typography>
                <Typography variant="caption" sx={{ opacity: .8 }}>¥{fmt(fixedTotal)}</Typography>
              </Stack>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
    {dialogs}
    </>
  )
}

// props（ym / salaryYm / limit など）はすべて primitive のため、
// 親の再レンダーで値が変わらなければ再レンダーをスキップできる。
export default memo(CombinedSummaryBase)
