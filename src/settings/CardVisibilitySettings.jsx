import { useState } from 'react'
import { Box, Typography, Stack, Switch } from '@mui/material'
import { HIDEABLE_CARDS, loadHiddenCards, setCardVisible } from '../utils/cardVisibility'

/**
 * 画面のカードの表示 / 非表示。
 * 使わないカードを隠して、よく見るものを上に残す。いつでも戻せる。
 */
export default function CardVisibilitySettings() {
  const [hidden, setHidden] = useState(loadHiddenCards)

  const toggle = (id, visible) => {
    setCardVisible(id, visible)
    setHidden(loadHiddenCards())
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>表示するカード</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        オフにしたカードは画面から消えます（データは消えません）。いつでも戻せます。
      </Typography>

      {HIDEABLE_CARDS.map((group) => (
        <Box key={group.tab} sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ display: 'block', mb: 0.5 }}>
            {group.tab}タブ
          </Typography>
          <Box sx={{ border: '1px solid var(--divider)', borderRadius: 2, px: 1.5 }}>
            {group.items.map((item, i) => (
              <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between"
                sx={{ py: 0.5, borderTop: i > 0 ? '1px solid var(--surface-line)' : 'none' }}>
                <Typography fontSize={13}>{item.label}</Typography>
                <Switch
                  size="small"
                  checked={!hidden.includes(item.id)}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                  slotProps={{ input: { 'aria-label': item.label } }}
                />
              </Stack>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
