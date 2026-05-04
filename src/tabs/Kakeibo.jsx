import { useState } from 'react'
import { Box, Typography, Stack, IconButton } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CombinedSummary from '../components/CombinedSummary'
import LivingExpenseCard from '../components/LivingExpenseCard'
import { CategoryChart, CategoryBreakdown, SpendTypeChart } from '../components/CategoryViews'
import { loadFixed, loadVar, CARDS } from '../utils/ccStorage'
import { isActiveForYm } from '../utils/finance'

function ymStr(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return ymStr(d.getFullYear(), d.getMonth() + 1)
}

function currentYm() {
  const today = new Date()
  const cutoff = CARDS.jcb?.cutoffDay ?? 0
  if (cutoff > 0 && today.getDate() <= cutoff) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return ymStr(d.getFullYear(), d.getMonth() + 1)
  }
  return ymStr(today.getFullYear(), today.getMonth() + 1)
}

export default function Kakeibo() {
  const [ym, setYm] = useState(currentYm)
  const [refreshKey, setRefreshKey] = useState(0)

  const changeMonth = (n) => setYm(prev => addMonth(prev, n))

  const [year, month] = ym.split('-').map(Number)

  const jcbFixed = loadFixed('jcb').filter(x => isActiveForYm(x, ym))
  const jcbVar   = loadVar('jcb', ym)
  const prevYm   = addMonth(ym, -1)
  const jcbFixedPrev = loadFixed('jcb').filter(x => isActiveForYm(x, prevYm))
  const jcbVarPrev   = loadVar('jcb', prevYm)
  const jcbLimit = parseFloat(localStorage.getItem('cc_limit_jcb') || '') || 0
  const smbcLimit = parseFloat(localStorage.getItem('cc_limit_smbc') || '') || 0

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
        <IconButton size="small" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="subtitle2" fontWeight={600} sx={{ minWidth: 80, textAlign: 'center' }}>
          {year}年{month}月
        </Typography>
        <IconButton size="small" aria-label="次の月" onClick={() => changeMonth(1)}><ChevronRightIcon /></IconButton>
      </Stack>

      {/* 2枚合計サマリー */}
      <CombinedSummary ym={ym} jcbLimit={jcbLimit} smbcLimit={smbcLimit} />

      {/* 生活費カード */}
      <LivingExpenseCard ym={ym} />

      {/* 消費分類（JCB） */}
      <SpendTypeChart fixedList={jcbFixed} varList={jcbVar} />

      {/* カテゴリ別グラフ（JCB） */}
      <CategoryChart fixedList={jcbFixed} varList={jcbVar} />

      {/* カテゴリ別集計（JCB） */}
      <CategoryBreakdown
        fixedList={jcbFixed}
        varList={jcbVar}
        cardId="jcb"
        ym={ym}
        onUpdate={() => setRefreshKey(k => k + 1)}
        prevFixedList={jcbFixedPrev}
        prevVarList={jcbVarPrev}
      />

    </Box>
  )
}
