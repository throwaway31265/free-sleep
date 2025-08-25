import { CssBaseline, GlobalStyles } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AppStoreProvider } from '@state/appStore.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import RouteErrorComponent from './components/RouteErrorComponent.tsx';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

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
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #app': {
          height: '100%',
          width: '100%',
        },
        body: {
          width: '100%',
          overscrollBehavior: 'none',
          overflowX: 'hidden',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          // Reduce default min width and padding to fit more buttons on mobile
          minWidth: 44,
          padding: '6px 10px',
          '@media (max-width:600px)': {
            minWidth: 40,
            padding: '6px 8px',
          },
        },
        sizeSmall: {
          padding: '4px 8px',
          '@media (max-width:600px)': {
            padding: '3px 6px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 6,
          '@media (max-width:600px)': {
            padding: 4,
          },
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          paddingLeft: 6,
          paddingRight: 6,
          minWidth: 44,
          '@media (max-width:600px)': {
            paddingLeft: 4,
            paddingRight: 4,
            minWidth: 40,
          },
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

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: RouteErrorComponent,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
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
                <RouterProvider router={router} />
              </AppStoreProvider>
            </LocalizationProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
