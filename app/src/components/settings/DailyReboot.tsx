import type { Settings } from '@api/settingsSchema.ts';
import { Box, FormControlLabel, Typography } from '@mui/material';
import Switch from '@mui/material/Switch';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type DailyRebootProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function DailyReboot({
  settings,
  updateSettings,
}: DailyRebootProps) {
  const { isUpdating } = useAppStore();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FormControlLabel
        control={
          <Switch
            disabled={isUpdating}
            checked={settings?.rebootDaily || false}
            onChange={(event) =>
              updateSettings({ rebootDaily: event.target.checked })
            }
          />
        }
        label="Automatic Daily Restart"
      />
      <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
        Automatically restart the system daily to maintain optimal performance
      </Typography>
    </Box>
  );
}
