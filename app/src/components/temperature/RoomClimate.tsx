import ThermostatIcon from '@mui/icons-material/Thermostat';
import { Box, Paper, Typography } from '@mui/material';
import type { DeviceStatus } from '@api/deviceStatusSchema';
import type { Settings } from '@api/settingsSchema';
import moment from 'moment';

interface RoomClimateProps {
  deviceStatus: DeviceStatus;
  settings: Settings;
}

export default function RoomClimate({ deviceStatus, settings }: RoomClimateProps) {
  const { roomClimate } = deviceStatus;

  if (!roomClimate || roomClimate.temperatureC === undefined) {
    return null;
  }

  const isCelsius = settings.temperatureFormat === 'celsius';
  const tempC = roomClimate.temperatureC;
  const tempF = (tempC * 9 / 5) + 32;
  const displayTemp = isCelsius ? tempC : tempF;
  const unit = isCelsius ? '°C' : '°F';

  return (
    <Paper
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <ThermostatIcon sx={{ fontSize: 32, color: 'primary.main' }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Room Climate
        </Typography>
        <Typography variant="h6">
          {displayTemp.toFixed(1)}{unit}
          {roomClimate.humidity !== undefined && (
            <> • {roomClimate.humidity.toFixed(1)}% humidity</>
          )}
        </Typography>
        {roomClimate.timestamp && (
          <Typography variant="caption" color="text.secondary">
            Updated {moment.unix(roomClimate.timestamp).fromNow()}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
