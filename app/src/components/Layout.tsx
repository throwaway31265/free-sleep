
import Box from '@mui/material/Box';
import { useAppStore } from '@state/appStore';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { LoadingBar } from './ui/LoadingBar';

/**
 * The `Layout` component serves as the primary layout wrapper for the application.
 * It includes global elements such as the `Navbar` and `LoadingBar`, and renders
 * the current route using the `Outlet` component.
 */
export const Layout = () => {
  const { isUpdating } = useAppStore();

  return (
    <Box
      id="Layout"
      sx={{
        padding: 1,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <LoadingBar isUpdating={isUpdating} />

      { /* Renders current route */}
      <Outlet />
      <Navbar />
    </Box>
  );
}
