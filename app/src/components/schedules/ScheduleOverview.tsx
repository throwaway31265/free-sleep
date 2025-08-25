import { postSchedules } from '@api/schedules';
import type { DayOfWeek, Schedules } from '@api/schedulesSchema';
import { useSettings } from '@api/settings';
import { Add, Insights, Schedule, TrendingUp } from '@mui/icons-material';
import {
  Box,
  Button,
  Fab,
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
  const { side, setIsUpdating, setError, clearError } = useAppStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const sideSchedules = schedules?.[side];

  // Add defensive check for undefined schedules
  if (!sideSchedules) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          color: '#fff',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          No schedules available
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Unable to load schedule data. Please try refreshing the page.
        </Typography>
      </Box>
    );
  }

  // Group all schedules (both enabled and disabled)
  const allScheduleGroups = groupSchedulesBySettings(sideSchedules);

  // Separate enabled and disabled groups
  const enabledGroups = allScheduleGroups.filter(
    (group) => group.schedule?.power?.enabled,
  );
  const disabledGroups = allScheduleGroups.filter(
    (group) => !group.schedule?.power?.enabled,
  );

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
    clearError(); // Clear any previous errors

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
    } catch (error: any) {
      console.error('Failed to toggle schedule:', error);

      // Extract meaningful error message for user
      let errorMessage = `Failed to ${newEnabledState ? 'enable' : 'disable'} schedule`;

      if (error.response?.status === 400) {
        if (error.response?.data?.details) {
          errorMessage = `Invalid schedule: ${error.response.data.details}`;
        } else {
          errorMessage =
            'Invalid schedule settings. Please check the configuration and try again.';
        }
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMessage =
          'Network error. Please check your connection and try again.';
      }

      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2.5, sm: 3, md: 4 },
        bgcolor: '#000',
        color: '#fff',
        px: { xs: 2, sm: 3, md: 4, lg: 6 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: { xs: 2, sm: 2, md: 0 },
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}
        >
          <Box
            sx={{
              p: { xs: 1, md: 1.5 },
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Schedule
              sx={{
                color: '#fff',
                fontSize: { xs: '24px', md: '28px' },
              }}
            />
          </Box>
          <Box>
            <Typography
              variant={isMobile ? 'h5' : isTablet ? 'h4' : 'h3'}
              sx={{
                color: '#fff',
                fontWeight: '600',
                fontSize: {
                  xs: '1.5rem',
                  sm: '2rem',
                  md: '2.25rem',
                  lg: '2.5rem',
                },
                lineHeight: 1.2,
              }}
            >
              Schedule Overview
            </Typography>
            {(enabledGroups.length > 0 || disabledGroups.length > 0) && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '12px', sm: '14px', md: '15px' },
                  mt: 0.5,
                }}
              >
                {enabledGroups.length + disabledGroups.length} schedule
                {enabledGroups.length + disabledGroups.length !== 1 ? 's' : ''}
                {enabledGroups.length > 0 && `• ${enabledGroups.length} active`}
                {disabledGroups.length > 0 &&
                  ` • ${disabledGroups.length} disabled`}
              </Typography>
            )}
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreateNew}
          fullWidth={isMobile}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            borderRadius: '16px',
            px: { xs: 2, sm: 2, md: 2 },
            py: { xs: 1, sm: 1, md: 1 },
            textTransform: 'none',
            fontSize: { xs: '16px', sm: '15px', md: '15px' },
            fontWeight: 'normal',
            border: 'none',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          Create Schedule
        </Button>
      </Box>

      {enabledGroups.length === 0 && disabledGroups.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 4, sm: 6, md: 8, lg: 10 },
            px: { xs: 2, sm: 4, md: 6 },
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: { lg: '800px' },
            mx: { lg: 'auto' },
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              mb: 2,
              fontSize: { xs: '1.25rem', sm: '1.3rem', md: '1.4rem' },
            }}
          >
            No Schedules Enabled
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              mb: 3,
              fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
              maxWidth: '500px',
              mx: 'auto',
            }}
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
              borderRadius: '16px',
              px: { xs: 2, sm: 2, md: 2 },
              py: { xs: 1, sm: 1, md: 1 },
              textTransform: 'none',
              fontSize: { xs: '16px', sm: '15px', md: '15px' },
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, sm: 2.5, md: 3 },
            maxWidth: { lg: '1200px' },
            mx: { lg: 'auto' },
          }}
        >
          {/* Quick stats */}
          {(enabledGroups.length > 0 || disabledGroups.length > 0) && (
            <Box
              sx={{
                display: 'flex',
                gap: { xs: 1, sm: 2 },
                mb: { xs: 1, sm: 2 },
                flexWrap: 'wrap',
              }}
            >
              {enabledGroups.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: { xs: 2, sm: 2.5 },
                    py: { xs: 1, sm: 1.5 },
                    backgroundColor: 'rgba(76, 175, 80, 0.15)',
                    borderRadius: '12px',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                  }}
                >
                  <Insights sx={{ fontSize: 16, color: '#4CAF50' }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#4CAF50',
                      fontSize: { xs: '11px', sm: '12px' },
                      fontWeight: '600',
                    }}
                  >
                    {enabledGroups.length} ACTIVE
                  </Typography>
                </Box>
              )}

              {disabledGroups.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: { xs: 2, sm: 2.5 },
                    py: { xs: 1, sm: 1.5 },
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Insights
                    sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.6)' }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: { xs: '11px', sm: '12px' },
                      fontWeight: '600',
                    }}
                  >
                    {disabledGroups.length} DISABLED
                  </Typography>
                </Box>
              )}

              {enabledGroups.length > 0 && currentDayIndex >= 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: { xs: 2, sm: 2.5 },
                    py: { xs: 1, sm: 1.5 },
                    backgroundColor: 'rgba(33, 150, 243, 0.15)',
                    borderRadius: '12px',
                    border: '1px solid rgba(33, 150, 243, 0.3)',
                  }}
                >
                  <TrendingUp sx={{ fontSize: 16, color: '#2196F3' }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#2196F3',
                      fontSize: { xs: '11px', sm: '12px' },
                      fontWeight: '600',
                    }}
                  >
                    TODAY: {LOWERCASE_DAYS[currentDayIndex].toUpperCase()}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          {/* Enabled Schedules */}
          {enabledGroups.length > 0 && (
            <>
              <Typography
                variant="h6"
                sx={{
                  color: '#fff',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                  fontWeight: '600',
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                  }}
                />
                Active Schedules
              </Typography>
              {enabledGroups.map((group) => (
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
            </>
          )}

          {/* Disabled Schedules */}
          {disabledGroups.length > 0 && (
            <>
              <Typography
                variant="h6"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                  fontWeight: '600',
                  mb: 1,
                  mt: enabledGroups.length > 0 ? 3 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  }}
                />
                Disabled Schedules
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: { xs: '13px', sm: '14px' },
                  mb: 2,
                }}
              >
                These schedules are configured but not running. Toggle them on
                to activate.
              </Typography>
              {disabledGroups.map((group) => (
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
            </>
          )}
        </Box>
      )}

      {/* Floating Action Button for quick schedule creation */}
      <Fab
        onClick={onCreateNew}
        sx={{
          position: 'fixed',
          bottom: { xs: 96, md: 82 }, // Account for mobile bottom navigation (80px) + padding
          right: { xs: 16, sm: 32 },
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            transform: 'scale(1.1)',
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
        }}
        size={isMobile ? 'large' : 'medium'}
      >
        <Add sx={{ fontSize: { xs: 28, sm: 24 } }} />
      </Fab>
    </Box>
  );
}
