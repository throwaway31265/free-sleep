import AdjustIcon from '@mui/icons-material/Adjust';
import BarChartIcon from '@mui/icons-material/BarChart';
import BedIcon from '@mui/icons-material/Bed';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsIcon from '@mui/icons-material/Settings';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import type React from 'react';

type Page = {
  title: string;
  route: string;
  icon: React.ReactElement;
};

function TemperatureIcon() {
  return (
    <span>
      <BedIcon sx={{ marginRight: '-6px' }} />
      <ThermostatIcon />
    </span>
  );
}

export const PAGES: Page[] = [
  { title: 'Temperature', route: '/temperature', icon: <TemperatureIcon /> },
  { title: 'Elevation', route: '/base-control', icon: <AdjustIcon /> },
  { title: 'Water Level', route: '/water-level', icon: <WaterDropIcon /> },
  { title: 'Schedules', route: '/schedules', icon: <ScheduleIcon /> },
  { title: 'Data', route: '/data', icon: <BarChartIcon /> },
  { title: 'Settings', route: '/settings', icon: <SettingsIcon /> },
];
