import { useState, useMemo } from 'react'
import { Box } from '@mui/material'
import MonthNav from '../components/MonthNav'
import CombinedSummary from '../components/CombinedSummary'
import NetWorthCard from '../components/NetWorthCard'
import LivingExpenseCard from '../components/LivingExpenseCard'
import IncomeSummaryCard from '../components/IncomeSummaryCard'
import { CategoryChart, CategoryBreakdown, SpendTypeChart } from '../components/CategoryViews'
import MonthlyTrendCard from '../components/MonthlyTrendCard'
import FixedInventoryCard from '../components/FixedInventoryCard'
import YearlyReviewCard from '../components/YearlyReviewCard'
import DiagnosisCard from '../components/DiagnosisCard'
import { CARD_LIST, loadFixed, loadLimit, loadVar } from '../utils/ccStorage'
import { isActiveForYm } from '../utils/finance'
import { isCardVisible } from '../utils/cardVisibility'

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
  return ymStr(today.getFullYear(), today.getMonth() + 1)
}

const tag = (list, cardId) => list.map(x => ({ ...x, _cardId: cardId }))

export default function Kakeibo() {
  const [ym, setYm] = useState(currentYm)
  const [refreshKey, setRefreshKey] = useState(0)

  const changeMonth = (n) => setYm(prev => addMonth(prev, n))
  const goToMonth   = (y, m) => setYm(ymStr(y, m))

  const [year, month] = ym.split('-').map(Number)
  const billingYm = addMonth(ym, -1)

  // localStorage 読み込み・タグ付けは billingYm / refreshKey が変わったときだけ再計算。
  // 子コンポーネントの state 変化による親の再レンダーで 8 回の parse+filter が
  // 毎回走るのを防ぐ。参照が安定し下流チャートの内部 useMemo もヒットする。
  const {
    allFixed, allVar, allFixedPrev, allVarPrev, combinedLimit,
  } = useMemo(() => {
    const prevBillingYm = addMonth(billingYm, -1)
    const collectFixed = (ym) => CARD_LIST.flatMap((c) => tag(loadFixed(c.id).filter(x => isActiveForYm(x, ym)), c.id))
    const collectVar   = (ym) => CARD_LIST.flatMap((c) => tag(loadVar(c.id, ym), c.id))
    return {
      allFixed:     collectFixed(billingYm),
      allVar:       collectVar(billingYm),
      allFixedPrev: collectFixed(prevBillingYm),
      allVarPrev:   collectVar(prevBillingYm),
      combinedLimit: CARD_LIST.reduce((sum, c) => sum + (parseFloat(loadLimit(c.id)) || 0), 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingYm, refreshKey])

  return (
    <Box sx={{ px: 2, pt: 2, pb: 10 }}>

      {/* 月ナビゲーション */}
      <MonthNav year={year} month={month} onStep={changeMonth} onJump={goToMonth} />

      {/* 収支サマリー */}
      {isCardVisible('kk.income') && <IncomeSummaryCard ym={ym} salaryYm={billingYm} />}

      {/* 家計診断（5観点の採点） */}
      {isCardVisible('kk.diagnosis') && <DiagnosisCard key={`diag-${billingYm}`} ym={billingYm} />}

      {/* 2枚合計サマリー */}
      {isCardVisible('kk.combined') && <CombinedSummary ym={billingYm} salaryYm={billingYm} combinedLimit={combinedLimit} />}

      {/* 資産（口座残高・純資産） */}
      {isCardVisible('kk.networth') && <NetWorthCard billingYm={billingYm} isCurrentMonth={ym === currentYm()} />}

      {/* 生活費カード */}
      {isCardVisible('kk.living') && <LivingExpenseCard ym={billingYm} />}

      {/* 支出トレンド */}
      {isCardVisible('kk.trend') && <MonthlyTrendCard currentBillingYm={billingYm} />}

      {/* 1 年でいくら入っていくら残ったか。月の画面と同じ足し方で積む */}
      {isCardVisible('kk.yearlyReview') && <YearlyReviewCard key={billingYm.slice(0, 4)} year={Number(billingYm.slice(0, 4))} />}

      {/* 固定費を年額で並べる。解約する / しないの判断はここでする */}
      {isCardVisible('kk.inventory') && <FixedInventoryCard fromYm={billingYm} />}

      {/* 消費分類（全カード） */}
      {isCardVisible('kk.spendType') && <SpendTypeChart varList={allVar} />}

      {/* カテゴリ別グラフ（全カード） */}
      {isCardVisible('kk.categoryChart') && <CategoryChart fixedList={allFixed} varList={allVar} />}

      {/* カテゴリ別集計（全カード） */}
      {isCardVisible('kk.categoryBreakdown') && (
        <CategoryBreakdown
          fixedList={allFixed}
          varList={allVar}
          cardId="all"
          ym={billingYm}
          onUpdate={() => setRefreshKey(k => k + 1)}
          prevFixedList={allFixedPrev}
          prevVarList={allVarPrev}
        />
      )}

    </Box>
  )
}
