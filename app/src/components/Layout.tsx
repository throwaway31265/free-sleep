import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Box from '@mui/material/Box';


export default function Layout() {
  return (
    <Box
      id="Layout"
      sx={ {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        alignItems: 'center',
        gap: 2,
        // padding: 0,
        margin: 0,
        width: '100vw',
        justifyContent: 'center',
      } }
    >
      { /* Renders current route */ }
      <Outlet/>
      <Navbar/>
    </Box>
  );
}
