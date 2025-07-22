import { DayOfWeek } from '@api/schedulesSchema.ts';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { daysOfWeek } from './ApplyToOtherDaysAccordion.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

export default function MultiDaySelector() {
  const { selectedDays, toggleSelectedDay, selectedDay } = useScheduleStore();
  const { isUpdating } = useAppStore();

  const selectedDaysList = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day, _]) => day);

  // Show all selected days (including current day if selected)
  const allSelectedDays = selectedDaysList;

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];

    // Reset all days first
    Object.keys(selectedDays).forEach((day) => {
      if (selectedDays[day as DayOfWeek]) {
        toggleSelectedDay(day as DayOfWeek);
      }
    });

    // Toggle the selected days (including current day)
    value.forEach((day) => {
      toggleSelectedDay(day as DayOfWeek);
    });
  };

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
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handlePresetSelection('weekdays')}
          disabled={isUpdating}
        >
          Weekdays
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handlePresetSelection('weekends')}
          disabled={isUpdating}
        >
          Weekends
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handlePresetSelection('all')}
          disabled={isUpdating}
        >
          All Days
        </Button>
      </Box>
      <FormControl fullWidth>
        <InputLabel>Days to Apply Schedule</InputLabel>
        <Select
          multiple
          value={allSelectedDays}
          onChange={handleChange}
          input={<OutlinedInput label="Days to Apply Schedule" />}
          disabled={isUpdating}
          MenuProps={MenuProps}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((value) => (
                <Chip
                  key={value}
                  label={value.charAt(0).toUpperCase() + value.slice(1)}
                  size="small"
                  variant={value === selectedDay ? 'filled' : 'outlined'}
                  onDelete={() => handleDelete(value)}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                />
              ))}
            </Box>
          )}
        >
          {daysOfWeek.map((day) => {
            const lowerCaseDay = day.toLowerCase() as DayOfWeek;
            return (
              <MenuItem key={day} value={lowerCaseDay}>
                {day} {lowerCaseDay === selectedDay && '(current)'}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      {allSelectedDays.length > 1 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: 'block' }}
        >
          Schedule will be applied to {allSelectedDays.length} days
        </Typography>
      )}
    </Box>
  );
}
