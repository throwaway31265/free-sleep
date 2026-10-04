import AccessTime from '@mui/icons-material/AccessTime';
import { InputAdornment, TextField } from '@mui/material';
import { useScheduleStore } from './scheduleStore';
import { useAppStore } from '@state/appStore';
import { Time } from '@api/schedulesSchema.ts';
import { useTheme } from '@mui/material/styles';
import { isPowerScheduleDurationValid } from './scheduleValidation';


export default function PowerOffTime() {
  const {
    selectedSchedule,
    updateSelectedSchedule,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const isValid = !selectedSchedule || isPowerScheduleDurationValid(selectedSchedule.power.on, selectedSchedule.power.off);

  const handleChange = (time: Time) => {
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
      label="Power off"
      type="time"
      value={ selectedSchedule?.power?.off || '09:00' }
      onChange={ (e) => handleChange(e.target.value) }
      variant='standard'
      error={ !isValid }
      helperText={
        !isValid
          ? 'Enter valid, different power on and power off times'
          : ''
      }
      disabled={ disabled }
      sx={ {
        width: '110px',
        // Hide native indicator (where it exists)
        '& input::-webkit-calendar-picker-indicator': {
          opacity: 0,
          display: 'none',
        },
      } }
      InputProps={ {
        endAdornment: (
          <InputAdornment position="end" sx={ { cursor: 'pointer' } } >
            <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize='small'/>
          </InputAdornment>
        ),
      } }

    />
  );
}
