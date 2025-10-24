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
        Water tank is low or empty, refill the water tank
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

