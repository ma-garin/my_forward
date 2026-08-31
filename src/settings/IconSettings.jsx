import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Stack, Alert, CircularProgress } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  APP_ICONS, DEFAULT_ICON_ID, isAppIconAvailable, getAppIcon, setAppIcon,
} from '../utils/appIcon'

/**
 * ホーム画面のアイコンを選ぶ。
 *
 * 見本は実物の画像ではなく、色と同じ形の四角で出す。アイコンの画像を
 * ここにも置くと、色を足したときに 2 箇所直すことになるため。
 */
export default function IconSettings() {
  const available = isAppIconAvailable()
  const [current, setCurrent] = useState(DEFAULT_ICON_ID)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    getAppIcon().then((id) => { if (alive) setCurrent(id) })
    return () => { alive = false }
  }, [])

  const choose = useCallback(async (id) => {
    if (busy || id === current) return
    setBusy(true)
    setFailed(false)
    const applied = await setAppIcon(id)
    if (applied) setCurrent(applied)
    else setFailed(true)
    setBusy(false)
  }, [busy, current])

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>アイコン</Typography>

      {!available && (
        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          アイコンの切り替えは Android アプリ版でのみ使えます。
        </Alert>
      )}

      {failed && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>
          切り替えられませんでした。もう一度お試しください。
        </Alert>
      )}

      <Stack direction="row" gap={1.5} sx={{ flexWrap: 'wrap' }}>
        {APP_ICONS.map((icon) => {
          const selected = icon.id === current
          return (
            <Stack
              key={icon.id}
              alignItems="center"
              gap={0.5}
              onClick={() => available && choose(icon.id)}
              role="radio"
              aria-checked={selected}
              aria-label={icon.label}
              sx={{
                width: 72,
                cursor: available && !busy ? 'pointer' : 'default',
                opacity: available ? (busy && !selected ? 0.5 : 1) : 0.45,
              }}
            >
              <Box sx={{ position: 'relative' }}>
                {/* 絵そのものが違うものは実物を出す。色の四角では区別がつかない */}
                <Box
                  component={icon.image ? 'img' : 'div'}
                  src={icon.image}
                  alt=""
                  sx={{
                    width: 56, height: 56, borderRadius: '28%', display: 'block',
                    objectFit: 'cover',
                    ...(icon.image ? {} : { bgcolor: icon.color }),
                    border: 2,
                    borderColor: selected ? 'primary.main' : 'transparent',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                  }}
                />
                {selected && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute', right: -4, bottom: -4, fontSize: 20,
                      color: 'primary.main', bgcolor: 'var(--bg-paper)', borderRadius: '50%',
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" color={selected ? 'text.primary' : 'text.secondary'}>
                {icon.label}
              </Typography>
            </Stack>
          )
        })}
        {busy && <CircularProgress size={20} sx={{ alignSelf: 'center' }} />}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        ホーム画面のアイコンが変わります。反映まで数秒かかることがあります。
        <br />
        アイコンを固定（ピン留め）している場合は、置き直しが必要になることがあります。
      </Typography>
    </Box>
  )
}
