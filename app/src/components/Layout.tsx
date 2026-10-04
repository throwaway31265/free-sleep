import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <Box id="Layout" sx={ { minHeight: '100dvh', bgcolor: 'background.default' } }>
      <Navbar/>
      <Box
        component="main"
        sx={ {
          ml: { md: '224px' }, minWidth: 0, pt: 'env(safe-area-inset-top)',
          pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 5 },
        } }
      >
        <Outlet/>
      </Box>
    </Box>
  );
}
