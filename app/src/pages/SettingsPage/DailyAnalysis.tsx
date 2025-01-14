import { Box, FormControlLabel } from '@mui/material';
import { TextField } from '@mui/material';

import { Settings } from '@api/settingsSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { useAppStore } from '@state/appStore.tsx';
import Switch from '@mui/material/Switch';


type AnalyseSleepProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

export default function DailyAnalysis({ settings, updateSettings }: AnalyseSleepProps) {
  const { isUpdating } = useAppStore();

  return (
    <Box sx={{ mt: 2, display: 'flex', mb: 2, alignItems: 'center', gap: 2 }}>
      <FormControlLabel
        control={
          <Switch
            disabled={isUpdating}
            checked={settings?.analysisDaily.enabled || false}
            onChange={(event) => updateSettings({ analysisDaily: { enabled: event.target.checked } })}
          />
        }
        label="Analysis daily?"
      />
      {/* Only show these conditionally if analysis is enabled */}
      {settings?.analysisDaily.enabled && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Analysis time (this should be at least 30 minutes after getting up)"
            type="time"
            value={settings?.analysisDaily.time || '12:00'}
            onChange={(e) => updateSettings({ analysisDaily: { time: e.target.value } })}
            disabled={isUpdating}
          sx={{ mt: 2 }}
        />
        <TextField
          label="Estimated sleep start"
          type="time"
          value={settings?.analysisDaily.estimatedSleepStart || '12:00'}
          onChange={(e) => updateSettings({ analysisDaily: { estimatedSleepStart: e.target.value } })}
          disabled={isUpdating}
          sx={{ mt: 2 }}
        />
        <TextField
          label="Estimated sleep end"
          type="time"
          value={settings?.analysisDaily.estimatedSleepEnd || '12:00'}
          onChange={(e) => updateSettings({ analysisDaily: { estimatedSleepEnd: e.target.value } })}
          disabled={isUpdating}
          sx={{ mt: 2 }}
        />
        </Box>
      )}
    </Box>
  );
}
