import { TextField } from '@mui/material';
import moment from 'moment-timezone';
import { useScheduleStore } from './scheduleStore';
import { useAppStore } from '@state/appStore';
import { Time } from '@api/schedulesSchema.ts';


export default function EndTime() {
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
    const startMoment = moment(`${currentDate} ${selectedSchedule?.power.on}`, 'YYYY-MM-DD HH:mm');
    const endMomentSameDay = moment(`${currentDate} ${time}`, 'YYYY-MM-DD HH:mm');

    // Adjust for the next day if the end time is earlier than the start time
    const endMomentNextDay = moment(endMomentSameDay).add(1, 'day');
    const isValid = endMomentSameDay.isAfter(startMoment) || endMomentNextDay.diff(startMoment, 'hours') <= 12;
    setValidations({ endTimeIsValid: isValid });
    updateSelectedSchedule(
      {
        power: {
          off: time,
        },
      }
    );
  };

  const disabled = !selectedSchedule?.power.enabled || isUpdating;

  return (
    <TextField
      label="End Time"
      type="time"
      value={ selectedSchedule?.power?.off || '09:00' }
      onChange={ (e) => handleChange(e.target.value) }

      error={ !validations.endTimeIsValid }
      helperText={
        !validations.endTimeIsValid
          ? `Time must be no later than 12 hours the same day or next day`
          : ''
      }
      disabled={ disabled }
      sx={ { mt: 2, width: '100%' } }
    />
  );
}
