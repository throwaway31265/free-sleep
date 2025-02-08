import { useState } from 'react';
import {
  Dialog,
  DialogActions,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import AlarmIcon from '@mui/icons-material/Alarm';
import { keyframes } from '@mui/system';
import { postDeviceStatus } from '@api/deviceStatus.ts';


type AlarmDismissalProps = {
  deviceStatus?: DeviceStatus;
  refetch: any;
}

const pulse = keyframes`
    0% { transform: scale(1) translateX(0); }
    10% { transform: scale(1.1) translateX(-3px); }
    20% { transform: scale(1.1) translateX(3px); }
    30% { transform: scale(1.1) translateX(-3px); }
    40% { transform: scale(1.1) translateX(3px); }
    50% { transform: scale(1.2) translateX(0); }
    100% { transform: scale(1) translateX(0); }
`;


export default function AlarmDismissal({ deviceStatus, refetch }: AlarmDismissalProps) {
  const { side, setIsUpdating } = useAppStore();

  const [dismissed, setDismissed] = useState(false);

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));


  const handleDismiss = () => {
    setIsUpdating(true);
    postDeviceStatus({
      [side]: {
        isAlarmVibrating: false,
      }
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
        setDismissed(true);
      });
  };

  return (
    <Dialog
      open={ dismissed ? false : deviceStatus?.[side].isAlarmVibrating || false }
      fullScreen={ isSmallScreen }
      PaperProps={ {
        sx: isSmallScreen
          ? {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '85vw',
            maxHeight: '35vh',
            borderRadius: '10px',
            margin: 0,
          }
          : {
            width: '50%',
            height: '200px'
          },
      } }
    >
      <DialogActions
        sx={ {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        } }
      >
        <AlarmIcon fontSize="large" sx={ { mb: 4,animation: `${pulse} 2s infinite`, } }/>
        <Button
          onClick={ handleDismiss }
          color="error"
          variant="contained"
        >
          Dismiss Alarm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
