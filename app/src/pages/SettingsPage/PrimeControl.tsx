import { format } from 'date-fns';
import moment from 'moment-timezone';
import Typography from '@mui/material/Typography';
import PrimeButton from './PrimeButton.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import Box from '@mui/material/Box';

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
    <Box sx={{ mt: -2 }}>
      {deviceStatus?.isPriming ? (
        <PrimingNotification />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <PrimeButton refetch={refetch} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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
