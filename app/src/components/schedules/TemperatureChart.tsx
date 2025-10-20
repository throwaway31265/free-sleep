import type { DailySchedule } from '@api/schedulesSchema';
import { Box, Tooltip, Typography } from '@mui/material';

type TemperatureChartProps = {
  schedule: DailySchedule;
  displayCelsius: boolean;
  compact?: boolean;
};

export default function TemperatureChart({
  schedule,
  displayCelsius,
  compact = false,
}: TemperatureChartProps) {
  const formatTemp = (temp: number) => {
    if (displayCelsius) {
      return `${Math.round(((temp - 32) * 5) / 9)}°C`;
    }
    return `${temp}°F`;
  };

  // Build timeline: power on -> temp changes -> power off
  const timeline: Array<{ time: string; temp: number | null; label: string }> = [];

  // Add power on
  timeline.push({
    time: schedule.power.on,
    temp: schedule.power.onTemperature,
    label: 'Power On',
  });

  // Add temperature changes
  Object.entries(schedule.temperatures)
    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
    .forEach(([time, temp]) => {
      timeline.push({
        time,
        temp,
        label: 'Temp Change',
      });
    });

  // Add power off
  timeline.push({
    time: schedule.power.off,
    temp: null,
    label: 'Power Off',
  });

  if (timeline.length <= 2 && Object.keys(schedule.temperatures).length === 0) {
    // No temperature changes, show simple display
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: compact ? '13px' : '14px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: '500',
          }}
        >
          {formatTemp(schedule.power.onTemperature)}
        </Typography>
        <Typography
          sx={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          constant
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      {/* Timeline visualization */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          position: 'relative',
        }}
      >
        {timeline.map((point, index) => {
          if (index === timeline.length - 1) {
            // Last point (power off)
            return (
              <Tooltip
                key={index}
                title={`${point.label} at ${point.time}`}
                arrow
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  {index > 0 && (
                    <Box
                      sx={{
                        width: compact ? '16px' : '20px',
                        height: '2px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      width: compact ? '6px' : '8px',
                      height: compact ? '6px' : '8px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.4)',
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                    }}
                  />
                </Box>
              </Tooltip>
            );
          }

          return (
            <Tooltip
              key={index}
              title={`${point.label}: ${formatTemp(point.temp!)} at ${point.time}`}
              arrow
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {index > 0 && (
                  <Box
                    sx={{
                      width: compact ? '16px' : '20px',
                      height: '2px',
                      background:
                        'linear-gradient(90deg, rgba(76, 175, 80, 0.6) 0%, rgba(76, 175, 80, 0.3) 100%)',
                    }}
                  />
                )}
                <Box
                  sx={{
                    width: compact ? '8px' : '10px',
                    height: compact ? '8px' : '10px',
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                    border: '2px solid rgba(76, 175, 80, 0.4)',
                    boxShadow: '0 0 8px rgba(76, 175, 80, 0.4)',
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Temperature values */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {timeline
          .filter((point) => point.temp !== null)
          .map((point, index) => (
            <Typography
              key={index}
              sx={{
                fontSize: compact ? '11px' : '12px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: '500',
              }}
            >
              {formatTemp(point.temp!)}
              {index < timeline.filter((p) => p.temp !== null).length - 1 && (
                <span style={{ margin: '0 4px', opacity: 0.5 }}>→</span>
              )}
            </Typography>
          ))}
      </Box>
    </Box>
  );
}
