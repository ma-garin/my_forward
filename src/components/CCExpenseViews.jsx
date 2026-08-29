import { useState, useMemo, useCallback, memo } from 'react'
import { Box, Typography, Stack, Chip, Menu, MenuItem, Checkbox } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SwipeRow from './SwipeRow'
import { fmt, signedAmount, countsAsSpending } from '../utils/finance'
import { CATEGORY_COLORS, BORDER_LIGHT, SPEND_TYPE_COLORS } from '../utils/ccStorage'

// ─── 共通スタイル ─────────────────────────────────────────
// レンダーごとに新しいオブジェクトを作らないよう、モジュール定数として持つ。

const GROUP_HEAD_SX  = { px: 2, py: 0.5, bgcolor: 'var(--surface-line)', borderBottom: '1px solid var(--divider)' }
const GROUP_LABEL_SX = { fontSize: 11, fontWeight: 700, color: 'text.secondary' }
const GROUP_TOTAL_SX = { fontSize: 10, color: 'text.disabled', ml: 1, fontVariantNumeric: 'tabular-nums' }

// 状態で変わるものだけ 2 種類用意する
const ROW_SX        = { px: 2, py: 1, borderBottom: BORDER_LIGHT, opacity: 1, '&:hover': { bgcolor: '#f9fbe7' } }
const ROW_SX_BILLED = { ...ROW_SX, opacity: 0.55 }

const CHECKBOX_SX = {
  p: 0.75, ml: -1, flexShrink: 0, color: '#bdbdbd', '&.Mui-checked': { color: '#43a047' },
  '& .MuiSvgIcon-root': { fontSize: 20 },
}

// 1 行目はカテゴリ＋支払先。色ドットは固定サイズなので、カテゴリ名が何文字でも
// 文字の開始位置は動かない。1 行に流して溢れは省略する（折り返すと行高が変わる）。
const HEAD_LINE_SX        = { fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const HEAD_LINE_BILLED_SX = { ...HEAD_LINE_SX, textDecoration: 'line-through', color: '#9e9e9e' }

const DOT_SX  = { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }
// 補足行はドット幅＋隙間だけ字下げして、見出しの文字と開始位置を合わせる
const META_SX = {
  fontSize: 10.5, color: 'text.secondary', lineHeight: 1.25, minWidth: 0, pl: '11px',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

// 行の左端は固定幅の枠。固定費は引き落としチェック、変動費は消費分類が入る。
// 枠を固定幅にすることで、分類やカテゴリの文字数に関係なく見出しの開始位置が揃う
// （分類チップを項目名の後ろに置いていたときは、名前の長さでチップ位置がずれていた）。
const SPEND_SLOT_SX = { width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center' }

// チップは枠いっぱいに広げる。消費/投資/浪費で見た目の幅が変わらない。
const SPEND_CHIP_BASE_SX = {
  height: 15, fontSize: 8, width: '100%',
  '& .MuiChip-label': { px: 0, width: '100%', textAlign: 'center' },
}
const SPEND_CHIP_FALLBACK_SX = { ...SPEND_CHIP_BASE_SX, bgcolor: '#eceff1', color: '#fff' }
// 振替は消費分類を持たない。分類の枠に「振替」を出して、支出でないと分かるようにする
const TRANSFER_CHIP_SX = { ...SPEND_CHIP_BASE_SX, bgcolor: '#546e7a', color: '#fff' }
const SPEND_CHIP_SX = Object.fromEntries(
  Object.entries(SPEND_TYPE_COLORS).map(([type, color]) => [
    type, { ...SPEND_CHIP_BASE_SX, bgcolor: color, color: '#fff' },
  ]),
)

const AMOUNT_SX   = { fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }
const SUBTOTAL_SX = { fontSize: 9, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }
const CHEVRON_SX  = { fontSize: 20, color: 'text.disabled', flexShrink: 0, ml: 0.25 }

const LEFT_STACK_SX  = { flex: 1, minWidth: 0 }
const RIGHT_STACK_SX = { flexShrink: 0 }
const MIN0_SX        = { minWidth: 0 }

/**
 * 固定費・変動費で共通の 1 行。
 * 行タップで編集、左スワイプで削除（iOS のリストと同じ作法）。
 * 小さいアイコンを狙わせないことで、右下に浮く FAB と操作が競合しなくなる。
 *
 * 左: [チェック（固定費）| 消費分類（変動費）] カテゴリ・支払先 と、項目名の補足行
 * 右: 金額 / `sub`（累計・構成比など呼び出し側が決めた 1 行）と chevron
 *
 * `sub` は文字列で受ける。並び順によって出したいものが変わる（日付順なら累計、
 * 金額順なら日付と構成比）ので、行側では意味を決めない。
 *
 * ハンドラは item / id を引数で受ける形にしてある（行ごとにクロージャを作らない
 * ので、呼び出し側が参照を固定していれば memo が効く）。
 */
export const ExpenseRow = memo(function ExpenseRow({
  item, sub, notes, billed = false, onToggleBilled, onEdit, onDelete, onContextMenu,
}) {
  const { category, spendType, sign, name, payee, amount, transfer } = item
  return (
    <SwipeRow onDelete={() => onDelete(item.id)} onClick={() => onEdit(item)}>
      <Box
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, item) : undefined}
        sx={billed ? ROW_SX_BILLED : ROW_SX}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.75} sx={LEFT_STACK_SX}>
            {onToggleBilled ? (
              <Checkbox
                checked={billed} size="small" aria-label="引き落とし済み"
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleBilled(item.id)}
                sx={CHECKBOX_SX}
              />
            ) : (
              // 返金は分類を出さないが、枠は空のまま残して見出しの開始位置を揃える
              <Box sx={SPEND_SLOT_SX}>
                {transfer ? (
                  <Chip label="振替" size="small" sx={TRANSFER_CHIP_SX} />
                ) : spendType && sign !== 1 && (
                  <Chip label={spendType} size="small"
                    sx={SPEND_CHIP_SX[spendType] ?? SPEND_CHIP_FALLBACK_SX} />
                )}
              </Box>
            )}
            <Box sx={MIN0_SX}>
              <Stack direction="row" alignItems="center" gap={0.5} sx={MIN0_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: CATEGORY_COLORS[category] ?? '#cfd8dc' }} />
                <Typography sx={billed ? HEAD_LINE_BILLED_SX : HEAD_LINE_SX}>
                  {[category, payee].filter(Boolean).join(' · ')}
                </Typography>
              </Stack>
              <Typography sx={META_SX}>
                {[name, ...(notes ?? [])].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Stack>
          <Stack alignItems="center" direction="row" gap={0.25} sx={RIGHT_STACK_SX}>
            <Stack alignItems="flex-end">
              <Typography variant="body2"
                sx={transfer ? { ...AMOUNT_SX, color: 'text.disabled', fontWeight: 500 } : AMOUNT_SX}>
                ¥{fmt(amount)}
              </Typography>
              {sub && <Typography variant="caption" sx={SUBTOTAL_SX}>{sub}</Typography>}
            </Stack>
            <ChevronRightIcon sx={CHEVRON_SX} />
          </Stack>
        </Stack>
      </Box>
    </SwipeRow>
  )
})

