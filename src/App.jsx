import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { Box, AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction, Paper, IconButton, Drawer } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import HomeIcon from '@mui/icons-material/Home'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { buildTheme } from './theme'
import { getDataVersion } from './utils/ccStorage'
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
import NotificationCaptureSettings from './settings/NotificationCaptureSettings'
import ReminderSettings from './settings/ReminderSettings'
import AppearanceSettings from './settings/AppearanceSettings'
import IconSettings from './settings/IconSettings'
import { useAndroidBack, pushScreen } from './utils/useAndroidBack'
import { useKeyboardInset } from './utils/useKeyboardInset'
import { useLaunchIntent } from './utils/useLaunchIntent'
import { useReminderSync } from './utils/useReminders'
import { useAutoBackup } from './utils/useAutoBackup'
import { useWidgetSync } from './utils/useWidget'
import { useColorMode } from './utils/useColorMode'
import RestoreOffer from './components/RestoreOffer'

const TABS = [
  { label: 'クレカ', icon: <CreditCardIcon /> },
  { label: '家計',   icon: <HomeIcon /> },
  { label: '支出一覧', icon: <ReceiptLongIcon /> },
  { label: '給与',   icon: <AccountBalanceWalletIcon /> },
]

// Android アプリは WebView が画面全体に描画されるので、そのままだとヘッダーが
// ステータスバーに潜り込む。バーの色を上まで伸ばし、中身はその下から始める。
// ブラウザでは inset が 0 になるだけなので Web 版に影響しない。
const APPBAR_SX = { pt: 'env(safe-area-inset-top)' }

const BOTTOM_NAV_SX = {
  position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
  width: '100%', maxWidth: 600, zIndex: 100, pb: 'env(safe-area-inset-bottom)',
}

const SETTINGS_TITLES = {
  salary:        '給与設定',
  card:          'カード設定',
  data:          'データ管理',
  salaryHistory: '給与履歴',
  appInfo:       'アプリ情報',
  reminders:     '通知',
  notifications: '通知の取り込み',
  appearance:    '外観',
  icon:          'アイコン',
}

export default function App() {
  return <AppInner />
}

const TAB_COMPONENTS = [CreditCard, Kakeibo, Cashflow, SalarySimulation]
const SHOW = { display: 'block' }
const HIDE = { display: 'none' }

