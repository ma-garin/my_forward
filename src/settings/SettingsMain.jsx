import { List, ListItem, ListItemButton, ListItemText, ListItemIcon, Divider, Typography, Box } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import HistoryIcon from '@mui/icons-material/History'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { isNativeApp } from '../utils/notificationCapture'

const ITEMS = [
  { key: 'salary',        label: '給与設定',   sub: '基本給・支給項目・控除項目',    icon: <AccountBalanceWalletIcon /> },
  { key: 'card',          label: 'カード設定',  sub: '保有カード・締め日・支払い日',   icon: <CreditCardIcon /> },
  { key: 'salaryHistory', label: '給与履歴',    sub: '給与明細の履歴・推移グラフ',    icon: <HistoryIcon /> },
  { key: 'data',          label: 'データ管理',  sub: 'エクスポート・インポート・暗号化バックアップ', icon: <CloudDownloadIcon /> },
  { key: 'appInfo',       label: 'アプリ情報',  sub: 'バージョン・変更履歴・ライセンス', icon: <InfoOutlinedIcon /> },
]

// 通知の取り込みは Android アプリ版だけの機能。Web 版では項目自体を出さない
// （開いても「使えません」と出るだけの行を並べない）。
const NOTIFICATION_ITEM = {
  key: 'notifications', label: '通知の取り込み', sub: 'クレカ利用通知の記録（Androidアプリのみ）',
  icon: <NotificationsActiveOutlinedIcon />,
}

export default function SettingsMain({ onNavigate }) {
  const items = isNativeApp() ? [...ITEMS, NOTIFICATION_ITEM] : ITEMS
  return (
    <Box>
      <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="h6" fontWeight={700}>設定</Typography>
      </Box>
      <List disablePadding>
        {items.map((item, i) => (
          <Box key={item.key}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => onNavigate(item.key)} sx={{ py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={<Typography fontWeight={600} fontSize={14}>{item.label}</Typography>}
                  secondary={<Typography fontSize={11} color="text.secondary">{item.sub}</Typography>}
                />
                <ChevronRightIcon sx={{ color: 'text.disabled' }} />
              </ListItemButton>
            </ListItem>
            {i < items.length - 1 && <Divider />}
          </Box>
        ))}
      </List>
    </Box>
  )
}
