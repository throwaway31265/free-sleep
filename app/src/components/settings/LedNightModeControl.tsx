import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus';
import type { Settings } from '@api/settingsSchema.ts';
import { useSettings } from '@api/settings';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import {
  Alert,
  Box,
  FormControlLabel,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import Switch from '@mui/material/Switch';
import { useAppStore } from '@state/appStore.tsx';
import { isNightTime } from '@/utils/scheduleUtils';
import { useEffect, useState } from 'react';
import type { DeepPartial } from 'ts-essentials';

type LedNightModeControlProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function LedNightModeControl({
  settings,
  updateSettings,
}: LedNightModeControlProps) {
  const { isUpdating } = useAppStore();
  const { data: appSettings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();

  const ledNightMode = settings?.ledNightMode || {
    enabled: false,
    dayBrightness: 50,
    nightBrightness: 10,
    nightStartTime: '22:00',
    nightEndTime: '07:00',
  };

  const timezone = appSettings?.timeZone || null;
  const currentBrightness = deviceStatus?.settings?.ledBrightness || 0;

  const isCurrentlyNightTime = ledNightMode.enabled
    ? isNightTime(ledNightMode.nightStartTime, ledNightMode.nightEndTime, timezone)
    : false;

  const expectedBrightness = isCurrentlyNightTime
    ? ledNightMode.nightBrightness
    : ledNightMode.dayBrightness;

  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState<number>(60);

  useEffect(() => {
    if (!ledNightMode.enabled || currentBrightness === expectedBrightness) {
      return;
    }

    // Update countdown every second
    const interval = setInterval(() => {
      // Calculate seconds until next minute boundary
      const now = new Date();
      const secondsIntoMinute = now.getSeconds();
      const secondsUntilNextMinute = 60 - secondsIntoMinute;
      setSecondsUntilUpdate(secondsUntilNextMinute);
    }, 1000);

    return () => clearInterval(interval);
  }, [ledNightMode.enabled, currentBrightness, expectedBrightness]);

  const handleDayBrightnessChange = async (newValue: number) => {
    // Update settings first
    updateSettings({
      ledNightMode: { dayBrightness: newValue },
    });

    // If day mode is currently active, immediately update device
    if (!isCurrentlyNightTime) {
      try {
        await postDeviceStatus({
          settings: { ledBrightness: newValue },
        });
      } catch (error) {
        console.error('Failed to update brightness:', error);
      }
    }
  };

  const handleNightBrightnessChange = async (newValue: number) => {
    // Update settings first
    updateSettings({
      ledNightMode: { nightBrightness: newValue },
    });

    // If night mode is currently active, immediately update device
    if (isCurrentlyNightTime) {
      try {
        await postDeviceStatus({
          settings: { ledBrightness: newValue },
        });
      } catch (error) {
        console.error('Failed to update brightness:', error);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
      <FormControlLabel
        control={
          <Switch
            disabled={isUpdating}
            checked={ledNightMode.enabled}
            onChange={(event) =>
              updateSettings({
                ledNightMode: { enabled: event.target.checked },
              })
            }
          />
        }
        label="LED Night Mode"
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ ml: 4, mt: -1 }}
      >
        Automatically adjust LED brightness based on time of day
      </Typography>

      {ledNightMode.enabled && (
        <Alert
          severity={isCurrentlyNightTime ? 'info' : 'warning'}
          icon={
            isCurrentlyNightTime ? (
              <Brightness4 fontSize="medium" />
            ) : (
              <Brightness7 fontSize="medium" />
            )
          }
          sx={{
            ml: 4,
            backgroundColor: isCurrentlyNightTime
              ? 'rgba(33, 150, 243, 0.15)'
              : 'rgba(255, 152, 0, 0.15)',
            border: '1px solid',
            borderColor: isCurrentlyNightTime
              ? 'rgba(33, 150, 243, 0.3)'
              : 'rgba(255, 152, 0, 0.3)',
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.5 }}
            >
              {isCurrentlyNightTime ? '🌙 Night Mode Active' : '☀️ Day Mode Active'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Current Brightness: {currentBrightness}%
              {currentBrightness !== expectedBrightness && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 1, fontStyle: 'italic', opacity: 0.8 }}
                >
                  (updating to {expectedBrightness}% in {secondsUntilUpdate}s)
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Switches to {isCurrentlyNightTime ? 'Day' : 'Night'} Mode at{' '}
              {isCurrentlyNightTime
                ? ledNightMode.nightEndTime
                : ledNightMode.nightStartTime}
            </Typography>
          </Box>
        </Alert>
      )}

      {ledNightMode.enabled && (
        <Box sx={{ ml: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Day Brightness Slider */}
          <Box>
            <Typography
              variant="body2"
              sx={{ mb: 1, fontWeight: 500, color: 'text.primary' }}
            >
              Day Brightness
            </Typography>
            <Slider
              value={ledNightMode.dayBrightness}
              onChange={(_, newValue) =>
                handleDayBrightnessChange(newValue as number)
              }
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
              disabled={isUpdating}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ width: '100%' }}
            />
          </Box>

          {/* Night Brightness Slider */}
          <Box>
            <Typography
              variant="body2"
              sx={{ mb: 1, fontWeight: 500, color: 'text.primary' }}
            >
              Night Brightness
            </Typography>
            <Slider
              value={ledNightMode.nightBrightness}
              onChange={(_, newValue) =>
                handleNightBrightnessChange(newValue as number)
              }
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
              disabled={isUpdating}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ width: '100%' }}
            />
          </Box>

          {/* Time Pickers */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Night Start Time"
              type="time"
              value={ledNightMode.nightStartTime}
              onChange={(e) =>
                updateSettings({
                  ledNightMode: { nightStartTime: e.target.value },
                })
              }
              disabled={isUpdating}
              sx={{ minWidth: '180px' }}
              helperText="When night mode begins"
            />
            <TextField
              label="Night End Time"
              type="time"
              value={ledNightMode.nightEndTime}
              onChange={(e) =>
                updateSettings({
                  ledNightMode: { nightEndTime: e.target.value },
                })
              }
              disabled={isUpdating}
              sx={{ minWidth: '180px' }}
              helperText="When day mode begins"
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontStyle: 'italic' }}
          >
            Note: Night mode works across midnight (e.g., 22:00 to 07:00).
            Brightness updates automatically every minute.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