function AppInner() {
  useAndroidBack()
  useKeyboardInset()
  useReminderSync()
  useWidgetSync()
  const { offer: restoreOffer, dismiss: dismissRestore } = useAutoBackup()

  const { resolved: colorMode } = useColorMode()
  const theme = useMemo(() => buildTheme(colorMode), [colorMode])

  // ステータスバーと、行き過ぎスクロールで覗く地の色をテーマに合わせる。
  // ここを変えないと、暗くしたときに画面の上下だけ明るいままになる。
  useEffect(() => {
    const bg = theme.palette.background.default
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
      colorMode === 'dark' ? bg : theme.palette.primary.dark)
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    // 次回起動のスプラッシュがこの色をそのまま使う。
    // 判定をあちらにも書くと、決め方を変えたとき起動時だけ食い違う
    try { localStorage.setItem('cc_theme_bg', bg) } catch { /* 保存できなくても既定色で出る */ }
  }, [theme, colorMode])

  const [activeTab,    setActiveTab]    = useState(0)
  const [refreshKeys,  setRefreshKeys]  = useState([0, 0, 0, 0])
  const [mounted,      setMounted]      = useState([true, false, false, false])
  // 各タブを最後に描画したときのデータ版数。変わっていなければ作り直さない。
  const seenVersion = useRef([0, 0, 0, 0])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState(null)

  // 要素参照を固定する。activeTab が変わっても再生成しないことで、
  // React は隠れているタブの再レンダーを丸ごとスキップできる。
  const panes = useMemo(
    () => TAB_COMPONENTS.map((Tab, i) => mounted[i] ? <Tab key={refreshKeys[i]} /> : null),
    [mounted, refreshKeys],
  )

  // ショートカット・共有シートから来たときは、支出入力があるクレカタブへ寄せる
  const showCreditCardTab = useCallback(() => {
    setActiveTab(0)
    setMounted((prev) => (prev[0] ? prev : prev.map((m, i) => (i === 0 ? true : m))))
  }, [])
  useLaunchIntent(showCreditCardTab)

  // 前回描画したときからデータが変わっていれば作り直す。
  // タブを切り替えたときと、設定を閉じたときの両方で見る。設定でしか変えられない
  // もの（支払い元・週予算）は、切替を挟まないと反映されなかった
  const refreshTabIfChanged = useCallback((index) => {
    const version = getDataVersion()
    if (seenVersion.current[index] === version) return
    seenVersion.current[index] = version
    setRefreshKeys((prev) => {
      const next = [...prev]
      next[index] = next[index] + 1
      return next
    })
  }, [])

  const handleTabChange = useCallback((_, v) => {
    setActiveTab(v)
    setMounted(prev => prev[v] ? prev : prev.map((m, i) => i === v ? true : m))
    refreshTabIfChanged(v)
    window.scrollTo(0, 0)
  }, [refreshTabIfChanged])

  // 設定は履歴に積む。Android の戻るボタンは履歴があればそれを辿り、無ければ
  // アプリを終了する。積んでおかないと、設定を開いたまま戻るとアプリごと落ちる。
  // 画面の状態は履歴の state をそのまま映すので、何段戻っても食い違わない。
  const openSettings = () => {
    setSettingsPage(null)
    setSettingsOpen(true)
    pushScreen({ settings: true, page: null })
  }
  const navigateTo = (page) => {
    setSettingsPage(page)
    pushScreen({ settings: true, page })
  }
  const closeSettings = () => {
    if (window.history.state?.settings) window.history.back()
    else { setSettingsOpen(false); refreshTabIfChanged(activeTab) }
  }
  const goBack = closeSettings

  useEffect(() => {
    const onPop = (e) => {
      const s = e.state
      const open = !!s?.settings
      setSettingsOpen(open)
      setSettingsPage(open ? (s.page ?? null) : null)
      if (!open) refreshTabIfChanged(activeTab)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [activeTab, refreshTabIfChanged])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', maxWidth: 600, mx: 'auto', bgcolor: 'background.default' }}>

        {/* AppBar */}
        <AppBar position="static" color="primary" elevation={0} sx={APPBAR_SX}>
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
        <Box sx={{ flex: 1, overflowY: 'auto', // ボトムナビ(56px) に加えて FAB(56px) の高さぶんの余白を確保し、
          // 最下部の行が FAB や下部ナビに隠れないようにする
          pb: 'calc(132px + env(safe-area-inset-bottom))' }}>
          {/* タブは切り替えても作り直さず、表示/非表示だけを切り替える。
              pane の要素参照を useMemo で固定しているので、隠れているタブは
              再レンダーされない（切替が実質ゼロコストになる）。
              iOS のタブバー同様、切替アニメーションは持たせない。 */}
          {panes.map((pane, i) => pane && (
            <Box key={i} sx={i === activeTab ? SHOW : HIDE}>{pane}</Box>
          ))}
        </Box>

        {/* Bottom Navigation */}
        <Paper sx={BOTTOM_NAV_SX} elevation={3}>
          <BottomNavigation value={activeTab} onChange={handleTabChange} showLabels sx={{ bgcolor: 'transparent' }}>
            {TABS.map((tab) => (
              <BottomNavigationAction key={tab.label} label={tab.label} icon={tab.icon} sx={{ fontSize: 11 }} />
            ))}
          </BottomNavigation>
        </Paper>

        {/* 設定ドロワー */}
        <Drawer anchor="right" open={settingsOpen} onClose={closeSettings}
          slotProps={{ paper: { sx: { width: '100vw', maxWidth: 600 } } }}>

          {/* 設定ヘッダー */}
          <AppBar position="static" color="primary" elevation={0} sx={APPBAR_SX}>
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
            {settingsPage === 'reminders'     && <ReminderSettings />}
            {settingsPage === 'notifications' && <NotificationCaptureSettings />}
            {settingsPage === 'appearance'    && <AppearanceSettings />}
            {settingsPage === 'icon'          && <IconSettings />}
          </Box>
        </Drawer>

        {/* データが空で控えが残っているときだけ出る */}
        <RestoreOffer backup={restoreOffer} onDismiss={dismissRestore} />
      </Box>
    </ThemeProvider>
  )
}
