import type { DayOfWeek } from '@api/schedulesSchema';
import {
  AccessTime,
  Alarm,
  Delete,
  Edit,
  Hotel,
  PowerSettingsNew,
  Thermostat,
  VisibilityOff,
} from '@mui/icons-material';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import DayStrip from './DayStrip.tsx';
import type { ScheduleGroup } from './scheduleGrouping.ts';
import TemperatureChart from './TemperatureChart.tsx';

type GroupedScheduleCardProps = {
  group: ScheduleGroup;
  currentDay: DayOfWeek;
  displayCelsius: boolean;
  onToggleSchedule: (days: DayOfWeek[]) => void;
  onEditDay: (dayIndex: number) => void;
  onEditGroup: (dayIndices: number[]) => void;
  onDeleteSchedule: (scheduleId: string, days: DayOfWeek[]) => void;
  compact?: boolean;
};

export default function GroupedScheduleCard({
  group,
  currentDay,
  displayCelsius,
  onToggleSchedule,
  onEditDay,
  onEditGroup,
  onDeleteSchedule,
  compact = true,
}: GroupedScheduleCardProps) {
  const { schedule, days, dayIndices } = group;
  const isEnabled = schedule.power.enabled;
  const isCurrentDayIncluded = days.includes(currentDay);

  const handleEditClick = () => {
    if (days.length === 1) {
      onEditDay(dayIndices[0]);
    } else {
      onEditGroup(dayIndices);
    }
  };

  // Determine accent color based on schedule ID (simple hash)
  const getAccentColor = (id: string) => {
    const colors = [
      'rgba(76, 175, 80, 0.4)',   // Green
      'rgba(33, 150, 243, 0.4)',  // Blue
      'rgba(156, 39, 176, 0.4)',  // Purple
      'rgba(255, 152, 0, 0.4)',   // Orange
      'rgba(233, 30, 99, 0.4)',   // Pink
    ];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const accentColor = getAccentColor(group.scheduleId);

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: isEnabled
          ? isCurrentDayIncluded
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.08)'
          : 'rgba(255, 255, 255, 0.04)',
        borderRadius: '16px',
        border: `1px solid ${isCurrentDayIncluded ? accentColor : 'rgba(255, 255, 255, 0.1)'}`,
        opacity: isEnabled ? 1 : 0.6,
        p: compact ? 2.5 : 4,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          backgroundColor: isEnabled
            ? isCurrentDayIncluded
              ? 'rgba(255, 255, 255, 0.16)'
              : 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.06)',
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${accentColor}`,
        },
        '&::before': isCurrentDayIncluded
          ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
              zIndex: 1,
            }
          : {},
      }}
    >
      {/* Header: Days + Actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DayStrip
            days={days}
            currentDay={currentDay}
            compact={compact}
            accentColor={accentColor}
          />
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
          <Tooltip title={isEnabled ? 'Disable' : 'Enable'} arrow>
            <IconButton
              size="small"
              onClick={() => onToggleSchedule(days)}
              sx={{
                color: '#fff',
                backgroundColor: isEnabled
                  ? 'rgba(244, 67, 54, 0.15)'
                  : 'rgba(76, 175, 80, 0.15)',
                width: '32px',
                height: '32px',
                '&:hover': {
                  backgroundColor: isEnabled
                    ? 'rgba(244, 67, 54, 0.25)'
                    : 'rgba(76, 175, 80, 0.25)',
                },
              }}
            >
              {isEnabled ? (
                <VisibilityOff sx={{ fontSize: 18 }} />
              ) : (
                <PowerSettingsNew sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit" arrow>
            <IconButton
              size="small"
              onClick={handleEditClick}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                width: '32px',
                height: '32px',
                '&:hover': {
                  backgroundColor: 'rgba(33, 150, 243, 0.25)',
                },
              }}
            >
              <Edit sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" arrow>
            <IconButton
              size="small"
              onClick={() => onDeleteSchedule(group.scheduleId, days)}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                width: '32px',
                height: '32px',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.25)',
                },
              }}
            >
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Body: Schedule Details in Grid */}
      {isEnabled ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: compact
              ? { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }
              : '1fr',
            gap: 2,
          }}
        >
          {/* Power Schedule Column */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 0.5,
              }}
            >
              <AccessTime sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.6)' }} />
              <Typography
                sx={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Power Schedule
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                <strong>On:</strong> {schedule.power.on}
              </Typography>
              <Typography
                sx={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                <strong>Off:</strong> {schedule.power.off}
              </Typography>
            </Box>
          </Box>

          {/* Temperature Column */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 0.5,
              }}
            >
              <Thermostat sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.6)' }} />
              <Typography
                sx={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Temperature
              </Typography>
            </Box>
            <TemperatureChart
              schedule={schedule}
              displayCelsius={displayCelsius}
              compact={compact}
            />
          </Box>

          {/* Features Column */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 0.5,
              }}
            >
              <Hotel sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.6)' }} />
              <Typography
                sx={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Features
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {schedule.alarm.enabled && (
                <Chip
                  icon={<Alarm sx={{ fontSize: 14 }} />}
                  label={`Alarm ${schedule.alarm.time}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 152, 0, 0.15)',
                    color: '#FFA726',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    fontSize: '11px',
                    height: '24px',
                    '& .MuiChip-icon': {
                      color: '#FFA726',
                    },
                  }}
                />
              )}
              {Object.keys(schedule.elevations).length > 0 && (
                <Chip
                  icon={<Hotel sx={{ fontSize: 14 }} />}
                  label={`${Object.keys(schedule.elevations).length} elevation${Object.keys(schedule.elevations).length > 1 ? 's' : ''}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(156, 39, 176, 0.15)',
                    color: '#BA68C8',
                    border: '1px solid rgba(156, 39, 176, 0.3)',
                    fontSize: '11px',
                    height: '24px',
                    '& .MuiChip-icon': {
                      color: '#BA68C8',
                    },
                  }}
                />
              )}
              {Object.keys(schedule.elevations).length === 0 &&
                !schedule.alarm.enabled && (
                  <Typography
                    sx={{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontStyle: 'italic',
                    }}
                  >
                    None configured
                  </Typography>
                )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px',
            fontStyle: 'italic',
          }}
        >
          Schedule disabled
        </Typography>
      )}
    </Box>
  );
}
