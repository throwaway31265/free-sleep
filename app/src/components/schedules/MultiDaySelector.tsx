import type { DayOfWeek } from '@api/schedulesSchema';
import {
  Box,
  Button,
  Chip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { daysOfWeek } from './ApplyToOtherDaysAccordion.tsx';
import { useScheduleStore } from './scheduleStore.tsx';


export default function MultiDaySelector() {
  const { selectedDays, toggleSelectedDay, selectedDay } = useScheduleStore();
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const selectedDaysList = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day, _]) => day);

  // Show all selected days (including current day if selected)
  const allSelectedDays = selectedDaysList;


  const handleDelete = (dayToDelete: string) => {
    toggleSelectedDay(dayToDelete as DayOfWeek);
  };

  const handlePresetSelection = (preset: string) => {
    // Reset all days first
    Object.keys(selectedDays).forEach((day) => {
      if (selectedDays[day as DayOfWeek]) {
        toggleSelectedDay(day as DayOfWeek);
      }
    });

    let daysToSelect: string[] = [];
    switch (preset) {
      case 'weekdays':
        daysToSelect = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        break;
      case 'weekends':
        daysToSelect = ['saturday', 'sunday'];
        break;
      case 'all':
        daysToSelect = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ];
        break;
    }

    // Toggle the selected days (including current day if it's in the preset)
    daysToSelect.forEach((day) => {
      toggleSelectedDay(day as DayOfWeek);
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="subtitle2"
        sx={{
          color: 'rgba(255, 255, 255, 0.8)',
          mb: 2,
          fontSize: { xs: '14px', sm: '15px' },
          fontWeight: '600',
        }}
      >
        Days to Apply Schedule
      </Typography>
      
      {/* Quick presets */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Button
          size={isMobile ? 'medium' : 'small'}
          variant="outlined"
          onClick={() => handlePresetSelection('weekdays')}
          disabled={isUpdating}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            px: { xs: 2, sm: 2.5 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '13px', sm: '14px' },
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.4)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Weekdays (M-F)
        </Button>
        <Button
          size={isMobile ? 'medium' : 'small'}
          variant="outlined"
          onClick={() => handlePresetSelection('weekends')}
          disabled={isUpdating}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            px: { xs: 2, sm: 2.5 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '13px', sm: '14px' },
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.4)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Weekends
        </Button>
        <Button
          size={isMobile ? 'medium' : 'small'}
          variant="outlined"
          onClick={() => handlePresetSelection('all')}
          disabled={isUpdating}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            px: { xs: 2, sm: 2.5 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '13px', sm: '14px' },
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.4)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Every Day
        </Button>
      </Box>
      {/* Custom day selector */}
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255, 255, 255, 0.6)',
          mb: 2,
          display: 'block',
          fontSize: { xs: '12px', sm: '13px' },
        }}
      >
        Or select specific days:
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 1, mb: 3 }}>
        {daysOfWeek.map((day) => {
          const lowerCaseDay = day.toLowerCase() as DayOfWeek;
          const isSelected = selectedDays[lowerCaseDay];
          const isCurrent = lowerCaseDay === selectedDay;
          
          return (
            <Button
              key={day}
              variant={isSelected ? 'contained' : 'outlined'}
              onClick={() => toggleSelectedDay(lowerCaseDay)}
              disabled={isUpdating}
              size={isMobile ? 'medium' : 'small'}
              sx={{
                minHeight: { xs: '48px', sm: '40px' },
                borderRadius: '12px',
                fontSize: { xs: '12px', sm: '13px' },
                fontWeight: '600',
                backgroundColor: isSelected 
                  ? isCurrent 
                    ? 'rgba(33, 150, 243, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)'
                  : 'transparent',
                borderColor: isSelected 
                  ? isCurrent 
                    ? 'rgba(33, 150, 243, 0.5)'
                    : 'rgba(255, 255, 255, 0.3)'
                  : 'rgba(255, 255, 255, 0.2)',
                color: isSelected 
                  ? '#fff'
                  : 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  backgroundColor: isSelected 
                    ? isCurrent 
                      ? 'rgba(33, 150, 243, 0.3)'
                      : 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography sx={{ fontSize: { xs: '12px', sm: '13px' }, fontWeight: '600' }}>
                  {day.slice(0, 3)}
                </Typography>
                {isCurrent && (
                  <Typography sx={{ fontSize: '9px', color: 'rgba(33, 150, 243, 0.8)', mt: 0.25 }}>
                    TODAY
                  </Typography>
                )}
              </Box>
            </Button>
          );
        })}
      </Box>
      
      {/* Selected summary */}
      {allSelectedDays.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {allSelectedDays.map((day) => (
            <Chip
              key={day}
              label={day.charAt(0).toUpperCase() + day.slice(1)}
              size="small"
              variant={day === selectedDay ? 'filled' : 'outlined'}
              onDelete={() => handleDelete(day)}
              sx={{
                backgroundColor: day === selectedDay 
                  ? 'rgba(33, 150, 243, 0.2)'
                  : 'rgba(255, 255, 255, 0.1)',
                borderColor: day === selectedDay 
                  ? 'rgba(33, 150, 243, 0.5)'
                  : 'rgba(255, 255, 255, 0.3)',
                color: '#fff',
                fontSize: { xs: '11px', sm: '12px' },
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: '#fff',
                  },
                },
              }}
            />
          ))}
        </Box>
      )}

      {allSelectedDays.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: allSelectedDays.length > 1 
              ? 'rgba(33, 150, 243, 0.8)' 
              : 'rgba(255, 255, 255, 0.6)',
            display: 'block',
            fontSize: { xs: '11px', sm: '12px' },
            fontWeight: '500',
          }}
        >
          Schedule will be applied to {allSelectedDays.length} day{allSelectedDays.length !== 1 ? 's' : ''}
        </Typography>
      )}
    </Box>
  );
}
