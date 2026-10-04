import moment from 'moment-timezone';
import { InputAdornment, TextField } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from '../scheduleStore.tsx';
import { Time } from '@api/schedulesSchema.ts';
import AccessTime from '@mui/icons-material/AccessTime';
import { useTheme } from '@mui/material/styles';

export default function AlarmTime() {
  const { isUpdating } = useAppStore();
  const {
    selectedSchedule,
    updateSelectedSchedule,
    validations,
    setValidations,
  } = useScheduleStore();
  const theme = useTheme();

  const handleChange = (time: Time) => {
    const currentDate = moment().format('YYYY-MM-DD');

    // Create the moment objects
    const powerOffMoment = moment(`${currentDate} ${selectedSchedule?.power.off}`, 'YYYY-MM-DD HH:mm');
    const alarmMoment = moment(`${currentDate} ${time}`, 'YYYY-MM-DD HH:mm');

    // Adjust for the next day if the end time is earlier than the start time
    const isValid = powerOffMoment.isAfter(alarmMoment);
    setValidations({ alarmTimeIsValid: isValid });
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
      variant='standard'
      error={ !validations.alarmTimeIsValid }
      helperText={
        validations.alarmTimeIsValid
          ? ''
          : 'Alarm time must be before power off time'
      }
      disabled={ isUpdating }
      sx={ {
        width: '110px',
        // Hide native indicator (where it exists)
        '& input::-webkit-calendar-picker-indicator': {
          opacity: 0,
          display: 'none',
        },
      } }
      slotProps={ {
        input: {
          endAdornment: (
            <InputAdornment position="end" sx={ { cursor: 'pointer' } } >
              <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize='small'/>
            </InputAdornment>
          ),
        }
      } }

    />
  );
}
