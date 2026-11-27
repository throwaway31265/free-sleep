import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useScheduleStore } from '../scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { postAlarm } from '@api/alarm.ts';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useEffect, useRef, useState } from 'react';

// The test runs for the configured alarm duration so intensity and pattern feel the same as the
// real alarm (a 'rise' pattern barely ramps up in a few seconds). Stop ends it early.
const MIN_DURATION_SECONDS = 10;

export default function AlarmTest() {
  const { side } = useAppStore();
  const { selectedSchedule } = useScheduleStore();
  const [isTesting, setIsTesting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // Stop must target the side the test started on, even if the user switches sides meanwhile.
  const testSideRef = useRef(side);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  const onTestAlarm = () => {
    if (!selectedSchedule || isBusy) return;
    const durationSeconds = Math.max(MIN_DURATION_SECONDS, selectedSchedule.alarm.duration);

    setIsBusy(true);
    testSideRef.current = side;
    postAlarm({
      side,
      vibrationIntensity: selectedSchedule.alarm.vibrationIntensity,
      duration: durationSeconds,
      vibrationPattern: selectedSchedule.alarm.vibrationPattern,
      force: true,
    })
      .then(() => {
        setIsTesting(true);
        clearTimer();
        timerRef.current = setTimeout(() => setIsTesting(false), durationSeconds * 1_000);
      })
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsBusy(false));
  };

  const onStopTest = () => {
    if (isBusy) return;
    setIsBusy(true);
    postDeviceStatus({ [testSideRef.current]: { isAlarmVibrating: false } })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        clearTimer();
        setIsTesting(false);
        setIsBusy(false);
      });
  };

  return (
    <Box
      sx={ {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        pr: 1,
      } }
    >
      { isTesting && (
        <Box
          sx={ {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
            pl: 2
          } }
        >
          <CircularProgress size={ 12 } />
          <Typography color="textSecondary">Alarm running now...</Typography>
        </Box>
      ) }

      <Button
        variant="outlined"
        sx={ { ml: 'auto' } }
        color={ isTesting ? 'error' : 'primary' }
        onClick={ isTesting ? onStopTest : onTestAlarm }
        disabled={ isBusy }
      >
        { isTesting ? 'Stop' : 'Test alarm' }
      </Button>
    </Box>
  );
}
