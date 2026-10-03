import { Badge, Box, BottomNavigation, BottomNavigationAction, Button, LinearProgress, Typography } from '@mui/material';
import { ReactElement } from 'react';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@state/appStore.tsx';
import { useServerInfo } from '@api/serverInfo.ts';
import { PAGES, getPageForPath } from './pages';

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isUpdating } = useAppStore();
  const { data: serverInfo, isError: versionError } = useServerInfo();
  const updateAvailable = Boolean(serverInfo?.updateAvailable) && !versionError;
  const activePage = getPageForPath(pathname);

  // Use the same cached version check as Settings for both navigation layouts.
  const navigationIcon = (route: string, icon: ReactElement) => (
    <Badge
      variant="dot"
      color="info"
      invisible={ route !== '/settings' || !updateAvailable }
      sx={ { '& .MuiBadge-badge': { boxShadow: '0 0 0 2px #111111' } } }
    >
      { icon }
    </Badge>
  );

  return (
    <>
      { isUpdating && <LinearProgress sx={ { position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 1400 } }/> }
      <Box
        component="aside"
        sx={ {
          display: { xs: 'none', md: 'flex' }, position: 'fixed', inset: '0 auto 0 0', width: 224, p: 2,
          flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 1100,
        } }
      >
        <Box component={ Link } to="/" sx={ { display: 'flex', alignItems: 'center', gap: 1.25, p: 1, mb: 4, textDecoration: 'none' } }>
          <Box sx={ { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 1, bgcolor: 'action.selected' } }>
            <NightsStayOutlinedIcon sx={ { color: 'primary.main', fontSize: 20 } }/>
          </Box>
          <Typography sx={ { color: 'text.primary', fontSize: 17, fontWeight: 600, letterSpacing: '-0.04em' } }>free sleep</Typography>
          <Typography variant="overline" sx={ { ml: 'auto', color: 'text.secondary', fontSize: 8 } }>LOCAL</Typography>
        </Box>
        <Typography variant="overline" color="text.secondary" sx={ { px: 1.5, mb: 1 } }>Workspace</Typography>
        <Box component="nav" aria-label="Main navigation" sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
          { PAGES.map(({ title, route, icon }) => (
            <Button
              key={ route }
              component={ Link }
              to={ route }
              startIcon={ navigationIcon(route, icon) }
              aria-current={ activePage.route === route ? 'page' : undefined }
              aria-label={ route === '/settings' && updateAvailable ? 'Settings, update available' : title }
              sx={ {
                justifyContent: 'flex-start', px: 1.5, py: 1.15,
                color: activePage.route === route ? 'text.primary' : 'text.secondary',
                bgcolor: activePage.route === route ? 'action.selected' : 'transparent',
                '& .MuiButton-startIcon': { mr: 1.5, color: activePage.route === route ? 'primary.main' : 'text.secondary' },
                '& .MuiSvgIcon-root': { fontSize: 19 },
              } }
            >
              { title }
            </Button>
          )) }
        </Box>
      </Box>
      <Box
        component="nav"
        aria-label="Mobile navigation"
        sx={ {
          display: { xs: 'block', md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 1100,
          pb: 'env(safe-area-inset-bottom)',
        } }
      >
        <BottomNavigation
          showLabels
          value={ PAGES.indexOf(activePage) }
          onChange={ (_, index) => navigate(PAGES[index].route) }
          sx={ {
            bgcolor: 'transparent', height: 68,
            '& .MuiBottomNavigationAction-root': { minWidth: 0, color: 'text.secondary', px: 0.5, gap: 0.75 },
            '& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected': { fontSize: 10, fontWeight: 500 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiSvgIcon-root': { fontSize: 22 },
          } }
        >
          { PAGES.map(({ title, route, icon }) => (
            <BottomNavigationAction
              key={ route }
              label={ title }
              icon={ navigationIcon(route, icon) }
              aria-current={ activePage.route === route ? 'page' : undefined }
              aria-label={ route === '/settings' && updateAvailable ? 'Settings, update available' : title }
            />
          )) }
        </BottomNavigation>
      </Box>
    </>
  );
}
