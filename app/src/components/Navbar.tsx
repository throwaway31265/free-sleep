import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@state/appStore.tsx';
import { useTheme } from '@mui/material/styles';
import { PAGES } from './pages';

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isUpdating } = useAppStore();
  const theme = useTheme(); // Access the Material-UI theme
  const currentTitle = PAGES.find((page) => page.route === pathname)?.title;
  const [mobileNavValue, setMobileNavValue] = React.useState(
    PAGES.findIndex((page) => page.route === pathname)
  );

  // Handle navigation for both desktop and mobile
  const handleNavigation = (route: string) => {
    navigate(route);
  };

  const handleMobileNavChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setMobileNavValue(newValue);
    handleNavigation(PAGES[newValue].route);
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
      { /* Loading Bar */ }
      <Box
        sx={ {
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
        } }
      />
      { /* Desktop Navigation */ }
      <AppBar
        position="fixed"
        color="transparent"
        sx={ {
          display: { xs: 'none', md: 'flex' },
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          boxShadow: 'none',
          top: 'auto', // Push it to the bottom
          bottom: 0, // Stick it to the bottom
          left: 0,
          right: 0,
        } }
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={ { flexGrow: 1 } }>
            { currentTitle || 'Free sleep' }
          </Typography>
          <Box sx={ { display: 'flex', gap: 2 } }>
            { PAGES.map(({ title, route }) => (
              <Button
                key={ route }
                onClick={ () => handleNavigation(route) }
                sx={ { color: 'white' } }
                variant={ pathname === route ? 'outlined' : 'text' }
                disabled={ isUpdating }
              >
                { title }
              </Button>
            )) }
          </Box>
        </Toolbar>
      </AppBar>

      { /* Mobile Bottom Navigation */ }
      <Box
        sx={ {
          display: { xs: 'flex', md: 'none' },
          width: '100%',
          position: 'fixed',
          bottom: 0,
          height: '80px',
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          zIndex: 10,
        } }
      >
        <BottomNavigation
          value={ mobileNavValue }
          onChange={ handleMobileNavChange }
          sx={ {
            width: '100%',
            backgroundColor: theme.palette.background.default,
            '& .Mui-selected': {
              color: theme.palette.grey[100],
            },
            '& .MuiBottomNavigationAction-root': {
              color: theme.palette.grey[500],
            },
          } }
        >
          { PAGES.map(({ title, icon }, index) => (
            <BottomNavigationAction
              key={ index }
              icon={ icon }
              disabled={ isUpdating }
              aria-label={ title }
              sx={ {
                '&.Mui-selected': {
                  color: theme.palette.grey[100], // Different selected color
                },
              } }
            />
          )) }
        </BottomNavigation>
      </Box>
      <style>
        { `
@keyframes slide-gradient {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

        ` }
      </style>
    </>
  );
}
