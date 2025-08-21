import { Switch, Box, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

export default function EnabledSwitch() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  
  const isEnabled = selectedSchedule?.power.enabled || false;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 2,
          borderRadius: '16px',
          backgroundColor: isEnabled 
            ? 'rgba(76, 175, 80, 0.1)'
            : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid',
          borderColor: isEnabled 
            ? 'rgba(76, 175, 80, 0.3)'
            : 'rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Switch
          checked={isEnabled}
          onChange={() => {
            updateSelectedSchedule({
              power: {
                enabled: !isEnabled,
              },
            });
          }}
          disabled={isUpdating}
          sx={{
            '& .MuiSwitch-switchBase': {
              '&.Mui-checked': {
                color: '#4CAF50',
                '& + .MuiSwitch-track': {
                  backgroundColor: 'rgba(76, 175, 80, 0.3)',
                  border: '1px solid rgba(76, 175, 80, 0.5)',
                },
              },
            },
            '& .MuiSwitch-track': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            },
          }}
        />
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#fff',
              fontSize: { xs: '14px', sm: '16px' },
              fontWeight: '600',
              lineHeight: 1.2,
            }}
          >
            Schedule {isEnabled ? 'Enabled' : 'Disabled'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: { xs: '11px', sm: '12px' },
              display: 'block',
            }}
          >
            {isEnabled 
              ? 'Schedule will run automatically'
              : 'Schedule is paused'
            }
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
