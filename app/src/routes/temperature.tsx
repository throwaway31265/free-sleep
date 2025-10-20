import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus';
import { useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema';
import { useSettings } from '@api/settings.ts';
import LeakAlertNotification from '@components/LeakAlertNotification.tsx';
import AlarmDismissal from '@components/temperature/AlarmDismissal.tsx';
import AwayNotification from '@components/temperature/AwayNotification.tsx';
import { useControlTempStore } from '@components/temperature/controlTempStore.tsx';
import PowerButton from '@components/temperature/PowerButton.tsx';
import ScheduleStatusBar from '@components/temperature/ScheduleStatusBar.tsx';
import Slider from '@components/temperature/Slider.tsx';
import LinkToggle from '@components/temperature/LinkToggle.tsx';
import WaterNotification from '@components/temperature/WaterNotification.tsx';
import { Box } from '@mui/material';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAppStore } from '@state/appStore.tsx';
import { createFileRoute } from '@tanstack/react-router';
import moment from 'moment-timezone';
import { useEffect, useRef } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../components/SideControl.tsx';

const getAdjustedDayOfWeek = (timezone: string | null): DayOfWeek => {
  const now = moment.tz(timezone || 'UTC');
  const currentHour = now.hour();

  if (currentHour < 5) {
    return now
      .subtract(1, 'day')
      .format('dddd')
      .toLocaleLowerCase() as DayOfWeek;
  } else {
    return now.format('dddd').toLocaleLowerCase() as DayOfWeek;
  }
};

function ControlTempPage() {
  const {
    data: deviceStatusOriginal,
    refetch,
    isLoading: isLoadingDevice,
  } = useDeviceStatus();
  const { setOriginalDeviceStatus, deviceStatus } = useControlTempStore();
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const { data: schedules } = useSchedules();
  const { isUpdating, side, setIsUpdating, clearError, setError } = useAppStore();

  useEffect(() => {
    if (!deviceStatusOriginal) return;
    setOriginalDeviceStatus(deviceStatusOriginal);
  }, [deviceStatusOriginal]);

  const sideStatus = deviceStatus?.[side];
  const isOn = sideStatus?.isOn || false;

  useEffect(() => {
    refetch();
  }, [side]);

  // Auto-sync when: (1) link is turned on with both sides active, or
  // (2) the other side exits away mode while link is enabled.
  const prev = useRef({
    link: settings?.linkBothSides ?? false,
    leftAway: settings?.left?.awayMode ?? false,
    rightAway: settings?.right?.awayMode ?? false,
  });

  useEffect(() => {
    if (!settings || !deviceStatus) return;
    const otherSide = side === 'right' ? 'left' : 'right';
    const link = settings.linkBothSides;
    const leftAway = settings.left.awayMode;
    const rightAway = settings.right.awayMode;

    const linkJustEnabled = !prev.current.link && link;
    const otherSideJustResumed =
      (otherSide === 'left'
        ? prev.current.leftAway && !leftAway
        : prev.current.rightAway && !rightAway) && link;

    if (linkJustEnabled || otherSideJustResumed) {
      // Only sync if both sides are not away now
      if (!leftAway && !rightAway) {
        const from = side; // sync from the current control side
        const to = otherSide;
        const fromStatus = deviceStatus[from];
        if (fromStatus) {
          const payload: any = {};
          // Push on/off and current target temp
          payload[to] = {
            isOn: fromStatus.isOn,
            targetTemperatureF: fromStatus.targetTemperatureF,
          };
          setIsUpdating(true);
          clearError();
          postDeviceStatus(payload)
            .then(() => new Promise((r) => setTimeout(r, 600)))
            .then(() => refetch())
            .catch((error) => {
              console.error(error);
              setError('Failed to sync other side while lock is enabled');
            })
            .finally(() => setIsUpdating(false));
        }
      }
    }

    prev.current = { link, leftAway, rightAway };
  }, [settings, deviceStatus, side]);

  // Show loading state while data is being fetched
  if (isLoadingDevice || isLoadingSettings) {
    return (
      <PageContainer>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: {
              xs: '100%',
              sm: '500px',
              md: '600px',
              lg: '700px',
              xl: '800px',
            },
            mx: 'auto',
            px: { xs: 3, sm: 4, md: 5 },
            gap: { xs: 4, sm: 5, md: 6 },
          }}
        >
          {/* Top navigation */}
          <SideControl title={'Temperature'} />

          {/* Loading content - centered in available space */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              width: '100%',
            }}
          >
            <CircularProgress sx={{ color: '#fff' }} size={60} />
          </Box>
        </Box>
      </PageContainer>
    );
  }

  // Don't render until we have both device status and settings
  if (!deviceStatus || !settings) {
    return null;
  }

  const currentDay = getAdjustedDayOfWeek(settings.timeZone);

  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: {
            xs: '100%',
            sm: '500px',
            md: '600px',
            lg: '700px',
            xl: '800px',
          },
          mx: 'auto',
          px: { xs: 3, sm: 4, md: 5 },
          gap: { xs: 4, sm: 5, md: 6 },
        }}
      >
        {/* Top navigation */}
        <SideControl title={'Temperature'} />
        {schedules && <ScheduleStatusBar schedules={schedules} currentDay={currentDay} />}
        <LinkToggle />
        {settings.linkBothSides && settings[(side === 'right' ? 'left' : 'right')].awayMode && (
          <Alert severity="info">
            Lock is enabled, but the other side is in Away. Changes will only apply to this side until Away is turned off.
          </Alert>
        )}

        {/* Temperature control section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            flexGrow: 1,
            justifyContent: 'center',
            gap: { xs: 4, sm: 5, md: 6 },
          }}
        >
          {/* Temperature slider */}
          <Box
            sx={{
              width: '100%',
              maxWidth: {
                xs: '320px',
                sm: '400px',
                md: '480px',
                lg: '520px',
                xl: '560px',
              },
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: { xs: 2, sm: 3 },
            }}
          >
            <Slider
              isOn={isOn}
              currentTargetTemp={sideStatus?.targetTemperatureF || 55}
              refetch={refetch}
              currentTemperatureF={sideStatus?.currentTemperatureF || 55}
              displayCelsius={
                settings?.temperatureFormat === 'celsius' || false
              }
            />
          </Box>

          {/* Power button */}
          <PowerButton isOn={sideStatus?.isOn || false} refetch={refetch} />
        </Box>

        {/* Notifications section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            gap: { xs: 2, sm: 2.5 },
          }}
        >
          <AwayNotification settings={settings} />
          <WaterNotification deviceStatus={deviceStatus} />
          <LeakAlertNotification />
          <AlarmDismissal deviceStatus={deviceStatus} refetch={refetch} />

          {isUpdating && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: { xs: 2, sm: 3 },
              }}
            >
              <CircularProgress size={28} />
            </Box>
          )}
        </Box>
      </Box>
    </PageContainer>
  );
}

export const Route = createFileRoute('/temperature')({
  component: ControlTempPage,
});
