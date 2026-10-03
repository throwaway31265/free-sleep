import { Link, Outlet, useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Navbar from './Navbar';
import ConnectionBadge from './ConnectionBadge';
import { getPageForPath } from './pages';

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <Box id="Layout" sx={ { minHeight: '100dvh' } }>
      <Navbar/>
      <Box sx={ { ml: { md: '224px' }, minWidth: 0 } }>
        <Box
          component="header"
          sx={ {
            height: { xs: 60, md: 64 }, px: { xs: 2.5, md: 4 }, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider',
          } }
        >
          <Box sx={ { display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5 } }>
            <Typography variant="caption" color="text.secondary">Workspace</Typography>
            <ChevronRightIcon sx={ { fontSize: 14, color: 'text.secondary' } }/>
            <Typography variant="caption">{ getPageForPath(pathname).title }</Typography>
          </Box>
          <Box
            component={ Link }
            to="/"
            sx={ { display: { xs: 'flex', md: 'none' }, gap: 1, alignItems: 'center', color: 'inherit', textDecoration: 'none' } }
          >
            <NightsStayOutlinedIcon sx={ { color: 'primary.main', fontSize: 21 } }/>
            <Typography sx={ { fontWeight: 600, letterSpacing: '-0.03em' } }>free sleep</Typography>
          </Box>
          <ConnectionBadge/>
        </Box>
        <Box component="main" sx={ { pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 5 } } }>
          <Outlet/>
        </Box>
      </Box>
    </Box>
  );
}
