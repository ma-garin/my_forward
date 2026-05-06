import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { Box, AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction, Paper, IconButton, Drawer } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import HomeIcon from '@mui/icons-material/Home'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import theme from './theme'
import SalarySimulation from './tabs/SalarySimulation'
import CreditCard from './tabs/CreditCard'
import Kakeibo from './tabs/Kakeibo'
import Cashflow from './tabs/Cashflow'
import SalaryHistory from './tabs/SalaryHistory'
import SettingsMain from './settings/SettingsMain'
import SalarySettings from './settings/SalarySettings'
import CardSettings from './settings/CardSettings'
import DataSettings from './settings/DataSettings'
import AppInfo from './settings/AppInfo'

const TABS = [
  { label: 'クレカ', icon: <CreditCardIcon /> },
  { label: '家計',   icon: <HomeIcon /> },
  { label: '支出一覧', icon: <ReceiptLongIcon /> },
  { label: '給与',   icon: <AccountBalanceWalletIcon /> },
]

const SETTINGS_TITLES = {
  salary:        '給与設定',
  card:          'カード設定',
  data:          'データ管理',
  salaryHistory: '給与履歴',
  appInfo:       'アプリ情報',
}

export default function App() {
  const [activeTab,    setActiveTab]    = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState(null)

  const openSettings = () => { setSettingsPage(null); setSettingsOpen(true) }
  const closeSettings = () => setSettingsOpen(false)
  const navigateTo = (page) => setSettingsPage(page)
  const goBack = () => setSettingsPage(null)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', maxWidth: 600, mx: 'auto', bgcolor: 'background.default' }}>

        {/* AppBar */}
        <AppBar position="static" color="primary" elevation={0}>
          <Toolbar variant="dense" sx={{ minHeight: 52 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: 1, flex: 1 }}>
              資産管理
            </Typography>
            <IconButton color="inherit" aria-label="設定を開く" onClick={openSettings}>
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', pb: 'calc(56px + env(safe-area-inset-bottom))' }}>
          {activeTab === 0 && <CreditCard />}
          {activeTab === 1 && <Kakeibo />}
          {activeTab === 2 && <Cashflow />}
          {activeTab === 3 && <SalarySimulation />}
        </Box>

        {/* Bottom Navigation */}
        <Paper sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 100, pb: 'env(safe-area-inset-bottom)' }} elevation={3}>
          <BottomNavigation value={activeTab} onChange={(_, v) => setActiveTab(v)} showLabels sx={{ bgcolor: 'background.paper' }}>
            {TABS.map((tab) => (
              <BottomNavigationAction key={tab.label} label={tab.label} icon={tab.icon} sx={{ fontSize: 11 }} />
            ))}
          </BottomNavigation>
        </Paper>

        {/* 設定ドロワー */}
        <Drawer anchor="right" open={settingsOpen} onClose={closeSettings}
          slotProps={{ paper: { sx: { width: '100vw', maxWidth: 600 } } }}>

          {/* 設定ヘッダー */}
          <AppBar position="static" color="primary" elevation={0}>
            <Toolbar variant="dense" sx={{ minHeight: 52 }}>
              <IconButton color="inherit" edge="start" aria-label="戻る" onClick={settingsPage ? goBack : closeSettings} sx={{ mr: 1 }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={600}>
                {settingsPage ? SETTINGS_TITLES[settingsPage] : '設定'}
              </Typography>
            </Toolbar>
          </AppBar>

          {/* 設定コンテンツ */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!settingsPage                    && <SettingsMain onNavigate={navigateTo} />}
            {settingsPage === 'salary'        && <SalarySettings />}
            {settingsPage === 'card'          && <CardSettings />}
            {settingsPage === 'data'          && <DataSettings />}
            {settingsPage === 'salaryHistory' && <SalaryHistory />}
            {settingsPage === 'appInfo'       && <AppInfo />}
          </Box>
        </Drawer>
      </Box>
    </ThemeProvider>
  )
}
