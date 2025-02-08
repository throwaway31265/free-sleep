import { TextField } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { Time } from '@api/schedulesSchema.ts';

export default function AlarmTime() {
  const { isUpdating } = useAppStore();
  const {
    selectedSchedule,
    updateSelectedSchedule,
  } = useScheduleStore();

  const handleChange = (time: Time) => {
    // const currentDate = moment().format('YYYY-MM-DD');
    //
    // // Create the moment objects
    // const startMoment = moment(`${currentDate} ${selectedSchedule?.power.on}`, 'YYYY-MM-DD HH:mm');
    // const endMomentSameDay = moment(`${currentDate} ${time}`, 'YYYY-MM-DD HH:mm');
    //
    // // Adjust for the next day if the end time is earlier than the start time
    // const endMomentNextDay = moment(endMomentSameDay).add(1, 'day');
    // const isValid = endMomentSameDay.isAfter(startMoment) || endMomentNextDay.diff(startMoment, 'hours') <= 12;
    // setValidations({ endTimeIsValid: isValid });
    updateSelectedSchedule(
      {
        alarm: {
          time: time,
        },
      }
    );
  };

  return (
    <TextField
      label="Alarm time"
      type="time"
      value={ selectedSchedule?.alarm.time || '09:00' }
      onChange={ (e) => handleChange(e.target.value) }

      // error={!validations.endTimeIsValid}
      // helperText={
      //   !validations.endTimeIsValid
      //     ? `Time must be no later than 12 hours the same day or next day`
      //     : ''
      // }
      disabled={ isUpdating }
      sx={ { mt: 2, width: '100%' } }
    />
  );
}
