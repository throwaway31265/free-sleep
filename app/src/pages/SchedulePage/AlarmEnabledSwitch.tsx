import { FormControlLabel, Switch } from '@mui/material';
import { useScheduleStore } from './scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';


export default function AlarmEnabledSwitch() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();

  return (
    <FormControlLabel
      control={
        <Switch
          checked={ selectedSchedule?.alarm.enabled || false }
          onChange={ () => {
            updateSelectedSchedule({
              alarm: {
                enabled: !selectedSchedule?.alarm.enabled
              }
            }
            );
          } }
          disabled={ isUpdating }
        />
      }
      label="Enabled"
    />
  );
}
