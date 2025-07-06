import { CssBaseline, GlobalStyles } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AppStoreProvider } from '@state/appStore.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Layout from './components/Layout';
import BaseControlPage from './pages/BaseControlPage/BaseControlPage.tsx';
import ControlTempPage from './pages/ControlTempPage/ControlTempPage';
import DataPage from './pages/DataPage/DataPage.tsx';
import LogsPage from './pages/DataPage/LogsPage/LogsPage.tsx';
import SleepPage from './pages/DataPage/SleepPage/SleepPage.tsx';
import VitalsPage from './pages/DataPage/VitalsPage/VitalsPage.tsx';
import SchedulePage from './pages/SchedulePage/SchedulePage.tsx';
import SettingsPage from './pages/SettingsPage/SettingsPage';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000',
      paper: '#000000',
    },
    primary: {
      main: '#ffffff',
      contrastText: '#000000',
    },
    secondary: {
      main: 'rgba(255, 255, 255, 0.7)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.8)',
    },
    grey: {
      100: '#e8eaed',
      300: '#a6adbe',
      400: '#88878c',
      500: '#606060',
      700: '#272727',
      800: '#262626',
      900: '#242424',
    },
    divider: 'rgba(255, 255, 255, 0.1)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 400,
      color: '#ffffff',
    },
    h5: {
      fontWeight: 400,
      color: '#ffffff',
    },
    h6: {
      fontWeight: 400,
      color: '#ffffff',
    },
    body1: {
      color: '#ffffff',
    },
    body2: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
  },
  shape: {
    borderRadius: 24,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '24px',
          textTransform: 'none',
          fontWeight: 400,
          fontSize: '16px',
          padding: '12px 24px',
        },
        contained: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          border: 'none',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
          '&:disabled': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.3)',
          },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
        text: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase': {
            color: '#ffffff',
            '&.Mui-checked': {
              color: '#ffffff',
            },
            '&.Mui-checked + .MuiSwitch-track': {
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
            },
          },
          '& .MuiSwitch-track': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          borderRadius: '12px',
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#ffffff',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          color: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
          },
        },
        icon: {
          color: '#ffffff',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '24px !important',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '26px',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            marginBottom: '26px',
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          borderRadius: '24px',
          minHeight: '56px',
          padding: '0 24px',
          '& .MuiAccordionSummary-content': {
            margin: '12px 0',
            alignItems: 'center',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: '#ffffff',
          },
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '16px 24px 24px',
          color: '#ffffff',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={darkTheme}>
        <LocalizationProvider dateAdapter={AdapterMoment}>
          <AppStoreProvider>
            <CssBaseline />
            <GlobalStyles
              styles={{
                'html, body': {
                  overscrollBehavior: 'none', // Prevent rubber-banding
                },
              }}
            />
            <BrowserRouter basename="/">
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<SettingsPage />} />
                  <Route path="temperature" element={<ControlTempPage />} />
                  <Route path="left" element={<ControlTempPage />} />
                  <Route path="right" element={<ControlTempPage />} />
                  <Route path="base-control" element={<BaseControlPage />} />

                  <Route path="data" element={<DataPage />}>
                    <Route path="sleep" element={<SleepPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="vitals" element={<VitalsPage />} />
                  </Route>

                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="schedules" element={<SchedulePage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AppStoreProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
