import { useDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';
import moment from 'moment-timezone';
import PrimeButton from './PrimeButton.tsx';
import PrimingNotification from './PrimingNotification.tsx';

export default function PrimeControl() {
  const { data: deviceStatus, refetch } = useDeviceStatus();
  const { data: settings } = useSettings();

  const formattedLastPrime = settings?.lastPrime
    ? format(new Date(settings.lastPrime), 'MMM d, yyyy h:mm a')
    : 'Never';

  const timeAgo = settings?.lastPrime
    ? moment(settings.lastPrime).fromNow()
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
        Manual Priming Control
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Manually prime the system to clear air bubbles and ensure proper water circulation
      </Typography>
      {deviceStatus?.isPriming ? (
        <PrimingNotification />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 1,
          }}
        >
          <PrimeButton refetch={refetch} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Last primed: {formattedLastPrime}
            {timeAgo && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center' }}
              >
                ({timeAgo})
              </Typography>
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
