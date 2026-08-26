import { useState, useMemo, useDeferredValue } from 'react'
import {
  Box, AppBar, Toolbar, IconButton, InputBase, Typography, Stack, Chip, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import { searchExpenses, monthlyTotals } from '../utils/searchExpenses'
import { CARDS, CARD_LIST } from '../utils/ccStorage'
import { fmt, signedAmount } from '../utils/finance'
import { useKeyboardInset } from '../utils/useKeyboardInset'

/**
 * 全カード・全期間の横断検索。
 *
 * 「あの店に今年いくら使ったか」を出すのが目的なので、明細だけでなく
 * 合計と月ごとの内訳も一緒に見せる。
 */

const RANGES = [
  { key: 12, label: '1年' },
  { key: 24, label: '2年' },
  { key: 60, label: '5年' },
]

export default function SearchScreen({ onClose }) {
  // アプリ版はキーボードが出ると WebView が縮む。縮んだぶんを足して高さを保つ
  useKeyboardInset()
  const [query, setQuery] = useState('')
  const [months, setMonths] = useState(12)
  const [cardId, setCardId] = useState(null)

  // 1 文字ごとに全期間を舐めると入力が詰まるので、確定を待ってから探す
  const deferred = useDeferredValue(query)
  const { hits, total, count } = useMemo(
    () => searchExpenses(deferred, { months, cardId: cardId ?? undefined }),
    [deferred, months, cardId],
  )
  const byMonth = useMemo(() => monthlyTotals(hits), [hits])
  const maxMonth = Math.max(...byMonth.map((m) => Math.abs(m.total)), 1)

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'background.default',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100% + var(--kb-inset, 0px))',
    }}>
      <AppBar position="static" elevation={0}>
        <Toolbar variant="dense" sx={{ minHeight: 52, gap: 1 }}>
          <IconButton color="inherit" edge="start" aria-label="戻る" onClick={onClose}>
            <ArrowBackIcon />
          </IconButton>
          <InputBase
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="店名・品名・分類で探す"
            inputProps={{ 'aria-label': '支出を検索' }}
            sx={{ flex: 1, color: 'inherit', fontSize: 15 }}
          />
          {query && (
            <IconButton color="inherit" size="small" aria-label="消す" onClick={() => setQuery('')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* 絞り込み */}
      <Stack direction="row" gap={0.5} sx={{ px: 1.5, py: 1, flexWrap: 'wrap' }}>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} size="small"
            onClick={() => setMonths(r.key)}
            variant={months === r.key ? 'filled' : 'outlined'}
            color={months === r.key ? 'primary' : 'default'}
            sx={{ height: 24, fontSize: 11 }} />
        ))}
        <Box sx={{ width: 8 }} />
        <Chip label="すべて" size="small" onClick={() => setCardId(null)}
          variant={cardId === null ? 'filled' : 'outlined'}
          color={cardId === null ? 'primary' : 'default'}
          sx={{ height: 24, fontSize: 11 }} />
        {CARD_LIST.map((c) => (
          <Chip key={c.id} label={c.shortName} size="small"
            onClick={() => setCardId(c.id)}
            variant={cardId === c.id ? 'filled' : 'outlined'}
            sx={{
              height: 24, fontSize: 11,
              bgcolor: cardId === c.id ? c.color : 'transparent',
              color: cardId === c.id ? '#fff' : 'text.secondary',
              borderColor: c.color,
            }} />
        ))}
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', pb: 4 }}>
        {!query.trim() ? (
          <Typography variant="caption" color="text.disabled"
            sx={{ display: 'block', textAlign: 'center', mt: 6 }}>
            店名や品名を入れると、全カード・全期間から探します
          </Typography>
        ) : count === 0 ? (
          <Typography variant="caption" color="text.disabled"
            sx={{ display: 'block', textAlign: 'center', mt: 6 }}>
            見つかりませんでした
          </Typography>
        ) : (
          <>
            {/* 合計 */}
            <Box sx={{ mx: 1.5, mb: 1, p: 1.5, borderRadius: 2, bgcolor: 'var(--surface-header)', color: '#fff' }}>
              <Typography variant="caption" sx={{ opacity: .7 }}>{count}件の合計</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -.5 }}>
                ¥{fmt(total)}
              </Typography>
              {byMonth.length > 1 && (
                <Stack direction="row" alignItems="stretch" gap={0.4} sx={{ height: 44, mt: 1 }}>
                  {byMonth.map((m) => (
                    <Stack key={m.ym} alignItems="center" justifyContent="flex-end"
                      sx={{ flex: 1, minWidth: 0, height: '100%' }}>
                      <Box sx={{
                        width: '100%',
                        height: `${Math.max((Math.abs(m.total) / maxMonth) * 100, m.total ? 6 : 0)}%`,
                        bgcolor: 'rgba(255,255,255,.55)', borderRadius: '2px 2px 0 0',
                      }} />
                      <Typography sx={{ fontSize: 8, opacity: .6, mt: 0.3 }}>
                        {Number(m.ym.split('-')[1])}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            {/* 明細 */}
            <Box sx={{ bgcolor: 'var(--bg-paper)' }}>
              {hits.map((h, i) => (
                <Box key={`${h._cardId}-${h._ym}-${h.id}-${i}`}>
                  {i > 0 && <Divider />}
                  <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {h.date ? h.date.slice(2).replace(/-/g, '/') : `${h._ym.replace('-', '/')}`}
                        </Typography>
                        <Chip label={CARDS[h._cardId]?.shortName ?? h._cardId} size="small"
                          sx={{ height: 15, fontSize: 8, bgcolor: CARDS[h._cardId]?.color, color: '#fff' }} />
                        {h._type === 'fixed' && (
                          <Chip label="固定" size="small" sx={{ height: 15, fontSize: 8 }} />
                        )}
                      </Stack>
                      <Typography fontSize={13} noWrap>{h.name || h.payee || '（無題）'}</Typography>
                    </Box>
                    <Typography fontSize={13} fontWeight={600}
                      sx={{ whiteSpace: 'nowrap', color: h.sign === 1 ? 'success.main' : 'inherit' }}>
                      {h.sign === 1 ? '+' : ''}¥{fmt(Math.abs(signedAmount(h)))}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}
