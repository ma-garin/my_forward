import { Box, Typography, Stack, Card, CardActionArea, Radio } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useThemeMode } from '../ThemeModeContext'

const OPTIONS = [
  {
    value: 'classic',
    label: '現行',
    desc: 'これまでの標準デザイン。フラットで情報量重視。',
    swatch: ['#37474f', '#eceff1', '#ffffff'],
  },
  {
    value: 'apple',
    label: 'Apple風',
    desc: '半透明のすりガラス・光学的なタイポグラフィ・自然なスプリング操作。',
    swatch: ['#263238', 'rgba(255,255,255,0.72)', '#eceff1'],
  },
]

export default function AppearanceSettings() {
  const { mode, setMode } = useThemeMode()

  return (
    <Box>
      <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="h6" fontWeight={700}>外観</Typography>
        <Typography variant="caption" color="text.secondary">
          アプリ全体のデザインを切り替えます。いつでも元に戻せます。
        </Typography>
      </Box>

      <Stack spacing={1.5} sx={{ p: 2 }}>
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value
          return (
            <Card
              key={opt.value}
              variant="outlined"
              sx={{
                borderColor: selected ? 'primary.main' : 'divider',
                borderWidth: selected ? 2 : 1,
              }}
            >
              <CardActionArea onClick={() => setMode(opt.value)} sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  {/* カラースウォッチ（プレビュー） */}
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: 2, flexShrink: 0,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <Box sx={{ flex: 1, bgcolor: opt.swatch[0] }} />
                    <Box sx={{ flex: 1, bgcolor: opt.swatch[2], display: 'flex' }}>
                      <Box sx={{ flex: 1, m: 0.4, borderRadius: 0.5, bgcolor: opt.swatch[1] }} />
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Typography fontWeight={700} fontSize={15}>{opt.label}</Typography>
                      {selected && <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {opt.desc}
                    </Typography>
                  </Box>

                  <Radio checked={selected} tabIndex={-1} sx={{ p: 0.5 }} />
                </Stack>
              </CardActionArea>
            </Card>
          )
        })}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
        ※ 端末の「視差効果を減らす」設定が有効な場合、Apple風でもアニメーションは控えめになります。
      </Typography>
    </Box>
  )
}
