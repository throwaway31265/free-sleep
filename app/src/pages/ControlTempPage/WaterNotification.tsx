import Alert from '@mui/material/Alert';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import Link from '@mui/material/Link';


type WaterNotificationProps = {
  deviceStatus?: DeviceStatus;
}

export default function WaterNotification({ deviceStatus }: WaterNotificationProps) {

  if (deviceStatus?.waterLevel === 'false') {
    return (
      <Alert severity="warning">
        The device status is showing waterLevel === false
        <br />
        <br />
        This could mean
        <br />
        1. The water hose is not connected to the pod
        <br />
        2. The water level is low, refill the water tank and run a prime cycle
        <br />
        { /* eslint-disable-next-line max-len */ }
        3. If you've done step 1 & 2, the water tank is still FULL, and still see this message, reset the firmware on your pod and set it up in the 8 sleep app. Our debugging ability here is limited, the app might have more info, or support.
      </Alert>
    );
  }
  if (![undefined, 'true'].includes(deviceStatus?.waterLevel)) {
    return (
      <Alert severity="warning">
        { `Unhandled deviceStatus.waterLevel: '${deviceStatus?.waterLevel}'` }
        <br />
        Please create an issue and included the message above <Link href='https://github.com/throwaway31265/free-sleep/issues'>here</Link>
      </Alert>
    );
  }
  return null;

}

