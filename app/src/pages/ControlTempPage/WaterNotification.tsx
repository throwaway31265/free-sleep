import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useDeviceStatus } from '@api/deviceStatus.ts';



export default function WaterNotification() {
  const { data: deviceStatus } = useDeviceStatus();

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
        Please create an issue and included the message above <Link href='https://github.com/onemec/free-sleep/issues'>here</Link>
      </Alert>
    );
  }
  return null;

}

