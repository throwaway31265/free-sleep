import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { useScheduleStore } from './scheduleStore.tsx';

export default function SchedulePreview() {
  const { selectedDays, selectedDay, selectedSchedule } = useScheduleStore();

  const selectedDaysList = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day, _]) => day);

  const allSelectedDays = [...new Set([selectedDay, ...selectedDaysList])];

  if (allSelectedDays.length <= 1) {
    return null;
  }

  return (
    <Card sx={{ mb: 2, bgcolor: 'action.hover' }}>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Schedule Preview
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {allSelectedDays.map((day) => (
            <Chip
              key={day}
              label={day.charAt(0).toUpperCase() + day.slice(1)}
              size="small"
              variant={day === selectedDay ? 'filled' : 'outlined'}
              color={day === selectedDay ? 'primary' : 'default'}
            />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {selectedSchedule?.power.enabled ? (
            <>
              Start: {selectedSchedule.power.on} | End:{' '}
              {selectedSchedule.power.off}
              {selectedSchedule.alarm?.enabled && (
                <> | Alarm: {selectedSchedule.alarm.time}</>
              )}
            </>
          ) : (
            'Schedule disabled'
          )}
        </Typography>
      </CardContent>
    </Card>
  );
}
