import { Box, Slider, Typography } from '@mui/material';
import { useScheduleStore } from './scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';

export default function AlarmVibrationSlider() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flex: 1, pr: 1 } }>
      <Typography sx={ { mb: -1, textAlign: 'center' } }>
        { `Vibration intensity ${selectedSchedule?.alarm?.vibrationIntensity}%` }
      </Typography>
      <Slider
        value={ selectedSchedule?.alarm?.vibrationIntensity || 50 }
        onChange={ (_, newValue) => {
          updateSelectedSchedule({
            alarm: {
              // @ts-ignore
              vibrationIntensity: newValue
            }
          });
        } }
        min={ 1 }
        max={ 100 }
        step={ 1 }
        marks={ [
          { value: 1, label: '1' },
          { value: 50, label: '50' },
          { value: 100, label: '100' },
        ] }
        disabled={ isUpdating }
        sx={ { width: '100%', mb: 2 } }
      />
    </Box>
  );
}