/** グループ見出し（変動費=日付 / 固定費=支払日）。両者で同じ体裁にする。 */
export function ExpenseGroupHeader({ label, total }) {
  return (
    <Box sx={GROUP_HEAD_SX}>
      <Typography variant="caption" sx={GROUP_LABEL_SX}>
        {label}
        <Typography component="span" variant="caption" sx={GROUP_TOTAL_SX}>¥{fmt(total)}</Typography>
      </Typography>
    </Box>
  )
}

const shortDate = (d) => {
  if (!d || d === '—') return '—'
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}


/**
 * 変動費リスト。
 *
 * `sort` は 'date_asc' | 'date_desc' | 'amount_desc' | 'amount_asc'。
 * 日付順は日付ごとに見出しを出して累計を添える。金額順は日付でまとめる意味が
 * ないので見出しなしの 1 本のリストにし、行が失う日付を補足行に入れる。
 */
export function VarExpenseTable({ varList, sort = 'date_asc', emptyText, onEdit, onDelete }) {
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, item }

  // 並べ替えとグループ化は varList / 並び順が変わったときだけ計算する
  const grouped = useMemo(() => {
    if (sort === 'amount_desc' || sort === 'amount_asc') {
      const total  = varList.reduce((s, x) => s + signedAmount(x), 0)
      const sorted = [...varList].sort((a, b) => sort === 'amount_desc'
        ? signedAmount(b) - signedAmount(a)
        : signedAmount(a) - signedAmount(b))
      // 見出しを持たない 1 グループ。日付と、月合計に占める割合を補足行に出す。
      return [{
        date: '__amount__',
        header: null,
        items: sorted.map(item => ({
          ...item,
          sub: total > 0
            ? `${shortDate(item.date)} · ${Math.round(signedAmount(item) / total * 100)}%`
            : shortDate(item.date),
        })),
      }]
    }

    const out = []
    let running = 0
    // varList は日付の古い順で保存されている（ccStorage の byDate）
    varList.forEach(item => {
      // 累計・日付ごとの合計も signedAmount で積む。ここで item.amount を
      // 直に足すと、返金や振替を含んだ額が出て、カード上部の使用額と食い違う
      const value = signedAmount(item)
      running += value
      const row  = { ...item, sub: `累計 ¥${fmt(running)}` }
      const last = out[out.length - 1]
      const d    = item.date ?? '—'
      if (last && last.date === d) { last.items.push(row); last.total += value }
      else out.push({ date: d, header: d, items: [row], total: value })
    })
    if (sort === 'date_asc') return out
    // 累計は「その日までの合計」なので、必ず古い順で積んでから並べ替える。
    // 表示順のまま積み直すと、新しい順のときに累計の意味が変わってしまう。
    return out.reverse().map(g => ({ ...g, items: [...g.items].reverse() }))
  }, [varList, sort])

  const openCtxMenu = useCallback((e, item) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, item })
  }, [])

  if (varList.length === 0) return (
    <Typography variant="caption" color="text.disabled" sx={{ py: 1, display: 'block' }}>
      {emptyText ?? 'この月の変動費を追加してください'}
    </Typography>
  )

  return (
    <>
      <Box>
        {grouped.map(({ date, header, items, total }) => (
          <Box key={date}>
            {header != null && <ExpenseGroupHeader label={shortDate(header)} total={total} />}
            {items.map(item => (
              <ExpenseRow
                key={item.id}
                item={item}
                sub={item.sub}
                onEdit={onEdit}
                onDelete={onDelete}
                onContextMenu={openCtxMenu}
              />
            ))}
          </Box>
        ))}
      </Box>
      <Menu open={!!ctxMenu} onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}>
        <MenuItem onClick={() => { onEdit(ctxMenu.item); setCtxMenu(null) }}>
          <EditIcon sx={{ mr: 1, fontSize: 16 }} />編集
        </MenuItem>
        <MenuItem onClick={() => { onDelete(ctxMenu.item.id); setCtxMenu(null) }} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 16 }} />削除
        </MenuItem>
      </Menu>
    </>
  )
}

