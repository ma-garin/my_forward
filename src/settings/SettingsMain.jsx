import { List, ListItem, ListItemButton, ListItemText, ListItemIcon, Divider, Typography, Box } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import HistoryIcon from '@mui/icons-material/History'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

const ITEMS = [
  { key: 'salary',        label: '給与設定',   sub: '基本給・支給項目・控除項目',    icon: <AccountBalanceWalletIcon /> },
  { key: 'card',          label: 'カード設定',  sub: '保有カード・締め日・支払い日',   icon: <CreditCardIcon /> },
  { key: 'salaryHistory', label: '給与履歴',    sub: '給与明細の履歴・推移グラフ',    icon: <HistoryIcon /> },
  { key: 'data',          label: 'データ管理',  sub: 'エクスポート・インポート・暗号化バックアップ', icon: <CloudDownloadIcon /> },
  { key: 'appInfo',       label: 'アプリ情報',  sub: 'バージョン・変更履歴・ライセンス', icon: <InfoOutlinedIcon /> },
]

export default function SettingsMain({ onNavigate }) {
  return (
    <Box>
      <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="h6" fontWeight={700}>設定</Typography>
      </Box>
      <List disablePadding>
        {ITEMS.map((item, i) => (
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
            {i < ITEMS.length - 1 && <Divider />}
          </Box>
        ))}
      </List>
    </Box>
  )
}
