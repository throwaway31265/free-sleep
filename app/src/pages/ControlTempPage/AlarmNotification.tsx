import moment from 'moment-timezone';
import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import {
  Alert,
  Box,
  Button,
} from '@mui/material';

import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useEffect, useState } from 'react';
import { DayOfWeek } from '../../../../server/src/db/schedulesSchema.ts';
import AlarmOverride from './AlarmOverride.tsx';
import AlarmDisabledDialog from './AlarmDisabledDialog.tsx';


export default function AlarmNotification() {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [disabledOpen, setDisabledOpen] = useState(false);
  const [alarmTimeLocalOverride, setAlarmTimeLocalOverride] = useState<string>('');
  const [alarmDisabled, setAlarmDisabled] = useState(false);
  const currentDay = moment.tz(settings?.timeZone || 'UTC').subtract(12, 'hours').format('dddd').toLowerCase() as DayOfWeek;
  const alarm = schedules?.[side][currentDay].alarm;
  const power = schedules?.[side][currentDay].power;


  const [scheduledAlarmTimeAmPm, setScheduledAlarmTimeAmPm] = useState('');
  const [scheduledAlarmTimeHhMm, setScheduledAlarmTimeHhMm] = useState('');

  useEffect(() => {
    if (!settings || !schedules) return;
    const alarm = schedules[side][currentDay].alarm;

    const hhMm = moment(alarm.time, 'HH:mm').format('hh:mm');
    const amPm = moment(alarm.time, 'HH:mm').format('h:mm A');
    setScheduledAlarmTimeHhMm(hhMm);
    setScheduledAlarmTimeAmPm(amPm);
    setAlarmDisabled(false);
    const alarmScheduleOverrides = settings[side].scheduleOverrides.alarm;
    if (alarmScheduleOverrides.expiresAt) {
      const expiresAt = moment(alarmScheduleOverrides.expiresAt);

      if (expiresAt.isAfter(moment())) {
        if (alarmScheduleOverrides.disabled) {
          setAlarmDisabled(true);
          setScheduledAlarmTimeHhMm(hhMm);
          setScheduledAlarmTimeAmPm(amPm);
        } else {
          setAlarmDisabled(false);
          setScheduledAlarmTimeAmPm(moment(alarmScheduleOverrides.timeOverride, 'HH:mm').format('h:mm A'));
          setScheduledAlarmTimeHhMm(moment(alarmScheduleOverrides.timeOverride, 'HH:mm').format('hh:mm'));
        }
      }
    }
  }, [settings, schedules, side]);

  if (!power?.enabled || !alarm?.enabled || !settings) return null;

  return (
    <Alert
      icon={ alarmDisabled ? <AlarmOffIcon /> : <AlarmIcon/> }
      severity="warning"
      sx={ {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        '& .MuiAlert-message': { flexGrow: 1, width: '100%' }
      } }
    >
      <AlarmOverride
        open={ overrideOpen }
        setOverrideOpen={ setOverrideOpen }
        alarmTimeLocalOverride={ alarmTimeLocalOverride }
        scheduledAlarmTimeHhMm={ scheduledAlarmTimeHhMm }
        setAlarmTimeLocalOverride={ setAlarmTimeLocalOverride }
      />
      <AlarmDisabledDialog
        open={ disabledOpen }
        setOpen={ setDisabledOpen }
        scheduledAlarmTimeHhMm={ scheduledAlarmTimeHhMm }
        alarmDisabled={ alarmDisabled }
      />
      <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
        {
          alarmDisabled ?
            (
              <Box sx={ { display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' } }>
                <div>

                Alarm is disabled
                &nbsp;
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  onClick={ () => setDisabledOpen(true) }
                >
                  Enable
                </Button>
              </Box>

            )
            :
            (
              <>
                <div>
                  Alarm at &nbsp;
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    onClick={ () => setOverrideOpen(!overrideOpen) }
                  >
                    { scheduledAlarmTimeAmPm }
                  </Button>

                </div>
                &nbsp;
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  onClick={ () => setDisabledOpen(true) }
                >
                  Disable
                </Button>
              </>
            )
        }
      </Box>
    </Alert>
  );
}
