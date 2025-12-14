import { Paper } from '@mui/material';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import {
  Activity,
  BarChart3,
  Calendar,
  Settings,
  Thermometer
} from 'lucide-react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { id: 'temp', route: '/temperature', icon: Thermometer, label: 'Temp' },
  { id: 'schedule', route: '/schedules', icon: Calendar, label: 'Schedule' },
  { id: 'data', route: '/data', icon: BarChart3, label: 'Data' },
  { id: 'status', route: '/status', icon: Activity, label: 'Status' },
  { id: 'settings', route: '/settings', icon: Settings, label: 'Settings' },
];

/**
 * `Navbar` handles the routing logic and renders the bottom navigation bar.
 */
export const Navbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileNavValue, setMobileNavValue] = React.useState(
    navItems.findIndex((item) => item.route === pathname)
  );

  const handleNavChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setMobileNavValue(newValue);
    navigate(navItems[newValue].route);
  };

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3} >
      <BottomNavigation
        value={mobileNavValue}
        onChange={handleNavChange}
        showLabels
        sx={{
          height: 75,
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.id}
            label={item.label}
            value={navItems.findIndex((navItem) => navItem.id === item.id)}
            icon={<item.icon />}
            sx={{
              gap: 1,
            }}
          />
        ))}
      </BottomNavigation>
    </Paper >
  );
}
