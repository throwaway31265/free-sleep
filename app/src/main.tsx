import * as Sentry from '@sentry/react';
import { initSentry } from './sentry.tsx';
initSentry();

import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { GlobalStyles } from '@mui/material';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AppStoreProvider } from '@state/appStore.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { Layout } from './components/Layout';
import ControlTempPage from './pages/ControlTempPage/ControlTempPage';
import DataPage from './pages/DataPage/DataPage.tsx';
import LogsPage from './pages/DataPage/LogsPage/LogsPage.tsx';
import SleepPage from './pages/DataPage/SleepPage/SleepPage.tsx';
import VitalsPage from './pages/DataPage/VitalsPage/VitalsPage.tsx';
import SchedulePage from './pages/SchedulePage/SchedulePage.tsx';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import StatusPage from './pages/StatusPage/StatusPage.tsx';
import { darkTheme } from './theme/theme';
import './styles/animations.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

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
              <SentryRoutes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<ControlTempPage />} />
                  <Route path="temperature" element={<ControlTempPage />} />
                  <Route path="left" element={<ControlTempPage />} />
                  <Route path="right" element={<ControlTempPage />} />
                  <Route path="status" element={<StatusPage />} />

                  <Route path="data" element={<DataPage />}>
                    <Route path="sleep" element={<SleepPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="vitals" element={<VitalsPage />} />
                  </Route>

                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="schedules" element={<SchedulePage />} />
                </Route>
              </SentryRoutes>
            </BrowserRouter>
          </AppStoreProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};


async function enableMocking() {
  if (import.meta.env.VITE_ENV !== 'demo') {
    return;
  }
  // eslint-disable-next-line no-console
  console.info('Enabling MSW worker!');

  const { worker } = await import('./mocks/browser');

  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and ready to intercept requests.
  return worker.start();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary componentName='App'>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
});
