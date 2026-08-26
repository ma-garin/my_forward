import { Box, Typography, Stack, Divider, Radio } from '@mui/material'
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useColorMode, THEME_MODE_LABELS } from '../utils/useColorMode'

const OPTIONS = [
  { key: 'system', icon: BrightnessAutoIcon, note: '端末のダークテーマに追従します' },
  { key: 'light',  icon: LightModeIcon,      note: '常に明るい配色' },
  { key: 'dark',   icon: DarkModeIcon,       note: '常に暗い配色' },
]

export default function AppearanceSettings() {
  const { mode, resolved, setMode } = useColorMode()

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>外観</Typography>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2 }}>
        {OPTIONS.map((o, i) => {
          const Icon = o.icon
          return (
            <Box key={o.key}>
              {i > 0 && <Divider />}
              <Stack
                direction="row" alignItems="center" gap={1.5}
                onClick={() => setMode(o.key)}
                sx={{ py: 1.5, cursor: 'pointer' }}
                role="radio" aria-checked={mode === o.key} aria-label={THEME_MODE_LABELS[o.key]}
              >
                <Icon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontSize={14} fontWeight={500}>{THEME_MODE_LABELS[o.key]}</Typography>
                  <Typography variant="caption" color="text.secondary">{o.note}</Typography>
                </Box>
                <Radio checked={mode === o.key} size="small" tabIndex={-1} />
              </Stack>
            </Box>
          )
        })}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        いまは{resolved === 'dark' ? 'ダーク' : 'ライト'}で表示しています。
      </Typography>
    </Box>
  )
}
