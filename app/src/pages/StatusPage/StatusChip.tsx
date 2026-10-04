import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { Chip } from '@mui/material';
import { StatusInfo, Status } from '@api/serverStatusSchema.ts';


const statusMeta: Record<
  Status,
  { color: 'default' | 'info' | 'warning' | 'error' | 'success'; icon: React.ReactNode; label: string }
> = {
  not_started: {
    color: 'default',
    icon: <HourglassEmptyRoundedIcon fontSize="small" />,
    label: 'Not started',
  },
  started: {
    color: 'info',
    icon: <InfoRoundedIcon fontSize="small" />,
    label: 'Started',
  },
  restarting: {
    color: 'warning',
    icon: <ReplayRoundedIcon fontSize="small" />,
    label: 'Restarting',
  },
  retrying: {
    color: 'warning',
    icon: <AutorenewRoundedIcon fontSize="small" />,
    label: 'Retrying',
  },
  failed: {
    color: 'error',
    icon: <ErrorRoundedIcon fontSize="small" />,
    label: 'Failed',
  },
  healthy: {
    color: 'success',
    icon: <CheckCircleRoundedIcon fontSize="small" />,
    label: 'Healthy',
  },
};
export default function StatusChip({ info }: { info: StatusInfo }) {
  const meta = statusMeta[info.status];
  return (
    <Chip
      icon={ meta.icon as any }
      label={ meta.label }
      color={ meta.color }
      variant={ meta.color === 'default' ? 'outlined' : 'filled' }
      size="small"
      sx={ { fontWeight: 500, flexShrink: 0, '& .MuiChip-icon': { fontSize: 15 } } }
    />
  );
}
