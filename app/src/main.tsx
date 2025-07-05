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
      default: '#010101',
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
