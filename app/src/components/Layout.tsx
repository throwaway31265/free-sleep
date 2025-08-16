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
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <ErrorDisplay />
      {/* Renders current route */}
      <Box sx={{ flexGrow: 1, paddingBottom: { xs: '80px', md: '80px' } }}>
        <Outlet />
      </Box>
      <Navbar />
    </Box>
  );
}
