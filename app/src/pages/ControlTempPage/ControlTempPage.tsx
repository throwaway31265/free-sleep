import { useEffect } from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, Typography } from '@mui/material';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import AlarmDismissal from './AlarmDismissal.tsx';
import AlarmNotification from './AlarmNotification.tsx';
import AwayNotification from './AwayNotification.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageContainer from '../PageContainer.tsx';
import PowerButton from './PowerButton.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import SideControl from '@components/SideControl.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';

export default function ControlTempPage() {
  const { isError, isPending, refetch, data: deviceStatus } = useDeviceStatus();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();
  const sideStatus = deviceStatus?.[side];
  const isOn = sideStatus?.isOn || false;

  useEffect(() => { refetch(); }, [side, refetch]);
  useEffect(() => {
    if (deviceStatus) setDeviceStatus(deviceStatus);
  }, [deviceStatus, setDeviceStatus]);

  return (
    <PageContainer sx={ { maxWidth: 600, gap: 2, pt: { xs: 2.5, md: 5 } } }>
      <SideControl showTemp/>
      <Paper
        sx={ {
          px: { xs: 0, sm: 3 }, py: { xs: 1.5, sm: 3 }, overflow: 'hidden',
          bgcolor: { xs: 'transparent', sm: 'background.paper' },
          borderWidth: { xs: 0, sm: 1 }, borderRadius: { xs: 0, sm: 3 },
        } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 } }>
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>
            <ThermostatOutlinedIcon sx={ { color: 'text.secondary', fontSize: 17 } }/>
            <Typography variant="body2" fontWeight={ 500 }>Bed temperature</Typography>
          </Box>
          <Chip label={ isPending ? 'Connecting' : isOn ? 'Active' : 'Standby' } color={ isOn ? 'success' : 'default' } size="small"/>
        </Box>
        { isPending ? (
          <Skeleton variant="circular" width={ 240 } height={ 240 } sx={ { mx: 'auto', my: 3 } }/>
        ) : isError ? (
          <Alert severity="error" sx={ { my: 3 } }>Unable to reach your Pod. Try connecting again.</Alert>
        ) : (
          <Box sx={ { display: 'flex', justifyContent: 'center', pt: 1 } }>
            <Slider
              isOn={ isOn }
              currentTargetTemp={ sideStatus?.targetTemperatureF ?? 55 }
              refetch={ refetch }
              currentTemperatureF={ sideStatus?.currentTemperatureF ?? 55 }
              displayCelsius={ settings?.temperatureFormat === 'celsius' }
            />
          </Box>
        ) }
        { isError ? (
          <Button fullWidth variant="contained" onClick={ () => refetch() } disabled={ isUpdating }>Reconnect</Button>
        ) : (
          <PowerButton isOn={ isOn } refetch={ refetch }/>
        ) }
      </Paper>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        { deviceStatus?.isPriming && <PrimingNotification/> }
        <ErrorBoundary componentName="Alarm notification"><AlarmNotification/></ErrorBoundary>
        <AwayNotification settings={ settings }/>
        <WaterNotification/>
      </Box>
      <AlarmDismissal refetch={ refetch }/>
    </PageContainer>
  );
}
