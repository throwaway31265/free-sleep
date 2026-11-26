import { ReactElement } from 'react';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';

type Page = { title: string; route: string; icon: ReactElement };

export const PAGES: Page[] = [
  { title: 'Temperature', route: '/temperature', icon: <ThermostatRoundedIcon/> },
  { title: 'Schedules', route: '/schedules', icon: <EventNoteRoundedIcon/> },
  { title: 'Data', route: '/data', icon: <InsightsRoundedIcon/> },
  { title: 'Status', route: '/status', icon: <MonitorHeartRoundedIcon/> },
  { title: 'Settings', route: '/settings', icon: <TuneRoundedIcon/> },
];

export const getPageForPath = (pathname: string) => {
  if (['/', '/left', '/right'].includes(pathname)) return PAGES[0];
  return PAGES.find(page => pathname === page.route || pathname.startsWith(`${page.route}/`)) ?? PAGES[0];
};
