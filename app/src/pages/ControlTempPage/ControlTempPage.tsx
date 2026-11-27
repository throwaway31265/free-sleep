import { useEffect } from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AlarmDismissal from './AlarmDismissal.tsx';
import AlarmNotification from './AlarmNotification.tsx';
import AutopilotCard from './AutopilotCard.tsx';
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
import { getTemperatureColor } from '@lib/temperatureConversions.ts';

export default function ControlTempPage() {
  const { isError, isPending, refetch, data: deviceStatus } = useDeviceStatus();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();
  const liveTargetTempF = useControlTempStore(state => state.deviceStatus?.[side]?.targetTemperatureF);
  const sideStatus = deviceStatus?.[side];
  const isOn = sideStatus?.isOn || false;
  const sideName = settings?.[side]?.name || `${side === 'left' ? 'Left' : 'Right'} side`;
  // Glow follows the dial while it's being dragged, falling back to the Pod's reported target
  const glowColor = isOn ? getTemperatureColor(liveTargetTempF ?? sideStatus?.targetTemperatureF) : undefined;

  useEffect(() => { refetch(); }, [side, refetch]);
  useEffect(() => {
    if (deviceStatus) setDeviceStatus(deviceStatus);
  }, [deviceStatus, setDeviceStatus]);

  return (
    <PageContainer sx={ { maxWidth: 560, gap: 2, pt: { xs: 2, md: 5 } } }>
      <SideControl showTemp/>
      <Paper
        sx={ theme => ({
          position: 'relative', overflow: 'hidden', isolation: 'isolate',
          px: { xs: 2, sm: 3 }, pt: 2.5, pb: { xs: 2.5, sm: 3 }, borderRadius: '28px',
          // Static temperature glow. Background color changes are cheap; no blur or animation loop.
          '&::before': {
            content: '""', position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none',
            background: glowColor
              ? `radial-gradient(70% 55% at 50% 42%, ${alpha(glowColor, theme.palette.mode === 'dark' ? 0.22 : 0.16)} 0%, transparent 72%)`
              : 'none',
            transition: 'background 400ms ease',
          },
        }) }
      >
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
          <Box sx={ { minWidth: 0 } }>
            <Typography variant="overline" sx={ { color: 'text.secondary', display: 'block', lineHeight: 1.4 } }>Bed temperature</Typography>
            <Typography variant="h5" component="h1" noWrap>{ sideName }</Typography>
          </Box>
          <Chip
            label={ isPending ? 'Connecting' : isError ? 'Offline' : isOn ? 'Active' : 'Standby' }
            color={ isError ? 'error' : isOn ? 'success' : 'default' }
            size="small"
          />
        </Box>
        { isPending ? (
          <Skeleton variant="circular" width={ 260 } height={ 260 } sx={ { mx: 'auto', my: 3 } }/>
        ) : isError ? (
          <Alert severity="error" sx={ { my: 3 } }>Unable to reach your Pod. Try connecting again.</Alert>
        ) : (
          <Box sx={ { display: 'flex', justifyContent: 'center', pt: 1.5 } }>
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
      <ErrorBoundary componentName="Autopilot"><AutopilotCard settings={ settings }/></ErrorBoundary>
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
