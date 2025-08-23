import type { Settings } from '@api/settingsSchema.ts';
import { Box, FormControlLabel, TextField, Typography } from '@mui/material';
import Switch from '@mui/material/Switch';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type PrimePodScheduleProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function DailyPriming({
  settings,
  updateSettings,
}: PrimePodScheduleProps) {
  const { isUpdating } = useAppStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControlLabel
        control={
          <Switch
            disabled={isUpdating}
            checked={settings?.primePodDaily?.enabled || false}
            onChange={(event) =>
              updateSettings({
                primePodDaily: { enabled: event.target.checked },
              })
            }
          />
        }
        label="Automatic Daily Priming"
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ ml: 4, mt: -1 }}
      >
        Automatically prime the system daily to prevent air bubbles and maintain
        water flow
      </Typography>
      {settings?.primePodDaily?.enabled && (
        <TextField
          label="Priming Time"
          type="time"
          value={settings?.primePodDaily?.time || '12:00'}
          onChange={(e) =>
            updateSettings({ primePodDaily: { time: e.target.value } })
          }
          disabled={isUpdating}
          sx={{ ml: 4, maxWidth: '200px' }}
          helperText="Choose when to run daily priming cycle"
        />
      )}
    </Box>
  );
}
