import type { Time } from '@api/schedulesSchema.ts';
import { TextField } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import moment from 'moment-timezone';
import { useScheduleStore } from './scheduleStore.tsx';

export default function AlarmTime() {
  const { isUpdating } = useAppStore();
  const {
    selectedSchedule,
    updateSelectedSchedule,
    validations,
    setValidations,
  } = useScheduleStore();

  const handleChange = (time: Time) => {
    const currentDate = moment().format('YYYY-MM-DD');

    // Create the moment objects
    const powerOffMoment = moment(
      `${currentDate} ${selectedSchedule?.power.off}`,
      'YYYY-MM-DD HH:mm',
    );
    const alarmMoment = moment(`${currentDate} ${time}`, 'YYYY-MM-DD HH:mm');

    // Adjust for the next day if the end time is earlier than the start time
    const isValid = powerOffMoment.isAfter(alarmMoment);
    setValidations({ alarmTimeIsValid: isValid });
    updateSelectedSchedule({
      alarm: {
        time: time,
      },
    });
  };

  return (
    <TextField
      label="Alarm time"
      type="time"
      value={selectedSchedule?.alarm.time || '09:00'}
      onChange={(e) => handleChange(e.target.value)}
      error={!validations.alarmTimeIsValid}
      helperText={
        validations.alarmTimeIsValid
          ? ''
          : 'Alarm time must be before power off time'
      }
      disabled={isUpdating}
      sx={{ mt: 2, width: '100%' }}
    />
  );
}
