import { useState } from 'react'
import { Card, Box, Typography, Stack, Button, IconButton, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CardHeaderBar from './CardHeaderBar'
import ExpenseDialog from './ExpenseDialog'
import { CARDS } from '../utils/ccStorage'
import { fmt } from '../utils/finance'

/**
 * カード利用通知から作った「未確定の支出」。
 *
 * 通知が届いたぶんをそのまま家計に入れると身に覚えのない行が増えるので、
 * ここで一度見せて、押したものだけ登録する。
 *
 * **押した瞬間には登録しない。** 必ず内容を出してから確定させる。
 * 以前は「登録」で分類「その他」のまま即座に変動費へ入っていたので、
 * あとから変動費リストで探して直すことになっていた。
 *
 *   行をタップ / 「確認」 … 内容を出す。そこで保存すると変動費へ入る
 *   ✕                  … 無視（同じ通知が再び届いても復活しない）
 */
export default function InboxCard({ drafts, onAccept, onDismiss, categories }) {
  const [editing, setEditing] = useState(null)

  if (!drafts.length) return null

  const label = (d) => d.payee || '利用先なし'

  return (
    <>
      <Card sx={{ mb: 1.5 }}>
        <CardHeaderBar
          title={`未確定の支出 ${drafts.length}件`}
          right={
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.75)', fontSize: 10 }}>
              カード利用通知から
            </Typography>
          }
        />
        {drafts.map((d, i) => (
          <Box
            key={d.id}
            sx={{
              px: 2, py: 1.25,
              borderTop: i > 0 ? 1 : 0, borderColor: 'divider',
              display: 'flex', alignItems: 'center', gap: 1,
            }}
          >
            <Box
              onClick={() => setEditing(d)}
              sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {d.date.slice(5).replace('-', '/')}
                </Typography>
                <Chip
                  label={CARDS[d.cardId]?.shortName ?? d.cardId}
                  size="small"
                  sx={{ height: 16, fontSize: 9, bgcolor: CARDS[d.cardId]?.color, color: '#fff' }}
                />
                <Typography fontSize={13} fontWeight={500} noWrap>{label(d)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                タップして内容を確認
              </Typography>
            </Box>

            <Typography fontSize={14} fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
              ¥{fmt(d.amount)}
            </Typography>

            {/* 押した瞬間には登録しない。行タップと同じく内容を出してから確定させる */}
            <Button
              size="small" variant="contained" disableElevation
              onClick={() => setEditing(d)}
              sx={{ minWidth: 0, px: 1.25, fontSize: 11 }}
            >
              確認
            </Button>
            <IconButton size="small" aria-label="無視する" onClick={() => onDismiss(d.id)}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}
      </Card>

      {editing && (
        <ExpenseDialog
          open
          title="通知から追加"
          // 分類の既定は「その他」。ダイアログの既定（categories[0]）だと
          // 水道光熱費のまま保存されうる。通知からは分類が分からないので、
          // 中立なものを置いて選び直させる
          initial={{ category: 'その他', ...editing, name: label(editing) }}
          categories={categories}
          cardId={editing.cardId}
          onClose={() => setEditing(null)}
          onSave={(payload) => onAccept(editing.id, payload)}
        />
      )}
    </>
  )
}
