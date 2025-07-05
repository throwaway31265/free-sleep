import { Box, FormControlLabel } from '@mui/material';
import Switch from '@mui/material/Switch';
import { DeepPartial } from 'ts-essentials';

import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';

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
    <Box sx={{ mt: 2, display: 'flex', mb: 2, alignItems: 'center', gap: 2 }}>
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
        label="Reboot once a day"
      />
    </Box>
  );
}
