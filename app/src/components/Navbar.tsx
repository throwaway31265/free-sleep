import { Badge, Box, ButtonBase, LinearProgress, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ReactElement } from 'react';
import NightsStayRoundedIcon from '@mui/icons-material/NightsStayRounded';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@state/appStore.tsx';
import { useServerInfo } from '@api/serverInfo.ts';
import { PAGES, getPageForPath } from './pages';
import ConnectionBadge from './ConnectionBadge';
import { MOBILE_NAV_HEIGHT, MOBILE_NAV_INSET, SIDEBAR_WIDTH } from './navigationLayout';

export default function Navbar() {
  const { pathname } = useLocation();
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
      sx={ theme => ({ '& .MuiBadge-badge': { boxShadow: `0 0 0 2px ${theme.palette.background.default}` } }) }
    >
      { icon }
    </Badge>
  );
  const ariaLabel = (route: string, title: string) => (route === '/settings' && updateAvailable ? 'Settings, update available' : title);

  return (
    <>
      { isUpdating && <LinearProgress sx={ { position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 1400, borderRadius: 0 } }/> }

      { /* Desktop sidebar */ }
      <Box
        component="aside"
        sx={ {
          display: { xs: 'none', md: 'flex' }, position: 'fixed', inset: '0 auto 0 0', width: SIDEBAR_WIDTH, p: 2,
          flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', zIndex: 1100,
          bgcolor: theme => alpha(theme.palette.background.paper, 0.6),
        } }
      >
        <Box component={ Link } to="/" sx={ { display: 'flex', alignItems: 'center', gap: 1.25, p: 1, mb: 4, textDecoration: 'none' } }>
          <Box
            sx={ theme => ({
              display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '12px',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
              boxShadow: `0 6px 18px -6px ${alpha(theme.palette.primary.main, 0.7)}`,
            }) }
          >
            <NightsStayRoundedIcon sx={ { color: '#fff', fontSize: 20 } }/>
          </Box>
          <Typography sx={ { color: 'text.primary', fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' } }>Free Sleep</Typography>
        </Box>
        <Box component="nav" aria-label="Main navigation" sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
          { PAGES.map(({ title, route, icon }) => {
            const isActive = activePage.route === route;
            return (
              <ButtonBase
                key={ route }
                component={ Link }
                to={ route }
                aria-current={ isActive ? 'page' : undefined }
                aria-label={ ariaLabel(route, title) }
                sx={ theme => ({
                  justifyContent: 'flex-start', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '12px', fontSize: 14, fontWeight: 600,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  boxShadow: isActive ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}` : 'none',
                  transition: 'background-color 150ms ease, color 150ms ease',
                  '&:hover': { bgcolor: isActive ? alpha(theme.palette.primary.main, 0.16) : 'action.hover', color: 'text.primary' },
                  '& .MuiSvgIcon-root': { fontSize: 20, color: isActive ? 'primary.main' : 'inherit' },
                }) }
              >
                { navigationIcon(route, icon) }
                { title }
              </ButtonBase>
            );
          }) }
        </Box>
        <Box sx={ { mt: 'auto', px: 1, pt: 3 } }><ConnectionBadge/></Box>
      </Box>

      { /* Mobile floating tab bar. The only blurred surface in the app: small, so cheap to composite. */ }
      <Box
        component="nav"
        aria-label="Mobile navigation"
        sx={ theme => ({
          display: { xs: 'flex', md: 'none' }, position: 'fixed', zIndex: 1100,
          left: MOBILE_NAV_INSET, right: MOBILE_NAV_INSET,
          bottom: `calc(${MOBILE_NAV_INSET}px + env(safe-area-inset-bottom))`,
          height: MOBILE_NAV_HEIGHT, p: 0.75, gap: 0.5, borderRadius: 999,
          border: '1px solid', borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.82),
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          boxShadow: theme.palette.mode === 'dark' ? '0 12px 32px -12px rgba(0,0,0,0.8)' : '0 10px 30px -12px rgba(20,26,46,0.25)',
        }) }
      >
        { PAGES.map(({ title, route, icon }) => {
          const isActive = activePage.route === route;
          return (
            <ButtonBase
              key={ route }
              component={ Link }
              to={ route }
              aria-current={ isActive ? 'page' : undefined }
              aria-label={ ariaLabel(route, title) }
              sx={ theme => ({
                flex: 1, minWidth: 0, borderRadius: 999, flexDirection: 'column', gap: 0.25,
                color: isActive ? 'primary.main' : 'text.secondary',
                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                transition: 'background-color 150ms ease, color 150ms ease',
                '& .MuiSvgIcon-root': { fontSize: 22 },
              }) }
            >
              { navigationIcon(route, icon) }
              <Typography component="span" sx={ { fontSize: 10, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0 } }>{ title }</Typography>
            </ButtonBase>
          );
        }) }
      </Box>
    </>
  );
}
