import { Box, FormControlLabel } from '@mui/material';
import { TextField } from '@mui/material';

import { Settings } from '@api/settingsSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { useAppStore } from '@state/appStore.tsx';
import Switch from '@mui/material/Switch';


type PrimePodScheduleProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

export default function DailyPriming({ settings, updateSettings }: PrimePodScheduleProps) {
  const { isUpdating } = useAppStore();

  return (
    <Box sx={ { mt: 2, display: 'flex', mb: 2, alignItems: 'center', gap: 2 } }>
      <FormControlLabel
        control={
          <Switch
            disabled={ isUpdating }
            checked={ settings?.primePodDaily?.enabled || false }
            onChange={ (event) => updateSettings({ primePodDaily: { enabled: event.target.checked } }) }
          />
        }
        label="Prime daily?"
      />
      <TextField
        label="Prime time"
        type="time"
        value={ settings?.primePodDaily?.time || '12:00' }
        onChange={ (e) => updateSettings({ primePodDaily: { time: e.target.value } }) }
        disabled={ isUpdating || settings?.primePodDaily?.enabled === false }
        sx={ { mt: 2 } }
      />
    </Box>
  );
}
