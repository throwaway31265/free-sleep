import type { DayOfWeek } from '@api/schedulesSchema';
import { Box, Typography } from '@mui/material';
import { DAY_ABBREVIATIONS, DAYS_ORDER } from './scheduleGrouping.ts';

type DayStripProps = {
  days: DayOfWeek[];
  currentDay?: DayOfWeek;
  compact?: boolean;
  accentColor?: string;
};

export default function DayStrip({
  days,
  currentDay,
  compact = false,
  accentColor = 'rgba(255, 255, 255, 0.3)',
}: DayStripProps) {
  const daysSet = new Set(days);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: compact ? 0.5 : 1,
        alignItems: 'center',
      }}
    >
      {DAYS_ORDER.map((day) => {
        const isActive = daysSet.has(day);
        const isCurrent = day === currentDay;
        const dayAbbr = DAY_ABBREVIATIONS[day];

        return (
          <Box
            key={day}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: compact ? '28px' : '32px',
              height: compact ? '28px' : '32px',
              borderRadius: '8px',
              backgroundColor: isActive
                ? isCurrent
                  ? accentColor
                  : 'rgba(255, 255, 255, 0.15)'
                : 'rgba(255, 255, 255, 0.05)',
              border: isActive
                ? isCurrent
                  ? `2px solid ${accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.2)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <Typography
              sx={{
                fontSize: compact ? '10px' : '11px',
                fontWeight: isActive ? '600' : '400',
                color: isActive
                  ? '#fff'
                  : 'rgba(255, 255, 255, 0.4)',
                lineHeight: 1,
              }}
            >
              {dayAbbr}
            </Typography>
            {isCurrent && isActive && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
