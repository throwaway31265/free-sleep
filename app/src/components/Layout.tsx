import Box from '@mui/material/Box';
import { Outlet } from '@tanstack/react-router';
import Navbar from './Navbar';
import ErrorDisplay from './shared/ErrorDisplay';

export default function Layout() {
  return (
    <Box
      id="Layout"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        position: 'relative',
      }}
    >
      <ErrorDisplay />
      {/* Renders current route */}
      <Box
        sx={{
          flexGrow: 1,
          paddingBottom: {
            xs: 'calc(56px + env(safe-area-inset-bottom))',
            md: '64px',
          },
        }}
      >
        <Outlet />
      </Box>
      <Navbar />
    </Box>
  );
}
