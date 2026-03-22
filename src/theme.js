import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#37474f',       // blue-grey 800
      light: '#546e7a',
      dark: '#263238',
    },
    secondary: {
      main: '#546e7a',
    },
    background: {
      default: '#eceff1',    // blue-grey 50
      paper: '#ffffff',
    },
    text: {
      primary: '#263238',
      secondary: '#546e7a',
    },
    error: {
      main: '#b71c1c',
    },
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { color: '#546e7a' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          '&.Mui-selected': {
            color: '#37474f',
          },
        },
      },
    },
  },
})

export default theme
