import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Navbar from './Navbar';
import { SIDEBAR_WIDTH, MOBILE_NAV_CLEARANCE } from './navigationLayout';

export default function Layout() {
  return (
    <Box id="Layout" sx={ { minHeight: '100dvh', bgcolor: 'background.default', position: 'relative', isolation: 'isolate' } }>
      { /* Static ambient glow. One fixed, non-animated layer so phones paint it once. */ }
      <Box
        aria-hidden
        sx={ theme => {
          const isDark = theme.palette.mode === 'dark';
          const topGlow = alpha(theme.palette.primary.main, isDark ? 0.16 : 0.10);
          const cornerGlow = alpha(theme.palette.info.main, isDark ? 0.06 : 0.05);
          return {
            position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
            background: [
              `radial-gradient(60% 45% at 50% -8%, ${topGlow} 0%, transparent 70%)`,
              `radial-gradient(40% 30% at 100% 100%, ${cornerGlow} 0%, transparent 70%)`,
            ].join(','),
          };
        } }
      />
      <Navbar/>
      <Box
        component="main"
        sx={ {
          ml: { md: `${SIDEBAR_WIDTH}px` }, minWidth: 0, pt: 'env(safe-area-inset-top)',
          pb: { xs: `calc(${MOBILE_NAV_CLEARANCE}px + env(safe-area-inset-bottom))`, md: 5 },
        } }
      >
        <Outlet/>
      </Box>
    </Box>
  );
}
