import { ReactElement } from 'react';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';

type Page = { title: string; route: string; icon: ReactElement };

export const PAGES: Page[] = [
  { title: 'Temperature', route: '/temperature', icon: <ThermostatOutlinedIcon/> },
  { title: 'Schedules', route: '/schedules', icon: <ScheduleOutlinedIcon/> },
  { title: 'Data', route: '/data', icon: <BarChartOutlinedIcon/> },
  { title: 'Status', route: '/status', icon: <GraphicEqOutlinedIcon/> },
  { title: 'Settings', route: '/settings', icon: <SettingsOutlinedIcon/> },
];

export const getPageForPath = (pathname: string) => {
  if (['/', '/left', '/right'].includes(pathname)) return PAGES[0];
  return PAGES.find(page => pathname === page.route || pathname.startsWith(`${page.route}/`)) ?? PAGES[0];
};
