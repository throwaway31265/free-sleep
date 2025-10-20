import type { DeviceStatus } from '@api/deviceStatusSchema';
import type { Settings } from '@api/settingsSchema';
import { Box, Typography } from '@mui/material';

interface SideStatusIndicatorsProps {
  deviceStatus: DeviceStatus;
  settings: Settings;
}

export default function SideStatusIndicators({
  deviceStatus,
  settings,
}: SideStatusIndicatorsProps) {
  const isLinked = settings.linkBothSides;
  const leftActive = deviceStatus.left.isOn;
  const rightActive = deviceStatus.right.isOn;

  // When linked, both sides should show the same status
  // Show as active if either side is actually on
  const leftIsOn = isLinked ? (leftActive || rightActive) : leftActive;
  const rightIsOn = isLinked ? (leftActive || rightActive) : rightActive;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {settings.left.name}
        </Typography>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: leftIsOn
              ? '#4CAF50'
              : 'rgba(255, 255, 255, 0.3)',
            boxShadow: leftIsOn
              ? '0 0 8px rgba(76, 175, 80, 0.6)'
              : 'none',
            transition: 'all 0.3s ease',
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {settings.right.name}
        </Typography>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: rightIsOn
              ? '#4CAF50'
              : 'rgba(255, 255, 255, 0.3)',
            boxShadow: rightIsOn
              ? '0 0 8px rgba(76, 175, 80, 0.6)'
              : 'none',
            transition: 'all 0.3s ease',
          }}
        />
      </Box>
    </Box>
  );
}
