import { useBaseStatus } from '@api/baseControl';
import { useVersion } from '@api/version';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useAppStore } from '@state/appStore.tsx';
import { useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { PAGES } from './pages';

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isUpdating } = useAppStore();
  const { data: baseStatus } = useBaseStatus();
  const theme = useTheme(); // Access the Material-UI theme
  const { data: version } = useVersion();
  const visiblePages = React.useMemo(() => {
    // Show Elevation only when base is explicitly configured
    const isElevationAvailable = baseStatus?.isConfigured === true;
    return PAGES.filter((p) =>
      p.route === '/base-control' ? isElevationAvailable : true,
    );
  }, [baseStatus?.isConfigured]);

  const currentTitle = visiblePages.find(
    (page) => page.route === pathname,
  )?.title;
  const [mobileNavValue, setMobileNavValue] = React.useState(() => {
    const idx = visiblePages.findIndex((page) => page.route === pathname);
    return idx >= 0 ? idx : 0;
  });

  React.useEffect(() => {
    const idx = visiblePages.findIndex((page) => page.route === pathname);
    setMobileNavValue(idx >= 0 ? idx : 0);
  }, [visiblePages, pathname]);

  // Handle navigation for both desktop and mobile
  const handleNavigation = (route: string) => {
    navigate({ to: route });
  };

  const handleMobileNavChange = (
    _event: React.SyntheticEvent,
    newValue: number,
  ) => {
    setMobileNavValue(newValue);
    handleNavigation(visiblePages[newValue].route);
  };

  const gradient = `linear-gradient(
  90deg,
  transparent,
  ${theme.palette.primary.dark},
  transparent,
  ${theme.palette.primary.dark},
  transparent
)`;
  return (
    <>
      {/* Loading Bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: isUpdating ? gradient : 'transparent',
          backgroundSize: '200% 100%',
          animation: isUpdating
            ? 'slide-gradient 10s linear infinite reverse'
            : 'none',
          zIndex: 1201,
        }}
      />
      {/* Desktop Navigation */}
      <AppBar
        position="fixed"
        color="transparent"
        sx={{
          display: { xs: 'none', md: 'flex' },
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          boxShadow: 'none',
          top: 'auto', // Push it to the bottom
          bottom: 0, // Stick it to the bottom
          left: 0,
          right: 0,
          height: 64,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {currentTitle || 'Free sleep'}
            {version?.branch && (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  ml: 1,
                  px: 1,
                  py: 0.25,
                  backgroundColor:
                    version.branch === 'main' ? 'success.main' : 'warning.main',
                  color: 'black',
                  borderRadius: 1,
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                }}
              >
                {version.branch}
              </Typography>
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {visiblePages.map(({ title, route }) => (
              <Button
                key={route}
                onClick={() => handleNavigation(route)}
                sx={{
                  color: 'white',
                  '&:focus': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
                variant={pathname === route ? 'outlined' : 'text'}
                disabled={isUpdating}
              >
                {title}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Bottom Navigation */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          width: '100%',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: { xs: 56, sm: 60 },
          pb: 'env(safe-area-inset-bottom)',
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          zIndex: 1200,
        }}
      >
        <BottomNavigation
          value={mobileNavValue}
          onChange={handleMobileNavChange}
          sx={{
            width: '100%',
            backgroundColor: theme.palette.background.default,
            height: { xs: 56, sm: 60 },
            '& .MuiBottomNavigationAction-root': {
              paddingTop: 0.5,
              paddingBottom: 0.5,
              px: { xs: 0.5, sm: 0.75 },
              minWidth: 48,
              maxWidth: { xs: 96, sm: 120 },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.65rem',
              },
              '& .MuiSvgIcon-root': {
                fontSize: { xs: 22, sm: 24 },
              },
              color: theme.palette.grey[500],
              '&:focus': {
                outline: '2px solid',
                outlineColor: theme.palette.primary.main,
                outlineOffset: '2px',
                borderRadius: '8px',
              },
            },
            '& .Mui-selected': {
              color: theme.palette.grey[100],
            },
          }}
        >
          {visiblePages.map(({ title, icon }, index) => (
            <BottomNavigationAction
              key={index}
              icon={icon}
              disabled={isUpdating}
              aria-label={title}
              sx={{
                '&.Mui-selected': {
                  color: theme.palette.grey[100],
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Box>
      <style>
        {`
@keyframes slide-gradient {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}
        `}
      </style>
    </>
  );
}
