import type { DayOfWeek } from '@api/schedulesSchema';
import { Edit, Schedule as ScheduleIcon, PowerSettingsNew, VisibilityOff, Info } from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatGroupedDays, type ScheduleGroup } from './scheduleGrouping.ts';
import { useSchedules } from '@api/schedules';
import { useAppStore } from '@state/appStore.tsx';

type GroupedScheduleCardProps = {
  group: ScheduleGroup;
  currentDay: DayOfWeek;
  displayCelsius: boolean;
  onToggleSchedule: (days: DayOfWeek[]) => void;
  onEditDay: (dayIndex: number) => void;
  onEditGroup: (dayIndices: number[]) => void;
};

// Helper function to detect variations within a group
const analyzeGroupVariations = (group: ScheduleGroup, allSchedules: Record<DayOfWeek, any>) => {
  const { days } = group;
  const variations: { type: string; description: string; details: Record<string, string[]> }[] = [];
  
  if (days.length <= 1) return variations; // No variations in single-day groups
  
  // Check elevation variations
  const elevationVariations: Record<string, string[]> = {};
  days.forEach(day => {
    const daySchedule = allSchedules[day];
    if (daySchedule?.elevations) {
      Object.entries(daySchedule.elevations).forEach(([time, elevation]: [string, any]) => {
        const preset = elevation?.preset || 'unknown';
        const key = `${time}: ${preset}`;
        if (!elevationVariations[key]) elevationVariations[key] = [];
        elevationVariations[key].push(day);
      });
    }
  });
  
  // If we have elevation variations, add them
  const uniqueElevationSettings = Object.keys(elevationVariations);
  if (uniqueElevationSettings.length > 1) {
    variations.push({
      type: 'elevations',
      description: 'Elevation presets vary by day',
      details: elevationVariations
    });
  }
  
  // Check temperature variations
  const temperatureVariations: Record<string, string[]> = {};
  days.forEach(day => {
    const daySchedule = allSchedules[day];
    if (daySchedule?.temperatures) {
      Object.entries(daySchedule.temperatures).forEach(([time, temp]: [string, any]) => {
        const key = `${time}: ${temp}°`;
        if (!temperatureVariations[key]) temperatureVariations[key] = [];
        temperatureVariations[key].push(day);
      });
    }
  });
  
  const uniqueTemperatureSettings = Object.keys(temperatureVariations);
  if (uniqueTemperatureSettings.length > 1) {
    variations.push({
      type: 'temperatures',
      description: 'Temperature schedules vary by day', 
      details: temperatureVariations
    });
  }
  
  return variations;
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
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // Get all schedules to analyze variations
  const { data: schedules } = useSchedules();
  const { side } = useAppStore();
  const sideSchedules = schedules?.[side];
  
  // Analyze variations within this group
  const variations = sideSchedules ? analyzeGroupVariations(group, sideSchedules) : [];

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
          p: { xs: 2, sm: 3, md: 4, lg: 5 },
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: isEnabled
              ? isCurrentDayIncluded
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          },
          '&::before': isCurrentDayIncluded ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 100%)',
            zIndex: 1,
          } : {},
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            gap: { xs: 2, sm: 3, md: 0 },
          }}
        >
          {/* Left section: Days and schedule info */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', sm: 'flex-start', md: 'center' },
              gap: { xs: 2, sm: 2, md: 3, lg: 4 },
              flex: 1,
            }}
          >
            {/* Days section */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, md: 1.5 },
                minWidth: { xs: 'auto', sm: 'auto', md: 220, lg: 250 },
                width: { xs: '100%', sm: '100%', md: 'auto' },
              }}
            >
              <ScheduleIcon fontSize="small" sx={{ color: '#fff' }} />
              <Typography
                variant="h6"
                sx={{
                  minWidth: 'fit-content',
                  color: '#fff',
                  fontWeight: 'normal',
                  fontSize: { xs: '16px', sm: '18px', md: '19px', lg: '20px' },
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
                  flexDirection: { xs: 'column', sm: 'column', md: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'flex-start', md: 'center' },
                  gap: { xs: 1, sm: 1.5, md: 3, lg: 4 },
                  flex: 1,
                  width: { xs: '100%', sm: '100%', md: 'auto' },
                  flexWrap: { md: 'wrap', lg: 'nowrap' },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: { xs: '13px', sm: '14px', md: '15px', lg: '16px' },
                    wordBreak: 'break-word',
                    minWidth: { md: 'fit-content' },
                  }}
                >
                  <strong style={{ color: '#fff' }}>Power:</strong>{' '}
                  {schedule.power.on} - {schedule.power.off}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: { xs: '13px', sm: '14px', md: '15px', lg: '16px' },
                    wordBreak: 'break-word',
                    minWidth: { md: 'fit-content' },
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
                
                {/* Variation indicator */}
                {variations.length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    mt: 2,
                    p: 1.5,
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    gridColumn: '1 / -1', // Full width in grid
                  }}>
                    <Info sx={{ fontSize: 16, color: '#FFC107' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#FFC107',
                          fontSize: { xs: '12px', sm: '13px' },
                          fontWeight: '600',
                          mb: 0.5,
                        }}
                      >
                        Schedule varies by day
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255, 193, 7, 0.8)',
                          fontSize: { xs: '11px', sm: '12px' },
                          display: 'block',
                        }}
                      >
                        {variations.map((v, i) => (
                          <span key={i}>
                            {v.description}
                            {i < variations.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </Typography>
                      
                      {/* Detailed breakdown */}
                      <Box sx={{ mt: 1 }}>
                        {variations.map((variation, idx) => (
                          <Box key={idx} sx={{ mb: idx < variations.length - 1 ? 1 : 0 }}>
                            {Object.entries(variation.details).map(([setting, days]) => (
                              <Typography 
                                key={setting} 
                                variant="caption" 
                                sx={{ 
                                  display: 'block', 
                                  color: 'rgba(255, 193, 7, 0.7)',
                                  fontSize: { xs: '10px', sm: '11px' },
                                  ml: 0.5,
                                }}
                              >
                                • {setting} → {days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                              </Typography>
                            ))}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: { xs: '13px', sm: '14px', md: '15px', lg: '16px' },
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
              justifyContent: { xs: 'flex-end', sm: 'flex-end', md: 'center' },
              gap: { xs: 3, sm: 2, md: 2, lg: 3 },
              alignSelf: { xs: 'flex-end', sm: 'flex-end', md: 'center' },
              mt: { xs: 0, sm: 2, md: 0 },
            }}
          >
            <IconButton
              size={isMobile ? 'medium' : isTablet ? 'medium' : 'small'}
              onClick={() => onToggleSchedule(days)}
              title={isEnabled ? 'Disable schedule' : 'Enable schedule'}
              sx={{
                color: '#fff',
                backgroundColor: isEnabled 
                  ? 'rgba(244, 67, 54, 0.15)'
                  : 'rgba(76, 175, 80, 0.15)',
                borderRadius: '12px',
                width: { xs: '44px', sm: '40px', md: '36px', lg: '40px' },
                height: { xs: '44px', sm: '40px', md: '36px', lg: '40px' },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isEnabled 
                  ? '1px solid rgba(244, 67, 54, 0.3)'
                  : '1px solid rgba(76, 175, 80, 0.3)',
                '&:hover': {
                  backgroundColor: isEnabled 
                    ? 'rgba(244, 67, 54, 0.25)'
                    : 'rgba(76, 175, 80, 0.25)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              {isEnabled ? (
                <VisibilityOff fontSize={isMobile ? 'medium' : isTablet ? 'medium' : 'small'} />
              ) : (
                <PowerSettingsNew fontSize={isMobile ? 'medium' : isTablet ? 'medium' : 'small'} />
              )}
            </IconButton>
            <IconButton
              size={isMobile ? 'medium' : isTablet ? 'medium' : 'small'}
              onClick={handleEditClick}
              title={days.length === 1 ? 'Edit day schedule' : 'Edit group schedule'}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                borderRadius: '12px',
                border: '1px solid rgba(33, 150, 243, 0.3)',
                width: { xs: '44px', sm: '40px', md: '36px', lg: '40px' },
                height: { xs: '44px', sm: '40px', md: '36px', lg: '40px' },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  backgroundColor: 'rgba(33, 150, 243, 0.25)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Edit fontSize={isMobile ? 'medium' : isTablet ? 'medium' : 'small'} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </>
  );
}
