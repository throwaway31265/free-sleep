import type { Time } from '@api/schedulesSchema';
import { TextField } from '@mui/material';
import { useAppStore } from '@state/appStore';
import moment from 'moment-timezone';
import { useScheduleStore } from './scheduleStore';

export default function PowerOffTime() {
  const {
    validations,
    setValidations,
    selectedSchedule,
    updateSelectedSchedule,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();

  const handleChange = (time: Time) => {
    const currentDate = moment().format('YYYY-MM-DD');

    // Create the moment objects
    const startMoment = moment(
      `${currentDate} ${selectedSchedule?.power.on}`,
      'YYYY-MM-DD HH:mm',
    );
    const endMomentSameDay = moment(
      `${currentDate} ${time}`,
      'YYYY-MM-DD HH:mm',
    );

    // Adjust for the next day if the end time is earlier than the start time
    const endMomentNextDay = moment(endMomentSameDay).add(1, 'day');
    const isValid =
      endMomentSameDay.isAfter(startMoment) ||
      endMomentNextDay.diff(startMoment, 'hours') <= 12;
    setValidations({ powerOffTimeIsValid: isValid });
    updateSelectedSchedule({
      power: {
        off: time,
      },
    });
  };

  const disabled = !selectedSchedule?.power.enabled || isUpdating;

  return (
    <TextField
      label="Power off"
      type="time"
      value={selectedSchedule?.power?.off || '09:00'}
      onChange={(e) => handleChange(e.target.value)}
      error={!validations.powerOffTimeIsValid}
      helperText={
        !validations.powerOffTimeIsValid
          ? `Time must be no later than 12 hours the same day or next day`
          : ''
      }
      disabled={disabled}
      sx={{ mt: 2, width: '100%' }}
    />
  );
}
