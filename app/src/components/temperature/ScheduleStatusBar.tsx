import type { DailySchedule, DayOfWeek, SchedulesV2 } from '@api/schedulesSchema';
import { useSettings } from '@api/settings';
import { AccessTime, CheckCircle } from '@mui/icons-material';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useAppStore } from '@state/appStore';
import { useEffect, useState } from 'react';
import {
  formatCountdown,
  formatTime12Hour,
  getTimeUntilScheduleStarts,
  isScheduleCurrentlyRunning,
  type ScheduleStartInfo,
} from '@/utils/scheduleUtils';

interface ScheduleStatusBarProps {
  schedules: SchedulesV2;
  currentDay: DayOfWeek;
}

export default function ScheduleStatusBar({
  schedules,
  currentDay,
}: ScheduleStatusBarProps) {
  const { side } = useAppStore();
  const { data: settings } = useSettings();
  const [_currentTime, setCurrentTime] = useState(Date.now());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const sideSchedules = schedules[side];
  const isBasicMode = sideSchedules.mode === 'basic';

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getCurrentSchedule = (): DailySchedule | undefined => {
    if (isBasicMode) {
      const activeId = sideSchedules.activeScheduleId;
      if (activeId && sideSchedules.schedules?.[activeId]) {
        return sideSchedules.schedules[activeId].data;
      }
      return undefined;
    } else {
      const scheduleId = sideSchedules.assignments?.[currentDay];
      if (scheduleId && sideSchedules.schedules?.[scheduleId]) {
        return sideSchedules.schedules[scheduleId].data;
      }
      return sideSchedules[currentDay];
    }
  };

  const currentSchedule = getCurrentSchedule();

  if (!currentSchedule || !currentSchedule.power.enabled) {
    return null;
  }

  const isRunning = isScheduleCurrentlyRunning(
    currentSchedule,
    settings?.timeZone || null,
  );
  const startInfo: ScheduleStartInfo | null = !isRunning
    ? getTimeUntilScheduleStarts(currentSchedule, settings?.timeZone || null)
    : null;

  if (!isRunning && !startInfo) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: isRunning
          ? 'rgba(76, 175, 80, 0.08)'
          : 'rgba(33, 150, 243, 0.08)',
        border: '1px solid',
        borderColor: isRunning
          ? 'rgba(76, 175, 80, 0.3)'
          : 'rgba(33, 150, 243, 0.3)',
        borderRadius: '12px',
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'all 0.3s ease',
        animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
        '@keyframes pulse': {
          '0%, 100%': {
            borderColor: isRunning
              ? 'rgba(76, 175, 80, 0.3)'
              : 'rgba(33, 150, 243, 0.3)',
          },
          '50%': {
            borderColor: isRunning
              ? 'rgba(76, 175, 80, 0.5)'
              : 'rgba(33, 150, 243, 0.5)',
          },
        },
      }}
    >
      {isRunning ? (
        <CheckCircle
          sx={{
            fontSize: 20,
            color: '#4CAF50',
            flexShrink: 0,
          }}
        />
      ) : (
        <AccessTime
          sx={{
            fontSize: 20,
            color: '#2196F3',
            flexShrink: 0,
          }}
        />
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { xs: 0.5, sm: 1 },
        }}
      >
        {isRunning ? (
          <>
            <Typography
              variant="body2"
              sx={{
                color: '#fff',
                fontWeight: 600,
                fontSize: { xs: '13px', sm: '14px' },
              }}
            >
              Schedule active
            </Typography>
            {!isMobile && (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '14px',
                  }}
                >
                  •
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '13px',
                  }}
                >
                  Bedtime {formatTime12Hour(currentSchedule.power.on)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '14px',
                  }}
                >
                  •
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '13px',
                  }}
                >
                  Wake {formatTime12Hour(currentSchedule.alarm.time)}
                </Typography>
              </>
            )}
          </>
        ) : (
          <>
            <Typography
              variant="body2"
              sx={{
                color: '#fff',
                fontWeight: 600,
                fontSize: { xs: '13px', sm: '14px' },
              }}
            >
              Starts in {formatCountdown(startInfo?.minutesUntilStart || 0)}
            </Typography>
            {!isMobile && (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '14px',
                  }}
                >
                  •
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '13px',
                  }}
                >
                  Bedtime {formatTime12Hour(currentSchedule.power.on)}
                </Typography>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
