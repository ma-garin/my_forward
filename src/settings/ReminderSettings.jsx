import { Box, Typography, Switch, Stack, Divider, Alert } from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { useReminderSettings, isRemindersAvailable } from '../utils/useReminders'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function fmtWhen(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]}) ${date.getHours()}:00`
}

export default function ReminderSettings() {
  const { enabled, granted, schedule, toggle } = useReminderSettings()

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>通知</Typography>

      {!isRemindersAvailable() && (
        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          通知はアプリ版でのみ使えます。
        </Alert>
      )}

      <Box sx={{ border: '1px solid var(--divider)', borderRadius: 2, px: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
            <NotificationsActiveIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Box>
              <Typography fontSize={14} fontWeight={500}>締め日・支払日を知らせる</Typography>
              <Typography variant="caption" color="text.secondary">
                締め日は当日の朝 9:00、引き落としは前日の 20:00
              </Typography>
            </Box>
          </Stack>
          <Switch
            checked={enabled}
            disabled={!isRemindersAvailable()}
            onChange={(e) => toggle(e.target.checked)}
            inputProps={{ 'aria-label': '締め日・支払日を知らせる' }}
          />
        </Stack>
      </Box>

      {!granted && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }}>
          端末の通知が許可されていません。設定 → アプリ → 資産管理 → 通知 から許可してください。
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 0.5 }} fontWeight={700}>
        これから届く予定
      </Typography>

      {schedule.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 2, textAlign: 'center' }}>
          {enabled ? '予定はありません' : '通知をオンにすると表示されます'}
        </Typography>
      ) : (
        <Box sx={{ border: '1px solid var(--divider)', borderRadius: 2, px: 2 }}>
          {schedule.slice(0, 8).map((n, i) => (
            <Box key={n.id}>
              {i > 0 && <Divider />}
              <Box sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography fontSize={13} fontWeight={500} sx={{ minWidth: 0 }}>{n.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {fmtWhen(n.at)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{n.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontSize: 11 }}>
        金額はアプリを開くたびに計算し直して登録します。支出を入れたあとは次に開いたときに反映されます。
      </Typography>
    </Box>
  )
}
