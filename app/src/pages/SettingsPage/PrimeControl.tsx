import PrimeButton from './PrimeButton.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import Box from '@mui/material/Box';

export default function PrimeControl() {
  const { data: deviceStatus, refetch } = useDeviceStatus();

  return (
    <Box sx={ { mt: -2 } }>
      {
        deviceStatus?.isPriming ?
          <PrimingNotification />
          :
          <PrimeButton refetch={ refetch }/>
      }
    </Box>
  );
}