export function DailyBarChart({ varList }) {
  if (varList.length === 0) return null

  const byDate = {}
  varList.forEach(x => {
    if (!x.date || x.sign === 1 || !countsAsSpending(x)) return
    byDate[x.date] = (byDate[x.date] ?? 0) + x.amount
  })
  const dates = Object.keys(byDate).sort()
  if (dates.length === 0) return null

  const maxAmt   = Math.max(...Object.values(byDate))
  const CHART_H  = 80
  const BAR_W    = 28
  const todayStr = new Date().toISOString().slice(0, 10)
  const fmtAmt   = (v) => v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`

  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: '1px solid var(--surface-muted)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>日別支出</Typography>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled' }}>最大 ¥{fmt(maxAmt)}</Typography>
      </Stack>
      {/* 高さは固定しない。固定値だと最も高い棒の金額ラベルが入りきらず上で切れる。
          列の中身（ラベル + 棒 + 日付軸）で自然に高さが決まるようにする。 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', minHeight: CHART_H + 30, overflowX: 'auto', overflowY: 'hidden', pb: 0.5 }}>
        {dates.map(d => {
          const amt  = byDate[d]
          const barH = Math.max(4, Math.round((amt / maxAmt) * CHART_H))
          const day  = parseInt(d.slice(8))
          const isToday = d === todayStr
          const isMax   = amt === maxAmt
          return (
            <Box key={d} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: BAR_W }}>
              <Typography variant="caption" sx={{ fontSize: 8, color: isMax ? '#e53935' : 'text.disabled', fontWeight: isMax ? 700 : 400, mb: 0.25, lineHeight: 1.2 }}>
                ¥{fmtAmt(amt)}
              </Typography>
              <Box sx={{ width: BAR_W - 4, height: barH, bgcolor: isToday ? '#1976d2' : isMax ? '#e53935' : '#90a4ae', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
              <Box sx={{ width: '100%', borderTop: '1px solid var(--divider)', pt: 0.25 }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: isToday ? '#1976d2' : 'text.secondary', fontWeight: isToday ? 700 : 400, display: 'block', textAlign: 'center' }}>
                  {day}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
