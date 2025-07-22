import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { useAppStore } from '@state/appStore.tsx';
import _ from 'lodash';
import { useScheduleStore } from './scheduleStore.tsx';

const DURATION_LIST = _.range(1, 180);

export default function AlarmDuration() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();

  return (
    <Box sx={{ width: '100%' }}>
      <FormControl fullWidth>
        <InputLabel>Alarm Duration (seconds)</InputLabel>
        <Select
          disabled={isUpdating}
          value={selectedSchedule?.alarm.duration}
          onChange={(event) => {
            updateSelectedSchedule({
              alarm: {
                duration: event.target.value as number,
              },
            });
          }}
        >
          {DURATION_LIST.map((duration) => (
            <MenuItem value={duration} key={duration}>
              {duration}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
