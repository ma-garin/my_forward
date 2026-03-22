import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { Box, AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction, Paper, IconButton, Drawer } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import SavingsIcon from '@mui/icons-material/Savings'
import HistoryIcon from '@mui/icons-material/History'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import theme from './theme'
import SalarySimulation from './tabs/SalarySimulation'
import CreditCard from './tabs/CreditCard'
import BankAccounts from './tabs/BankAccounts'
import SalaryHistory from './tabs/SalaryHistory'
import SettingsMain from './settings/SettingsMain'
import SalarySettings from './settings/SalarySettings'
import CardSettings from './settings/CardSettings'
import AccountSettings from './settings/AccountSettings'
import DataSettings from './settings/DataSettings'

const TABS = [
  { label: '給与', icon: <AccountBalanceWalletIcon /> },
  { label: 'カード', icon: <CreditCardIcon /> },
  { label: '口座', icon: <SavingsIcon /> },
  { label: '給与履歴', icon: <HistoryIcon /> },
]

const SETTINGS_TITLES = {
  salary:  '給与設定',
  card:    'カード設定',
  account: '口座設定',
  data:    'データ管理',
}

export default function App() {
  const [activeTab,    setActiveTab]    = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState(null) // null | 'salary' | 'card' | 'account' | 'data'

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
            <IconButton color="inherit" onClick={openSettings}>
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', pb: '56px' }}>
          {activeTab === 0 && <SalarySimulation />}
          {activeTab === 1 && <CreditCard />}
          {activeTab === 2 && <BankAccounts />}
          {activeTab === 3 && <SalaryHistory />}
        </Box>

        {/* Bottom Navigation */}
        <Paper sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 100 }} elevation={3}>
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
              <IconButton color="inherit" edge="start" onClick={settingsPage ? goBack : closeSettings} sx={{ mr: 1 }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={600}>
                {settingsPage ? SETTINGS_TITLES[settingsPage] : '設定'}
              </Typography>
            </Toolbar>
          </AppBar>

          {/* 設定コンテンツ */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!settingsPage && <SettingsMain onNavigate={navigateTo} />}
            {settingsPage === 'salary'  && <SalarySettings />}
            {settingsPage === 'card'    && <CardSettings />}
            {settingsPage === 'account' && <AccountSettings />}
            {settingsPage === 'data'    && <DataSettings />}
          </Box>
        </Drawer>
      </Box>
    </ThemeProvider>
  )
}
