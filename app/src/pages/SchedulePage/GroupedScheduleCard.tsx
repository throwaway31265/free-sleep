import { DayOfWeek } from '@api/schedulesSchema.ts';
import { Delete, Edit, Schedule as ScheduleIcon } from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatGroupedDays, ScheduleGroup } from './scheduleGrouping.ts';

type GroupedScheduleCardProps = {
  group: ScheduleGroup;
  currentDay: DayOfWeek;
  displayCelsius: boolean;
  onToggleSchedule: (days: DayOfWeek[]) => void;
  onEditDay: (dayIndex: number) => void;
  onEditGroup: (dayIndices: number[]) => void;
};

export default function GroupedScheduleCard({
  group,
  currentDay,
  displayCelsius,
  onToggleSchedule,
  onEditDay,
  onEditGroup,
}: GroupedScheduleCardProps) {
  const { schedule, days, dayIndices } = group;
  const isEnabled = schedule.power.enabled;
  const isCurrentDayIncluded = days.includes(currentDay);
  const groupLabel = formatGroupedDays(days);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const formatTemperature = (temp: number) => {
    if (displayCelsius) {
      return `${Math.round(((temp - 32) * 5) / 9)}°C`;
    }
    return `${temp}°F`;
  };

  const handleEditClick = () => {
    if (days.length === 1) {
      // Single day - edit directly
      onEditDay(dayIndices[0]);
    } else {
      // Multiple days - edit group directly
      onEditGroup(dayIndices);
    }
  };

  return (
    <>
      <Box
        sx={{
          width: '100%',
          backgroundColor: isEnabled
            ? isCurrentDayIncluded
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          border: isCurrentDayIncluded
            ? '2px solid rgba(255, 255, 255, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          opacity: isEnabled ? 1 : 0.6,
          p: { xs: 2, sm: 3 },
          color: '#fff',
          '&:hover': {
            backgroundColor: isEnabled
              ? isCurrentDayIncluded
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            gap: { xs: 2, sm: 0 },
          }}
        >
          {/* Left section: Days and schedule info */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2, sm: 3 },
              flex: 1,
            }}
          >
            {/* Days section */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: { xs: 'auto', sm: 200 },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <ScheduleIcon fontSize="small" sx={{ color: '#fff' }} />
              <Typography
                variant="h6"
                sx={{
                  minWidth: 'fit-content',
                  color: '#fff',
                  fontWeight: 'normal',
                  fontSize: { xs: '16px', sm: '18px' },
                  flex: 1,
                }}
              >
                {groupLabel}
              </Typography>

              {/* Current day indicator for single days */}
              {days.length === 1 && isCurrentDayIncluded && (
                <Chip
                  label="Today"
                  size="small"
                  sx={{
                    ml: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              )}
            </Box>

            {/* Schedule details */}
            {isEnabled ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3 },
                  flex: 1,
                  width: { xs: '100%', sm: 'auto' },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: { xs: '13px', sm: '14px' },
                    wordBreak: 'break-word',
                  }}
                >
                  <strong style={{ color: '#fff' }}>Power:</strong>{' '}
                  {schedule.power.on} - {schedule.power.off}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: { xs: '13px', sm: '14px' },
                    wordBreak: 'break-word',
                  }}
                >
                  <strong style={{ color: '#fff' }}>Temp:</strong>{' '}
                  {formatTemperature(schedule.power.onTemperature)}
                </Typography>

                {schedule.alarm.enabled && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: { xs: '13px', sm: '14px' },
                      wordBreak: 'break-word',
                    }}
                  >
                    <strong style={{ color: '#fff' }}>Alarm:</strong>{' '}
                    {schedule.alarm.time}
                  </Typography>
                )}

                {Object.keys(schedule.temperatures).length > 0 && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: { xs: '13px', sm: '14px' },
                      wordBreak: 'break-word',
                    }}
                  >
                    <strong style={{ color: '#fff' }}>Temp Changes:</strong>{' '}
                    {Object.keys(schedule.temperatures).length}
                  </Typography>
                )}

                {Object.keys(schedule.elevations).length > 0 && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: { xs: '13px', sm: '14px' },
                      wordBreak: 'break-word',
                    }}
                  >
                    <strong style={{ color: '#fff' }}>Elevations:</strong>{' '}
                    {Object.keys(schedule.elevations).length}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: { xs: '13px', sm: '14px' },
                }}
              >
                No schedule
              </Typography>
            )}
          </Box>

          {/* Right section: Controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'flex-end', sm: 'center' },
              gap: { xs: 3, sm: 2 },
              alignSelf: { xs: 'flex-end', sm: 'center' },
            }}
          >
            <IconButton
              size={isMobile ? 'medium' : 'small'}
              onClick={() => onToggleSchedule(days)}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: { xs: '44px', sm: '36px' },
                height: { xs: '44px', sm: '36px' },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Delete fontSize={isMobile ? 'medium' : 'small'} />
            </IconButton>
            <IconButton
              size={isMobile ? 'medium' : 'small'}
              onClick={handleEditClick}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: { xs: '44px', sm: '36px' },
                height: { xs: '44px', sm: '36px' },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Edit fontSize={isMobile ? 'medium' : 'small'} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </>
  );
}
