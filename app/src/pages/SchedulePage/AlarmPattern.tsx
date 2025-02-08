import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';


const PATTERNS = ['rise', 'double'];
export default function AlarmPattern() {
  const { isUpdating } = useAppStore();
  const {
    selectedSchedule,
    updateSelectedSchedule,
  } = useScheduleStore();

  return (
    <Box sx={ { minWidth: 120 } }>
      <FormControl fullWidth>
        <InputLabel>Vibration pattern</InputLabel>
        <Select
          disabled={ isUpdating }
          value={ selectedSchedule?.alarm.vibrationPattern }
          onChange={ (event) => {
            updateSelectedSchedule(
              {
                alarm: {
                  // @ts-ignore
                  vibrationPattern: event.target.value,
                },
              }
            );
          } }
        >
          {
            PATTERNS.map((pattern) => (
              <MenuItem value={ pattern } key={ pattern }>{ pattern }</MenuItem>
            ))
          }
        </Select>
      </FormControl>
    </Box>
  );
}
