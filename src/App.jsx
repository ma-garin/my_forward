import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { Box, AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import SavingsIcon from '@mui/icons-material/Savings'
import HistoryIcon from '@mui/icons-material/History'
import theme from './theme'
import SalarySimulation from './tabs/SalarySimulation'
import CreditCard from './tabs/CreditCard'
import BankAccounts from './tabs/BankAccounts'
import SalaryHistory from './tabs/SalaryHistory'

const TABS = [
  { label: '給与', icon: <AccountBalanceWalletIcon /> },
  { label: 'カード', icon: <CreditCardIcon /> },
  { label: '口座', icon: <SavingsIcon /> },
  { label: '過去', icon: <HistoryIcon /> },
]

function PlaceholderTab({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <Typography color="text.secondary" variant="body2">{label}（未実装）</Typography>
    </Box>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100svh',
          maxWidth: 600,
          mx: 'auto',
          bgcolor: 'background.default',
        }}
      >
        {/* AppBar */}
        <AppBar position="static" color="primary" elevation={0}>
          <Toolbar variant="dense" sx={{ minHeight: 52 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: 1 }}>
              資産管理
            </Typography>
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
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 100 }}
          elevation={3}
        >
          <BottomNavigation
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ bgcolor: 'background.paper' }}
          >
            {TABS.map((tab) => (
              <BottomNavigationAction
                key={tab.label}
                label={tab.label}
                icon={tab.icon}
                sx={{ fontSize: 11 }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      </Box>
    </ThemeProvider>
  )
}
