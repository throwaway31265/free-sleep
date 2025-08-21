import { Box, Slider, TextField, Typography, Paper } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperature } from '@/components/temperature/TemperatureLabel';
import { useScheduleStore } from './scheduleStore.tsx';

export default function StartTimeSection({
  displayCelsius,
}: {
  displayCelsius: boolean;
}) {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();

  const disabled = !selectedSchedule?.power.enabled || isUpdating;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 3, sm: 4, md: 6 },
        width: '100%',
      }}
      id="start-time-section"
    >
      {/* Start time */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: { xs: 2.5, sm: 3 },
          minWidth: { xs: '100%', md: '200px' },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: 'rgba(255, 255, 255, 0.8)',
            mb: 2,
            fontSize: { xs: '14px', sm: '15px' },
            fontWeight: '600',
          }}
        >
          Power On Time
        </Typography>
        <TextField
          type="time"
          value={selectedSchedule?.power.on || '21:00'}
          disabled={disabled}
          onChange={(event) => {
            updateSelectedSchedule({
              power: {
                on: event.target.value,
              },
            });
          }}
          fullWidth
          InputProps={{
            sx: {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: { xs: '18px', sm: '20px' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
              },
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255, 255, 255, 0.6)',
            mt: 1,
            display: 'block',
            fontSize: { xs: '11px', sm: '12px' },
          }}
        >
          When to start heating
        </Typography>
      </Paper>

      {/* Temperature slider */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: { xs: 2.5, sm: 3 },
          flex: 1,
          minWidth: 0,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: 'rgba(255, 255, 255, 0.8)',
            mb: 1,
            fontSize: { xs: '14px', sm: '15px' },
            fontWeight: '600',
          }}
        >
          Target Temperature
        </Typography>
        
        <Typography
          variant="h5"
          sx={{
            color: '#fff',
            textAlign: 'center',
            mb: 3,
            fontSize: { xs: '1.5rem', sm: '1.75rem' },
            fontWeight: '600',
          }}
        >
          {formatTemperature(selectedSchedule?.power?.onTemperature || 82, displayCelsius)}
        </Typography>
        
        <Slider
          value={selectedSchedule?.power?.onTemperature || 82}
          onChange={(_, newValue) => {
            updateSelectedSchedule({
              power: {
                onTemperature: newValue as number,
              },
            });
          }}
          min={55}
          max={110}
          step={1}
          marks={[
            { value: 55, label: formatTemperature(55, displayCelsius) },
            { value: 82, label: '' },
            { value: 110, label: formatTemperature(110, displayCelsius) },
          ]}
          disabled={disabled}
          sx={{
            color: '#fff',
            width: '100%',
            '& .MuiSlider-thumb': {
              backgroundColor: '#fff',
              width: { xs: 24, sm: 28 },
              height: { xs: 24, sm: 28 },
              '&:hover': {
                boxShadow: '0 0 0 8px rgba(255, 255, 255, 0.16)',
              },
            },
            '& .MuiSlider-track': {
              backgroundColor: '#fff',
              border: 'none',
            },
            '& .MuiSlider-rail': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
            '& .MuiSlider-mark': {
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              width: 3,
              height: 3,
            },
            '& .MuiSlider-markLabel': {
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: { xs: '11px', sm: '12px' },
            },
          }}
        />
        
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255, 255, 255, 0.6)',
            mt: 2,
            display: 'block',
            textAlign: 'center',
            fontSize: { xs: '11px', sm: '12px' },
          }}
        >
          Drag to adjust heating temperature
        </Typography>
      </Paper>
    </Box>
  );
}
