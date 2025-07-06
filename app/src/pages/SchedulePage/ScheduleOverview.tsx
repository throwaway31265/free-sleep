import { postSchedules } from '@api/schedules';
import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { useSettings } from '@api/settings';
import { Add, Schedule } from '@mui/icons-material';
import {
  Box,
  Button,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import GroupedScheduleCard from './GroupedScheduleCard.tsx';
import { groupSchedulesBySettings } from './scheduleGrouping.ts';

type ScheduleOverviewProps = {
  schedules: Schedules;
  onEditDay: (dayIndex: number) => void;
  onEditGroup: (dayIndices: number[]) => void;
  onCreateNew: () => void;
  onRefresh: () => void;
};

export default function ScheduleOverview({
  schedules,
  onEditDay,
  onEditGroup,
  onCreateNew,
  onRefresh,
}: ScheduleOverviewProps) {
  const { side, setIsUpdating } = useAppStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const sideSchedules = schedules[side];

  // Filter to only enabled schedules before grouping
  const enabledSchedules = Object.fromEntries(
    Object.entries(sideSchedules).filter(
      ([_, schedule]) => schedule.power.enabled,
    ),
  ) as Record<DayOfWeek, any>;

  const scheduleGroups = groupSchedulesBySettings(enabledSchedules);
  const enabledGroups = scheduleGroups; // All groups are already enabled

  const getCurrentDayIndex = () => {
    const now = new Date();
    const currentHour = now.getHours();
    let dayIndex = now.getDay();

    // Adjust for early morning (before noon)
    if (currentHour < 12) {
      dayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    }

    return dayIndex;
  };

  const currentDayIndex = getCurrentDayIndex();
  const currentDay = LOWERCASE_DAYS[currentDayIndex];

  const handleToggleSchedule = async (days: DayOfWeek[]) => {
    setIsUpdating(true);

    // Get the first day's schedule to determine the new enabled state
    const firstDaySchedule = sideSchedules[days[0]];
    const newEnabledState = !firstDaySchedule.power.enabled;

    const payload = {
      [side]: {} as Record<DayOfWeek, any>,
    };

    // Apply the toggle to all days in the group
    days.forEach((dayKey) => {
      const schedule = sideSchedules[dayKey];
      payload[side][dayKey] = {
        ...schedule,
        power: {
          ...schedule.power,
          enabled: newEnabledState,
        },
      };
    });

    try {
      await postSchedules(payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#000',
        color: '#fff',
        minHeight: '100vh',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 4 },
        pb: { xs: 12, sm: 4 }, // Add bottom padding for mobile navigation
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          mb: { xs: 3, sm: 4 },
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule sx={{ color: '#fff' }} />
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            sx={{ color: '#fff', fontWeight: 'normal' }}
          >
            Schedule Overview
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreateNew}
          fullWidth={isMobile}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            borderRadius: '24px',
            px: { xs: 4, sm: 3 },
            py: { xs: 2, sm: 1.5 },
            textTransform: 'none',
            fontSize: { xs: '18px', sm: '16px' },
            fontWeight: 'normal',
            border: 'none',
            minHeight: { xs: '56px', sm: 'auto' },
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          Create Schedule
        </Button>
      </Box>

      {enabledGroups.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 4, sm: 6 },
            px: { xs: 2, sm: 0 },
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography
            variant="h6"
            sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2 }}
          >
            No Schedules Enabled
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}
          >
            Create your first schedule to get started
          </Typography>
          <Button
            variant="outlined"
            onClick={onCreateNew}
            startIcon={<Add />}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '24px',
              px: { xs: 4, sm: 3 },
              py: { xs: 2, sm: 1.5 },
              textTransform: 'none',
              fontSize: { xs: '18px', sm: '16px' },
              minHeight: { xs: '56px', sm: 'auto' },
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Create Schedule
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {scheduleGroups.map((group) => (
            <GroupedScheduleCard
              key={group.id}
              group={group}
              currentDay={currentDay}
              displayCelsius={displayCelsius}
              onToggleSchedule={handleToggleSchedule}
              onEditDay={onEditDay}
              onEditGroup={onEditGroup}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
